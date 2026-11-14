# P4 AI and provider service contracts — Phase 1

**Contract status:** **PROVISIONAL FOR P3 REVIEW.** The repository contains a planned interview API/database contract, but P3's orchestration implementation and P2's live-interview migrations are not present. These are service-layer DTOs, not final database column definitions or endpoint names.

Executable schema prototypes are in `backend/app/schemas/ai_integrations.py`; voice/avatar DTOs are in `backend/app/services/provider_contracts.py`. Unknown fields are rejected and strings are stripped/validated as nonblank.

## Ownership boundary

### P3 — orchestration

P3 exclusively creates and owns interview sessions, loads curated questions/rubric snapshots, chooses questions, receives and saves answers, invokes P4, persists accepted outputs, computes/validates state, chooses the next action, tracks limits/idempotency, and completes interviews.

### P4 — AI and providers

P4 validates service inputs, renders versioned prompts, calls providers, validates provider outputs, maps provider failures to safe typed exceptions, returns planning/evaluation/follow-up/report results, mints temporary provider credentials, streams TTS bytes, and creates Simli sessions. P4 does not write interview state or choose lifecycle transitions.

### Frontend (P1)

P1 requests authenticated backend resources, captures microphone audio, connects directly to ElevenLabs STT using a backend-minted single-use token, submits final transcript text to P3, initializes Simli with a temporary session token, and renders returned synchronized audio/video. Permanent provider keys never enter the browser.

## Shared values

| Enum | Values |
| --- | --- |
| `DifficultyLevel` | `1` basic, `2` foundational, `3` intermediate, `4` advanced, `5` expert |
| `QuestionCategory` | `fundamentals`, `technical`, `problem_solving`, `system_design`, `project`, `behavioral`, `situational` |
| `CriterionImportance` | `critical`, `required`, `optional` |
| `CriterionStatus` | `demonstrated`, `partially_demonstrated`, `not_demonstrated`, `contradicted`, `uncertain` |

The criterion statuses and default 0–4 score scale align with the existing provisional API/database documents.

## Pydantic schema designs

### `QuestionSchema`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `question_id` | UUID or null | No | Provisional reference to P3's curated bank; never generated as a DB ID by P4. |
| `question_text` | string | Yes | 5–2,000 chars, nonblank. |
| `category` | `QuestionCategory` | Yes | Enum above. |
| `topic` | string | Yes | Nonblank, max 160. |
| `difficulty` | `DifficultyLevel` | Yes | Integer 1–5. |
| `estimated_minutes` | integer | Yes | 1–20. |
| `evaluation_criteria` | `EvaluationCriterion[]` | No | At most 10; P3's turn rubric snapshot remains authoritative. |

`EvaluationCriterion` contains `criterion_id`, `name`, `description`, `max_score` (1–10; repository default is 4), `importance`, `weight` (`>0` and `<=1`), accepted alternatives, and common misconceptions.

Example:

```json
{
  "question_id": null,
  "question_text": "Explain authentication and authorization.",
  "category": "technical",
  "topic": "Application security",
  "difficulty": 2,
  "estimated_minutes": 3,
  "evaluation_criteria": []
}
```

### `InterviewPlanningRequest`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `role` | string | Yes | Nonblank, max 200. |
| `duration_minutes` | integer | Yes | 10–60; aligns with planned API. |
| `difficulty` | `DifficultyLevel` | No | Default 3. |
| `interview_round` | string/null | No | Max 100. |
| `job_description` | string/null | No | Max 12,000. |
| `focus_topics` | string[] | No | Max 20. |
| `candidate_experience_summary` | string/null | No | Max 4,000; avoid unnecessary personal data. |
| `available_questions` | `QuestionSchema[]` | No | Max 100 curated candidates supplied by P3. |

```json
{
  "role": "Backend Engineer",
  "duration_minutes": 30,
  "difficulty": 3,
  "interview_round": "Technical",
  "job_description": "Build secure Python APIs.",
  "focus_topics": ["Python", "FastAPI", "authentication"],
  "available_questions": []
}
```

### `InterviewPlanningResponse`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `plan_summary` | string | Yes | Nonblank, max 2,000. |
| `questions` | `QuestionSchema[]` | Yes | 1–30. P3 validates IDs/eligibility and selects actual turns. |
| `estimated_duration_minutes` | integer | Yes | 1–60; must cover sum of question estimates. |
| `category_distribution` | map category → integer | No | Summary only. |
| `planning_notes` | string[] | No | Max 20. |

