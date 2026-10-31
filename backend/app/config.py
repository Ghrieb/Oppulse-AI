"""Configuration.

Every setting comes from the environment, and nothing here is a secret that
the browser could ever see. The frontend gets three values — the API origin,
the mode and a feature flag — and everything else stays on this side of the
wire.
"""

from __future__ import annotations

import functools
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["local", "staging", "production"]
LOCAL_JWT_SECRET = "local-development-secret-change-me"  # noqa: S105


class Settings(BaseSettings):
    """The service's configuration.

    The defaults are the local ones, so a developer can run the service with
    no environment at all and get a working, isolated, offline instance.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="OPPULSE_",
        extra="ignore",
    )

    # -- Environment -----------------------------------------------------

    environment: Environment = "local"
    """Which environment this is. It decides the CORS allowlist and the
    strictness of the log format."""

    api_prefix: str = "/api/v1"
    """The versioned prefix every endpoint lives under."""

    host: str = "127.0.0.1"
    port: int = 8000

    # -- Database --------------------------------------------------------

    database_url: str = "sqlite+aiosqlite:///./oppulse.db"
    """SQLite locally, Supabase Postgres in staging and production. The
    models are written to be portable; only the driver changes."""

    database_echo: bool = False
    database_bypass: bool = False
    """Use an isolated temporary SQLite workspace when Postgres is unavailable.

    This is intended only for a short-lived hosted review: Vercel may discard
    its local filesystem between instances, so student data is not durable.
    """

    # -- Private document storage --------------------------------------

    storage_root: str = ".storage"
    storage_bucket: str = "oppulse-documents"

    # -- CORS ------------------------------------------------------------

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )
    """The exact origins allowed to call the API.

    There is no wildcard, and there is no way to configure one: a wildcard
    with credentials is refused at startup rather than at runtime.
    """

    # -- Authentication --------------------------------------------------

    jwt_secret: str = LOCAL_JWT_SECRET
    """The signing key for access tokens. Staging and production read it from
    the environment; the default is refused outside `local`."""

    jwt_algorithm: str = "HS256"
    access_token_ttl_seconds: int = 15 * 60
    refresh_token_ttl_seconds: int = 30 * 24 * 60 * 60
    verification_token_ttl_seconds: int = 24 * 60 * 60
    password_reset_token_ttl_seconds: int = 60 * 60

    argon2_time_cost: int = 3
    argon2_memory_cost: int = 64 * 1024
    argon2_parallelism: int = 4

    # -- Providers -------------------------------------------------------

    model_provider_key: str | None = None
    """The AI provider key. Server-side only, and optional: the offline
    replay path needs no key at all."""

    model_provider: str = "groq"
    """Which model provider to use: `groq` or `replay`."""

    model_id: str = "openai/gpt-oss-120b"
    """The model. It must support structured outputs, because every stage
    that asks the model for something typed asks for a schema."""

    search_provider: str = "tavily"
    """Which search provider to use: `tavily`, `exa` or `replay`."""

    search_provider_key: str | None = None
    """The search provider's key. Tavily and Exa each have a free tier
    that needs no card."""

    fallback_search_provider_key: str | None = None
    """The second search provider's key, used when the first has spent its
    quota. The run then fails honestly rather than silently returning
    nothing."""

    fallback_search_provider: str = "exa"

    email_provider_key: str | None = None
    email_provider_url: str | None = None
    email_from_address: str = "no-reply@oppulse.ai"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    #: How long a page fetch may take.
    fetch_timeout_seconds: float = 20.0
    #: The largest page we will read, in bytes.
    fetch_max_bytes: int = 2_000_000
    #: The largest document we will read, in bytes.
    document_max_bytes: int = 10_000_000

    #: How many times a malformed model answer is retried with the
    #: validation errors attached. One is enough; more just burns quota.
    model_repair_attempts: int = 1

    # -- Capabilities ----------------------------------------------------

    live_model_provider: bool = False
    """Whether the AI reasoning capability may be reported as live. It stays
    false until the provider smoke test has passed."""

    live_search_provider: bool = False
    live_email_provider: bool = False

    # -- The run worker --------------------------------------------------

    worker_enabled: bool = True
    """Whether the background worker that claims queued runs is started with
    the application. Tests turn it off; they drive the worker directly."""

    worker_poll_seconds: float = 0.5
    """How often the worker looks for a queued run when it found nothing."""

    run_lease_seconds: int = 60
    """How long a claimed run stays claimed without a heartbeat. A worker
    that dies stops being the owner when the lease runs out, and the next
    claim resumes the run from its checkpoint instead of starting over."""

    # -- Logging ---------------------------------------------------------

    log_level: str = "INFO"

    def validate_runtime(self) -> None:
        """Reject settings that could make a deployment unsafe."""
        if not self.is_local and self.jwt_secret == LOCAL_JWT_SECRET:
            raise ValueError("OPPULSE_JWT_SECRET must be replaced outside local development.")
        if self.is_production and self.uses_sqlite and not self.database_bypass:
            raise ValueError("Production must use a durable Postgres database.")

    @field_validator("cors_origins")
    @classmethod
    def _no_wildcard(cls, value: list[str]) -> list[str]:
        for origin in value:
            if origin.strip() == "*":
                raise ValueError(
                    "A wildcard CORS origin is not allowed: the API is called "
                    "with credentials, and a wildcard would let any site make "
                    "authenticated requests. List the exact origins."
                )
        return value

    @property
    def is_local(self) -> bool:
        return self.environment == "local"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def uses_sqlite(self) -> bool:
        return self.effective_database_url.startswith("sqlite")

    @property
    def effective_database_url(self) -> str:
        """The connection URL actually used by the running service."""
        if self.database_bypass:
            return "sqlite+aiosqlite:////tmp/oppulse.db"
        return self.database_url

    @property
    def model_is_live(self) -> bool:
        """Whether the model capability may be reported as live."""
        return self.model_provider != "replay" and bool(self.model_provider_key)

    @property
    def search_is_live(self) -> bool:
        """Whether the search capability may be reported as live."""
        return self.search_provider != "replay" and bool(self.search_provider_key)


@functools.lru_cache
def get_settings() -> Settings:
    """The settings, read once."""
    return Settings()
