"""CORS preflight and origin tests for the CareerPilot API."""

from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import app


def _client_with(origins: str) -> TestClient:
    settings = Settings(
        SUPABASE_URL='https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY='test-publishable-key',
        FRONTEND_ORIGIN=origins,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)


def test_preflight_from_production_origin_returns_allow_origin():
    client = _client_with(
        'https://career-pilot-nine-omega.vercel.app,http://localhost:5173'
    )
    response = client.options(
        '/api/me/profile',
        headers={
            'Origin': 'https://career-pilot-nine-omega.vercel.app',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Authorization, Content-Type',
        },
    )

    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == (
        'https://career-pilot-nine-omega.vercel.app'
    )
    assert response.headers['access-control-allow-credentials'] == 'true'
    assert 'GET' in response.headers['access-control-allow-methods']
    assert 'PATCH' in response.headers['access-control-allow-methods']
    assert 'Authorization' in response.headers['access-control-allow-headers']


def test_preflight_from_localhost_returns_allow_origin():
    client = _client_with(
        'https://career-pilot-nine-omega.vercel.app,http://localhost:5173'
    )
    response = client.options(
        '/api/me/profile',
        headers={
            'Origin': 'http://localhost:5173',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Authorization, Content-Type',
        },
    )

    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'
    assert response.headers['access-control-allow-credentials'] == 'true'


def test_unapproved_origin_does_not_receive_permissive_cors_headers():
    client = _client_with(
        'https://career-pilot-nine-omega.vercel.app,http://localhost:5173'
    )
    response = client.options(
        '/api/me/profile',
        headers={
            'Origin': 'https://evil.example.com',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Authorization, Content-Type',
        },
    )

    # Disallowed origins are rejected without permissive CORS headers.
    assert 'access-control-allow-origin' not in response.headers


def test_allowed_origins_property_parses_comma_separated_list():
    settings = Settings(
        SUPABASE_URL='https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY='test-publishable-key',
        FRONTEND_ORIGIN='https://a.example.com, https://b.example.com , http://localhost:5173',
    )

    assert settings.allowed_origins == [
        'https://a.example.com',
        'https://b.example.com',
        'http://localhost:5173',
    ]


def test_simple_get_from_allowed_origin_returns_allow_origin_header():
    client = _client_with('http://localhost:5173')
    response = client.get('/health', headers={'Origin': 'http://localhost:5173'})

    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'


def test_simple_get_from_unapproved_origin_has_no_allow_origin_header():
    client = _client_with('http://localhost:5173')
    response = client.get('/health', headers={'Origin': 'https://evil.example.com'})

    assert response.status_code == 200
    assert 'access-control-allow-origin' not in response.headers
