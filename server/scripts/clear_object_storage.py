"""
Wipe every object from the configured S3 bucket.

Admin-only utility — permanently deletes all objects. Irreversible.

Usage (inside Docker Compose, recommended):
    docker compose exec api sh -c "PYTHONPATH=/app python /app/scripts/clear_object_storage.py"

Usage (local, with env vars from server/.env):
    set -a && source server/.env && set +a
    PYTHONPATH=server python server/scripts/clear_object_storage.py
"""

import os
import sys

import boto3
from botocore.config import Config

S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL", "")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "")
S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY", "")
S3_REGION = os.environ.get("S3_REGION", "eu-central-1")

if not S3_ENDPOINT_URL or not S3_BUCKET_NAME:
    print("❌  S3_ENDPOINT_URL and S3_BUCKET_NAME must be set.")
    sys.exit(1)

client = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT_URL,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name=S3_REGION,
    config=Config(signature_version="s3v4"),
)

print(f"Bucket : {S3_BUCKET_NAME}")
print(f"Host   : {S3_ENDPOINT_URL}")
print("Listing objects…")

paginator = client.get_paginator("list_objects_v2")
to_delete: list[dict] = []
for page in paginator.paginate(Bucket=S3_BUCKET_NAME):
    for obj in page.get("Contents", []):
        to_delete.append({"Key": obj["Key"]})

if not to_delete:
    print("✓  Bucket is already empty.")
    sys.exit(0)

print(f"Found {len(to_delete)} object(s). Deleting…")

errors: list[dict] = []
for i in range(0, len(to_delete), 1000):
    batch = to_delete[i : i + 1000]
    resp = client.delete_objects(
        Bucket=S3_BUCKET_NAME,
        Delete={"Objects": batch, "Quiet": True},
    )
    errors.extend(resp.get("Errors", []))

if errors:
    print(f"⚠  {len(errors)} deletion error(s):")
    for e in errors:
        print(f"   {e['Key']}: {e['Message']}")
    sys.exit(1)

print(f"✅  Deleted {len(to_delete)} object(s) from '{S3_BUCKET_NAME}'.")
