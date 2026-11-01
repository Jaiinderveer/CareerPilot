"""Authenticated profile endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.services.supabase import SupabaseAPIError, SupabaseService, get_supabase_service

router = APIRouter(tags=['profiles'])


def _profile_response(row: dict[str, Any]) -> ProfileResponse:
    return ProfileResponse.model_validate({
        **row,
        'skills': row.get('skills') or [],
        'career_interests': row.get('career_interests') or [],
    })


def _raise_database_error(error: SupabaseAPIError) -> None:
    if error.status_code in {401, 403}:
        raise HTTPException(status_code=401, detail='Unable to access the authenticated profile') from error
    if error.status_code == 404:
        raise HTTPException(status_code=404, detail='Profile not found') from error
    if error.status_code == 503:
        raise HTTPException(status_code=503, detail='Profile service unavailable') from error
    raise HTTPException(status_code=502, detail='Profile service request failed') from error


@router.get('/me/profile', response_model=ProfileResponse, summary='Get current user profile')
async def get_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> ProfileResponse:
    """Fetch only the profile whose ID matches the verified Auth user."""

    try:
        rows = await supabase.get(
            'profiles',
            params={'id': f'eq.{current_user.id}', 'limit': '1'},
        )
    except SupabaseAPIError as error:
        _raise_database_error(error)

    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail='Profile not found')

    return _profile_response(rows[0])


@router.patch('/me/profile', response_model=ProfileResponse, summary='Update current user profile')
async def update_profile(
    profile: ProfileUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> ProfileResponse:
    """Apply a validated partial update to only the verified user's profile."""

    update_data = profile.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='At least one profile field is required',
        )

    try:
        rows = await supabase.patch(
            f'profiles?id=eq.{current_user.id}',
            update_data,
        )
    except SupabaseAPIError as error:
        _raise_database_error(error)

    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail='Profile not found')

    return _profile_response(rows[0])
