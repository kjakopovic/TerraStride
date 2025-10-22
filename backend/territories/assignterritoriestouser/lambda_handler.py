from decimal import Decimal
import os
import json
import boto3
import hashlib
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.validation import validate
from middleware import middleware, _response, _cors_response, get_user_id, Territory
from validation_schema import schema
import datetime

logger = Logger()

# Environment
AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
USER_POOL_ID = os.environ.get("USER_POOL_ID")
TERRITORIES_TABLE = os.environ.get("TERRITORIES_TABLE")

# Clients
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
territories_table = dynamodb.Table(TERRITORIES_TABLE)
cognito_client = boto3.client("cognito-idp", region_name=AWS_REGION)


# Helpers
def make_square_key(t: Territory) -> str:
    """Create deterministic hash of all corner coordinates for uniqueness."""
    coords = [
        t.left_top_corner_lat,
        t.left_top_corner_lng,
        t.right_top_corner_lat,
        t.right_top_corner_lng,
        t.left_bottom_corner_lat,
        t.left_bottom_corner_lng,
        t.right_bottom_corner_lat,
        t.right_bottom_corner_lng,
    ]
    s = "|".join(str(c) for c in coords)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


@logger.inject_lambda_context(log_event=True)
@middleware
def lambda_handler(event, context):
    """Upsert multiple territories into DynamoDB and update Cognito count."""
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle CORS
    cors_resp = _cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    event_body = json.loads(event.get("body") or "{}")
    headers = event.get("headers") or {}

    # Validate request
    logger.info("Validating request")
    validate(event=event_body, schema=schema)

    user_id = get_user_id(headers)
    if not user_id:
        return _response(401, {"status": "error", "message": "Unauthorized"})

    territories_data = event_body.get("territories", [])
    territories = [Territory.from_dict(t, user_id=user_id) for t in territories_data]

    try:
        # Upsert each territory
        for t in territories:
            upsert_territory_dynamodb(t)

        # Count user territories (active)
        territory_count = get_user_territory_count(user_id)

        logger.info(
            f"User {user_id} has {territory_count} active territories after upsert."
        )

        # Update Cognito
        update_cognito_territory_count(user_id, territory_count)

        return _response(
            200,
            {
                "status": "success",
                "message": f"{len(territories)} territories upserted successfully.",
                "territory_count": territory_count,
            },
        )

    except Exception as e:
        logger.exception("Failed to upsert territories")
        return _response(
            500, {"status": "error", "message": "Failed to upsert territories."}
        )


def upsert_territory_dynamodb(t: Territory):
    square_key = make_square_key(t)
    now_iso = datetime.datetime.now().isoformat()

    item_attrs = {
        "average_pace": (
            Decimal(str(t.average_pace)) if t.average_pace is not None else Decimal("0")
        ),
        "user_id": t.user_id,
        "color": t.color,
        "left_top_corner_lat": (
            Decimal(str(t.left_top_corner_lat))
            if t.left_top_corner_lat is not None
            else Decimal("0")
        ),
        "left_top_corner_lng": (
            Decimal(str(t.left_top_corner_lng))
            if t.left_top_corner_lng is not None
            else Decimal("0")
        ),
        "right_top_corner_lat": (
            Decimal(str(t.right_top_corner_lat))
            if t.right_top_corner_lat is not None
            else Decimal("0")
        ),
        "right_top_corner_lng": (
            Decimal(str(t.right_top_corner_lng))
            if t.right_top_corner_lng is not None
            else Decimal("0")
        ),
        "left_bottom_corner_lat": (
            Decimal(str(t.left_bottom_corner_lat))
            if t.left_bottom_corner_lat is not None
            else Decimal("0")
        ),
        "left_bottom_corner_lng": (
            Decimal(str(t.left_bottom_corner_lng))
            if t.left_bottom_corner_lng is not None
            else Decimal("0")
        ),
        "right_bottom_corner_lat": (
            Decimal(str(t.right_bottom_corner_lat))
            if t.right_bottom_corner_lat is not None
            else Decimal("0")
        ),
        "right_bottom_corner_lng": (
            Decimal(str(t.right_bottom_corner_lng))
            if t.right_bottom_corner_lng is not None
            else Decimal("0")
        ),
        "updated_at": now_iso,
    }

    update_expr = "SET " + ", ".join(f"{k}=:{k}" for k in item_attrs.keys())
    expr_attr_vals = {f":{k}": v for k, v in item_attrs.items()}

    # Add created_at only if it does not exist
    update_expr += ", created_at = if_not_exists(created_at, :created_at)"
    expr_attr_vals[":created_at"] = now_iso

    try:
        territories_table.update_item(
            Key={"square_key": square_key},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_attr_vals,
            ConditionExpression=Attr("average_pace").gt(item_attrs["average_pace"])
            | Attr("square_key").not_exists(),
        )
        logger.debug(f"Upserted territory for user {t.user_id} ({square_key})")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            logger.debug(
                f"Skipped update — existing average_pace higher for {square_key}"
            )
        else:
            raise


def get_user_territory_count(user_id: str) -> int:
    """Count territories for a user (deleted_at == None)."""
    response = territories_table.query(
        IndexName="user_id-index",
        KeyConditionExpression=Key("user_id").eq(user_id),
        FilterExpression=Attr("deleted_at").not_exists() | Attr("deleted_at").eq(None),
        ProjectionExpression="user_id",
    )
    count = response["Count"]

    # Handle pagination
    while "LastEvaluatedKey" in response:
        response = territories_table.query(
            IndexName="user_id-index",
            KeyConditionExpression=Key("user_id").eq(user_id),
            FilterExpression=Attr("deleted_at").not_exists()
            | Attr("deleted_at").eq(None),
            ProjectionExpression="user_id",
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        count += response["Count"]

    return count


def update_cognito_territory_count(user_id: str, territory_count: int):
    """Update custom attribute in Cognito."""
    try:
        cognito_client.admin_update_user_attributes(
            UserPoolId=USER_POOL_ID,
            Username=user_id,
            UserAttributes=[
                {"Name": "custom:territory_blocks", "Value": str(territory_count)},
            ],
        )
        logger.info(f"Updated Cognito count for user {user_id}: {territory_count}")
    except Exception as e:
        logger.exception(f"Failed to update Cognito for {user_id}")
        raise
