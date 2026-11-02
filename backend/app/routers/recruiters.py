"""Recruiter endpoints."""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.intelligence import RecruiterResponse
from app.services.supabase import SupabaseAPIError, SupabaseService, get_supabase_service

router = APIRouter(prefix='/recruiters', tags=['recruiters'])


def _raise_database_error(error: SupabaseAPIError) -> None:
    if error.status_code in {401, 403}:
        raise HTTPException(status_code=401, detail='Unable to access recruiter data') from error
    if error.status_code == 404:
        raise HTTPException(status_code=404, detail='Recruiter not found') from error
    if error.status_code == 503:
        raise HTTPException(status_code=503, detail='Recruiter service unavailable') from error
    raise HTTPException(status_code=502, detail='Recruiter service request failed') from error


@router.get('', response_model=list[RecruiterResponse], summary='List recruiters')
async def list_recruiters(
    search: Optional[str] = Query(None),
    verification_status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> list[RecruiterResponse]:
    """List recruiters with optional search and filtering."""

    params: dict[str, Any] = {'limit': str(limit), 'offset': str(offset), 'order': 'name'}

    if search:
        params['name'] = f'ilike.*{search}*'
    if verification_status:
        params['verification_status'] = f'eq.{verification_status}'

    try:
        rows = await supabase.get('recruiters', params=params)
    except SupabaseAPIError as error:
        _raise_database_error(error)

    if not isinstance(rows, list):
        return []

    return [RecruiterResponse.model_validate(row) for row in rows]


@router.get('/{recruiter_id}', response_model=RecruiterResponse, summary='Get recruiter details')
async def get_recruiter(
    recruiter_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> RecruiterResponse:
    """Return recruiter details by ID."""

    try:
        rows = await supabase.get(
            'recruiters',
            params={'id': f'eq.{recruiter_id}', 'limit': '1'},
        )
    except SupabaseAPIError as error:
        _raise_database_error(error)

    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail='Recruiter not found')

    return RecruiterResponse.model_validate(rows[0])
