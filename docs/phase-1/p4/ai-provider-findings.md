# AI provider findings — P4 Phase 1

**Review date:** 2026-11-14  
**Branch:** `backend/p4-ai-integrations`

## Status legend

- **PASS:** locally executed verification succeeded.
- **FAIL:** executed verification produced an incorrect result.
- **BLOCKED:** prerequisite or unrelated existing failure prevents completion.
- **NOT VERIFIED:** only documentation/mocked feasibility was checked; no live provider connectivity claim.

No secret value is stored or repeated in this report. Credentials pasted into chat should be treated as exposed and rotated. Replacement secrets must be placed only in a local/deployment secret store.

## Repository discovery

The repository had no provider implementation. `docs/architecture.md` assigned Gemini, ElevenLabs server integrations, and Simli session integration to P4 and marked each not started. Existing P3/P2 documents already propose:

- rubric snapshots and criterion statuses;
- criterion scores on a 0–4 scale;
- P3 as the sole lifecycle/adaptive controller;
- browser-direct ElevenLabs STT;
- server-side ElevenLabs TTS;
- browser-side Simli rendering;
- provisional interview routes/tables not yet implemented.

No live-interview migration, router, or orchestration service currently exists. Existing `interview_questions` stores historical experience data and is explicitly not the planned live `question_bank`.

## Version inventory

| Component | Repository before P4 | Verified/selected in Phase 1 | Status |
| --- | --- | --- | --- |
| Python | 3.10+ claimed | Local 3.11.0; Gemini 3.3.0 requires Python >=3.11 | PASS; README prerequisite needs later coordination |
| Pydantic | `>=2.6,<3` | 2.14.3 installed | PASS |
| `google-genai` | Absent | 3.3.0; proposed range `>=3.3,<4` | PASS (install/import/API inspection) |
| Gemini model | Unconfigured | default proposal `gemini-3.8-flash` | SDK/mock PASS; live NOT VERIFIED |
| `elevenlabs` | Absent | 2.78.0; proposed range `>=2.78,<3` | PASS (install/import/API inspection) |
| Simli Python SDK | Absent | Not required for token minting; official `simli-ai` repo version 2.1.1 identified | NOT INSTALLED/NOT VERIFIED live |
| Simli browser SDK | Absent | official `simli-client` 3.2.0 identified; P1-owned future dependency | Documentation verified only |

The current Gemini dependency raises the effective backend runtime from Python 3.10+ to Python 3.11+. CI already uses Python 3.12, so CI is compatible; developer documentation should be coordinated rather than silently changed in this P4 branch.

## Google Gemini

### Findings

- `google-genai` was not installed or declared initially. Version 3.3.0 was installed in the ignored local virtual environment and added to requirements.
- Official initialization is `genai.Client()` with `GEMINI_API_KEY`, or explicit `genai.Client(api_key=...)`. The codebase now models `GEMINI_API_KEY` and `GEMINI_MODEL` as backend-only settings.
- `gemini-3.8-flash` is the configured proposal because current official documentation marks it stable and supports structured output. It accepts text/image/video/audio/PDF inputs, returns text, and documents 1,048,576 input and 65,536 output tokens.
- SDK 3.3.0 supports Pydantic `response_schema`, standard `response_json_schema`, and `GenerateContentResponse.parsed`. The current Interactions API supports JSON Schema through `response_format` followed by explicit Pydantic validation.
- A mocked HTTP-level `models.generate_content` call verified that the SDK serializes `AnswerEvaluationResponse` as a response schema and parses a conforming response. No network/provider call occurred.
- Local validation rejects malformed JSON, missing fields, extra fields, invalid score/max combinations, criterion mismatch, and nonverbatim evidence.
- SDK/client errors should be mapped to stable P4 exceptions. Retry only bounded transient failures (network, 408, 429, selected 5xx); do not retry invalid/auth/policy errors blindly.
- Set explicit SDK timeout/retry options. SDK timeout values are milliseconds.

### Capabilities relevant to P4

Structured text output is feasible for planning, criterion evaluation, follow-ups, and report narration. The model does not replace deterministic validation, question-bank checks, P3 adaptive logic, or human calibration.

### Limitations and risks

- Structured output constrains syntax/shape, not truth, fairness, evidence grounding, or calibrated scores.
- Some JSON Schema keywords (including string lengths and uniqueness) are ignored provider-side; local Pydantic/application checks are required.
- Complex schemas may return `400 INVALID_ARGUMENT`.
- `.parsed` can be null due to invalid output, safety blocking, truncation, or empty candidates.
- Streaming produces partial JSON; validate only after complete assembly.
- Model names/access and quotas change. Keep model configurable and test access in deployment.
- Live key/auth/quota/model/latency/output quality: **NOT VERIFIED**.

