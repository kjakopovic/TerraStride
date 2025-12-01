"""
Lambda function to get user information from AWS Cognito.
"""

import os
import boto3
from aws_lambda_powertools import Logger

# pylint: disable=import-error
from middleware import middleware, http_response, cors_response

# Configure logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")

# Clients
cognito_client = boto3.client("cognito-idp")


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Fetches user information from Cognito using the provided access token."""

    # Extract request information for logging
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle preflight OPTIONS request
    cors_resp = cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    # Get request headers
    headers = event.get("headers") or {}

    user_attributes = get_user_attributes(headers)
    if not user_attributes:
        return http_response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    logger.info("Successfully fetched user info")

    return http_response(
        200,
        {
            "status": "success",
            "user": user_attributes,
        },
    )


def get_user_attributes(headers):
    """Fetch user attributes from Cognito using the access token in headers."""

    auth_header = headers.get("access_token")
    capitalized_auth_header = headers.get("Access_token")

    access_token = None

    if auth_header:
        access_token = auth_header
    elif capitalized_auth_header:
        access_token = capitalized_auth_header

    if not access_token:
        logger.warning(
            "Access token missing",
            extra={"headers": headers},
        )
        return None

    # Call Cognito to get user info
    response = cognito_client.get_user(AccessToken=access_token)

    # Parse attributes into a dict
    user_attributes = {}
    for attr in response["UserAttributes"]:
        attr_name = attr["Name"]
        # Remove 'custom:' prefix if present
        if attr_name.startswith("custom:"):
            attr_name = attr_name[7:]  # Remove 'custom:' (7 characters)

        # Drop sensitive Solana private key attribute
        if (
            attr["Name"] == "custom:solana_private_key"
            or attr_name == "solana_private_key"
        ):
            continue

        if (
            attr["Name"] == "custom:territory_blocks"
            or attr["Name"] == "custom:coin_balance"
        ):
            user_attributes[attr_name] = int(attr["Value"])

        elif attr["Name"] == "custom:token_balance" or attr["Name"] == "custom:xp":
            user_attributes[attr_name] = float(attr["Value"])

        else:
            user_attributes[attr_name] = attr["Value"]

    return user_attributes
