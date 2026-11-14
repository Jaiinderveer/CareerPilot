"""Small ElevenLabs TTS/STT adapter used by the Phase 1 proof of concept."""

import io
import logging
import wave
from dataclasses import dataclass

from elevenlabs.client import AsyncElevenLabs

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'
TTS_MODEL = 'eleven_multilingual_v2'
STT_MODEL = 'scribe_v2'


@dataclass(frozen=True)
class AudioResult:
    """Generated speech bytes and transport metadata."""

    audio_bytes: bytes
    media_type: str
    is_mock: bool = False


@dataclass(frozen=True)
class TranscriptionResult:
    """Final transcription text and whether it came from a mock fallback."""

    text: str
    is_mock: bool = False


def _mock_wav(duration_ms: int = 250, sample_rate: int = 16_000) -> bytes:
    """Create valid silent WAV bytes so keyless local playback remains safe."""

    frame_count = sample_rate * duration_ms // 1000
    output = io.BytesIO()
    with wave.open(output, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b'\x00\x00' * frame_count)
    return output.getvalue()


class VoiceService:
    """Provider adapter; it never controls or persists interview state."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    async def synthesize_speech(
        self,
        text: str,
        *,
        voice_id: str = DEFAULT_VOICE_ID,
    ) -> AudioResult:
        """Convert interviewer text to MP3, falling back to a silent WAV."""

        api_key = (self._settings.elevenlabs_api_key or '').strip()
        if not api_key:
            return AudioResult(_mock_wav(), 'audio/wav', is_mock=True)

        try:
            client = AsyncElevenLabs(api_key=api_key, timeout=30)
            chunks = client.text_to_speech.convert(
                voice_id=voice_id,
                text=text,
                model_id=TTS_MODEL,
                output_format='mp3_44100_128',
            )
            audio = b''.join([chunk async for chunk in chunks])
            if not audio:
                raise ValueError('ElevenLabs returned empty audio')
            return AudioResult(audio, 'audio/mpeg')
        except Exception as exc:
            # Avoid logging provider bodies, API keys, or user-supplied text.
            logger.warning('ElevenLabs TTS failed: %s', type(exc).__name__)
            return AudioResult(_mock_wav(), 'audio/wav', is_mock=True)

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        *,
        filename: str = 'candidate_audio.wav',
    ) -> TranscriptionResult:
        """Transcribe a complete candidate recording with ElevenLabs Scribe.

        Phase 1 uses a file request for a server-side demonstration. Production
        follows the architecture contract: browser-direct realtime STT and only
        the final transcript is sent to the backend.
        """

        api_key = (self._settings.elevenlabs_api_key or '').strip()
        if not api_key:
            return TranscriptionResult(
                '[Mock STT] Configure ELEVENLABS_API_KEY to transcribe audio.',
                is_mock=True,
            )
        if not audio_bytes:
            raise ValueError('audio_bytes must not be empty')

        try:
            client = AsyncElevenLabs(api_key=api_key, timeout=60)
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = filename
            response = await client.speech_to_text.convert(
                file=audio_file,
                model_id=STT_MODEL,
            )
            text = getattr(response, 'text', None)
            if not text:
                raise ValueError('ElevenLabs returned no transcript')
            return TranscriptionResult(text=text)
        except Exception as exc:
            logger.warning('ElevenLabs STT failed: %s', type(exc).__name__)
            return TranscriptionResult(
                '[Mock STT] Transcription service is temporarily unavailable.',
                is_mock=True,
            )
