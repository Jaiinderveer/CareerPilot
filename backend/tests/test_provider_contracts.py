"""Contract-only tests for voice and avatar provider boundaries."""

from pydantic import ValidationError
import pytest

from app.services.provider_contracts import (
    SimliSessionRequest,
    SimliSessionResponse,
    STTCredentialsRequest,
    TTSAudioMetadata,
    TTSAudioRequest,
)


def test_stt_defaults_to_realtime_scribe_pcm16():
    request = STTCredentialsRequest()
    assert request.model_id == 'scribe_v2_realtime'
    assert request.audio_format == 'pcm_16000'
    assert request.commit_strategy == 'vad'


def test_stt_rejects_unverified_container_audio():
    with pytest.raises(ValidationError):
        STTCredentialsRequest(audio_format='mp3_44100_128')


def test_tts_defaults_to_simli_compatible_output():
    request = TTSAudioRequest(text='Please describe database indexes.')
    metadata = TTSAudioMetadata(
        media_type='audio/L16',
        output_format=request.output_format,
        sample_rate_hz=16000,
        channels=1,
        simli_compatible=True,
    )
    assert metadata.output_format == 'pcm_16000'
    assert metadata.simli_compatible


def test_simli_session_contract_is_pcm16_mono_16khz():
    request = SimliSessionRequest()
    response = SimliSessionResponse(session_token='temporary-token')
    assert request.audio_input_format == 'pcm16'
    assert response.sample_rate_hz == 16000
    assert response.channels == 1
    assert response.sample_width_bits == 16
    assert response.token_expires_in_seconds == 300


def test_simli_session_limits_are_bounded():
    with pytest.raises(ValidationError):
        SimliSessionRequest(max_session_length_seconds=7200)
