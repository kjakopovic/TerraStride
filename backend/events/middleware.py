"""
Middleware for AWS Lambda functions using AWS Lambda Powertools.
Handles error catching, logging, and CORS responses.
"""

import os
import json
import boto3
from aws_lambda_powertools.middleware_factory import lambda_handler_decorator
from aws_lambda_powertools.utilities.validation import SchemaValidationError
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError

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
    """Middleware to handle errors, logging, and CORS responses."""

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

    except ClientError as e:
        return _handle_client_error(e, context)

    except SchemaValidationError as e:
        logger.warning(
            "schema validation failed",
            extra={"status": "error", "reason": "schema_failed"},
        )
        return http_response(400, {"status": "error", "message": str(e)})

    # pylint: disable=broad-except
    except Exception as e:
        logger.error("Unexpected error during request", extra={"error": str(e)})
        return http_response(
            500, {"status": "error", "message": "An unexpected error occurred"}
        )


# pylint: disable=too-many-return-statements
def _handle_client_error(e, context):
    """
    Handles client exceptions from AWS Cognito or other services.

    Args:
        e: The exception object, expected to have a 'response' attribute.
        context: The Lambda context or any object with `function_name`.

    Returns:
        dict: A structured HTTP response with appropriate status code and message.
    """

    # Extract error code and message safely
    error_code = e.response.get("Error", {}).get("Code", "UnknownError")
    error_message = e.response.get("Error", {}).get("Message", str(e))

    # Log the error with details
    logger.error(
        "Client error occurred",
        extra={"error_code": error_code, "error_message": error_message},
    )

    # Map known error codes to responses
    if (
        error_code == "InvalidParameterException"
        and "ResendEmailVerificationCode" in context.function_name
    ):
        return http_response(
            400, {"status": "error", "message": "User is already confirmed"}
        )

    if error_code == "CodeMismatchException":
        return http_response(
            400, {"status": "error", "message": "Invalid verification code"}
        )

    if error_code == "ExpiredCodeException":
        return http_response(
            400, {"status": "error", "message": "Verification code has expired"}
        )

    if error_code in ["NotAuthorizedException", "InvalidParameterException"]:
        return http_response(
            401, {"status": "error", "message": "Access token expired"}
        )

    if error_code == "UserNotFoundException":
        return http_response(404, {"status": "error", "message": "User does not exist"})

    if error_code == "UsernameExistsException":
        return http_response(409, {"status": "error", "message": "User already exists"})

    # Default fallback for unknown errors
    return http_response(
        500, {"status": "error", "message": f"Error found: {error_message}"}
    )


def http_response(status, body, extra_headers=None, multi_value_headers=None):
    """Construct HTTP response with standard headers."""

    headers = {**BASE_HEADERS, **(extra_headers or {})}

    resp = {
        "statusCode": status,
        "headers": headers,
        "body": json.dumps(body, default=str),
    }

    if multi_value_headers:
        resp["multiValueHeaders"] = multi_value_headers

    return resp


def cors_response(method):
    """Handle CORS preflight requests."""

    if method == "OPTIONS":
        return http_response(
            200,
            "",
            extra_headers={
                "Access-Control-Allow-Headers": (
                    "Content-Type,Authorization,Access_token,access_token"
                ),
                "Access-Control-Allow-Methods": ("OPTIONS,GET,POST,PUT,DELETE,PATCH"),
            },
        )

    return None


def get_user_id(headers):
    """
    Extract user ID from Cognito using access token in headers.
    """

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

    # Extract user id
    user_id = user_attributes.get("sub")

    return user_id
