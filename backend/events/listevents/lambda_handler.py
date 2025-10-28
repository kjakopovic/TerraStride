"""
Lambda function to list running events from DynamoDB.
Supports searching by name/city or filtering by geographic location.
"""

import os
import math
from decimal import Decimal
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from boto3.dynamodb.conditions import Attr

# pylint: disable=import-error
from middleware import middleware, http_response, cors_response, get_user_id
from validation_schema import schema

# Configure logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
EVENTS_TABLE = os.environ.get("EVENTS_TABLE")

# DynamoDB
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
events_table = dynamodb.Table(EVENTS_TABLE)


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """List events by name/city or within 100 km radius."""

    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle preflight OPTIONS
    cors_resp = cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    query_params = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}

    # Validate request
    validate(event=query_params, schema=schema)

    user_id = get_user_id(headers)
    if not user_id:
        return http_response(401, {"status": "error", "message": "Unauthorized"})

    # Pagination
    limit = int(query_params.get("limit", 30))
    exclusive_start_key = query_params.get("next_token", None)

    # Search/filter parameters
    search = query_params.get("search")
    lat = query_params.get("lat")
    lng = query_params.get("lng")

    events = []
    next_token = None

    if search:
        logger.info(f"Searching events for query '{search}'")
        events, next_token = search_events(search, limit, exclusive_start_key)
        total_count = len(events)

    elif lat and lng:
        lat = float(lat)
        lng = float(lng)
        events = fetch_events_within_bounds(lat, lng, limit)
        total_count = len(events)

    else:
        scan_kwargs = {
            "FilterExpression": Attr("deleted_at").not_exists(),
            "Limit": limit,
        }
        if exclusive_start_key:
            scan_kwargs["ExclusiveStartKey"] = exclusive_start_key

        # Default: return latest events
        response = events_table.scan(**scan_kwargs)

        events = response.get("Items", [])
        next_token = response.get("LastEvaluatedKey")
        total_count = len(events)

    logger.info(f"Total events fetched: {total_count}")

    return http_response(
        200,
        {
            "status": "success",
            "message": "Events fetched successfully.",
            "pagination": {
                "limit": limit,
                "total": total_count,
                "next_token": next_token if next_token else None,
            },
            "events": events,
        },
    )


# -----------------------------------------------
# 🔍 Search by city or name (uses GSI or scan)
# -----------------------------------------------
def search_events(search, limit, exclusive_start_key):
    """Search events by partial match on name or city."""

    search_lower = search.lower()

    # If user provides a city name, use GSI for efficiency
    scan_kwargs = {
        "FilterExpression": (
            Attr("deleted_at").not_exists()
            & (
                Attr("city_lower").contains(search_lower)
                | Attr("name_lower").contains(search_lower)
            )
        ),
        "Limit": limit,
    }

    if exclusive_start_key:
        scan_kwargs["ExclusiveStartKey"] = exclusive_start_key

    response = events_table.scan(**scan_kwargs)

    return response.get("Items", []), response.get("LastEvaluatedKey")


# TODO: for large scale this needs to be handled correctly
# -----------------------------------------------
# 📍 Geo-based filtering (100 km radius)
# -----------------------------------------------
def fetch_events_within_bounds(lat, lng, limit):
    """
    Scan DynamoDB for events whose checkpoints fall within a 100 km bounding box.
    Uses a manual bounding-box check in Python since DynamoDB can't filter nested arrays.
    """

    radius_km = 100.0
    lat_deg_delta = radius_km / 111.32
    lng_deg_delta = radius_km / (111.32 * math.cos(math.radians(lat)))

    min_lat = lat - lat_deg_delta
    max_lat = lat + lat_deg_delta
    min_lng = lng - lng_deg_delta
    max_lng = lng + lng_deg_delta

    logger.info(f"Bounding box: lat[{min_lat}, {max_lat}], lng[{min_lng}, {max_lng}]")

    # Convert to Decimal for comparison with DynamoDB data
    min_lat = Decimal(str(min_lat))
    max_lat = Decimal(str(max_lat))
    min_lng = Decimal(str(min_lng))
    max_lng = Decimal(str(max_lng))

    # Scan only for non-deleted events
    scan_kwargs = {
        "FilterExpression": Attr("deleted_at").not_exists(),
    }

    response = events_table.scan(**scan_kwargs)
    items = response.get("Items", [])
    results = []

    for event in items:
        checkpoints = event.get("checkpoints", [])
        for cp in checkpoints:
            try:
                lat_cp = Decimal(str(cp.get("lat", 0)))
                lng_cp = Decimal(str(cp.get("lng", 0)))
            except (ValueError, TypeError):
                continue

            if min_lat <= lat_cp <= max_lat and min_lng <= lng_cp <= max_lng:
                results.append(event)
                break  # Found one checkpoint in range → keep the event

        if len(results) >= limit:
            break

    logger.info(f"Found {len(results)} events within bounds.")
    return results[:limit]
