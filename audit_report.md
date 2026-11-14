# CareerPilot Hackathon Demo Readiness Report

**Date:** 2026-11-14  
**Scope:** Narrow LIVE Frontend Developer interview path  
**Evidence policy:** Automated, mocked, and live-provider evidence are reported separately. This report supersedes the earlier “all areas pass” audit; a complete authenticated browser LIVE interview has **not** been verified.

## Executive status

| Area | Status | Evidence |
|---|---|---|
| Recruiter dependency | PASS | `company_id` is optional. No synthetic recruiter was added. |
| Opening-question startup | PASS (automated) | Planner IDs are validated; invalid, empty, malformed, unavailable, or context-ineligible IDs use deterministic reviewed-bank fallback. |
| Opening-turn persistence | PASS (automated) | Duplicate startup is rejected and sequence uniqueness remains database-enforced. |
| Frontend demo question seed | READY, NOT APPLIED | Idempotent standalone seed defines 5 reviewed Frontend Developer questions, 5 rubrics, and 15 criteria. |
| Gemini provider | PASS (limited live check) | A raw call to `gemini-3-flash-preview` returned a real generation response. Full interview evaluation/report flow was not exercised against the live provider. |
| ElevenLabs STT token | PASS (limited live check) | The real single-use realtime Scribe token endpoint returned successfully without exposing the token. |
| Realtime STT browser flow | PASS (code/build/tests), NOT LIVE-VERIFIED | The browser protocol now uses current message fields, manual commit, and waits for a committed transcript before closing. No real microphone WebSocket session was completed. |
| ElevenLabs TTS | BLOCKED | The old model was unsupported. Supported models, including `eleven_multilingual_v2`, returned HTTP 402 `PAYMENT_REQUIRED` for the configured account. |
| Evaluation/report persistence | BLOCKED BY CONFIG | `SUPABASE_SERVICE_ROLE_KEY` is not configured. The API now returns 503 before answer/provider writes rather than leaving a partial answer. |
| Frontend build | PASS | Vite production build succeeds. |
| Complete LIVE browser E2E | NOT VERIFIED | Blocked by TTS account access, missing service-role configuration, unapplied demo seed, and lack of an authenticated microphone/browser run. |

## What was repaired

### Interview startup and question-bank integrity

- Accept valid planner question IDs only after checking the reviewed question row, matching rubric version, rubric criteria, and interview context.
- Fall back deterministically when planner output is empty, malformed, unavailable, invalid, or ineligible.
- Accept generic null-context reviewed questions while preferring exact company/role/round matches.
- Skip reviewed questions without usable rubrics.
- Return an actionable 503 when no eligible reviewed question with rubric exists.
- Reject duplicate opening-turn persistence.

### Adaptive interview lifecycle

- Resolve legacy nested follow-ups to their root main-question turn.
- Count probes and clarifications against the same per-main-question follow-up limit.
- Attach new probes and clarifications to the root main question.
- Create a fresh answerable clarification turn instead of returning the already-answered turn.
- Reuse the next-question lookup instead of querying it twice.
- Fail before persisting an answer or invoking Gemini if the backend-only service-role client is unavailable.
- Cover finish persistence and completed-report retrieval with network-free orchestration tests.

### LIVE voice UI and protocol

- Render voice controls in both DEMO and LIVE interviews.
- Pass the current turn ID to LIVE TTS for authenticated audio retrieval.
- Prevent auto-speak from replaying the same question whenever playback returns to idle.
- Use ElevenLabs realtime Scribe `scribe_v3_live`, `pcm_16000`, and manual commit.
- Send `{message_type, audio_base_64, commit, sample_rate}` wire fields.
- Parse server `message_type` events and surface provider error payloads.
- Stop microphone/audio processing, send a final empty committed chunk, wait for a committed transcript, then close resources, with a five-second safety timeout.
- Preserve DEMO-mode browser Web Speech behavior; LIVE never silently switches to DEMO.

## Demo data decision

A recruiter row is not required because interview creation accepts `company_id = null`. No fake recruiter or real-company attribution was added.

The standalone seed is:

- `database/seed_frontend_demo.sql`

It is intentionally not a migration. It is transactional and idempotent, reuses an existing `Frontend Development` skill by unique name, upserts stable question/rubric/criterion records, and aborts unless it finds exactly:

- 5 reviewed `Frontend Developer` / `Technical` questions
- 5 version-1 rubrics
- 15 criteria
- 3 criteria per rubric
- criterion weights totaling 1.00 per rubric

### Exact seed instructions

1. Open the target Supabase project.
2. Open **SQL Editor** and create a new query.
3. Copy the complete contents of `database/seed_frontend_demo.sql` into the editor.
4. Confirm the editor targets the intended judging project.
5. Run the query once. Re-running is safe because the seed uses `ON CONFLICT` upserts.
6. Treat any raised `Frontend demo seed integrity failed` exception as a blocker; the transaction rolls back.

