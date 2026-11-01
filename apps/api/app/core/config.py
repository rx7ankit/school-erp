from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Scool API"
    env: str = "dev"  # dev | test | prod

    database_url: str = "postgresql+asyncpg://scool:scool@localhost:5432/scool_dev"
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "dev-only-change-me-dev-only-change-me"
    access_ttl_minutes: int = 15
    refresh_ttl_days: int = 30
    reset_ttl_minutes: int = 30
    login_max_attempts: int = 5
    login_window_seconds: int = 15 * 60
    # Argon2 cost. Tests lower these so the suite stays fast.
    argon_time_cost: int = 3
    argon_memory_kib: int = 65536

    # Email
    email_backend: str = "console"  # console | memory | smtp
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "Scool <no-reply@scool.in>"
    app_base_url: str = "https://app.scool.in"
    ios_app_url: str = "https://apps.apple.com/app/scool"
    android_app_url: str = "https://play.google.com/store/apps/details?id=in.scool.app"

    # Price per student per month, in paise. Editable per school.
    default_price_paise: int = 1000

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
