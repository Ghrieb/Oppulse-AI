# Oppulse AI — Final MVP Plan for Real Student Testing and AI Integration

**Status:** Final implementation brief for the coding agent  
**Mode:** Private student testing with real documents and explicit consent  
**Primary goal:** Make Oppulse AI useful for real students by reducing the time required to discover, understand, verify and prepare applications for opportunities.  
**Current state:** The frontend is still in mock mode. The next work must move it toward a real, contract-safe, AI-ready flow without pretending that unfinished services are live.

---

## 1. Locked Product Decisions

The first real testing cohort will use **real CVs and documents in a private staging environment**. Students must explicitly consent before their documents are stored privately, extracted and sent as necessary context to Groq for AI processing. They must be able to delete documents and exclude extracted facts from future AI use.

Groq is the first live AI provider. It must sit behind a provider adapter, structured-output validation and a deterministic evaluation harness. No model key may reach the browser.

Azure is available through an Azure for Students subscription, but Azure resource provisioning, region selection, resource-group naming and the exact deployment list will be planned later by Hani, Manus and the coding agent together. The coding agent must prepare the runbook and deployment artifacts now, but must not provision Azure resources without a later explicit infrastructure decision.

Email notifications are **not an MVP priority** and will not block student testing. In-app status and task visibility are sufficient for the first MVP. An email provider adapter may be designed, but no production email provider needs to be selected or made functional in this pass.

The first MVP will only prepare drafts, checklists, application plans and interview-preparation materials. It will not automatically send email, submit applications, create Gmail drafts, join Zoom/Google Meet meetings or perform other external actions.

Demo mode keeps the current synthetic-fixture disclosure. Private Student Testing mode replaces the global prototype message with capability-specific statuses such as `live`, `simulated` and `unavailable`.

Authentication is not yet locked. Before implementation, the coding agent must produce a short decision record comparing Supabase Auth with FastAPI-owned authentication. No authentication system should be partially implemented twice.

---

## 2. Product North Star

Oppulse is not primarily a notification product or a dashboard. Its MVP value is:

> **A student gives Oppulse a goal, a document or an opportunity. Oppulse asks only what is necessary, researches the opportunity, checks it against confirmed information, explains uncertainty and produces the next useful action.**

The real student flow is:

```text
Goal, CV or opportunity
→ low-effort onboarding
→ country interests with flags
→ consent and context selection
→ mission preview
→ AI research and extraction
→ evidence-backed eligibility analysis
→ unresolved requirements
→ next-best action
→ draft, checklist or application plan
```

The system must be useful for two student types:

1. Students who upload a CV and expect Oppulse to extract useful information.
2. Students who do not have a CV ready or do not want to complete a long profile, and prefer to answer focused questions.

A missing CV must never be interpreted as a lack of experience.

---

## 3. Mode Model

### 3.1 Demo mode

Demo mode remains deterministic and safe for committee review.

- Uses synthetic names, programmes, sources and documents.
- Uses MSW fixtures and offline replay.
- Shows the banner:

> **Prototype data**  
> The backend is not connected yet. Names, programmes and sources below are synthetic fixtures.

- Shows capability statuses as simulated or unavailable.
- Must not use real student documents or live provider calls.

### 3.2 Private Student Testing mode

Student Testing mode is available only in private staging after the environment and privacy gates pass.

- Uses authenticated student accounts.
- Allows real documents after explicit consent.
- Uses private storage and user ownership controls.
- Uses Groq only through the backend provider adapter.
- Shows per-capability status instead of the generic synthetic-data banner.
- Clearly distinguishes live, simulated and unavailable services.
- Keeps in-app alerts and task states available even if optional notification delivery is not configured.
- Records safe request IDs and durable run events without logging personal document contents or prompts.

The mode must be explicit in Settings and in the environment configuration. A staging API must never silently use production data.

---

## 4. Wave 0 — Frontend Contract and Student-Flow Cleanup

### 4.1 Remove Telegram and defer notifications

Remove Telegram from the source code, schemas, fixtures, handlers, Settings UI, Monitoring UI and documentation. The current MVP notification model is:

```ts
type ActiveNotificationChannel = 'in_app';
type FutureNotificationChannel = 'email' | 'mobile_push';
```

Email should remain an optional future adapter, not a blocker for the MVP. Do not add a functional email provider until the core AI flow is stable. In-app alerts and durable next actions are sufficient for the first real student test.

If email contracts remain in the backend design, keep them separate from active MVP capability responses. Do not advertise email as live merely because a schema exists.

