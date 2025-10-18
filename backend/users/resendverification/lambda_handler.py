import json
import os
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from middleware import middleware, _response, _cors_response
from validation_schema import schema

# Configure logging
logger = Logger()

# Environment Variables
USER_POOL_CLIENT_ID = os.environ["USER_POOL_CLIENT_ID"]

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

    return resend_verification_code(email)


def resend_verification_code(email):
    response = cognito_client.resend_confirmation_code(
        ClientId=USER_POOL_CLIENT_ID,
        Username=email,
    )

    logger.info("Resent verification code", extra={"email": email})

    return _response(
        200,
        {
            "status": "success",
            "delivery": response.get("CodeDeliveryDetails"),
        },
    )
