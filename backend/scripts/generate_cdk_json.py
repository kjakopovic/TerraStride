import json
import os
import argparse
from dotenv import load_dotenv


def generate_cdk_json(env_path, output_path):
    # Load environment variables from the specified .env file
    if not os.path.exists(env_path):
        raise FileNotFoundError(f".env file not found at: {env_path}")

    load_dotenv(env_path)

    # Parse .env manually to preserve only entries explicitly defined there
    env_vars = {}
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env_vars[key.strip()] = value.strip()

    # Define the CDK JSON structure
    cdk_json = {"app": "python3.12 app.py", "context": env_vars}

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    # Write the file
    with open(output_path, "w") as f:
        json.dump(cdk_json, f, indent=2)

    print(f"✅ Generated '{output_path}' using environment from '{env_path}'")
    print(f"Included {len(env_vars)} variables in context.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate cdk.json file from .env values."
    )
    parser.add_argument(
        "--env", "-e", default=".env", help="Path to the .env file (default: .env)"
    )
    parser.add_argument(
        "--output",
        "-o",
        default="cdk.json",
        help="Path to output cdk.json (default: cdk.json)",
    )

    args = parser.parse_args()
    generate_cdk_json(args.env, args.output)
