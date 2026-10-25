# Oppulse AI — Frontend/Backend Connection and UI/UX Readiness Plan

**Status:** Implementation plan before real API keys and Azure provisioning
**Purpose:** Make the frontend structurally ready to connect to FastAPI and real AI services without redesigning the layout, replacing components or breaking the student journey.
**Current constraint:** Continue using local mock/replay services while preparing the real connection. Do not require Groq/Tavily keys or Azure resources for this phase.

---

## 1. Objective

The immediate goal is not to make every provider live. The goal is to ensure that the frontend and backend can connect through the same stable contract while the UI remains coherent in mock mode, local FastAPI mode and future private staging mode.

The same student experience must work in three configurations:

```
Demo mode
  MSW + synthetic fixtures + visible Prototype data label

Local live mode
  FastAPI + SQLite/replay providers + no cloud keys

Private staging mode
  FastAPI + private database/storage + approved real providers
```

The layout, component hierarchy, routes and user journey should not change between these modes. Only the data source and capability status should change.

---

## 2. Non-Negotiable Product Flow

The frontend must preserve this flow in every mode:

```
Landing
→ choose goal, CV/documents or opportunity link
→ low-effort onboarding
→ country multi-select with flags
→ conditional questions
→ consent and context selection
→ mission preview
→ research run
→ factual progress timeline
→ opportunity results
→ right-side opportunity detail panel
→ evidence, institution context and media context
→ unresolved requirements
→ next-best action
→ draft, checklist or application plan
```

A user may enter through chat, a document or a known opportunity, but all paths must converge on the same mission, profile, evidence, run and action state.

### No-CV path

The UI must not force a CV upload or a full profile. A student can answer focused questions, skip uncertain fields and still receive a mission preview and useful opportunity results.

Example:

```
English certificate?
  Yes → certificate type → level → evidence upload later if needed
  No → unresolved requirement → next action to work on it
  Not sure → unverified → ask for evidence later

This is an AI solutions, so a plain language answer will be given.
```

### Country path

Country selection is a real mission criterion, not decorative UI:

- multi-select countries;

- inline flags plus visible country names;

- accessible labels;

- removable selections;

- editable from the mission preview;

- clear Global/no-preference option;

- country codes stored in the contract;

- selected countries affect search, ranking and institution descriptions.

---

## 3. Integration Boundary

### Frontend responsibilities

The frontend owns:

- route transitions;

- form and question state;

- consent presentation;

- optimistic UI where safe;

- loading, empty, partial and error states;

- evidence display;

- run timeline rendering;

- draft review and diff interaction;

- capability status display;

- local recovery for unsaved work;

- accessible focus and responsive layout.

### Backend responsibilities

FastAPI owns:

- authentication and authorization according to the final auth decision;

- user and resource ownership;

- mission persistence;

- document storage and extraction;

- profile fact proposals;

- durable research runs;

- evidence and source retrieval;

- AI/provider calls;

- deterministic eligibility and age rules;

- next-action derivation;

- conversation thread persistence;

- audit events;

- future email/provider adapters.

The frontend must never contain provider keys, private storage credentials, model prompts that include uncontrolled personal data, or direct third-party provider calls.

### One client rule

Every frontend request goes through the existing API client. Components must not call `fetch`, provider URLs or storage URLs directly.

Every response must be parsed through its Zod schema. A contract mismatch must produce a typed error state rather than a partially rendered screen.

---

## 4. Connection Modes and Configuration

Use one configuration switch without changing component code:

```
VITE_API_MODE=mock | live
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_SHOW_PROTOTYPE_BANNER=true | false
VITE_PRODUCT_MODE=demo | student_testing
```

### Demo mode

- MSW intercepts API requests.

- Synthetic data only.

- `Prototype data` banner remains visible.

- No live provider calls.

- Capability strip states which services are simulated or unavailable.

### Local live mode

- MSW is disabled.

- Frontend calls local FastAPI.

- SQLite and replay providers may be used.

- No real provider keys are required.

- The UI should show API/data mode and capability status without claiming real web research or live AI.

- This mode proves that the frontend contract and backend routing are compatible.

### Private staging mode

- Frontend calls staging FastAPI.

- Authenticated users and private resources are enabled.

- Real documents require explicit consent.

- Groq/Tavily capabilities are marked live only after provider smoke tests pass.

