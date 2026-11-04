import { createClient } from '@supabase/supabase-js'
import { getSignupRedirectTo, getOAuthRedirectTo } from '../utils/authRedirect'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabasePublishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()

let client = null
let initializationError = null

if (supabaseUrl && supabasePublishableKey) {
  try {
    client = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error('Supabase client initialization failed.')
  }
}

export const supabase = client
export const isSupabaseConfigured = Boolean(client)
export const isDemoMode = !isSupabaseConfigured
export const supabaseInitializationError = initializationError

function unavailableError() {
  if (initializationError) {
    return new Error(`Supabase could not be initialized: ${initializationError.message}`)
  }

  return new Error(
    'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env to enable authentication.',
  )
}

/**
 * Returns the current session without throwing for a normal no-session result.
 * Contract: { session: Session | null, error: Error | null }
 */
export async function getCurrentSession() {
  if (!supabase) {
    return { session: null, error: initializationError }
  }

  try {
    const response = await supabase.auth.getSession()
    return {
      session: response?.data?.session ?? null,
      error: response?.error ?? null,
    }
  } catch (error) {
    return {
      session: null,
      error: error instanceof Error ? error : new Error('Unable to read the current session.'),
    }
  }
}

/**
 * Signs in with email/password.
 * Contract: { user: User | null, session: Session | null, error: Error | null }
 */
export async function signIn(email, password) {
  if (!supabase) {
    return { user: null, session: null, error: unavailableError() }
  }

  try {
    const response = await supabase.auth.signInWithPassword({ email, password })
    return {
      user: response?.data?.user ?? null,
      session: response?.data?.session ?? null,
      error: response?.error ?? null,
    }
  } catch (error) {
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error : new Error('Unable to sign in.'),
    }
  }
}

/**
 * Creates an account and reports whether email confirmation is still required.
 * Contract: { user: User | null, session: Session | null, error: Error | null,
 * needsEmailConfirmation: boolean }
 */
export async function signUp(email, password, profileData) {
  if (!supabase) {
    return {
      user: null,
      session: null,
      error: unavailableError(),
      needsEmailConfirmation: false,
    }
  }

  try {
    const metadata = {
      full_name: profileData?.fullName?.trim() ?? '',
      college: profileData?.college?.trim() ?? '',
      branch: profileData?.branch?.trim() ?? '',
      graduation_year: profileData?.graduationYear ? Number(profileData.graduationYear) : null,
      cgpa: profileData?.cgpa === '' || profileData?.cgpa == null ? null : Number(profileData.cgpa),
      location: profileData?.location?.trim() ?? '',
      skills: Array.isArray(profileData?.skills) ? profileData.skills : [],
      career_interests: Array.isArray(profileData?.careerInterests) ? profileData.careerInterests : [],
    }

    if (import.meta.env.DEV) {
      console.debug('[CareerPilot] signup metadata before Supabase Auth', {
        fields: Object.keys(metadata),
        full_name: metadata.full_name,
        college: metadata.college,
        branch: metadata.branch,
        graduation_year: metadata.graduation_year,
        cgpa: metadata.cgpa,
        location: metadata.location,
        skills: metadata.skills,
        career_interests: metadata.career_interests,
      })
    }

    const response = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getSignupRedirectTo(),
        data: metadata,
      },
    })

    const user = response?.data?.user ?? null
    const session = response?.data?.session ?? null

    return {
      user,
      session,
      error: response?.error ?? null,
      needsEmailConfirmation: Boolean(user && !session && !response?.error),
    }
  } catch (error) {
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error : new Error('Unable to create the account.'),
      needsEmailConfirmation: false,
    }
  }
}

/**
 * Sets or changes the password for the currently authenticated user.
 * Contract: { user: User | null, error: Error | null }
 */
export async function updatePassword(password) {
  if (!supabase) {
    return { user: null, error: unavailableError() }
  }

  try {
    const response = await supabase.auth.updateUser({ password })
    return {
      user: response?.data?.user ?? null,
      error: response?.error ?? null,
    }
  } catch (error) {
    return {
      user: null,
      error: error instanceof Error ? error : new Error('Unable to update your password.'),
    }
  }
}

/**
 * Signs out the current session.
 * Contract: { error: Error | null }
 */
export async function signOut() {
  if (!supabase) {
    return { error: null }
  }

  try {
    const response = await supabase.auth.signOut()
    return { error: response?.error ?? null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Unable to sign out.'),
    }
  }
}

/**
 * Signs in with an OAuth provider (e.g. Google).
 * Contract: { user: User | null, session: Session | null, error: Error | null,
 * needsEmailConfirmation: boolean }
 */
export async function signInWithOAuth(provider = 'google', options = {}) {
  if (!supabase) {
    return {
      user: null,
      session: null,
      error: unavailableError(),
      needsEmailConfirmation: false,
    }
  }

  try {
    const response = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: options.redirectTo ?? getOAuthRedirectTo(),
        ...options,
      },
    })

    return {
      user: response?.data?.user ?? null,
      session: response?.data?.session ?? null,
      error: response?.error ?? null,
      needsEmailConfirmation: false,
    }
  } catch (error) {
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error : new Error('Unable to sign in with Google.'),
      needsEmailConfirmation: false,
    }
  }
}

export default supabase