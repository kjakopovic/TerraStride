import boto3
import os
from aws_lambda_powertools import Logger
from middleware import middleware, _response, _cors_response

# Configure logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")

# Clients
cognito_client = boto3.client("cognito-idp")


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    # Extract request information for logging
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle preflight OPTIONS request
    cors_resp = _cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    # Get request headers
    headers = event.get("headers") or {}

    user_attributes = get_user_attributes(headers)
    if not user_attributes:
        return _response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    logger.info("Successfully fetched user info")

    return _response(
        200,
        {
            "status": "success",
            "user": user_attributes,
        },
    )


def get_user_attributes(headers):
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
    user_attributes = {
        attr["Name"]: attr["Value"] for attr in response["UserAttributes"]
    }

    return user_attributes