## ElevenLabs realtime STT

### Findings

- Official SDK 2.78.0 exposes `client.speech_to_text.realtime.connect(...)` and `client.tokens.single_use.create('realtime_scribe')`.
- The single-use token endpoint used by the installed official SDK is `POST /v1/single-use-token/realtime_scribe`, authenticated by the server's ElevenLabs API key. The response contains `token`.
- Realtime WebSocket URL built by the SDK: `wss://api.elevenlabs.io/v1/speech-to-text/realtime`.
- Model: `scribe_v2_realtime`.
- Auth: permanent `xi-api-key` may authenticate trusted server calls; browser flow must use the single-use `token` query parameter. When a token is supplied, the SDK deliberately does not send the API key.
- Installed SDK audio formats: `pcm_8000`, `pcm_16000`, `pcm_22050`, `pcm_24000`, `pcm_44100`, `pcm_48000`, and `ulaw_8000`; the matching sample rate is required for manual mode.
- Browser/manual chunks are base64 audio in `input_audio_chunk` messages. Commit strategy is `vad` or `manual`.
- Transcript events include session started, partial/final/committed transcripts, timestamps/entities/redaction/edit variants. Errors include auth, quota, throttling, rate limiting, invalid input/request, queue overflow, resource exhaustion, session time limit, excessive chunk size, and insufficient audio activity.
- Reconnection must obtain a fresh single-use token and start a new session; preserve only frontend transcript state that the product explicitly accepts. Use connection timeout, bounded backoff/jitter, max attempts, and no infinite reconnect loop.
- The official SDK states the token is time-limited and single-use. If an exact expiry timestamp is not returned/documented, the backend must not fabricate one; `expires_at` is nullable in the proposed DTO.

### Recommended flow

1. Authenticated frontend asks FastAPI for STT credentials.
2. FastAPI verifies the Supabase user, rate-limits the route, and calls ElevenLabs using the permanent backend key.
3. Backend returns only token plus nonsecret connection parameters; apply `Cache-Control: no-store`.
4. Browser opens ElevenLabs WebSocket, streams microphone audio directly, handles partial/final events, and closes on completion.
5. Browser submits final transcript text to P3's answer endpoint.

Permanent keys, tokens, and audio must not be logged. Browser token minting should be origin/auth/rate constrained.

### Verification status

- SDK installation/import/signatures: **PASS**.
- Mocked single-use token HTTP request/response: **PASS**.
- WebSocket URL/options/events inspected in official SDK: **PASS (static)**.
- Real token issuance, WebSocket handshake, transcription, session duration, quota: **NOT VERIFIED**.

## ElevenLabs TTS

### Findings

- SDK 2.78.0 exposes streaming `client.text_to_speech.stream(...)` and iterator-based `convert(...)`.
- Endpoint: `POST /v1/text-to-speech/{voice_id}/stream`; API key remains server-side.
- Required runtime config: API key and voice ID. Default proposed model is `eleven_multilingual_v2`; actual model availability must be checked via provider account/API.
- The SDK supports MP3, raw PCM (8–48 kHz), μ-law/A-law 8 kHz, and Opus 48 kHz variants. Some high-quality formats require higher provider tiers.
- Default provider format is MP3 44.1 kHz/128 kbps, which is **not** suitable to send directly to Simli.
- P4 proposes `pcm_16000`: raw 16 kHz PCM selected to match Simli's required mono PCM16LE stream. If provider/account behavior differs, inspect/convert before forwarding.
- Stream response is audio bytes, not JSON. P3/route should set media metadata matching the selected format rather than always declaring `audio/mpeg`.
- Handle validation errors, unknown voice/model, auth, quota, rate limits, timeout, disconnect, and partial stream failure. Never cache private output unintentionally.

### Expected flow

P3 verifies turn ownership and supplies question text → P4 calls ElevenLabs → backend streams raw `pcm_16000` bytes → frontend sends them to the active Simli session → Simli returns synchronized media. The frontend should not separately play the original TTS stream, which would duplicate audio.

### Verification status

- SDK format/signature compatibility: **PASS**.
- Mocked TTS endpoint, streaming bytes, and `pcm_16000` query: **PASS**.
- Live authentication, selected voice/model entitlement, audio generation/quality: **NOT VERIFIED**.

## Simli Compose avatar

### Findings

