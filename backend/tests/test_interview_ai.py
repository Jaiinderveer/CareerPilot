"""Unit tests for interview AI schemas and provider fallbacks."""

import pytest

from app.core.config import Settings
from app.schemas.interview_ai import FollowUpGenerationSchema, InterviewTurnInput
from app.services.gemini_service import GeminiService
from app.services.voice_poc import VoiceService


@pytest.fixture
def turn_input() -> InterviewTurnInput:
    return InterviewTurnInput(
        question='What is a database index?',
        candidate_transcript='An index helps a database find rows faster.',
        rubric_criteria=['Explains lookup performance', 'Mentions write trade-offs'],
        role_context='Entry-level backend engineer',
    )


def test_interview_turn_rejects_empty_rubric() -> None:
    with pytest.raises(ValueError):
        InterviewTurnInput(
            question='Question',
            candidate_transcript='Answer',
            rubric_criteria=[],
            role_context='Backend engineer',
        )


def test_followup_requires_consistent_empty_fields() -> None:
    with pytest.raises(ValueError):
        FollowUpGenerationSchema(
            reasoning='No probe is required.',
            should_ask_followup=False,
            follow_up_question='Explain more.',
            target_competency='',
        )


@pytest.mark.asyncio
async def test_gemini_fallbacks_without_key(turn_input: InterviewTurnInput) -> None:
    service = GeminiService(Settings(GEMINI_API_KEY=''))

    evaluation = await service.evaluate_answer(turn_input)
    follow_up = await service.generate_followup(turn_input)

    assert evaluation.overall_score is None
    assert evaluation.improvements
    assert follow_up.should_ask_followup is False
    assert follow_up.follow_up_question == ''


@pytest.mark.asyncio
async def test_tts_mock_fallback_without_key() -> None:
    service = VoiceService(Settings(ELEVENLABS_API_KEY=''))

    result = await service.synthesize_speech('Welcome to your interview.')

    assert result.is_mock is True
    assert result.media_type == 'audio/wav'
    assert result.audio_bytes.startswith(b'RIFF')
