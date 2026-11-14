# CareerPilot Database Requirements Analysis

> **Phase 1, Task 2 — Comprehensive cross-check of documentation against actual migrations, identifying reusable tables, proposed new tables, inconsistencies, and decisions requiring team confirmation.**

---

## 1. Executive Summary

| Aspect | Status |
|--------|--------|
| **Branch** | `database/p2-schema` (local only, push failed - 403) |
| **Existing Migration Files** | 5 (001-005) — all applied to Supabase |
| **Documented Migration Files** | 8 (001-008) — 006, 007, 008 **do not exist** |
| **Existing Tables in Supabase** | 5 (`profiles`, `recruiters`, `roles`, `interview_experiences`, `interview_questions`) |
| **Proposed MVP Tables** | 11 (`skills`, `question_bank`, `question_rubrics`, `rubric_criteria`, `interviews`, `interview_turns`, `answers`, `evaluations`, `evaluation_criterion_results`, `candidate_skill_states`, `interview_reports`) |
| **RLS Status** | All existing tables have RLS enabled and policies applied |
| **Documentation Drift** | Medium — `docs/database-schema.md` documents tables that don't exist in migrations |

---

## 2. Existing Database Overview (Verified from SQL Migrations)

### 2.1 Tables Confirmed in Supabase (Migrations 001-005)

| Table | Migration | RLS | Indexes | Seed Data |
|-------|-----------|-----|---------|-----------|
| `profiles` | 001, 002, 003 | ✅ Owner-only | `idx_profiles_user_id` | Auto-provisioned |
| `recruiters` | 004, 005 | ✅ Read-only (auth) | `idx_recruiters_name`, `idx_recruiters_verification` | 3 records (TCS, Infosys, Wipro) |
| `roles` | 004 | ✅ Read-only (auth) | `idx_roles_recruiter_id`, `idx_roles_job_type`, `idx_roles_verification` | None |
| `interview_experiences` | 004 | ✅ Read-only (auth) | `idx_interview_experiences_recruiter_id`, `idx_interview_experiences_role_id`, `idx_interview_experiences_source_type`, `idx_interview_experiences_verification` | None |
| `interview_questions` | 004 | ✅ Read-only (auth) | `idx_interview_questions_experience_id` | None |

### 2.2 Functions & Triggers (Verified)

| Object | Migration | Purpose |
|--------|-----------|---------|
| `handle_profiles_updated_at()` | 001 | Trigger function for `updated_at` |
| `trigger_profiles_updated_at` | 001 | BEFORE UPDATE on profiles |
| `handle_new_user()` | 002, 003 | SECURITY DEFINER function for auto-provisioning profiles |
| `trigger_handle_new_user_profile` | 002, 003 | AFTER INSERT ON auth.users |
| `handle_updated_at()` | 004 | Shared trigger function for recruiters/roles |
| `trigger_recruiters_updated_at` | 004 | BEFORE UPDATE on recruiters |
| `trigger_roles_updated_at` | 004 | BEFORE UPDATE on roles |

---

## 3. Existing Tables and Their Purposes (Cross-Checked)

### 3.1 `profiles` — User Management
**Verified from:** `001_create_profiles.sql`, `002_auto_create_student_profiles.sql`, `003_complete_student_profile_provisioning.sql`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, FK → `auth.users(id)` ON DELETE CASCADE | **Documentation says NUMERIC(4,2) but migration 001 says NUMERIC(3,2)** — migration 003 ALTERS to 4,2 ✅ |
| `full_name` | TEXT | nullable | |
| `college` | TEXT | nullable | |
| `branch` | TEXT | nullable | |
| `graduation_year` | INTEGER | nullable | |
| `cgpa` | NUMERIC(4,2) | CHECK 0-10, nullable | Migration 001 had (3,2) → fixed in 003 |
| `location` | TEXT | nullable | |
| `skills` | TEXT[] | DEFAULT '{}' | |
| `career_interests` | TEXT[] | DEFAULT '{}' | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | Trigger maintains this |

**RLS Policies (all verified in 001):**
- SELECT: `id = auth.uid()`
- INSERT: `id = auth.uid()`
- UPDATE: `id = auth.uid()`

**Auto-provisioning (verified in 002, 003):**
- `handle_new_user()` runs on Auth user creation
- Parses `raw_user_meta_data` for full profile
- Handles both JSON array and CSV string formats for skills/interests
- Backfill CTEs for existing users