```json
{
  "plan_summary": "Begin with fundamentals, then test API design and trade-offs.",
  "questions": [{
    "question_id": null,
    "question_text": "Explain authentication and authorization.",
    "category": "technical",
    "topic": "Application security",
    "difficulty": 2,
    "estimated_minutes": 3,
    "evaluation_criteria": []
  }],
  "estimated_duration_minutes": 30,
  "category_distribution": {"technical": 1},
  "planning_notes": ["P3 must attach the reviewed rubric snapshot before asking."]
}
```

### `AnswerEvaluationRequest`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `question` | `QuestionSchema` | Yes | Asked question. |
| `candidate_answer` | string | Yes | Nonblank, max 30,000. |
| `criteria` | `EvaluationCriterion[]` | Yes | 1–20 with unique criterion IDs; taken from immutable rubric snapshot. |
| `transcript_is_complete` | boolean | No | Default true. |
| `language` | string | No | Default `en`, max 35. |

```json
{
  "question": {
    "question_text": "Explain the difference between authentication and authorization.",
    "category": "technical",
    "topic": "Application security",
    "difficulty": 2,
    "estimated_minutes": 3,
    "evaluation_criteria": []
  },
  "candidate_answer": "Authentication verifies who a user is, while authorization determines what the user is allowed to access.",
  "criteria": [
    {
      "criterion_id": "authentication_definition",
      "name": "Authentication definition",
      "description": "Explains identity verification.",
      "max_score": 4,
      "importance": "critical",
      "weight": 0.5,
      "accepted_alternatives": [],
      "common_misconceptions": []
    }
  ],
  "transcript_is_complete": true,
  "language": "en"
}
```

### `CriterionResult`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `criterion_id` | string | Yes | Must match one input criterion exactly. |
| `criterion_name` | string | Yes | Nonblank, max 160. |
| `status` | `CriterionStatus` | Yes | Enum above. |
| `score` | integer/null | No | `>=0`, `<=maximum_score`; must be null if uncertain. |
| `maximum_score` | integer | Yes | 1–10 and must equal input rubric maximum. |
| `evidence` | string/null | No | Exact candidate-answer substring; null if absent/uncertain. |
| `explanation` | string | Yes | Nonblank, max 3,000. |
| `improvement_suggestions` | string[] | No | Max 10. |

### `AnswerEvaluationResponse`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `criterion_results` | `CriterionResult[]` | Yes | 1–20, unique IDs, exact set supplied by P3. |
| `overall_score` | float/null | No | 0–1; null when unreliable. |
| `overall_feedback` | string | Yes | Nonblank, max 4,000. |
| `strengths` | string[] | No | Max 15. |
| `weaknesses` | string[] | No | Max 15. |
| `needs_clarification` | boolean | No | Default false; information for P3, not a lifecycle command. |

```json
{
  "criterion_results": [{
    "criterion_id": "authentication_definition",
    "criterion_name": "Authentication definition",
    "status": "demonstrated",
    "score": 4,
    "maximum_score": 4,
    "evidence": "Authentication verifies who a user is",
    "explanation": "Correctly identifies identity verification.",
    "improvement_suggestions": []
  }],
  "overall_score": 1.0,
  "overall_feedback": "Accurate and concise.",
  "strengths": ["Correct identity-versus-permission distinction."],
  "weaknesses": ["No concrete example."],
  "needs_clarification": false
}
```

### `FollowUpGenerationRequest`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `original_question` | `QuestionSchema` | Yes | Parent question. |
| `candidate_answer` | string | Yes | Nonblank, max 30,000. |
| `evaluation` | `AnswerEvaluationResponse` | Yes | Validated evaluation. |
| `target_criterion_id` | string | Yes | Must appear in evaluation; P3 chooses it. |
| `previous_questions` | string[] | No | Max 50, used to avoid repetition. |
| `maximum_follow_ups` | integer | No | 1–3, default 1. |

```json
{
  "original_question": {
    "question_text": "Explain database indexes.",
    "category": "technical",
    "topic": "DBMS",
    "difficulty": 3,
    "estimated_minutes": 4,
    "evaluation_criteria": []
  },
  "candidate_answer": "Indexes speed up reads.",
  "evaluation": {
    "criterion_results": [{
      "criterion_id": "write_overhead",
      "criterion_name": "Write overhead",
      "status": "not_demonstrated",
      "score": 0,
      "maximum_score": 4,
      "evidence": null,
      "explanation": "Write cost was not discussed.",
      "improvement_suggestions": ["Explain index maintenance on writes."]
    }],
    "overall_score": 0.5,
    "overall_feedback": "Partially complete.",
    "strengths": ["Identifies read benefit."],
    "weaknesses": ["Omits write trade-offs."],
    "needs_clarification": false
  },
  "target_criterion_id": "write_overhead",
  "previous_questions": ["Explain database indexes."],
  "maximum_follow_ups": 1
}
```

