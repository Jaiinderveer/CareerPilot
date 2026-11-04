import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  getCurrentSession,
  isDemoMode,
  isSupabaseConfigured,
  signIn as supabaseSignIn,
  signInWithOAuth as supabaseSignInWithOAuth,
  signOut as supabaseSignOut,
  updatePassword as supabaseUpdatePassword,
  signUp as supabaseSignUp,
  supabase,
} from '../services/supabase'
import { apiRequest } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [profileLoading, setProfileLoading] = useState(false)
  const [error, setError] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const profileRequestRef = useRef(null)
  const loadedProfileUserIdRef = useRef(null)

  const loadProfile = useCallback(async (nextUser, { force = false } = {}) => {
    if (!isSupabaseConfigured || !supabase || !nextUser?.id) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    const userId = nextUser.id
    if (!nextUser.access_token) {
      setProfile(null)
      setProfileLoading(false)
      setProfileError(new Error('No authenticated access token is available.'))
      return
    }
    if (!force && loadedProfileUserIdRef.current === userId) return
    if (!force && profileRequestRef.current?.userId === userId) {
      return profileRequestRef.current.promise
    }

    if (loadedProfileUserIdRef.current !== userId) setProfile(null)
    setProfileLoading(true)
    setProfileError(null)

    const promise = (async () => {
      try {
        const data = await apiRequest('/api/me/profile', {
          accessToken: nextUser.access_token,
        })
        setProfile(data)
        loadedProfileUserIdRef.current = userId
      } catch (queryError) {
        setProfile(null)
        setProfileError(queryError instanceof Error ? queryError : new Error('Unable to load your profile.'))
      } finally {
        setProfileLoading(false)
      }
    })()

    profileRequestRef.current = { userId, promise }
    try {
      await promise
    } finally {
      if (profileRequestRef.current?.promise === promise) profileRequestRef.current = null
    }
  }, [])

  useEffect(() => {
    let active = true

    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return () => {
        active = false
      }
    }

    let receivedAuthEvent = false
    const { data: listenerData } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return

      // Keep this callback synchronous. Supabase owns the auth event lifecycle.
      receivedAuthEvent = true
      setSession(nextSession ?? null)
      setError(null)
      if (nextSession) {
        void loadProfile({ ...nextSession.user, access_token: nextSession.access_token })
      } else {
        loadedProfileUserIdRef.current = null
        profileRequestRef.current = null
        setProfile(null)
        setProfileLoading(false)
      }
    })

    const initializeSession = async () => {
      const result = await getCurrentSession()
      if (!active) return

      if (result.error) {
        setError(result.error)
        setSession(null)
        setProfile(null)
      } else if (!receivedAuthEvent) {
        setSession(result.session)
        if (result.session) {
          await loadProfile({ ...result.session.user, access_token: result.session.access_token })
        }
      }

      setLoading(false)
    }

    initializeSession()

    return () => {
      active = false
      listenerData?.subscription?.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email, password) => {
    setError(null)
    const result = await supabaseSignIn(email, password)

    if (result.error) {
      setError(result.error)
    } else {
      setSession(result.session ?? null)
    }

    return result
  }, [])

  const signInWithOAuth = useCallback(
    (provider = 'google', options = {}) => supabaseSignInWithOAuth(provider, options),
    [],
  )

  const signUp = useCallback(async (email, password, profileData) => {
    setError(null)
    const result = await supabaseSignUp(email, password, profileData)

    if (result.error) {
      setError(result.error)
    } else if (result.session) {
      setSession(result.session)
    }

    return result
  }, [])

  const updatePassword = useCallback(async (password) => {
    setError(null)
    const result = await supabaseUpdatePassword(password)

    if (result.error) {
      setError(result.error)
    } else if (result.user) {
      setSession((currentSession) => (
        currentSession
          ? { ...currentSession, user: result.user }
          : currentSession
      ))
    }

    return result
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    const result = await supabaseSignOut()

    if (result.error) {
      setError(result.error)
    } else {
      setSession(null)
      setProfile(null)
      setProfileError(null)
      loadedProfileUserIdRef.current = null
      profileRequestRef.current = null
    }

    return result
  }, [])

  const updateProfile = useCallback((nextProfile) => {
    setProfile(nextProfile ?? null)
    setProfileError(null)
  }, [])

  const user = session?.user ?? null

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        profileLoading,
        error,
        profileError,
        isConfigured: isSupabaseConfigured,
        isDemoMode,
        signIn,
        signInWithOAuth,
        signUp,
        updatePassword,
        signOut,
        updateProfile,
        refreshProfile: () => {
          if (!session) return Promise.resolve()
          return loadProfile({ ...user, access_token: session.access_token }, { force: true })
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
