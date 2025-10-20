from aws_lambda_powertools.middleware_factory import lambda_handler_decorator
from aws_lambda_powertools.utilities.validation import SchemaValidationError
from aws_lambda_powertools import Logger
import os
import json
import boto3

# Configure logging
logger = Logger()

# Clients
cognito_client = boto3.client("cognito-idp")

# Environment variables
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")

# Default headers
BASE_HEADERS = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Content-Type": "application/json",
}


@lambda_handler_decorator
def middleware(handler, event, context):
    logger.info(
        "Middleware executed",
        extra={
            "function_name": context.function_name,
            "function_version": context.function_version,
            "invoked_function_arn": context.invoked_function_arn,
            "aws_request_id": context.aws_request_id,
        },
    )

    try:
        return handler(event, context)

    except SchemaValidationError as e:
        logger.warning(
            "schema validation failed",
            extra={"status": "error", "reason": "schema_failed"},
        )
        return _response(400, {"status": "error", "message": str(e)})

    except Exception as e:
        logger.error("Unexpected error during request", extra={"error": str(e)})
        return _response(
            500, {"status": "error", "message": "An unexpected error occurred"}
        )


def _response(status, body, extra_headers=None, multi_value_headers=None):
    headers = {**BASE_HEADERS, **(extra_headers or {})}

    resp = {
        "statusCode": status,
        "headers": headers,
        "body": json.dumps(body),
    }

    if multi_value_headers:
        resp["multiValueHeaders"] = multi_value_headers

    return resp


def _cors_response(method):
    # Handle preflight OPTIONS request
    if method == "OPTIONS":
        return _response(
            200,
            "",
            extra_headers={
                "Access-Control-Allow-Headers": "Content-Type,Authorization,Access_token,access_token",
                "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE,PATCH",
            },
        )

    return None
