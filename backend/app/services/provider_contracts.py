"""Provisional provider service DTOs shared with P3 orchestration.

They define integration boundaries only. No interview lifecycle state, database
writes, or frontend routes are implemented here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import Field

from app.schemas.ai_integrations import NonBlankStr, StrictContract


class STTCredentialsRequest(StrictContract):
    model_id: Literal['scribe_v2_realtime'] = 'scribe_v2_realtime'
    audio_format: Literal[
        'pcm_8000',
        'pcm_16000',
        'pcm_22050',
        'pcm_24000',
        'pcm_44100',
        'pcm_48000',
        'ulaw_8000',
    ] = 'pcm_16000'
    commit_strategy: Literal['vad', 'manual'] = 'vad'
    language_code: Optional[NonBlankStr] = Field(default=None, max_length=35)


class STTCredentialsResponse(StrictContract):
    token: NonBlankStr
    websocket_url: str = Field(
        default='wss://api.elevenlabs.io/v1/speech-to-text/realtime',
        pattern=r'^wss://',
    )
    model_id: Literal['scribe_v2_realtime'] = 'scribe_v2_realtime'
    audio_format: NonBlankStr
    commit_strategy: Literal['vad', 'manual']
    expires_at: Optional[datetime] = Field(
        default=None,
        description='Null unless ElevenLabs returns or formally documents an exact expiry.',
    )


class TTSAudioRequest(StrictContract):
    text: NonBlankStr = Field(max_length=5000)
    voice_id: Optional[NonBlankStr] = Field(
        default=None,
        description='Defaults to server configuration; P3 may select an approved voice.',
    )
    model_id: Optional[NonBlankStr] = Field(default=None)
    output_format: Literal[
        'mp3_22050_32',
        'mp3_24000_48',
        'mp3_44100_128',
        'pcm_8000',
        'pcm_16000',
        'pcm_22050',
        'pcm_24000',
        'pcm_32000',
        'pcm_44100',
        'pcm_48000',
        'ulaw_8000',
        'alaw_8000',
        'opus_48000_32',
        'opus_48000_64',
        'opus_48000_96',
        'opus_48000_128',
        'opus_48000_192',
    ] = 'pcm_16000'


class TTSAudioMetadata(StrictContract):
    media_type: NonBlankStr
    output_format: NonBlankStr
    sample_rate_hz: int = Field(gt=0)
    channels: int = Field(default=1, ge=1, le=2)
    streaming: bool = True
    simli_compatible: bool


class SimliSessionRequest(StrictContract):
    face_id: Optional[NonBlankStr] = Field(
        default=None,
        description='Defaults to the server-side approved SIMLI_FACE_ID.',
    )
    handle_silence: bool = True
    max_session_length_seconds: int = Field(default=3600, ge=60, le=3600)
    max_idle_time_seconds: int = Field(default=300, ge=30, le=600)
    audio_input_format: Literal['pcm16'] = 'pcm16'


class SimliSessionResponse(StrictContract):
    session_token: NonBlankStr
    transport: Literal['livekit'] = 'livekit'
    audio_input_format: Literal['pcm16'] = 'pcm16'
    sample_rate_hz: Literal[16000] = 16000
    channels: Literal[1] = 1
    sample_width_bits: Literal[16] = 16
    token_expires_in_seconds: Literal[300] = 300
    warnings: list[NonBlankStr] = Field(default_factory=list)