### 3.2 `recruiters` — Career Intelligence
**Verified from:** `004_create_career_intelligence_tables.sql`, `005_seed_initial_data.sql`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | nullable |
| `website_url` | TEXT | nullable |
| `logo_url` | TEXT | nullable |
| `hiring_status` | TEXT | nullable |
| `data_source` | TEXT | nullable |
| `source_url` | TEXT | nullable |
| `verification_status` | TEXT | NOT NULL, CHECK (unverified/verified/flagged/rejected), DEFAULT 'unverified' |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() |

**Seed data (005):** 3 companies with fixed UUIDs
- `22222222-2222-2222-2222-222222222222` — TCS (verified)
- `33333333-3333-3333-3333-333333333333` — Infosys (verified)
- `44444444-4444-4444-4444-444444444444` — Wipro (verified)

**RLS:** Read-only for authenticated users (no write policies)

### 3.3 `roles` — Job Roles
**Verified from:** `004_create_career_intelligence_tables.sql`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() |
| `recruiter_id` | UUID | NOT NULL, FK → recruiters(id) ON DELETE CASCADE |
| `title` | TEXT | NOT NULL |
| `job_type` | TEXT | CHECK (internship/full-time/other), nullable |
| `description` | TEXT | nullable |
| `minimum_cgpa` | NUMERIC(4,2) | CHECK 0-10, nullable |
| `eligible_branches` | TEXT[] | nullable |
| `eligible_graduation_years` | INTEGER[] | nullable |
| `required_skills` | TEXT[] | NOT NULL DEFAULT '{}' |
| `preferred_skills` | TEXT[] | NOT NULL DEFAULT '{}' |
| `location` | TEXT | nullable |
| `application_url` | TEXT | nullable |
| `source_url` | TEXT | nullable |
| `verification_status` | TEXT | NOT NULL, CHECK (unverified/verified/flagged/rejected), DEFAULT 'unverified' |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() |

**RLS:** Read-only for authenticated users

### 3.4 `interview_experiences` — Historical Reports
**Verified from:** `004_create_career_intelligence_tables.sql`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() |
| `recruiter_id` | UUID | NOT NULL, FK → recruiters(id) ON DELETE CASCADE |
| `role_id` | UUID | FK → roles(id) ON DELETE SET NULL, nullable |
| `title` | TEXT | NOT NULL |
| `interview_year` | INTEGER | nullable |
| `round_name` | TEXT | nullable |
| `experience_text` | TEXT | nullable |
| `source_type` | TEXT | NOT NULL, CHECK (student_report/public_source/official/demo) |
| `source_name` | TEXT | nullable |
| `source_url` | TEXT | nullable |
| `verification_status` | TEXT | NOT NULL, CHECK (unverified/verified/flagged/rejected), DEFAULT 'unverified' |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**RLS:** Read-only for authenticated users

### 3.5 `interview_questions` — Historical Questions
**Verified from:** `004_create_career_intelligence_tables.sql`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() |
| `experience_id` | UUID | NOT NULL, FK → interview_experiences(id) ON DELETE CASCADE |
| `question_text` | TEXT | NOT NULL |
| `topic` | TEXT | nullable |
| `difficulty` | TEXT | nullable (free-form, not numeric) |
| `question_type` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**RLS:** Read-only for authenticated users

---

## 4. Proposed New Tables (MVP) — Documentation vs Implementation Status

### 4.1 Question Bank Tables (Migration 006 — **NOT CREATED**)

| Table | Documented In | Migration File | Status |
|-------|---------------|----------------|--------|
| `skills` | `docs/database-schema.md` lines 166-189 | `006_create_question_bank.sql` | ❌ **Missing** |
| `question_bank` | `docs/database-schema.md` lines 192-223 | `006_create_question_bank.sql` | ❌ **Missing** |
| `question_rubrics` | `docs/database-schema.md` lines 226-253 | `006_create_question_bank.sql` | ❌ **Missing** |
| `rubric_criteria` | `docs/database-schema.md` lines 256-276 | `006_create_question_bank.sql` | ❌ **Missing** |

### 4.2 Interview Session Tables (Migration 007 — **NOT CREATED**)

