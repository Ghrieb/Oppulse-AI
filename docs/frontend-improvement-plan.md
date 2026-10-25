# Oppulse AI — Frontend Improvement Plan

**Status:** Approved implementation plan for the next frontend iteration  
**Current baseline:** Phase A React/Vite prototype with MSW mock HTTP backend, typed Zod contract, route-level code splitting, accessibility gates, Playwright journeys and a real reviewable writing studio.  
**Goal:** Move from a credible dashboard prototype to a deployable, judge-ready experience that begins with the user's intention, adapts to their profile and guides them toward a concrete next action.

---

## 1. Current State Assessment

The current frontend is a strong foundation rather than a blank prototype.

### What is already working well

- React + Vite + TypeScript structure with strict type checking.
- Single HTTP client and validated Zod response contracts.
- MSW intercepts the same HTTP paths the future FastAPI backend will implement.
- Honest prototype banner and synthetic data disclosure.
- Typed error taxonomy, retry states and chaos-mode failure testing.
- Route-level code splitting, including lazy loading for the writing studio.
- Accessible component primitives, visible focus and 44 px interaction targets.
- Opportunity cards distinguish profile match, eligibility, funding, competition and confidence.
- Evidence-aware fixtures include unreachable sources, conflicting deadlines and unconfirmed facts.
- Writing studio supports autosave, local recovery, proposal diff, accept/reject and version history.
- Screenshots and Playwright journeys document the current product state.

### What needs to improve before real committee use

1. **The product entry point is authentication-first rather than intention-first.** The user should understand the promise and choose how Oppulse will help before being asked to complete a generic sign-up flow.
2. **There is no true first-run onboarding route in the current router.** The current home workspace assumes a prepared demo profile rather than progressively learning who the user is, what problem they have and what outcome they want.
3. **The agent is present, but the mission-building intelligence is not yet visible.** A button can send “Find opportunities suited to me,” but the user does not yet see the agent convert that intent into structured criteria and ask only the missing questions.
4. **The mock profile/document flow is useful but not yet a strategic “profile passport.”** Users need to understand which facts were extracted, which are confirmed, which are missing and how each fact affects applications.
5. **Opportunity presentation is credible but visually generic.** Country flags, institution identity, official logos/banner imagery and source quality should improve scanability without introducing fragile or expensive frontend dependencies.
6. **The home layout is information-rich but not sufficiently action-prioritized.** It should prominently identify one next best action, the current mission state and the user's blockers.
7. **There is no explicit distinction between chat-led users and workspace-led users.** Both should be supported through one shared state model.
8. **The prototype disclosure is correct but should evolve into a product capability status.** It should distinguish synthetic data, live backend connection, available providers and disabled integrations without undermining confidence.
9. **The real-world transition needs a frontend readiness contract.** The UI is close to backend-ready, but onboarding, upload, extraction, consent, run progress and resource fallback rules need to be fixed before Phase B.

---

## 2. Product Experience Direction

Oppulse AI should support two valid user styles:

### Mode A — “Talk to Oppulse”

The user starts with a goal in natural language:

> “I want a fully funded Master’s in Europe in data science, but I am not sure which countries accept my profile.”

Oppulse asks adaptive questions, creates a structured mission preview, confirms what it will use and then starts research.

### Mode B — “Work from my materials”

The user uploads a CV, transcript or certificate first. Oppulse extracts proposed facts, asks the user to confirm them and then recommends useful missions or application actions.

These are not separate products. They are two entry paths into the same profile, mission, evidence and application state.

### Guiding interaction loop

```text
Intent → Profile context → Clarifying questions → Mission preview
→ User confirmation → Research / application action → Evidence → Next best action
```

At all times, the interface should answer:

- What does Oppulse know about me?
- What is it using for this task?
- What is still uncertain?
- What has happened successfully?
- What should I do next?

---

## 3. Prioritized Delivery Plan

### Priority 0 — Make the first impression and core journey real

These changes should be implemented before adding more visual polish or more navigation.

