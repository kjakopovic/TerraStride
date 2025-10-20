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

# Configure logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION")
DB_SECRET_ARN = os.environ.get("DB_SECRET_ARN")
USER_POOL_ID = os.environ.get("USER_POOL_ID")

# AWS Clients
secrets_client = boto3.client("secretsmanager")
cognito_client = boto3.client("cognito-idp")


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Upsert multiple territories and update user territory count in Cognito."""
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle CORS
    cors_resp = _cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

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

    territories_data = event_body.get("territories", [])
    territories = [
        Territory.from_dict(territory, user_id=user_id)
        for territory in territories_data
    ]

    # Connect to DB
    conn, cursor = connect_to_aurora_db(secrets_client, DB_SECRET_ARN)

    try:
        upsert_territories_bulk(cursor, territories)
        conn.commit()

        # After upsert, count how many territories belong to this user
        territory_count = get_user_territory_count(cursor, user_id)

        # Update Cognito with the new count
        update_cognito_territory_count(user_id, territory_count)

        logger.info(
            f"Updated Cognito territory count for user {user_id} → {territory_count}"
        )

    except Exception as e:
        logger.error("Error upserting territories", extra={"error": str(e)})

        try:
            conn.rollback()
        except Exception as rollback_err:
            logger.warning(f"Rollback failed", extra={"error": str(rollback_err)})

        return _response(
            500,
            {"status": "error", "message": "Failed to assign/update territories."},
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
            "territory_count": territory_count,
        },
    )


def upsert_territories_bulk(cursor, territories: list[Territory]):
    """
    Efficiently upsert multiple territories at once.
    Only updates if the new average_pace > existing average_pace.
    """
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


def get_user_territory_count(cursor, user_id: str) -> int:
    """Count how many territories belong to this user."""
    cursor.execute(
        """
        SELECT COUNT(*) 
        FROM territories 
        WHERE user_id = %s
          AND deleted_at IS NULL;
        """,
        (user_id,),
    )
    result = cursor.fetchone()
    return result[0] if result else 0


def update_cognito_territory_count(user_id: str, territory_count: int):
    """Update custom:territory_blocks attribute in Cognito."""
    try:
        cognito_client.admin_update_user_attributes(
            UserPoolId=USER_POOL_ID,
            Username=user_id,
            UserAttributes=[
                {"Name": "custom:territory_blocks", "Value": str(territory_count)},
            ],
        )
    except Exception as e:
        logger.error(
            f"Failed to update Cognito territory count for user {user_id}",
            extra={"error": str(e)},
        )
        raise