### `FollowUpGenerationResponse`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `questions` | string[] | Yes | 1–3 nonblank questions. |
| `target_criterion_id` | string | Yes | Echoed target. |
| `rationale` | string | Yes | Nonblank, max 1,500; for audit, not lifecycle control. |

```json
{
  "questions": ["How does maintaining several indexes affect INSERT and UPDATE performance?"],
  "target_criterion_id": "write_overhead",
  "rationale": "Probes the missing index-maintenance trade-off without repeating the parent question."
}
```

### `InterviewReportRequest`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `interview_id` | UUID/null | No | P3 correlation only; P4 does not load/persist it. |
| `role` | string | Yes | Nonblank, max 200. |
| `interview_round` | string/null | No | Max 100. |
| `turns` | `InterviewTurnSummary[]` | Yes | 1–100; each contains question, answer, category, topic, validated evaluation. |
| `computed_overall_score` | float/null | No | 0–1; preferably computed by deterministic P3 logic. |

```json
{
  "interview_id": "11111111-1111-1111-1111-111111111111",
  "role": "Backend Engineer",
  "interview_round": "Technical",
  "turns": [{
    "question": "Explain authentication and authorization.",
    "answer": "Authentication verifies identity; authorization controls access.",
    "category": "technical",
    "topic": "Application security",
    "evaluation": {
      "criterion_results": [{
        "criterion_id": "identity_vs_access",
        "criterion_name": "Identity versus access",
        "status": "demonstrated",
        "score": 4,
        "maximum_score": 4,
        "evidence": "Authentication verifies identity; authorization controls access",
        "explanation": "Correct distinction.",
        "improvement_suggestions": []
      }],
      "overall_score": 1.0,
      "overall_feedback": "Correct.",
      "strengths": ["Clear distinction."],
      "weaknesses": [],
      "needs_clarification": false
    }
  }],
  "computed_overall_score": 1.0
}
```

### `InterviewReportResponse`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `overall_summary` | string | Yes | Nonblank, max 6,000. |
| `overall_score` | float/null | No | 0–1; must remain consistent with P3's computed value. |
| `topic_results` | map string → `TopicResult` | No | Questions, score, demonstrated/missing criteria. |
| `strengths` | string[] | No | Max 20. |
| `weaknesses` | string[] | No | Max 20. |
| `recommendations` | string[] | No | Max 20. |
| `evidence_highlights` | string[] | No | Max 30; must be grounded in supplied turns. |

```json
{
  "overall_summary": "The candidate demonstrated a clear security foundation and should add concrete implementation examples.",
  "overall_score": 1.0,
  "topic_results": {
    "Application security": {
      "questions_asked": 1,
      "average_score": 1.0,
      "demonstrated_criteria": ["identity_vs_access"],
      "missing_criteria": []
    }
  },
  "strengths": ["Correctly separates identity verification from permission checks."],
  "weaknesses": ["Examples were limited."],
  "recommendations": ["Practice explaining role-based access control with an API example."],
  "evidence_highlights": ["Authentication verifies identity; authorization controls access"]
}
```

## Independently callable P4 interfaces

Signatures illustrate the service boundary; they are not mandatory route names.

### `generate_interview_plan(request) -> InterviewPlanningResponse`

- **Purpose:** Ask Gemini for a duration-aware, categorized question proposal.
- **Input/output:** `InterviewPlanningRequest` / `InterviewPlanningResponse`.
- **Config:** `GEMINI_API_KEY`, `GEMINI_MODEL`.
- **Exceptions:** `ProviderNotConfigured`, `ProviderTimeout`, `ProviderRateLimited`, `ProviderUnavailable`, `StructuredOutputError`, `ProviderPolicyError`.
- **Dependency:** Google Gemini.
- **Boundary:** P3 validates curated IDs, attaches rubrics, selects/asks questions, and persists plan/session.

### `evaluate_answer(request) -> AnswerEvaluationResponse`

- **Purpose:** Criterion-level, evidence-grounded evaluation.
- **Input/output:** `AnswerEvaluationRequest` / `AnswerEvaluationResponse`.
- **Config/dependency:** Gemini variables / Google Gemini.
- **Exceptions:** Above plus `EvidenceValidationError` and `CriterionMismatchError`.
- **Boundary:** P4 never chooses `probe`, `clarify`, `select_question`, or `finish`; `needs_clarification` is evidence for P3.

### `generate_follow_up(request) -> FollowUpGenerationResponse`

- **Purpose:** Generate a nonrepetitive probe for a P3-selected criterion.
- **Config/dependency/exceptions:** Gemini; same output/transport errors.
- **Boundary:** P3 selects `target_criterion_id`, enforces follow-up limits, and decides whether to use returned text.

### `generate_interview_report(request) -> InterviewReportResponse`