| Workstream | Outcome | Main files/components |
|---|---|---|
| Public landing page | Visitor understands the problem, promise, evidence-first approach and next action without signing in first. | New `src/features/landing/LandingPage.tsx`; `router.tsx`; landing styles/components |
| Auth transition | Register/sign in returns the user to their intended onboarding or workspace step. | `features/auth`; auth schemas; route guards |
| Onboarding route | New users can choose a starting intention and answer adaptive questions. | New `features/onboarding/OnboardingPage.tsx`, `OnboardingStep.tsx`, `MissionPreview.tsx` |
| User mode choice | Offer “Talk to Oppulse” or “Upload my CV first” without forcing either path. | `OnboardingChoiceCard`, `AgentComposer`, `DocumentUploader` |
| Mission preview | Convert answers into editable structured criteria before any run begins. | New `MissionSummary`, `MissionEditPanel`, mission schema additions |
| First-run persistence | Save onboarding progress and resume after refresh. | `localStorage` draft first; Phase B server draft endpoint |
| Next-best-action home | Home shows one prioritized action based on missing confirmation, active run or application deadline. | `HomePage`, `SummaryPanels`, new `NextBestActionCard` |

**Acceptance condition:** A new user can visit the public page, understand Oppulse, register or use demo access, choose an intention, answer a short adaptive sequence, review a mission and arrive at a meaningful workspace state without silently using a pre-seeded profile.

### Priority 1 — Build the profile passport and document intelligence UX

| Workstream | Outcome |
|---|---|
| Profile passport | One understandable profile view containing education, experience, skills, languages, location/nationality attributes and preferences. |
| Fact provenance | Every extracted fact shows source document, page/section, extraction status and confirmation status. |
| Fact controls | Confirm, correct, not mine, exclude from AI use and undo. |
| Missing-information prompts | Explain which missing fact blocks which decision; do not ask for everything up front. |
| Document consent | Before a mission starts, show selected documents and a clear “Use these for this mission” control. |
| CV drop zone | Drag/drop and file picker with supported formats, size limits, upload progress and retry. |
| Extraction mock realism | MSW simulates processing states: uploaded, processing, needs review, ready, could not read, partial extraction. |
| Profile-to-action links | From a requirement such as English proficiency, link to the relevant document/fact correction action. |

**Acceptance condition:** A user can see how a CV fact became a profile fact, correct it, exclude it from AI context and observe which opportunity requirement becomes resolved or remains uncertain.

### Priority 2 — Improve opportunity trust and visual scanability

| Workstream | Outcome |
|---|---|
| Country identity | Add ISO country code, localized country name and accessible flag treatment to opportunities. |
| Institution identity | Add official-domain favicon/logo metadata with fallback initials and institution name. |
| Opportunity image treatment | Support an optional official banner/campus image only when it comes from an allowed official source and has a cached/proxied URL. |
| Source quality | Visually distinguish official, secondary and aggregator evidence with text labels, not color alone. |
| Resource fallback | Broken logo/image falls back to initials; no layout shift; no empty image box. |
| Deadline clarity | Show local date, timezone, verification state and conflict state in the same visual block. |
| Funding clarity | Use a componentized coverage breakdown: tuition, living, travel, accommodation, insurance, visa and unknowns. |
| Comparison mode | Make “Compare selected” functional with a focused side-by-side table and mobile stacked comparison. |
| Shareable analysis | Add route-level metadata and copy link action for opportunities, without exposing private profile details. |

**Acceptance condition:** A committee member can scan an opportunity card in under ten seconds and understand location, institution, deadline confidence, funding coverage, profile match and the most important unresolved issue.

### Priority 3 — Separate chat guidance from application execution without splitting the product

