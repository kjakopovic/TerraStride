import boto3
import os
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from middleware import middleware, _response, _cors_response, get_user_id
from validation_schema import schema
from datetime import timedelta

logger = Logger()

# Environment
AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
EVENTS_TABLE = os.environ.get("EVENTS_TABLE")

# DynamoDB client
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
events_table = dynamodb.Table(EVENTS_TABLE)


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Create a new event and store it in DynamoDB."""
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle preflight OPTIONS
    cors_resp = _cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    # Parse body
    event_body = json.loads(event.get("body") or "{}")

    headers = event.get("headers") or {}

    # Validate schema
    logger.info("Validating event creation request")
    validate(event=event_body, schema=schema)

    user_id = get_user_id(headers)
    if not user_id:
        return _response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    # Extract main event info
    name = event_body["name"]
    city = event_body["city"]
    entry_fee = Decimal(str(event_body["entry_fee"]))
    date_str = event_body["date"]  # YYYY-MM-DD
    start_time = event_body["startTime"]  # HH:MM

    # Combine date + startTime for startdate
    start_datetime = datetime.strptime(
        f"{date_str} {start_time}", "%Y-%m-%d %H:%M"
    ).replace(tzinfo=timezone.utc)
    end_datetime = start_datetime + timedelta(days=1)

    checkpoints = event_body.get("checkpoints", [])
    trace_points = event_body.get("trace", [])

    event_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    # Build item
    item = {
        "id": event_id,
        "name": name,
        "name_lower": name.lower(),
        "city": city,
        "city_lower": city.lower(),
        "startdate": start_datetime.isoformat(),
        "enddate": end_datetime.isoformat(),
        "entry_fee": entry_fee,
        "created_at": created_at,
        "user_id": user_id,
        "checkpoints": normalize_list(checkpoints),
        "trace": normalize_list(trace_points),
    }

    # Save to DynamoDB
    try:
        events_table.put_item(Item=item)
        logger.info(f"Event {event_id} created successfully in DynamoDB")
    except Exception as e:
        logger.exception("Error saving event to DynamoDB")
        return _response(
            500,
            {"status": "error", "message": f"Failed to create event: {str(e)}"},
        )

    return _response(
        201,
        {
            "status": "success",
            "message": f"Event '{name}' created successfully.",
            "event_id": event_id,
        },
    )


# Normalize numeric fields (DynamoDB requires Decimal)
def normalize_list(data_list):
    normalized = []
    for item in data_list:
        normalized_item = {}
        for k, v in item.items():
            if isinstance(v, float):
                normalized_item[k] = Decimal(str(v))
            else:
                normalized_item[k] = v
        normalized.append(normalized_item)
    return normalized