- Student Testing mode replaces the generic synthetic-data banner with capability-specific statuses.

The mode must be visible in Settings or a safe developer-only status panel. Never hide a mode switch in ordinary user controls.

---

## 5. Frontend Layout and UI/UX Integration Work

### 5.1 App shell

The shell should keep the current navigation but make connection state understandable:

- top-level mode/capability status;

- active mission context;

- current run indicator;

- unread in-app task count;

- profile/document consent state;

- responsive mobile navigation.

Do not add a second shell for live mode. The same shell must render all modes.

### 5.2 Home workspace

Order the workspace by action priority:

```
Active mission
→ next best action
→ agent/chat
→ opportunity results
→ alerts and run events
```

The home page must not depend on all backend resources succeeding. If opportunities fail, the student should still see the active mission, run status and recovery action.

### 5.3 Agent/chat layout

The chat is the control surface, not a separate product.

Structured assistant blocks should support:

- answer;

- institution description;

- evidence summary;

- media context;

- requirement status;

- action buttons;

- draft proposal;

- research run status;

- unresolved question.

The chat must show what context was used when the response depends on documents, profile facts or an opportunity.

### 5.4 Right-side opportunity panel

On desktop, the selected opportunity opens in a controllable right-side panel. On mobile, use a route, sheet or full-screen detail view.

The panel must:

- preserve the chat thread;

- show institution, country, programme and opportunity identity;

- show official evidence links;

- show deadline, funding, eligibility and confidence sections;

- show verified logos/banners or deterministic fallbacks;

- show optional image/video media context with source labels;

- support pin, close, compare and switch actions;

- preserve the selected opportunity explicitly;

- return action results to the chat;

- never silently change the selected opportunity.

### 5.5 Loading and partial states

Every network-backed panel needs distinct states:

- initial loading;

- refreshing;

- empty but successful;

- partial data;

- source unavailable;

- permission denied;

- session expired;

- contract mismatch;

- rate limited;

- provider unavailable;

- offline with locally preserved work.

Do not use one generic spinner for long research. Use factual run stages and events:

```
Planning
Searching
Retrieving sources
Extracting requirements
Matching confirmed profile
Preparing explanation
Completed / Partial / Failed
```

### 5.6 Error recovery

Errors must explain:

1. What failed.

1. Whether user work was preserved.

1. Whether the issue is temporary, permission-related, unavailable-source or incomplete-data.

1. What the student can do next.

Examples:

- “The source could not be reached. This does not mean no opportunity exists.”

- “Your CV was saved, but extraction is still processing.”

- “This requirement is unresolved because you did not provide an English certificate.”

- “The AI provider is temporarily unavailable. Your mission is saved; retry the analysis.”

---

## 6. Frontend Data-State Rules

Use server state through TanStack Query and UI state locally. Do not use component state as a server cache.

### Query behavior

- Stable query keys for session, profile, documents, missions, runs, opportunities, assistant history and next action.

- Invalidate opportunity analysis when confirmed facts change.

- Invalidate next action when a blocker is resolved.

- Preserve the selected opportunity while background data refreshes.

- Do not clear existing good data during a refresh failure.

- Use stale data with a visible status when appropriate.

- Cancel obsolete searches and assistant requests.

- Avoid duplicate research runs on double click or refresh.

### Mutation behavior

Every mutation needs:

- disabled/pending state;

- typed success response;

- typed failure response;

- retry path;

- idempotency key where duplication is possible;

- optimistic update only when rollback is safe;

- audit-visible result where the action is consequential.

Required idempotency coverage:

- onboarding completion;

- document upload initiation;

- research run creation;

- run retry/cancel;

- fact confirmation/correction/exclusion;

- draft proposal creation;

- draft acceptance;

- future email retry.

---

## 7. Backend Endpoint Readiness

Before connecting each frontend feature to FastAPI, verify:

