import boto3
import os
import json
import uuid
from datetime import datetime
from psycopg2.extras import execute_values
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
    request_id = context.aws_request_id
    logger.append_keys(request_id=request_id)

    # Handle preflight OPTIONS request
    cors_resp = _cors_response(event.get("httpMethod"))
    if cors_resp:
        return cors_resp

    # Parse request body
    event_body = json.loads(event.get("body")) if event.get("body") else {}
    headers = event.get("headers") or {}

    # Validate request
    logger.info("Validating event creation request")
    validate(event=event_body, schema=schema)

    user_id = get_user_id(headers)
    if not user_id:
        return _response(
            401, {"status": "error", "message": "Unauthorized - missing access token"}
        )

    # Extract main event info
    name = event_body["name"]
    city = event_body["city"]
    date_str = event_body["date"]  # YYYY-MM-DD
    start_time = event_body["startTime"]  # HH:MM

    # Combine date + startTime for startdate
    start_datetime = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M")

    # Default end time — 1 day after start
    end_datetime = start_datetime.replace(hour=23, minute=59)

    checkpoints = event_body["checkpoints"]
    trace_points = event_body["trace"]

    # Connect to Aurora DB
    conn, cursor = connect_to_aurora_db(secrets_client, DB_SECRET_ARN)

    try:
        # Insert the main event
        event_id = str(uuid.uuid4())
        insert_event(cursor, event_id, name, city, start_datetime, end_datetime)

        # Insert checkpoints and trace points
        insert_checkpoints(cursor, event_id, checkpoints)
        insert_trace_points(cursor, event_id, trace_points)

        conn.commit()
        logger.info(f"Event {event_id} created successfully")

    except Exception as e:
        logger.error("Error creating event", extra={"error": str(e)})
        try:
            conn.rollback()
        except Exception as rollback_err:
            logger.warning(f"Rollback failed", extra={"error": str(rollback_err)})

        return _response(500, {"status": "error", "message": "Failed to create event."})

    finally:
        try:
            cursor.close()
            conn.close()
        except Exception as close_err:
            logger.warning(f"Error closing DB resources: {close_err}")

    return _response(
        201,
        {
            "status": "success",
            "message": f"Event '{name}' created successfully.",
            "event_id": event_id,
        },
    )


def insert_event(cursor, event_id, name, city, startdate, enddate):
    """Insert the main event record."""
    query = """
        INSERT INTO events (id, name, city, startdate, enddate)
        VALUES (%s, %s, %s, %s, %s)
    """
    cursor.execute(query, (event_id, name, city, startdate, enddate))


def insert_checkpoints(cursor, event_id, checkpoints):
    """Insert event checkpoints efficiently."""
    values = [
        (
            str(uuid.uuid4()),
            cp["lat"],
            cp["lng"],
            idx + 1,
            cp["is_start"],
            cp["is_end"],
            event_id,
        )
        for idx, cp in enumerate(checkpoints)
    ]

    query = """
        INSERT INTO event_checkpoints (
            id, lat, lng, sequence_number, is_start, is_end, event_id
        )
        VALUES %s
    """

    execute_values(cursor, query, values)


def insert_trace_points(cursor, event_id, trace_points):
    """Insert event trace points efficiently."""
    values = [
        (str(uuid.uuid4()), tp["lat"], tp["lng"], event_id) for tp in trace_points
    ]

    query = """
        INSERT INTO event_trace (id, lat, lng, event_id)
        VALUES %s
    """

    execute_values(cursor, query, values)
