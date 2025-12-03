"""
Lambda function to log frontend actions to DynamoDB.
"""

import os
import uuid
import json
import boto3
from aws_lambda_powertools import Logger

# pylint: disable=import-error
from middleware import middleware, http_response, cors_response

# Configure logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")
LOGS_TABLE_NAME = os.environ.get("FRONTEND_LOGS_TABLE")

# Clients
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
frontend_logs_table = dynamodb.Table(LOGS_TABLE_NAME)


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Log frontend action function."""

    # Extract request information for logging
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle preflight OPTIONS request
    cors_resp = cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    # Retrieve body info
    event_body = json.loads(event.get("body") or "{}")
    logs_value = event_body.get("log")

    # Log the incoming request body
    logger.info(f"Received event: {event}")
    log_id = str(uuid.uuid4())
    log_item = {
        "id": log_id,
        "log": logs_value,
    }
    frontend_logs_table.put_item(Item=log_item)

    return http_response(
        200,
        {
            "status": "success",
        },
    )
