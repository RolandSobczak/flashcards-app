from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://flashcards:flashcards@localhost:5432/flashcards"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "flashcards"
    minio_secret_key: str = "flashcards123"
    minio_bucket: str = "flashcards"
    minio_secure: bool = False

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_from: str = "fiszki@local.test"
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = False

    login_code_ttl_minutes: int = 10
    login_code_resend_cooldown_seconds: int = 60
    login_code_max_attempts: int = 5
    session_ttl_days: int = 30


settings = Settings()
