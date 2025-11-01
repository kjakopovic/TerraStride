"""
Lambda function to spend bought event ticket on a run
"""

import os
from decimal import Decimal
from datetime import datetime, timezone
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate

# pylint: disable=import-error
from middleware import middleware, http_response, cors_response, get_user_id
from validation_schema import path_params_schema

# Logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")
EVENTS_TABLE = os.environ.get("EVENTS_TABLE")
EVENT_TICKETS_TABLE = os.environ.get("EVENT_TICKETS_TABLE")

# DynamoDB client
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
events_table = dynamodb.Table(EVENTS_TABLE)
tickets_table = dynamodb.Table(EVENT_TICKETS_TABLE)


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Spend an event ticket for a running event in DynamoDB."""

    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle CORS preflight
    cors_resp = cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    headers = event.get("headers") or {}
    path_params = event.get("pathParameters") or {}

    # Validate schema
    validate(event=path_params, schema=path_params_schema)

    # Get event ticket details
    event_ticket_id = path_params.get("event_ticket_id")
    ticket = get_event_ticket(event_ticket_id)
    if not ticket:
        return http_response(
            404, {"status": "error", "message": "Event ticket not found"}
        )

    # Verify user
    user_id = get_user_id(headers)
    if not user_id:
        return http_response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    # Get event details
    event_id = ticket["event_id"]
    event = get_event(event_id)
    if not event:
        return http_response(404, {"status": "error", "message": "Event not found"})

    # Check ticket ownership
    if not is_ticket_owned_by_user(ticket, user_id):
        return http_response(
            403,
            {
                "status": "error",
                "message": "Forbidden - ticket does not belong to user",
            },
        )

    # Check if ticket is already used
    if is_ticket_used(ticket):
        return http_response(
            400, {"status": "error", "message": "Event ticket has already been used"}
        )

    # Check if event is active
    if not is_event_active(event):
        return http_response(400, {"status": "error", "message": "Event is not active"})

    # Mark ticket as used
    mark_ticket_as_used(event_ticket_id)

    return http_response(
        200,
        {
            "status": "success",
            "message": "Ticket consumed successfully",
            "event_ticket_id": event_ticket_id,
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


def get_event_ticket(event_ticket_id):
    """Retrieve event ticket from DynamoDB by ID."""

    response = tickets_table.get_item(Key={"id": event_ticket_id})
    return response.get("Item")


def get_event(event_id):
    """Retrieve event from DynamoDB by ID."""

    response = events_table.get_item(Key={"id": event_id})
    return response.get("Item")


def is_event_active(event):
    """Check if the event is currently active based on start and end dates."""

    startdate = datetime.fromisoformat(event["startdate"])
    enddate = datetime.fromisoformat(event["enddate"])

    # Ensure they are aware in UTC
    if startdate.tzinfo is None:
        startdate = startdate.replace(tzinfo=timezone.utc)
    else:
        startdate = startdate.astimezone(timezone.utc)

    if enddate.tzinfo is None:
        enddate = enddate.replace(tzinfo=timezone.utc)
    else:
        enddate = enddate.astimezone(timezone.utc)

    # Current UTC time
    now = datetime.now(timezone.utc)

    return startdate <= now <= enddate


def is_ticket_owned_by_user(ticket, user_id):
    """Check if the ticket is owned by the given user ID."""

    return ticket.get("user_id") == user_id


def is_ticket_used(ticket):
    """Check if the ticket has already been used."""

    return ticket.get("is_used", False)


def mark_ticket_as_used(event_ticket_id):
    """Mark the event ticket as used in DynamoDB."""

    tickets_table.update_item(
        Key={"id": event_ticket_id},
        UpdateExpression="SET is_used = :val",
        ExpressionAttributeValues={":val": True},
    )
