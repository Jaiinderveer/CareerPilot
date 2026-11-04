# CareerPilot Backend

FastAPI API for authenticated CareerPilot features. The service verifies Supabase access tokens and forwards the signed-in user's JWT to Supabase PostgREST for user-scoped data access.

## Architecture

- FastAPI backend service
- Supabase Auth for identity and access tokens
- PostgreSQL/PostgREST for persistence
- Pydantic for request and response validation
- CORS restricted to the configured frontend origin
- No service-role key required

## Prerequisites

- Python 3.10+
- Python virtual environment
- Supabase project with Auth, PostgreSQL, and the reviewed migrations applied
- Node.js and npm for the frontend

## Setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
FRONTEND_ORIGIN=http://localhost:5173
```

`SUPABASE_ANON_KEY` is accepted as a legacy fallback by the configuration, but new deployments should use `SUPABASE_PUBLISHABLE_KEY`. Never add a service-role key to this repository or the frontend.

## Run

```bash
uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Health check: `GET /health`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API endpoints

All `/api/*` endpoints require `Authorization: Bearer <supabase-access-token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/me` | Return verified user identity |
| `GET` | `/api/me/profile` | Return the current user's profile |
| `PATCH` | `/api/me/profile` | Apply a validated partial update to the current user's profile |
| `GET` | `/api/recruiters` | Return approved career-resource entries |
| `GET` | `/api/recruiters/{id}` | Return one approved career-resource entry |
| `GET` | `/api/roles` | Return approved roles/experiences data |

Profile updates are intentionally scoped to the verified token subject; the client cannot choose another profile ID.

## Testing

Run from the `backend` directory:

```bash
pytest
```

The tests use fakes for upstream Supabase calls and do not execute SQL or modify a production project.

## Database migrations

Migrations live in `../database/migrations/`. They are ordered SQL files for manual review and execution in the intended Supabase project. The backend does not execute migrations automatically.

## Deployment checklist

1. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the exact deployed `FRONTEND_ORIGIN`.
2. Use a managed secret store for environment variables.
3. Run `pytest` in CI before deployment.
4. Confirm the deployed service returns success from `/health`.
5. Confirm the frontend's `VITE_API_URL` points to this service.
6. Configure Supabase Auth redirect URLs and Google OAuth for the deployed frontend.
7. Verify RLS and reviewed migrations in staging before production.

## Security considerations

- Authenticated requests are verified against Supabase Auth.
- PostgREST requests use the current user's JWT, preserving user-scoped RLS behavior.
- Passwords are handled only by Supabase Auth and are never logged or stored by this service.
- Error responses intentionally avoid returning upstream credentials or sensitive details.
