const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
const apiBaseUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:8000' : '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest(path, { accessToken, signal } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    // Keep a predictable error when an upstream response has no JSON body.
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.detail || 'Unable to load career-resource data.',
      response.status,
    )
  }

  return payload
}
