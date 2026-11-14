# P1 Interview Integration Audit

**Audit date:** 2026-11-14  
**Branch:** `frontend/p1-ui`  
**Scope:** Read-only audit and implementation plan. No application source code was changed.

## Executive summary

The P3 interview router, P3 schemas, adaptive controller boundary, and FastAPI registration now exist in the working tree. This is not yet a live frontend/backend integration:

- The frontend `interviewService.js` is still hard-wired to its mock adapter (`INTERVIEW_API_AVAILABLE = false`), including for authenticated sessions.
- The current `InterviewRoom` only loads and dumps interview JSON. It does not start an interview, obtain STT credentials, submit answers, stream TTS, finish an interview, or handle `next_action`.
- `InterviewReport.jsx` and the report route do not exist.
- Database migrations 006, 007, and 008 are absent; only migrations 001–005 are present.
- P4 has not supplied a concrete `InterviewAIService`; the backend dependency always returns `UnconfiguredInterviewAIService`, so planning, evaluation, follow-up, TTS, STT, and report generation return 503.

**Readiness verdict:** frontend work can proceed against the verified schemas and mocked adapters, but production integration is **blocked** until P2 migrations/seed data and a configured P4 service are available. P3 must also verify the registered router against a real Supabase-backed staging environment rather than treating route registration as endpoint readiness.

## 1. Existing implementation

### Frontend

| Area | Current implementation | Status |
|---|---|---|
| API client | [frontend/src/services/api.js](../frontend/src/services/api.js) forwards `Authorization: Bearer <accessToken>`, JSON bodies, and `signal`; parses `{detail}` errors. | Usable for JSON APIs. It is not suitable for streaming audio because it always calls `response.json()`. |
| Authentication | [frontend/src/context/AuthContext.jsx](../frontend/src/context/AuthContext.jsx) stores the Supabase session and access token, loads the profile through `GET /api/me/profile`, and exposes `session`, `isConfigured`, and `isDemoMode`. | Implemented. |
| Protected routes | [frontend/src/App.jsx](../frontend/src/App.jsx) protects the dashboard route group and mounts `/interview/setup` and `/interview/:interviewId` through `DashboardLayout`. | Implemented, but the documented frontend flow describes the room as full-screen rather than dashboard-shell content. Resolve this design mismatch before final room UI work. |
| Interview setup | [frontend/src/pages/InterviewSetup.jsx](../frontend/src/pages/InterviewSetup.jsx) loads recruiters in authenticated/configured mode, validates duration, maps company UUIDs, accepts optional role/round/JD, validates PDF type and 5 MB size, and navigates to `/interview/{id}`. | UI implemented. Creation is still mock-only through the service. Resume files are not uploaded. |
| Interview service | [frontend/src/services/interviewService.js](../frontend/src/services/interviewService.js) has a correctly shaped `InterviewCreate` payload and real `POST /api/interviews` adapter, but the exported `createInterview` always chooses the mock adapter because `INTERVIEW_API_AVAILABLE` is `false`. | Main integration blocker. |
| Mock isolation | [frontend/src/pages/InterviewRoom.jsx](../frontend/src/pages/InterviewRoom.jsx) detects IDs beginning with `mock-` and does not call the backend for them. | Correct for demo IDs. Authenticated users currently also receive mock IDs because creation is globally mocked. |
| Interview room | [frontend/src/pages/InterviewRoom.jsx](../frontend/src/pages/InterviewRoom.jsx) fetches `GET /api/interviews/{id}` for non-mock IDs and renders JSON/error/loading states. | Placeholder only; no lifecycle or voice behavior. |
| Dashboard | [frontend/src/pages/Dashboard.jsx](../frontend/src/pages/Dashboard.jsx) contains a React Router CTA to `/interview/setup`. | Existing entry point; unrelated dashboard data remains demo data. |
| Report | No `frontend/src/pages/InterviewReport.jsx` exists and no report route is registered. | Missing. |
| Reusable components | Existing UI primitives include `Card`, `Badge`, `ProgressBar`, `EmptyState`, `SearchInput`, and `Avatar`. No interview-specific or report-specific component directory exists yet. | Reuse primitives; add focused components as needed. |

