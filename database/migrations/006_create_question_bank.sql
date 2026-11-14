-- Migration: 006_create_question_bank.sql
-- Description: Create skill taxonomy, curated question bank, rubric definitions, and rubric criteria
-- RLS policies enforced; write access restricted to service-role (dashboard/seed)

-- Skills taxonomy
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  topic_area TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Curated questions (candidate-facing interview questions)
CREATE TABLE question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES recruiters(id) ON DELETE SET NULL,
  role TEXT,
  round TEXT,
  skill_id UUID NOT NULL REFERENCES skills(id),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  question_text TEXT NOT NULL,
  source TEXT,
  provenance TEXT NOT NULL CHECK (provenance IN ('curated', 'company_reported', 'ai_generated')),
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'reviewed', 'rejected')) DEFAULT 'pending',
  rubric_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rubric definitions (one rubric per question, multiple versions allowed)
CREATE TABLE question_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  expected_concepts JSONB NOT NULL,
  scoring_guidance TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (question_id, version)
);

-- Individual criteria that make up a rubric
CREATE TABLE rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES question_rubrics(id) ON DELETE CASCADE,
  criterion_id TEXT NOT NULL,
  description TEXT NOT NULL,
  importance TEXT NOT NULL CHECK (importance IN ('critical', 'required', 'optional')),
  weight NUMERIC(3,2) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  skill_id UUID REFERENCES skills(id),
  accepted_alternatives JSONB,
  common_misconceptions JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rubric_id, criterion_id)
);

-- Indexes for efficient querying
CREATE INDEX idx_skills_topic_area ON skills(topic_area);
CREATE INDEX idx_question_bank_skill_id ON question_bank(skill_id);
CREATE INDEX idx_question_bank_company_id ON question_bank(company_id);
CREATE INDEX idx_question_bank_difficulty ON question_bank(difficulty);
CREATE INDEX idx_question_bank_review_status ON question_bank(review_status);
CREATE INDEX idx_question_bank_skill_difficulty ON question_bank(skill_id, difficulty);
CREATE INDEX idx_question_rubrics_question_id ON question_rubrics(question_id);
CREATE INDEX idx_rubric_criteria_rubric_id ON rubric_criteria(rubric_id);
CREATE INDEX idx_rubric_criteria_skill_id ON rubric_criteria(skill_id);

-- Enable Row Level Security
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_criteria ENABLE ROW LEVEL SECURITY;

-- RLS Policies for read-only access (no user write access)
CREATE POLICY "Allow authenticated users to read skills" ON skills
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read reviewed questions" ON question_bank
  FOR SELECT TO authenticated
  USING (review_status = 'reviewed');

CREATE POLICY "Allow authenticated users to read rubrics" ON question_rubrics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_bank
      WHERE question_bank.id = question_rubrics.question_id
      AND question_bank.review_status = 'reviewed'
    )
  );

CREATE POLICY "Allow authenticated users to read criteria" ON rubric_criteria
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_rubrics
      JOIN question_bank ON question_bank.id = question_rubrics.question_id
      WHERE question_rubrics.id = rubric_criteria.rubric_id
      AND question_bank.review_status = 'reviewed'
    )
  );

-- updated_at trigger for question_bank (function handle_updated_at already defined in 004)
CREATE TRIGGER trigger_question_bank_updated_at
BEFORE UPDATE ON question_bank
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();