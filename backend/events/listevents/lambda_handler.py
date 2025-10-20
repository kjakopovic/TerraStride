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
    """List events within 100 km radius, or search by name/city (paginated)."""
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle preflight OPTIONS
    cors_resp = _cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    # Extract query params and headers
    query_params = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}

    # Validate base schema
    validate(event=query_params, schema=schema)

    user_id = get_user_id(headers)
    if not user_id:
        return _response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    # Pagination setup
    page = int(query_params.get("page", 1))
    limit = int(query_params.get("limit", 30))
    offset = (page - 1) * limit

    # Optional search filter
    search = query_params.get("search")
    lat = query_params.get("lat")
    lng = query_params.get("lng")

    # Connect to Aurora
    conn, cursor = connect_to_aurora_db(secrets_client, DB_SECRET_ARN)

    try:
        if search:  # 🔍 Search mode
            logger.info(f"Searching events for query: '{search}'")
            events_data, total_count = search_events(cursor, search, limit, offset)
        else:  # 📍 Location mode
            try:
                lat = float(lat)
                lng = float(lng)
            except (TypeError, ValueError):
                return _response(
                    400, {"status": "error", "message": "Invalid lat/lng values"}
                )

            # Define 100 km radius
            radius_km = 100.0
            lat_deg_delta = radius_km / 111.32
            lng_deg_delta = radius_km / (111.32 * math.cos(math.radians(lat)))

            min_lat = lat - lat_deg_delta
            max_lat = lat + lat_deg_delta
            min_lng = lng - lng_deg_delta
            max_lng = lng + lng_deg_delta

            events_data, total_count = fetch_events_within_bounds(
                cursor, min_lat, max_lat, min_lng, max_lng, limit, offset
            )

        conn.commit()

    except Exception as e:
        logger.error("Error listing events", extra={"error": str(e)})
        try:
            conn.rollback()
        except Exception as rollback_err:
            logger.warning(f"Rollback failed", extra={"error": str(rollback_err)})
        return _response(500, {"status": "error", "message": "Failed to list events."})

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
            "message": "Events fetched successfully.",
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": math.ceil(total_count / limit) if total_count else 0,
            },
            "events": events_data,
        },
    )


def fetch_events_within_bounds(
    cursor, min_lat, max_lat, min_lng, max_lng, limit, offset
):
    """Fetch events whose checkpoints fall within a bounding box."""
    query = """
        WITH nearby_events AS (
            SELECT DISTINCT e.id
            FROM events e
            JOIN event_checkpoints c ON e.id = c.event_id
            WHERE e.deleted_at IS NULL
              AND c.deleted_at IS NULL
              AND c.lat BETWEEN %(min_lat)s AND %(max_lat)s
              AND c.lng BETWEEN %(min_lng)s AND %(max_lng)s
        )
        SELECT e.id, e.name, e.city, e.startdate, e.enddate, e.created_at
        FROM events e
        JOIN nearby_events n ON e.id = n.id
        WHERE e.deleted_at IS NULL
        ORDER BY e.startdate DESC
        LIMIT %(limit)s OFFSET %(offset)s;
    """

    count_query = """
        SELECT COUNT(*) FROM (
            SELECT DISTINCT e.id
            FROM events e
            JOIN event_checkpoints c ON e.id = c.event_id
            WHERE e.deleted_at IS NULL
              AND c.deleted_at IS NULL
              AND c.lat BETWEEN %(min_lat)s AND %(max_lat)s
              AND c.lng BETWEEN %(min_lng)s AND %(max_lng)s
        ) sub;
    """

    params = {
        "min_lat": min_lat,
        "max_lat": max_lat,
        "min_lng": min_lng,
        "max_lng": max_lng,
        "limit": limit,
        "offset": offset,
    }

    cursor.execute(count_query, params)
    total_count = cursor.fetchone()[0]

    cursor.execute(query, params)
    results = cursor.fetchall()

    return _format_events(results), total_count


def search_events(cursor, search, limit, offset):
    """Search events by name or city (case-insensitive, partial match)."""
    query = """
        SELECT e.id, e.name, e.city, e.startdate, e.enddate, e.created_at
        FROM events e
        WHERE e.deleted_at IS NULL
          AND (e.name ILIKE %(search)s OR e.city ILIKE %(search)s)
        ORDER BY e.startdate DESC
        LIMIT %(limit)s OFFSET %(offset)s;
    """

    count_query = """
        SELECT COUNT(*) FROM events e
        WHERE e.deleted_at IS NULL
          AND (e.name ILIKE %(search)s OR e.city ILIKE %(search)s);
    """

    params = {
        "search": f"%{search}%",
        "limit": limit,
        "offset": offset,
    }

    cursor.execute(count_query, params)
    total_count = cursor.fetchone()[0]

    cursor.execute(query, params)
    results = cursor.fetchall()

    return _format_events(results), total_count


def _format_events(results):
    """Convert raw DB tuples to event dictionaries."""
    return [
        {
            "id": str(row[0]),
            "name": row[1],
            "city": row[2],
            "startdate": row[3].isoformat() if row[3] else None,
            "enddate": row[4].isoformat() if row[4] else None,
            "created_at": row[5].isoformat() if row[5] else None,
        }
        for row in results
    ]
