"""Tests for Career Intelligence endpoints."""

import pytest
from app.services.supabase import get_supabase_service


class IntelligenceSupabaseService:
    """Fake Supabase service specifically tailored for intelligence tests."""

    def __init__(self) -> None:
        self.last_path = None
        self.last_params = None
        self.mock_recruiters = [
            {
                "id": "22222222-2222-2222-2222-222222222222",
                "name": "Acme Corp",
                "description": "Tech company",
                "website_url": "https://acme.com",
                "logo_url": "https://acme.com/logo.png",
                "hiring_status": "hiring",
                "data_source": "manual",
                "source_url": "https://acme.com/careers",
                "verification_status": "verified",
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
            }
        ]
        self.mock_roles = [
            {
                "id": "33333333-3333-3333-3333-333333333333",
                "recruiter_id": "22222222-2222-2222-2222-222222222222",
                "title": "Software Engineer",
                "job_type": "full-time",
                "description": "Develop software",
                "minimum_cgpa": 7.5,
                "eligible_branches": ["CSE", "IT"],
                "eligible_graduation_years": [2025, 2026],
                "required_skills": ["Python", "FastAPI"],
                "preferred_skills": ["Docker"],
                "location": "Remote",
                "application_url": "https://acme.com/apply",
                "source_url": "https://acme.com/job/1",
                "verification_status": "verified",
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
                "recruiter": self.mock_recruiters[0],
            }
        ]
        self.mock_experiences = [
            {
                "id": "44444444-4444-4444-4444-444444444444",
                "recruiter_id": "22222222-2222-2222-2222-222222222222",
                "role_id": "33333333-3333-3333-3333-333333333333",
                "title": "SDE Interview Round 1",
                "interview_year": 2025,
                "round_name": "Technical",
                "experience_text": "Great interview experience",
                "source_type": "demo",
                "source_name": "Demo Source",
                "source_url": "https://example.com/demo",
                "verification_status": "unverified",
                "created_at": "2026-01-01T00:00:00Z",
                "questions": [
                    {
                        "id": "55555555-5555-5555-5555-555555555555",
                        "experience_id": "44444444-4444-4444-4444-444444444444",
                        "question_text": "What is Python GIL?",
                        "topic": "Python",
                        "difficulty": "medium",
                        "question_type": "technical",
                        "created_at": "2026-01-01T00:00:00Z",
                    }
                ],
            }
        ]

    async def get(self, path, *, params=None):
        self.last_path = path
        self.last_params = params

        if path == "recruiters":
            if params and "id" in params and params["id"].startswith("eq."):
                rec_id = params["id"][3:]
                found = [r for r in self.mock_recruiters if r["id"] == rec_id]
                return found
            return self.mock_recruiters

        elif path == "roles":
            if params and "id" in params and params["id"].startswith("eq."):
                role_id = params["id"][3:]
                found = [r for r in self.mock_roles if r["id"] == role_id]
                return found
            return self.mock_roles

        elif path == "interview_experiences":
            if params and "role_id" in params and params["role_id"].startswith("eq."):
                r_id = params["role_id"][3:]
                found = [e for e in self.mock_experiences if e["role_id"] == r_id]
                return found
            return self.mock_experiences

        return []


@pytest.fixture
def intelligence_supabase(authenticated_client):
    service = IntelligenceSupabaseService()
    from app.main import app
    app.dependency_overrides[get_supabase_service] = lambda: service
    return service


def test_unauthenticated_requests_are_rejected(client):
    res1 = client.get('/api/recruiters')
    assert res1.status_code == 401

    res2 = client.get('/api/roles')
    assert res2.status_code == 401


def test_recruiter_list_and_filters(authenticated_client, intelligence_supabase):
    response = authenticated_client.get(
        '/api/recruiters?search=Acme&verification_status=verified&limit=10&offset=0',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]['name'] == 'Acme Corp'
    assert intelligence_supabase.last_params['name'] == 'ilike.*Acme*'
    assert intelligence_supabase.last_params['verification_status'] == 'eq.verified'
    assert intelligence_supabase.last_params['limit'] == '10'
    assert intelligence_supabase.last_params['offset'] == '0'


def test_recruiter_detail_success_and_404(authenticated_client, intelligence_supabase):
    # Success
    response = authenticated_client.get(
        '/api/recruiters/22222222-2222-2222-2222-222222222222',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response.status_code == 200
    assert response.json()['name'] == 'Acme Corp'

    # 404
    response_404 = authenticated_client.get(
        '/api/recruiters/00000000-0000-0000-0000-000000000000',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response_404.status_code == 404


def test_role_list_and_filters(authenticated_client, intelligence_supabase):
    response = authenticated_client.get(
        '/api/roles?recruiter_id=22222222-2222-2222-2222-222222222222&job_type=full-time&search=Software',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]['title'] == 'Software Engineer'
    assert intelligence_supabase.last_params['recruiter_id'] == 'eq.22222222-2222-2222-2222-222222222222'
    assert intelligence_supabase.last_params['job_type'] == 'eq.full-time'
    assert intelligence_supabase.last_params['title'] == 'ilike.*Software*'


def test_role_detail_success_and_404(authenticated_client, intelligence_supabase):
    response = authenticated_client.get(
        '/api/roles/33333333-3333-3333-3333-333333333333',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response.status_code == 200
    data = response.json()
    assert data['title'] == 'Software Engineer'
    assert data['recruiter']['name'] == 'Acme Corp'

    response_404 = authenticated_client.get(
        '/api/roles/00000000-0000-0000-0000-000000000000',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response_404.status_code == 404


def test_interview_experiences_and_questions_retrieval(authenticated_client, intelligence_supabase):
    response = authenticated_client.get(
        '/api/roles/33333333-3333-3333-3333-333333333333/interview-experiences',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    exp = data[0]
    assert exp['title'] == 'SDE Interview Round 1'
    # Check source provenance fields
    assert exp['source_type'] == 'demo'
    assert exp['source_name'] == 'Demo Source'
    assert exp['source_url'] == 'https://example.com/demo'
    assert exp['verification_status'] == 'unverified'

    # Check questions
    assert len(exp['questions']) == 1
    assert exp['questions'][0]['question_text'] == 'What is Python GIL?'


def test_interview_experiences_nonexistent_role(authenticated_client, intelligence_supabase):
    response = authenticated_client.get(
        '/api/roles/00000000-0000-0000-0000-000000000000/interview-experiences',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response.status_code == 404


def test_pagination_validation(authenticated_client):
    # Invalid limit < 1
    response = authenticated_client.get(
        '/api/recruiters?limit=0',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response.status_code == 422

    # Invalid limit > 100
    response = authenticated_client.get(
        '/api/recruiters?limit=101',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response.status_code == 422

    # Invalid negative offset
    response = authenticated_client.get(
        '/api/roles?offset=-1',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response.status_code == 422
