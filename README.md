# Oppulse AI

![Oppulse AI logo](frontend/public/brand/oppulse-mark.svg)

**A student opportunity workspace that turns scattered programme information into clear, evidence-backed decisions and stronger applications.**

Oppulse AI helps students discover scholarships, fellowships, internships, research programmes and summer schools; understand whether an opportunity is realistic; see the real cost; and move from “maybe” to a focused application plan.

This project is part of the **ThirdUni Program**.

> **Discover → Understand → Verify → Prepare → Apply → Monitor**

## Product promise

Students should not have to spend days comparing incomplete calls, hidden costs and unclear eligibility requirements. Oppulse brings the research into one workspace and keeps the student in control:

- opportunity claims retain their source and retrieval context;
- confirmed profile facts are separated from unconfirmed suggestions;
- eligibility is decided by deterministic rules, not by persuasive prose;
- costs, funding coverage and unresolved details remain visible;
- AI can propose research, explanations and drafts, but never submits anything on a student's behalf;
- every material change waits for student review and approval.

## What is included

### Student workspace

- adaptive onboarding that starts from a goal, CV/materials or an opportunity link;
- mission-based opportunity research;
- ranked opportunities with institution identity, country flags, funding and evidence;
- profile and CV review with provenance, conflicts, confirmation and privacy controls;
- application workspaces with requirements, tasks, deadlines and progress;
- writing studio with reviewable proposals and recoverable versions;
- scheduled monitoring and in-app alerts;
- a contextual assistant connected to the selected mission, opportunity or application.

### Trust and safety by design

- unconfirmed facts do not decide eligibility;
- protected personal details are kept outside model prompts;
- uploaded documents are private and ownership-checked;
- provider failures are explicit states, never silent empty results;
- simulated, live and unavailable capabilities are disclosed separately;
- source conflicts and unreachable pages remain visible;
- the system never sends an application or external message without confirmation.

## Current implementation

The repository contains the frontend, the FastAPI backend, the typed contract between them, deterministic replay fixtures, evaluation tests and deployment configuration.

| Area | Status |
|---|---|
| Public landing page and responsive UI | Complete |
| Onboarding and mission creation | Complete |
| Profile, CV and document consent flows | Complete |
| Deterministic eligibility and next-action rules | Complete |
| Opportunities, evidence and institution identity | Complete |
| Application workspace and writing proposals | Complete |
| Monitoring and in-app alerts | Complete |
| FastAPI endpoint mirror | Complete |
| Auth, rotating sessions and ownership checks | Complete |
| Durable document storage seam | Complete |
| Alembic migration and production startup path | Complete |
| Replay/mock mode without provider credentials | Complete |
| Groq model and web-search adapters | Ready for credentials |
| Supabase Postgres and private Storage | Ready for provisioning |
| Email delivery adapter | Ready for provider configuration |
| Azure deployment | Configuration/runbook ready; resources not provisioned |

“Complete” means implemented and covered by the repository's tests. Live provider and cloud rows still require external accounts, credentials, smoke tests and environment-specific provisioning.

## Architecture

```text
React + Vite + TypeScript
        │
        │ one typed HTTP client and one contract
        ▼
FastAPI + SQLAlchemy + Alembic
        │
        ├── deterministic rules and ownership checks
        ├── Groq structured-output model adapter
        ├── Tavily / Exa search adapters
        ├── private local or Supabase document storage
        └── configurable HTTP email adapter
```

The frontend uses the same HTTP contract in every mode:

- **Mock mode** — MSW serves deterministic synthetic fixtures in the browser.
- **Replay mode** — the backend runs the agent loop without network calls or keys.
- **Live mode** — the frontend calls the FastAPI service and the service calls only configured providers.

Switching from mock to live does not require component rewrites:

```env
VITE_API_MODE=live
VITE_API_BASE_URL=http://localhost:8000
```

## Run locally

### Frontend

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

The default frontend configuration uses deterministic mock data. For the local FastAPI service:

```env
VITE_API_MODE=live
VITE_API_BASE_URL=http://localhost:8000
VITE_PRODUCT_MODE=student_testing
VITE_SHOW_PROTOTYPE_BANNER=false
```

