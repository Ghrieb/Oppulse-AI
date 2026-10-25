# Oppulse AI — Frontend

The React workspace for the Oppulse AI Opportunity Action Agent.

```bash
npm install
npm run dev
```

See the [root README](../README.md) for the project overview, the quality gates and the
architecture rationale.

## Layout

| Path                              | What lives there                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`                        | Router, route guard, root error boundary, route fallback, the agent provider                                                                            |
| `src/components/ui/`              | 18 accessible primitives (Radix-backed)                                                                                                                 |
| `src/components/shell/`           | App shell, sidebar, top bar, mobile drawer, command palette                                                                                             |
| `src/components/feedback/`        | Empty / error / permission / not-found states, toasts, banners, form errors                                                                             |
| `src/components/agent/`           | Composer, conversation, answer blocks, context strip, action chips, run timeline                                                                        |
| `src/components/opportunities/`   | Opportunity card, assessment tiles, evidence drawer                                                                                                     |
| `src/components/resources/`       | Institution identity, campus illustration, country flags                                                                                                |
| `src/components/actions/`         | Mission strip, next best action                                                                                                                         |
| `src/components/applications/`    | Working-applicant summary, draft entry points                                                                                                           |
| `src/components/profile/`         | Passport layout, fact card, fact detail, provenance, document library, review history                                                                   |
| `src/components/onboarding/`      | Intent cards, question step, adaptive progress, mission preview                                                                                         |
| `src/features/`                   | One folder per route: landing, onboarding, home, goals, opportunities, documents, profile, applications, writing, monitoring, assistant, settings, auth |
| `src/lib/api/`                    | `config.ts`, `errors.ts` (taxonomy), `client.ts` (the only fetch path), `query-client.ts`                                                               |
| `src/lib/onboarding/`             | Question catalogue, mission derivation engine, local draft storage                                                                                      |
| `src/lib/agent-context.ts`        | The agent's working context and conversation, shared by every surface                                                                                   |
| `src/lib/action-chips.ts`         | The context-aware suggestions the agent offers                                                                                                          |
| `src/lib/application-workflow.ts` | Work left, deadline urgency and missing documents, derived from the workspace                                                                           |
| `src/lib/notifications.ts`        | The rule that decides whether an email may be sent — consent, preference, verification                                                                  |
| `src/lib/date-of-birth.ts`        | Date-of-birth parsing and validation, shared by the onboarding question and the passport                                                                |
| `src/lib/matching.ts`             | The eligibility rule engine, including the age service — shared with the backend                                                                        |
| `src/lib/completeness.ts`         | What the agent can actually use                                                                                                                         |
| `src/lib/brand.ts`                | Deterministic institution identity — no asset is ever stored or fetched                                                                                 |
| `src/lib/next-action.ts`          | The next-best-action derivation, shared with the backend                                                                                                |
| `src/lib/schemas/`                | The API contract, in Zod                                                                                                                                |
| `src/lib/queries.ts`              | Every server-state hook, with optimistic updates and rollback                                                                                           |
| `src/mocks/`                      | MSW handlers, realistic fixtures, chaos mode, persistent mock store                                                                                     |
| `src/styles/tokens.css`           | The design system, from the product specification                                                                                                       |

## The entry flow

```
/                 public landing page
/auth/sign-in     sign in   (returns you to where you were going)
/auth/sign-up     register  (returns you to where you were going)
/onboarding       adaptive questions → derived mission → research
/home             the workspace
```

The route guard (`src/app/guards.tsx`) redirects a signed-out visitor to
`/auth/sign-in?next=…`, and the sign-in page honours `next` afterwards.

## Visual identity without storage

No logo, banner or photograph is stored or fetched. `src/lib/brand.ts` derives each
institution's identity from its official domain:

- a **seal** — initials in a curated, AA-contrast palette, identical on every device;
- a **campus illustration** — a deterministic abstract skyline in the institution's colours;
- **country flags** — inline SVG for the countries we draw, a generated code chip otherwise.

A real logo is used only when the backend has validated one (`institutionBrand.logoUrl`),
and a caching icon service is enabled only for brands the backend has verified as real
institutions. The list views use the generated mark, so a page of twenty results issues
**zero image requests** — asserted by a browser test.

## The profile passport and the rule engine

`src/lib/matching.ts` decides eligibility. A requirement that depends on a profile fact
carries an explicit `check` — `at_least`, `in_list` or `present` — evaluated against the
fact's normalised value, never against the agent's prose. Confirming a fact re-evaluates
every opportunity, so a card can never claim "eligible" while a requirement is open.

The passport shows the completeness of what the agent can _use_, the provenance of every
value, what each fact is used for, and what it is holding up.

## One agent, one thread, one working context

`src/app/agent-provider.tsx` owns the conversation and the working context, so the home panel
and `/assistant` are the _same_ thread. The context is a bounded set of identifiers — a
mission, an opportunity, an application, a draft, and the documents the student authorised for
this message — and the strip shows exactly what the agent is using.

The assistant answers with **blocks** rather than a paragraph: `text`, `evidence` (with its
sources and their quality), `checklist`, `draft_action`, `run` and `action`. Every action that
changes something carries an `effect` — `prepares` or `would_send` — and the interface labels
both, so nothing that would leave the device is reachable without a confirmation.

In the writing studio, selecting a passage scopes the revision to that passage: the proposal
rewrites the selected range and leaves the rest of the document untouched.

## Consent, preference and verification

They are three different things, and the interface keeps them apart:

- **Verification** — `sessionUserSchema.emailVerified`. The backend proves the student owns the
  address. It is never set by the client, and no email is sent to an unverified address.
- **Consent** — `profileConsentSchema.emailNotifications`. Permission, revocable.
- **Preference** — `profilePreferencesSchema.email`. A cadence per alert category: off,
  immediate, daily digest or weekly digest.

**In-app is the only active channel in this release.** The runtime channel schema is `in_app`;
`email` and `mobile_push` are declared in `FUTURE_NOTIFICATION_CHANNELS` and are absent from the
schema the client parses, so an undeliverable channel can never be advertised as live. The rule
that decides an email — consent, then the student's own choice, then verification, with sensitive
alerts sent as a pointer rather than as their content — is frozen and unit-tested in
`src/lib/notifications.ts`, so the backend implements the same decision for the same reasons.

## The protected profile

The date of birth is not a fact — facts are what the agent may use. It lives in a protected
section behind its own endpoint (`GET`/`PATCH /profile/protected`), so a routine profile read
never returns it. The age arithmetic is a pure function in `src/lib/matching.ts`
(`ageOn`, `evaluateAgeRule`, `evaluateAgeRequirement`): the model may extract an age _rule_ from an
official source, but the code does the calculation, on the eligibility date the source states.

The answer is an outcome — "the age requirement appears satisfied", "unresolved", "official cutoff
needs verification" — and never the date.

## Destinations are countries

The onboarding asks for **countries**, not regions: a searchable list with an inline SVG flag and
the country's name as real text beside it. The mission stores the ISO codes in
`criteria.destinationCountries` — the codes, never a rendered flag — and the coarse regions are
derived from them. "Global" is a path, and the interface says it is not a country.

## Conventions

- **Semantic tokens only.** Components use `bg-surface`, `text-text-muted`, `border-border` —
  never a raw hex value. The palette lives in `tokens.css`.
- **One fetch path.** `lib/api/client.ts` is the only place that calls `fetch`.
- **Errors are typed.** Every failure becomes an `ApiError` with a stable `code`; UI branches on
  the code, never on the message.
- **Responses are validated.** Every response is parsed through its Zod schema, so a
  frontend/backend mismatch fails loudly at the boundary.
- **No `any`, no `console.log`.** Enforced by ESLint. Use `lib/logger.ts`.
- **Server state in TanStack Query; UI state in components.** Local state is never a cache.
- **44px minimum targets**, visible focus, labelled controls, `aria-live` for run events.

## Testing

```bash
npm run test                 # Vitest: unit, component, accessibility
npx playwright test          # Browser journey
npx playwright test e2e/screenshots.spec.ts   # Regenerate docs/screenshots
```

The Playwright config drives your already-installed Chrome (`channel: 'chrome'`), so no browser
download is needed. Set `PLAYWRIGHT_CHANNEL=chromium` to use a managed browser instead.
