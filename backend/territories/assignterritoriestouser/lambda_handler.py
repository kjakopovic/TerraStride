import boto3
import os
import json
from psycopg2.extras import execute_values
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from middleware import (
    middleware,
    _response,
    _cors_response,
    connect_to_aurora_db,
    get_user_id,
    Territory,
)
from validation_schema import schema

# TODO: update territory_count for user in cognito

# Configure logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")
DB_SECRET_ARN = os.environ.get("DB_SECRET_ARN")

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

    # Get body request
    event_body = json.loads(event.get("body")) if event.get("body") else {}
    headers = event.get("headers") or {}

    # Validate request
    logger.info("Validating request")
    validate(event=event_body, schema=schema)

    user_id = get_user_id(headers)
    if not user_id:
        return _response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    # Extract and convert territories to objects
    territories_data = event_body.get("territories", [])
    territories = [
        Territory.from_dict(territory, user_id=user_id)
        for territory in territories_data
    ]

    # Connect to Aurora DB
    conn, cursor = connect_to_aurora_db(secrets_client, DB_SECRET_ARN)

    try:
        upsert_territories_bulk(cursor, territories)
        conn.commit()
    except Exception as e:
        logger.error("Error upserting territories", extra={"error": str(e)})

        try:
            conn.rollback()
        except Exception as rollback_err:
            logger.warning(f"Rollback failed", extra={"error": str(rollback_err)})

        return _response(
            500, {"status": "error", "message": "Failed to assign/update territories."}
        )
    finally:
        try:
            cursor.close()
            conn.close()
        except Exception as close_err:
            logger.warning(f"Error closing DB resources: {close_err}")

    return _response(
        200,
        {
            "status": "success",
            "message": f"{len(territories)} territories assigned/updated successfully.",
        },
    )


def upsert_territories_bulk(cursor, territories: list[Territory]):
    """
    Efficiently upsert multiple territories at once.
    Only updates if the new average_pace > existing average_pace.
    """

    # Build a VALUES table from input data
    values = [
        (
            t.user_id,
            t.average_pace,
            t.color,
            t.left_top_corner_lat,
            t.left_top_corner_lng,
            t.right_top_corner_lat,
            t.right_top_corner_lng,
            t.left_bottom_corner_lat,
            t.left_bottom_corner_lng,
            t.right_bottom_corner_lat,
            t.right_bottom_corner_lng,
        )
        for t in territories
    ]

    # PostgreSQL UPSERT logic
    query = """
        INSERT INTO territories (
            user_id, average_pace, color,
            left_top_corner_lat, left_top_corner_lng,
            right_top_corner_lat, right_top_corner_lng,
            left_bottom_corner_lat, left_bottom_corner_lng,
            right_bottom_corner_lat, right_bottom_corner_lng
        )
        VALUES %s
        ON CONFLICT (
            left_top_corner_lat, left_top_corner_lng,
            right_top_corner_lat, right_top_corner_lng,
            left_bottom_corner_lat, left_bottom_corner_lng,
            right_bottom_corner_lat, right_bottom_corner_lng
        )
        DO UPDATE
        SET 
            user_id = EXCLUDED.user_id,
            average_pace = EXCLUDED.average_pace,
            color = EXCLUDED.color,
            updated_at = NOW()
        WHERE EXCLUDED.average_pace > territories.average_pace;
    """

    execute_values(cursor, query, values)