### Backend

```powershell
cd backend
uv sync --all-extras
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

Replay mode requires no provider keys:

```env
OPPULSE_ENVIRONMENT=local
OPPULSE_MODEL_PROVIDER=replay
OPPULSE_SEARCH_PROVIDER=replay
```

### Validation

```powershell
# Frontend
cd frontend
npm run typecheck
npm run format:check
npm run test -- --run
npm run build

# Backend
cd backend
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy app
uv run python scripts/check_contract.py
```

## Environment and secrets

Only public frontend settings may use the `VITE_` prefix:

```env
VITE_API_MODE=mock|live
VITE_API_BASE_URL=https://your-api-host
VITE_PRODUCT_MODE=demo|student_testing
VITE_SHOW_PROTOTYPE_BANNER=false
```

Provider keys and infrastructure credentials stay server-side:

```env
OPPULSE_DATABASE_URL=...
OPPULSE_JWT_SECRET=...
OPPULSE_MODEL_PROVIDER_KEY=...
OPPULSE_SEARCH_PROVIDER_KEY=...
OPPULSE_FALLBACK_SEARCH_PROVIDER_KEY=...
OPPULSE_SUPABASE_URL=...
OPPULSE_SUPABASE_SERVICE_ROLE_KEY=...
OPPULSE_EMAIL_PROVIDER_URL=...
OPPULSE_EMAIL_PROVIDER_KEY=...
```

Never commit `.env`, `.env.local`, database files, storage files, service-role keys, provider keys or signed URLs. Use Azure App Service settings or Key Vault for deployed environments. Keep staging and production Supabase projects, storage buckets and secrets separate.

See [docs/environments.md](docs/environments.md) for the boundary rules and [docs/azure-runbook.md](docs/azure-runbook.md) for the deployment sequence.

## Screenshots

The repository includes representative desktop and mobile flows:

- [Landing page](frontend/docs/screenshots/00-landing.png)
- [Onboarding](frontend/docs/screenshots/01b-onboarding.png)
- [Home workspace](frontend/docs/screenshots/02-home-workspace.png)
- [Opportunities](frontend/docs/screenshots/03-opportunities.png)
- [Profile and CV](frontend/docs/screenshots/06b-profile-passport.png)
- [Applications](frontend/docs/screenshots/07-applications.png)
- [Writing studio](frontend/docs/screenshots/09-writing-studio.png)
- [Monitoring](frontend/docs/screenshots/10-monitoring.png)
- [Mobile home](frontend/docs/screenshots/13-mobile-home.png)

## Deployment readiness

The deployment path is deliberately explicit:

1. provision separate staging resources;
2. configure the database and private storage;
3. install the migration before serving traffic;
4. configure exact CORS origins and secure cookies;
5. add provider keys through secret management;
6. run provider smoke tests;
7. verify `/health`, `/health/ready` and `/api/v1/capabilities`;
8. run the synthetic student journey;
9. only then invite students to staging.

The repository does not provision Azure, Supabase, email, search or model accounts automatically. Those are intentional external deployment inputs.

## Repository guide

| Path | Purpose |
|---|---|
| `frontend/src/` | React application, typed API client, UI components and tests |
| `frontend/public/brand/` | Oppulse logo source assets and transparent PNG exports |
| `backend/app/api/` | FastAPI routes |
| `backend/app/ai/` | Provider adapters, agent stages and boundaries |
| `backend/app/db/` | SQLAlchemy models and database session |
| `backend/migrations/` | Alembic migrations |
| `contracts/` | Frontend/backend route and entity contract |
| `docs/` | Architecture, environment and deployment documentation |
| `frontend/docs/screenshots/` | Product journey evidence |

## ThirdUni Program

Oppulse AI is developed as part of the **ThirdUni Program**, with the goal of making academic opportunity discovery more transparent, more practical and more useful for students. The project combines product design, evidence-aware AI workflows, deterministic decision logic and a deployable full-stack foundation.

## License and project status

This repository is an active pre-deployment project. Cloud resources and live provider credentials are intentionally external to the repository and must be configured per environment.
