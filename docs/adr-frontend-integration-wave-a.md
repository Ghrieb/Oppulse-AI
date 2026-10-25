# ADR — Frontend integration decisions (Wave A)

**Status:** Accepted
**Date:** 2026-10-22
**Context:** Frontend/Backend Connection and UI/UX Readiness Plan, Wave A.

## 1. `VITE_API_BASE_URL` is the origin only — the client appends `/api/v1`

**Decision:** The readiness plan shows
`VITE_API_BASE_URL=http://localhost:8000/api/v1`. We deliberately keep the
value as the **origin** (`http://localhost:8000`) without the version prefix.

**Why:** `buildUrl()` in `frontend/src/lib/api/config.ts` appends the version
prefix itself:

```ts
const url = new URL(`${API_BASE_URL}${API_PREFIX}${normalisedPath}`);
```

with `API_PREFIX = '/api/v1'`. Setting the env var to the plan's value would
produce `http://localhost:8000/api/v1/api/v1/...` on every request — the
double-prefix class of quiet staging bug this readiness phase exists to
catch. Both the HTTP client and the MSW handlers read the same constant, so
mock and live mode stay in agreement either way.

**Consequences:**

- `.env.example` and `.env.test` carry the origin-only value and document
  the rule.
- Environment setup for Azure staging must use the origin
  (`https://<api-host>.azurewebsites.net`), never the prefixed URL.

## 2. Correction — the `institution` render defect is already fixed

**Decision:** Wave A item A1 was scoped as a one-case fix to the
`institution` assistant block. Verification against the current tree found
the defect already fixed and regression-guarded:

- `frontend/src/components/agent/assistant-blocks.tsx` handles
  `kind: 'institution'` with a full `InstitutionCard`.
- `frontend/src/components/agent/agent.test.tsx` asserts the institution
  answer renders and is **not** mistaken for the unknown-format fallback.
- `backend/tests/test_answer_blocks.py` documents the original drop in past
  tense and guards the wire shape (`model_dump(by_alias=True)` → camelCase).

A1 was executed as a verification gate (frontend 24/24, backend 8/8) with no
code change.

**Known gap, scheduled in Wave B ("the new blocks on the server"):** the live
`_answer()` pipeline in `backend/app/api/assistant.py` currently emits only
`text`/`evidence`/`checklist`/`action` blocks. It never constructs an
`institution` (or `media_context`/`unknown_or_conflict`) block, so Live mode
answers cannot yet include one. The contract, the adapter and the interface
are ready; only the producer is missing.

## 3. Panel compare deferred to Wave C

**Decision:** The controllable opportunity panel (A5) implements open,
close, pin-to-chat-context, switch, URL-persisted selection and the
responsive chat→panel wiring. A full two-opportunity **compare** surface is
deferred to Wave C, where the §10 journeys are built. No non-functional
compare control ships in Wave A; the existing "Compare selected" button on
the Opportunities page remains as-is until that wave.
