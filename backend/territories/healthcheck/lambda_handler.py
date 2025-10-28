"""
Lambda function to perform health check - we use this to check if everything is ok.
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
secrets_client = boto3.client("secretsmanager")


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Health check lambda function."""

    # Extract request information for logging
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle preflight OPTIONS request
    cors_resp = cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    return http_response(
        200,
        {
            "status": "success",
        },
    )