- **Purpose:** Produce evidence-based narrative from already validated turn data.
- **Config/dependency/exceptions:** Gemini; same output/transport errors.
- **Boundary:** P3 aggregates deterministic scores, invokes the narrator, checks consistency, persists, and completes the interview.

### `generate_temporary_stt_credentials(request) -> STTCredentialsResponse`

- **Purpose:** Mint an ElevenLabs `realtime_scribe` single-use token; never return the API key.
- **Input:** `STTCredentialsRequest` (`scribe_v2_realtime`, audio format, `vad|manual`, optional language).
- **Output:** token, WebSocket URL, selected model/format/commit strategy, and nullable `expires_at` unless formally known.
- **Config:** `ELEVENLABS_API_KEY`.
- **Exceptions:** `ProviderNotConfigured`, `ProviderAuthenticationError`, `ProviderRateLimited`, `ProviderTimeout`, `ProviderUnavailable`.
- **Dependency:** ElevenLabs Tokens API/SDK.
- **Boundary:** The authenticated backend route rate-limits minting; frontend opens the WebSocket and handles transcript events.

### `generate_tts_audio(request) -> AsyncIterator[bytes]` plus `TTSAudioMetadata`

- **Purpose:** Stream server-authenticated ElevenLabs audio for question text.
- **Input:** `TTSAudioRequest` (text, optional approved voice/model, output format).
- **Output:** audio byte iterator and format metadata; for Simli choose raw `pcm_16000`.
- **Config:** `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`, `ELEVENLABS_TTS_OUTPUT_FORMAT`.
- **Exceptions:** provider configuration/auth/quota/rate/timeout/unavailable plus `UnsupportedAudioFormat`.
- **Dependency:** ElevenLabs TTS.
- **Boundary:** P3 supplies question text after ownership checks; frontend forwards compatible audio to Simli and must not play duplicate TTS audio separately.

### `initialize_simli_session(request) -> SimliSessionResponse`

- **Purpose:** Create a short-lived Simli Compose token for an externally supplied TTS stream.
- **Input:** `SimliSessionRequest` (approved face, silence and bounded session settings, `pcm16`).
- **Output:** temporary session token, LiveKit transport and exact audio contract.
- **Config:** `SIMLI_API_KEY`, `SIMLI_FACE_ID`.
- **Exceptions:** provider config/auth/timeout/rate/unavailable, `FaceNotAllowed`, `SessionLimitExceeded`, `InvalidSessionConfiguration`.
- **Dependency:** Simli `POST /compose/token`.
- **Boundary:** P4 mints only; frontend creates `SimliClient`, starts/cleans up WebRTC, and sends raw PCM after startup.

## Exception contract

A future implementation should expose stable local exceptions rather than leaking SDK-specific objects:

```python
class ProviderIntegrationError(Exception): ...
class ProviderNotConfigured(ProviderIntegrationError): ...
class ProviderAuthenticationError(ProviderIntegrationError): ...
class ProviderRateLimited(ProviderIntegrationError): ...
class ProviderTimeout(ProviderIntegrationError): ...
class ProviderUnavailable(ProviderIntegrationError): ...
class ProviderPolicyError(ProviderIntegrationError): ...
class StructuredOutputError(ProviderIntegrationError): ...
class ProviderResponseValidationError(StructuredOutputError): ...
class UnsupportedAudioFormat(ProviderIntegrationError): ...
```

Exceptions and logs must contain safe provider/model/status/correlation metadata, never secrets or signed temporary tokens. P3 maps these to HTTP behavior (typically 503/502/429 as agreed) and owns user-visible retry decisions.

## Integration flows

### Evaluation

1. P3 loads the asked turn and immutable rubric snapshot.
2. P3 constructs `AnswerEvaluationRequest` and calls P4.
3. P4 invokes Gemini with schema-constrained output.
4. P4 validates Pydantic shape, exact criterion set/max scores, and verbatim evidence.
5. P4 returns a DTO or typed exception.
6. P3 persists accepted data and runs the adaptive controller.

### Voice/avatar

1. Frontend requests an authenticated STT token route owned by P3/P4 integration.
2. Backend mints and returns only a temporary ElevenLabs token.
3. Browser streams microphone audio directly to ElevenLabs and submits final transcript to P3.
4. P3 asks P4 for TTS in `pcm_16000` when Simli will consume it.
5. Backend/Frontend transfers audio bytes; browser sends them to the active Simli Compose session.
6. Simli returns synchronized audio/video over WebRTC; browser renders it.

If TTS is MP3, WAV/containerized, Opus, μ-law, stereo, or a different sample rate, it must be decoded, downmixed, resampled, quantized to signed PCM16LE, and stripped of its container before Simli. Format labels alone must not be assumed equivalent.
