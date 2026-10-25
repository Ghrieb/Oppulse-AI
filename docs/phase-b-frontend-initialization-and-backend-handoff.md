# Oppulse AI — Phase B Frontend Initialization and Backend Handoff

**Status:** Implementation brief for the coding agent
**Scope:** Finalize the frontend contract and user experience before connecting FastAPI, Supabase and real AI providers.
**Product constraint:** Oppulse AI does **not** contact users through Telegram and has no Telegram relationship or Telegram automation requirement.

---

## 1. Sprint 1 Review

Sprint 1 is a meaningful improvement and should be treated as the new product entry foundation.

### Confirmed strengths

- Public landing page now communicates the product promise before registration.

- Three clear entry paths exist: tell Oppulse what is needed, upload materials, or analyze a known opportunity.

- Onboarding is profile-aware and can skip questions answered by confirmed facts.

- The mission is derived from answers and presented for review rather than authored as a technical search form.

- The user can edit criteria before starting research.

- Local draft persistence supports refresh and temporary offline recovery.

- The screenshots show a coherent visual hierarchy, readable type, calm spacing and a clear evidence-first tone.

- Capability status is visible and does not falsely claim live AI or live research in mock mode.

- Route protection remembers the intended destination during authentication.

### Findings to resolve before backend connection

1. **Quality gate regression:** typecheck, lint and Prettier pass, but the current Vitest run reports one failing test: `HomePage.test.tsx` — `loads the workspace and greets the student`. Fix this before treating Sprint 1 as complete. The remaining reported tests passed.

1. **Complete the validation run:** rerun `npm.cmd run check` and `npm.cmd run build` after fixing the HomePage test. The previous combined command timed out while the test process was still running, so a clean final result must be recorded.

1. **Do not bypass the API contract for uploads:** the onboarding upload currently calls `apiClient.upload('/documents', body)` without a visible response schema. Add a document-upload request/response contract and an MSW handler that models processing states.

1. **Persist the selected starting path and uploaded document server-side:** `uploadedDocument` is currently local component state. The backend-ready draft must contain the document reference and processing state so refresh, another device and later AI runs do not depend on a boolean in the browser.

1. **Make the run transition explicit:** after `Run research`, show a durable run state or run timeline rather than only navigating to `/home`. A user must be able to leave and return to a queued, running, partially complete, failed or completed run.

1. **Protect sensitive data in diagnostics:** never log CV contents, extracted document text, OAuth tokens, private URLs or model prompts. Log only identifiers, event types, timings and stable error codes.

1. **Verify the demo path end to end:** the demo should enter onboarding, visibly use confirmed facts, complete the mission preview and reach a populated workspace without silently skipping the product story.

---

## 2. Required Notification Policy — Replace Telegram Completely

This is a product requirement, not an optional preference.

### Official channels

1. **In-app notifications:** always available and the primary source of truth for alerts, run events, document processing and application tasks.

1. **Email:** the only external notification channel for the current product. Use it for explicit user-enabled alerts, digests, deadline reminders and important run-completion messages.

1. **Future mobile app notifications:** a later channel, subject to a separate mobile product and permission model.

### Future integrations

- **Gmail or another approved email MCP:** may help prepare email drafts, organize user-approved context or open a compose flow. It must not send an email automatically.

- **Zoom and Google Meet MCPs:** future integrations for interview preparation, meeting context and possible real-time assistance. They require explicit user permission, clear recording/transcription disclosure where applicable and a visible start/stop state.

- Other MCPs and integrations later, such as LinkedIn

### Prohibited channel

Remove Telegram from the product, source code, schemas, fixtures, mock handlers, UI, settings, architecture, submission text and implementation documentation. Do not replace it with a hidden Telegram compatibility field.

### Required coding-agent cleanup

Search the entire project for `telegram`, `Telegram`, `telegramAlerts`, Telegram delivery fields and Telegram provider adapters. Remove or replace all occurrences in:

- monitoring and alert schemas;

- profile preference schemas and fixtures;

- monitoring fixtures and delivery state;

- alert delivery handlers and retry logic;

- Settings UI and integrations list;

- capability status labels;

