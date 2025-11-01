"""
Lambda that allows users to buy event tickets if they are active
and the user has sufficient balance.
"""

import os
import json
import uuid
from decimal import Decimal
from datetime import datetime
from datetime import timezone
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate

# pylint: disable=import-error
from middleware import middleware, http_response, cors_response, get_user_id
from validation_schema import schema

# Logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")
EVENTS_TABLE = os.environ.get("EVENTS_TABLE")
EVENT_TICKETS_TABLE = os.environ.get("EVENT_TICKETS_TABLE")
USER_POOL_ID = os.environ.get("USER_POOL_ID")

# DynamoDB clients
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
events_table = dynamodb.Table(EVENTS_TABLE)
tickets_table = dynamodb.Table(EVENT_TICKETS_TABLE)

# Cognito client
cognito_client = boto3.client("cognito-idp", region_name=AWS_REGION)


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Allows user to buy an event ticket if it's active and they have enough balance."""

    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # CORS preflight
    cors_resp = cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    headers = event.get("headers") or {}
    body = json.loads(event.get("body") or "{}")

    # Validate request
    validate(event=body, schema=schema)

    user_id = get_user_id(headers)
    if not user_id:
        return http_response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    event_id = body["event_id"]

    # Get event details (active)
    event_item = events_table.get_item(Key={"id": event_id}).get("Item")
    if not event_item:
        return http_response(
            400, {"status": "error", "message": "Event does not exist"}
        )

    # Parse event datetimes as aware UTC
    startdate = datetime.fromisoformat(event_item["startdate"])
    enddate = datetime.fromisoformat(event_item["enddate"])

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

    if not startdate <= now <= enddate:
        return http_response(400, {"status": "error", "message": "Event is not active"})

    entry_fee = Decimal(str(event_item.get("entry_fee", 0)))

    # Check if user already has a ticket
    existing_tickets = tickets_table.query(
        IndexName="user_id-index",
        KeyConditionExpression=boto3.dynamodb.conditions.Key("user_id").eq(user_id),
    )["Items"]

    if any(t["event_id"] == event_id for t in existing_tickets):
        return http_response(
            400,
            {"status": "error", "message": "You have already attended this event"},
        )

    # Get user balance from Cognito
    user_attrs = get_cognito_user_attributes(user_id)

    current_balance = Decimal(user_attrs.get("custom:coin_balance", "0"))
    if current_balance < entry_fee:
        return http_response(
            400,
            {
                "status": "error",
                "message": "Insufficient balance to attend this event",
            },
        )

    # Deduct balance
    new_balance = current_balance - entry_fee
    update_cognito_balance(user_id, new_balance)

    # Create ticket
    ticket_id = str(uuid.uuid4())
    tickets_table.put_item(
        Item={
            "event_id": event_id,
            "id": ticket_id,
            "user_id": user_id,
            "price": str(entry_fee),
            "created_at": datetime.utcnow().isoformat(),
        }
    )

    logger.info(f"User {user_id} attended event {event_id} with ticket {ticket_id}")

    return http_response(
        200,
        {
            "status": "success",
            "message": f"User successfully attended event {event_id}.",
            "ticket_id": ticket_id,
            "new_balance": str(new_balance),
        },
    )


def get_cognito_user_attributes(user_id):
    """Fetch user attributes from Cognito."""

    response = cognito_client.admin_get_user(UserPoolId=USER_POOL_ID, Username=user_id)

    return {attr["Name"]: attr["Value"] for attr in response["UserAttributes"]}


def update_cognito_balance(user_id, new_balance):
    """Update user's coin balance in Cognito."""

    cognito_client.admin_update_user_attributes(
        UserPoolId=USER_POOL_ID,
        Username=user_id,
        UserAttributes=[{"Name": "custom:coin_balance", "Value": str(new_balance)}],
    )

    logger.info(f"Updated user {user_id} balance to {new_balance}")