| Table | Documented In | Migration File | Status |
|-------|---------------|----------------|--------|
| `interviews` | `docs/database-schema.md` lines 279-311 | `007_create_interview_session_tables.sql` | ❌ **Missing** |
| `interview_turns` | `docs/database-schema.md` lines 314-352 | `007_create_interview_session_tables.sql` | ❌ **Missing** |
| `answers` | `docs/database-schema.md` lines 355-370 | `007_create_interview_session_tables.sql` | ❌ **Missing** |
| `evaluations` | `docs/database-schema.md` lines 372-390 | `007_create_interview_session_tables.sql` | ❌ **Missing** |
| `evaluation_criterion_results` | `docs/database-schema.md` lines 392-420 | `007_create_interview_session_tables.sql` | ❌ **Missing** |
| `candidate_skill_states` | `docs/database-schema.md` lines 423-442 | `007_create_interview_session_tables.sql` | ❌ **Missing** |
| `interview_reports` | `docs/database-schema.md` lines 445-476 | `007_create_interview_session_tables.sql` | ❌ **Missing** |

### 4.3 Seed Data (Migration 008 — **NOT CREATED**)

| File | Purpose | Status |
|------|---------|--------|
| `008_seed_question_bank.sql` | Insert 8 skills, 21 questions, rubrics with criteria | ❌ **Missing** |

---

## 5. Reusable Existing Tables for AI Interview Module

| Existing Table | Can Be Used For | Notes |
|----------------|-----------------|-------|
| `profiles` | Candidate identity, skill history, profile data | ✅ **Primary** — candidate_id FK in interviews |
| `recruiters` | Company selection in interview setup | ✅ **Primary** — company_id FK in interviews, question_bank |
| `roles` | Role context for interview (title, eligibility, required skills) | ✅ **Secondary** — role field in interviews is TEXT not FK |
| `interview_experiences` | Interview preparation/historical context | ✅ **Read-only reference** — NOT for live execution |
| `interview_questions` | Historical question reference for planning | ✅ **Read-only reference** — separate from question_bank |

---

## 6. Existing vs Proposed Table Comparison

### 6.1 `interview_questions` (Existing) vs `question_bank` (Proposed)

| Aspect | `interview_questions` (Existing) | `question_bank` (Proposed) |
|--------|----------------------------------|----------------------------|
| **Purpose** | Historical questions from interview experience reports | Curated, rubric-linked questions for live interview execution |
| **FK Parent** | `interview_experiences` | `recruiters` (company_id), `skills` (skill_id) |
| **Difficulty** | TEXT (free-form) | INTEGER 1-5 with CHECK constraint |
| **Rubric Link** | None | `rubric_version` + `question_rubrics` table |
| **Review Status** | None | `review_status` (pending/reviewed/rejected) |
| **Provenance** | None | `provenance` (curated/company_reported/ai_generated) |
| **Source** | `source_type` on parent experience | `source` (nullable) |
| **RLS** | Read-only for auth | Read only if `review_status = 'reviewed'` |

**✅ Verified:** They serve **different purposes**. The documentation note at line 160 is accurate — they are separate table families.

### 6.2 `roles` (Existing) vs `interviews.role` (Proposed)

| Aspect | `roles` Table | `interviews.role` Column |
|--------|---------------|--------------------------|
| Type | Full table with eligibility, skills, verification | TEXT nullable column |
| Relationship | FK `roles.recruiter_id` → `recruiters` | No FK, free text |
| Purpose | Career intelligence job listings | Interview configuration context |

**⚠️ Design Decision Needed:** Should `interviews.role` be a FK to `roles.id`? Currently documented as TEXT. The API contract accepts role as free text.

### 6.3 `profiles.skills` (TEXT[]) vs `skills` Table (Proposed)

| Aspect | `profiles.skills` | `skills` Table |
|--------|-------------------|----------------|
| Type | TEXT[] array on profiles | Separate table with UUID PK |
| Purpose | Self-reported skills by candidate | Canonical skill taxonomy for questions |
| Relationship | None (free text) | FK from `question_bank.skill_id`, `rubric_criteria.skill_id`, `candidate_skill_states.skill_id` |

**✅ Verified:** Different purposes. `profiles.skills` = candidate self-assessment. `skills` table = canonical taxonomy.

---

## 7. Missing Relationships, Constraints, and Inconsistencies

### 7.1 Documentation vs Migration Discrepancies

