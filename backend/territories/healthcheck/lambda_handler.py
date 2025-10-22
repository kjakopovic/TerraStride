import boto3
import os
from aws_lambda_powertools import Logger
from middleware import middleware, _response, _cors_response

# Configure logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")

# Clients
secrets_client = boto3.client("secretsmanager")


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

    return _response(
        200,
        {
            "status": "success",
        },
    )
