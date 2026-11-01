-- Migration: 003_complete_student_profile_provisioning.sql
-- Description: Complete student profile provisioning with full metadata support
-- Reference: auth.users(id) - profiles are keyed by Supabase auth user ID

-- Migration 001 used NUMERIC(3,2), which cannot store 10.00. This changes only
-- the CGPA precision; all other profile columns remain unchanged.
ALTER TABLE public.profiles
  ALTER COLUMN cgpa TYPE NUMERIC(4,2);

-- Provision a complete profile for new Auth users. The function is deliberately
-- defensive because raw_user_meta_data is user-controlled JSON.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_metadata JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
  v_full_name TEXT;
  v_college TEXT;
  v_branch TEXT;
  v_graduation_year INTEGER;
  v_cgpa NUMERIC(4,2);
  v_location TEXT;
  v_skills TEXT[] := '{}'::TEXT[];
  v_career_interests TEXT[] := '{}'::TEXT[];
  v_graduation_year_text TEXT;
  v_cgpa_text TEXT;
BEGIN
  v_full_name := COALESCE(
    NULLIF(BTRIM(v_metadata->>'full_name'), ''),
    NULLIF(BTRIM(v_metadata->>'name'), ''),
    NULLIF(BTRIM(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
    'Student'
  );

  v_college := NULLIF(BTRIM(v_metadata->>'college'), '');
  v_branch := NULLIF(BTRIM(v_metadata->>'branch'), '');
  v_location := NULLIF(BTRIM(v_metadata->>'location'), '');

  -- A four-digit check bounds the value before the cast. The nested CASE keeps
  -- the cast out of any boolean expression whose evaluation order is uncertain.
  v_graduation_year_text := NULLIF(BTRIM(v_metadata->>'graduation_year'), '');
  v_graduation_year := CASE
    WHEN v_graduation_year_text ~ '^[0-9]{4}$' THEN
      CASE
        WHEN v_graduation_year_text::INTEGER BETWEEN 1900 AND 2100
          THEN v_graduation_year_text::INTEGER
        ELSE NULL
      END
    ELSE NULL
  END;

  -- This bounded format accepts 0, 0.00, 8, 8.5, 8.50 and 10.00 while
  -- rejecting oversized, malformed and out-of-range values before casting.
  v_cgpa_text := NULLIF(BTRIM(v_metadata->>'cgpa'), '');
  v_cgpa := CASE
    WHEN v_cgpa_text ~ '^(0|0\.[0-9]{1,2}|[1-9](\.[0-9]{1,2})?|10(\.0{1,2})?)$' THEN
      v_cgpa_text::NUMERIC(4,2)
    ELSE NULL
  END;

  -- JSON arrays are the preferred representation. CSV strings are supported
  -- only for legacy metadata values.
  IF pg_catalog.jsonb_typeof(v_metadata->'skills') = 'array' THEN
    v_skills := COALESCE(
      ARRAY(
        SELECT pg_catalog.btrim(element.value)
        FROM pg_catalog.jsonb_array_elements_text(v_metadata->'skills') AS element(value)
        WHERE pg_catalog.btrim(element.value) <> ''
      ),
      '{}'::TEXT[]
    );
  ELSIF pg_catalog.jsonb_typeof(v_metadata->'skills') = 'string' THEN
    v_skills := COALESCE(
      ARRAY(
        SELECT pg_catalog.btrim(value)
        FROM pg_catalog.unnest(pg_catalog.string_to_array(v_metadata->>'skills', ',')) AS item(value)
        WHERE pg_catalog.btrim(value) <> ''
      ),
      '{}'::TEXT[]
    );
  END IF;

  IF pg_catalog.jsonb_typeof(v_metadata->'career_interests') = 'array' THEN
    v_career_interests := COALESCE(
      ARRAY(
        SELECT pg_catalog.btrim(element.value)
        FROM pg_catalog.jsonb_array_elements_text(v_metadata->'career_interests') AS element(value)
        WHERE pg_catalog.btrim(element.value) <> ''
      ),
      '{}'::TEXT[]
    );
  ELSIF pg_catalog.jsonb_typeof(v_metadata->'career_interests') = 'string' THEN
    v_career_interests := COALESCE(
      ARRAY(
        SELECT pg_catalog.btrim(value)
        FROM pg_catalog.unnest(pg_catalog.string_to_array(v_metadata->>'career_interests', ',')) AS item(value)
        WHERE pg_catalog.btrim(value) <> ''
      ),
      '{}'::TEXT[]
    );
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    college,
    branch,
    graduation_year,
    cgpa,
    location,
    skills,
    career_interests
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_college,
    v_branch,
    v_graduation_year,
    v_cgpa,
    v_location,
    v_skills,
    v_career_interests
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_handle_new_user_profile ON auth.users;

CREATE TRIGGER trigger_handle_new_user_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- ============================================================================
-- BACKFILL: parse metadata once per statement, then update existing profiles.
-- ============================================================================

WITH metadata AS (
  SELECT
    u.id,
    u.email,
    u.raw_user_meta_data AS data,
    NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), '') AS metadata_full_name,
    NULLIF(BTRIM(u.raw_user_meta_data->>'name'), '') AS metadata_name,
    NULLIF(BTRIM(u.raw_user_meta_data->>'college'), '') AS metadata_college,
    NULLIF(BTRIM(u.raw_user_meta_data->>'branch'), '') AS metadata_branch,
    NULLIF(BTRIM(u.raw_user_meta_data->>'graduation_year'), '') AS graduation_year_text,
    NULLIF(BTRIM(u.raw_user_meta_data->>'cgpa'), '') AS cgpa_text,
    NULLIF(BTRIM(u.raw_user_meta_data->>'location'), '') AS metadata_location
  FROM auth.users AS u
), parsed AS (
  SELECT
    metadata.*,
    CASE
      WHEN graduation_year_text ~ '^[0-9]{4}$' THEN
        CASE
          WHEN graduation_year_text::INTEGER BETWEEN 1900 AND 2100
            THEN graduation_year_text::INTEGER
          ELSE NULL
        END
      ELSE NULL
    END AS metadata_graduation_year,
    CASE
      WHEN cgpa_text ~ '^(0|0\.[0-9]{1,2}|[1-9](\.[0-9]{1,2})?|10(\.0{1,2})?)$'
        THEN cgpa_text::NUMERIC(4,2)
      ELSE NULL
    END AS metadata_cgpa,
    CASE pg_catalog.jsonb_typeof(data->'skills')
      WHEN 'array' THEN COALESCE(
        ARRAY(
          SELECT pg_catalog.btrim(element.value)
          FROM pg_catalog.jsonb_array_elements_text(data->'skills') AS element(value)
          WHERE pg_catalog.btrim(element.value) <> ''
        ),
        '{}'::TEXT[]
      )
      WHEN 'string' THEN COALESCE(
        ARRAY(
          SELECT pg_catalog.btrim(item.value)
          FROM pg_catalog.unnest(pg_catalog.string_to_array(data->>'skills', ',')) AS item(value)
          WHERE pg_catalog.btrim(item.value) <> ''
        ),
        '{}'::TEXT[]
      )
      ELSE '{}'::TEXT[]
    END AS metadata_skills,
    CASE pg_catalog.jsonb_typeof(data->'career_interests')
      WHEN 'array' THEN COALESCE(
        ARRAY(
          SELECT pg_catalog.btrim(element.value)
          FROM pg_catalog.jsonb_array_elements_text(data->'career_interests') AS element(value)
          WHERE pg_catalog.btrim(element.value) <> ''
        ),
        '{}'::TEXT[]
      )
      WHEN 'string' THEN COALESCE(
        ARRAY(
          SELECT pg_catalog.btrim(item.value)
          FROM pg_catalog.unnest(pg_catalog.string_to_array(data->>'career_interests', ',')) AS item(value)
          WHERE pg_catalog.btrim(item.value) <> ''
        ),
        '{}'::TEXT[]
      )
      ELSE '{}'::TEXT[]
    END AS metadata_career_interests
  FROM metadata
)
UPDATE public.profiles AS p
SET
  full_name = CASE
    WHEN NULLIF(BTRIM(p.full_name), '') IS NULL THEN
      COALESCE(parsed.metadata_full_name, parsed.metadata_name, p.full_name)
    WHEN p.full_name = pg_catalog.split_part(COALESCE(parsed.email, ''), '@', 1)
      AND COALESCE(parsed.metadata_full_name, parsed.metadata_name) IS NOT NULL THEN
      COALESCE(parsed.metadata_full_name, parsed.metadata_name)
    ELSE p.full_name
  END,
  college = COALESCE(NULLIF(p.college, ''), parsed.metadata_college),
  branch = COALESCE(NULLIF(p.branch, ''), parsed.metadata_branch),
  graduation_year = COALESCE(p.graduation_year, parsed.metadata_graduation_year),
  cgpa = COALESCE(p.cgpa, parsed.metadata_cgpa),
  location = COALESCE(NULLIF(p.location, ''), parsed.metadata_location),
  skills = CASE
    WHEN p.skills IS NULL OR p.skills = '{}'::TEXT[] THEN parsed.metadata_skills
    ELSE p.skills
  END,
  career_interests = CASE
    WHEN p.career_interests IS NULL OR p.career_interests = '{}'::TEXT[]
      THEN parsed.metadata_career_interests
    ELSE p.career_interests
  END
