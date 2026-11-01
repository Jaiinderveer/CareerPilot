# CareerPilot Backend

## Overview

This is the FastAPI backend for the CareerPilot platform, designed to work with the React frontend.

## Architecture

- **FastAPI** backend service
- **Supabase** for authentication and database access
- **PostgreSQL** database with Row Level Security (RLS)
- **Pydantic** for data validation
- **FastAPI** built-in documentation (Swagger at /docs, ReDoc at /redoc)
- **CORS** configured for frontend development

## Prerequisites

- Python 3.10+
- Python virtual environment
- Supabase project with Auth and PostgreSQL
- Node.js and npm for frontend development (separate from this backend)

## Setup

### 1. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Configure `.env` file with your Supabase credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
FRONTEND_ORIGIN=http://localhost:5173
```

### 3. Start Development Server
```bash
uvicorn app.main:app --reload
```

### 4. Access Documentation
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Health Check
- `GET /health` - Returns status check

### User Information
- `GET /api/me` - Returns verified user identity (ID, email, full_name)

### Profile Endpoints

- `GET /api/me/profile` - Get current user's profile data
- `PATCH /api/me/profile` - Update current user's profile (partial updates)

## Authentication

All protected endpoints require a valid Bearer token in the Authorization header. The token is verified against Supabase Auth by making a request to `/auth/v1/user` with the token and Supabase publishable key.

## Testing

Tests are located in the `tests/` directory and can be run with:
```bash
pytest
```

## Security Considerations

- All requests are scoped to the authenticated user's JWT
- Supabase RLS policies enforce database access restrictions
- No service-role keys are used
- No sensitive data is logged or exposed in API responses

## Deployment

This backend is designed to be deployed to Render or similar PaaS platforms.