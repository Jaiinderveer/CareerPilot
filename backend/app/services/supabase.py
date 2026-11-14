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
    """Forward database calls with a scoped user or service-role credential."""

    def __init__(self, settings: Settings, access_token: str, *, service_role: bool = False) -> None:
        self._settings = settings
        self._access_token = access_token
        self._service_role = service_role

    @property
    def base_url(self) -> str:
        assert self._settings.supabase_url is not None
        return f'{self._settings.supabase_url.rstrip("/")}/rest/v1'

    def _headers(self, *, return_representation: bool = False) -> dict[str, str]:
        headers = {
            'apikey': (
                self._settings.supabase_service_role_key
                if self._service_role
                else self._settings.supabase_publishable_key
            ) or '',
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
        prefer: str | None = None,
    ) -> Any:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.request(
                    method,
                    f'{self.base_url}/{path.lstrip("/")}',
                    headers=(self._headers(return_representation=return_representation) | ({'Prefer': prefer} if prefer else {})),
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

    async def post(self, path: str, data: dict[str, Any]) -> Any:
        return await self._request(
            'POST',
            path,
            json=data,
            return_representation=True,
        )

    async def patch(self, path: str, data: dict[str, Any]) -> Any:
        return await self._request(
            'PATCH',
            path,
            json=data,
            return_representation=True,
        )

    async def upsert(self, path: str, data: dict[str, Any]) -> Any:
        return await self._request(
            'POST',
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


async def get_service_role_supabase(
    settings: Settings = Depends(get_settings),
) -> SupabaseService | None:
    """Create an admin database service for server-owned writes only."""

    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None
    return SupabaseService(
        settings,
        settings.supabase_service_role_key,
        service_role=True,
    )
