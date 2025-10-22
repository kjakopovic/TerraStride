from aws_lambda_powertools.middleware_factory import lambda_handler_decorator
from aws_lambda_powertools.utilities.validation import SchemaValidationError
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError
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

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "UnknownError")
        error_message = e.response.get("Error", {}).get("Message", str(e))

        logger.error(
            "Client error occurred",
            extra={"error_code": error_code, "error_message": error_message},
        )

        if (
            error_code == "InvalidParameterException"
            and "ResendEmailVerificationCode" in context.function_name
        ):
            return _response(
                400, {"status": "error", "message": "User is already confirmed"}
            )
        elif error_code == "CodeMismatchException":
            return _response(
                400, {"status": "error", "message": "Invalid verification code"}
            )
        elif error_code == "ExpiredCodeException":
            return _response(
                400, {"status": "error", "message": "Verification code has expired"}
            )
        elif error_code in ["NotAuthorizedException", "InvalidParameterException"]:
            return _response(
                401, {"status": "error", "message": "Incorrect username or password"}
            )
        elif error_code == "UserNotFoundException":
            return _response(404, {"status": "error", "message": "User does not exist"})
        elif error_code == "UsernameExistsException":
            return _response(409, {"status": "error", "message": "User already exists"})
        else:
            return _response(
                500, {"status": "error", "message": f"Error found: {error_message}"}
            )

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
        "body": json.dumps(body, default=str),
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


def get_user_id(headers):
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