FROM parsed
WHERE parsed.id = p.id
  AND (
    NULLIF(BTRIM(p.full_name), '') IS NULL
    OR (
      p.full_name = pg_catalog.split_part(COALESCE(parsed.email, ''), '@', 1)
      AND COALESCE(parsed.metadata_full_name, parsed.metadata_name) IS NOT NULL
    )
    OR p.college IS NULL OR p.college = ''
    OR p.branch IS NULL OR p.branch = ''
    OR p.graduation_year IS NULL
    OR p.cgpa IS NULL
    OR p.location IS NULL OR p.location = ''
    OR p.skills IS NULL OR p.skills = '{}'::TEXT[]
    OR p.career_interests IS NULL OR p.career_interests = '{}'::TEXT[]
  );

-- ============================================================================
-- BACKFILL: insert profiles for Auth users that still have no profile row.
-- ============================================================================

WITH metadata AS (
  SELECT
    u.id,
    u.email,
    u.raw_user_meta_data AS data,
    NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), '') AS metadata_full_name,
    NULLIF(BTRIM(u.raw_user_meta_data->>'name'), '') AS metadata_name,
    NULLIF(BTRIM(u.raw_user_meta_data->>'college'), '') AS metadata_college,
    NULLIF(BTRIM(u.raw_user_meta_data->>'branch'), '') AS metadata_branch,
    NULLIF(BTRIM(u.raw_user_meta_data->>'graduation_year'), '') AS graduation_year_text,
    NULLIF(BTRIM(u.raw_user_meta_data->>'cgpa'), '') AS cgpa_text,
    NULLIF(BTRIM(u.raw_user_meta_data->>'location'), '') AS metadata_location
  FROM auth.users AS u
), parsed AS (
  SELECT
    metadata.*,
    CASE
      WHEN graduation_year_text ~ '^[0-9]{4}$' THEN
        CASE
          WHEN graduation_year_text::INTEGER BETWEEN 1900 AND 2100
            THEN graduation_year_text::INTEGER
          ELSE NULL
        END
      ELSE NULL
    END AS metadata_graduation_year,
    CASE
      WHEN cgpa_text ~ '^(0|0\.[0-9]{1,2}|[1-9](\.[0-9]{1,2})?|10(\.0{1,2})?)$'
        THEN cgpa_text::NUMERIC(4,2)
      ELSE NULL
    END AS metadata_cgpa,
    CASE pg_catalog.jsonb_typeof(data->'skills')
      WHEN 'array' THEN COALESCE(
        ARRAY(
          SELECT pg_catalog.btrim(element.value)
          FROM pg_catalog.jsonb_array_elements_text(data->'skills') AS element(value)
          WHERE pg_catalog.btrim(element.value) <> ''
        ),
        '{}'::TEXT[]
      )
      WHEN 'string' THEN COALESCE(
        ARRAY(
          SELECT pg_catalog.btrim(item.value)
          FROM pg_catalog.unnest(pg_catalog.string_to_array(data->>'skills', ',')) AS item(value)
          WHERE pg_catalog.btrim(item.value) <> ''
        ),
        '{}'::TEXT[]
      )
      ELSE '{}'::TEXT[]
    END AS metadata_skills,
    CASE pg_catalog.jsonb_typeof(data->'career_interests')
      WHEN 'array' THEN COALESCE(
        ARRAY(
          SELECT pg_catalog.btrim(element.value)
          FROM pg_catalog.jsonb_array_elements_text(data->'career_interests') AS element(value)
          WHERE pg_catalog.btrim(element.value) <> ''
        ),
        '{}'::TEXT[]
      )
      WHEN 'string' THEN COALESCE(
        ARRAY(
          SELECT pg_catalog.btrim(item.value)
          FROM pg_catalog.unnest(pg_catalog.string_to_array(data->>'career_interests', ',')) AS item(value)
          WHERE pg_catalog.btrim(item.value) <> ''
        ),
        '{}'::TEXT[]
      )
      ELSE '{}'::TEXT[]
    END AS metadata_career_interests
  FROM metadata
)
INSERT INTO public.profiles (
  id,
  full_name,
  college,
  branch,
  graduation_year,
  cgpa,
  location,
  skills,
  career_interests
)
SELECT
  parsed.id,
  COALESCE(parsed.metadata_full_name, parsed.metadata_name, NULLIF(BTRIM(pg_catalog.split_part(COALESCE(parsed.email, ''), '@', 1)), ''), 'Student'),
  parsed.metadata_college,
  parsed.metadata_branch,
  parsed.metadata_graduation_year,
  parsed.metadata_cgpa,
  parsed.metadata_location,
  parsed.metadata_skills,
  parsed.metadata_career_interests
FROM parsed
LEFT JOIN public.profiles AS existing_profile
  ON existing_profile.id = parsed.id
WHERE existing_profile.id IS NULL
ON CONFLICT (id) DO NOTHING;
