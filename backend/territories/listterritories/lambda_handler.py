import boto3
import os
import math
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from middleware import (
    middleware,
    _response,
    _cors_response,
    connect_to_aurora_db,
    get_user_id,
)
from validation_schema import schema

# TODO: get user info for user_id in territories

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

    # Get query parameters
    query_params = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}

    # Validate request
    logger.info("Validating request")
    validate(event=query_params, schema=schema)

    user_id = get_user_id(headers)
    if not user_id:
        return _response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    # Parse coordinates
    try:
        lat = float(query_params.get("lat"))
        lng = float(query_params.get("lng"))
    except (TypeError, ValueError):
        return _response(400, {"status": "error", "message": "Invalid lat/lng values"})

    # Define search radius: 10 km wide (±5 km)
    radius_km = 5.0
    lat_deg_delta = radius_km / 111.32
    lng_deg_delta = radius_km / (111.32 * math.cos(math.radians(lat)))

    min_lat = lat - lat_deg_delta
    max_lat = lat + lat_deg_delta
    min_lng = lng - lng_deg_delta
    max_lng = lng + lng_deg_delta

    # Connect to Aurora DB
    conn, cursor = connect_to_aurora_db(secrets_client, DB_SECRET_ARN)

    try:
        territories_data = fetch_territories_within_bounds(
            cursor, min_lat, max_lat, min_lng, max_lng
        )
        conn.commit()
    except Exception as e:
        logger.error("Error listing territories", extra={"error": str(e)})

        try:
            conn.rollback()
        except Exception as rollback_err:
            logger.warning(f"Rollback failed", extra={"error": str(rollback_err)})

        return _response(
            500, {"status": "error", "message": "Failed to list territories."}
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
            "message": "territories returned successfully.",
            "territories": territories_data,
        },
    )


def fetch_territories_within_bounds(cursor, min_lat, max_lat, min_lng, max_lng):
    """
    Fetch territories whose any corner lies within the given bounding box.
    Returns a list of dict-like rows (RealDictCursor recommended).
    """

    query = """
        SELECT DISTINCT
            id, user_id, average_pace, color,
            left_top_corner_lat, left_top_corner_lng,
            right_top_corner_lat, right_top_corner_lng,
            left_bottom_corner_lat, left_bottom_corner_lng,
            right_bottom_corner_lat, right_bottom_corner_lng,
            created_at, updated_at
        FROM territories
        WHERE deleted_at IS NULL
          AND (
                (left_top_corner_lat BETWEEN %(min_lat)s AND %(max_lat)s AND left_top_corner_lng BETWEEN %(min_lng)s AND %(max_lng)s)
             OR (right_top_corner_lat BETWEEN %(min_lat)s AND %(max_lat)s AND right_top_corner_lng BETWEEN %(min_lng)s AND %(max_lng)s)
             OR (left_bottom_corner_lat BETWEEN %(min_lat)s AND %(max_lat)s AND left_bottom_corner_lng BETWEEN %(min_lng)s AND %(max_lng)s)
             OR (right_bottom_corner_lat BETWEEN %(min_lat)s AND %(max_lat)s AND right_bottom_corner_lng BETWEEN %(min_lng)s AND %(max_lng)s)
          );
    """

    params = {
        "min_lat": min_lat,
        "max_lat": max_lat,
        "min_lng": min_lng,
        "max_lng": max_lng,
    }

    cursor.execute(query, params)
    results = cursor.fetchall()
    return results
