import boto3
import os
from datetime import datetime
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from middleware import (
    middleware,
    _response,
    _cors_response,
    connect_to_aurora_db,
)
from validation_schema import path_params_schema

# Configure logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")
DB_SECRET_ARN = os.environ.get("DB_SECRET_ARN")

# AWS Clients
secrets_client = boto3.client("secretsmanager")


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Soft delete an event and all related records (checkpoints, traces)."""
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle preflight OPTIONS request
    cors_resp = _cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    # Extract headers and path parameters
    headers = event.get("headers") or {}
    path_params = event.get("pathParameters") or {}

    # Validate path parameters
    validate(event=path_params, schema=path_params_schema)

    event_id = path_params.get("event_id")
    if not event_id:
        return _response(
            400, {"status": "error", "message": "Missing event_id in path parameters"}
        )

    # Connect to Aurora
    conn, cursor = connect_to_aurora_db(secrets_client, DB_SECRET_ARN)

    try:
        deleted_count = soft_delete_event_and_related(cursor, event_id)
        conn.commit()

        if deleted_count == 0:
            return _response(
                404,
                {"status": "error", "message": "Event not found or already deleted"},
            )

    except Exception as e:
        logger.error("Error deleting event", extra={"error": str(e)})

        try:
            conn.rollback()
        except Exception as rollback_err:
            logger.warning(f"Rollback failed", extra={"error": str(rollback_err)})

        return _response(500, {"status": "error", "message": "Failed to delete event."})
    finally:
        try:
            cursor.close()
            conn.close()
        except Exception as close_err:
            logger.warning(f"Error closing DB resources: {close_err}")

    return _response(
        200,
        {
            "status": "success",
            "message": f"Event {event_id} soft deleted successfully.",
        },
    )


def soft_delete_event_and_related(cursor, event_id: str) -> int:
    """
    Soft delete the event and all related checkpoints and traces.
    Returns the number of events affected.
    """

    timestamp = datetime.utcnow().isoformat()

    # Mark the event as deleted
    event_query = """
        UPDATE events
        SET deleted_at = %(deleted_at)s, updated_at = NOW()
        WHERE id = %(event_id)s AND deleted_at IS NULL;
    """

    cursor.execute(event_query, {"deleted_at": timestamp, "event_id": event_id})
    affected_events = cursor.rowcount

    # If event not found, skip related deletes
    if affected_events == 0:
        return 0

    # Soft delete related checkpoints and traces
    checkpoint_query = """
        UPDATE event_checkpoints
        SET deleted_at = %(deleted_at)s, updated_at = NOW()
        WHERE event_id = %(event_id)s AND deleted_at IS NULL;
    """

    trace_query = """
        UPDATE event_trace
        SET deleted_at = %(deleted_at)s, updated_at = NOW()
        WHERE event_id = %(event_id)s AND deleted_at IS NULL;
    """

    cursor.execute(checkpoint_query, {"deleted_at": timestamp, "event_id": event_id})
    cursor.execute(trace_query, {"deleted_at": timestamp, "event_id": event_id})

    return affected_events
