import logging
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger("krevo.config")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Krevo API"
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
    argon_time_cost: int = 2
    argon_memory_kib: int = 19456  # 19 MiB, the OWASP minimum for Argon2id

    # Email
    email_backend: str = "console"  # console | memory | smtp | resend
    resend_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "Krevo <no-reply@krevo.tech>"
    app_base_url: str = "https://app.krevo.tech"
    # Shared secret the web app's server sends so the API trusts the visitor address it forwards (see deps.client_ip)
    bff_secret: str = ""
    # Browsers that may call the API directly (the staff and parent web apps)
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    ios_app_url: str = "https://apps.apple.com/app/krevo"
    android_app_url: str = "https://play.google.com/store/apps/details?id=tech.krevo.app"

    # Cloudflare R2 (S3 compatible) for files
    storage_backend: str = "memory"  # memory | r2
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "krevo-files"
    upload_url_ttl_seconds: int = 600
    download_url_ttl_seconds: int = 300

    # A class teacher may correct a day's attendance for this many days; after that only the admin or academic
    # managers can.
    attendance_edit_window_days: int = 7

    # Push notifications (FCM HTTP v1; iOS goes through FCM too, with the APNs key uploaded in Firebase)
    push_backend: str = "console"  # console | memory | fcm
    fcm_project_id: str = ""
    # The Firebase service account key: the JSON text itself, or a path to the .json file
    fcm_service_account: str = ""
    push_max_title: int = 120
    push_max_body: int = 400

    # Price per student per month, in paise. Editable per school.
    default_price_paise: int = 1000

    @model_validator(mode="after")
    def _production_safety(self) -> "Settings":
        """In production the API refuses to start with the development secret."""
        if self.env == "prod":
            if self.jwt_secret.startswith("dev-only") or len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET must be a long random value in production")
            for name in ("email_backend", "storage_backend", "push_backend"):
                if getattr(self, name) in ("console", "memory"):
                    log.warning(
                        "%s=%s in production: set the real service before real users arrive",
                        name.upper(),
                        getattr(self, name),
                    )
        return self

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
