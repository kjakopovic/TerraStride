import boto3
import os
import json
import uuid
from decimal import Decimal
from datetime import datetime
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from middleware import (
    middleware,
    _response,
    _cors_response,
    connect_to_aurora_db,
    get_user_id,
)
from validation_schema import schema

# Configure logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")
DB_SECRET_ARN = os.environ.get("DB_SECRET_ARN")
USER_POOL_ID = os.environ.get("USER_POOL_ID")

# AWS Clients
secrets_client = boto3.client("secretsmanager")
cognito_client = boto3.client("cognito-idp")


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Allows a user to attend an event if it's active and they have enough balance."""
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle CORS preflight
    cors_resp = _cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    headers = event.get("headers") or {}
    body = json.loads(event.get("body")) if event.get("body") else {}

    # Validate input
    try:
        validate(event=body, schema=schema)
    except Exception as e:
        return _response(
            400, {"status": "error", "message": f"Invalid request: {str(e)}"}
        )

    user_id = get_user_id(headers)
    if not user_id:
        return _response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    event_id = body["event_id"]

    # Connect to Aurora
    conn, cursor = connect_to_aurora_db(secrets_client, DB_SECRET_ARN)

    try:
        # Get event details (ensure it's active)
        cursor.execute(
            """
            SELECT id, entry_fee, startdate, enddate
            FROM events
            WHERE id = %s
              AND deleted_at IS NULL
              AND NOW() BETWEEN startdate AND enddate;
            """,
            (event_id,),
        )
        event_row = cursor.fetchone()

        if not event_row:
            return _response(
                400,
                {
                    "status": "error",
                    "message": "Event is not active or does not exist.",
                },
            )

        event_id, entry_fee, startdate, enddate = event_row
        entry_fee = Decimal(entry_fee or 0)

        # Check if user already has a ticket
        cursor.execute(
            """
            SELECT 1 FROM event_tickets
            WHERE event_id = %s AND user_id = %s AND deleted_at IS NULL;
            """,
            (event_id, user_id),
        )
        if cursor.fetchone():
            return _response(
                400,
                {
                    "status": "error",
                    "message": "You have already attended this event.",
                },
            )

        # Get user attributes from Cognito
        user_attrs = get_cognito_user_attributes(user_id)
        if not user_attrs:
            return _response(
                404, {"status": "error", "message": "User not found in Cognito"}
            )

        current_balance = Decimal(user_attrs.get("custom:coin_balance", "0"))

        logger.info(f"User balance: {current_balance}, Entry fee: {entry_fee}")

        if current_balance < entry_fee:
            return _response(
                400,
                {
                    "status": "error",
                    "message": "Insufficient balance to attend this event.",
                },
            )

        # Deduct entry fee and update Cognito balance
        new_balance = current_balance - entry_fee
        update_cognito_balance(user_id, new_balance)

        # Create event ticket record
        ticket_id = str(uuid.uuid4())
        insert_event_ticket(cursor, ticket_id, entry_fee, user_id, event_id)

        conn.commit()

        logger.info(
            f"User {user_id} attended event {event_id} with ticket {ticket_id}, new balance: {new_balance}"
        )

    except Exception as e:
        logger.error("Error attending event", extra={"error": str(e)})
        try:
            conn.rollback()
        except Exception as rollback_err:
            logger.warning("Rollback failed", extra={"error": str(rollback_err)})
        return _response(500, {"status": "error", "message": "Failed to attend event."})

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
            "message": f"User successfully attended event {event_id}.",
            "ticket_id": ticket_id,
            "new_balance": str(new_balance),
        },
    )


def get_cognito_user_attributes(user_id):
    """Fetch user attributes from Cognito."""
    try:
        response = cognito_client.admin_get_user(
            UserPoolId=USER_POOL_ID,
            Username=user_id,
        )
        attributes = {
            attr["Name"]: attr["Value"] for attr in response["UserAttributes"]
        }
        return attributes
    except cognito_client.exceptions.UserNotFoundException:
        logger.warning(f"User {user_id} not found in Cognito.")
        return None
    except Exception as e:
        logger.error("Error fetching user attributes", extra={"error": str(e)})
        raise


def update_cognito_balance(user_id, new_balance):
    """Update user's coin balance in Cognito."""
    try:
        cognito_client.admin_update_user_attributes(
            UserPoolId=USER_POOL_ID,
            Username=user_id,
            UserAttributes=[
                {"Name": "custom:coin_balance", "Value": str(new_balance)},
            ],
        )
        logger.info(f"Updated user {user_id} balance to {new_balance}")
    except Exception as e:
        logger.error("Failed to update Cognito balance", extra={"error": str(e)})
        raise


def insert_event_ticket(cursor, ticket_id, price, user_id, event_id):
    """Insert a new event ticket record."""
    query = """
        INSERT INTO event_tickets (id, price, user_id, event_id)
        VALUES (%s, %s, %s, %s);
    """
    cursor.execute(query, (ticket_id, price, user_id, event_id))
