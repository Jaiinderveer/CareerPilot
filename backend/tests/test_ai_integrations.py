"""Isolated Phase 1 tests for P4 AI and provider contracts.

These tests verify local SDK/schema feasibility only. They make no live provider
requests and therefore are not proof of provider connectivity or credentials.
"""

from importlib.metadata import version
from unittest.mock import MagicMock

import httpx
import httpx2
import pytest
from elevenlabs.client import ElevenLabs
from google import genai
from google.genai import types
from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.ai_integrations import (
    AnswerEvaluationRequest,
    AnswerEvaluationResponse,
    CriterionResult,
    CriterionStatus,
    EvaluationCriterion,
    QuestionCategory,
    QuestionSchema,
)
from app.services.gemini_validation import (
    MalformedStructuredResponseError,
    StructuredResponseValidationError,
    validate_structured_response,
)


@pytest.fixture
def evaluation_request() -> AnswerEvaluationRequest:
    return AnswerEvaluationRequest(
        question=QuestionSchema(
            question_text='Explain the difference between authentication and authorization.',
            category=QuestionCategory.TECHNICAL,
            topic='Application security',
            difficulty=2,
            estimated_minutes=3,
        ),
        candidate_answer=(
            'Authentication verifies who a user is, while authorization determines '
            'what the user is allowed to access.'
        ),
        criteria=[
            EvaluationCriterion(
                criterion_id='authentication_definition',
                name='Authentication definition',
                description='Explains that authentication establishes identity.',
                max_score=4,
                importance='critical',
                weight=0.5,
            ),
            EvaluationCriterion(
                criterion_id='authorization_definition',
                name='Authorization definition',
                description='Explains that authorization controls permitted access.',
                max_score=4,
                importance='critical',
                weight=0.5,
            ),
        ],
    )


def _valid_evaluation() -> AnswerEvaluationResponse:
    return AnswerEvaluationResponse(
        criterion_results=[
            CriterionResult(
                criterion_id='authentication_definition',
                criterion_name='Authentication definition',
                status=CriterionStatus.DEMONSTRATED,
                score=4,
                maximum_score=4,
                evidence='Authentication verifies who a user is',
                explanation='Correctly identifies identity verification.',
            ),
            CriterionResult(
                criterion_id='authorization_definition',
                criterion_name='Authorization definition',
                status=CriterionStatus.DEMONSTRATED,
                score=4,
                maximum_score=4,
                evidence='authorization determines what the user is allowed to access',
                explanation='Correctly identifies permission enforcement.',
                improvement_suggestions=['Add a concrete role or resource example.'],
            ),
        ],
        overall_score=1.0,
        overall_feedback='Accurate and concise distinction between the two concepts.',
        strengths=['Uses the standard identity-versus-permission distinction.'],
        weaknesses=['Does not include an example.'],
    )


def test_provider_sdk_versions_are_the_phase_1_ranges():
    assert version('google-genai').startswith('3.')
    assert version('elevenlabs').startswith('2.')


def test_gemini_sdk_initializes_without_a_network_call():
    client = genai.Client(api_key='phase-1-placeholder')
    assert client.models is not None
    client.close()


def test_gemini_sdk_supports_pydantic_structured_output():
    config = types.GenerateContentConfig(
        response_mime_type='application/json',
        response_schema=AnswerEvaluationResponse,
    )
    assert config.response_schema is AnswerEvaluationResponse
    assert 'parsed' in types.GenerateContentResponse.model_fields


def test_gemini_structured_generation_uses_schema_over_mock_transport(evaluation_request):
    expected = _valid_evaluation()
    request_seen = {}

    def handler(request: httpx2.Request) -> httpx2.Response:
        request_seen['body'] = request.content.decode()
        return httpx2.Response(
            200,
            json={
                'candidates': [{
                    'content': {
                        'role': 'model',
                        'parts': [{'text': expected.model_dump_json()}],
                    },
                    'finishReason': 'STOP',
                }],
            },
        )

    transport = httpx2.MockTransport(handler)
    client = genai.Client(
        api_key='phase-1-placeholder',
        http_options=types.HttpOptions(httpx_client=httpx2.Client(transport=transport)),
    )
    try:
        response = client.models.generate_content(
            model='gemini-3.8-flash',
            contents='Evaluate this answer.',
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=AnswerEvaluationResponse,
            ),
        )
    finally:
        client.close()

    parsed = AnswerEvaluationResponse.model_validate(response.parsed)
    parsed.validate_against_request(evaluation_request)
    assert 'responseSchema' in request_seen['body']


