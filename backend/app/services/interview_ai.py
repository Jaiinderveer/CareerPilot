"""AI provider boundary used by the P3 orchestration layer.

P4 supplies the concrete implementation. This module deliberately contains no
Gemini prompts, provider SDK calls, or interview state transitions.
"""

from collections.abc import AsyncIterator
from typing import Any, Protocol

from app.core.config import Settings, get_settings


class AIServiceUnavailable(Exception):
    """Raised when an AI or voice provider cannot serve a request."""


class InterviewAIService(Protocol):
    async def plan_interview(self, context: dict[str, Any]) -> dict[str, Any]: ...

    async def evaluate_answer(self, context: dict[str, Any]) -> dict[str, Any]: ...

    async def generate_followup(self, context: dict[str, Any]) -> dict[str, Any]: ...

    async def generate_report(self, context: dict[str, Any]) -> dict[str, Any]: ...

    def stream_tts(self, text: str) -> AsyncIterator[bytes]: ...

    async def create_stt_token(self) -> dict[str, Any]: ...


class UnconfiguredInterviewAIService:
    """Safe default until P4 registers provider implementations."""

    async def _unavailable(self, *args: Any, **kwargs: Any) -> Any:
        raise AIServiceUnavailable('AI service is not configured')

    async def plan_interview(self, context: dict[str, Any]) -> dict[str, Any]:
        return await self._unavailable(context)

    async def evaluate_answer(self, context: dict[str, Any]) -> dict[str, Any]:
        return await self._unavailable(context)

    async def generate_followup(self, context: dict[str, Any]) -> dict[str, Any]:
        return await self._unavailable(context)

    async def generate_report(self, context: dict[str, Any]) -> dict[str, Any]:
        return await self._unavailable(context)

    async def stream_tts(self, text: str) -> AsyncIterator[bytes]:
        await self._unavailable(text)
        yield b''

    async def create_stt_token(self) -> dict[str, Any]:
        return await self._unavailable()


class ConfiguredInterviewAIService:
    """Real AI service implementation using Gemini and ElevenLabs.

    This service is created only when the required API keys are configured.
    P3 owns all interview state transitions; this service only generates content.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def plan_interview(self, context: dict[str, Any]) -> dict[str, Any]:
        """Plan interview using Gemini."""
        from app.services.gemini_provider import plan_interview
        try:
            return await plan_interview(self._settings, context)
        except Exception as exc:
            raise AIServiceUnavailable(f'Gemini plan_interview failed: {exc}') from exc

    async def evaluate_answer(self, context: dict[str, Any]) -> dict[str, Any]:
        """Evaluate answer using Gemini."""
        from app.services.gemini_provider import evaluate_answer
        try:
            return await evaluate_answer(self._settings, context)
        except Exception as exc:
            raise AIServiceUnavailable(f'Gemini evaluate_answer failed: {exc}') from exc

    async def generate_followup(self, context: dict[str, Any]) -> dict[str, Any]:
        """Generate follow-up question using Gemini."""
        from app.services.gemini_provider import generate_followup
        try:
            return await generate_followup(self._settings, context)
        except Exception as exc:
            raise AIServiceUnavailable(f'Gemini generate_followup failed: {exc}') from exc

    async def generate_report(self, context: dict[str, Any]) -> dict[str, Any]:
        """Generate interview report using Gemini."""
        from app.services.gemini_provider import generate_report
        try:
            return await generate_report(self._settings, context)
        except Exception as exc:
            raise AIServiceUnavailable(f'Gemini generate_report failed: {exc}') from exc

    async def stream_tts(self, text: str) -> AsyncIterator[bytes]:
        """Stream TTS audio using ElevenLabs."""
        if not self._settings.is_elevenlabs_configured:
            raise AIServiceUnavailable('ElevenLabs TTS not configured')

        from app.services.elevenlabs_provider import stream_tts
        try:
            async for chunk in stream_tts(self._settings, text):
                yield chunk
        except Exception as exc:
            raise AIServiceUnavailable(f'ElevenLabs TTS failed: {exc}') from exc

    async def create_stt_token(self) -> dict[str, Any]:
        """Create STT token using ElevenLabs."""
        if not self._settings.is_elevenlabs_configured:
            raise AIServiceUnavailable('ElevenLabs STT not configured')

        from app.services.elevenlabs_provider import create_stt_token
        try:
            return await create_stt_token(self._settings)
        except Exception as exc:
            raise AIServiceUnavailable(f'ElevenLabs STT token failed: {exc}') from exc


async def get_interview_ai_service() -> InterviewAIService:
    """Dependency boundary for P4's planner/evaluator/voice services.

    Returns ConfiguredInterviewAIService when API keys are available,
    otherwise returns UnconfiguredInterviewAIService which raises
    AIServiceUnavailable on every call.
    """
    settings = get_settings()

    if settings.is_ai_service_configured:
        return ConfiguredInterviewAIService(settings)

    return UnconfiguredInterviewAIService()
