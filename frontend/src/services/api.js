const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
const apiBaseUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:8000' : '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest(path, { accessToken, method = 'GET', body, signal } = {}) {
  const headers = {
    Accept: 'application/json',
  }

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
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
      payload?.detail || 'Unable to complete the API request.',
      response.status,
    )
  }

  return payload
}
