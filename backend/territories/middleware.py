"""
Middleware for AWS Lambda functions using AWS Lambda Powertools.
Handles error catching, logging, and CORS responses.
"""

import os
import json
from aws_lambda_powertools.middleware_factory import lambda_handler_decorator
from aws_lambda_powertools.utilities.validation import SchemaValidationError
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError
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


class Territory:
    """Territory data model."""

    def __init__(
        self,
        territory_id=None,
        user_id=None,
        average_pace=None,
        color=None,
        left_top_corner_lat=None,
        left_top_corner_lng=None,
        left_bottom_corner_lat=None,
        left_bottom_corner_lng=None,
        right_top_corner_lat=None,
        right_top_corner_lng=None,
        right_bottom_corner_lat=None,
        right_bottom_corner_lng=None,
    ):
        self.territory_id = territory_id
        self.user_id = user_id
        self.user = {}
        self.color = color

        # Ensure average_pace is stored as float if present
        self.average_pace = float(average_pace) if average_pace is not None else None

        # Corners (float values)
        self.left_top_corner_lat = (
            float(left_top_corner_lat) if left_top_corner_lat is not None else None
        )
        self.left_top_corner_lng = (
            float(left_top_corner_lng) if left_top_corner_lng is not None else None
        )
        self.left_bottom_corner_lat = (
            float(left_bottom_corner_lat)
            if left_bottom_corner_lat is not None
            else None
        )
        self.left_bottom_corner_lng = (
            float(left_bottom_corner_lng)
            if left_bottom_corner_lng is not None
            else None
        )
        self.right_top_corner_lat = (
            float(right_top_corner_lat) if right_top_corner_lat is not None else None
        )
        self.right_top_corner_lng = (
            float(right_top_corner_lng) if right_top_corner_lng is not None else None
        )
        self.right_bottom_corner_lat = (
            float(right_bottom_corner_lat)
            if right_bottom_corner_lat is not None
            else None
        )
        self.right_bottom_corner_lng = (
            float(right_bottom_corner_lng)
            if right_bottom_corner_lng is not None
            else None
        )

    @classmethod
    def from_dict(cls, data: dict, user_id=None):
        """
        Create a Territory object from a dictionary that matches the schema.
        Ignores unexpected keys.
        """
        allowed_fields = {
            "territory_id",
            "average_pace",
            "color",
            "left_top_corner_lat",
            "left_top_corner_lng",
            "left_bottom_corner_lat",
            "left_bottom_corner_lng",
            "right_top_corner_lat",
            "right_top_corner_lng",
            "right_bottom_corner_lat",
            "right_bottom_corner_lng",
        }

        filtered_data = {k: v for k, v in data.items() if k in allowed_fields}
        return cls(**filtered_data, user_id=user_id)

    def to_dict(self):
        """Optional: serialize to dict (for debugging or DB inserts)."""
        return self.__dict__