- summary panels and monitoring pages;

- API contracts and backend handoff notes;

- architecture, submission, UX and technical-plan documentation.

Replace the model with an extensible channel structure that currently exposes only in-app and email:

```
type NotificationChannel = 'in_app' | 'email' | 'mobile_push';

type AlertDelivery = {
  inApp: DeliveryStatus;
  email: DeliveryStatus;
  emailError: string | null;
};
```

`mobile_push` may remain a future capability in documentation and a server-side design note, but it must not appear as an enabled frontend control until a mobile app exists.

The UI should say:

> **Email alerts** — Send a digest or important deadline reminder to your verified email. In-app alerts remain available even when email delivery fails.

The capability strip should show:

- Profile and opportunities — mocked/live

- AI reasoning — mocked/live/unavailable

- Web research — mocked/live/unavailable

- Document understanding — mocked/live/unavailable

- Change monitoring — mocked/live/unavailable

- In-app alerts — available

- Email notifications — unavailable until configured or live when configured

It must not mention Telegram.

---

## 2A. Pre-backend initialization gate

Do not connect the frontend directly to an unfinished backend. First establish the environments, deployment path, configuration boundaries and internal AI verification harness. This gate makes Azure a controlled connection point rather than a late deployment activity.

### Azure initialization track

Create and document three environment targets with separate configuration and data boundaries:

| Environment | Purpose | Data policy | Frontend mode |
|---|---|---|---|
| Local | Daily development and deterministic tests | Synthetic fixtures only | `VITE_API_MODE=mock` |
| Staging | Integration, contract and AI evaluation | Synthetic or explicitly consented test data | `VITE_API_MODE=live` with staging API |
| Production | Real users and real applications | Private user-owned data with RLS and retention controls | `VITE_API_MODE=live` with production API |

The coding agent must verify the following Azure foundation before backend implementation is considered connected:

1. Create or select one Azure resource group and one supported region, then record the names and owners in project configuration. Do not scatter resources across personal subscriptions or undocumented regions.
2. Initialize Azure Static Web Apps for the frontend and connect it to the intended repository and deployment branch. Confirm that preview deployments do not receive production API URLs or production secrets.
3. Initialize the Azure App Service Linux target for the FastAPI API. Confirm the Python runtime, startup command, health endpoint, HTTPS-only behavior, allowed origins and deployment slot/environment configuration.
4. Use GitHub Actions with a narrowly scoped Azure service connection or OIDC federation where available. Do not commit publish profiles, long-lived cloud keys or provider secrets to the repository.
5. Keep public frontend configuration limited to non-secret values such as API origin, API mode and feature flags. Model, search, storage, email and OAuth secrets stay in backend environment settings or a managed secret store.
6. Verify the API can expose `/health`, `/health/ready` and `/api/v1/capabilities` without leaking provider credentials. The frontend capability strip must distinguish reachable infrastructure from an actually configured AI/search provider.
7. Configure CORS for the exact local, staging and production origins. Reject wildcard origins when credentials or private document requests are enabled.
8. Configure centralized logs and request IDs. Logs must include environment, route, status, latency and correlation ID, but never CV text, document contents, prompts, tokens or private signed URLs.
9. Verify budget/quota limits, cold-start behavior, request timeouts, upload limits and maximum job duration. If the selected Azure free tier cannot safely host a worker or long-running AI job, keep workers as a separate bounded process rather than pretending App Service is always-on.
10. Add a deployment smoke test that loads the static frontend, calls the API health endpoint, checks the capability response and confirms that a failed provider is shown as unavailable instead of as successful data.

### Azure connection contract

The frontend should connect through configuration only:

```text
VITE_API_MODE=mock | live
VITE_API_BASE_URL=https://<environment-api-origin>/api/v1
VITE_SHOW_PROTOTYPE_BANNER=true | false
```