| Frontend area | Required backend behavior |
| --- | --- |
| Session | Authentication, expiry, return-to-destination, ownership |
| Onboarding | Draft save/resume, conditional answers, mission completion |
| Countries | ISO codes, names, flags metadata, mission criteria |
| Documents | Private upload, processing state, extraction errors, delete |
| Profile | Proposed/confirmed/excluded/conflicting facts and provenance |
| DOB | Protected read/update, age-rule evaluation, no raw leakage |
| Missions | Structured criteria, selected context, consent snapshot |
| Runs | Durable status, lease/retry/cancel, factual events |
| Opportunities | List/detail, evidence, conflicts, source reachability |
| Assistant | Thread history, context set, structured response blocks |
| Panel | Selected opportunity state, actions, comparison context |
| Drafts | Proposal, diff, accept/reject, version history |
| Next action | Deterministic priority and blocker route |
| Capabilities | Per-service live/simulated/unavailable state |

The endpoint list must have one authority:

```
MSW handlers
↔ shared path manifest
↔ FastAPI routes
↔ OpenAPI
↔ frontend query/mutation hooks
```

The integration gate fails if a route exists in one layer but not the others, unless it is explicitly marked deferred.

---

## 8. AI-Ready UI Contract

The UI should be designed for real AI without exposing hidden model reasoning.

### AI response blocks

Use typed response blocks such as:

```
answer
institution
media_context
source_evidence
requirement_status
opportunity_reference
action
run_event
draft_proposal
unknown_or_conflict
```

Each block must carry only the fields needed to render it and must validate at the API boundary.

### Institution answers

When a student asks about an institution, show:

- plain-language description;

- location and country;

- verified institution type;

- relevant programme/research context;

- official evidence links;

- what could not be verified;

- optional media context;

- actions such as open panel, compare, check fit or draft inquiry.

Do not invent rankings, acceptance rates, reputation or student experience.

### Media

Use images and YouTube videos only as secondary context:

- preserve original URL, title, publisher/channel and date;

- embed or link rather than download/re-host;

- label summaries as Media context or Secondary source;

- never use media alone for eligibility, funding, deadline or admission claims;

- sanitize embeds and treat captions/transcripts as untrusted input;

- show removed or blocked media honestly.

### Drafting

The UI supports reviewable drafts for:

- motivation letters;

- supervisor emails;

- research statements;

- recommender briefing material;

- institution/programme inquiry emails.

Every draft shows context used, evidence links, claims to review and `Prepares` status. Nothing sends automatically.

---

## 9. Local Integration Sequence

### Step 1 — Mock contract verification

- Keep all current MSW journeys passing.

- Add missing schemas and handlers.

- Test country selection, panel state, media blocks and structured assistant responses.

- Test no-CV onboarding and date-of-birth conditional logic.

### Step 2 — Local FastAPI connection

- Disable MSW.

- Set `VITE_API_MODE=live` and local API base URL.

- Run the same Playwright journeys.

- Compare rendering and behavior against Demo mode.

- Fix contract mismatches at the boundary, not inside individual components.

### Step 3 — Replay-backed AI

- Run FastAPI with replay providers.

- Verify research run events, extraction states, profile confirmation and next actions.

- Verify institution blocks, right-side panels and draft actions.

- Keep AI capability `simulated` until live smoke tests pass.

### Step 4 — Synthetic live-provider smoke test

Only after Steps 1–3 pass:

- connect Groq using a server-side key;

- use synthetic fixtures only;

- validate structured output and bounded retry;

- record latency, quota and failures;

- verify redacted logs;

- keep capability flags honest.

### Step 5 — Private staging preparation

After the frontend/backend live-mode proof passes, plan Azure and staging with Hani, Manus and the coding agent. Do not let infrastructure details force another UI redesign.

---

## 10. UI/UX Quality Gates

The integration is not complete when the API returns 200. It is complete when the student experience remains understandable under real states.

Required tests:

- landing to onboarding to mission preview;

- no-CV path to opportunity result;

- CV upload to processing to proposed facts;

- confirm/correct/exclude a fact and see match refresh;

- date-of-birth prefer-not-to-say path;

- country multi-select with flags and keyboard navigation;

- research run progress, pause, resume, cancel and failure;

- source unreachable without empty-result deception;

- structured institution answer opens right-side panel;

- pin/close/switch panel without losing chat;

- media available, blocked and removed states;

- inquiry draft with evidence and review status;

- draft rejection and revision;

- session expiration and return-to-destination;

- offline recovery after an onboarding or draft mutation;

- mobile opportunity panel behavior;

- capability labels for Demo, Local Live and Student Testing modes.

Quality gates:

- typecheck;

- lint with zero warnings;

- formatting;

- unit/component tests;

- accessibility tests;

