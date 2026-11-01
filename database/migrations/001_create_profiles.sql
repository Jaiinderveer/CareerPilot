-- Migration: 001_create_profiles
-- Description: Create profiles table with RLS for authenticated users
-- Reference: auth.users(id) - profiles are keyed by Supabase auth user ID

-- Create the profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  college TEXT,
  branch TEXT,
  graduation_year INTEGER,
  cgpa NUMERIC(3,2),
  location TEXT,
  skills TEXT[] DEFAULT '{}',
  career_interests TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Index for lookups by user ID (primary key already indexed)
CREATE INDEX idx_profiles_user_id ON profiles (id);

-- Trigger to update updated_at on row updates
CREATE OR REPLACE FUNCTION handle_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION handle_profiles_updated_at();

-- Policies for RLS

-- 1. Authenticated users can read their own profile
CREATE POLICY "Users can read own profile"
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 2. Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- 3. Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 4. Users must never access other students' profiles (implicit via RLS)
-- The policies above enforce this by scoping to auth.uid()

COMMENT ON TABLE profiles IS 'Student profile data linked to Supabase auth user ID. RLS enforces per-user ownership.';