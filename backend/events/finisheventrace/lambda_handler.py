"""
Lambda function to save users run in event.
"""

import os
import json
from decimal import Decimal
from datetime import datetime, timezone
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
EVENT_TICKETS_TABLE = os.environ.get("EVENT_TICKETS_TABLE")
AVERAGE_STEPS_PER_KM = Decimal("1400")

# DynamoDB client
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
events_table = dynamodb.Table(EVENTS_TABLE)
tickets_table = dynamodb.Table(EVENT_TICKETS_TABLE)


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Finish an event race and save the run details in DynamoDB."""

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

    # Extract body details
    km_long = Decimal(str(body.get("km_long")))
    number_of_steps = Decimal(str(body.get("number_of_steps")))
    duration_in_seconds = Decimal(str(body.get("duration_in_seconds")))
    checkpoints = normalize_list(body.get("checkpoints", []))
    ticket_id = body.get("ticket_id")

    # Get event details
    event_item = get_event(event_id)
    if not event_item:
        return http_response(404, {"status": "error", "message": "Event not found"})

    # Get event ticket details
    ticket = get_event_ticket(ticket_id)
    if not ticket:
        return http_response(
            404, {"status": "error", "message": "Event ticket not found"}
        )

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

    # Verify event finish request
    if not check_event_km_long(event_item, km_long):
        return http_response(
            400,
            {
                "status": "error",
                "message": "Provided km_long does not match event km_long",
            },
        )

    if not check_number_of_steps(event_item, number_of_steps):
        return http_response(
            400,
            {
                "status": "error",
                "message": "Provided number_of_steps is not reasonable for the event distance",
            },
        )

    if not check_checkpoints(event_item, checkpoints):
        return http_response(
            400,
            {
                "status": "error",
                "message": "Provided checkpoints do not match event checkpoints",
            },
        )

    # Add run details to event
    run_details = {
        "user_id": user_id,
        "km_long": km_long,
        "number_of_steps": number_of_steps,
        "duration_in_seconds": duration_in_seconds,
        "average_pace_min_per_km": ((duration_in_seconds / km_long) / Decimal("60")),
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }

    set_details_in_event(event_id, run_details)
    mark_ticket_as_used(ticket_id)

    return http_response(
        200,
        {
            "status": "success",
            "message": "Event run finished successfully.",
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


def get_event(event_id):
    """Retrieve event from DynamoDB by ID."""

    response = events_table.get_item(Key={"id": event_id})
    return response.get("Item")


def check_event_km_long(event, km_long: Decimal) -> bool:
    """Check if the provided km_long matches the event's km_long."""

    try:
        event_km = Decimal(str(event.get("km_long", 0)))

        tolerance = event_km * Decimal("0.10")

        lower = event_km - tolerance
        upper = event_km + tolerance

        return lower <= km_long <= upper
    except (ArithmeticError, TypeError, ValueError):
        return False


def check_number_of_steps(event, number_of_steps: Decimal) -> bool:
    """Check if the provided number_of_steps is reasonable for the event distance (km_long)."""

    try:
        km_long = Decimal(str(event.get("km_long", 0)))
        if km_long <= 0:
            return False

        # Expected total steps
        expected_steps = km_long * AVERAGE_STEPS_PER_KM

        # ±25% tolerance
        tolerance = expected_steps * Decimal("0.25")

        lower = expected_steps - tolerance
        upper = expected_steps + tolerance

        return lower <= number_of_steps <= upper

    except (ArithmeticError, TypeError, ValueError):
        return False


def check_checkpoints(event, checkpoints: list) -> bool:
    """Check if the provided checkpoints match the event's checkpoints."""

    try:
        event_checkpoints = event.get("checkpoints", [])
        if len(event_checkpoints) != len(checkpoints):
            return False

        for ec, pc in zip(event_checkpoints, checkpoints):
            if (
                ec.get("address") != pc.get("address")
                or ec.get("lat") != pc.get("lat")
                or ec.get("lng") != pc.get("lng")
                or ec.get("is_start") != pc.get("is_start")
                or ec.get("is_end") != pc.get("is_end")
            ):
                return False

        return True

    except (TypeError, ValueError):
        return False


def set_details_in_event(event_id: str, run_details: dict) -> None:
    """Update the event item in DynamoDB with the run details."""

    events_table.update_item(
        Key={"id": event_id},
        UpdateExpression="SET runs = list_append(if_not_exists(runs, :empty_list), :new_run)",
        ExpressionAttributeValues={
            ":new_run": [run_details],
            ":empty_list": [],
        },
    )


def mark_ticket_as_used(event_ticket_id):
    """Mark the event ticket as used in DynamoDB."""

    tickets_table.update_item(
        Key={"id": event_ticket_id},
        UpdateExpression="SET is_used = :val",
        ExpressionAttributeValues={":val": True},
    )


def get_event_ticket(event_ticket_id):
    """Retrieve event ticket from DynamoDB by ID."""

    response = tickets_table.get_item(Key={"id": event_ticket_id})
    return response.get("Item")


def is_ticket_owned_by_user(ticket, user_id):
    """Check if the ticket is owned by the given user ID."""

    return ticket.get("user_id") == user_id


def is_ticket_used(ticket):
    """Check if the ticket has already been used."""

    return ticket.get("is_used", False)