def test_elevenlabs_single_use_stt_token_request_is_mocked():
    request_seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        request_seen['method'] = request.method
        request_seen['path'] = request.url.path
        request_seen['api_key'] = request.headers.get('xi-api-key')
        return httpx.Response(200, json={'token': 'temporary-test-token'})

    http_client = httpx.Client(transport=httpx.MockTransport(handler))
    client = ElevenLabs(api_key='server-secret-placeholder', httpx_client=http_client)
    response = client.tokens.single_use.create('realtime_scribe')

    assert response.token == 'temporary-test-token'
    assert request_seen['method'] == 'POST'
    assert request_seen['path'] == '/v1/single-use-token/realtime_scribe'
    assert request_seen['api_key']


def test_elevenlabs_tts_stream_request_and_pcm_format_are_mocked():
    request_seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        request_seen['path'] = request.url.path
        request_seen['query'] = str(request.url.query)
        request_seen['api_key'] = request.headers.get('xi-api-key')
        return httpx.Response(200, content=b'\x00\x00\x01\x00')

    http_client = httpx.Client(transport=httpx.MockTransport(handler))
    client = ElevenLabs(api_key='server-secret-placeholder', httpx_client=http_client)
    audio = b''.join(client.text_to_speech.stream(
        voice_id='test-voice',
        text='Hello.',
        model_id='eleven_multilingual_v2',
        output_format='pcm_16000',
    ))

    assert audio == b'\x00\x00\x01\x00'
    assert request_seen['path'] == '/v1/text-to-speech/test-voice/stream'
    assert 'output_format=pcm_16000' in request_seen['query']
    assert request_seen['api_key'] == 'server-secret-placeholder'


def test_mocked_gemini_structured_output_validates(evaluation_request):
    expected = _valid_evaluation()
    response = MagicMock()
    response.text = expected.model_dump_json()

    parsed = validate_structured_response(response.text, AnswerEvaluationResponse)
    parsed.validate_against_request(evaluation_request)
    assert parsed.overall_score == 1.0


def test_malformed_gemini_json_is_rejected():
    with pytest.raises(MalformedStructuredResponseError):
        validate_structured_response('{"overall_score":', AnswerEvaluationResponse)


def test_missing_gemini_fields_are_rejected():
    with pytest.raises(StructuredResponseValidationError):
        validate_structured_response('{"overall_score": 0.8}', AnswerEvaluationResponse)


def test_score_above_maximum_is_rejected():
    with pytest.raises(ValidationError):
        CriterionResult(
            criterion_id='identity',
            criterion_name='Identity',
            status='demonstrated',
            score=5,
            maximum_score=4,
            evidence='Authentication verifies who a user is',
            explanation='Correct definition.',
        )


def test_non_verbatim_evidence_is_rejected(evaluation_request):
    result = _valid_evaluation()
    result.criterion_results[0].evidence = 'The candidate discussed passwords.'
    with pytest.raises(ValueError, match='not a verbatim answer quote'):
        result.validate_against_request(evaluation_request)


def test_missing_criterion_result_is_rejected(evaluation_request):
    result = _valid_evaluation()
    result.criterion_results.pop()
    with pytest.raises(ValueError, match='criterion result mismatch'):
        result.validate_against_request(evaluation_request)


def test_provider_configuration_flags_require_secrets():
    settings = Settings(
        SUPABASE_URL='https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY='test',
        FRONTEND_ORIGIN='http://localhost:5173',
        GEMINI_API_KEY=None,
        ELEVENLABS_API_KEY=None,
        SIMLI_API_KEY=None,
    )
    assert not settings.is_gemini_configured
    assert not settings.is_elevenlabs_stt_configured
    assert not settings.is_elevenlabs_tts_configured
    assert not settings.is_simli_configured
