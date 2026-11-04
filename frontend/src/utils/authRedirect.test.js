import { describe, expect, it } from 'vitest'
import {
  AUTH_REDIRECT_ROUTES,
  getAuthRedirectTo,
  getLoginRedirectTo,
  getOAuthRedirectTo,
  getSignupRedirectTo,
} from './authRedirect'

describe('auth redirect targets', () => {
  it('returns the deployed origin and dashboard route', () => {
    expect(getOAuthRedirectTo({
      origin: 'https://career-pilot-nine-omega.vercel.app',
      isProduction: true,
    })).toBe('https://career-pilot-nine-omega.vercel.app/dashboard')
  })

  it('uses the dashboard for OAuth, email confirmation, and login helpers', () => {
    const origin = 'https://example.com'
    const options = { origin, isProduction: true }
    expect(getOAuthRedirectTo(options)).toBe(`${origin}/dashboard`)
    expect(getSignupRedirectTo(options)).toBe(`${origin}/dashboard`)
    expect(getLoginRedirectTo(options)).toBe(`${origin}/dashboard`)
    expect(AUTH_REDIRECT_ROUTES.AFTER_OAUTH).toBe('/dashboard')
  })

  it('removes extra leading route slashes', () => {
    expect(getAuthRedirectTo('///dashboard', {
      origin: 'https://example.com',
      isProduction: true,
    })).toBe('https://example.com/dashboard')
  })

  it('rejects malformed or unsafe routes', () => {
    for (const route of ['/dashboard\\settings', '//evil.example', 'https://evil.example', '/dashboard\u0000']) {
      expect(() => getAuthRedirectTo(route, {
        origin: 'https://example.com',
        isProduction: true,
      })).toThrow('relative app route')
    }
  })

  it('removes trailing slashes from a valid origin', () => {
    expect(getAuthRedirectTo('/dashboard', {
      origin: 'https://example.com///',
      isProduction: true,
    })).toBe('https://example.com/dashboard')
  })

  it('rejects origins with paths, queries, or fragments', () => {
    for (const origin of ['https://example.com/app', 'https://example.com/?next=login', 'https://example.com/#auth']) {
      expect(() => getAuthRedirectTo('/dashboard', { origin, isProduction: true }))
        .toThrow('HTTP(S) origin')
    }
  })

  it('rejects localhost in a production build', () => {
    expect(() => getAuthRedirectTo('/dashboard', {
      origin: 'http://localhost:5173',
      isProduction: true,
    })).toThrow('unsafe in production')
  })

  it('supports localhost during development', () => {
    expect(getAuthRedirectTo('/dashboard', {
      origin: 'http://localhost:5173',
      isProduction: false,
    })).toBe('http://localhost:5173/dashboard')
  })

  it('rejects an unavailable origin', () => {
    expect(() => getAuthRedirectTo('/dashboard', {
      origin: '',
      isProduction: true,
    })).toThrow('Unable to resolve an auth redirect origin')
  })
})
