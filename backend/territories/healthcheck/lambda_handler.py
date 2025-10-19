import boto3
import os
import json
from aws_lambda_powertools import Logger
from middleware import middleware, _response, _cors_response
import psycopg2
from psycopg2.extras import RealDictCursor

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

    # Connect to Aurora DB
    conn, cursor = connect_to_aurora_db(secrets_client)
    cursor.execute("SELECT 1 AS alive;")
    result = cursor.fetchone()

    cursor.close()
    conn.close()

    return _response(
        200,
        {
            "status": "success",
            "db_alive": result["alive"],
        },
    )


def connect_to_aurora_db(secrets_client):
    # Retrieve secret
    secret_resp = secrets_client.get_secret_value(SecretId=DB_SECRET_ARN)
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
