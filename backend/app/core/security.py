"""Supabase bearer-token verification dependencies."""

from dataclasses import dataclass
from typing import Any, Optional

import httpx
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings


_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedUser:
    """Verified Supabase identity plus the request's access token."""

    id: str
    email: Optional[str]
    full_name: Optional[str]
    access_token: str
    raw_user: dict[str, Any]


def _unauthorized(detail: str = 'Invalid or expired authorization token') -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={'WWW-Authenticate': 'Bearer'},
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    """Verify the request token through Supabase Auth's user endpoint.

    The user ID is taken only from Supabase's verified response. The API never
    trusts a user ID supplied by the frontend and never decodes JWT claims alone.
    """

    if credentials is None or credentials.scheme.lower() != 'bearer' or not credentials.credentials:
        raise _unauthorized('Missing or malformed bearer token')

    if not settings.is_supabase_configured:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Supabase authentication is not configured',
        )

    token = credentials.credentials
    headers = {
        'apikey': settings.supabase_publishable_key or '',
        'Authorization': f'Bearer {token}',
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f'{settings.supabase_url.rstrip("/")}/auth/v1/user',
                headers=headers,
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Authentication service unavailable',
        ) from exc

    if response.status_code != status.HTTP_200_OK:
        raise _unauthorized()

    try:
        user_data = response.json()
    except ValueError as exc:
        raise _unauthorized() from exc

    user_id = user_data.get('id')
    if not isinstance(user_id, str) or not user_id:
        raise _unauthorized()

    metadata = user_data.get('user_metadata')
    if not isinstance(metadata, dict):
        metadata = {}

    full_name = metadata.get('full_name') or metadata.get('name')
    if not isinstance(full_name, str):
        full_name = None

    return AuthenticatedUser(
        id=user_id,
        email=user_data.get('email') if isinstance(user_data.get('email'), str) else None,
        full_name=full_name,
        access_token=token,
        raw_user=user_data,
    )
