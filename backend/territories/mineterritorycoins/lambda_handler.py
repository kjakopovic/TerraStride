"""
Lambda function to mine coins for user territories.
"""

from datetime import datetime, timezone
import os
import boto3
from boto3.dynamodb.conditions import Attr, Key
from aws_lambda_powertools import Logger

# pylint: disable=import-error
from middleware import middleware, http_response, cors_response, get_user_attributes

logger = Logger()

# Environment
AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
USER_POOL_ID = os.environ.get("USER_POOL_ID")
TERRITORIES_TABLE = os.environ.get("TERRITORIES_TABLE")

# Clients
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
territories_table = dynamodb.Table(TERRITORIES_TABLE)
cognito_client = boto3.client("cognito-idp", region_name=AWS_REGION)


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Mine coins for user territories and update Cognito count."""

    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle CORS
    cors_resp = cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    headers = event.get("headers") or {}

    user_attributes = get_user_attributes(headers)
    if not user_attributes:
        return http_response(401, {"status": "error", "message": "Unauthorized"})

    user_id = user_attributes.get("sub")
    if not user_id:
        return http_response(401, {"status": "error", "message": "Unauthorized"})

    # Count user territories (active)
    territory_count = get_user_territory_count(user_id)

    # Last mined in seconds
    last_mined = int(user_attributes.get("custom:last_mined", "0"))
    current_time = int(datetime.now(timezone.utc).timestamp())
    elapsed_seconds = current_time - last_mined

    tokens_mined = calculate_mined_tokens(territory_count, elapsed_seconds)

    logger.info(
        f"Calculated {tokens_mined} tokens mined for {territory_count} territories over {elapsed_seconds} seconds."
    )

    # Update Cognito attributes
    update_cognito_territories_info(
        user_id, territory_count, tokens_mined, current_time
    )

    logger.info(f"Updated Cognito count for user {user_id}: {territory_count}")

    logger.info(f"User {user_id} has {territory_count} active territories.")

    return http_response(
        200,
        {
            "status": "success",
            "message": "Mined tokens for territories successfully",
        },
    )


def get_user_territory_count(user_id: str) -> int:
    """Count territories for a user (deleted_at == None)."""

    response = territories_table.query(
        IndexName="user_id-index",
        KeyConditionExpression=Key("user_id").eq(user_id),
        FilterExpression=Attr("deleted_at").not_exists() | Attr("deleted_at").eq(None),
        ProjectionExpression="user_id",
    )
    count = response["Count"]

    return count


def update_cognito_territories_info(
    user_id: str, territory_count: int, tokens_mined: int, current_time: int
):
    """Update custom attribute in Cognito."""

    cognito_client.admin_update_user_attributes(
        UserPoolId=USER_POOL_ID,
        Username=user_id,
        UserAttributes=[
            {"Name": "custom:territory_blocks", "Value": str(territory_count)},
            {"Name": "custom:token_balance", "Value": str(tokens_mined)},
            {
                "Name": "custom:last_mined",
                "Value": str(current_time),
            },
        ],
    )


def calculate_mined_tokens(territory_count: int, elapsed_seconds: int) -> int:
    """Calculate mined tokens based on territory count and elapsed time."""

    # Example mining rate: 1 token per territory every hour
    mining_rate_per_territory_per_hour = 0.05
    hours_elapsed = elapsed_seconds / 3600

    tokens_mined = str(
        float(territory_count * mining_rate_per_territory_per_hour * hours_elapsed)
    )

    return tokens_mined
