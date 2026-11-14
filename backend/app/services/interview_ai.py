"""AI provider boundary used by the P3 orchestration layer.

P4 supplies the concrete implementation. This module deliberately contains no
Gemini prompts, provider SDK calls, or interview state transitions.
"""

from collections.abc import AsyncIterator
from typing import Any, Protocol


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


async def get_interview_ai_service() -> InterviewAIService:
    """Dependency boundary for P4's planner/evaluator/voice services."""

    return UnconfiguredInterviewAIService()
