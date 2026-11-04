# CareerPilot Frontend

React/Vite frontend for CareerPilot.

## Local setup

```bash
npm install
Copy-Item .env.example .env # Windows PowerShell
# cp .env.example .env      # macOS/Linux
npm run dev
```

Configure:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
VITE_API_URL=http://localhost:8000
```

Only publishable/anon Supabase credentials are allowed in frontend environment variables. Never expose a service-role key in the browser.

## Commands

- `npm run dev` — start Vite development server
- `npm run build` — create the production build
- `npm run preview` — preview the production build

## Data boundaries

- `/profile` uses the authenticated FastAPI profile API when Supabase is configured.
- `/recruiters` uses authenticated backend career-resource endpoints.
- `/roadmaps`, `/internships`, and `/skills` display explicit demo/sample data.
- Dashboard metrics and activity are also demo/sample UI data unless marked otherwise.

Demo data is not a claim of live openings, placement-drive participation, personalized recommendations, or AI-assessed skills.
