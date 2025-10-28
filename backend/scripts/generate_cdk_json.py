"""
Generate a cdk.json file from environment variables or a .env file.
Optionally filter specific keys to include in the context.
"""

import json
import os
import argparse
from dotenv import load_dotenv


def generate_cdk_json(env_path=None, output_path="cdk.json", keys=None):
    """
    Generate a cdk.json file from environment variables.
    If env_path is provided, load variables from .env file first.
    Optionally, filter only specific keys to include.
    """

    # Load .env file if provided
    if env_path:
        if not os.path.exists(env_path):
            print(f"⚠️  .env file not found at {env_path}, skipping .env load")
        else:
            load_dotenv(env_path)
            print(f"✅ Loaded environment variables from {env_path}")

    # Collect environment variables from os.environ
    if keys:
        env_vars = {k: os.environ[k] for k in keys if k in os.environ}
    else:
        # Parse .env manually to preserve only entries explicitly defined there
        env_vars = {}
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip()

    # Define CDK JSON structure
    cdk_json = {"app": "python3.12 app.py", "context": env_vars}

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    # Write to file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(cdk_json, f, indent=2)

    print(f"✅ Generated '{output_path}' using environment variables")
    print(f"Included {len(env_vars)} variables in context.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate cdk.json file from environment variables or .env file"
    )
    parser.add_argument(
        "--env",
        "-e",
        default=None,
        help="Path to .env file to load (optional, default: None)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="cdk.json",
        help="Path to output cdk.json (default: cdk.json)",
    )
    parser.add_argument(
        "--keys",
        "-k",
        nargs="*",
        help="Optional list of environment variable keys to include in context",
    )

    args = parser.parse_args()
    generate_cdk_json(args.env, args.output, args.keys)
