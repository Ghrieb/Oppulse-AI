# Oppulse AI — Production Transition and Student App Release Plan

**Status:** Pre-release implementation directive  
**Audience:** Coding agent, product owner and deployment team  
**Purpose:** Transition Oppulse from Demo/Local Live/Student Testing into a real student-facing application without exposing development diagnostics, prototype labels or engineering concepts in the product UI.  
**Important:** Development modes, capability states, route details, request IDs, replay status and deployment diagnostics belong in documentation, logs and internal tooling—not in the normal student experience.

---

## 1. Release principle

Oppulse must not be presented to students as a developer console. The student should experience a coherent application that helps them understand opportunities, verify requirements and take the next action.

The internal implementation may have multiple environments and provider states, but the product surface must show only the information necessary for a student to make a good decision.

```text
Internal complexity
→ stable backend contract
→ product-level states
→ clear student language
→ no engineering labels
```

Do not expose phrases such as:

- Prototype data
- Backend not connected
- Local Live
- Student Testing mode
- MSW
- FastAPI
- replay provider
- capability strip
- API mode
- provider unavailable as an engineering diagnostic
- route, request or deployment IDs in ordinary screens
- synthetic fixture
- mock data
- staging
- Azure
- Groq or Tavily implementation details

These may exist in internal documentation, test tooling, administrator views or support diagnostics. They must not appear in the standard student-facing application.

---

## 2. Environment and product-mode separation

Keep environment configuration separate from product copy and visual design.

### 2.1 Internal environments

```text
Development
  Local frontend + local FastAPI + replay providers

Staging
  Private deployment + isolated database/storage + approved live providers

Production
  Public deployment + production database/storage + production secrets
```

Environment selection is deployment configuration. It is not a student-facing mode switch.

### 2.2 Product-facing states

The student application should use product language, not infrastructure language:

| Internal condition | Student-facing result |
|---|---|
| Replay provider | A useful result with no provider label, if the result is clearly marked as a draft/preview where necessary |
| Provider unavailable | “We could not complete this analysis right now. Your work is saved.” |
| Source unreachable | “This source could not be reached. It is not treated as evidence that the opportunity is unavailable.” |
| Partial extraction | “We read some parts of this document. Please review the highlighted information.” |
| Unverified fact | “This information needs your confirmation.” |
| Staging environment | No label in the normal UI; use internal environment metadata and deployment checks |
| Synthetic committee fixture | Only visible in a dedicated Demo build, never in the real student build |
| Live provider | No provider badge required; show source/evidence quality instead |
| Deferred notification feature | Do not show an email feature that is not functional |

### 2.3 Demo build versus student build

A separate Demo build may retain the synthetic-data disclosure required for committee evaluation. The real student build must not inherit that banner.

Use build-time configuration rather than a visible runtime toggle:

```text
APP_BUILD=demo
APP_BUILD=student
```

The student build must fail closed if it receives demo-only fixture data or a demo-only capability flag.

The coding agent must not implement a user-accessible switch that lets a student enter Demo, Local Live or Student Testing mode.

---

## 3. Student-facing UI policy

### 3.1 Remove engineering vocabulary

The normal student UI should describe outcomes, not implementation:

Bad:

```text
AI: mocked
Search: replayed
API: live
Backend connected
Prototype data
```

Good:

```text
Analysis ready
Sources reviewed
Some requirements still need confirmation
Your document is being processed
Your work is saved
We could not verify this yet
```

### 3.2 Error language

Errors should answer four questions:

1. What happened?
2. Did the user’s work remain safe?
3. What is uncertain?
4. What can the user do next?

Use product language such as:

- “Your mission is saved. Try the analysis again.”
- “We could not verify this deadline from the sources we reached.”
- “Some pages could not be read. You can review the extracted information or upload a clearer file.”
- “This requirement is still unresolved because no certificate evidence was provided.”

Do not show stack traces, endpoint names, provider names, environment names or implementation labels.

### 3.3 Internal diagnostics

Request ID, run ID, error code and environment may be available through:

- server logs;
- protected support tooling;
- an authenticated internal support route;
- a controlled support export;
- development-only browser diagnostics.

They must not appear by default in the student UI. If a support reference is needed, expose a short user-safe reference such as “Support reference available” behind an optional help action, without displaying raw internal metadata.

### 3.4 Capability visibility

Remove the engineering capability strip from the normal student workspace. Replace it with contextual product states:

- “Ready to analyse”
- “Processing your document”
- “Sources being reviewed”
- “Needs your confirmation”
- “Saved for later”
- “Temporarily unavailable”

A protected internal diagnostics page may show service health and provider state for authorized staff only. It must not be routable from ordinary student navigation.

