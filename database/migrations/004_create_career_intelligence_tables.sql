-- Migration: 004_create_career_intelligence_tables.sql
-- Description: Create career intelligence infrastructure (recruiters, roles, experiences, questions)

-- 1. Recruiters
CREATE TABLE recruiters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  website_url TEXT,
  logo_url TEXT,
  hiring_status TEXT,
  data_source TEXT,
  source_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified', 'flagged', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Roles
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  job_type TEXT CHECK (job_type IS NULL OR job_type IN ('internship', 'full-time', 'other')),
  description TEXT,
  minimum_cgpa NUMERIC(4,2) CHECK (minimum_cgpa IS NULL OR (minimum_cgpa >= 0 AND minimum_cgpa <= 10)),
  eligible_branches TEXT[],
  eligible_graduation_years INTEGER[],
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  preferred_skills TEXT[] NOT NULL DEFAULT '{}',
  location TEXT,
  application_url TEXT,
  source_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified', 'flagged', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Interview Experiences
CREATE TABLE interview_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  interview_year INTEGER,
  round_name TEXT,
  experience_text TEXT,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('student_report', 'public_source', 'official', 'demo')),
  source_name TEXT,
  source_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified', 'flagged', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Interview Questions
CREATE TABLE interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES interview_experiences(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT,
  question_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_recruiters_name ON recruiters (name);
CREATE INDEX idx_recruiters_verification ON recruiters (verification_status);

CREATE INDEX idx_roles_recruiter_id ON roles (recruiter_id);
CREATE INDEX idx_roles_job_type ON roles (job_type);
CREATE INDEX idx_roles_verification ON roles (verification_status);

CREATE INDEX idx_interview_experiences_recruiter_id ON interview_experiences (recruiter_id);
CREATE INDEX idx_interview_experiences_role_id ON interview_experiences (role_id);
CREATE INDEX idx_interview_experiences_source_type ON interview_experiences (source_type);
CREATE INDEX idx_interview_experiences_verification ON interview_experiences (verification_status);

CREATE INDEX idx_interview_questions_experience_id ON interview_questions (experience_id);

-- RLS Policies (Read-only for authenticated users)
CREATE POLICY "Allow authenticated users to read recruiters" ON recruiters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to read roles" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to read interview_experiences" ON interview_experiences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to read interview_questions" ON interview_questions FOR SELECT TO authenticated USING (true);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION handle_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recruiters_updated_at BEFORE UPDATE ON recruiters FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
