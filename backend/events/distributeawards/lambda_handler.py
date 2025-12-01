"""
Lambda function to distribute awards to finished event participants.
"""

import os
from datetime import datetime, timezone
from decimal import Decimal
from boto3.dynamodb.conditions import Key
import boto3
from aws_lambda_powertools import Logger

# pylint: disable=import-error
from middleware import middleware, http_response

logger = Logger()

# Environment
AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
USER_POOL_ID = os.environ.get("USER_POOL_ID")
EVENTS_TABLE = os.environ.get("EVENTS_TABLE")

# DynamoDB client
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
events_table = dynamodb.Table(EVENTS_TABLE)
cognito_client = boto3.client("cognito-idp", region_name=AWS_REGION)


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(_, context):
    """Distribute awards to participants of finished events."""

    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    finished_events = get_finished_events()
    if not finished_events:
        logger.info("No finished events found")
        return http_response(204)

    # Distribute awards logic here
    for event_item in finished_events:
        event_id = event_item.get("id", None)
        if not event_id:
            logger.error("Event item missing 'id' key, skipping")
            continue

        logger.info(f"Distributing awards for event: {event_id}")

        # Mark event as distributed
        events_table.update_item(
            Key={"id": event_id},
            UpdateExpression="SET is_distributed = :val",
            ExpressionAttributeValues={":val": 1},
        )

        # Distribute awards to participants
        prizes = distribute_event_prizes(event_item)

        logger.info(f"Distributed prizes: {prizes}")

        # Update user balances in Cognito
        for prize in prizes:
            user_id = prize["user_id"]
            coin_awards = prize["prize"]

            user_attributes = get_user_info_admin(user_id)
            current_balance = Decimal(user_attributes.get("custom:coin_balance", "0"))

            update_cognito_users_balance(user_id, current_balance + coin_awards)
            logger.info(
                f"Awarded {coin_awards} coins to user {user_id} for event {event_id}"
            )

    return http_response(
        200,
        {
            "status": "success",
            "message": "Awards distributed successfully",
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


def get_finished_events():
    """Fetch events that have finished but not yet distributed awards."""

    current_time_iso = datetime.now(timezone.utc).isoformat()

    # FilterExpression comparing ISO string timestamps
    response = events_table.query(
        IndexName="enddate-index",
        KeyConditionExpression=Key("is_distributed").eq(0)
        & Key("enddate").lte(current_time_iso),
    )

    return response.get("Items", [])


def distribute_event_prizes(event):
    """
    Calculate top 3 users by average pace and distribute prizes.

    Returns:
        List of dicts: [{"user_id": ..., "prize": ...}, ...]
    """

    runs = event.get("runs", [])
    entry_fee = Decimal(str(event.get("entry_fee", 0)))

    if not runs or entry_fee <= 0:
        return []

    # Total prize pool = number of runs * entry_fee
    total_prize = entry_fee * len(runs)

    # Sort runs by average pace ascending (fastest first)
    sorted_runs = sorted(runs, key=lambda x: x["average_pace_min_per_km"])

    # Take top 3 unique users
    top_users = []
    seen_users = set()

    for run in sorted_runs:
        uid = run["user_id"]
        if uid not in seen_users:
            top_users.append(uid)
            seen_users.add(uid)
        if len(top_users) == 3:
            break

    # Distribute prizes
    prize_distribution = [Decimal("0.7"), Decimal("0.2"), Decimal("0.1")]
    prizes = []

    for i, user_id in enumerate(top_users):
        prize = (total_prize * prize_distribution[i]).quantize(
            Decimal("0.01")
        )  # round to cents
        prizes.append({"user_id": user_id, "prize": prize})

    return prizes


def get_user_info_admin(user_id: str):
    """Retrieve user info from Cognito using admin privileges."""

    response = cognito_client.admin_get_user(UserPoolId=USER_POOL_ID, Username=user_id)

    # Convert attributes list to dict
    attributes = {attr["Name"]: attr["Value"] for attr in response["UserAttributes"]}

    return attributes


def update_cognito_users_balance(user_id: str, coin_awards: Decimal):
    """Update custom attribute in Cognito."""

    cognito_client.admin_update_user_attributes(
        UserPoolId=USER_POOL_ID,
        Username=user_id,
        UserAttributes=[{"Name": "custom:coin_balance", "Value": str(coin_awards)}],
    )