| Issue | Documentation | Actual Migration | Severity |
|-------|---------------|------------------|----------|
| `profiles.cgpa` type | NUMERIC(4,2) | Migration 001: NUMERIC(3,2) → Migration 003 ALTERS to 4,2 | **Fixed in 003** ✅ |
| `profiles.id` FK target | `auth.users(id)` | Migration 001: `REFERENCES auth.users(id)` | Matches ✅ |
| `idx_profiles_user_id` | Documented | Migration 001: `CREATE INDEX idx_profiles_user_id ON profiles (id)` | Redundant (PK already indexed) |
| `recruiters.verification_status` values | unverified/verified/flagged/rejected | Migration 004: CHECK matches | Matches ✅ |
| `roles.job_type` CHECK | internship/full-time/other | Migration 004: `CHECK (job_type IS NULL OR job_type IN ('internship', 'full-time', 'other'))` | Matches ✅ |

### 7.2 Missing Foreign Keys (Proposed Tables)

| Proposed Table | Missing FK | Should Reference |
|----------------|------------|------------------|
| `question_bank` | `company_id` | `recruiters(id)` ✅ Documented |
| `question_bank` | `skill_id` | `skills(id)` ✅ Documented |
| `question_rubrics` | `question_id` | `question_bank(id)` ON DELETE CASCADE ✅ Documented |
| `rubric_criteria` | `rubric_id` | `question_rubrics(id)` ON DELETE CASCADE ✅ Documented |
| `rubric_criteria` | `skill_id` | `skills(id)` ✅ Documented (nullable) |
| `interviews` | `candidate_id` | `profiles(id)` ON DELETE CASCADE ✅ Documented |
| `interviews` | `company_id` | `recruiters(id)` ON DELETE SET NULL ✅ Documented |
| `interview_turns` | `interview_id` | `interviews(id)` ON DELETE CASCADE ✅ Documented |
| `interview_turns` | `question_id` | `question_bank(id)` ✅ Documented (nullable) |
| `interview_turns` | `parent_turn_id` | `interview_turns(id)` ✅ Documented (nullable) |
| `answers` | `turn_id` | `interview_turns(id)` ON DELETE CASCADE, UNIQUE ✅ Documented |
| `evaluations` | `answer_id` | `answers(id)` ON DELETE CASCADE, UNIQUE ✅ Documented |
| `evaluation_criterion_results` | `evaluation_id` | `evaluations(id)` ON DELETE CASCADE ✅ Documented |
| `candidate_skill_states` | `candidate_id` | `profiles(id)` ON DELETE CASCADE ✅ Documented |
| `candidate_skill_states` | `skill_id` | `skills(id)` ✅ Documented |
| `interview_reports` | `interview_id` | `interviews(id)` ON DELETE CASCADE, UNIQUE ✅ Documented |

**All proposed FKs are documented correctly in the schema doc.**

### 7.3 Unique Constraints (Proposed — Documented)

| Table | Unique Constraint | Purpose |
|-------|-------------------|---------|
| `skills` | `name` | Canonical skill names |
| `question_rubrics` | `(question_id, version)` | Versioned rubrics per question |
| `rubric_criteria` | `(rubric_id, criterion_id)` | Stable criterion IDs within rubric |
| `interview_turns` | `(interview_id, sequence_num)` | Turn ordering per interview |
| `answers` | `turn_id` | One answer per turn |
| `evaluations` | `answer_id` | One evaluation per answer |
| `evaluation_criterion_results` | `(evaluation_id, criterion_id)` | One result per criterion per evaluation |
| `candidate_skill_states` | `(candidate_id, skill_id)` | One skill state per candidate |
| `interview_reports` | `interview_id` | One report per interview |

### 7.4 Check Constraints (Proposed — Documented)

| Table | Column | Constraint |
|-------|--------|------------|
| `skills` | `name` | NOT NULL, UNIQUE |
| `question_bank` | `difficulty` | CHECK 1-5 |
| `question_bank` | `provenance` | CHECK (curated/company_reported/ai_generated) |
| `question_bank` | `review_status` | CHECK (pending/reviewed/rejected) |
| `question_rubrics` | `version` | NOT NULL, DEFAULT 1 |
| `rubric_criteria` | `importance` | CHECK (critical/required/optional) |
| `rubric_criteria` | `weight` | CHECK 0-1 |
| `interviews` | `duration_minutes` | CHECK > 0 |
| `interviews` | `status` | CHECK (planned/active/paused/finalizing/completed/abandoned) |
| `evaluation_criterion_results` | `status` | CHECK (demonstrated/partially_demonstrated/not_demonstrated/contradicted/uncertain) |
| `evaluation_criterion_results` | `score` | CHECK 0-4, nullable |
| `candidate_skill_states` | `current_difficulty` | CHECK 1-5, DEFAULT 2 |

