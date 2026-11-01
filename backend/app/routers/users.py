"""User endpoints for CareerPilot backend."""

from fastapi import APIRouter, Depends

from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.profile import MeResponse

router = APIRouter(tags=['users'])


@router.get('/me', response_model=MeResponse, summary='Get current user info')
async def get_me(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> MeResponse:
    """Return identity information from the verified Supabase user response."""

    return MeResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
    )
