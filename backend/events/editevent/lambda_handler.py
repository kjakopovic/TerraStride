"""
Lambda function to edit an existing running event in DynamoDB.
"""

import os
import json
from decimal import Decimal
from datetime import datetime, timedelta, timezone
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate

# pylint: disable=import-error
from middleware import middleware, http_response, cors_response, get_user_id
from validation_schema import schema, path_params_schema

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
    """Edit an existing event in DynamoDB (only by creator)."""

    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle CORS preflight
    cors_resp = cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    headers = event.get("headers") or {}
    path_params = event.get("pathParameters") or {}
    body = json.loads(event.get("body") or "{}")

    # Validate schemas
    validate(event=path_params, schema=path_params_schema)
    validate(event=body, schema=schema)

    event_id = path_params.get("event_id")
    user_id = get_user_id(headers)

    if not user_id:
        return http_response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    # Extract main event info
    name = body["name"]
    name_lower = name.lower()
    city = body["city"]
    city_lower = city.lower()
    km_long = Decimal(str(body["km_long"]))
    date_str = body["date"]
    start_time = body["startTime"]
    entry_fee = Decimal(str(body["entry_fee"]) if "entry_fee" in body else "0.0")
    checkpoints = normalize_list(body["checkpoints"])
    trace_points = normalize_list(body["trace"])

    # Combine date + startTime
    start_datetime = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M")
    end_datetime = start_datetime + timedelta(days=1)
    timestamp = datetime.now(timezone.utc).isoformat()

    # Update the event only if it exists and belongs to the user
    response = events_table.update_item(
        Key={"id": event_id},
        UpdateExpression=(
            "SET #name = :name, city = :city, startdate = :startdate, "
            "enddate = :enddate, entry_fee = :entry_fee, "
            "checkpoints = :checkpoints, trace = :trace, "
            "updated_at = :updated_at, name_lower = :name_lower, "
            "city_lower = :city_lower, km_long = :km_long"
        ),
        ConditionExpression="user_id = :user_id AND attribute_not_exists(deleted_at)",
        ExpressionAttributeNames={"#name": "name"},
        ExpressionAttributeValues={
            ":name": name,
            ":city": city,
            ":km_long": km_long,
            ":startdate": start_datetime.isoformat(),
            ":enddate": end_datetime.isoformat(),
            ":entry_fee": entry_fee,
            ":checkpoints": checkpoints,
            ":trace": trace_points,
            ":updated_at": timestamp,
            ":user_id": user_id,
            ":name_lower": name_lower,
            ":city_lower": city_lower,
        },
        ReturnValues="ALL_NEW",
    )

    if not response.get("Attributes"):
        return http_response(
            404,
            {
                "status": "error",
                "message": "Event not found or you are not authorized to edit it",
            },
        )

    return http_response(
        200,
        {
            "status": "success",
            "message": f"Event '{name}' updated successfully.",
            "event_id": event_id,
        },
    )


def normalize_list(data_list):
    """Convert float values in a list of dicts to Decimal."""

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