### 4.2 Upload contract

Replace any upload call that does not validate a response with a typed contract:

```text
POST /documents
→ document id, filename, size, media type, processing state, ownership scope
```

The onboarding draft must persist:

- selected starting intent;
- reference opportunity URL if present;
- uploaded document ID;
- processing state;
- selected document consent state;
- current question ID;
- answers and answer sources;
- updated timestamp.

The materials flow must resume from the server-backed draft, not a local boolean.

### 4.3 Mission and run contracts

Complete the mission contract before backend mirroring. It must include:

- mission source;
- structured criteria;
- selected document IDs;
- confirmed fact IDs used;
- source scope;
- limitations;
- user confirmation timestamp;
- run ID and status.

Research runs must be durable and resumable:

```text
queued → planning → searching → retrieving → extracting → matching
       → explaining → completed

Any active state → paused | partial | failed
```

A browser refresh must not lose a run or create a duplicate run.

### 4.4 Low-effort onboarding

Onboarding should be designed for students who are busy, uncertain or reluctant to fill out a long profile. Do not describe them as lazy in the UI; design for low effort.

Required behavior:

- start with three intent cards: goal, materials or opportunity link;
- ask one useful question at a time;
- prefer chips, choices and date pickers over free-text forms;
- show a short progress estimate;
- offer “I’m not sure” and “Skip for now”;
- save every answer immediately;
- allow partial information;
- explain in one sentence why a question matters;
- make skipped questions reversible;
- convert unanswered information into a next-best action;
- reach a useful mission preview quickly;
- never require a complete profile before showing value.

### 4.5 Conditional questions

Questions must be conditional and driven by the active mission. Example:

```text
Do you have an English certificate?
  Yes → Which certificate? → What level? → Upload now or provide later.
  No  → Keep English requirement unresolved → Create a next action to address it.
  Not sure → Mark as unverified → Ask for evidence later if needed.
```

The same logic applies to education, graduation date, nationality or residence constraints, experience, funding needs, destinations and age-related rules.

A negative or unknown answer must produce an unresolved requirement, not an invented value and not an automatic rejection.

### Country interests with flags

The onboarding flow must include a multi-select country step for students who have destination preferences. Students can select one or more countries using an accessible country list with inline flags and visible country names. The country codes, not rendered flag images, are stored in the mission contract.

The selection must:

- support multiple countries;
- show the country name beside every flag;
- provide keyboard and screen-reader labels;
- allow search when the supported list becomes large;
- allow removal and editing from the mission preview;
- include a clear “Global / no preference” path without pretending it is a country;
- become a real research criterion for the AI;
- affect source discovery, opportunity ranking and institution descriptions;
- preserve the user's order or priority when they explicitly provide one;
- never infer destination preference from nationality alone.

Country identity should use local inline SVG flags for known countries and a text/ISO fallback for unsupported countries. Windows emoji flags must not be used as the primary representation. A flag is a visual aid, not evidence of eligibility.

---

## 5. Wave 0 — Date of Birth and Age Eligibility

Date of birth is collected only when the selected mission may contain age-dependent rules, such as youth programmes, summer schools, fellowships, placements, work opportunities or visa-related guidance.

The UI should explain:

> Some opportunities have age limits or age-based eligibility rules. Your date of birth helps Oppulse check those requirements accurately. It is private and you can change or remove it later.

Use a dedicated protected profile section, not a normal profile fact:

```ts
protectedProfile.dateOfBirth = {
  value: string | null,
  status: 'not_provided' | 'provided' | 'declined' | 'excluded',
  source: string | null,
  updatedAt: string,
  excludedFromAiContext: boolean,
}
```

Rules:

- support “Prefer not to say”;
- validate impossible and future dates;
- provide date-picker and typed-input paths;
- never infer date of birth from nationality, education, graduation year or a CV;
- do not display the full date throughout the workspace;
- allow edit, delete and exclude controls;
- exclude the raw date from analytics, browser logs and provider logs;
- do not include it in AI context unless the current task genuinely requires an age check.

The age calculation must remain deterministic and outside the AI model:

```text
ageOn(dateOfBirth, eligibilityDate) → integer

evaluateAgeRule(age, officialRule)
→ satisfied | not_satisfied | unresolved | conflicting
```

The official source determines the eligibility date. If multiple sources disagree, preserve the conflict and ask the user to review it. The AI may extract the rule but may not calculate, guess or silently decide age eligibility.

---

