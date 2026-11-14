# CareerPilot Database — Team Coordination Questions

> **Phase 1 — P2 (Database Developer)**
> **Branch:** `database/p2-schema`
> **Purpose:** Coordinate pending decisions before finalizing the database design for migrations 006-008.
> **Status:** Pending team responses — do not create SQL migrations until blocking items are resolved.

---

## How to Use This Document

- Each question has a **"Why it matters for database design"** column explaining the impact on migration schema.
- Each question has a **"Response / Status"** column — fill in with team answers as they become available.
- Items marked **BLOCKING** must be resolved before P2 can create migration 006/007.
- Items marked **POSTPONE** can be addressed after initial schema creation.

---

## Section A — Questions for P3 (Backend Orchestration)

| # | Question | Why it matters for database design | Blocking? | Response / Status |
|---|----------|-----------------------------------|-----------|-------------------|
| A1 | Should `interviews.role` be FK to `roles.id` or remain TEXT? | If FK: migration 007 needs `recruiter_id`-style FK constraint + `ON DELETE SET NULL`. If TEXT: simpler schema but no referential integrity. | BLOCKING | |
| A2 | Should `interviews.round` be FK to a lookup table or remain TEXT? | If FK: new `interview_rounds` table needed + FK constraint. If TEXT: simpler but less validation. | POSTPONE | |
| A3 | Will P3 add a separate Supabase service role client for admin writes (question_bank, evaluations, reports)? | Determines RLS policy design: service role writes need `USING (true)` policies; authenticated user writes need ownership policies. | BLOCKING | |
| A4 | How will `interview_turns.rubric_snapshot` be populated at turn creation? | If P3 reads from `question_rubrics` at turn creation: needs read access to question_rubrics (service role or reviewed-only policy). If P3 snapshots at question_bank creation: rubric_id and version must be available. | BLOCKING | |
| A5 | How will follow-up questions be connected to interview turns? | Schema already documents `parent_turn_id` FK (self-reference on interview_turns) and `is_follow_up` boolean. Need confirmation this is sufficient or if additional columns needed. | POSTPONE | |
| A6 | Will `interviews.started_at` / `ended_at` be updated by triggers or application code? | Determines whether migration 007 needs trigger functions for timestamps or if P3 handles in FastAPI app. | POSTPONE | |
| A7 | Does P3 need `interview_turns.target_criterion_id` to reference `rubric_criteria.criterion_id`, or is free TEXT sufficient? | If FK: migration needs constraint to rubric_criteria. If TEXT: simpler but no integrity check. | POSTPONE | |

---

## Section B — Questions for P4 (AI and Integrations)

| # | Question | Why it matters for database design | Blocking? | Response / Status |
|---|----------|-----------------------------------|-----------|-------------------|
| B1 | Who will provide the 21 curated questions and rubric content? | Migration 008 needs stable UUIDs, question_text, rubric content, and criteria. P4 must supply before P2 can write migration 008. | BLOCKING | |
| B2 | Is the `expected_concepts` JSONB structure finalized? (`{critical: [], required: [], optional: []}`) | Determines `question_rubrics.expected_concepts` column type (JSONB NOT NULL) and any CHECK constraint on structure. | BLOCKING | |
| B3 | Must criterion weights sum to 1.0 per rubric? | If yes: application-level validation needed (P3/P4 side), NOT a database CHECK constraint (hard to enforce per-group in SQL). Affects `rubric_criteria.weight` column design only minimally. | POSTPONE | |
| B4 | What exact JSON structure will Gemini return for evaluations? | Determines `evaluations.raw_response` JSONB schema flexibility — needs to accommodate whatever Gemini returns without tight column constraints. | POSTPONE | |
| B5 | What information is required for skill evidence and final reports? | Determines `candidate_skill_states` columns and `interview_reports.topic_results` JSONB structure. Need to confirm all fields P4 expects are present. | BLOCKING | |
| B6 | What fields does P4 need from `rubric_criteria` for follow-up generation? | If P4 needs `accepted_alternatives` or `common_misconceptions` for follow-up prompts, those JSONB columns must exist with proper nullable settings. | POSTPONE | |

