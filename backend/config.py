from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://flashcards:flashcards@localhost:5432/flashcards"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "flashcards"
    minio_secret_key: str = "flashcards123"
    minio_bucket: str = "flashcards"
    minio_secure: bool = False


settings = Settings()