### Backend

| Area | Current implementation | Status |
|---|---|---|
| Router | [backend/app/routers/interviews.py](../backend/app/routers/interviews.py) defines the interview lifecycle, skills, skill states, and STT token routes. | Route code exists. Runtime dependency readiness is incomplete. |
| Registration | [backend/app/main.py](../backend/app/main.py) includes the interview, skills, skill-state, and voice routers under `/api`. | Registered; this alone does not prove persistence or provider calls work. |
| Authentication | [backend/app/core/security.py](../backend/app/core/security.py) requires a Bearer token and verifies it through Supabase `/auth/v1/user`; the verified Supabase user ID is used for ownership. | Matches the documented security model. |
| Persistence boundary | [backend/app/services/supabase.py](../backend/app/services/supabase.py) forwards the request-scoped user token for normal reads and uses a service-role dependency for server-owned writes. | Correct boundary, but interview tables/migrations are absent in this checkout. |
| Adaptive controller | [backend/app/core/adaptive.py](../backend/app/core/adaptive.py) returns only `probe`, `select_question`, `clarify`, or `finish`, and does not persist or call providers. | Correct P3/P4 boundary. |
| AI boundary | [backend/app/services/interview_ai.py](../backend/app/services/interview_ai.py) defines the required protocol, but `get_interview_ai_service()` always returns `UnconfiguredInterviewAIService`. | No concrete P4 implementation is present. |
| Tests | Backend tests cover health, auth, profiles, intelligence, CORS, and adaptive logic. There are no interview router integration tests in `backend/tests`. | Interview endpoint behavior is not covered by the existing suite. |

The requested `docs/frontend-audit.md` file does not exist in this working tree, so it could not be used as evidence. The audit above is based on the four planning documents and the actual source files.

## 2. Verified API contracts

The source implementation was compared with [docs/api-contract.md](api-contract.md), not only with the route list.

### Authentication and common client behavior

