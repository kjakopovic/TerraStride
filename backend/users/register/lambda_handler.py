import json
import os
from time import time
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from middleware import middleware, _response, _cors_response
from validation_schema import schema

# Configure logging
logger = Logger()

# Environment Variables
USER_POOL_CLIENT_ID = os.environ["USER_POOL_CLIENT_ID"]

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

    # Get body request
    event_body = json.loads(event.get("body")) if event.get("body") else {}

    # Validate request
    logger.info("Validating request")
    validate(event=event_body, schema=schema)

    # Extract request body
    email = event_body.get("email")
    password = event_body.get("password")
    username = event_body.get("username")
    passcode = event_body.get("passcode")

    logger.info("Processing registration", extra={"email": email})

    return register_user(email, password, username, passcode)


def register_user(email, password, username, six_digit_code):
    # Register user in Cognito
    response = cognito_client.sign_up(
        ClientId=USER_POOL_CLIENT_ID,
        Username=email,
        Password=password,
        UserAttributes=[
            {"Name": "email", "Value": email},
            {"Name": "username", "Value": username},
            {"Name": "six_digit_code", "Value": six_digit_code},
            {"Name": "coin_balance", "Value": 0},
            {"Name": "territory_blocks", "Value": 0},
            {"Name": "updated_at", "Value": time()},
            {"Name": "created_at", "Value": time()},
        ],
    )

    logger.info("User sign-up successful", extra={"user_sub": response["UserSub"]})

    return _response(
        200,
        {
            "status": "success",
            "user": response,
        },
    )
