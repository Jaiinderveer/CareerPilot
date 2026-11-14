"""Tests for the Gemini and ElevenLabs AI providers."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.config import Settings
from app.services.interview_ai import (
    AIServiceUnavailable,
    ConfiguredInterviewAIService,
    UnconfiguredInterviewAIService,
    get_interview_ai_service,
)


class TestUnconfiguredService:
    """Test that unconfigured service raises appropriate errors."""

    @pytest.fixture
    def service(self):
        return UnconfiguredInterviewAIService()

    @pytest.mark.asyncio
    async def test_plan_interview_raises(self, service):
        with pytest.raises(AIServiceUnavailable, match='not configured'):
            await service.plan_interview({})

    @pytest.mark.asyncio
    async def test_evaluate_answer_raises(self, service):
        with pytest.raises(AIServiceUnavailable, match='not configured'):
            await service.evaluate_answer({})

    @pytest.mark.asyncio
    async def test_generate_followup_raises(self, service):
        with pytest.raises(AIServiceUnavailable, match='not configured'):
            await service.generate_followup({})

    @pytest.mark.asyncio
    async def test_generate_report_raises(self, service):
        with pytest.raises(AIServiceUnavailable, match='not configured'):
            await service.generate_report({})

    @pytest.mark.asyncio
    async def test_create_stt_token_raises(self, service):
        with pytest.raises(AIServiceUnavailable, match='not configured'):
            await service.create_stt_token()


class TestConfiguredService:
    """Test ConfiguredInterviewAIService with mocked providers."""

    @pytest.fixture
    def settings(self):
        return Settings(
            gemini_api_key='test-gemini-key',
            elevenlabs_api_key='test-elevenlabs-key',
        )

    @pytest.fixture
    def service(self, settings):
        return ConfiguredInterviewAIService(settings)

    @pytest.mark.asyncio
    async def test_plan_interview_calls_provider(self, service):
        mock_result = {'recommended_topics': ['Python'], 'first_question_id': None}
        with patch('app.services.gemini_provider.plan_interview', new_callable=AsyncMock) as mock:
            mock.return_value = mock_result
            result = await service.plan_interview({'role': 'Engineer'})
            assert result == mock_result
            mock.assert_called_once()

    @pytest.mark.asyncio
    async def test_evaluate_answer_calls_provider(self, service):
        mock_result = {'overall_score': 0.8, 'criterion_results': []}
        with patch('app.services.gemini_provider.evaluate_answer', new_callable=AsyncMock) as mock:
            mock.return_value = mock_result
            result = await service.evaluate_answer({'transcript_text': 'My answer'})
            assert result == mock_result
            mock.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_followup_calls_provider(self, service):
        mock_result = {'question_text': 'Can you elaborate?'}
        with patch('app.services.gemini_provider.generate_followup', new_callable=AsyncMock) as mock:
            mock.return_value = mock_result
            result = await service.generate_followup({'target_criterion_id': 'c1'})
            assert result == mock_result
            mock.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_report_calls_provider(self, service):
        mock_result = {'overall_summary': 'Good interview', 'overall_score': 0.75}
        with patch('app.services.gemini_provider.generate_report', new_callable=AsyncMock) as mock:
            mock.return_value = mock_result
            result = await service.generate_report({'interview': {}, 'evaluations': []})
            assert result == mock_result
            mock.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_stt_token_calls_provider(self, service):
        mock_result = {'token': 'xyz', 'expires_at': '2024-01-01T00:00:00Z'}
        with patch('app.services.elevenlabs_provider.create_stt_token', new_callable=AsyncMock) as mock:
            mock.return_value = mock_result
            result = await service.create_stt_token()
            assert result == mock_result
            mock.assert_called_once()

    @pytest.mark.asyncio
    async def test_provider_error_wraps_in_ai_unavailable(self, service):
        with patch('app.services.gemini_provider.plan_interview', new_callable=AsyncMock) as mock:
            mock.side_effect = RuntimeError('API error')
            with pytest.raises(AIServiceUnavailable, match='Gemini plan_interview failed'):
                await service.plan_interview({})


class TestServiceFactory:
    """Test get_interview_ai_service factory function."""

    @pytest.mark.asyncio
    async def test_returns_unconfigured_when_no_keys(self):
        with patch('app.services.interview_ai.get_settings') as mock_settings:
            # Create a mock settings object with is_ai_service_configured = False
            mock_settings_obj = MagicMock()
            mock_settings_obj.is_ai_service_configured = False
            mock_settings.return_value = mock_settings_obj
            service = await get_interview_ai_service()
            assert isinstance(service, UnconfiguredInterviewAIService)

    @pytest.mark.asyncio
    async def test_returns_configured_when_gemini_key_present(self):
        with patch('app.services.interview_ai.get_settings') as mock_settings:
            # Create a mock settings object with is_ai_service_configured = True
            mock_settings_obj = MagicMock(spec=Settings)
            mock_settings_obj.is_ai_service_configured = True
            mock_settings.return_value = mock_settings_obj
            service = await get_interview_ai_service()
            assert isinstance(service, ConfiguredInterviewAIService)


class TestGeminiProviderJsonParsing:
    """Test JSON extraction from Gemini responses."""

    def test_extract_json_from_plain_json(self):
        from app.services.gemini_provider import _extract_json
        result = _extract_json('{"key": "value"}')
        assert result == {'key': 'value'}

    def test_extract_json_from_code_block(self):
        from app.services.gemini_provider import _extract_json
        text = '''Here's the result:
```json
{"key": "value"}
```
'''
        result = _extract_json(text)
        assert result == {'key': 'value'}

    def test_extract_json_from_mixed_text(self):
        from app.services.gemini_provider import _extract_json
        text = 'The analysis shows {"score": 0.8} as the result.'
        result = _extract_json(text)
        assert result == {'score': 0.8}

    def test_extract_json_returns_empty_on_invalid(self):
        from app.services.gemini_provider import _extract_json
        result = _extract_json('not valid json at all')
        assert result == {}
