import { apiRequest } from './api'

export const INTERVIEW_MODES = Object.freeze({
  DEMO: 'demo',
  LIVE: 'live',
})

function mockInterviewId() {
  return 'mock-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

function requireAccessToken(accessToken) {
  if (!accessToken) {
    throw new Error('An authenticated access token is required for interview API requests.')
  }
}

function requireLiveInterviewId(interviewId) {
  if (!interviewId || typeof interviewId !== 'string') {
    throw new Error('A valid interview ID is required.')
  }

  if (isMockInterviewId(interviewId)) {
    throw new Error('Mock interview IDs cannot be used with live interview API requests.')
  }
}

function interviewPath(interviewId, suffix = '') {
  requireLiveInterviewId(interviewId)
  return `/api/interviews/${encodeURIComponent(interviewId)}${suffix}`
}

function optionalText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Build the exact POST /api/interviews request body from InterviewCreate.
 * File objects are intentionally ignored; resume_url is only preserved when
 * the caller already has a string URL from a real upload flow.
 */
export function toInterviewCreatePayload(formData = {}) {
  return {
    company_id: formData.company_id || null,
    role: optionalText(formData.role),
    round: optionalText(formData.round),
    duration_minutes: Number(formData.duration_minutes),
    job_description: optionalText(formData.job_description),
    resume_url: typeof formData.resume_url === 'string' ? formData.resume_url : null,
  }
}

/**
 * MOCK adapter. It is selected only when the caller explicitly passes
 * mode: INTERVIEW_MODES.DEMO. Mock IDs must never be sent to the backend.
 */
export async function createInterviewMock(payload) {
  await new Promise((resolve) => setTimeout(resolve, 600))
  return {
    __mock: true,
    id: mockInterviewId(),
    candidate_id: null,
    company_id: payload.company_id,
    role: payload.role,
    round: payload.round,
    duration_minutes: payload.duration_minutes,
    status: 'planned',
    job_description: payload.job_description,
    resume_url: payload.resume_url,
    started_at: null,
    ended_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

/** REAL adapter for POST /api/interviews. */
export async function createInterviewReal(payload, accessToken) {
  requireAccessToken(accessToken)
  return apiRequest('/api/interviews', {
    accessToken,
    method: 'POST',
    body: payload,
  })
}

/**
 * Create an interview using the explicitly selected runtime mode.
 * Live API failures propagate unchanged; there is no mock fallback.
 */
export async function createInterview(formData, { mode, accessToken } = {}) {
  const payload = toInterviewCreatePayload(formData)

  if (mode === INTERVIEW_MODES.DEMO) {
    return createInterviewMock(payload)
  }

  if (mode === INTERVIEW_MODES.LIVE) {
    return createInterviewReal(payload, accessToken)
  }

  throw new Error('An explicit interview service mode is required: demo or live.')
}

/** Fetch one interview and its current turn. */
export async function fetchInterview(accessToken, interviewId) {
  requireAccessToken(accessToken)
  return apiRequest(interviewPath(interviewId), { accessToken })
}

/** Start a planned interview. */
export async function startInterview(accessToken, interviewId) {
  requireAccessToken(accessToken)
  return apiRequest(interviewPath(interviewId, '/start'), {
    accessToken,
    method: 'POST',
  })
}

/** Fetch one turn, including its answer and evaluation when available. */
export async function fetchInterviewTurn(accessToken, interviewId, turnId) {
  requireAccessToken(accessToken)
  if (!turnId || typeof turnId !== 'string') {
    throw new Error('A valid turn ID is required.')
  }
  return apiRequest(interviewPath(interviewId, `/turns/${encodeURIComponent(turnId)}`), {
    accessToken,
  })
}

function toAnswerSubmitPayload(answer = {}) {
  const payload = {
    transcript_text: answer.transcript_text,
  }

  if (answer.audio_duration_seconds !== undefined) {
    payload.audio_duration_seconds = answer.audio_duration_seconds
  }

  return payload
}

/** Submit exactly the documented AnswerSubmit fields for one turn. */
export async function submitInterviewAnswer(accessToken, interviewId, turnId, answer) {
  requireAccessToken(accessToken)
  if (!turnId || typeof turnId !== 'string') {
    throw new Error('A valid turn ID is required.')
  }

  return apiRequest(interviewPath(interviewId, `/turns/${encodeURIComponent(turnId)}/answer`), {
    accessToken,
    method: 'POST',
    body: toAnswerSubmitPayload(answer),
  })
}

/** Finish an active or paused interview. */
export async function finishInterview(accessToken, interviewId) {
  requireAccessToken(accessToken)
  return apiRequest(interviewPath(interviewId, '/finish'), {
    accessToken,
    method: 'POST',
  })
}

/** Fetch the completed interview report. */
export async function fetchInterviewReport(accessToken, interviewId) {
  requireAccessToken(accessToken)
  return apiRequest(interviewPath(interviewId, '/report'), { accessToken })
}

/** List interviews with the contract's optional status/limit/offset filters. */
export async function listInterviews(accessToken, { status, limit, offset } = {}) {
  requireAccessToken(accessToken)
  const query = new URLSearchParams()
  if (status) query.set('status', status)
  if (limit !== undefined) query.set('limit', String(limit))
  if (offset !== undefined) query.set('offset', String(offset))
  const queryString = query.toString()

  return apiRequest(`/api/interviews${queryString ? `?${queryString}` : ''}`, { accessToken })
}

/** Fetch a short-lived ElevenLabs STT token. */
export async function fetchSttToken(accessToken) {
  requireAccessToken(accessToken)
  return apiRequest('/api/stt/token', { accessToken })
}

/** Fetch recruiters for the setup form. */
export async function fetchRecruiters(accessToken) {
  requireAccessToken(accessToken)
  return apiRequest('/api/recruiters', { accessToken })
}

export function isMockInterviewId(interviewId) {
  return typeof interviewId === 'string' && interviewId.startsWith('mock-')
}

/** Report whether creation will use the explicitly selected demo adapter. */
export function isInterviewCreationMocked(mode) {
  return mode === INTERVIEW_MODES.DEMO
}