The backend should own its provider configuration separately:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
MODEL_PROVIDER_KEY
SEARCH_PROVIDER_KEY
EMAIL_PROVIDER_KEY
```

These names are illustrative configuration boundaries, not values to commit. The service-role key and all provider keys must never be exposed to Static Web Apps or included in the browser bundle. Use separate Supabase projects or clearly isolated schemas/buckets for staging and production; never point a staging frontend at production private storage.

### Azure verification order

Run the following in order and stop at the first failure:

```text
resource ownership and region
→ Static Web Apps deployment
→ App Service health endpoint
→ HTTPS and CORS
→ configuration and secret isolation
→ Supabase connectivity and RLS smoke test
→ API contract check
→ AI provider capability check
→ end-to-end frontend journey
```

Every check must produce a safe pass/fail result and a request or deployment ID. A green Azure deployment is not evidence that AI reasoning is correct.

### Internal AI reasoning verification

Before enabling real AI responses in the UI, split the agent into testable stages:

```text
mission interpretation
→ requirement extraction
→ source retrieval and normalization
→ evidence-grounded explanation
→ confirmed-profile matching
→ next-action derivation
→ draft proposal
```

Each stage must accept and return a typed structure. Do not implement one opaque prompt that simultaneously searches, decides eligibility, invents explanations and writes an application.

The coding agent must create a deterministic evaluation harness with the following checks:

- **Schema validity:** every model response parses against the expected JSON schema; malformed output is retried with a bounded limit and then becomes a typed provider failure.
- **Mission fidelity:** given the same onboarding answers, the mission criteria are stable, complete and free of criteria the user did not authorize.
- **Requirement extraction:** each extracted requirement is classified as required, preferred, informational or unknown, with source evidence and an extraction status.
- **Profile safety:** only confirmed, non-excluded facts can resolve an eligibility requirement or improve a fit explanation. Proposed, conflicting or expired facts remain unresolved.
- **Evidence grounding:** each material claim links to a reachable source passage or is labelled as inference/unknown. The evaluator must fail claims with no supporting evidence.
- **Conflict preservation:** different deadlines, funding values or eligibility rules are retained as conflicts; the model must not silently choose one.
- **Unreachable-source behavior:** a failed retrieval produces a visible source failure and a recovery action, never an empty “no opportunities” result.
- **No-admission-probability rule:** profile match must never be phrased as acceptance likelihood, ranking certainty or a guaranteed outcome.
- **Draft safety:** generated letters and emails use only approved context, mark uncertain claims and return a reviewable proposal. Recommender material must remain briefing material, not impersonation.
- **Prompt-injection resistance:** documents and web pages are untrusted data. Instructions found inside them must never override system policy, user consent, source scope or action approval rules.
- **Privacy minimization:** the context builder sends the smallest structured context needed for the stage and excludes unrelated documents and facts.
- **Failure and quota handling:** timeouts, rate limits, provider errors, empty search results and partial extraction become durable typed run events with retry or user-action guidance.

### AI evaluation fixtures

Create a versioned, synthetic fixture set before provider calls are enabled. It should include at least:

1. a student with confirmed education and one missing language requirement;
2. a researcher with conflicting deadlines across two official pages;
3. a professional changing fields with limited direct experience;
4. a malformed or partially unreadable CV;
5. a web page containing prompt-injection instructions;
6. a source that is unreachable or rate-limited;
7. a scholarship whose funding covers tuition but not living costs;
8. a user who has excluded a sensitive fact from AI context.

For every fixture, assert structured outputs, evidence links, unresolved fields, next action, privacy scope and user-visible wording. Do not judge hidden chain-of-thought. Verify the observable decision record and factual event timeline instead.

### AI provider connection stages

Use three controlled stages:

1. **Offline replay:** fake provider responses from fixtures; no network calls and no secrets.
2. **Provider smoke test:** send one synthetic, non-personal fixture through the configured provider and validate latency, schema, refusal/failure behavior and cost/quota accounting.
3. **Staging evaluation:** run the complete fixture suite against staging adapters, store only aggregate metrics and redacted failure IDs, and require review before enabling the live capability flag.

The frontend capability status must remain `simulated` or `unavailable` until these checks pass. A successful API connection alone must never switch AI reasoning to `live`.

### Pre-backend exit criteria

The pre-backend phase is complete only when:

- local, staging and production configuration boundaries are documented;
- Azure Static Web Apps and App Service deployment paths are reproducible;
- health, readiness, CORS, HTTPS, logging and secret-isolation checks pass;
- Supabase staging connectivity and RLS ownership tests pass;
- Zod-to-OpenAPI/Pydantic comparison is prepared;
- the AI evaluation harness passes the synthetic fixture suite;
- provider smoke tests are bounded and auditable;
- no real user document is used in evaluation without explicit consent;
- the frontend still passes typecheck, lint, tests, accessibility, browser journeys and build;
- the coding agent can demonstrate a provider failure without presenting invented data.

Only after this exit gate should the project begin the real FastAPI endpoints, document extraction and live AI reasoning integration.

---

## 3. Phase B Target Architecture

The frontend should remain a single client against a versioned HTTP contract.

```
React/Vite frontend
        │
        │ Zod-validated HTTP /api/v1
        ▼
