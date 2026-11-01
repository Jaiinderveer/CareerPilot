"""Profile endpoint and validation tests."""


def test_authenticated_user_can_fetch_profile(authenticated_client, fake_supabase):
    response = authenticated_client.get(
        '/api/me/profile',
        headers={'Authorization': 'Bearer test-access-token'},
    )

    assert response.status_code == 200
    assert response.json()['id'] == '11111111-1111-1111-1111-111111111111'
    assert fake_supabase.get_params == {
        'id': 'eq.11111111-1111-1111-1111-111111111111',
        'limit': '1',
    }


def test_profile_update_accepts_valid_data(authenticated_client, fake_supabase):
    response = authenticated_client.patch(
        '/api/me/profile',
        headers={'Authorization': 'Bearer test-access-token'},
        json={
            'full_name': 'Updated Student',
            'cgpa': 9.25,
            'skills': ['Python', 'FastAPI'],
        },
    )

    assert response.status_code == 200
    assert response.json()['full_name'] == 'Updated Student'
    assert fake_supabase.patch_path == 'profiles?id=eq.11111111-1111-1111-1111-111111111111'
    assert fake_supabase.patch_data == {
        'full_name': 'Updated Student',
        'cgpa': 9.25,
        'skills': ['Python', 'FastAPI'],
    }


def test_invalid_cgpa_is_rejected(authenticated_client, fake_supabase):
    response = authenticated_client.patch(
        '/api/me/profile',
        headers={'Authorization': 'Bearer test-access-token'},
        json={'cgpa': 10.1},
    )

    assert response.status_code == 422
    assert fake_supabase.patch_data is None


def test_unexpected_profile_fields_are_rejected(authenticated_client, fake_supabase):
    response = authenticated_client.patch(
        '/api/me/profile',
        headers={'Authorization': 'Bearer test-access-token'},
        json={'id': 'another-user-id'},
    )

    assert response.status_code == 422
    assert fake_supabase.patch_data is None


def test_empty_profile_update_is_rejected(authenticated_client, fake_supabase):
    response = authenticated_client.patch(
        '/api/me/profile',
        headers={'Authorization': 'Bearer test-access-token'},
        json={},
    )

    assert response.status_code == 400
    assert fake_supabase.patch_data is None
