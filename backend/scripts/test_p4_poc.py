"""Run the Phase 1 P4 Gemini and ElevenLabs proof of concept."""

import asyncio
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.schemas.interview_ai import InterviewTurnInput
from app.services.gemini_service import GeminiService
from app.services.voice_poc import VoiceService


async def main() -> None:
    turn = InterviewTurnInput(
        question='What is a database index, and what trade-offs does it introduce?',
        candidate_transcript=(
            'An index is a data structure that helps the database find rows '
            'without scanning the whole table. It improves reads but takes '
            'extra storage and can slow inserts and updates.'
        ),
        rubric_criteria=[
            'Explains faster lookup performance',
            'Mentions storage overhead',
            'Mentions write-performance trade-offs',
        ],
        role_context='Entry-level backend engineer working with relational databases',
    )

    gemini = GeminiService()
    evaluation = await gemini.evaluate_answer(turn)
    follow_up = await gemini.generate_followup(turn)

    print('\n=== Gemini evaluation ===')
    print(evaluation.model_dump_json(indent=2))
    print('\n=== Gemini follow-up ===')
    print(follow_up.model_dump_json(indent=2))

    voice = VoiceService()
    speech = await voice.synthesize_speech(
        follow_up.follow_up_question or 'Thank you. Let us continue the interview.'
    )
    extension = '.wav' if speech.media_type == 'audio/wav' else '.mp3'
    output_path = BACKEND_ROOT / 'p4_poc_interviewer_audio'
    output_path = output_path.with_suffix(extension)
    output_path.write_bytes(speech.audio_bytes)

    if evaluation.overall_score is None:
        print('\nGemini provider output was unavailable; fallback data is shown above.')

    print('\n=== ElevenLabs TTS ===')
    print(f'Wrote {len(speech.audio_bytes)} bytes to {output_path.name}')
    print(f'Media type: {speech.media_type}; mock fallback: {speech.is_mock}')

    transcript = await voice.transcribe_audio(
        speech.audio_bytes,
        filename=output_path.name,
    )
    print('\n=== ElevenLabs STT ===')
    print(transcript.text)
    print(f'Mock fallback: {transcript.is_mock}')


if __name__ == '__main__':
    asyncio.run(main())