FastAPI API
        ├── Supabase Auth
        ├── Supabase Postgres + RLS
        ├── Supabase private Storage
        ├── AI provider adapter
        ├── Search and source retrieval adapter
        ├── Document extraction service
        ├── Durable job/run service
        └── Email notification adapter
```

The frontend must not contain model keys, search keys, storage service keys, email provider secrets or OAuth refresh tokens. Provider credentials belong only in the backend environment or approved secret manager.

### Backend-ready exchange rule

For every new endpoint:

1. Define the Zod request and response schema.

1. Add the corresponding MSW handler.

1. Add success, validation, unauthorized, forbidden, rate-limit, provider-unavailable and contract-mismatch fixtures where relevant.

1. Add a query or mutation hook that uses the single API client.

1. Add a component test and one browser journey.

1. Only then implement the FastAPI endpoint with mirrored Pydantic models.

---

## 4. Contract Freeze Before Real AI

### 4.1 Identity and consent

The backend must expose authenticated user/session state and explicit consent state. Consent should include:

- use confirmed profile facts for matching;

- process extracted context with an external AI provider;

- use selected documents for this mission;

- receive email notifications;

- connect an optional Gmail integration for draft preparation;

- connect an optional Zoom/Google Meet integration for interview assistance.

Consent must be revocable. Revocation must stop future use; it does not silently rewrite historical application documents or evidence already reviewed by the user.

### 4.2 Profile facts

Each fact requires:

- stable ID;

- key and human label;

- value with a typed or structured representation;

- status: proposed, confirmed, corrected, excluded or conflicting;

- source document ID and page/section where applicable;

- extraction confidence, clearly labelled as extraction confidence rather than truth;

- `usedFor` references;

- created and updated timestamps;

- audit history for confirmation, correction and exclusion.

Only confirmed, non-excluded facts may influence eligibility or fit explanations.

### 4.3 Documents

The document contract must model:

- upload initiation;

- private storage reference;

- file metadata and checksum;

- processing state;

- extraction state;

- partial or unreadable sections;

- extracted fact proposals;

- user deletion;

- user consent for mission use;

- retention and deletion status.

The browser should upload through a short-lived authorized flow or backend endpoint; it should never receive permanent public storage URLs.

### 4.4 Missions and runs

A mission must include:

- source: onboarding, assistant, opportunity or manual;

- structured criteria;

- selected document IDs;

- confirmed profile fact IDs used;

- source scope;

- limitations;

- user confirmation timestamp;

- run ID and status.

A run must be durable and resumable:

```
queued → planning → searching → retrieving → extracting → matching
       → explaining → completed

