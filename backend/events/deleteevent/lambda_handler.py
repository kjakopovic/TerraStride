import boto3
import os
from datetime import datetime
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from middleware import middleware, _response, _cors_response
from validation_schema import path_params_schema

# Logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")
EVENTS_TABLE = os.environ.get("EVENTS_TABLE")

# DynamoDB client
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
events_table = dynamodb.Table(EVENTS_TABLE)


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Soft delete an event and its nested checkpoints/traces."""
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # CORS preflight
    cors_resp = _cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    # Validate path parameters
    path_params = event.get("pathParameters") or {}
    validate(event=path_params, schema=path_params_schema)

    event_id = path_params.get("event_id")
    if not event_id:
        return _response(
            400, {"status": "error", "message": "Missing event_id in path parameters"}
        )

    timestamp = datetime.utcnow().isoformat()

    try:
        # Soft delete the event
        response = events_table.update_item(
            Key={"id": event_id},
            UpdateExpression="SET deleted_at = :deleted_at, updated_at = :deleted_at",
            ExpressionAttributeValues={":deleted_at": timestamp},
            ConditionExpression="attribute_not_exists(deleted_at)",
            ReturnValues="ALL_NEW",
        )

        if not response.get("Attributes"):
            # Event was already deleted
            return _response(
                404,
                {"status": "error", "message": "Event not found or already deleted"},
            )

    except events_table.meta.client.exceptions.ConditionalCheckFailedException:
        return _response(
            404,
            {"status": "error", "message": "Event not found or already deleted"},
        )
    except Exception as e:
        logger.exception("Failed to soft delete event")
        return _response(500, {"status": "error", "message": "Failed to delete event."})

    return _response(
        200,
        {
            "status": "success",
            "message": f"Event {event_id} soft deleted successfully.",
        },
    )