- keyboard-only journeys;

- 200% zoom;

- Playwright mock journeys;

- Playwright local FastAPI journeys;

- production build;

- contract comparison;

- no secrets in the frontend bundle;

- no unexpected third-party image/video requests in Demo mode.

---

## 11. Definition of Ready for Real Keys and Azure

Do not request or configure real provider keys until:

1. Demo and Local Live modes are both stable.

1. The same frontend routes work in both modes.

1. The endpoint manifest is reconciled with MSW, FastAPI and OpenAPI.

1. The right-side opportunity panel and structured assistant blocks work.

1. Country selection affects the mission and research criteria.

1. Document extraction states and privacy controls work.

1. No-CV onboarding works end to end.

1. Date-of-birth handling is protected and deterministic.

1. Durable run states and recovery work.

1. Contract comparison is green.

1. All UI/UX quality gates pass.

1. The AI replay harness passes without network or secrets.

1. The authentication decision is documented and implemented once.

1. Demo mode still clearly labels synthetic data.

1. Local Live mode accurately reports which capabilities are replayed, live or unavailable.

Only then should the team configure Groq/Tavily keys and plan Azure staging with explicit resource approval.

---

## Instruction to the coding agent

Prioritize **connection readiness, not cloud provisioning**. Keep the existing layout and component design stable while proving that the frontend can consume FastAPI responses across loading, partial, error, recovery and live/replay states.

Implement and test the country-selection flow, structured AI response blocks, institution descriptions, media context, right-side opportunity panel and reviewable inquiry drafts before requesting real keys. The student should experience one coherent product in Demo mode, Local Live mode and future Student Testing mode; only the capability status and data source should change.



---

## Appendix A — Error handling and polished interface logic

The interface must remain calm, understandable and useful when the backend, AI provider, source page or network fails. A polished UI is not only spacing and color; it is the correct next state after every action.

### A.1 Explicit async state model

Every asynchronous feature should use an explicit state model rather than a single `isLoading` boolean:

```text
idle → validating → submitting → queued → processing → partially_complete → succeeded

Any active state → offline | unauthorized | forbidden | rate_limited
Any processing state → provider_unavailable | source_unreachable | failed
Any mutation state → conflict | cancelled
```

The UI must distinguish no data yet, successful empty result, partial result, unavailable provider/source, unauthorized session, forbidden resource, invalid input, conflict and offline recovery. Never render a blank panel for an error, and never convert an unavailable source into an empty result.

### A.2 Error-to-interface matrix

| Error | User-facing message | Primary action | Required behavior |
|---|---|---|---|
| Network/offline | “You’re offline. Your last local changes are preserved.” | Retry when online | Keep inputs and show unsynced state |
| Timeout | “This is taking longer than expected.” | Continue or retry | Preserve the run and its status |
| Unauthorized | “Your session has expired.” | Sign in again | Return to the original route |
| Forbidden | “You do not have access to this item.” | Return to workspace | Do not reveal another user’s resource |
| Validation | “Check the highlighted fields.” | Focus first invalid field | Preserve valid answers |
| Conflict | “This changed in another tab or session.” | Review latest / keep mine | Never silently overwrite |
| Rate limited | “The service needs a moment before trying again.” | Retry later | Use bounded retry timing |
| Provider unavailable | “The AI service is temporarily unavailable. Your mission is saved.” | Retry analysis | Preserve context and run state |
| Source unreachable | “We could not open this source.” | Retry / open source | Keep it as unreachable evidence |
| Contract mismatch | “Oppulse received an unexpected response.” | Retry / report issue | Show request ID; do not render unsafe partial data |
| Invalid file | “This file cannot be processed.” | Choose another file | Explain accepted types and limits |
| Partial extraction | “Some sections could not be read.” | Review extracted facts | Show affected pages and alternatives |
| AI refusal | “I could not complete that request with the available information.” | Ask a narrower question | Never invent an answer |

Messages should describe the situation and next step without exposing stack traces, tokens, raw prompts or provider internals.

### A.3 Mutation and duplicate-action rules

Every consequential action needs a pending state and idempotency behavior:

