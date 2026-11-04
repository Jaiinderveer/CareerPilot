"""Environment-backed configuration for the CareerPilot API."""

from functools import lru_cache
from typing import Optional

from pydantic import AliasChoices, Field, ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables or .env."""

    model_config = ConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore',
        populate_by_name=True,
    )

    supabase_url: Optional[str] = Field(default=None, validation_alias='SUPABASE_URL')
    supabase_publishable_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'),
    )
    frontend_origin: str = Field(
        default='http://localhost:5173',
        validation_alias='FRONTEND_ORIGIN',
    )

    @property
    def is_supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_publishable_key)

    @property
    def allowed_origins(self) -> list[str]:
        """Return the list of allowed frontend origins.

        FRONTEND_ORIGIN may be a single origin or a comma-separated list.
        """
        return [origin.strip() for origin in self.frontend_origin.split(',') if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process configuration singleton.

    This contains only configuration, never a user's access token. Tokens remain
    request-scoped in the authentication and Supabase service dependencies.
    """

    return Settings()