---

## Section C — Cross-Team Questions

| # | Question | Why it matters for database design | Blocking? | Response / Status |
|---|----------|-----------------------------------|-----------|-------------------|
| C1 | Is the Supabase service role key configured in the backend environment? | Required for writes to `question_bank`, `question_rubrics`, `rubric_criteria`, `evaluations`, `candidate_skill_states`, `interview_reports`. Without it, RLS policies must allow authenticated writes (security concern). | BLOCKING | |
| C2 | Is a Supabase Storage bucket required for resume uploads? | `interviews.resume_url` is a TEXT column storing a path. If Supabase Storage: P2 creates bucket + RLS policies. If external: just a URL string column. | POSTPONE | |
| C3 | What are the agreed database and API naming conventions? | Confirms: tables snake_case plural, columns snake_case, PK `id`, FK `{singular_table}_id`, TIMESTAMPTZ timestamps, TEXT enums with CHECK. Already documented but needs team sign-off. | POSTPONE | |
| C4 | Who creates and applies migrations 006-008? | P2 owns migrations but needs P4 content for 008. Need agreement on workflow: P2 writes schema, P4 provides seed data, who runs against Supabase? | POSTPONE | |
| C5 | Should `profiles.cgpa` NUMERIC(4,2) migration (003) be verified against existing Supabase data? | Migration 003 ALTERed column from NUMERIC(3,2) to NUMERIC(4,2). Need to confirm no data loss occurred before building new tables on top. | POSTPONE | |

---

## Summary: Blocking vs Postponable Decisions

### BLOCKING — Must be resolved before P2 creates migration 006/007

| ID | Question | Team | Consequence if unresolved |
|----|----------|------|---------------------------|
| A1 | `interviews.role` FK vs TEXT | P3 | Can't finalize `interviews` table schema |
| A3 | Service role client for admin writes | P3 | Can't design RLS policies for question_bank/evaluations/reports |
| A4 | `rubric_snapshot` population mechanism | P3 | Can't confirm `interview_turns` dependencies |
| B1 | Question bank content provider | P4 | Can't create migration 008 seed data |
| B2 | `expected_concepts` JSONB structure | P4 | Can't finalize `question_rubrics` column schema |
| C1 | Supabase service role key configured | Cross-team | Can't write RLS policies for MVP tables |

### POSTPONE — Can be addressed after initial schema creation

| ID | Question | Team | Reason |
|----|----------|------|--------|
| A2 | `interviews.round` FK vs TEXT | P3 | Can default to TEXT, add FK later via ALTER TABLE |
| A5 | Follow-up connection mechanism | P3 | Schema already documents `parent_turn_id` self-FK |
| A6 | `started_at`/`ended_at` triggers | P3 | Application code can handle timestamps initially |
| A7 | `target_criterion_id` FK vs TEXT | P3 | Can default to TEXT, add FK later |
| B3 | Criterion weights sum to 1.0 | P4 | App-level validation, not DB constraint |
| B4 | Gemini evaluation JSON structure | P4 | `raw_response` is flexible JSONB |
| B5 | Skill evidence fields needed | P4 | Schema documents core fields; extra fields can be added |
| B6 | Follow-up data needs from rubric_criteria | P4 | JSONB columns already flexible |
| C2 | Resume Storage bucket | Cross-team | `resume_url` TEXT works with external URLs |
| C3 | Naming conventions | Cross-team | Already documented; team can sign off asynchronously |
| C4 | Migration workflow owner | Cross-team | P2 can draft migrations now; apply later |
| C5 | `cgpa` migration verification | Cross-team | Already migrated in 003; non-blocking for new tables |

---

## Recommended Next Steps

1. **Share this document** with P3, P4, and P1 for their responses.
2. **Collect answers to BLOCKING items** (A1, A3, A4, B1, B2, C1).
3. **Once blocking items resolved**, P2 can draft migrations 006 and 007.
4. **Coordinate with P4** on migration 008 content (stable UUIDs, rubric content).
5. **Revisit POSTPONE items** after MVP schema is in place.

---

*File location: `database/database-team-questions.md`*
*Branch: `database/p2-schema`*