---

## 8. RLS Considerations

### 8.1 Existing Tables (Verified Implemented)

| Table | Policy Type | Implementation Status |
|-------|-------------|----------------------|
| `profiles` | Owner-only (SELECT/INSERT/UPDATE) | ✅ **Implemented** in 001 |
| `recruiters` | Authenticated read-only | ✅ **Implemented** in 004 |
| `roles` | Authenticated read-only | ✅ **Implemented** in 004 |
| `interview_experiences` | Authenticated read-only | ✅ **Implemented** in 004 |
| `interview_questions` | Authenticated read-only | ✅ **Implemented** in 004 |

### 8.2 Proposed Tables (Documented — NOT Implemented)

| Table | Policy Design | Feasibility Notes |
|-------|---------------|-------------------|
| `skills` | Authenticated read-only; service role write | ✅ Simple — no ownership |
| `question_bank` | Read if `review_status = 'reviewed'`; service role write | ✅ Doable — status-based |
| `question_rubrics` | Read via join to reviewed question_bank; service role write | ✅ Doable — subquery in USING |
| `rubric_criteria` | Read via join chain to reviewed question_bank; service role write | ✅ Doable — subquery in USING |
| `interviews` | Owner-only (SELECT/INSERT/UPDATE via `candidate_id = auth.uid()`) | ✅ Standard pattern |
| `interview_turns` | Via interview ownership (EXISTS subquery) | ✅ Standard pattern |
| `answers` | Via interview ownership (similar to turns) | ✅ Standard pattern |
| `evaluations` | Via answer → turn → interview chain | ✅ Complex but doable |
| `evaluation_criterion_results` | Via evaluation chain | ✅ Complex but doable |
| `candidate_skill_states` | Owner-only read; service role write | ✅ Simple |
| `interview_reports` | Via interview ownership | ✅ Standard pattern |

**⚠️ Critical RLS Implementation Notes:**

1. **Service Role Usage:** The backend must use `SUPABASE_SERVICE_ROLE_KEY` for writes to `question_bank`, `question_rubrics`, `rubric_criteria`, `evaluations`, `candidate_skill_states`, `interview_reports`. The current `backend/app/services/supabase.py` uses the **user's access token** (publishable key), NOT service role. This means:
   - Either the backend needs a separate service-role client for admin writes
   - Or RLS policies need to allow authenticated users to write (not recommended for question bank)

2. **Current Backend Pattern:** `SupabaseService` in `supabase.py` forwards the user's JWT. It does not have a service role mode. This must be addressed before MVP tables can be written to.

3. **`interviews` INSERT Policy:** Uses `WITH CHECK (candidate_id = auth.uid())`. This requires the backend to set `candidate_id` from the verified user ID — which it does (from `/auth/v1/user` response).

4. **Complex Chain Policies:** For `evaluations`, the USING clause joins 3 tables. Performance should be tested with indexes.

---

## 9. Questions Requiring Team Confirmation

### 9.1 For P3 (Backend Orchestration) — Architecture Decisions

| # | Question | Context | Impact |
|---|----------|---------|--------|
| **Q1** | Should `interviews.role` be FK to `roles.id` or remain TEXT? | API contract accepts free text; `roles` table has structured data | Affects migration 007, validation logic |
| **Q2** | Should `interviews.round` be FK to a lookup table or remain TEXT? | API contract has select: Technical/HR/Design/System Design/Other | Affects data integrity, migration |
| **Q3** | Service role client: will P3 add a separate Supabase service client for admin writes (question_bank, evaluations, reports)? | Current `SupabaseService` uses user token only | **Blocker** for MVP table writes |
| **Q4** | Interview state machine: does P3 need `interviews.started_at` / `ended_at` updated by triggers or application code? | Migration 007 documents them as nullable, set by app | Affects trigger design |
| **Q5** | `interview_turns.rubric_snapshot` — will P3 populate this from `question_rubrics` at turn creation? | Documented as JSONB snapshot | Requires read from question_rubrics (service role or reviewed-only?) |

