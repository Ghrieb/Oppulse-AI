# Architecture — Phase A (frontend)

Decisions taken during the frontend phase, and the reasoning. Later phases build on these
rather than re-litigating them.

---

## ADR-A1: One HTTP client, one contract, MSW at the network layer

**Decision.** Every network call goes through `src/lib/api/client.ts`. The contract is a set of
Zod schemas in `src/lib/schemas/`. In prototype mode, MSW intercepts requests at the service
worker and answers them from fixtures.

**Alternatives rejected.**

| Option | Why not |
|---|---|
| A hand-written mock client beside the real one | Two implementations of one contract. They drift, and the mock stops representing the real API. |
| Fetching from a JSON fixture file in components | Bypasses the client, so error handling, validation and caching are never exercised. |
| A real fake backend (json-server, MSW's node server in the browser) | More moving parts than MSW, and it does not intercept the app's own `fetch`. |

**Consequences.** The frontend is written against real HTTP semantics from day one: status codes,
headers, JSON bodies, network failures, 204s. Connecting the backend is a configuration change,
not a rewrite. The cost is that fixtures must satisfy the contract — which is the point.

---

## ADR-A2: Validate responses, not just requests

**Decision.** Every response is parsed through its Zod schema inside `client.ts`. A mismatch
raises a `CONTRACT_MISMATCH` error naming the offending field.

**Why.** A renamed or retyped field would otherwise render as `undefined` three components deep,
producing a plausible-looking screen that is quietly wrong. For a product whose whole claim is
"every claim is backed by evidence", silently-wrong rendering is the worst possible failure.
Validating at the boundary converts it into a loud, attributable error.

**Consequences.** The backend cannot drift from the frontend without failing. Phase B adds a CI
check comparing FastAPI's OpenAPI document against `z.toJSONSchema()` output.

---

## ADR-A3: A stable error taxonomy, not message strings

**Decision.** `lib/api/errors.ts` defines ten codes: `NETWORK`, `TIMEOUT`, `CANCELLED`,
`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `RATE_LIMITED`,
`PROVIDER_UNAVAILABLE`, `CONTRACT_MISMATCH`, `UNKNOWN`. The UI branches on the code.

**Why.** Copy can change without breaking behaviour, and each code has a genuinely different
recovery: a rate limit is retried automatically, a 404 shows "not found", a 403 shows a
permission state, a network failure says "your work is saved locally". Mapping by status alone
would conflate them.

**Consequences.** Error states can be written once and reused. The backend uses the same codes in
its error envelope: `{ "error": { "code", "message", "request_id" } }`.

---

## ADR-A4: Chaos mode, so the failure UI is verified rather than written

**Decision.** `mocks/chaos.ts` can force a 500, a slow response or an empty result on any
endpoint at runtime, from a dev console or a dev menu.

**Why.** "Calm under failure" is a requirement in the specification, and it is the easiest
requirement to claim and the hardest to prove. A failure state that has never been executed is a
screenshot, not a feature. Chaos mode means the error paths are exercised by tests and can be
demonstrated on demand.

---

## ADR-A5: The design system is the specification's palette, verbatim

**Decision.** `styles/tokens.css` reproduces the colour, type, radius and spacing tokens from
the UX specification §4.2–4.4 as Tailwind v4 `@theme` variables. Components reference semantic
token names.

**Why.** The specification is explicit that the palette, type scale and radii are fixed. Making
them CSS variables rather than Tailwind's defaults means the two cannot drift, and the
generated utilities (`bg-sidebar`, `text-text-muted`, `bg-success-surface`) read like the
specification.

**Consequences.** Every interactive control is at least 44px tall, which is enforced by the
button variants rather than left to each component. Colour is never the only status signal:
badges pair hue with a text label, and the fit score spells out what the number means.

---

## ADR-A6: The agent is an orchestrated tool caller, not a chatbot

**Decision.** The conversation is the control surface, but structured results stay in panels
beside it. Run progress is a timeline of **factual events** — what was retrieved, what failed,
what was extracted — never invented internal reasoning.

**Why.** A student needs to act on findings, not read a transcript. And a timeline of
"Retrieved source: helios-fellowship.org" is verifiable; a paragraph claiming the agent
"thought carefully" is not. The spec is unambiguous on this point.

---

## ADR-A7: AI proposes; the student applies

**Decision.** The writing studio returns a proposal, renders a word-level diff, and only writes
to the document when the student accepts. Acceptance creates a new version; the previous version
stays recoverable. Proposals can carry "unsupported claims" that are surfaced before acceptance.

**Why.** Application documents are consequential. A model that silently rewrites a motivation
letter can fabricate an achievement and cost the student an admission. The diff also makes the
model's contribution reviewable, which is what the spec's ADR-006 requires.

**Consequences.** The diff view is a real LCS word diff, not a highlight. The autosave keeps a
local copy when a save fails, and the interface says "Changes not saved" with a copy button
rather than discarding work.

---

## ADR-A8: Route-level code splitting, home page eager

**Decision.** The home workspace loads eagerly; every other route is lazy.

**Why.** The home workspace is the first thing a judge sees, so it must not flash a spinner.
Everything else is code-split, and the heavy writing studio (rich-text editor) is only fetched
when it is opened.

**Consequences.** The initial bundle dropped from 759 kB to 423 kB (225 kB → 130 kB gzipped)
with no change to the component code.

---

## ADR-A9: The entry point is intention-first, not authentication-first

**Decision.** `/` is a public landing page. Registration happens when the visitor has understood
the product and chosen a starting path. Three entry paths — *tell Oppulse what you need*, *upload
my CV*, *I already found an opportunity* — set the first question, not a separate workflow.

**Why.** A student who arrives from a search engine has a question, not a password. Asking for an
account before showing any value is the single highest drop-off point in a tool like this, and it
hides the product's actual differentiator: that the agent reasons from a confirmed profile.

**Consequences.** The landing page must not overclaim. It carries a capability strip stating, per
service, whether it is live, simulated or unavailable. The demo path runs the *real* onboarding
rather than a shortcut, so a reviewer sees the agent learning the user.

---

## ADR-A10: The mission is derived, never authored

**Decision.** The mission the user reviews is computed from their answers by
`lib/onboarding/engine.ts`. The user can edit any criterion, and the preview updates. They never
type a mission.

**Why.** Asking a student to write a structured search specification is asking them to do the
agent's job. Deriving it means the mission is always consistent with the answers, and the user
sees a plain-language sentence rather than a form.

**Consequences.** Each question declares which profile fact could answer it. A confirmed fact
makes the question *skipped* and shown as pre-filled with a note saying where the value came from —
the adaptivity is visible, not implied. Answers are stored with a stable question id, so they can
be cited later.

---

## ADR-A11: The mock backend persists its state

**Decision.** The MSW mock keeps the session, the onboarding draft and any in-flight run in
`localStorage` (`src/mocks/store.ts`), not in a module-level object.

**Why.** MSW's browser handlers run in the page context, so an in-memory object is lost on every
reload. That means a signed-in user is signed out by a refresh and a running research run
disappears — both of which the specification explicitly requires not to happen, and both of which
would break the demo in front of a committee.

**Consequences.** The mock behaves like a server from the application's point of view. The
frontend keeps its own `localStorage` copy of the onboarding draft as a resilience layer, so the
answers survive even a failed server write.

---

## ADR-A12: One route tree, with a pathless layout for the application

**Decision.** The router has a single root. `/` is the landing page; the application routes live
under a **pathless** layout route that renders the `AppShell`.

**Why.** Two sibling routes with `path: '/'` collide, and React Router silently gives the
application branch precedence — the landing page becomes unreachable. A pathless layout route
keeps `/` free without changing any application URL.

**Consequences.** `RequireAuth` wraps the protected routes. A signed-out visitor is redirected to
`/auth/sign-in?next=…` and returned to the intended destination afterwards, so a link to a
specific opportunity survives the sign-in detour.

---

## ADR-A13: Visual identity is generated, not fetched or stored

**Decision.** Every institution's identity is derived from its official domain by a pure function
(`lib/brand.ts`): a hash seeds a curated two-colour palette and the geometry, and the
initials sit in a seal. The campus visual is a deterministic abstract skyline from the same
seed. A real logo is only ever used when the backend has validated one.

**Why.** The constraint is zero persistent storage — no blob, no disk, no database row for
assets. The obvious alternatives were all measured, not assumed:

| Path | Measured result |
|---|---|
| `icons.duckduckgo.com/ip3/{domain}.ico` | 200, 3.2 kB, `max-age=2592000` — works, but **404s for every synthetic institution** |
| `google.com/s2/favicons?domain=…&sz=128` | 200, 773 B, `max-age=604800` — same 404 behaviour |
| `upload.wikimedia.org` | **no `Access-Control-Allow-Origin`** — unusable from the browser |
| `commons.wikimedia.org/w/api.php` | 200 but **no CORS header** — unusable client-side |
| `logo.clearbit.com` | **DNS does not resolve** — the service is dead |

Beyond storage, a generated identity is *better* than a fetched one for a prototype whose
institutions are synthetic: a real campus photograph beside "Helios Institute" would be a
false statement, and this product exists to avoid false statements.

**Consequences.**
- The same domain always produces the same identity, on every device, forever.
- Zero bytes, zero requests, works offline, and no layout shift.
- The generated mark is the product's *default*, not an apology for a missing image.
- `institutionBrand` carries `generated` and `iconSource`, so the interface can be honest
  about which it is showing, and the backend can drop in a real asset later with **no
  frontend change**.
- A caching icon service is enabled per brand, and only for a brand the backend has
  verified as a real institution. Synthetic institutions never trigger a third-party
  request.

---

## ADR-A14: The workspace leads with one action, not with everything

**Decision.** The home screen is ordered: active mission → next best action → agent →
results → alerts. The next action is *derived* by a pure function
(`lib/next-action.ts`) shared by the mock, the client and the backend.

**Why.** A workspace that shows everything equally is a dashboard, not a workspace. The
student's question is never "what does Oppulse know?" but "what should I do now?". One
prioritised action, tied to a real blocker, with the reason it matters, answers it.

**The derivation is structural, not textual.** A fact blocks when a *requirement* that
depends on it (`requirement.profileFactKey`) is unresolved — never because a warning
sentence happened to contain the fact's name. Matching on prose would break the moment the
copy changed, and it would silently point at the wrong blocker.

**Consequences.** The ladder is: unconfirmed fact blocking a requirement → deadline
conflict → unreachable source → missing document → unreviewed draft proposal → application
ready for review → unread alert. Confirming a fact invalidates the action, so the
interface immediately shows the next thing.

---

## ADR-A15: Derived identifiers are deterministic UUIDs

**Decision.** Derived records — a next action, a transient marker — get a UUID derived
from a stable seed (`lib/ids.ts`), not a random one and not a readable string.

**Why.** The contract declares `id` as a UUID, and a readable string like
`confirm-fact-a1000…` is not one. Deriving the UUID keeps the id stable across a
refetch, which keeps React keys and test handles stable, and lets the mock, the client
and the backend agree on the identifier for the same logical thing.

---

## ADR-A16: Eligibility is decided by a check, not by prose

**Decision.** A requirement that depends on a profile fact carries an explicit `check`:
`at_least` (a numeric threshold), `in_list` (a set of codes), or `present`. The engine in
`lib/matching.ts` evaluates it against the *normalised* fact value and produces a status and a
specific reason. A requirement with no check keeps the status the agent recorded, because it
depends on something a profile cannot answer — whether the student needs a visa sponsor, whether
a university has published an annex.

**Why.** The obvious alternative is to read the agent's warning text and look for a fact's name
in it. That breaks the moment the copy changes, and it silently points at the wrong blocker. A
check is data, so it cannot drift.

**Consequences.**
- Facts carry a machine-comparable `numericValue` (`6.5` for IELTS) and a normalised `code`
  (`DZ` for Algeria) alongside the human-readable `value`. A rule never parses prose.
- A requirement also declares whether it is `blocking`. A blocking requirement that is
  unresolved downgrades eligibility to *unresolved*; a non-blocking one only raises a warning.
  This is why the fit score can be 92 while eligibility is still honestly "unresolved".
- Confirming a fact re-evaluates every opportunity and every assessment, so a card can never
  claim "eligible" while a requirement is still open.
- The rule set lives in one pure module that the mock, the client and (later) the backend all
  use, so there is one answer rather than three drifting copies.

---

## ADR-A17: The profile is a passport, not a form

**Decision.** The passport is the single surface for "what does Oppulse know about me". It shows
completeness, facts grouped into sections, the provenance of every extracted value, what each
fact is used for, what it is holding up, and the controls to confirm, correct, exclude or undo.
`/documents` and the passport's documents section render the same component.

**Why.** A student asking "what does this tool know about me?" should get one page, not a
profile form plus a documents list plus a settings page. Splitting the answer across three
places is how tools lose trust.

**Consequences.**
- Completeness counts what the agent can *use*, not what has been typed: an unconfirmed fact
  does not count, because it is not eligible for a decision.
- The "Blocks" list turns a confirmation from a chore into a decision with a visible
  consequence — the point of the whole sprint.
- The next best action and the opportunity requirement both deep-link to the fact that
  unblocks them, so the loop closes from both ends.
- One navigation is rendered at a time (a media query, not two copies), so there is exactly one
  navigation landmark and no duplicated controls for assistive technology.

---

## ADR-A18: One agent, one thread, one working context

**Decision.** The assistant is a single provider (`src/app/agent-provider.tsx`) that owns both the
conversation and the *working context* — the mission, opportunity, application or draft the agent
is currently working on. The home panel and `/assistant` render the same thread; the context
strip states what is in scope, and every surface can change it. The assistant answers with
**blocks** (text, evidence, checklist, document, run, action) rather than a paragraph, and every
action that changes something is confirmed by the student first.

**Why.** Three separate chat widgets, each with its own memory, is what "AI assistant" usually
means — and it is why such products feel like a set of tools rather than an agent. A student who
asks a question on the dashboard and opens the assistant later must find the same conversation,
or the agent is not an agent. The context matters for the same reason: an assistant that answers
"what is the funding?" without knowing *which* opportunity is asking a question the student
already answered.

**Consequences.**
- The context is a bounded set of identifiers, never free-form instructions: the client can ask
  for a mission, an opportunity, an application, a draft, or a set of authorised document ids,
  and the backend decides what is actually permitted.
- The context and the thread are mirrored to `localStorage`, and the same endpoints
  (`GET /assistant/history`, `POST /assistant/messages`, `POST /assistant/actions`) already exist
  on the server, so Phase B changes which copy is the source of truth — not the interface.
- Every action carries an `effect`: `prepares` or `would_send`. The interface labels both, and
  nothing that would leave the device is reachable without a confirmation step.
- The suggestions are derived from the context by a pure function (`lib/action-chips.ts`), so the
  client and the backend can offer the same options.
- Selecting text in the writing studio scopes the revision to that selection: the proposal
  rewrites the selected range and nothing else, which is what makes it safe to accept.

### ADR-A19: A confirmation is only worth showing if it changes the conclusion

**Decision.** The mock backend persists the *mutable* state — the profile, the recomputed
opportunities and matches, applications, drafts, documents, alerts and the session — and restores
it on load. The impact endpoint reports only requirements that are still `unresolved`, so a
requirement the confirmed fact has settled disappears from "Holding up N requirements" and the
fact shows "Every requirement that depends on this is settled."

**Why.** Two failures make a confirmation feel like a chore. First, if the confirmation is lost on
a refresh, the student is asked to do it again. Second, if a settled requirement keeps appearing
as blocking, the student is told they are blocked by something they have already resolved. Both
were real: the mock's state was in memory, and the impact list reported every requirement that
referenced a fact rather than every requirement that was actually waiting on it.

**Consequences.** The mock now behaves like a server from the application's point of view, which
is what its own store contract promised. The impact list is derived from the requirement status,
so it cannot drift from the eligibility state the student is shown on the opportunity page.

---

## ADR-A20: The backend owns authentication; Supabase is the database

**Decision.** The FastAPI service owns the session: argon2id password hashing, a short-lived access
JWT and a rotating single-use refresh token stored hashed, with the refresh token in an
`HttpOnly; Secure; SameSite=Lax` cookie and the access token held in memory only. Supabase is
Postgres and private Storage. **Supabase Auth is not used.**

**Why.** The Phase B brief's §4.1 requires that *"the backend must expose authenticated user/session
state"* — it constrains the interface, not the identity provider. Supabase Auth appears in the §3
diagram, but a diagram is not a requirement, and four other clauses decide the question:

1. The frontend is already built for this. `lib/api/client.ts` has a `TokenProvider` seam whose
   comment reads *"Phase B wires this to the auth store; today it is a no-op"*, and the client
   already sends `Authorization: Bearer`. The auth surface is four endpoints under `/api/v1/auth`,
   over the single `apiClient`. FastAPI-owned auth is a 1:1 replacement of the contract that exists.
2. It preserves ADR-A1. Supabase Auth would add `supabase-js` to the bundle, a second token store, a
   second refresh path, and auth logic outside the Zod-validated boundary.
3. The brief's §2A requires an **offline-replay stage with no network calls**, and the product
   requires a working mock. A hosted auth provider is a network dependency the mock cannot fake
   without reimplementing its semantics — so either the demo breaks or auth gets a second,
   divergent mock.
4. §7's requirement is *app-level*: "tenant/user ownership checks on every profile, document,
   mission, run, draft and alert". A service-role key bypasses RLS regardless of the auth provider,
   so RLS was never the primary control.

**What Supabase Auth would have given us, and how the backend provides it instead:** password
hashing, session management, email verification, password reset and MFA. So the backend implements
all of them, to the same bar — argon2id per RFC 9106 and the OWASP baseline (m=64 MiB, t=3, p=4),
rotating refresh tokens with reuse detection that revokes the token family, uniform errors with no
user enumeration, per-route rate limiting, and email verification and password reset through the
email adapter (which the notification contract already requires).

**Consequences.** `emailVerified` and `emailVerifiedAt` are **account state**: proven by the
backend, never set by the client, and the reason no email is sent to an unverified address. The
audit log records every ownership check, consent change, fact confirmation, proposal acceptance and
external-action approval, so §7 is testable rather than aspirational.

---

## ADR-A21: The mock is the offline-replay mode, not a thing to delete

**Decision.** MSW stays. It is the prototype's dev mode, its failure-demo mode, and — in Phase B —
the *offline replay* stage of the AI evaluation harness.

**Why.** The brief's §2A names three provider stages, and the first is *"Offline replay: fake
provider responses from fixtures; no network calls and no secrets."* Deleting the mock would
delete that stage. It would also delete the chaos mode, which is how the failure and recovery states
are demonstrated rather than described, and the honest prototype banner, which is what stops a
judge from mistaking a prototype for a working system.

**Consequences.** A third environment exists beside local and production: the replay mode, where the
whole agent loop runs against recorded provider responses with no network and no keys. The
capability strip is per service, so a capability flips from `mocked` to `live` only when the
provider checks for *that* service have passed — a successful API connection alone never flips
anything.

---

## ADR-A22: The notification contract is frozen, and only in-app is active

**Decision.** The first MVP delivers **in-app alerts only**. The runtime channel schema is
`in_app`; `email` and `mobile_push` are declared as *future* channels in
`FUTURE_NOTIFICATION_CHANNELS` and are deliberately **absent from the schema the client parses**.

**Why.** Two different things are easy to confuse. A *contract* can describe a channel the product
does not deliver on yet, and the backend needs that contract to be ready. But an *interface* that
offers a cadence selector for a channel with no provider is advertising a capability that does not
exist — and a schema existing is not a capability. So the contract is frozen, the runtime schema
is honest, and the interface says "in-app only, for now".

**The three-way distinction, frozen for the day email arrives.** Consent, preference and
verification are different things, and collapsing them produces the two failures that make a
notification system untrustworthy: a single boolean cannot express "immediate for funding
changes, weekly for everything else", and it cannot express "you have not agreed to email me, but
you did not turn it off either" — so the interface either nags about a setting that is working, or
sends mail the student never agreed to receive.

| | Question it answers | Where it lives |
|---|---|---|
| **Verification** | "Is this address yours?" | `sessionUserSchema.emailVerified` — account state, proven by the backend |
| **Consent** | "May Oppulse send email notifications?" | `profileConsentSchema.emailNotifications` — permission, revocable |
| **Preference** | "Which emails, and how often?" | `profilePreferencesSchema.email` — a cadence per alert category |

**Consequences.**
- A delivery record says *where* (`channel`), *what happened* (`status`) and *why* (`error`) — three
  separate fields, because they change for different reasons.
- `suppressed` is a distinct state from `not_configured`: "you turned this off" is a working
  setting, not a fault, and the interface must not invite the student to fix it.
- A **sensitive** alert — one whose body would carry profile-, document- or application-derived
  personal data — is never delivered *with its content*, even to a verified address. The message is
  a pointer back into the product. The delivery audit stores the channel, the category, the status,
  the error code and the idempotency key, never the message.
- A delivery failure is a **delivery** failure. The in-app alert is never removed, hidden or made
  conditional on another channel's outcome.
- The rule that decides this — consent, then the student's own choice, then verification — is
  frozen and unit-tested in `lib/notifications.ts` even though the interface does not yet expose
  email, so the backend implements the same decision for the same reasons.
- When email arrives, one change turns it on: the channel enum grows, the capability flips, and the
  settings card grows its controls. That is why the enum is a single place.

---

## ADR-A23: A date of birth is protected data, and age is calculated by a typed service

**Decision.** The date of birth is not a fact. It lives in a separate protected section of the
profile, behind its own endpoint, and the age arithmetic is a pure function
(`matching.ts: ageOn`, `evaluateAgeRule`, `evaluateAgeRequirement`).

**Why.** Facts are sent to the model; the date of birth must never be. Three rules follow from
that, and each of them is enforced rather than documented:

- A routine profile read never returns the date, so it cannot leak into a list view, a log or a
  prompt. It is a separate endpoint for that reason.
- The model may *extract* an age rule — with its source passage, the date the age is measured on,
  the operator and the boundary — but a typed service performs the calculation. The age is measured
  on the eligibility date the source states, not on today, and a birthday that has not happened yet
  is not counted.
- The answer is an **outcome** — "appears satisfied", "unresolved", "official cutoff needs
  verification" — and never the date. That is what lets the answer travel without the data.

**Consequences.**
- The question is asked only when there is a reason: an age limit can only appear on an
  internship, a fellowship, a summer school or a research programme, so the date is not requested
  for a scholarship. It is never inferred from nationality, education level, graduation year or a
  CV.
- "Prefer not to say" produces an **unresolved requirement and a next action**, never a rejection.
  A missing answer is not evidence of ineligibility.
- Two sources that state different age rules produce a **preserved conflict** and a question to the
  student, never a silently chosen value.
- The student can change, remove or exclude the date at any time, and excluding it re-opens every
  age requirement it was closing.

---

## ADR-A24: A destination is a country, and the mission stores the code

**Decision.** The onboarding asks for **countries**, not regions, and the mission stores the
ISO‑3166 codes in `criteria.destinationCountries`. The coarse regions are derived from them.

**Why.** Students do not think in "Europe" — they think in "the Netherlands" or "Canada". A region
is an average of countries, and a mission built on an average cannot be ranked against a specific
call. It is also not the criterion the agent can act on: the brief is explicit that the country
codes, not a rendered flag, are what the mission carries.

**Consequences.**
- The picker is a searchable list of countries with an inline SVG flag and the country's **name as
  real text** beside it. A flag is a visual aid, never the data and never evidence of
  eligibility; a country the interface cannot draw falls back to its ISO code.
- "Global" is a path, not a country, and the interface says so.
- The mission keeps both: `destinationCountries` is the criterion the agent filters and ranks by,
  and `destinations` is the region scope it searches. The order the student chose is preserved.
- A destination preference is never inferred from nationality. It is an answer, or it is absent.

---

## ADR-A25: The contract is the contract of record, and the mirror is checked by the build

**Decision.** The frontend's Zod schemas and MSW handlers are the contract. The backend serves
exactly those routes, and `contracts/paths.json` — generated from the handlers, so it cannot drift —
is compared with the routes the service actually serves on every build.

**Why.** A mirror that is written by hand drifts, and a drift that is only found in the browser is
found by a student. The check is deliberately asymmetric:

- a route the **service serves** that the contract does not list is a **mismatch**, and the build
  fails;
- a route the contract lists that the service does not serve yet is a **gap**, and it is reported
  and counted, because the mirror is built in stages.

The parameter names are part of the contract too: `/profile/facts/{id}` and
`/profile/facts/{fact_id}` are different routes, and the check found the difference the first time
it ran.

**Consequences.**
- The path list is generated, never written: `npm run fixtures:export` and the export of
  `contracts/paths.json` read the handlers themselves.
- The **demo data has one source** too. The frontend's fixtures are exported to
  `contracts/demo-fixtures.json`, and the backend seeds itself from that file, so the prototype and
  the real service start from the same world.
- The **same journeys** run in both modes. `e2e/journey.spec.ts` proves the mock; `e2e/live.spec.ts`
  proves the service, with the two differences that are deliberate: there is no prototype banner
  where the data is not synthetic, and the capabilities say what is actually live.
- Every response is validated by the frontend's own Zod schema, so a shape that drifts fails in the
  browser with a named issue rather than as a blank screen. The live run found five such drifts —
  a timestamp without a timezone, a `conflict` field that was missing, a capability field in
  snake_case, a source without its failure reason — and each one is now fixed at the source.

---

## ADR-A26: The answer blocks, and the vocabulary they use

**Decision.** The assistant answers with typed blocks, and every kind the interface can render is
in the contract. The kinds that already existed keep their names; the three that were missing are
added.

| The document's vocabulary | The contract's kind | What it carries |
|---|---|---|
| `answer` | `text` | The answer itself |
| `source_evidence` | `evidence` | The claim, and the passages it rests on |
| `requirement_status` | `checklist` | What the call requires, and what is still open |
| `run_event` | `run` | The run, and where it stands |
| `draft_proposal` | `draft_action` | A document the student could start |
| `institution` | `institution` | The description, the location, the evidence, and what could not be verified |
| `media_context` | `media_context` | Media, labelled as a secondary source |
| `opportunity_reference` | `opportunity_reference` | A pointer to the opportunity, so the message need not repeat it |
| `unknown_or_conflict` | `unknown_or_conflict` | What was checked, what remains unknown, and the next step |
| `action` | `action` | An action the student may take, and whether it prepares or would send |

**Why the names were not changed wholesale.** Renaming `text` to `answer` and `evidence` to
`source_evidence` would touch the Zod union, the MSW handlers, the seven stages, the ten
evaluation fixtures, the interface and the tests — for a naming alignment the document itself calls
optional ("*such as*"). The mapping is recorded here instead, and the three genuinely missing
*semantics* were added, because a missing block is a gap in the product and a different name is
not.

**What each of the three new blocks is for.**
- `media_context` carries media **as secondary context**: the publisher, the date and the source
  type travel with it, and the interface labels it "Media context — secondary source". It never
  proves eligibility, funding, a deadline or an admission likelihood. It is populated only from the
  official pages the fetcher already visited — there is no media discovery.
- `opportunity_reference` is how the chat opens the detail panel without repeating the
  opportunity's whole content in the message.
- `unknown_or_conflict` is the honest edge of an answer: what was checked, what remains unknown,
  and the most useful next step. It distinguishes a *gap* (the source was not reached) from a
  *disagreement* (two sources conflict), because they need different next steps.

**Consequences.**
- The block union is typed on **both** sides. The backend validates every block it produces
  against the union before it leaves, so a malformed answer fails in the service rather than in
  the browser, and the OpenAPI document describes every kind — which is what lets the contract
  check compare the two sides.
- An unknown kind is still handled: the interface says the format is one it does not display yet
  and that the content was not lost. But every kind the contract can produce *is* rendered, and
  a test now says so — the `institution` block was in the contract and in the service while the
  interface quietly dropped it into that fallback.

---

## Phase B — what this means for the backend

| Frontend contract | Backend obligation |
|---|---|
| `lib/schemas/*.ts` (Zod) | Pydantic models with the same shapes; CI compares the OpenAPI document to `z.toJSONSchema()` |
| `lib/api/errors.ts` codes | The same codes in the error envelope, with `request_id` |
| `lib/api/client.ts` paths | `GET/POST/PATCH/DELETE` under `/api/v1`, matching the paths already in the MSW handlers |
| `src/mocks/handlers/*` | The handlers are the executable specification of each endpoint |

The MSW handlers are written to be the endpoint specification: they already implement
authentication, ownership-independent reads, idempotent saves, optimistic-concurrency conflicts
on drafts, and the `202 Accepted` + polling pattern for long-running research. The backend
replaces them without changing the frontend.
