"""
Generate a cdk.json file from environment variables or a .env file.
Optionally filter specific keys to include in the context.
Supports TypeScript CDK apps via --typescript flag.
"""

import json
import os
import argparse
from dotenv import load_dotenv


def generate_cdk_json(
    env_path=None, output_path="cdk.json", keys=None, typescript=False
):
    """
    Generate a cdk.json file from environment variables.
    If env_path is provided, load variables from .env file first.
    Optionally, filter only specific keys to include.
    If typescript=True, sets 'app' to 'npx ts-node bin/crypto.ts'
    """

    # Load .env file if provided
    if env_path:
        if not os.path.exists(env_path):
            print(f"⚠️  .env file not found at {env_path}, skipping .env load")
        else:
            load_dotenv(env_path)
            print(f"✅ Loaded environment variables from {env_path}")

    # Collect environment variables
    if keys:
        env_vars = {k: os.environ[k] for k in keys if k in os.environ}
    else:
        env_vars = {}
        if env_path and os.path.exists(env_path):
            # Parse .env manually to preserve only entries explicitly defined there
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    env_vars[key.strip()] = value.strip()

    # Determine CDK app command
    app_command = "npx ts-node bin/crypto.ts" if typescript else "python3.12 app.py"

    # Define CDK JSON structure
    cdk_json = {"app": app_command, "context": env_vars}

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    # Write to file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(cdk_json, f, indent=2)

    print(f"✅ Generated '{output_path}' using environment variables")
    print(f"Included {len(env_vars)} variables in context.")
    print(f"CDK app command set to: {app_command}")


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
    parser.add_argument(
        "--typescript",
        "-t",
        action="store_true",
        help="Use TypeScript CDK app ('npx ts-node bin/crypto.ts') instead of Python",
    )

    args = parser.parse_args()
    generate_cdk_json(args.env, args.output, args.keys, args.typescript)
