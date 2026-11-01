from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "School ERP API"
    database_url: str = "postgresql+asyncpg://school:school@localhost:5432/school_erp"
    redis_url: str = "redis://localhost:6379/0"


settings = Settings()
