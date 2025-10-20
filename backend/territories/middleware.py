from aws_lambda_powertools.middleware_factory import lambda_handler_decorator
from aws_lambda_powertools.utilities.validation import SchemaValidationError
from aws_lambda_powertools import Logger
from psycopg2.extras import RealDictCursor
import os
import json
import boto3
import psycopg2

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
            "Login validation failed",
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


def connect_to_aurora_db(secrets_client, db_secret_arn):
    # Retrieve secret
    secret_resp = secrets_client.get_secret_value(SecretId=db_secret_arn)
    secret = json.loads(secret_resp["SecretString"])

    host = secret.get("host", "localhost")
    port = secret.get("port", 5432)
    username = secret.get("username", "postgres")
    password = secret.get("password", "superSecretPass123")
    dbname = secret.get("dbname", "postgres")

    # Connect to Aurora Postgres
    conn = psycopg2.connect(
        host=host,
        port=port,
        user=username,
        password=password,
        dbname=dbname,
        connect_timeout=5,
    )

    cursor = conn.cursor(cursor_factory=RealDictCursor)

    return conn, cursor


class Territory:
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
