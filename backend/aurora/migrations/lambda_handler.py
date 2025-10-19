import os
import json
import boto3
import psycopg2
from psycopg2 import sql
from aws_lambda_powertools import Logger
from middleware import middleware, _response, _cors_response

# Configure logging
logger = Logger()

# Environment Variables
AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
DB_SECRET_ARN = os.environ.get("DB_SECRET_ARN")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
MIGRATIONS_DIR = "./migrations"

# Default headers
BASE_HEADERS = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Content-Type": "application/json",
}

# Clients
client = boto3.client("secretsmanager", region_name=AWS_REGION)


def get_db_credentials(secret_arn, region):
    """Retrieve Aurora DB credentials from Secrets Manager"""
    response = client.get_secret_value(SecretId=secret_arn)
    secret = json.loads(response["SecretString"])

    return {
        "host": secret["host"],
        "port": secret["port"],
        "user": secret["username"],
        "password": secret["password"],
        "dbname": secret.get("dbname", "postgres"),
    }


def connect_to_db(creds):
    """Connect to Aurora PostgreSQL"""
    return psycopg2.connect(
        host=creds["host"],
        port=creds["port"],
        user=creds["user"],
        password=creds["password"],
        dbname=creds["dbname"],
        connect_timeout=10,
    )


def ensure_migrations_table(conn):
    """Create schema_migrations table if it doesn't exist"""
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMP DEFAULT NOW()
            );
        """
        )
        conn.commit()


def get_applied_migrations(conn):
    """Return set of already applied migrations"""
    with conn.cursor() as cur:
        cur.execute("SELECT filename FROM schema_migrations;")
        return {row[0] for row in cur.fetchall()}


def apply_migration(conn, filename, sql_content):
    """Execute a single migration and record it"""
    with conn.cursor() as cur:
        logger.info(f"➡️ Applying migration: {filename}")
        cur.execute(sql.SQL(sql_content))
        cur.execute(
            "INSERT INTO schema_migrations (filename) VALUES (%s);", (filename,)
        )
        conn.commit()
        logger.info(f"✅ Migration applied: {filename}")


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

    if not DB_SECRET_ARN:
        return _response(500, {"status": "error", "message": "database not connected"})

    # Load credentials and connect
    creds = get_db_credentials(DB_SECRET_ARN, AWS_REGION)
    conn = connect_to_db(creds)

    ensure_migrations_table(conn)

    applied = get_applied_migrations(conn)

    # List migration files from bundled folder
    migration_files = sorted(
        f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql")
    )

    for filename in migration_files:
        if filename in applied:
            logger.info(f"⏭️ Skipping already applied migration: {filename}")
            continue

        path = os.path.join(MIGRATIONS_DIR, filename)
        with open(path, "r", encoding="utf-8") as f:
            sql_content = f.read()

        apply_migration(conn, filename, sql_content)

    conn.close()
    logger.info("🎉 All migrations applied successfully.")

    return _response(
        200, {"status": "success", "message": "All migrations applied successfully."}
    )
