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
    supabase_service_role_key: Optional[str] = Field(
        default=None,
        validation_alias='SUPABASE_SERVICE_ROLE_KEY',
    )
    frontend_origin: str = Field(
        default='http://localhost:5173',
        validation_alias='FRONTEND_ORIGIN',
    )

    # P4 AI Provider Configuration
    gemini_api_key: Optional[str] = Field(default=None, validation_alias='GEMINI_API_KEY')
    gemini_model: str = Field(default='gemini-3-flash-preview', validation_alias='GEMINI_MODEL')

    elevenlabs_api_key: Optional[str] = Field(default=None, validation_alias='ELEVENLABS_API_KEY')
    elevenlabs_voice_id: str = Field(
        default='21m00Tcm4TlvDq8ikWAM',  # Rachel - professional female voice
        validation_alias='ELEVENLABS_VOICE_ID',
    )
    elevenlabs_model_id: str = Field(
        default='eleven_multilingual_v2',
        validation_alias='ELEVENLABS_MODEL_ID',
    )

    @property
    def is_supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_publishable_key)

    @property
    def is_gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def is_elevenlabs_configured(self) -> bool:
        return bool(self.elevenlabs_api_key)

    @property
    def is_ai_service_configured(self) -> bool:
        return self.is_gemini_configured

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
