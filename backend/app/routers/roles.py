"""Role and experience endpoints."""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.intelligence import RoleResponse, ExperienceResponse
from app.services.supabase import SupabaseAPIError, SupabaseService, get_supabase_service

router = APIRouter(prefix='/roles', tags=['roles'])


def _raise_database_error(error: SupabaseAPIError) -> None:
    if error.status_code in {401, 403}:
        raise HTTPException(status_code=401, detail='Unable to access intelligence data') from error
    if error.status_code == 404:
        raise HTTPException(status_code=404, detail='Resource not found') from error
    if error.status_code == 503:
        raise HTTPException(status_code=503, detail='Intelligence service unavailable') from error
    raise HTTPException(status_code=502, detail='Intelligence service request failed') from error


@router.get('', response_model=list[RoleResponse], summary='List roles')
async def list_roles(
    recruiter_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> list[RoleResponse]:
    """List roles with optional filtering."""

    params: dict[str, Any] = {'limit': str(limit), 'offset': str(offset), 'order': 'title'}

    if recruiter_id:
        params['recruiter_id'] = f'eq.{recruiter_id}'
    if job_type:
        params['job_type'] = f'eq.{job_type}'
    if search:
        params['title'] = f'ilike.*{search}*'

    try:
        rows = await supabase.get('roles', params=params)
    except SupabaseAPIError as error:
        _raise_database_error(error)

    if not isinstance(rows, list):
        return []

    return [RoleResponse.model_validate(row) for row in rows]


@router.get('/{role_id}', response_model=RoleResponse, summary='Get role details')
async def get_role(
    role_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> RoleResponse:
    """Return role details with recruiter information."""

    try:
        # Use a join to get recruiter info: select=*,recruiter:recruiters(*)
        rows = await supabase.get(
            'roles',
            params={'id': f'eq.{role_id}', 'limit': '1', 'select': '*,recruiter:recruiters(*)'},
        )
    except SupabaseAPIError as error:
        _raise_database_error(error)

    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail='Role not found')

    return RoleResponse.model_validate(rows[0])


@router.get('/{role_id}/interview-experiences', response_model=list[ExperienceResponse], summary='Get role interview experiences')
async def get_role_experiences(
    role_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> list[ExperienceResponse]:
    """Return experiences for the role, including questions."""

    # Verify role existence first
    await get_role(role_id, current_user, supabase)

    try:
        # Join with questions: select=*,questions:interview_questions(*)
        rows = await supabase.get(
            'interview_experiences',
            params={'role_id': f'eq.{role_id}', 'select': '*,questions:interview_questions(*)'},
        )
    except SupabaseAPIError as error:
        _raise_database_error(error)

    if not isinstance(rows, list):
        return []

    return [ExperienceResponse.model_validate(row) for row in rows]
