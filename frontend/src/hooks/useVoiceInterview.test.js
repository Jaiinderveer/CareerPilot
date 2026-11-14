import { describe, expect, it } from 'vitest'

import {
  buildRealtimeAudioMessage,
  buildRealtimeSttUrl,
  isAutoplayBlockedError,
} from './useVoiceInterview'

describe('LIVE audio playback errors', () => {
  it('recognizes browser autoplay blocking without hiding real failures', () => {
    expect(isAutoplayBlockedError({ name: 'NotAllowedError' })).toBe(true)
    expect(isAutoplayBlockedError({ name: 'NotSupportedError' })).toBe(false)
    expect(isAutoplayBlockedError(new Error('network failure'))).toBe(false)
  })
})

describe('ElevenLabs realtime STT protocol', () => {
  it('uses the current model, PCM format, and manual commits', () => {
    const url = new URL(buildRealtimeSttUrl(
      'wss://api.elevenlabs.io/v1/speech-to-text/realtime',
      'single-use-token'
    ))

    expect(url.searchParams.get('token')).toBe('single-use-token')
    expect(url.searchParams.get('model_id')).toBe('scribe_v3_live')
    expect(url.searchParams.get('language_code')).toBe('en')
    expect(url.searchParams.get('audio_format')).toBe('pcm_16000')
    expect(url.searchParams.get('commit_strategy')).toBe('manual')
  })

  it('builds audio chunks with the provider wire field names', () => {
    expect(buildRealtimeAudioMessage('base64-pcm')).toEqual({
      message_type: 'input_audio_chunk',
      audio_base_64: 'base64-pcm',
      commit: false,
      sample_rate: 16000,
    })
  })

  it('builds an explicit final commit chunk', () => {
    expect(buildRealtimeAudioMessage('', true)).toEqual({
      message_type: 'input_audio_chunk',
      audio_base_64: '',
      commit: true,
      sample_rate: 16000,
    })
  })
})
