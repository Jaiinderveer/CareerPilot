/**
 * Origin-aware redirect targets for Supabase auth flows.
 *
 * The app has no dedicated auth callback route. Supabase processes the auth
 * response in the current page through detectSessionInUrl, while AuthContext
 * observes the resulting session and protected routes send the user to the
 * dashboard.
 */

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/
const ABSOLUTE_ROUTE_PATTERN = /^[a-z][a-z\d+.-]*:/i

function isProductionBuild() {
  return Boolean(import.meta.env.PROD) || import.meta.env.MODE === 'production'
}

function normalizeRoute(route) {
  const rawRoute = String(route ?? '/').trim()

  const routeWithoutLeadingSlashes = rawRoute.replace(/^\/+/, '')

  const protocolRelativeRoute = rawRoute.startsWith('//') && !rawRoute.startsWith('///')

  if (
    CONTROL_CHARACTER_PATTERN.test(rawRoute) ||
    rawRoute.includes('\\') ||
    protocolRelativeRoute ||
    ABSOLUTE_ROUTE_PATTERN.test(routeWithoutLeadingSlashes)
  ) {
    throw new Error('Auth redirect route must be a relative app route.')
  }

  // Remove extra leading slashes while retaining one app-root slash.
  return `/${routeWithoutLeadingSlashes}`
}

function normalizeOrigin(origin) {
  const rawOrigin = String(origin ?? '').trim()
  const withoutTrailingSlashes = rawOrigin.replace(/\/+$/, '')

  if (!withoutTrailingSlashes) {
    throw new Error('Unable to resolve an auth redirect origin.')
  }

  let url
  try {
    url = new URL(withoutTrailingSlashes)
  } catch {
    throw new Error('Unable to resolve an auth redirect origin.')
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Auth redirect origin must be an HTTP(S) origin without a path.')
  }

  return url.origin
}

function isLocalhostOrigin(origin) {
  try {
    return LOCALHOST_HOSTS.has(new URL(origin).hostname)
  } catch {
    return false
  }
}

function getCurrentOrigin() {
  return typeof window !== 'undefined' ? window.location?.origin : ''
}

/**
 * Build a safe, absolute redirect URL for a Supabase auth flow.
 *
 * @param {string} route - Relative app route, e.g. '/dashboard'.
 * @param {object} [options]
 * @param {string} [options.origin] - Origin override, primarily useful in tests.
 * @param {boolean} [options.isProduction] - Environment override for tests.
 * @returns {string} Absolute redirect URL.
 * @throws {Error} If the route/origin is malformed or production resolves to localhost.
 */
export function getAuthRedirectTo(route, { origin, isProduction } = {}) {
  const normalizedRoute = normalizeRoute(route)
  const resolvedOrigin = normalizeOrigin(origin || getCurrentOrigin())
  const production = isProduction ?? isProductionBuild()

  if (isLocalhostOrigin(resolvedOrigin) && production) {
    throw new Error(
      `Auth redirect origin "${resolvedOrigin}" is unsafe in production. ` +
      'Use localhost only during local development.',
    )
  }

  return `${resolvedOrigin}${normalizedRoute}`
}

/**
 * Routes used by the implemented auth flows. There is no separate callback
 * route; Supabase returns to the dashboard and the app processes the session
 * there via detectSessionInUrl and AuthContext.
 */
export const AUTH_REDIRECT_ROUTES = {
  AFTER_LOGIN: '/dashboard',
  AFTER_SIGNUP: '/dashboard',
  AFTER_OAUTH: '/dashboard',
}

export function getLoginRedirectTo(options) {
  return getAuthRedirectTo(AUTH_REDIRECT_ROUTES.AFTER_LOGIN, options)
}

export function getSignupRedirectTo(options) {
  return getAuthRedirectTo(AUTH_REDIRECT_ROUTES.AFTER_SIGNUP, options)
}

export function getOAuthRedirectTo(options) {
  return getAuthRedirectTo(AUTH_REDIRECT_ROUTES.AFTER_OAUTH, options)
}

export default getAuthRedirectTo
