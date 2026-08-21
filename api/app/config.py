"""Application settings for the Honeypot SOC API.

Values are read from the environment (and an optional .env file). No
credential literals live here: SOC_ADMIN_*, SOC_JWT_SECRET and
N8N_API_KEY come exclusively from the runtime environment. When a
credential is absent the service fails closed (auth rejects, JWT is not
issued).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_user: str = "honeypot_admin"
    postgres_password: str = ""
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "honeypot_soc"

    soc_admin_user: str = ""
    soc_admin_password: str = ""
    soc_jwt_secret: str = ""
    jwt_expires_minutes: int = 480

    n8n_api_key: str = ""
    n8n_internal_url: str = "http://n8n:5678"

    sse_poll_interval_seconds: float = 2.0
    sse_heartbeat_seconds: float = 15.0
    sse_batch_size: int = 100

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost",
        "http://127.0.0.1",
    ]


settings = Settings()