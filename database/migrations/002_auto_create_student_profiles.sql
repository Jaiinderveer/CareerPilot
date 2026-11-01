-- Migration: 002_auto_create_student_profiles
-- Description: Provision one public profile for every Supabase Auth user
-- Reference: auth.users(id) - profiles are keyed by Supabase auth user ID

-- Create the provisioning function with a locked-down search path. The trigger
-- runs as the function owner so it can insert the initial row without changing
-- the existing profiles RLS policies.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(BTRIM(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
      'Student'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
ALTER FUNCTION public.handle_new_user()
OWNER TO postgres;
-- Provision profiles for future Auth users without requiring frontend behavior.
-- Safely drop any existing trigger on auth.users with the same name before recreating.
DROP TRIGGER IF EXISTS trigger_handle_new_user_profile ON auth.users;

CREATE TRIGGER trigger_handle_new_user_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Revoke EXECUTE permission on public.handle_new_user() from PUBLIC, anon and authenticated
-- to ensure only trusted roles (e.g., postgres or service roles) can trigger profile provisioning.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- Safely repair Auth users created before this migration. Existing profile rows
-- are not updated, and concurrent inserts are harmless because of ON CONFLICT.
INSERT INTO public.profiles (id, full_name)
SELECT
  auth_user.id,
  COALESCE(
    NULLIF(BTRIM(auth_user.raw_user_meta_data->>'full_name'), ''),
    NULLIF(BTRIM(auth_user.raw_user_meta_data->>'name'), ''),
    NULLIF(BTRIM(split_part(COALESCE(auth_user.email, ''), '@', 1)), ''),
    'Student'
  )
FROM auth.users AS auth_user
LEFT JOIN public.profiles AS existing_profile
  ON existing_profile.id = auth_user.id
WHERE existing_profile.id IS NULL
ON CONFLICT (id) DO NOTHING;
