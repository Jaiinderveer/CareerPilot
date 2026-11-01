"""Authentication dependency tests."""

import pytest

from app.core import security


class FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class FakeAsyncClient:
    response = FakeResponse(200, {
        'id': '11111111-1111-1111-1111-111111111111',
        'email': 'student@example.com',
        'user_metadata': {'full_name': 'Test Student'},
    })
    last_headers = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def get(self, url, *, headers):
        type(self).last_headers = headers
        return type(self).response


@pytest.fixture
def fake_auth_client(monkeypatch):
    monkeypatch.setattr(security.httpx, 'AsyncClient', FakeAsyncClient)


def test_missing_authorization_returns_401(client):
    response = client.get('/api/me')

    assert response.status_code == 401
    assert response.json()['detail'] == 'Missing or malformed bearer token'


def test_invalid_supabase_token_returns_401(client, fake_auth_client):
    FakeAsyncClient.response = FakeResponse(401, {'message': 'invalid token'})

    response = client.get('/api/me', headers={'Authorization': 'Bearer invalid-token'})

    assert response.status_code == 401
    assert response.json()['detail'] == 'Invalid or expired authorization token'


def test_valid_token_allows_access_to_me(client, fake_auth_client):
    FakeAsyncClient.response = FakeResponse(200, {
        'id': '11111111-1111-1111-1111-111111111111',
        'email': 'student@example.com',
        'user_metadata': {'full_name': 'Test Student'},
    })

    response = client.get('/api/me', headers={'Authorization': 'Bearer valid-token'})

    assert response.status_code == 200
    assert response.json() == {
        'id': '11111111-1111-1111-1111-111111111111',
        'email': 'student@example.com',
        'full_name': 'Test Student',
    }
    assert FakeAsyncClient.last_headers == {
        'apikey': 'test-publishable-key',
        'Authorization': 'Bearer valid-token',
    }
