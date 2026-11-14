-- Migration: 007_create_interview_session_tables.sql
-- Description: Create interview session tables with full RLS, indexes, and triggers
-- Service-role writes required for: evaluations, evaluation_criterion_results, candidate_skill_states, interview_reports

-- Interview sessions
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES recruiters(id) ON DELETE SET NULL,
  role TEXT,
  round TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'paused', 'finalizing', 'completed', 'abandoned')) DEFAULT 'planned',
  job_description TEXT,
  resume_url TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual question-answer turns within an interview
CREATE TABLE interview_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  sequence_num INTEGER NOT NULL,
  question_id UUID REFERENCES question_bank(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  rubric_snapshot JSONB NOT NULL,
  is_follow_up BOOLEAN NOT NULL DEFAULT false,
  parent_turn_id UUID REFERENCES interview_turns(id) ON DELETE SET NULL,
  target_criterion_id TEXT,
  asked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (interview_id, sequence_num)
);

-- Candidate answer transcripts
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL UNIQUE REFERENCES interview_turns(id) ON DELETE CASCADE,
  transcript_text TEXT NOT NULL,
  audio_duration_seconds INTEGER CHECK (audio_duration_seconds IS NULL OR audio_duration_seconds >= 0),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI evaluation results for answers
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL UNIQUE REFERENCES answers(id) ON DELETE CASCADE,
  gemini_model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  rubric_version INTEGER NOT NULL,
  overall_score NUMERIC(3,2) CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 1)),
  raw_response JSONB,
  evaluated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Per-criterion evaluation results
CREATE TABLE evaluation_criterion_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  criterion_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('demonstrated', 'partially_demonstrated', 'not_demonstrated', 'contradicted', 'uncertain')),
  score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 4)),
  evidence_quote TEXT,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (evaluation_id, criterion_id)
);

-- Candidate skill tracking across interviews
CREATE TABLE candidate_skill_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id),
  current_difficulty INTEGER NOT NULL CHECK (current_difficulty BETWEEN 1 AND 5) DEFAULT 2,
  main_question_attempts INTEGER NOT NULL DEFAULT 0,
  demonstrated_count INTEGER NOT NULL DEFAULT 0,
  not_demonstrated_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (candidate_id, skill_id)
);

-- Final interview reports
CREATE TABLE interview_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL UNIQUE REFERENCES interviews(id) ON DELETE CASCADE,
  overall_summary TEXT NOT NULL,
  overall_score NUMERIC(3,2) CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 1)),
  topic_results JSONB NOT NULL,
  strengths JSONB NOT NULL,
  weaknesses JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  gemini_model TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for frequently queried foreign keys and filters
CREATE INDEX idx_interviews_candidate_id ON interviews(candidate_id);
CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_interviews_company_id ON interviews(company_id);
CREATE INDEX idx_interviews_candidate_status ON interviews(candidate_id, status);

CREATE INDEX idx_interview_turns_interview_id ON interview_turns(interview_id);
CREATE INDEX idx_interview_turns_question_id ON interview_turns(question_id);
CREATE INDEX idx_interview_turns_parent_id ON interview_turns(parent_turn_id);

CREATE INDEX idx_answers_turn_id ON answers(turn_id);

CREATE INDEX idx_evaluations_answer_id ON evaluations(answer_id);

CREATE INDEX idx_eval_criterion_results_evaluation_id ON evaluation_criterion_results(evaluation_id);
CREATE INDEX idx_eval_criterion_results_criterion_id ON evaluation_criterion_results(criterion_id);

CREATE INDEX idx_candidate_skill_states_candidate_id ON candidate_skill_states(candidate_id);
CREATE INDEX idx_candidate_skill_states_skill_id ON candidate_skill_states(skill_id);

CREATE INDEX idx_interview_reports_interview_id ON interview_reports(interview_id);

-- Enable Row Level Security
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_criterion_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_skill_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interviews
CREATE POLICY "Users can read own interviews" ON interviews
  FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

CREATE POLICY "Users can create own interviews" ON interviews
  FOR INSERT TO authenticated
  WITH CHECK (candidate_id = auth.uid());

CREATE POLICY "Users can update own interviews" ON interviews
  FOR UPDATE TO authenticated
  USING (candidate_id = auth.uid())
  WITH CHECK (candidate_id = auth.uid());

-- RLS Policies for interview_turns (access via interview ownership)
CREATE POLICY "Users can read turns for own interviews" ON interview_turns
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM interviews
      WHERE interviews.id = interview_turns.interview_id
      AND interviews.candidate_id = auth.uid()
    )
  );

-- Users can create turns for own interviews (backend uses user-token supabase.post)
CREATE POLICY "Users can create turns for own interviews" ON interview_turns
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM interviews
      WHERE interviews.id = interview_turns.interview_id
      AND interviews.candidate_id = auth.uid()
    )
  );

-- RLS Policies for answers
CREATE POLICY "Users can read answers for own interviews" ON answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM interview_turns
      JOIN interviews ON interviews.id = interview_turns.interview_id
      WHERE interview_turns.id = answers.turn_id
      AND interviews.candidate_id = auth.uid()
    )
  );

CREATE POLICY "Users can create answers for own interviews" ON answers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM interview_turns
      JOIN interviews ON interviews.id = interview_turns.interview_id
      WHERE interview_turns.id = answers.turn_id
      AND interviews.candidate_id = auth.uid()
    )
  );

-- RLS Policies for evaluations (read via interview ownership chain; no user writes)
CREATE POLICY "Users can read evaluations for own interviews" ON evaluations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM answers
      JOIN interview_turns ON interview_turns.id = answers.turn_id
      JOIN interviews ON interviews.id = interview_turns.interview_id
      WHERE answers.id = evaluations.answer_id
      AND interviews.candidate_id = auth.uid()
    )
  );

-- No user write policy for evaluations (service-role writes via backend)

-- RLS Policies for evaluation_criterion_results
CREATE POLICY "Users can read criterion results for own interviews" ON evaluation_criterion_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations
      JOIN answers ON answers.id = evaluations.answer_id
      JOIN interview_turns ON interview_turns.id = answers.turn_id
      JOIN interviews ON interviews.id = interview_turns.interview_id
      WHERE evaluations.id = evaluation_criterion_results.evaluation_id
      AND interviews.candidate_id = auth.uid()
    )
  );

-- No user write policy for criterion results (service-role writes)

-- RLS Policies for candidate_skill_states
CREATE POLICY "Users can read own skill states" ON candidate_skill_states
  FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

-- No user write policy (service-role updates after evaluations)

-- RLS Policies for interview_reports
CREATE POLICY "Users can read own reports" ON interview_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM interviews
      WHERE interviews.id = interview_reports.interview_id
      AND interviews.candidate_id = auth.uid()
    )
  );

-- No user write policy (service-role creates reports)

-- updated_at triggers (function handle_updated_at already defined in 004)
CREATE TRIGGER trigger_interviews_updated_at
BEFORE UPDATE ON interviews
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();