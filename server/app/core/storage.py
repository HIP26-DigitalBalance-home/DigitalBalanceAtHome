import boto3
from botocore.config import Config
from fastapi import HTTPException

from app.core.config import settings


def _check_configured() -> None:
    if not settings.S3_ENDPOINT_URL or not settings.S3_BUCKET_NAME:
        raise HTTPException(
            status_code=503,
            detail=(
                "Photo storage is not configured. Set S3_ENDPOINT_URL, S3_BUCKET_NAME, S3_ACCESS_KEY, S3_SECRET_KEY."
            ),
        )


def _client():
    _check_configured()
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=Config(signature_version="s3v4"),
    )


def upload_bytes(key: str, data: bytes, content_type: str) -> None:
    _client().put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=key,
        Body=data,
        ContentType=content_type,
    )


def download_bytes(key: str) -> bytes:
    response = _client().get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
    return response["Body"].read()


def delete_object(key: str) -> None:
    _client().delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)


def generate_presigned_url(key: str, expires: int = 900) -> str:
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
        ExpiresIn=expires,
    )
