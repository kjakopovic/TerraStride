"""
Lambda function to list territories within a lat/lng bounding box.
"""

from decimal import Decimal
import os
import math
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from boto3.dynamodb.conditions import Attr

# pylint: disable=import-error
from middleware import middleware, http_response, cors_response, get_user_id
from validation_schema import schema

logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
TERRITORIES_TABLE = os.environ.get("TERRITORIES_TABLE")

# DynamoDB client
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
territories_table = dynamodb.Table(TERRITORIES_TABLE)


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """List territories whose corners fall within a given lat/lng bounding box."""

    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle CORS
    cors_resp = cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    # Query params & headers
    query_params = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}

    # Validate request
    logger.info("Validating request")
    validate(event=query_params, schema=schema)

    user_id = get_user_id(headers)
    if not user_id:
        return http_response(401, {"status": "error", "message": "Unauthorized"})

    # Parse lat/lng
    try:
        lat = float(query_params.get("lat"))
        lng = float(query_params.get("lng"))
    except (TypeError, ValueError):
        return http_response(
            400, {"status": "error", "message": "Invalid lat/lng values"}
        )

    # Bounding box: ±5 km (~10 km total radius)
    radius_km = 5.0
    lat_deg_delta = radius_km / 111.32
    lng_deg_delta = radius_km / (111.32 * math.cos(math.radians(lat)))

    min_lat = lat - lat_deg_delta
    max_lat = lat + lat_deg_delta
    min_lng = lng - lng_deg_delta
    max_lng = lng + lng_deg_delta

    logger.info(
        f"Searching territories in bounding box lat[{min_lat}, {max_lat}] lng[{min_lng}, {max_lng}]"
    )

    territories_data = fetch_territories_within_bounds(
        min_lat, max_lat, min_lng, max_lng
    )

    return http_response(
        200,
        {
            "status": "success",
            "message": "Territories returned successfully.",
            "territories": territories_data,
        },
    )


# TODO: this needs to be optimized for large datasets (use geohashing or similar)
def fetch_territories_within_bounds(min_lat, max_lat, min_lng, max_lng):
    """
    Scan DynamoDB for territories whose any corner is within the bounding box.
    Note: This performs a filtered scan — acceptable for small/moderate datasets.
    """

    min_lat = Decimal(str(min_lat))
    max_lat = Decimal(str(max_lat))
    min_lng = Decimal(str(min_lng))
    max_lng = Decimal(str(max_lng))

    filter_expr = Attr("deleted_at").not_exists() & (
        (
            Attr("left_top_corner_lat").between(min_lat, max_lat)
            & Attr("left_top_corner_lng").between(min_lng, max_lng)
        )
        | (
            Attr("right_top_corner_lat").between(min_lat, max_lat)
            & Attr("right_top_corner_lng").between(min_lng, max_lng)
        )
        | (
            Attr("left_bottom_corner_lat").between(min_lat, max_lat)
            & Attr("left_bottom_corner_lng").between(min_lng, max_lng)
        )
        | (
            Attr("right_bottom_corner_lat").between(min_lat, max_lat)
            & Attr("right_bottom_corner_lng").between(min_lng, max_lng)
        )
    )

    scan_kwargs = {"FilterExpression": filter_expr}
    results = []
    response = territories_table.scan(**scan_kwargs)
    results.extend(response.get("Items", []))

    # Handle pagination
    while "LastEvaluatedKey" in response:
        response = territories_table.scan(
            ExclusiveStartKey=response["LastEvaluatedKey"], **scan_kwargs
        )

        results.extend(response.get("Items", []))

    logger.info(f"Found {len(results)} matching territories")

    return results
