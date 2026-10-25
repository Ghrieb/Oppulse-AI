# Oppulse AI — backend

The FastAPI service behind Oppulse AI: the versioned HTTP contract the frontend already speaks,
the agent loop that researches and explains, and the deterministic evaluation harness that proves
the AI never makes a decision it is not allowed to make.

```bash
uv sync --all-extras      # the virtual environment and the lockfile
uv run uvicorn app.main:app --reload --port 8000
uv run pytest             # the tests, including the evaluation harness
```

## The two modes

| Mode | How | What it is for |
|---|---|---|
| **Demo** | The frontend's MSW handlers, no service | The committee demo. Deterministic and synthetic. |
| **Live** | `VITE_API_MODE=live` against this service | The real product, with the real data and the real providers. |
| **Replay** | `OPPULSE_MODEL_PROVIDER=replay` | The evaluation harness: the whole agent loop, with no network and no keys. |

## The commands

```bash
uv run pytest                          # the tests, including the evaluation harness
uv run pytest tests/test_evaluation_harness.py -v   # the harness, one case per fixture
uv run ruff check . && uv run ruff format --check . && uv run mypy app
uv run python scripts/check_contract.py           # the contract check
uv run python scripts/seed_demo.py                # seed the demo data
uv run alembic upgrade head                       # apply the production schema
```

Staging and production must run `uv run alembic upgrade head` as a deployment
step before the API is marked ready. The API readiness check requires the
`alembic_version` table outside local development, so a process cannot appear
healthy against an un-migrated database.

Email verification and password recovery use the configured HTTP mail adapter.
It sends a bearer-authenticated JSON `POST` containing `from`, `to`, `subject`
and `text`; without `OPPULSE_EMAIL_PROVIDER_URL` and
`OPPULSE_EMAIL_PROVIDER_KEY`, non-local requests fail explicitly instead of
claiming that a message was delivered.

From the repository root:

```bash
pwsh scripts/run-live-journeys.ps1   # the journeys against this service
```

## What is here

| Path | What it is |
|---|---|
| `app/api/` | The endpoints. One module per group, mirroring the frontend's contract. |
| `app/ai/` | The agent: provider interfaces, the seven typed stages, the thread, the boundary. |
| `app/ai/providers/replay.py` | The offline implementations. No network, no keys, no real documents. |
| `app/ai/providers/groq.py` | The live model, with structured output and a bounded repair retry. |
| `app/ai/rules/` | The rule engine, ported from the frontend's `lib/matching.ts` and `lib/next-action.ts`. |
| `app/ai/boundary.py` | The machine-readable AI/deterministic table. |
| `app/evaluation/` | The evaluation harness and its versioned synthetic fixtures. |
| `app/security/` | Argon2id passwords, tokens, the session dependency, the ownership guard. |
| `app/db/` | The SQLAlchemy models and the async engine. |
| `scripts/check_contract.py` | Compares the routes the service serves with `contracts/paths.json`. |
| `scripts/seed_demo.py` | Seeds the demo from `contracts/demo-fixtures.json`. |

## The commands

```bash
uv run pytest                          # the tests, including the evaluation harness
uv run pytest tests/test_evaluation_harness.py -v   # the harness, one case per fixture
uv run ruff check . && uv run ruff format --check . && uv run mypy app
uv run python scripts/check_contract.py           # the contract check
```

## Where it stands

| Area | State |
|---|---|
| The foundation — health, readiness, capabilities, the error envelope, request ids, redacting logs, CORS | ✅ |
| The authentication boundary — Argon2id, rotating hashed refresh tokens, the `HttpOnly` cookie session, the ownership guard, the audit log, password reset | ✅ |
| The rule engine, ported and pinned by one shared case file | ✅ 20 cases, both sides |
| The seven typed stages, the proposal/decision split, the boundary | ✅ enforced by tests |
| The offline evaluation harness | ✅ 10 fixtures, 3 multi-turn scenarios, 14 behaviours |
| The conversation thread and the context rules | ✅ |
| The endpoint mirror | ✅ 62 of 62 contract routes served |
| The live providers (Groq, search) | ✅ behind adapters; the live path needs a key |
| Azure, Supabase | ⬜ nothing is provisioned — see `docs/azure-runbook.md` |

## The rules this service keeps

1. **The agent never decides.** The model proposes; deterministic services decide. The boundary is
   in `app/ai/boundary.py` and it is enforced by types and by tests.
2. **Nothing is sent on the student's behalf.** Every external action is prepared and confirmed.
3. **Sensitive data stays out of prompts.** The date of birth is protected data: it is used for an
   age check and for nothing else, and it never appears in a log line.
4. **A failure is a state, not a silence.** An unreachable source, a rate limit and a malformed
   response all become typed, recoverable outcomes. None of them become an empty result.
5. **The mock is the offline-replay mode.** The frontend's MSW handlers and this service answer the
   same contract, so the product can be developed and evaluated with no provider keys at all.

## The contract

The frontend's Zod schemas are the contract of record. `contracts/paths.json` and
`contracts/entities.json` are generated from them and checked against this service in CI, so a
field cannot change on one side without the build failing on the other.

## The local database

SQLite locally, Supabase Postgres in staging and production. The models are written to be portable
and Alembic owns the migrations. See `docs/environments.md` at the repository root for the
environment boundaries and the secret list.