| Workstream | Outcome |
|---|---|
| Persistent context bar | Show the active mission/opportunity/application context near the composer. |
| Agent action chips | Suggestions such as “Check my eligibility,” “Find missing documents,” “Draft motivation letter,” “Compare funding” and “Create checklist.” |
| Structured response cards | Agent answers render as evidence cards, checklist cards, draft actions or run cards rather than only paragraphs. |
| Drafting entry points | From opportunity detail and application workspace, provide direct actions for motivation letter, supervisor email, recommendation request and research statement. |
| Selection-aware writing | Let users select text or a paragraph and ask the assistant to revise only that selection. |
| Professional workflow | Add time estimate, deadline priority, missing-document count and “next session” recovery for working applicants. |
| Approval boundaries | Clearly label actions that only prepare versus actions that would send/submit; future external actions require explicit confirmation. |

**Acceptance condition:** A chat-led user and a document-led user reach the same application workspace, with the assistant able to create a draft, checklist or research run from their current context.

### Priority 4 — Replace synthetic presentation with integration-ready presentation

| Workstream | Outcome |
|---|---|
| Capability status | Replace one generic prototype message with status for data mode, AI mode, search mode, document extraction mode and notifications. |
| Live/mock switch | Keep mock mode stable for demos; make the active mode clear in Settings and the banner. |
| API readiness | Keep Zod schemas and add backend contract test fixtures for onboarding, uploads, profile facts and mission runs. |
| Auth readiness | Ensure protected routes redirect correctly and return to the original route after sign-in. |
| Telemetry readiness | Track funnel events without document contents: landing CTA, onboarding completion, mission start, analysis open, draft created and alert reviewed. |
| Offline readiness | Preserve onboarding answers and writing drafts locally; show sync status and recovery. |

**Acceptance condition:** The frontend can switch from MSW to FastAPI through configuration without changing the user flow, while clearly identifying which capabilities are live, mocked or unavailable.

---

## 4. Proposed New First-Run Flow

### Step 1 — Public landing page

Headline:

> **Find the opportunities worth your time — and turn them into applications.**

Supporting copy:

> Oppulse AI reads programme calls, checks them against your confirmed profile, explains what is funded and helps you take the next step.

Primary actions:

- `Start with my goal`
- `Upload my CV`
- `Analyze an opportunity`

Secondary proof points:

- Evidence attached to important claims.
- Profile facts confirmed by the user.
- AI proposals reviewed before they change application documents.

Do not overclaim live AI, real-time monitoring or automatic acceptance while those capabilities are not connected.

### Step 2 — Choose how to begin

Three cards:

1. **Tell Oppulse what you need** — best for users who have a goal but no specific call.
2. **Upload my CV and documents** — best for users who want their profile organized first.
3. **I already found an opportunity** — paste a URL or upload an announcement.

The choice sets the first question but does not lock the user into a separate workflow.

### Step 3 — Adaptive questions

Ask one question per screen or message, and skip questions already answered by confirmed profile facts.

Suggested sequence:

1. “What are you hoping to achieve?”
2. “Which type of opportunity are you considering?”
3. “What field or research area should I prioritize?”
4. “Where could you realistically study or work?”
5. “What does funding need to cover for you?”
6. “When would you like to start?”
7. “Should I use your confirmed documents?”

Each answer updates a visible mission summary. Optional questions are skippable.

### Step 4 — Mission preview

Show a plain-language summary:

> “I will search for fully funded Master’s programmes and research internships in data science and computational biology, prioritizing Europe, starting in 2027, using your confirmed CV and English certificate.”

Show editable chips for every criterion. Show source scope and limitations. The user must explicitly choose `Run research`.

### Step 5 — Research and result transition

On run start:

- show actual phases;
- explain what documents are being used;
- show source count as sources are retrieved;
- show inaccessible sources honestly;
- let the user leave and return; and
- present the first next-best action when complete.

---

## 5. Profile and CV UX Specification

### 5.1 Profile passport layout

Use a two-column desktop layout:

- **Left:** profile completeness and sections.
- **Right:** selected fact details, evidence and action.

Sections:

- About me
- Education
- Experience and research
- Skills
- Languages and certificates
- Destinations and funding
- Documents and consent
- Review history

### 5.2 Fact card anatomy

Each fact card includes:

- fact label;
- value;
- state: Proposed, Confirmed, Corrected, Excluded or Conflicting;
- source document and page/section;
- “Used for” explanation;
- Confirm, Correct, Not mine and Exclude actions;
- last updated timestamp.

Use plain language. Example:

> **English proficiency — IELTS 6.5**  
> Proposed from `IELTS_2025.pdf`, page 1. Used to assess language requirements. Confirm this before it affects eligibility.

### 5.3 Extraction states

- `Uploading`: progress and cancel.
- `Processing`: “Reading the text in your document.”
- `Needs review`: facts proposed but not trusted.
- `Ready`: no unresolved extraction issue.
- `Partial`: some sections could not be read; show exactly which.
- `Could not read`: explain format/OCR limitation and alternatives.
- `Deleted`: remove it from selection and explain dependent fact behavior.

### 5.4 Privacy and consent copy

The interface must say which documents are included in a mission. Do not use “Use all documents” as the default. Provide:

- select documents;
- exclude sensitive document;
- process locally/server-side disclosure when applicable;
- delete document; and
- remove extracted fact from future AI context.

---

## 6. Resource Strategy: Flags, Logos, Banners and Efficiency

### 6.1 Country flags

Use a small, deterministic country identity layer:

```ts
type CountryIdentity = {
  iso2: string;
  name: string;
  flagAsset?: string;
  region?: string;
};
```

Recommended frontend approach:

- Store ISO-2 country codes in the API contract, not rendered flag emojis.
- Use a lightweight local flag asset set or CSS/SVG sprite for the countries actually present in the result set.
- Render a text country name beside the flag for accessibility and cases where color/imagery is unavailable.
- Use `aria-label="Netherlands"` and `aria-hidden="true"` for decorative flag image content.
- Avoid shipping a large global image catalog before there is a need for it.

### 6.2 University and institution logos

Do not let the browser independently fetch arbitrary logos from third-party URLs. This creates privacy, reliability, mixed-content, CORS and layout-shift problems.

Use this resource contract:

```ts
type InstitutionBrand = {
  institutionName: string;
  officialDomain: string;
  logoUrl?: string;
  bannerUrl?: string;
  attribution?: string;
  verifiedAt?: string;
  source: 'official' | 'provider' | 'fallback';
};
```

Phase A mock:

- Use synthetic but clearly labelled demo assets or neutral initials.
- Keep `logoUrl` optional and test missing/broken states.

Phase B backend:

1. Fetch brand metadata server-side only from the official domain or an approved provider.
2. Validate host/domain association.
3. Cache and resize assets into a controlled CDN/storage path.
4. Return a stable URL to the frontend.
5. Store retrieval timestamp and source.
6. Fall back to institution initials if the asset fails.

Do not use university imagery as evidence of programme quality. The banner is visual context only; official source links and evidence remain authoritative.

### 6.3 Official campus/programme banners

Use banners only on deep opportunity analysis, not every card. A good banner improves recognition; too many increase payload and visual noise.

Rules:

- Lazy-load below-the-fold imagery.
- Reserve the image ratio to avoid layout shift.
- Use `loading="lazy"` and responsive sizes.
- Provide descriptive alt text only when the image conveys useful information; otherwise use an empty alt attribute.
- If the source is not official or attribution is unclear, use a neutral visual instead.
- Never block the opportunity analysis if an image fails.

### 6.4 Resource budget

Target:

- no more than one logo request and one banner request per visible detail page;
- no remote image requests for list cards unless the asset is cached;
- compressed WebP/AVIF where supported;
- image dimensions and placeholders reserved before load;
- fallback initials rendered immediately;
- lazy loading for all non-critical imagery.

---

## 7. Home Workspace Improvements

The current home has a good three-column structure, but the center of gravity should change from “show many things” to “help me act.”

### Recommended top order

1. **Active mission strip** — mission name, state, last run, next scheduled check.
2. **Next best action card** — one recommendation tied to a real blocker.
3. **Agent workspace** — chat/composer and current run status.
4. **Opportunity results** — selected result and ranking.
5. **Deadlines and alerts** — only those requiring action.