- disable the same action while it is pending;
- use factual labels such as “Saving…”, “Starting run…” or “Uploading…”;
- prevent double-click creation of duplicate runs, documents or drafts;
- use idempotency keys for server mutations;
- if the outcome is uncertain, show “We’re checking whether this completed” instead of blindly retrying;
- retry only when the operation is known to be idempotent;
- do not use optimistic updates for document deletion, fact exclusion, application actions or draft acceptance unless rollback and audit behavior are implemented.

### A.4 Conditional forms and question branches

Forms must validate accessibly:

- show errors after interaction or submit, not prematurely;
- place a summary above the form;
- focus the first invalid field;
- connect messages with `aria-describedby`;
- preserve valid answers;
- explain why a question matters;
- provide “Not sure”, “Prefer not to say” or “I do not have this yet” when valid;
- save the parent branch before asking dependent questions;
- remove obsolete branch answers from active mission context.

Changing “English certificate: Yes” to “No” must remove the old certificate level from eligibility context and create an unresolved requirement. It must not silently keep the old level.

### A.5 Research run interface

The run timeline must show factual stages:

```text
Queued → Planning → Searching approved sources → Retrieving pages
→ Extracting requirements → Matching confirmed profile
→ Preparing explanation → Completed | Partial | Failed | Paused
```

Each event includes a plain-language label, timestamp, source/object reference where relevant, state and next action. Support pause, resume, safe cancellation, retry of failed stages without duplicating completed work, return-after-leaving, partial results and screen-reader announcements. Do not display hidden chain-of-thought or artificial progress percentages.

### A.6 Opportunity panel resilience

Keep the last valid opportunity selection while refreshing. If the selected opportunity fails to load:

1. Keep the title and last verified summary where safe.
2. Show a clear refresh/error state.
3. Preserve chat and mission context.
4. Offer retry and return-to-results actions.
5. Never silently select another opportunity.

If a logo or banner fails, render a generated institution mark or neutral panel. Reserve media dimensions before loading. Media failure must never block evidence, eligibility or drafting actions.

### A.7 Chat response polish

The chat must distinguish assistant answers, questions, institution blocks, evidence summaries, unresolved requirements, run events, action proposals, draft proposals and provider/source failures.

Lead with the answer or decision-relevant summary, then provide expandable evidence and detail. When Oppulse cannot verify something, use:

> “I could not verify that from the sources I reached.”

Then show what was checked, what remains unknown and the most useful next action. Never replace uncertainty with a confident guess.

### A.8 Focus, keyboard and responsive behavior

After route changes, focus the page heading or meaningful landmark. For dialogs, drawers and panels:

- move focus into the opened surface;
- trap focus when modal;
- restore focus to the trigger on close;
- support Escape;
- provide labelled close controls;
- announce important run changes with `aria-live` without repeating every event excessively.

Responsive behavior must be intentional:

- desktop: workspace with optional right-side panel;
- tablet: collapsible panel and reduced secondary metadata;
- mobile: single primary task with sheet/route detail;
- 200% zoom: no loss of critical controls;
- keyboard: every country, evidence, panel, draft and retry action reachable.

### A.9 Capability messaging

Use capability-specific status rather than one generic “backend connected” indicator:

```text
API connection: live
Profile data: synthetic | user-provided
AI reasoning: simulated | live | unavailable
Web research: replayed | live | unavailable
Document extraction: simulated | live | unavailable
In-app alerts: available
Email: deferred | unavailable | live
```

Demo mode keeps the synthetic-fixture banner. Local Live and Student Testing modes show data origin and per-capability status.

### A.10 Privacy-safe observability

A “Copy technical details” action may expose only request ID, run ID, stable error code, route, timestamp and environment. Never include CV text, document text, date of birth, raw prompts, model responses with personal data, tokens, signed storage URLs or private addresses in logs or diagnostics.

### A.11 UI polish acceptance checklist

Before connection work is complete, inspect every major screen for a clear primary action, consistent labels, no layout shift, no unexplained disabled control, visible focus, readable empty/partial/error states, preserved input after failure, correct dates and pluralization, source labels near claims, sufficient contrast, responsive behavior and an explicit simulated/live/unavailable distinction.

Required journeys include landing-to-mission, no-CV onboarding, CV processing, fact correction, date-of-birth refusal, country selection, research pause/resume/failure, unreachable source, institution answer opening the right panel, pin/close/switch without losing chat, media available/blocked states, inquiry draft review, session expiry, offline recovery and Demo/Local Live capability labeling.
