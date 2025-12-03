"""
Lambda function to get users active events tickets.
"""

import os
import boto3
from boto3.dynamodb.conditions import Key, Attr
from aws_lambda_powertools import Logger

# pylint: disable=import-error
from middleware import middleware, http_response, cors_response, get_user_id

# Logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")
EVENT_TICKETS_TABLE = os.environ.get("EVENT_TICKETS_TABLE")

# DynamoDB client
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
tickets_table = dynamodb.Table(EVENT_TICKETS_TABLE)


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Get users active event tickets from DynamoDB."""

    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle CORS preflight
    cors_resp = cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    headers = event.get("headers") or {}

    # Verify user
    user_id = get_user_id(headers)
    if not user_id:
        return http_response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    user_tickets = get_users_tickets_for_event(user_id)

    return http_response(
        200,
        {
            "status": "success",
            "message": "Tickets retrieved successfully",
            "user_tickets": user_tickets,
        },
    )


def get_users_tickets_for_event(user_id):
    """Retrieve all active tickets for a user."""

    response = tickets_table.query(
        IndexName="user_id-index",
        KeyConditionExpression=Key("user_id").eq(user_id),
        FilterExpression=Attr("is_used").ne(True),
    )

    return response.get("Items", [])
