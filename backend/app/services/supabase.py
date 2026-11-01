"""Request-scoped Supabase PostgREST access."""

from typing import Any, Mapping, Optional

import httpx
from fastapi import Depends

from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser, get_current_user


class SupabaseAPIError(Exception):
    """Safe representation of an upstream Supabase failure."""

    def __init__(self, status_code: int) -> None:
        self.status_code = status_code
        super().__init__('Supabase request failed')


class SupabaseService:
    """Forward database calls with one user's JWT and the publishable key."""

    def __init__(self, settings: Settings, access_token: str) -> None:
        self._settings = settings
        self._access_token = access_token

    @property
    def base_url(self) -> str:
        assert self._settings.supabase_url is not None
        return f'{self._settings.supabase_url.rstrip("/")}/rest/v1'

    def _headers(self, *, return_representation: bool = False) -> dict[str, str]:
        headers = {
            'apikey': self._settings.supabase_publishable_key or '',
            'Authorization': f'Bearer {self._access_token}',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        }
        if return_representation:
            headers['Prefer'] = 'return=representation'
        return headers

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Mapping[str, Any]] = None,
        json: Optional[dict[str, Any]] = None,
        return_representation: bool = False,
    ) -> Any:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.request(
                    method,
                    f'{self.base_url}/{path.lstrip("/")}',
                    headers=self._headers(return_representation=return_representation),
                    params=params,
                    json=json,
                )
        except httpx.RequestError as exc:
            raise SupabaseAPIError(503) from exc

        if response.is_error:
            raise SupabaseAPIError(response.status_code)

        try:
            return response.json()
        except ValueError as exc:
            raise SupabaseAPIError(502) from exc

    async def get(self, path: str, *, params: Optional[Mapping[str, Any]] = None) -> Any:
        return await self._request('GET', path, params=params)

    async def patch(self, path: str, data: dict[str, Any]) -> Any:
        return await self._request(
            'PATCH',
            path,
            json=data,
            return_representation=True,
        )


async def get_supabase_service(
    current_user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> SupabaseService:
    """Create a service carrying only the current request's verified token."""

    return SupabaseService(settings, current_user.access_token)