The seed has **not** been executed from this environment because no authorized database SQL client or service-role configuration was available.

## Configuration required for judging

Set these only in `backend/.env` or the backend deployment environment:

```env
SUPABASE_SERVICE_ROLE_KEY=<backend-only service-role key>
GEMINI_MODEL=gemini-3-flash-preview
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

Also configure the existing backend-only provider keys. Never put Gemini, ElevenLabs, or Supabase service-role credentials in frontend variables.

`gemini-3-flash-preview` was verified by a direct live generation call. `eleven_multilingual_v2` is a supported TTS model, but the current ElevenLabs account returned `PAYMENT_REQUIRED`; changing the model alone does not remove that blocker.

Restart the backend after changing environment values.

## Exact local validation commands and results

Run from the repository root unless a command changes directory:

```powershell
cd backend
python -m pytest -q
```

Result: **63 passed**. The 272 warnings are Python 3.16 asyncio and Starlette/httpx deprecations; no test failed.

```powershell
npm --prefix frontend test
```

Result: **33 passed** across 3 test files.

```powershell
npm --prefix frontend run build
```

Result: **PASS**, 1667 modules transformed. Vite emitted only a non-blocking advisory that the main minified chunk exceeds 500 kB.

```powershell
cd backend
git diff --check
```

Result: no content whitespace errors. Git emitted only a line-ending notice for `frontend/src/components/ui/Badge.jsx` on Windows.

## Exact run commands

Backend, from the repository root:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Frontend, in a second terminal from the repository root:

```powershell
npm --prefix frontend run dev
```

## Manual LIVE acceptance test

Perform this only after applying the seed, configuring the service-role key, and resolving ElevenLabs TTS account access:

1. Sign in through the application in a supported desktop browser.
2. Create a **LIVE** interview with role `Frontend Developer`, round `Technical`, and no company selection.
3. Start the interview. Confirm one opening turn appears and refreshing/restarting cannot create a duplicate first turn.
4. Confirm the LIVE voice panel is visible.
5. Click **Hear Question**. Verify the authenticated turn-audio request returns `200` with `audio/mpeg` and that real ElevenLabs audio plays.
6. Click **Start Recording**, grant microphone access, and speak an answer.
7. Confirm the backend issues a single-use STT token and the browser connects to ElevenLabs realtime Scribe without exposing the permanent API key.
8. Click **Stop Recording**. Confirm the final committed transcript appears and can populate the answer field.
9. Submit the answer. Confirm the answer, Gemini evaluation, criterion results, and skill evidence persist.
10. Confirm the returned action either creates a fresh clarification/probe turn attached to the root question, selects the next seeded main question, or finishes.
11. Continue at least one adaptive turn, then finish the interview.
12. Retrieve the report and confirm the completed report survives a page reload.

## Files changed for the judging-critical repair

- `backend/.env.example`
- `backend/app/core/adaptive.py`
- `backend/app/core/config.py`
- `backend/app/routers/interviews.py`
- `backend/tests/test_adaptive.py`
- `backend/tests/test_interview_orchestration.py` (new)
- `backend/tests/test_interview_startup.py` (new)
- `database/seed_frontend_demo.sql` (new)
- `frontend/src/components/VoiceControls.jsx` (new)
- `frontend/src/components/ui/Badge.jsx`
- `frontend/src/hooks/useVoiceInterview.js` (new)
- `frontend/src/hooks/useVoiceInterview.test.js` (new)
- `frontend/src/pages/InterviewRoom.jsx`
- `audit_report.md`

A non-secret local setting in ignored `backend/.env` was also changed to `ELEVENLABS_MODEL_ID=eleven_multilingual_v2`; no credential value was copied into this report.

Earlier uncommitted provider/service integration files remain preserved, including `backend/app/services/elevenlabs_provider.py`, `backend/app/services/gemini_provider.py`, `backend/app/services/interview_ai.py`, and their tests. No commit, push, merge, reset, stash, clean, migration rerun, or database write was performed.

## Final judging blockers

1. **ElevenLabs TTS account access/credits:** supported TTS calls return HTTP 402 `PAYMENT_REQUIRED`.
2. **Missing backend service-role configuration:** answer evaluation evidence and report persistence cannot complete without `SUPABASE_SERVICE_ROLE_KEY`.
3. **Demo seed not applied:** the five Frontend Developer question records are ready but not present in the deployed database until the SQL is run.
4. **No real authenticated browser E2E:** microphone STT, audio playback, evaluation, adaptive progression, finish, and report retrieval have not been exercised together.

**Conclusion:** the local code, deterministic orchestration, frontend tests, and production build are ready for the narrow judging path. The complete LIVE interview must not be described as working end-to-end until the four blockers above are resolved and the manual acceptance test passes.