### Next best action examples

- “Confirm your IELTS score to resolve one eligibility requirement.”
- “Review the deadline conflict before saving Verdant.”
- “Finish the motivation-letter opening paragraph.”
- “Upload the transcript needed for the Atlas application.”
- “Research run paused because one source was unavailable.”

The action card must link to the relevant route and explain why it matters.

---

## 8. Mock Data Improvements Before Real Integrations

The prototype can become much more useful without pretending to be live.

### Add to fixtures

- Country ISO code and region.
- Institution brand metadata with intentional missing/broken asset cases.
- Programme duration and start period.
- Application opening date and multiple stage deadlines.
- Funding components with confirmed/not covered/unknown states.
- User profile facts with provenance and confirmation state.
- Mission draft and adaptive question history.
- Run events for upload, extraction, source retrieval, conflict and partial completion.
- Draft types: motivation letter, supervisor email and recommender request.
- User persona variants: student, researcher and professional.

### Add to MSW handlers

- onboarding draft save/resume;
- profile fact confirm/correct/exclude;
- document upload/process simulation;
- mission preview and explicit run creation;
- comparison selection;
- institution asset fallback;
- notification read/snooze/retry;
- route-level conflict response;
- offline mutation recovery.

### Demo persona selector

Add a development-only demo selector, not visible to judges by default:

- “Student with incomplete CV”
- “Researcher with strong profile”
- “Professional changing fields”
- “User with a deadline conflict”

This makes the interface testable against different perspectives without hardcoding one student story into every screen.

---

## 9. Implementation Architecture Changes

### 9.1 New routes

```text
/                         Public landing page
/auth/sign-in              Sign in
/auth/sign-up              Register
/onboarding                Adaptive first-run flow
/onboarding/resume         Resume incomplete onboarding
/home                      Workspace
/profile                   Profile passport
/documents                 Document library
```

Existing opportunity, application, writing, monitoring, assistant and settings routes remain.

### 9.2 New schema groups

Add to `src/lib/schemas/`:

- `onboarding.ts`
- `profile-facts.ts`
- `documents.ts` if not already present in the full contract
- `brands.ts`
- `resources.ts`
- `next-action.ts`

Use stable IDs for fact provenance and mission drafts. Do not put extracted facts only into a free-form object that cannot be cited later.

### 9.3 New component groups

```text
src/components/onboarding/
  onboarding-shell.tsx
  intent-card.tsx
  question-step.tsx
  mission-preview.tsx
  adaptive-progress.tsx

src/components/profile/
  profile-passport.tsx
  fact-card.tsx
  fact-provenance.tsx
  profile-completeness.tsx

src/components/resources/
  country-identity.tsx
  institution-logo.tsx
  opportunity-banner.tsx
  resource-fallback.tsx

src/components/actions/
  next-best-action.tsx
  capability-status.tsx
  context-strip.tsx
```

### 9.4 Frontend state rules

- Server-backed onboarding drafts use TanStack Query once the backend exists.
- Local draft persistence is a temporary resilience layer, not the system of record.
- Mission preview is derived from structured answers and can be edited before run creation.
- Profile fact mutations must invalidate opportunity match queries because eligibility results depend on confirmed facts.
- Asset failures must not invalidate opportunity data.
- Every mutation needs success, rollback, retry and refresh behavior.

---

## 10. Testing and Acceptance Plan

### New unit/component tests

- Landing CTA routes correctly.
- Onboarding skips questions answered by confirmed profile facts.
- Mission preview reflects answer changes.
- Refresh resumes onboarding draft.
- Fact confirmation changes the fact state and invalidates matching data.
- Document processing states render correctly.
- Country flag has accessible text fallback.
- Institution logo falls back to initials on error.
- Banner failure does not break opportunity detail.
- Next-best-action links to the correct blocker.
- Agent response cards render action buttons with correct context.
- Comparison mode works with two or more selected opportunities.
- Capability status distinguishes mocked and live services.