---

## 4. Production-ready application shell

The production shell should focus on the student’s work:

```text
Current mission
→ next useful action
→ assistant conversation
→ opportunity results
→ saved work and drafts
```

The shell must not contain:

- a development status bar;
- environment selector;
- API mode selector;
- raw provider statuses;
- synthetic-data labels in the student build;
- engineering terminology.

The student may see meaningful product states such as “processing”, “needs review”, “partially verified” and “saved”.

---

## 5. Release architecture

### 5.1 Frontend

The frontend must:

- use one stable component hierarchy across environments;
- receive only product-safe capability and error representations;
- never call providers directly;
- never contain provider keys;
- never branch on provider implementation names;
- fail safely when a response is incomplete;
- preserve user work across route changes and recoverable failures;
- use build-time environment configuration, not user-controlled mode switches.

### 5.2 Backend

The backend must:

- translate provider failures into stable product error codes;
- keep provider-specific details in logs and internal telemetry;
- enforce ownership and authorization on every user resource;
- maintain durable run states and idempotency;
- keep source reachability distinct from no-results;
- return structured assistant blocks;
- prevent demo fixtures from entering the student environment;
- enforce environment-specific data boundaries;
- support deletion and exclusion of documents and extracted facts.

### 5.3 Internal observability

Use structured logs and telemetry for:

- request IDs;
- run IDs;
- latency;
- provider errors;
- quota and retry counts;
- extraction states;
- queue/lease state;
- contract errors;
- deployment version;
- environment;
- safe aggregate product metrics.

Redact:

- CV and document contents;
- date of birth;
- raw prompts;
- personal email addresses where not required;
- access and refresh tokens;
- signed storage URLs;
- model responses containing personal information.

---

## 6. Transition stages

### Stage 0 — Internal development complete

Required before staging:

- mock journeys pass;
- local FastAPI journeys pass;
- contract comparison is green;
- all intended routes are reconciled;
- structured institution, evidence, media and draft blocks render;
- no-CV path works;
- country selection affects mission criteria;
- date-of-birth logic is protected and deterministic;
- document extraction states are complete;
- run worker is durable and resumable;
- error and recovery states are tested;
- keyboard and 200% zoom checks pass;
- the student build contains no development labels.

### Stage 1 — Private staging preparation

Prepare, but do not yet invite students:

- isolated staging database;
- private storage bucket/container;
- staging authentication configuration;
- staging frontend and API origins;
- CORS allowlist;
- secure secret configuration;
- provider adapters;
- background worker process;
- health and readiness checks;
- deployment version reporting for internal telemetry;
- deletion and restoration procedures;
- backup and rollback procedure;
- support access policy.

### Stage 2 — Synthetic staging smoke test

Use synthetic documents and fictional identities only.

Verify:

- sign-up and verification;
- authentication expiry and recovery;
- upload, extraction and deletion;
- OCR and partial extraction;
- mission creation;
- research run and lease recovery;
- source unreachable behavior;
- structured AI responses;
- right-side opportunity panel;
- evidence and uncertainty display;
- draft review without sending;
- logging redaction;
- no demo banner or development label in the student build;
- no provider key in frontend assets;
- no third-party media requests in Demo build.

### Stage 3 — Internal acceptance

A small authorized internal group uses the staging application as a student would. They test realistic journeys and record issues in a release checklist, not in ad hoc chat.

Acceptance must cover:

- first-time onboarding;
- no-CV path;
- CV path;
- country selection;
- English certificate branching;
- date-of-birth explanation and refusal;
- opportunity comparison;
- institution questions;
- media context;
- inquiry drafting;
- error recovery;
- mobile and keyboard use;
- deletion and fact exclusion.

### Stage 4 — Controlled student cohort

Invite a small consented cohort only after the internal acceptance gate passes.

The consent screen must explain:

- what is stored;
- what extracted text or facts may be sent to Groq;
- why it is needed;
- retention period;
- deletion process;
- fact exclusion process;
- source and AI limitations;
- that Oppulse prepares work but does not automatically send or submit applications.

Collect structured feedback on:

- time saved;
- clarity of questions;
- trust in extracted facts;
- usefulness of next actions;
- quality of institution explanations;
- confusion or anxiety caused by errors;
- success of the no-CV path;
- mobile usability.

### Stage 5 — Real app deployment

Promote only after the controlled cohort confirms that the core journey is useful and safe.

Production promotion requires:

- approved Azure resource list;
- approved region and resource group;
- production database/storage isolation;
- production secrets configured outside source control;
- deployment smoke tests;
- rollback version identified;
- database migrations tested;
- health/readiness checks green;
- error-rate and latency thresholds defined;
- support and incident process ready;
- student-facing copy reviewed;
- privacy and deletion checks passed;
- no development labels in the production build.

