import { describe, it, expect, vi, beforeEach } from 'vitest'

// @supabase/supabase-js calls fetch and runs internal detection code at import
// time, which crashes inside the Vitest jsdom worker before any describe()
// block is registered. Mock the whole package so createClient() never runs.
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  })),
}))

import {
  INTERVIEW_MODES,
  toInterviewCreatePayload,
  createInterview,
  fetchInterview,
  startInterview,
  fetchInterviewTurn,
  submitInterviewAnswer,
  finishInterview,
  fetchInterviewReport,
  listInterviews,
  fetchSttToken,
  fetchRecruiters,
  isMockInterviewId,
  isInterviewCreationMocked,
} from './interviewService'
import { apiRequest } from './api'

vi.mock('./api', () => ({
  apiRequest: vi.fn(),
}))

describe('interviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('toInterviewCreatePayload', () => {
    it('correctly maps and sanitizes fields', () => {
      const payload = toInterviewCreatePayload({
        company_id: 'comp-123',
        role: '  Software Engineer  ',
        round: 'Technical',
        duration_minutes: '45',
        job_description: '  Build APIs  ',
        resume_url: 'https://example.com/resume.pdf',
        unsupported_field: 'drop me',
      })

      expect(payload).toEqual({
        company_id: 'comp-123',
        role: 'Software Engineer',
        round: 'Technical',
        duration_minutes: 45,
        job_description: 'Build APIs',
        resume_url: 'https://example.com/resume.pdf',
      })
    })

    it('handles blank strings and missing resume_url safely', () => {
      const payload = toInterviewCreatePayload({
        company_id: '',
        role: '   ',
        duration_minutes: 30,
        job_description: '',
        resume_url: new File([''], 'resume.pdf'),
      })

      expect(payload).toEqual({
        company_id: null,
        role: null,
        round: null,
        duration_minutes: 30,
        job_description: null,
        resume_url: null,
      })
    })
  })

  describe('createInterview', () => {
    it('requires an explicit mode', async () => {
      await expect(createInterview({}, { accessToken: 'token' })).rejects.toThrow(
        'An explicit interview service mode is required: demo or live.'
      )
    })

    it('invokes mock adapter when mode is DEMO', async () => {
      const result = await createInterview(
        { duration_minutes: 30, role: 'Engineer' },
        { mode: INTERVIEW_MODES.DEMO }
      )
      expect(result.__mock).toBe(true)
      expect(result.id).toMatch(/^mock-/)
      expect(result.role).toBe('Engineer')
    })

    it('invokes real adapter when mode is LIVE and requires token', async () => {
      await expect(
        createInterview({ duration_minutes: 30 }, { mode: INTERVIEW_MODES.LIVE })
      ).rejects.toThrow('An authenticated access token is required')

      apiRequest.mockResolvedValueOnce({ id: 'real-123' })
      const result = await createInterview(
        { duration_minutes: 30 },
        { mode: INTERVIEW_MODES.LIVE, accessToken: 'jwt-token' }
      )

      expect(apiRequest).toHaveBeenCalledWith('/api/interviews', {
        accessToken: 'jwt-token',
        method: 'POST',
        body: expect.any(Object),
      })
      expect(result).toEqual({ id: 'real-123' })
    })
  })

  describe('mock ID isolation and live guards', () => {
    it('identifies mock IDs correctly', () => {
      expect(isMockInterviewId('mock-abc123xyz')).toBe(true)
      expect(isMockInterviewId('123e4567-e89b-12d3-a456-426614174000')).toBe(false)
      expect(isMockInterviewId(null)).toBe(false)
    })

    it('prevents mock IDs from being used in live endpoint wrappers', async () => {
      const mockId = 'mock-12345'
      const token = 'jwt-token'

      await expect(fetchInterview(token, mockId)).rejects.toThrow(
        'Mock interview IDs cannot be used with live interview API requests.'
      )
      await expect(startInterview(token, mockId)).rejects.toThrow(
        'Mock interview IDs cannot be used'
      )
      await expect(fetchInterviewReport(token, mockId)).rejects.toThrow(
        'Mock interview IDs cannot be used'
      )
    })
  })

  describe('endpoint wrappers forwarding access token', () => {
    const validId = '123e4567-e89b-12d3-a456-426614174000'
    const token = 'jwt-token'

    it('fetchInterview', async () => {
      apiRequest.mockResolvedValueOnce({ id: validId })
      await fetchInterview(token, validId)
      expect(apiRequest).toHaveBeenCalledWith(`/api/interviews/${validId}`, { accessToken: token })
    })

    it('startInterview', async () => {
      apiRequest.mockResolvedValueOnce({ status: 'active' })
      await startInterview(token, validId)
      expect(apiRequest).toHaveBeenCalledWith(`/api/interviews/${validId}/start`, {
        accessToken: token,
        method: 'POST',
      })
    })

    it('fetchInterviewTurn', async () => {
      apiRequest.mockResolvedValueOnce({ turn_id: 'turn-1' })
      await fetchInterviewTurn(token, validId, 'turn-1')
      expect(apiRequest).toHaveBeenCalledWith(`/api/interviews/${validId}/turns/turn-1`, {
        accessToken: token,
      })
    })

    it('submitInterviewAnswer', async () => {
      apiRequest.mockResolvedValueOnce({ success: true })
      await submitInterviewAnswer(token, validId, 'turn-1', {
        transcript_text: 'My answer',
        audio_duration_seconds: 15,
      })
      expect(apiRequest).toHaveBeenCalledWith(`/api/interviews/${validId}/turns/turn-1/answer`, {
        accessToken: token,
        method: 'POST',
        body: {
          transcript_text: 'My answer',
          audio_duration_seconds: 15,
        },
      })
    })

    it('finishInterview', async () => {
      apiRequest.mockResolvedValueOnce({ status: 'completed' })
      await finishInterview(token, validId)
      expect(apiRequest).toHaveBeenCalledWith(`/api/interviews/${validId}/finish`, {
        accessToken: token,
        method: 'POST',
      })
    })

    it('fetchInterviewReport', async () => {
      apiRequest.mockResolvedValueOnce({ report: {} })
      await fetchInterviewReport(token, validId)
      expect(apiRequest).toHaveBeenCalledWith(`/api/interviews/${validId}/report`, {
        accessToken: token,
      })
    })

    it('listInterviews with query params', async () => {
      apiRequest.mockResolvedValueOnce([])
      await listInterviews(token, { status: 'planned', limit: 10, offset: 0 })
      expect(apiRequest).toHaveBeenCalledWith('/api/interviews?status=planned&limit=10&offset=0', {
        accessToken: token,
      })
    })

    it('fetchSttToken', async () => {
      apiRequest.mockResolvedValueOnce({ token: 'stt-token' })
      await fetchSttToken(token)
      expect(apiRequest).toHaveBeenCalledWith('/api/stt/token', { accessToken: token })
    })

    it('fetchRecruiters', async () => {
      apiRequest.mockResolvedValueOnce([])
      await fetchRecruiters(token)
      expect(apiRequest).toHaveBeenCalledWith('/api/recruiters', { accessToken: token })
    })
  })

  describe('isInterviewCreationMocked', () => {
    it('returns true only for DEMO mode', () => {
      expect(isInterviewCreationMocked(INTERVIEW_MODES.DEMO)).toBe(true)
      expect(isInterviewCreationMocked(INTERVIEW_MODES.LIVE)).toBe(false)
      expect(isInterviewCreationMocked('unknown')).toBe(false)
    })
  })

  describe('mode selector default-DEMO contracts', () => {
    it('DEMO mode produces a mock-prefixed ID, not a real UUID', async () => {
      const result = await createInterview(
        { duration_minutes: 30, role: 'Frontend Engineer' },
        { mode: INTERVIEW_MODES.DEMO }
      )
      expect(result.id).toMatch(/^mock-/)
      expect(result.__mock).toBe(true)
      // Verify the mock ID is correctly identified by isMockInterviewId
      expect(isMockInterviewId(result.id)).toBe(true)
    })

    it('LIVE mode calls apiRequest and returns a real (non-mock) ID', async () => {
      apiRequest.mockResolvedValueOnce({ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', status: 'planned' })
      const result = await createInterview(
        { duration_minutes: 45, role: 'Backend Engineer' },
        { mode: INTERVIEW_MODES.LIVE, accessToken: 'valid-token' }
      )
      expect(result.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      expect(result.__mock).toBeUndefined()
      // Verify the real ID is NOT identified as a mock
      expect(isMockInterviewId(result.id)).toBe(false)
    })

    it('LIVE mode never silently falls back to DEMO — missing token throws immediately', async () => {
      // Should throw without ever calling the mock path
      await expect(
        createInterview({ duration_minutes: 30 }, { mode: INTERVIEW_MODES.LIVE })
      ).rejects.toThrow('An authenticated access token is required')
      // apiRequest must not have been called (no silent DEMO fallback)
      expect(apiRequest).not.toHaveBeenCalled()
    })

    it('DEMO mode creates a session tagged __mock=true with all expected fields', async () => {
      const result = await createInterview(
        { duration_minutes: 15, role: 'Designer', round: 'Design', company_id: 'co-1' },
        { mode: INTERVIEW_MODES.DEMO }
      )
      expect(result).toMatchObject({
        __mock: true,
        status: 'planned',
        role: 'Designer',
        round: 'Design',
        company_id: 'co-1',
        duration_minutes: 15,
      })
      expect(typeof result.created_at).toBe('string')
      expect(result.started_at).toBeNull()
    })
  })
})