## 6. Wave 1 — Authentication Decision Gate

Before implementing authentication, create `docs/auth-decision-record.md` comparing:

| Concern | Supabase Auth | FastAPI-owned Auth |
|---|---|---|
| Password handling | Supabase | FastAPI/Argon2id |
| Sessions/JWTs | Supabase | FastAPI |
| Email verification | Supabase | FastAPI + provider |
| Password reset | Supabase | FastAPI + provider |
| FastAPI responsibility | Validate token and authorize resources | Own the complete identity lifecycle |
| Security scope | Smaller initial scope | Larger implementation and audit scope |
| Migration cost | Lower if already configured | Higher if later switching |
| Staging isolation | Separate Auth project/config | Separate user tables/config |

The decision record must recommend one approach, identify the migration implications and update the architecture documentation before implementation.

Do not build both systems. The selected system must cover:

- sign-up;
- sign-in;
- email verification;
- password reset;
- session expiry;
- return-to-destination;
- user ownership and authorization;
- staging/production separation.

---

## 7. Wave 1 — Local FastAPI and Offline AI Harness

Create a local backend skeleton without Azure provisioning or live keys.

### 7.1 Backend foundation

Implement:

- `/health` with no secret disclosure;
- `/health/ready` for dependency readiness;
- `/api/v1/capabilities` with per-service capability state;
- the same typed error envelope as the frontend;
- request ID middleware;
- redacting structured logs;
- explicit CORS origin allowlist;
- authentication boundary from the approved decision record;
- user/resource ownership checks.

### 7.2 Provider adapters

Define interfaces for:

- `ModelProvider`;
- `SearchProvider`;
- `SourceFetcher`;
- `DocumentExtractor`;
- `EmailNotificationProvider` as a future adapter only.

Every provider interface must first have a replay implementation that uses synthetic fixtures. The replay path must run without network access, provider keys or real documents.

### 7.3 Staged AI pipeline

The AI pipeline must be split into typed stages:

```text
mission interpretation
→ requirement extraction
→ source retrieval and normalization
→ evidence-grounded explanation
→ confirmed-profile matching
→ next-action derivation
→ draft proposal
```

Do not build one opaque prompt that searches, decides eligibility, invents explanations and writes application material simultaneously.

### 7.4 AI/deterministic boundary

| Function | AI role | Deterministic role |
|---|---|---|
| Goal interpretation | Propose structured mission | Validate schema and user scope |
| Requirement extraction | Propose requirement and evidence | Validate source and structure |
| Source retrieval | Select/search through tools | Track status, reachability and retries |
| Explanation | Draft grounded explanation | Require evidence links |
| Profile matching | Propose relevant comparison | Apply confirmed facts and rules |
| Age calculation | None | `ageOn` service |
| Eligibility decision | None as final authority | Rule engine |
| Next action | May suggest candidates | Priority function selects action |
| Drafting | Generate proposal | User review/diff/acceptance |
| Sending/submission | None | Disabled in MVP; explicit future approval |

Model outputs must be typed as proposals or candidates. Final decision types may only be constructed by deterministic services.

The final decision record must be re-derivable from the recorded proposals, evidence and deterministic services. Never evaluate hidden chain-of-thought; evaluate observable outputs and factual event timelines.

### 7.5 Server-owned conversation context

The backend owns conversation threads and assembles context per turn. Persist:

- thread ID;
- user ID;
- mission ID;
- user message and safe assistant response;
- selected context IDs;
- selected fact IDs;
- selected document IDs;
- consent state used for the turn;
- proposal/action IDs;
- timestamp and run ID.

The harness must verify that:

- a document excluded by the user is not included later;
- a corrected fact replaces the previous value;
- a new mission does not inherit unrelated context;
- sensitive date-of-birth data is included only for an age check;
- prompt-injection content is treated as untrusted data.

---

## 8. AI Evaluation Fixtures and Student-Flow Tests

Create versioned synthetic fixtures for offline evaluation:

1. confirmed education with missing language evidence;
2. conflicting deadlines across official pages;
3. professional changing fields;
4. malformed or partially unreadable CV;
5. prompt-injection instructions inside a web page;
6. unreachable or rate-limited source;
7. tuition-only funding;
8. excluded sensitive fact;
9. age-restricted opportunity with satisfied rule;
10. age-restricted opportunity with unresolved or conflicting rule.

Add multi-turn scenarios:

```text
English certificate: Yes
→ certificate type
→ level
→ requirement becomes supported
```

