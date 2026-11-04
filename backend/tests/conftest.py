"""Shared pytest fixtures for backend tests."""

from collections.abc import Iterator
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser, get_current_user
from app.main import app
from app.services.supabase import get_supabase_service


@pytest.fixture
def settings() -> Settings:
    return Settings(
        SUPABASE_URL='https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY='test-publishable-key',
        FRONTEND_ORIGIN='http://localhost:5173',
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app.dependency_overrides[get_settings] = lambda: settings
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def authenticated_user() -> AuthenticatedUser:
    return AuthenticatedUser(
        id='11111111-1111-1111-1111-111111111111',
        email='student@example.com',
        full_name='Test Student',
        access_token='test-access-token',
        raw_user={},
    )


@pytest.fixture
def authenticated_client(client: TestClient, authenticated_user: AuthenticatedUser):
    app.dependency_overrides[get_current_user] = lambda: authenticated_user
    return client


class FakeSupabaseService:
    """In-memory service double that records the scoped PostgREST call."""

    def __init__(self) -> None:
        self.get_params = None
        self.patch_path = None
        self.patch_data = None
        self.rows = [{
            'id': '11111111-1111-1111-1111-111111111111',
            'full_name': 'Test Student',
            'college': 'GNDEC',
            'branch': 'CSE',
            'graduation_year': 2026,
            'cgpa': 8.5,
            'location': 'Ludhiana',
            'skills': ['React'],
            'career_interests': ['Backend'],
            'created_at': '2026-01-01T00:00:00Z',
            'updated_at': '2026-01-01T00:00:00Z',
        }]

    async def get(self, path, *, params=None):
        self.get_params = params
        return self.rows

    async def patch(self, path, data):
        self.patch_path = path
        self.patch_data = data
        self.rows[0].update(data)
        return self.rows


@pytest.fixture
def fake_supabase(authenticated_client: TestClient):
    service = FakeSupabaseService()
    app.dependency_overrides[get_supabase_service] = lambda: service
    return service