Any active state → paused / partial / failed
```

The UI should show factual events, not hidden model reasoning. Each event should contain what happened, source or object reference, timestamp, status and a safe user-facing explanation.

### 4.5 Evidence and opportunity analysis

AI-generated claims must link to retrieved evidence or be explicitly labelled as inference/unknown. The backend should preserve:

- source URL;

- title and publisher;

- retrieval timestamp;

- reachability status;

- extracted passage or structured field;

- conflicting values;

- confidence/verification state;

- the opportunity requirement or claim supported.

An inaccessible page must not become an empty result. A conflicting deadline must remain a conflict until resolved or presented as unresolved.

### 4.6 Drafting and external actions

AI can propose:

- motivation letters;

- supervisor emails;

- application answers;

- research statements;

- recommender briefing material.

The user must review a diff and accept or edit the result. A recommender document must never impersonate a recommender.

External communication is divided into:

- **Prepares:** creates a draft, checklist or suggested message.

- **Would send:** sends or submits externally, only after a separate explicit confirmation.

Gmail MCP integration, when eventually enabled, should default to draft creation only. Never send automatically after an AI response.

**The contract is already frozen (Sprint 4).** The frontend speaks to the assistant through three
endpoints that the backend must implement as they are:

| Endpoint | Shape |
|---|---|
| `GET /assistant/history` | `{ messages: AssistantMessage[] }` — the thread, so a refresh does not lose it |
| `POST /assistant/messages` | `{ message, context, selectedText? }` → `{ blocks, suggestions, context }` |
| `POST /assistant/actions` | `{ action, context?, payload? }` → `{ block, route, createdId }` |

The answer is a list of **blocks**, not a paragraph: `text`, `evidence` (with its sources and
their quality), `checklist`, `draft_action`, `run` and `action`. `context` is a bounded set of
identifiers — `missionId`, `opportunityId`, `applicationId`, `draftId` and the document ids the
user authorised for that message — and never free-form instructions; the backend decides what is
actually permitted. Every action block carries an `effect` of `prepares` or `would_send`, and the
frontend refuses to present a `would_send` action without an explicit confirmation step. A
`selectedText` in the request means the revision must be scoped to that range of the draft.

---

### 4.7 No-CV path and conditional profile completion

The product must work for users who do not have a ready CV or do not want to complete a long profile before receiving value. A missing CV is not a failure state and must not block the goal-based onboarding path. The onboarding experience should be specifically easy for students who are busy, uncertain or reluctant to fill out a long profile: ask one useful question at a time, use sensible defaults, offer “I’m not sure” and “Skip for now”, explain the benefit in one sentence and reach a useful first result quickly.

Do not describe these users as lazy in the interface. Design for low effort instead:

- start with a three-choice intent card rather than a blank profile form;
- use selectable answers, chips and date pickers before free-text fields;
- pre-fill only from confirmed profile facts and label the source;
- ask no more than one focused follow-up at a time;
- show a visible progress estimate such as “2 minutes to create your first search”;
- let the user continue with partial information;
- save every answer immediately and allow exact resume after refresh;
- make “Skip for now” safe, reversible and explicit about what it leaves unresolved;
- turn every unanswered field into a later next-best action instead of a dead end.

Ask only the minimum questions needed for the selected mission. Questions must be conditional and explain why the answer matters. For example:

```text
Do you have an English certificate?
  Yes → Which certificate and level? → Upload it now or mark it as to be provided later.
  No  → Keep English proficiency unresolved → Show it as a requirement to work on.
