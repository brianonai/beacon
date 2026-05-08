"""Environment-driven configuration."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    oauth_redirect_uri: str = "http://localhost:8000/auth/google/callback"
    post_login_redirect: str = "http://localhost:3000/"

    # Session signing
    session_secret: str = "dev-only-change-me"
    session_cookie_name: str = "beacon_session"
    session_max_age_seconds: int = 60 * 60 * 24 * 7  # 7 days

    # CORS
    allowed_origin: str = "http://localhost:3000"

    # Scan tuning
    inspect_concurrency: int = 10
    inspect_jitter_ms: int = 100
    stale_days: int = 180
    page_check_concurrency: int = 5
    user_agent: str = "BeaconBot/0.1 (+https://github.com/brianonai/beacon)"
    max_redirects: int = 5

    # Rate sanity caps (V1: no hard cap, just warning above this)
    soft_url_warn: int = 5000

    # Optional anonymous install ping (off by default; endpoint not required for core app).
    beacon_telemetry: bool = False

    # Microlink.io (optional `x-api-key` for Pro / higher limits).
    microlink_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
