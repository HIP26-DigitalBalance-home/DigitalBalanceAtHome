from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/digitalbalance"
    JWT_SECRET: str = "change-me-in-production"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    S3_ENDPOINT_URL: str = ""
    S3_BUCKET_NAME: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = "eu-central-1"
    API_BASE_URL: str = "http://localhost:8000"
    CLIENT_BASE_URL: str = "http://localhost:8081"
    SEED_ENABLED: bool = False
    PHOTO_UPLOAD_LIMIT: int = 50

    # Per-family storage quotas (activity-resource photos and custom activities)
    RESOURCE_PHOTO_UPLOAD_LIMIT: int = 100
    CUSTOM_ACTIVITY_LIMIT: int = 200

    # Upload hardening: per-file byte cap, decode-size cap, and concurrency caps
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024
    MAX_IMAGE_PIXELS: int = 40_000_000
    MAX_CONCURRENT_UPLOADS: int = 8
    MAX_INFLIGHT_UPLOADS_PER_USER: int = 2

    # Per-user rate limits (0 disables a rule)
    RATE_LIMIT_PHOTO_UPLOADS_PER_10_MIN: int = 20
    RATE_LIMIT_PHOTO_UPLOADS_PER_DAY: int = 100
    RATE_LIMIT_PROFILE_UPDATES_PER_HOUR: int = 20
    RATE_LIMIT_PHOTO_URLS_PER_MIN: int = 60
    RATE_LIMIT_PHOTO_PROXY_PER_MIN: int = 120
    RATE_LIMIT_ACTIVITY_CREATES_PER_HOUR: int = 30

    @field_validator("PHOTO_UPLOAD_LIMIT")
    @classmethod
    def _clamp_photo_limit(cls, v: int) -> int:
        return v if v > 0 else 50


settings = Settings()