```text
English certificate: No
→ no rejection
→ requirement remains unresolved
→ next action is created
```

```text
No CV
→ answer focused questions
→ mission preview
→ opportunity analysis
→ missing-document action only where relevant
```

Every fixture must assert:

- schema validity;
- mission fidelity;
- requirement classification;
- confirmed-fact safety;
- evidence grounding;
- conflict preservation;
- unreachable-source behavior;
- no admission-probability claims;
- draft safety;
- prompt-injection resistance;
- privacy minimization;
- failure and quota behavior;
- age calculation and age-rule handling;
- next-action correctness.

---

## 9. Visual identity, media context and opportunity workspace

### 9.1 Country flags and institution identity

Country flags and institution identity should improve recognition without becoming a source of false authority.

Use this resource hierarchy:

1. Local inline SVG flag plus visible country name.
2. Deterministic generated institution monogram and campus illustration for synthetic or unverified institutions.
3. Backend-validated, cached official institution logo or banner for verified real institutions in Student Testing mode.
4. Neutral fallback when an asset is unavailable or fails.

The browser must never fetch arbitrary third-party logos or campus images directly. A backend-provided asset must include its official domain association, source, verification timestamp, attribution where required and a stable cached URL or data representation. Images are optional decoration; they must never block analysis, create layout shift or be treated as evidence of eligibility, reputation or funding.

The generated fallback is not an apology for missing assets. It is the truthful default for synthetic demo records. Demo mode must make zero third-party media requests. Student Testing mode may display verified real assets without changing frontend components.

### 9.2 AI chat and right-side opportunity panel

The AI chat remains the control surface, but it should return structured responses rather than a paragraph-only transcript. When a student asks about a specific opportunity or institution, the assistant may offer an action such as `Open opportunity`, `Compare`, `Save`, `Check eligibility`, `Draft inquiry` or `Create checklist`.

The selected opportunity can open in a controllable right-side panel on desktop and a full-screen or bottom-sheet detail view on mobile. The panel must:

- preserve the chat thread;
- show the selected institution, country, programme and opportunity identity;
- show official source links and evidence status;
- show eligibility, funding, deadline and confidence sections;
- show verified logo/banner assets or generated fallbacks;
- show optional media context with clear labels;
- support pin, close and switch-to-another-opportunity actions;
- keep the active mission and selected context visible;
- allow actions to return a result to the chat without losing the current panel;
- never silently switch the student's selected opportunity because of an AI response.

On narrow screens, the same state must be represented by a route or sheet that can be closed and restored without losing the conversation.

### 9.3 Images and YouTube media

The AI may use official images and YouTube videos to provide richer institution or programme context, but media is secondary evidence.

The media contract should include:

```ts
type MediaContext = {
  kind: 'image' | 'video';
  url: string;
  title: string;
  publisher: string;
  publishedAt?: string;
  sourceType: 'official' | 'verified_provider' | 'secondary';
  attribution?: string;
  summary?: string;
  status: 'available' | 'unavailable' | 'not_reviewed';
};
```

Rules:

- prefer official institution or programme sources;
- preserve the original URL, title, publisher/channel and date when available;
- embed or link to YouTube rather than downloading or re-hosting the video;
- do not claim that a video or promotional image proves eligibility, funding, deadline or admission likelihood;
- label AI-generated media summaries as “Media context” or “Secondary source”;
- keep official text and structured evidence authoritative for consequential claims;
- show unavailable, blocked or removed media honestly;
- do not send unrelated image/video content to Groq;
- treat captions, descriptions, transcripts and web-page instructions as untrusted input;
- test prompt-injection content inside media descriptions and transcripts.

The assistant may answer questions such as “What is this institution like?” by combining verified institutional text, structured opportunity evidence and clearly labelled media context. It must separate:

```text
What the official source states
What the media shows or describes
What Oppulse infers
What remains unknown
```

### 9.4 Institution descriptions in chat

For a question about an institution, the AI response should be concise first and expandable second. It should provide:

- a plain-language description;
- location and country;
- institution type where verified;
- relevant programme or research context;
- important evidence links;
- a “What I could not verify” section when needed;
- optional media context;
- a direct action such as open panel, compare, check fit or draft an inquiry.

The response must not invent rankings, campus quality, acceptance rates, student experience or institutional reputation. Promotional wording should remain attributed to the original source.

### 9.5 AI drafting from approved context

The MVP may draft:

- motivation letters;
- supervisor emails;
- research statements;
- recommender briefing material;
- concise inquiry emails to institutions, programme contacts or scholarship coordinators.

