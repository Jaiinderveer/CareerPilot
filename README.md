# CareerPilot

Student career-intelligence platform for Guru Nanak Dev Engineering College (GNDEC). This repository includes a React frontend, a FastAPI backend, and Supabase integration.

## Current scope

CareerPilot is in a pre-hackathon readiness phase. Authentication, authenticated profile reads and updates, recruiter resources, and API foundations are implemented. Roadmaps, internship listings, skills, and several dashboard metrics are intentionally demo/sample UI data.

The app does **not** currently claim to provide:

- verified GNDEC placement-drive participation;
- live internship openings or application deadlines;
- personalized recruiter recommendations;
- AI-assessed skill measurements; or
- production placement outcomes.

## Stack

- React 18 + Vite
- JavaScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- React Router
- Lucide React
- FastAPI + Pydantic
- Supabase Auth + PostgreSQL/PostgREST

## Repository structure

```text
backend/
  app/                 # FastAPI application, routers, schemas, services
  tests/               # Backend API and auth tests
  .env.example         # Backend configuration template
frontend/
  src/
    components/        # Shared layout and UI components
    context/           # Supabase auth/session state
    data/              # Explicit demo/sample data
    pages/              # Route pages
    services/           # Supabase and backend API clients
  .env.example         # Frontend configuration template
database/
  migrations/          # Ordered SQL migrations; apply manually in Supabase
.github/workflows/
  ci.yml               # Frontend build and backend test checks
```

## Local development

### Backend

Prerequisites: Python 3.10+ and a Supabase project with Auth and PostgreSQL configured.

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
Copy-Item .env.example .env # Windows PowerShell
# cp .env.example .env      # macOS/Linux
uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`. API docs are available at `/docs` and `/redoc`.

Required backend environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
FRONTEND_ORIGIN=http://localhost:5173
```

The backend forwards the signed-in user's JWT to Supabase PostgREST. It does not use or expose a service-role key.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
Copy-Item .env.example .env # Windows PowerShell
# cp .env.example .env      # macOS/Linux
npm run dev
```

The frontend runs at `http://localhost:5173`.

Frontend environment variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
VITE_API_URL=http://localhost:8000
```

Only publishable/anon Supabase credentials belong in the frontend. Never put a service-role key in `frontend/.env` or commit any `.env` file.

## Scripts and checks

Frontend:

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite development server |
| `npm run build` | Create the production frontend build |
| `npm run preview` | Preview the production build |

Backend:

| Command | Description |
| --- | --- |
| `uvicorn app.main:app --reload` | Start the development API server |
| `pytest` | Run backend tests |

From the repository root, the CI-equivalent checks are:

```bash
cd frontend && npm ci && npm run build
cd ../backend && python -m pip install -r requirements.txt && pytest
```

## Routes

| Path | Page | Data boundary |
| --- | --- | --- |
| `/dashboard` | Overview | Mixed authenticated identity and demo metrics |
| `/roadmaps` | DSA / Dev / Aptitude / Core CS roadmaps | Demo/sample data |
| `/recruiters` | Company career-resource directory | Authenticated API data; not placement-drive confirmation |
| `/internships` | Internship listings + filters | Demo/sample data; not live openings |
| `/skills` | Skill scores by category | Demo/sample data; not AI assessment |
| `/profile` | Student profile form | Authenticated API data, or session-only demo mode |
| `/account-settings` | Password and provider settings | Supabase Auth |

## Database migrations

SQL files in `database/migrations/` are ordered and must be reviewed and applied manually in the intended Supabase project. This repository does not execute migrations automatically. Do not run migration SQL against production without an explicit review and approval process.

## Deployment readiness

Before deploying:

1. Configure the frontend and backend environment variables in the hosting provider; do not upload `.env` files.
2. Set `FRONTEND_ORIGIN` to the exact deployed frontend origin, including scheme and port where applicable.
3. Set `VITE_API_URL` to the deployed backend URL.
4. Configure Supabase Auth redirect URLs for the deployed frontend and verify Google OAuth settings.
5. Confirm database migrations and RLS policies are applied in the target Supabase project.
6. Run the frontend build and backend tests in CI.
7. Check `/health` and the authenticated `/api/me/profile` flow in a staging environment before announcing a deployment.

## Security boundaries

- Email confirmation remains controlled by Supabase Auth and is not disabled by this app.
- Authenticated API routes verify the Supabase access token and scope profile access to the verified user ID.
- No passwords are logged or stored by CareerPilot.
- No service-role credentials are used by the React app or committed to the repository.
- Existing users are not deleted or duplicated by profile provisioning.

## License

Private / team project for Hacknauts 2.0 unless otherwise stated.