---

## 7. Feature flags and promotion rules

Feature flags must be server-controlled or deployment-controlled. They must not be hard-coded into UI copy.

Recommended capability flags:

```text
ai_analysis_enabled
web_research_enabled
document_extraction_enabled
ocr_enabled
media_context_enabled
institution_panel_enabled
inquiry_drafts_enabled
email_notifications_enabled
external_submission_enabled
```

For the MVP:

```text
ai_analysis_enabled = controlled
web_research_enabled = controlled
document_extraction_enabled = controlled
ocr_enabled = controlled
media_context_enabled = controlled
institution_panel_enabled = enabled
inquiry_drafts_enabled = enabled
email_notifications_enabled = disabled
external_submission_enabled = disabled
```

A disabled capability must produce a useful product state and next action, not an engineering status label.

Example:

```text
Capability disabled internally:
“We cannot analyse this document right now. You can continue with the questions instead.”
```

Do not expose a feature flag name to students.

---

## 8. Security and privacy release gate

Do not release to real students until all of the following are verified:

- authentication decision is documented and implemented once;
- rate limiting and brute-force protection are active;
- cookies, sessions and refresh-token rotation are secure;
- user ownership is tested for every private resource;
- private storage requires authorization or signed access;
- deletion removes both metadata and document content according to the retention policy;
- excluded facts are not reintroduced into AI context;
- date of birth is protected and not logged;
- raw documents are not placed in telemetry;
- provider keys are server-side only;
- CORS and origin allowlists are explicit;
- staging and production data are isolated;
- backups and deletion behavior are understood;
- prompt injection is treated as untrusted source content;
- drafts never send or submit automatically;
- audit events cover consent, document processing, fact confirmation, exclusion and draft approval.

---

## 9. Deployment and rollback gate

Every deployment must have:

- immutable version identifier;
- migration plan;
- health check;
- readiness check;
- smoke-test script;
- rollback target;
- changed-contract summary;
- feature-flag state;
- owner and deployment timestamp;
- safe failure behavior.

If a deployment fails:

1. Stop promotion.
2. Preserve the previous healthy version.
3. Disable the affected capability if possible.
4. Keep user documents and runs safe.
5. Roll back application code or migration according to the tested procedure.
6. Record the incident internally.
7. Do not expose deployment details to students.

A provider outage should degrade the affected capability without taking down onboarding, saved missions, documents or already-completed results.

---

## 10. Definition of production-ready

Oppulse is ready for real app deployment only when:

1. Students see a product, not a development console.
2. Demo-only synthetic disclosure exists only in the Demo build.
3. Production and staging have no visible prototype or backend-connection labels.
4. The same polished layout works through the real backend contract.
5. Internal capability states are translated into product-safe language.
6. Error, partial, offline and recovery states preserve student work.
7. The no-CV path works end to end.
8. Documents, facts and date of birth have tested privacy controls.
9. Structured institution answers and the right-side opportunity panel work responsively.
10. Drafts are reviewable and never sent automatically.
11. Real provider failures do not create invented answers.
12. Logs and diagnostics do not leak personal data.
13. Deployment, migration and rollback are rehearsed.
14. A controlled student cohort confirms usefulness and understandable behavior.
15. The release checklist is signed off internally.

---

## Instruction to the coding agent

Treat this as a production transition, not a beginner prototype exercise.

Do not expose engineering implementation details in the student-facing application. Do not place API mode, product mode, mock/replay status, provider names, environment labels, route names or raw capability diagnostics in ordinary student screens. Keep those concerns in deployment configuration, internal telemetry, protected support tooling and documentation.

Do not solve a backend failure by adding a developer label to the UI. Translate failures into clear product states that preserve the student’s work and provide a useful next action.

Do not create a second layout for production. Stabilize one coherent student experience across development, staging and production, with environment-specific configuration behind the boundary.

Before requesting real student data or promoting to production, deliver:

- a student-facing UI audit proving no development labels remain outside the Demo build;
- a complete mode/feature-flag matrix;
- a frontend/backend contract report;
- a privacy and security release report;
- a deployment and rollback report;
- a controlled-cohort acceptance report;
- a list of known limitations written in internal documentation only.

Implementation order:

```text
Finish connection-critical UI and run behavior
→ remove development diagnostics from student UI
→ complete staging deployment preparation
→ synthetic staging verification
→ internal acceptance
→ controlled student cohort
→ production promotion
```

No Azure provisioning, real student-data import or production promotion should occur until the relevant approval gate is explicitly passed.