An inquiry draft may use the selected opportunity, verified institution contact details, official requirements, the student's confirmed profile and approved media context. It must clearly mark unknown details and avoid unsupported claims.

Every draft must show:

- the context used;
- claims requiring review;
- source links where a factual claim came from;
- a word-level or block-level diff when revising an existing draft;
- `Prepares` status rather than `Sent` status;
- copy/export controls that do not send anything.

The MVP must not send the inquiry, create a Gmail draft or contact an institution automatically. The student remains responsible for reviewing the recipient, claims, attachments and final wording.

---

## 10. Azure Preparation — No Provisioning Yet

The coding agent should prepare, but not provision, the Azure path.

Create:

- `docs/environments.md`;
- `docs/azure-runbook.md`;
- deployment workflow skeletons;
- health/readiness smoke tests;
- environment variable templates with placeholders only;
- App Service startup documentation;
- Static Web Apps build documentation;
- explicit CORS origin configuration;
- secret isolation checklist;
- staging/production data-boundary checklist.

The eventual Azure flow is:

```text
Azure subscription decision
→ resource group and region approval
→ Static Web Apps setup
→ App Service setup
→ HTTPS and CORS
→ secret configuration
→ Supabase staging connection
→ API health/readiness
→ capability check
→ AI provider smoke test
→ student journey smoke test
```

No Azure resource, Groq key or production data should be used until the resource list and environment boundary are explicitly approved.

---

## 11. Real Student Testing Readiness

Before inviting real students, verify:

- private staging environment is isolated from production;
- authentication and user ownership are working;
- real document consent is explicit;
- documents use private storage and signed access;
- students can delete documents;
- students can exclude extracted facts;
- sensitive attributes are protected;
- AI processing is visible and cancellable where possible;
- all model outputs are labelled as proposal, extracted fact or evidence-backed result;
- unavailable sources are shown honestly;
- conflicting deadlines and funding are preserved;
- no unconfirmed fact affects eligibility;
- no automatic messages or submissions occur;
- all AI runs have durable status and recovery;
- student data is not printed in logs or analytics;
- a student can complete the no-CV path;
- a student can resume after refresh or temporary network loss;
- a student can understand what Oppulse knows, what it used and what remains uncertain.

The student testing consent screen must explain:

- what documents are stored;
- what text or structured facts may be sent to Groq;
- why the information is needed;
- how long it is retained;
- how to delete it;
- how to exclude a fact;
- which capabilities are live, simulated or unavailable.

---

## 12. MVP Scope Exclusions

The first student-testing MVP does not require:

- email notification delivery;
- mobile push notifications;
- automatic Gmail sending;
- automatic Gmail draft creation;
- application submission;
- automatic external form completion;
- Zoom or Google Meet joining;
- live interview assistance;
- real-time monitoring guarantees;
- hidden autonomous actions;
- a complete profile before first value.

These may become later product increments only after the core AI flow demonstrates that it saves students time and produces trustworthy results.

---

## 13. Final Gate Before Live Student Testing

The coding agent may declare the MVP ready only when all of the following pass:

1. Demo mode remains deterministic and visibly synthetic.
2. Student Testing mode runs against private staging configuration.
3. The authentication decision is documented and implemented once.
4. Real document consent, deletion and exclusion work.
5. Groq calls occur only server-side through the provider adapter.
6. Offline replay and synthetic evaluation pass before live provider calls.
7. The AI/deterministic decision boundary is enforced by types and tests.
8. Age eligibility is calculated deterministically and date of birth remains protected.
9. The no-CV question-led path works end to end.
10. Research runs are durable, resumable and observable.
11. Evidence, conflicts and unresolved requirements are preserved.
12. No automatic sending or submission is possible.
13. Typecheck, lint, formatting, unit/component tests, accessibility tests, Playwright journeys and production build pass.
14. A provider failure can be demonstrated without invented results.
15. The student can complete a useful goal-to-next-action journey in a reasonable session.

---

## Instruction to the coding agent

Start with **Wave 0**, but do not start live Groq calls, Azure provisioning or real student testing until the offline replay harness, authentication decision record, protected date-of-birth contract, no-CV journey and privacy gates are complete.

The core objective is not to remove the “Prototype data” label merely for appearance. The objective is to create two honest modes: a deterministic Demo mode and a private Student Testing mode where each capability is truthfully labelled. The first real student experience should focus on the AI solving the student’s problem, reducing research time and producing an evidence-backed next action.
