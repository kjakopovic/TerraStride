import boto3
import os
import json
import uuid
from datetime import datetime
from psycopg2.extras import execute_values
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from middleware import (
    middleware,
    _response,
    _cors_response,
    connect_to_aurora_db,
    get_user_id,
)
from validation_schema import schema, path_params_schema

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
    """Edit an existing event (only by creator)."""
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle CORS preflight
    cors_resp = _cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    headers = event.get("headers") or {}
    path_params = event.get("pathParameters") or {}
    body = json.loads(event.get("body")) if event.get("body") else {}

    # Validate both schemas
    logger.info("Validating request data for edit_event")
    validate(event=path_params, schema=path_params_schema)
    validate(event=body, schema=schema)

    event_id = path_params.get("event_id")

    user_id = get_user_id(headers)
    if not user_id:
        return _response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    # Extract main event info
    name = body["name"]
    city = body["city"]
    date_str = body["date"]
    start_time = body["startTime"]
    entry_fee = body["entry_fee"]
    checkpoints = body["checkpoints"]
    trace_points = body["trace"]

    # Combine into datetime
    start_datetime = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M")
    end_datetime = start_datetime.replace(hour=23, minute=59)

    # Connect to Aurora DB
    conn, cursor = connect_to_aurora_db(secrets_client, DB_SECRET_ARN)

    try:
        # Validate event ownership
        cursor.execute(
            "SELECT id FROM events WHERE id = %s AND user_id = %s AND deleted_at IS NULL;",
            (event_id, user_id),
        )
        if not cursor.fetchone():
            return _response(
                403,
                {
                    "status": "error",
                    "message": "You are not authorized to edit this event or it does not exist.",
                },
            )

        # Perform event update
        update_event(
            cursor, event_id, name, city, start_datetime, end_datetime, entry_fee
        )

        # Soft delete old checkpoints and traces
        soft_delete_related_records(cursor, event_id)

        # Insert new checkpoints and traces
        insert_checkpoints(cursor, event_id, checkpoints)
        insert_trace_points(cursor, event_id, trace_points)

        conn.commit()
        logger.info(f"Event {event_id} updated successfully")

    except Exception as e:
        logger.error("Error editing event", extra={"error": str(e)})
        try:
            conn.rollback()
        except Exception as rollback_err:
            logger.warning("Rollback failed", extra={"error": str(rollback_err)})

        return _response(500, {"status": "error", "message": "Failed to edit event."})

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
            "message": f"Event '{name}' updated successfully.",
            "event_id": event_id,
        },
    )


def update_event(cursor, event_id, name, city, startdate, enddate, entry_fee):
    """Update event core details."""
    query = """
        UPDATE events
        SET name = %s,
            city = %s,
            startdate = %s,
            enddate = %s,
            entry_fee = %s,
            updated_at = NOW()
        WHERE id = %s;
    """
    cursor.execute(query, (name, city, startdate, enddate, entry_fee, event_id))


def soft_delete_related_records(cursor, event_id):
    """Soft-delete checkpoints and trace related to this event."""
    cursor.execute(
        """
        UPDATE event_checkpoints
        SET deleted_at = NOW()
        WHERE event_id = %s AND deleted_at IS NULL;
    """,
        (event_id,),
    )
    cursor.execute(
        """
        UPDATE event_trace
        SET deleted_at = NOW()
        WHERE event_id = %s AND deleted_at IS NULL;
    """,
        (event_id,),
    )


def insert_checkpoints(cursor, event_id, checkpoints):
    """Insert event checkpoints efficiently."""
    values = [
        (
            str(uuid.uuid4()),
            cp["lat"],
            cp["lng"],
            idx + 1,
            cp["start"],
            cp["end"],
            event_id,
        )
        for idx, cp in enumerate(checkpoints)
    ]

    query = """
        INSERT INTO event_checkpoints (
            id, lat, lng, sequence_number, is_start, is_end, event_id
        )
        VALUES %s
    """
    execute_values(cursor, query, values)


def insert_trace_points(cursor, event_id, trace_points):
    """Insert event trace points efficiently."""
    values = [
        (str(uuid.uuid4()), tp["lat"], tp["lng"], event_id) for tp in trace_points
    ]
    query = """
        INSERT INTO event_trace (id, lat, lng, event_id)
        VALUES %s
    """
    execute_values(cursor, query, values)
