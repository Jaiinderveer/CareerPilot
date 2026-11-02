"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import health, profiles, recruiters, roles, users

settings = get_settings()

app = FastAPI(
    title='CareerPilot Backend',
    description='Authenticated API for CareerPilot student profiles and career intelligence.',
    version='0.1.0',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(health.router)
app.include_router(users.router, prefix='/api')
app.include_router(profiles.router, prefix='/api')
app.include_router(recruiters.router, prefix='/api')
app.include_router(roles.router, prefix='/api')


@app.get('/', include_in_schema=False)
async def root() -> dict[str, str]:
    return {'service': 'careerpilot-backend', 'version': '0.1.0'}
