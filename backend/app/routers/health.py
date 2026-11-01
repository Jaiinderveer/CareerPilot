"""Health check router for CareerPilot backend."""

from fastapi import APIRouter

router = APIRouter(tags=['health'])


@router.get('/health', summary='Health check')
async def health_check() -> dict:
    """Return a simple JSON status response."""
    return {'status': 'ok', 'service': 'careerpilot-backend'}