### 9.2 For P4 (AI & Provider Services) — Data Requirements

| # | Question | Context | Impact |
|---|----------|---------|--------|
| **Q6** | Question Bank seeding: Who provides the 21 curated questions, rubrics, and criteria? | Migration 008 needs stable UUIDs and content | **P4/P2 collaboration needed** — P4 knows rubric design |
| **Q7** | Rubric structure: Is the documented `expected_concepts` JSONB structure final? | `{critical: [], required: [], optional: []}` | Affects `question_rubrics.expected_concepts` schema |
| **Q8** | Criterion weights: Must they sum to 1.0 per rubric? | Documented as "weights summing to 1.0" | Application-level validation needed |
| **Q9** | Follow-up questions: Are they stored in `interview_turns` with `is_follow_up=true` and `question_id=NULL`? | Documented that way | Confirmed in schema |
| **Q10** | Skill evidence aggregation: Does P4 need `candidate_skill_states` updated after each main question evaluation? | Documented: "Updated after each main-question evaluation, not follow-ups" | P3 orchestrates, P4 provides evaluation results |

### 9.3 For P1 (Frontend) — UI/Integration

| # | Question | Context | Impact |
|---|----------|---------|--------|
| **Q11** | Company selector in Interview Setup: Should it use `GET /api/recruiters` (all) or filtered? | 3 seed companies now; more later | API already exists |
| **Q12** | Resume upload: Supabase Storage bucket needed? | `interviews.resume_url` is TEXT path | P2 needs to create bucket or confirm external storage |
| **Q13** | Demo mode: How should Interview Room work without Supabase? | `isDemoMode` flag in AuthContext | Frontend mock data needed |

### 9.4 Cross-Cutting

| # | Question | Context | Impact |
|---|----------|---------|--------|
| **Q14** | Migration 006/007/008: Who creates and applies them? | P2 owns migrations but needs P4 content for 008 | **Coordination required** |
| **Q15** | Supabase Service Role Key: Is it configured in Render backend env? | Architecture doc says yes; config.py doesn't reference it | Backend needs `SUPABASE_SERVICE_ROLE_KEY` |
| **Q16** | Resume Storage: Supabase Storage bucket `resumes` needed? | `interviews.resume_url` column exists | P2 creates bucket + policies |
| **Q17** | `profiles.cgpa` NUMERIC(4,2): Confirm existing data migrated correctly? | Migration 003 ALTERed column; verify no data loss | Run check in Supabase |

---

## 10. Summary: What Exists vs What Needs Creation

### ✅ Already Implemented (Migrations 001-005)
- 5 tables with full schema, RLS, indexes, triggers
- 3 recruiter seed records
- Auto-provisioning for new auth users
- Backend API for profiles, recruiters, roles, experiences
- Frontend pages for auth, profile, recruiters

### ❌ Not Implemented (Migrations 006-008 Missing)
| Migration | Tables | Est. Effort |
|-----------|--------|-------------|
| `006_create_question_bank.sql` | skills, question_bank, question_rubrics, rubric_criteria + RLS + indexes | Medium |
| `007_create_interview_session_tables.sql` | interviews, interview_turns, answers, evaluations, evaluation_criterion_results, candidate_skill_states, interview_reports + RLS + indexes + triggers | High |
| `008_seed_question_bank.sql` | 8 skills, 21 questions with rubrics (3-5 criteria each) | High (content creation) |

### ⚠️ Prerequisites Before Creating Migrations
1. **P3 confirms** service role client for admin writes (Q3)
2. **P4 provides** question bank content (Q6, Q7, Q8)
3. **P3/P4 align** on rubric snapshot mechanism (Q5)
4. **P1 confirms** Interview Setup form fields map to `interviews` columns (Q11, Q12)

---

## 11. Recommended Next Steps for P2

1. **Wait for P3/P4 confirmation** on Q1-Q10 above
2. **Create migration 006** once skill taxonomy and question_bank schema are confirmed
3. **Create migration 007** once interview session schema is confirmed
4. **Coordinate with P4** on migration 008 seed data (stable UUIDs, rubric content)
5. **Verify Supabase Service Role Key** is available in backend environment
6. **Create Supabase Storage bucket** for resumes if needed

---

*Analysis complete. All findings verified against actual SQL migration files (001-005) and documentation. Proposed tables (006-008) are documented but NOT implemented.*