```

The same pattern applies to education level, graduation date, nationality or residence constraints, work/research experience, funding needs and destination eligibility. A `No`, `Not sure` or `I do not have this yet` answer must produce an explicit unresolved requirement and a next action, not an invented value and not an automatic rejection.

### Date of birth and age-aware eligibility

Ask for the user's date of birth during onboarding when age can affect the selected opportunity type, funding rule, visa guidance, youth programme, work placement, summer school, fellowship or other eligibility condition. The product should explain the reason in plain language:

> “Some opportunities have age limits or age-based eligibility rules. Your date of birth helps Oppulse check those requirements accurately. It is private and you can change or remove it later.”

Store the date of birth as a protected profile attribute, not as a casual public profile label. The internal logic should derive age only when needed and should calculate it correctly relative to the relevant eligibility date, not simply subtract birth year from the current year. For an opportunity with an age cutoff, evaluate the user's age on the cutoff date stated by the official source.

The date-of-birth flow must follow these rules:

- do not ask for it before there is a clear reason or a mission where age may matter;
- allow “Prefer not to say” and explain that some age-restricted checks may remain unresolved;
- use a date picker with a typed-input fallback and validate impossible or future dates;
- never infer date of birth from nationality, education level, graduation year or a CV;
- store the full date only in the protected profile, with access controlled by user ownership and RLS;
- expose derived age eligibility results such as “Age requirement appears satisfied”, “Age requirement unresolved” or “Official cutoff needs verification”, rather than displaying the full birth date throughout the app;
- show the source and date used for the rule, because age requirements can differ between calls;
- keep age logic deterministic and testable outside the AI model;
- never let the AI guess age or turn an unknown age into an automatic rejection;
- let the user edit, delete or exclude the attribute from future AI context.

The backend should provide a dedicated age-eligibility calculation, for example:

```text
ageOn(dateOfBirth, eligibilityDate) → integer
evaluateAgeRule(age, officialRule) → satisfied | not_satisfied | unresolved | conflicting
```

The AI may extract an age rule from an official source, but a typed eligibility service must perform the calculation. The extracted rule must retain its source passage, cutoff date, comparison operator, age boundary and verification status. If two sources disagree, preserve the conflict and ask the user to review it rather than selecting a value silently.

Date of birth is sensitive personal data. It must be excluded from prompts unless the current task genuinely requires an age check, and provider logs must contain only a safe derived result or an opaque fact ID. Analytics should never record the raw date.

The frontend must:

- allow the user to continue with confirmed answers and unresolved requirements;

- avoid forcing a complete profile before showing useful opportunities;
- show which missing answer affects which requirement;
- let the user upload supporting evidence later;
- save partial answers and resume the exact branch after refresh;
- keep unconfirmed answers out of eligibility decisions;
- offer “I do not know yet” where a user cannot reasonably answer;
- distinguish “not provided”, “not applicable”, “not eligible” and “not verified”.

- store age-related eligibility outcomes separately from the protected date-of-birth attribute;

- show why date of birth is being requested before collecting it.

The AI must never treat the absence of a CV as evidence that the user lacks experience. It should say what is unknown, ask a focused follow-up when necessary and let the user decide whether to invest time in completing that part of the profile.

---

## 5. AI Integration Experience

The AI should feel useful without pretending to be autonomous beyond its permissions.

### User-visible flow

```
User goal or document
→ Oppulse summarizes its understanding
→ asks only missing questions
→ shows selected context and consent
→ creates a mission
→ runs research with factual progress events
→ returns evidence-backed findings
→ proposes one next action
```

### Provider adapter boundary

The backend should expose provider interfaces such as:

- `ModelProvider` for structured reasoning and drafting;

- `SearchProvider` for discovery;

- `SourceFetcher` for controlled retrieval;

- `DocumentExtractor` for PDF/DOCX processing;

- `EmailNotificationProvider` for email delivery;

- future `GmailDraftProvider` for user-approved draft creation;

- future `MeetingAssistantProvider` for Zoom/Google Meet preparation or live assistance.

Provider failures become typed events and recoverable states. They must not silently produce empty results or invented facts.

### Prompt and context privacy

- Send only the minimum context needed for the current task.

- Prefer extracted structured facts over entire original files.

- Make document and fact scope visible before a run.

- Redact unrelated personal data when possible.

- Keep provider prompts and responses out of browser logs.

- Store only the minimum audit information required for safety and debugging.

- Give the user a clear way to remove a document or exclude a fact from future AI context.

---

## 6. Email-First Notification Design

### Frontend requirements

- Settings shows verified email status and email alert controls.

- Users choose immediate alert, daily digest, weekly digest or no email for each supported alert type.

- In-app notifications are always visible independently of email delivery.

- Email delivery status is shown as pending, delivered, failed or not configured.

- Retry actions are safe and idempotent.

- Users can update their email only through authenticated account verification.

- Notification copy includes what changed, why it matters and what to do next.

### Backend requirements

- Use an email provider adapter behind a server-side secret.

- Verify addresses before sending sensitive opportunity or application information.

- Use an outbox or durable notification job to avoid losing alerts during provider failures.

- Add idempotency keys to prevent duplicate sends.

- Rate-limit and aggregate noisy monitoring events.

- Keep a delivery audit record without storing unnecessary message content.

- Provide unsubscribe and preference enforcement.

- Treat email failure as a delivery failure, not a loss of the in-app event.

### Future mobile app

Mobile push is a later channel. Design the notification domain so it can be added without changing alert semantics, but do not add mobile controls to the web UI until the mobile application, permissions and device-token lifecycle exist.

---

## 7. Privacy, Safety and Trust Requirements

Before real user testing, implement:

- tenant/user ownership checks on every profile, document, mission, run, draft and alert;

- private storage with short-lived signed URLs;

- deletion of documents and extracted facts with clear dependency behavior;

- audit log for consent changes, fact confirmations, draft acceptance and external-action approval;

- no secrets in the frontend bundle;

- safe error messages that do not disclose another user's resources;

- explicit AI/provider status;

- clear distinction between source fact, extraction proposal, AI inference and user-authored content;

- no automatic email sends, application submissions or meeting actions;

- retention policy for files, extracted text, prompts and run events;

- privacy review before enabling Gmail, Zoom or Google Meet connections.

---

## 8. Implementation Sequence

### Step B0 — Stabilize and clean the frontend

- Fix the failing HomePage test.

- Complete `npm.cmd run check`, build and browser journey execution.

- Remove Telegram from source, schemas, fixtures, handlers, UI and documentation.

- Replace Telegram delivery with in-app + email contracts.

- Add missing document upload and processing schemas.

- Persist onboarding document references and run states.

### Step B1 — Backend foundation

- Create FastAPI `/api/v1` service.

- Add Supabase Auth, Postgres, private Storage and RLS.

- Mirror the frozen Zod schemas with Pydantic models.

- Implement session, profile, onboarding draft, document and mission endpoints.

- Add contract comparison in CI.

### Step B2 — Document and profile intelligence

- Implement secure upload.

- Extract PDF/DOCX text server-side.

- Create proposed facts with provenance.

- Add profile fact confirmation/correction/exclusion.

- Ensure confirmed facts invalidate and refresh opportunity matching.

### Step B3 — AI and research loop

- Implement mission interpretation with structured output.

- Add search and controlled source retrieval.

- Extract requirements, funding and deadlines with evidence.

- Run matching only against confirmed, non-excluded facts.

- Stream or poll durable factual run events to the frontend.

### Step B4 — Applications and email

- Implement draft generation with proposal/diff semantics.

- Add application checklists and document requirements.

- Add email notification preferences, outbox jobs and delivery status.

- Add optional Gmail draft integration only after consent and explicit connection.

### Step B5 — Future meeting integrations

- Treat Zoom/Google Meet as a separate privacy-reviewed capability.

- Start with interview preparation, agenda and question generation.

- Add live assistance only with explicit session start/stop, participant consent and clear data handling.

---

## 9. Phase B Acceptance Criteria

Phase B frontend initialization is complete when:

- The full landing → onboarding → mission → run → workspace flow works against MSW and a FastAPI contract.

- The frontend has no Telegram references or Telegram-shaped fields.

- In-app alerts and email are the only current notification channels.

- Email failure does not remove or hide an in-app alert.

- All document, profile, mission and run data is represented by stable schemas.

- Real AI responses are structured, evidence-linked and visibly distinct from synthetic fixtures.

- No unconfirmed fact affects eligibility or fit.

- Users understand what documents and facts are being used before AI processing.

- Drafts are never sent or submitted automatically.

- Provider secrets remain server-side.

- Auth, RLS, private files, deletion, consent and audit behavior are tested.

- The frontend passes typecheck, lint, formatting, unit/component tests, accessibility gates, browser journeys and production build.

- The user can use Oppulse through in-app alerts and verified email without any Telegram dependency.

---

## Instruction to the coding agent

Proceed with **Step B0 first**. Do not begin real AI or backend integration while the HomePage regression and Telegram cleanup remain unresolved. Preserve the current honest mock mode, keep MSW paths identical to the planned FastAPI paths, and implement the email-first notification contract so the future backend can be connected without another frontend redesign. The platform will be tested with real students: some will upload a CV, while others will use the question-led path because they do not have a ready resume or do not want to complete a long profile. The experience must ask only the necessary conditional questions—for example, whether the user has an English certificate, then the certificate level if the answer is yes, or an explicit unresolved requirement to work on if the answer is no.
