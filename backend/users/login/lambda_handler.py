"""
Lambda function to handle user login using AWS Cognito.
"""

import json
import os
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate

# pylint: disable=import-error
from middleware import middleware, http_response, cors_response
from validation_schema import schema

# Configure logging
logger = Logger()

# Environment Variables
USER_POOL_CLIENT_ID = os.environ["USER_POOL_CLIENT_ID"]
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")

# Clients
cognito_client = boto3.client("cognito-idp")


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Handles user login and returns authentication tokens."""

    # Extract request information for logging
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle preflight OPTIONS request
    cors_resp = cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    # Get body request
    event_body = json.loads(event.get("body")) if event.get("body") else {}

    # Validate request
    logger.info("Validating request")
    validate(event=event_body, schema=schema)

    # Extract request body
    email = event_body.get("email")
    password = event_body.get("password")

    return log_in_user(email, password)


def log_in_user(email, password):
    """Authenticate user with Cognito and return tokens in cookies."""

    # Authenticate user using Cognito
    response = cognito_client.initiate_auth(
        ClientId=USER_POOL_CLIENT_ID,
        AuthFlow="USER_PASSWORD_AUTH",
        AuthParameters={"USERNAME": email, "PASSWORD": password},
    )

    # Extract tokens from the response
    id_token = response["AuthenticationResult"]["IdToken"]
    access_token = response["AuthenticationResult"]["AccessToken"]
    refresh_token = response["AuthenticationResult"]["RefreshToken"]
    expires_in = response["AuthenticationResult"]["ExpiresIn"]

    # For local development, remove Secure attribute if using http://localhost
    if not ALLOWED_ORIGIN.startswith("https://"):
        cookie_settings = "HttpOnly; Path=/; SameSite=Lax"
    else:
        cookie_settings = "HttpOnly; Secure; Path=/; SameSite=None"

    multi_headers = {
        "Set-Cookie": [
            f"accessToken={access_token}; {cookie_settings}; Max-Age={expires_in}",
            f"idToken={id_token}; {cookie_settings}; Max-Age={expires_in}",
            f"refreshToken={refresh_token}; {cookie_settings}; Max-Age=2592000",
        ],
        "Access-Control-Allow-Origin": [ALLOWED_ORIGIN],
        "Access-Control-Allow-Credentials": ["true"],
        "Content-Type": ["application/json"],
    }

    logger.info(
        "Authentication successful",
        extra={"email": email, "token_expires_in": expires_in},
    )

    return http_response(
        200,
        {
            "status": "success",
            "message": "Login successful",
            "accessToken": access_token,
            "idToken": id_token,
        },
        multi_value_headers=multi_headers,
    )
