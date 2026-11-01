# CareerPilot

Student career-intelligence platform for Guru Nanak Dev Engineering College (GNDEC). This repository currently ships the **frontend foundation and UI shell** only — no auth, backend, or AI features yet.

## Stack

- React 18 + Vite
- JavaScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- React Router
- Lucide React

## Quick start

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite development server |
| `npm run build` | Production build to `frontend/dist` |
| `npm run preview` | Preview the production build |

## Routes

| Path | Page |
| --- | --- |
| `/dashboard` | Overview |
| `/roadmaps` | DSA / Dev / Aptitude / Core CS roadmaps |
| `/recruiters` | Sample company directory |
| `/internships` | Sample internship listings + filters |
| `/skills` | Demo skill scores by category |
| `/profile` | Editable local student profile form |

## Project structure

```text
frontend/
  public/
  src/
    components/
      layout/     # Sidebar, TopBar, DashboardLayout
      ui/         # Card, Badge, ProgressBar, etc.
    data/         # Centralized demo data
    pages/        # Route pages
    App.jsx
    main.jsx
    index.css
```

## Scope notes

- All company, internship, and skill values are **clearly labelled demo/sample data**.
- Profile edits stay in component state for this phase.
- Planned later: Supabase/auth, FastAPI, AI interviews, matching, and live data.

## License

Private / team project for Hacknauts 2.0 unless otherwise stated.
