"""ElevenLabs voice provider for interview TTS and STT.

This module handles voice synthesis and speech recognition:
- stream_tts(): Stream audio for interview questions
- create_stt_token(): Generate temporary tokens for client-side STT

Credentials are never exposed to the client. The STT token is short-lived
and scoped to the specific use case.
"""

from collections.abc import AsyncIterator
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

from app.core.config import Settings


ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1'


async def stream_tts(settings: Settings, text: str) -> AsyncIterator[bytes]:
    """Stream TTS audio for the given text.

    Yields audio chunks as they're received from ElevenLabs.
    The audio format is MP3 (audio/mpeg).
    """
    if not settings.elevenlabs_api_key:
        raise RuntimeError('ElevenLabs API key not configured')

    url = f'{ELEVENLABS_API_BASE}/text-to-speech/{settings.elevenlabs_voice_id}/stream'

    payload = {
        'text': text,
        'model_id': settings.elevenlabs_model_id,
        'voice_settings': {
            'stability': 0.5,
            'similarity_boost': 0.75,
            'style': 0.0,
            'use_speaker_boost': True,
        },
    }

    headers = {
        'xi-api-key': settings.elevenlabs_api_key,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream(
            'POST',
            url,
            json=payload,
            headers=headers,
        ) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes(chunk_size=1024):
                if chunk:
                    yield chunk


async def create_stt_token(settings: Settings) -> dict[str, Any]:
    """Create a temporary single-use token for client-side speech recognition.

    Uses ElevenLabs official single-use token endpoint:
    POST /v1/single-use-token/realtime_scribe

    The token expires after 15 minutes and is consumed on first use,
    ensuring the permanent API key is never exposed to the client.
    """
    if not settings.elevenlabs_api_key:
        raise RuntimeError('ElevenLabs API key not configured')

    # Request a single-use token from ElevenLabs
    url = f'{ELEVENLABS_API_BASE}/single-use-token/realtime_scribe'
    headers = {
        'xi-api-key': settings.elevenlabs_api_key,
        'Content-Type': 'application/json',
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(url, headers=headers)
        response.raise_for_status()
        result = response.json()

    # Token expires in 15 minutes per ElevenLabs documentation
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    return {
        'token': result['token'],
        'expires_at': expires_at,
        'websocket_url': 'wss://api.elevenlabs.io/v1/speech-to-text/realtime',
    }


async def get_voices(settings: Settings) -> list[dict[str, Any]]:
    """List available ElevenLabs voices (utility function)."""
    if not settings.elevenlabs_api_key:
        return []

    url = f'{ELEVENLABS_API_BASE}/voices'
    headers = {'xi-api-key': settings.elevenlabs_api_key}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            result = response.json()
            return result.get('voices', [])
    except Exception:
        return []