- Use Simli **Compose**, not the deprecated/different Auto-agent token flow, because CareerPilot supplies external ElevenLabs speech.
- Server endpoint: `POST https://api.simli.ai/compose/token` with `x-simli-api-key`; minimum body contains `faceId`. Proposed options include `handleSilence`, `maxSessionLength`, `maxIdleTime`, and `audioInputFormat: "pcm16"`.
- Successful response contains `session_token` and optional warnings. Compose tokens are documented as valid for 5 minutes; create immediately before connecting and use a new token/client per session.
- Browser package `simli-client` 3.2.0 uses a temporary token. Browser creates actual video/audio elements, constructs `SimliClient`, starts it, forwards audio, handles events, and cleans up.
- Default recommended transport is LiveKit: WebSocket signaling plus WebRTC-returned synchronized audio/video. P2P is available and additionally requires ICE credentials.
- Exact input: headerless signed 16-bit little-endian PCM, 16,000 samples/s, mono. Send binary bytes after session startup. MP3, Opus, WAV containers, μ-law, Float32, stereo, other rates, and base64 text are not directly compatible.
- Recommended chunks are approximately 6,000 bytes/3,000 samples (~187.5 ms), not a documented hard cap.
- If TTS is not raw PCM16LE 16 kHz mono, decode, downmix, resample, quantize and strip container headers before Simli.
- Session settings default/documented examples: `maxSessionLength` 3600 seconds and `maxIdleTime` 300 seconds. Client startup has retries, but seamless mid-session resume is not guaranteed.
- Errors include invalid/expired token, invalid/unauthorized face, account minutes/concurrency, validation, rate limits and connection/startup timeouts. Provide an audio/text-only fallback when avatar startup fails.

### Verification status

- Current official API/SDK/audio/lifecycle documentation: **PASS (documentation)**.
- Local contract tests for exact audio/session bounds: **PASS**.
- Simli SDK/API initialization, token minting, WebRTC connectivity: **NOT VERIFIED** (no secret/face in environment and no paid call).

## Required backend environment variables

| Variable | Required for | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Gemini services | Secret; server only. Rotate any exposed value. |
| `GEMINI_MODEL` | Gemini services | Defaults/proposal: `gemini-3.8-flash`; configurable for access/deprecation. |
| `ELEVENLABS_API_KEY` | STT token + TTS | Secret; never sent to frontend. |
| `ELEVENLABS_VOICE_ID` | TTS | Approved account voice ID. |
| `ELEVENLABS_MODEL_ID` | TTS | Proposed default `eleven_multilingual_v2`. |
| `ELEVENLABS_TTS_OUTPUT_FORMAT` | TTS/Simli | Proposed `pcm_16000` for direct Simli compatibility. |
| `SIMLI_API_KEY` | Compose token | Secret; server only. |
| `SIMLI_FACE_ID` | Compose session | Approved face UUID/ID. |

No provider variable belongs in `frontend/.env` or a `VITE_*` key. `backend/.env.example` contains empty placeholders only.

## Unresolved technical risks

1. No rotated credentials were loaded into the environment, so every provider remains unverified live.
2. Gemini's current package requires Python 3.11+, while README still says 3.10+. CI 3.12 is compatible; team documentation/runtime must converge.
3. P3/P2 live interview implementation is absent; service contracts require explicit review before Phase 2.
4. Existing API docs claim a five-minute STT token expiry and return `expires_at`; current installed token response exposes only `token`. P3 should not promise an exact timestamp until official behavior is confirmed.
5. Simli/ElevenLabs account tiers may limit formats, voices, concurrency, minutes, regions, or rates.
6. Real latency and backpressure across TTS → browser → Simli remain unmeasured.
7. Assessment quality/fairness requires a human-scored calibration set and drift monitoring.
8. Provider retention/privacy settings for candidate transcripts require product/legal review.

## Official references

### Gemini

- https://aistudio.google.com/docs/get-started
- https://aistudio.google.com/docs/structured-output
- https://aistudio.google.com/docs/models/gemini-3.8-flash
- https://github.com/googleapis/python-genai
- https://aistudio.google.com/docs/api-errors

### ElevenLabs

- https://elevenlabs.io/docs/capabilities/speech-to-text/real-time
- https://elevenlabs.io/docs/api-reference/text-to-speech/stream
- https://elevenlabs.io/docs/api-reference/tokens/single-use/create
- https://github.com/elevenlabs/elevenlabs-python

### Simli

- https://docs.simli.com/api-reference/javascript.md
- https://docs.simli.com/api-reference/endpoint/webrtc/startAudioToVideoSession.md
- https://docs.simli.com/api-reference/simli-webrtc.md
- https://docs.simli.com/api-reference/audio-info.md
- https://docs.simli.com/api-reference/samples/elevenlabs.md
