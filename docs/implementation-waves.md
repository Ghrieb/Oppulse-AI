# Oppulse AI — Implementation Waves B/C/D (amended)

**Status:** Plan of record. Wave A complete (see `adr-frontend-integration-wave-a.md`).
**Amendment source:** 2026-10-22 gap audit of `archive/frontend-backend-connection-and-uiux-readiness-plan.md`
against the tree. Items marked **[A]** are audit additions — they close gaps the
original wave text missed. Everything else is the staged plan as agreed.

---

## Wave B — Backend hardening

**B1 · The run worker.**
A database-claimed run with a lease: one worker claims a queued run, walks the
seven stages, and emits the factual events of §A.5 (Queued → Planning →
Searching → Retrieving → Extracting → Matching → Preparing explanation →
Completed | Partial | Failed | Paused). Pause, resume, safe cancellation, and a
retry that re-does the failed stage without duplicating the completed work. A
restart resumes from the last event, because the run is a row and the events
are a timeline. Replay-backed today; the same worker calls the live providers
once the keys exist.
**[A] Criteria wiring:** the worker feeds the mission's criteria
(`destinationCountries`, types, funding preference) into query construction and
ranking — §11.5 / §2 require selected countries to affect search, ranking and
institution descriptions, and today `SourceRetrievalStage` takes only
`query + limit` (`backend/app/ai/stages/retrieval.py:29-32`). Ships with one
assertion: changing the country set changes the results.

**B2 · Idempotency.**
An `Idempotency-Key` on the seven mutations the document names — onboarding
completion, upload initiation, run creation, run retry and cancel, fact
confirmation/correction/exclusion, draft proposal creation, draft acceptance.
The client sends the key and may then retry safely; the server returns the
first result for a repeated key. The delivery record already carries one
(`app/api/monitoring.py:89`).

**B3 · One authority, completed.**
The contract check covers MSW ↔ manifest ↔ FastAPI today. It gains the OpenAPI
document and the frontend hooks: every route must appear in the OpenAPI paths,
and must have a frontend hook or an explicit deferred marker for the
server-only routes.

**B4 · The new blocks on the server.**
The stages emit `media_context` only from the official pages the fetcher
already visited, `opportunity_reference` when an answer concerns an
opportunity, and `unknown_or_conflict` for what could not be verified.
**[A] Plus `institution`:** the live `_answer()` pipeline
(`app/api/assistant.py:253-379`) never constructs an institution block — the
one kind with a contract, an adapter, a renderer and regression tests but no
producer (the A1 correction). Without this, the "institution answer opens the
panel" journey passes mock and fails live.

---

## Wave C — The states, the mutations, the journeys

**C1 · The distinct states.**
Today the feedback module has empty, error, permission and not-found
(`components/feedback/states.tsx`). §A.1/A.2 want partial, offline,
contract-mismatch, rate-limited, provider-unavailable, session-expired as
their own states, with the message matrix's wording — "The source could not be
reached. This does not mean no opportunity exists.", "The AI provider is
temporarily unavailable. Your mission is saved." The "copy technical details"
action exposes only the request id, the run id, the stable error code, the
route, the timestamp and the environment — never CV text, the date of birth, a
prompt or a token.
**[A] Plus `refreshing`:** §5.5/§6 require a distinct refreshing state —
stale data with a visible status — which the original C1 enumeration skipped.

**C2 · The mutation contract.**
Pending labels ("Saving…", "Starting run…"), the action disabled while it is
pending, no duplicate runs or drafts on a double click, no blind retry of a
non-idempotent operation, and no optimistic update for a deletion, an
exclusion or a draft acceptance.
**[A] Request cancellation:** §6 requires cancelling obsolete searches and
assistant requests. The client accepts a `signal` (`lib/api/client.ts:24`) but
no hook passes one, and queryFn ignores react-query's `signal` — so in-flight
requests are never actually aborted. Wire signal through queryFn and the agent
send path here.

**C3 · The connection-critical journeys, each run in both mock and live mode**
(§10 lists **17**; the original staged text listed 15 — both omissions
restored):
landing → onboarding → mission preview; the no-CV path; upload → processing →
proposed facts; confirm/correct/exclude → the match refreshes; the
date-of-birth refusal; country multi-select with keyboard navigation; the
run's progress, pause, cancel and failure; an unreachable source without the
empty-result lie; the institution answer opening the panel; pin/close/switch
without losing the chat; media available, blocked **and removed**; the inquiry
draft with its evidence and Prepares status; draft rejection and revision;
session expiry and return-to-destination; capability labels for all three
modes; **[A] offline recovery after an onboarding or draft mutation** (zero
offline tests exist today); **[A] mobile opportunity panel behavior**.
That is the full §10 journey list; the keyboard-only and 200% zoom gates are
the named final pass (D4).

**C4 · The gates.**
Typecheck · lint with zero warnings · formatting · unit and component tests ·
accessibility · the mock journeys · the live journeys · the production build ·
the contract comparison · no secrets in the frontend bundle (a CI grep of the
built assets) · no third-party image or video request in Demo mode (a browser
assertion, not just a source grep).
**[A] §11.12 offline replay gate:** the backend suite must prove the AI replay
harness passes with the network blocked and no secrets present — currently
unenforced (`backend/tests/conftest.py` has no socket guard) and unassigned by
either C4 or D1.
**[A] Named a11y surfaces:** the axe suite covers 4 pages
(`features/a11y.test.tsx`); C4 names the rest — shell (incl. the new
ConnectionIndicator), assistant/chat, onboarding/country-select, landing,
applications/drafts.

---

## Wave D — The keys, Azure, the documentation, the deploy

**D1 · The provider smoke test.**
One synthetic, non-personal fixture through Groq and through the search
provider, measuring latency, validating structured output and bounded retry,
recording quota and failures, checking logs are redacted. The capability flips
to live only if it passes — configuration, never a code change.

**D2 · The deploy kit.**
Static Web Apps with preview isolation, App Service with the Python runtime
and startup command, environment templates with placeholders only, the
secret-isolation checklist, the CORS allowlist per environment, and the
runbook in the brief's verification order, each step ending in pass/fail and a
deployment or request id. Nothing is provisioned — the resource list and the
environment boundary need explicit approval first.

**D3 · The documentation.**
The student-testing consent screen (what is stored, what may be sent to Groq,
why, retention, deletion, how to exclude a fact, which capabilities are live),
the support guide for the cohort, README and architecture updates, and the
submission text.

**D4 · The final pass.**
Keyboard-only journeys and the 200% zoom gate, before deployment.
Also carries the two minor audit items if not already resolved: §5.1 shell
mission-context/consent indicators, §8 institution-card action controls
(opens with compare in C), and panel-action results returned to the chat
(§5.4 — implement or record as an explicit deferral in the ADR).

---

## Standing constraints

- No Azure provisioning; no provider keys until the §11 checklist is green.
- `VITE_API_BASE_URL` stays origin-only (ADR §1) — never with the `/api/v1`
  prefix.
- Do not redo completed backend work (62/62 routes, adapters, OCR floor,
  contract checks).
