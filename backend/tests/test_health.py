"""Health endpoint tests."""


def test_health_endpoint(client):
    response = client.get('/health')

    assert response.status_code == 200
    assert response.json() == {
        'status': 'ok',
        'service': 'careerpilot-backend',
    }
