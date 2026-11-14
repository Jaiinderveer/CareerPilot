import { apiRequest } from './api'

/**
 * Interview service: clean separation of real and mock adapters.
 *
 * CONTRACT STATE (verified against docs/api-contract.md):
 *   POST /api/interviews exists in the contract but is marked "New" —
 *   the P3 backend router (app/routers/interviews.py) has NOT shipped.
 *
 * Therefore `createInterview` currently uses a MOCK adapter. It is
 * explicit: it never calls fetch, never claims a backend-persisted
 * record, and tags every response with `__mock: true` so callers can
 * never mistake it for a real persisted interview.
 *
 * When P3 ships the endpoint, set INTERVIEW_API_AVAILABLE = true and the
 * real adapter below is used unchanged.
 */
const INTERVIEW_API_AVAILABLE = false

function mockInterviewId() {
  return 'mock-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

/**
 * Build the POST /api/interviews request body matching InterviewCreate
 * (api-contract.md lines 866-872). Only documented fields are sent.
 */
export function toInterviewCreatePayload(formData) {
  return {
    company_id: formData.company_id || null,
    role: formData.role?.trim() || null,
    round: formData.round || null,
    duration_minutes: Number(formData.duration_minutes),
    job_description: formData.job_description?.trim() || null,
    resume_url: formData.resume_url || null,
  }
}

/**
 * MOCK adapter — used only while POST /api/interviews is unavailable.
 * Returns an InterviewResponse-shaped object so the UI can be built and
 * tested, but the record is NOT persisted anywhere. `__mock: true` makes
 * the limitation explicit to every consumer.
 */
async function createInterviewMock(payload) {
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

/**
 * REAL adapter — POST /api/interviews per api-contract.md. Never called
 * until INTERVIEW_API_AVAILABLE is true.
 */
async function createInterviewReal(payload, accessToken) {
  return apiRequest('/api/interviews', {
    accessToken,
    method: 'POST',
    body: payload,
  })
}

/**
 * Create an interview. Returns the InterviewResponse-shaped object.
 * The mock path marks the result with `__mock: true`.
 */
export async function createInterview(formData, accessToken) {
  const payload = toInterviewCreatePayload(formData)

  if (INTERVIEW_API_AVAILABLE) {
    return createInterviewReal(payload, accessToken)
  }

  return createInterviewMock(payload)
}

/**
 * Fetch recruiters list.
 */
export async function fetchRecruiters(accessToken) {
  return apiRequest('/api/recruiters', { accessToken })
}

/**
 * Report whether interview creation is mocked. Exposed so the UI can
 * label the output honestly ("Demo session — not saved").
 */
export function isInterviewCreationMocked() {
  return !INTERVIEW_API_AVAILABLE
}