- `apiRequest()` adds `Authorization` only when an access token is supplied ([frontend/src/services/api.js:12-24](../frontend/src/services/api.js#L12-L24)).
- `AuthContext` obtains the token from the Supabase session and passes it to profile requests ([frontend/src/context/AuthContext.jsx:50-58](../frontend/src/context/AuthContext.jsx#L50-L58)). Interview pages read the same `session.access_token`.
- Backend authentication verifies the token remotely and uses the returned Supabase user ID ([backend/app/core/security.py:35-98](../backend/app/core/security.py#L35-L98)). This matches the token-forwarding model in the contract.
- Demo mode is enabled when Supabase is not configured. `ProtectedRoute` allows the UI to render in demo mode, and setup skips live recruiter loading. Mock interview IDs are protected from the room's real fetch by the `mock-` guard.

### Endpoint comparison

| Contract endpoint | Backend source | Auth | Source-level result | Frontend status |
|---|---|---|---|---|
| `POST /api/interviews` | `interviews.py:382-409` | `get_current_user` | Returns 201, validates optional `company_id`, adds verified `candidate_id`, and returns `InterviewResponse`. | Real adapter exists but is never selected; setup currently uses mock creation. |
| `GET /api/interviews` | `interviews.py:412-433` | `get_current_user` | Filters by verified candidate ID and supports `status`, `limit`, and `offset`. | No frontend consumer. |
| `GET /api/interviews/{id}` | `interviews.py:435-466` | `get_current_user` | Ownership checked; returns detail, company, current turn, and counters. | Room calls it for non-mock IDs, then only renders JSON. |
| `POST /api/interviews/{id}/start` | `interviews.py:469-529` | `get_current_user` | Checks `planned`, calls `plan_interview`, creates the first turn, and transitions to `active`. | Not called. It will return 503 until a concrete AI service and question bank are available. |
| `GET /api/interviews/{id}/turns/{turn_id}` | `interviews.py:532-550` | `get_current_user` | Returns turn, persisted answer, and evaluation when available. | Not called. |
| `POST /api/interviews/{id}/turns/{turn_id}/answer` | `interviews.py:553-690` | User token plus service-role writes | Persists/idempotently reuses the answer, calls evaluation, invokes the adaptive controller, and returns `evaluation`, `next_action`, `next_turn`, and top-level `tts_audio_url`. | Not called. |
| `GET /api/interviews/{id}/turns/{turn_id}/audio` | `interviews.py:693-714` | `get_current_user` | Streams `audio/mpeg` from `ai.stream_tts()`. | No consumer; `apiRequest()` cannot consume this response because it assumes JSON. |
| `POST /api/interviews/{id}/finish` | `interviews.py:717-820` | User token plus service-role writes | Generates/persists a report and marks the interview completed. | Not called. |
| `GET /api/interviews/{id}/report` | `interviews.py:877-902` | `get_current_user` | Requires `completed`, then returns `InterviewReportResponse`. | No page or route. |
| `GET /api/skills` | `interviews.py:822-831` | `get_current_user` | Reads skills. | No consumer. |
| `GET /api/me/skill-states` | `interviews.py:834-862` | `get_current_user` | Reads candidate-owned skill states. | No consumer; dashboard remains demo data. |
| `GET /api/stt/token` | `interviews.py:865-874` | `get_current_user` | Validates the AI service token response. | Not called; returns 503 with the current fallback service. |

### Schema alignment and mismatches

The actual Pydantic models in [backend/app/schemas/interview.py](../backend/app/schemas/interview.py) align with the main request/response definitions in `api-contract.md`:

- `InterviewCreate` has exactly the documented fields and only `duration_minutes` is required ([interview.py:23-33](../backend/app/schemas/interview.py#L23-L33)).
- `InterviewResponse`, `InterviewDetailResponse`, `InterviewStartResponse`, `AnswerResponse`, `InterviewReportResponse`, and `STTTokenResponse` are present ([interview.py:36-168](../backend/app/schemas/interview.py#L36-L168)).
- `NextAction` is constrained to `probe`, `select_question`, `clarify`, or `finish` ([interview.py:12-20](../backend/app/schemas/interview.py#L12-L20)). The frontend must render this value and must not compute or replace it.
- `AnswerSubmit` uses `transcript_text` with minimum length 1 and optional `audio_duration_seconds` ([interview.py:70-77](../backend/app/schemas/interview.py#L70-L77)). The planning contract describes the duration as a positive integer, while the implementation permits zero (`ge=0`). P3 should either tighten the schema or update the contract.
- `InterviewStartResponse.tts_audio_url` and `AnswerResponse.tts_audio_url` are nullable in the implementation. The examples in `api-contract.md` show a path, but the frontend must handle `null` with a text-only/audio-unavailable state.
- The API contract puts `tts_audio_url` at the top level of `AnswerResponse`; `TurnResponse` does not contain it. A snippet in `frontend-flow.md` refers to `next_turn.tts_audio_url`, which is inconsistent with the API schema. P1 should use the top-level field.
- `finish_interview()` accepts `finalizing` in addition to `active` and `paused` ([interviews.py:725-727](../backend/app/routers/interviews.py#L725-L727)); the documented error contract says finish is valid for active/paused. P3 should document or narrow this behavior.
- `GET /api/interviews` returns plain `InterviewResponse` objects. `frontend-flow.md` history metadata says each item includes a nested `company` object, but the backend list response does not add one. P3 and P1 need an explicit choice: enrich the list response and schema, or make history fetch/display company data separately.
- The frontend contract correctly allows `resume_url: null`, but the current upload control never produces a URL. This is a storage integration gap, not a request-schema problem.

## 3. Missing frontend functionality

### Interview creation integration

Required changes:

1. Replace the global `INTERVIEW_API_AVAILABLE = false` behavior in [frontend/src/services/interviewService.js](../frontend/src/services/interviewService.js). In authenticated/configured mode, call the real `POST /api/interviews` adapter and forward `session.access_token`. Keep the mock adapter only for demo mode or an explicitly documented local mock mode.
2. Make `isInterviewCreationMocked()` reflect the same runtime decision as `createInterview()` so the banner does not claim mock mode for an authenticated live request.
3. Keep the existing payload mapping. `company_id` is already taken from the recruiter UUID, role and round are optional strings, duration is numeric, and empty optional values become `null` as required by `InterviewCreate`.
4. Preserve successful navigation to `/interview/{id}`. The backend response ID is a UUID; only IDs explicitly produced by the mock adapter may use the `mock-` prefix.
5. Keep resume behavior honest. Until P2 confirms a storage bucket and upload contract, pass `resume_url: null` and label the selected file as not uploaded. Do not send a browser `File` in the JSON request.

### Interview room

[frontend/src/pages/InterviewRoom.jsx](../frontend/src/pages/InterviewRoom.jsx) needs a backend-authoritative UI state machine:

1. Load `GET /api/interviews/{id}` and branch on backend `status`.
2. For `planned`, show a waiting state and call `POST /api/interviews/{id}/start` only after the user clicks Start.
3. Store the returned `first_turn` and optional top-level `tts_audio_url`. Play audio only if a URL is returned; otherwise show the question text and text-input fallback.
4. For `active` or `paused`, resume from `current_turn` returned by the backend. Do not infer the next question or status in React.
5. Request `GET /api/stt/token` per turn when voice capture is enabled; connect the browser WebSocket with the short-lived token; display partial and final transcript state; submit exactly one final transcript.
6. Submit `POST /api/interviews/{id}/turns/{turn_id}/answer` with only the documented `AnswerSubmit` fields.
7. Render the returned evaluation and branch only on the returned `next_action`:
   - `probe`: render `next_turn` as a follow-up (`is_follow_up: true`).
   - `select_question`: render `next_turn` as a new main question (`is_follow_up: false`).
   - `clarify`: keep/re-ask the current turn; do not choose a clarification question locally.
   - `finish`: call or transition into the finish/report flow; there is no `next_turn`.
8. Fetch/play top-level `tts_audio_url` when present. Since the response is an audio stream, add a streaming helper rather than routing it through JSON-only `apiRequest()`.
9. Provide retry, cancellation, cleanup, text fallback, and duplicate-submit protection. Abort or ignore stale requests when the route changes and close WebSockets on unmount.
10. Keep the existing mock-ID guard. Demo mode must never call `GET`, `POST`, audio, or STT endpoints with a fake ID.

### Interview report

Create a new [frontend/src/pages/InterviewReport.jsx](../frontend/src/pages/InterviewReport.jsx) and register `/interview/:interviewId/report` in [frontend/src/App.jsx](../frontend/src/App.jsx).

The page should:

- Load `GET /api/interviews/{id}/report` for completed interviews.
- Show a generating/polling state for `409` while `GET /api/interviews/{id}` reports `finalizing`, using the documented 3-second interval until P3 confirms another mechanism.
- Render `overall_summary`, `overall_score`, `topic_results`, `strengths`, `weaknesses`, and `recommendations` without changing backend semantics.
- Include links to `/interview/setup` and `/dashboard`.
- Handle 401, 403, 404, and 409 without claiming a report exists.

No report-specific component exists today. The existing `Card`, `Badge`, and `ProgressBar` primitives can be reused; `CriterionResultRow` is not currently available and would need to be created only if the detailed turn breakdown is added.

### History and dashboard data

These are not required to make Setup → Room work, but the documented product flow also lacks:

- `InterviewHistory.jsx` and `/interview/history`.
- A live dashboard call to `GET /api/interviews` or `GET /api/me/skill-states`.

The dashboard CTA already exists and can remain as-is. Do not block the core interview integration on dashboard data replacement.

## 4. Exact files requiring changes

### P1 frontend changes

| File | Planned change | Dependency |
|---|---|---|
| `frontend/src/services/interviewService.js` | Select real creation for authenticated mode; add wrappers for get/start/turn/answer/finish/report/STT and normalize mock gating. | P3 API deployed; P2 tables for live behavior. |
| `frontend/src/services/api.js` | Add a separate authenticated binary/stream helper, or equivalent response-mode option, for TTS audio. Preserve current JSON behavior for existing consumers. | P4 TTS response available. |
| `frontend/src/pages/InterviewSetup.jsx` | Pass the live session to the real adapter, update mock banner semantics, retain contract validation and honest resume behavior. | P3 creation endpoint; P2 storage for real resume URLs. |
| `frontend/src/pages/InterviewRoom.jsx` | Replace JSON placeholder with backend-driven lifecycle UI, STT/TTS integration points, answer submission, `next_action` rendering, finish handling, retries, and cleanup. | P3 routes/state; P4 STT/TTS/evaluation. |
| `frontend/src/pages/InterviewReport.jsx` | New report page with loading, 409 polling, report rendering, and navigation actions. | P3 report endpoint; P4 report generation. |
| `frontend/src/App.jsx` | Register `/interview/:interviewId/report`; decide whether the room should remain inside `DashboardLayout` or follow `frontend-flow.md`'s full-screen room rule. | Design decision; report page. |
| `frontend/src/components/interview/*` | Optional focused components for room top bar, transcript, microphone control, and avatar/audio fallback. | P1-owned; exact split can follow implementation. |
| `frontend/src/components/report/*` | Optional topic/criterion result components if report detail requires them. | P1-owned. |

### Backend/P2/P3/P4 files requiring follow-up, not P1 edits

| File/area | Required follow-up |
|---|---|
| `database/migrations/006_create_question_bank.sql` | Add and apply skills, question bank, rubrics, criteria, RLS, indexes, and reviewed seed prerequisites. Missing in this checkout. |
| `database/migrations/007_create_interview_session_tables.sql` | Add and apply interview/session/answer/evaluation/skill/report tables, RLS, indexes, and triggers. Missing in this checkout. |
| `database/migrations/008_seed_question_bank.sql` | Add reviewed questions/rubrics and stable seed IDs. Missing in this checkout. |
| `backend/app/services/interview_ai.py` and provider services | Register a concrete P4 implementation for all six protocol methods. Current dependency always returns the unconfigured fallback. |
| `backend/requirements.txt` | Add provider dependencies only when P4's implementation is ready; currently it contains no Gemini, ElevenLabs, or Simli SDK. |
| `backend/app/routers/interviews.py` / `backend/app/schemas/interview.py` | Resolve the documented mismatches for zero audio duration, `finalizing` finish behavior, list-company shape, and nullable audio URL. Add interview endpoint tests. |

## 5. P2/P3/P4 dependencies

### P1 can proceed now

- Build the room UI state machine against the verified Pydantic response shapes using mocked JSON fixtures.
- Add service wrappers and unit tests that assert exact paths, methods, headers, and request bodies.
- Add report page and route using mocked `InterviewReportResponse` data.
- Add text-input fallback and loading/error/retry states without provider integration.
- Add audio-stream response handling behind a provider-independent interface.
- Keep demo-mode fixtures and mock IDs isolated from real API calls.

### Requires P2

- Live `POST /api/interviews` persistence against the `interviews` table.
- Live room turns, answer/evaluation persistence, report reads, and skill-state updates.
- Valid reviewed question/rubric data for `POST /start` and subsequent question selection.
- Resume upload URL generation, if the team chooses Supabase Storage for the current flow.
- Confirmation that RLS policies and service-role writes are applied in the target environment.

### Requires P3

- Staging deployment and verification of all interview routes against real Supabase data.
- Confirmation that the router's ownership and status transitions match the API contract.
- Final decisions for the list response's nested company data, nullable audio URLs, zero-duration validation, and `finalizing` finish behavior.
- Integration of the concrete P4 service dependency into the router.
- Endpoint-level tests for creation, ownership, planned/active transitions, duplicate answers, report polling, and error mappings.

### Requires P4

- `plan_interview` for `/start`.
- `evaluate_answer` for answer submission.
- `generate_followup` for `probe`.
- `generate_report` for finish/report generation.
- `stream_tts` for audio streaming.
- `create_stt_token` for browser voice capture.
- Final TTS codec/sample-rate/chunk contract and Simli session behavior.

## 6. Recommended implementation sequence

1. **Resolve contract decisions with P3/P4.** Confirm top-level `tts_audio_url`, nullable audio behavior, `audio_duration_seconds` zero handling, finish idempotency/status behavior, list-company shape, and the room layout choice.
2. **Finish P2 database prerequisites.** Apply migrations 006–008, confirm RLS, seed reviewed questions/rubrics, and verify PostgREST responses with a real authenticated user.
3. **Finish P4 service registration.** Replace `UnconfiguredInterviewAIService` only after each provider method has a concrete failure mapping and test double. Keep provider keys server-side.
4. **Update the P1 service layer.** Use real creation for authenticated mode, preserve demo mocks, add JSON endpoint wrappers, and add an audio-stream helper. Add unit tests for payloads and endpoint paths.
5. **Implement the room in slices.** First load/start/planned state; then current-turn rendering; then transcript submission; then returned `next_action`; then finish/report navigation; finally STT/TTS/Simli enhancements.
6. **Implement the report route/page.** Add 409 polling and all report response sections before connecting the finish CTA.
7. **Run integration tests against staging.** Test Setup → Room → Start → Answer → probe/select_question/clarify → Finish → Report, refresh recovery, duplicate submission, ownership failures, 401/403/404/409/503, and demo-mode isolation.
8. **Only after live verification, remove the authenticated mock fallback.** Demo mode should remain available, but the authenticated path must not silently produce fake IDs.

## 7. Risks and unresolved contract mismatches

1. **Registered does not mean operational.** All interview routes are registered, but missing database tables and the unconfigured AI dependency prevent a complete live flow.
2. **Authenticated users currently receive fake IDs.** `INTERVIEW_API_AVAILABLE = false` is global, so the current setup cannot exercise P3 even when Supabase authentication is configured. This is the highest frontend integration risk.
3. **Audio cannot use `apiRequest()` as written.** JSON parsing will fail on `audio/mpeg`; a separate streaming response path is mandatory.
4. **Resume upload is unresolved.** The UI validates a local PDF but intentionally sends `resume_url: null`; no storage endpoint or signed-upload flow is defined in the inspected source.
5. **Provider failures are expected today.** Start, answer evaluation, follow-up, finish report generation, TTS, and STT token retrieval all depend on the unconfigured AI service and return 503.
6. **Frontend documentation and API response shape disagree.** `frontend-flow.md` places TTS URL under `next_turn`, while the API schema places it on `AnswerResponse`; the frontend must follow the actual schema or P3 must update it.
7. **History company data is ambiguous.** The list endpoint's declared response does not include the nested `company` object described by the frontend history flow.
8. **Finish status behavior differs.** The backend accepts `finalizing` even though the documented finish contract lists active/paused. This affects retry and report polling semantics.
9. **No interview router tests exist.** Existing backend tests do not establish that the interview endpoints work against mocked Supabase and AI dependencies.
10. **Room layout is inconsistent across documents and code.** `frontend-flow.md` specifies a full-screen immersive room, while the current route renders it inside `DashboardLayout`. This should be settled before substantial UI work to avoid rework.
11. **Production configuration remains required.** The frontend needs `VITE_API_URL` configured for the deployed backend, and the backend needs Supabase, service-role, CORS, and provider settings. Missing configuration must surface as an explicit unavailable state, not a silent mock in authenticated mode.

## Verification performed

- Read: `docs/architecture.md`, `docs/database-schema.md`, `docs/api-contract.md`, and `docs/frontend-flow.md`.
- Attempted to read `docs/frontend-audit.md`; it is not present in the working tree.
- Inspected frontend API/auth/router/setup/room/dashboard/layout/service files and reusable components.
- Inspected backend router, schemas, adaptive controller, AI boundary, authentication, Supabase service, main registration, requirements, and existing tests.
- Confirmed only migrations `001_create_profiles.sql` through `005_seed_initial_data.sql` exist.
- No application source code was modified by this audit; the only intended deliverable is this document.