### New browser journeys

1. Landing → sign up → onboarding → mission preview → mock research run.
2. Upload CV → processing state → confirm fact → open matching opportunity.
3. Paste opportunity URL → analysis state → source failure recovery.
4. Chat assistant → create application → draft motivation letter → review diff.
5. Mobile onboarding → profile confirmation → mobile opportunity detail.
6. Offline during onboarding → recover → continue without losing answers.

### Accessibility gates

- axe scan for landing, onboarding, profile passport and opportunity detail.
- Keyboard-only onboarding completion.
- Focus restoration after upload dialog, source drawer and AI proposal dialog.
- Screen-reader announcement for extraction status and run completion.
- 200% zoom check for mission preview and writing studio.

### Visual regression gates

Generate screenshots for:

- landing desktop/mobile;
- onboarding intent and mission preview;
- profile passport with proposed and confirmed facts;
- opportunity card with logo, fallback and conflict states;
- deep analysis with official banner and broken-banner fallback;
- writing studio with proposal diff;
- home with next-best-action card;
- mobile application workspace.

---

## 11. Suggested Implementation Order

### Sprint 1 — Intent-first entry

- Add public landing page.
- Add onboarding route and route guard.
- Add three starting paths.
- Add adaptive question state and mission preview.
- Persist onboarding draft locally.
- Add Playwright journey.

### Sprint 2 — Profile passport

- Add profile route.
- Add fact provenance and confirmation controls.
- Connect document processing fixture states.
- Add profile completeness and blocker links.
- Invalidate opportunity matches on fact mutation.

### Sprint 3 — Resource enrichment and action hierarchy

- Add country identities and accessible flag component.
- Add institution identity component with fallback.
- Add opportunity banners only on detail pages.
- Add next-best-action card and capability status.
- Improve mobile detail and application views.

### Sprint 4 — Chat and drafting cohesion

- Add persistent context strip.
- Add structured agent action cards.
- Add draft entry points from opportunity/application routes.
- Add supervisor email and recommender request draft types.
- Add professional/time-aware application planning.

### Sprint 5 — Backend handoff readiness

- Freeze frontend schemas for onboarding, profile, documents and missions.
- Add OpenAPI/Zod contract comparison.
- Replace MSW handlers one endpoint at a time.
- Verify authentication redirect and private resource behavior.
- Keep demo mode available as a controlled fallback.

---

## 12. Definition of Done

The next frontend iteration is complete when:

- A visitor can understand Oppulse without signing in.
- A new user can choose between chat-led, CV-led and opportunity-led entry.
- Onboarding asks only useful questions and produces an editable mission.
- CV facts are visibly proposed, sourced and confirmable.
- A confirmed fact can resolve or leave an opportunity requirement uncertain.
- Every opportunity supports accessible country identity and resilient institution identity.
- Images are cached/lazy/fallback-safe and never block the primary experience.
- Home identifies one next best action.
- Chat responses can launch real UI actions and not only show text.
- Drafting supports motivation letters, emails and recommendation-request materials without impersonation.
- All mocked capabilities are clearly labelled; no synthetic fact appears to be live evidence.
- The new flows work on mobile, with keyboard access and recovery states.
- The full journey is covered by automated tests and can be demonstrated in under three minutes.

---

## Final Recommendation

Do not respond to the current limitations by adding more dashboard modules. The highest-value improvement is to make Oppulse AI understand the user before it shows the user everything.

Build the next version around this sequence:

> **Landing page → choose how to begin → adaptive onboarding → profile passport → editable mission preview → evidence-backed result → next best action → application workspace.**

Then enrich the visuals with lightweight, reliable country and institution identity resources, while keeping official evidence—not logos or banners—as the source of truth.

This approach serves both students who want Oppulse to guide them conversationally and experienced applicants who want to upload a CV and move quickly. It also gives the future backend a clear contract: confirmed profile facts, explicit consent, structured missions, durable runs and application actions that are ready to replace mock behavior one endpoint at a time.
