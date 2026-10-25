# Submission text — Thirduni Cohort 1

Drafts for the eight required submission items. Final wording is set when the live deployment
exists; the bracketed fields are the only ones that must be filled in.

---

## 1. Project name and one-line summary

**Oppulse AI — an agent that researches academic opportunities, checks them against the student's
own profile, and turns the right one into a real application plan.**

*(20 words exactly — verify before submitting.)*

---

## 2. Project description — 150 words max

> Students and researchers lose weeks reading scholarship and internship calls, and still apply to
> programmes they were never eligible for. Oppulse AI is an agent that does that reading. A
> student uploads a CV and describes a goal in their own words; the agent searches the web,
> retrieves the official calls, extracts each requirement and funding clause, and checks them
> against the student's confirmed profile. Every claim comes back with its source, the page
> reference and the retrieval time, and anything it could not reach is shown as a failure rather
> than hidden. Fit, eligibility, funding, competitiveness and confidence are reported separately —
> a fit score is never dressed up as a probability of admission. The student turns a promising
> result into a checklist and a draft, reviews AI revisions as a diff instead of accepting them
> blind, and saves the mission so the agent keeps watching for changes. Built for students who
> apply to too many things and qualify for too few.

---

## 3. Live demo link

`[DEPLOYED URL — Azure Static Web Apps]`

Optional: a second URL that opens a pre-seeded demo account.

---

## 4. Code repository

`[PUBLIC GITHUB URL]`

The README covers what the project is, how to run it locally, and who built which part.

---

## 5. Demo video

`[YOUTUBE UNLISTED LINK]`

Two to four minutes. Screen recording with voice-over. Opens on the product, not on slides.
Script in `docs/demo-script.md`.

---

## 6. Team members and roles

| Member | What I did |
|---|---|
| Hani | Product and architecture: requirements synthesis, stack selection and provider verification, ADRs. Frontend: all eleven routes, the UI primitives, the design system, the command palette and the writing studio. API contract: the Zod schemas for twenty domain entities and the typed error envelope. Quality: the error taxonomy, the MSW mock backend, the chaos harness, ninety-five unit and component tests, three accessibility gates and fourteen browser journey tests. Backend, AI integration and deployment. |

*(Solo team. If more members join, give each one a line describing what they actually did —
"helped with everything" is not acceptable.)*

---

## 7. Tech stack

**Languages and frameworks**
- TypeScript 5.9, React 19, Vite 8, React Router 7, TanStack Query 5
- Tailwind CSS 4, Radix UI primitives, Tiptap 3 rich-text editor
- Zod 4 (runtime contract validation), React Hook Form
- Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic *(Phase B)*
- PostgreSQL (Supabase) *(Phase B)*

**Services**
- Groq — `openai/gpt-oss-20b` and `-120b` for reasoning and structured extraction, plus Groq
  Browser Search for web research
- Tavily — optional second search provider *(Phase B, to be A/B tested against Groq search)*
- Supabase — Postgres, private Storage, row-level security
- Azure Static Web Apps (Free) — frontend hosting
- Azure App Service Linux F1 (Free) — API hosting
- GitHub Actions — CI, deployment, the monitoring worker and the scheduled checks
- Email provider — optional external alert channel

**AI tools used during development**
Claude Code (OpenCode) for scaffolding, refactoring and test authoring; the repository itself is
the record.

**Testing:** Vitest, Testing Library, axe-core, Playwright, Pytest *(Phase B)*

**Cost:** $0. Everything above sits inside a free tier, and the deployment relies on free
GitHub Actions minutes from a public repository.

---

## 8. What happens next — 100 words max

> Oppulse AI is currently a complete frontend with a typed API contract, a mock backend and a
> tested browser journey. The next three months go to the parts that make it real: the FastAPI
> backend and its database, the agent loop that searches, reads and checks requirements against
> the student's profile, and the scheduled worker that watches for changes.
>
> After that we want to make the evidence the product. Today a student sees why a programme
> matched; next they should be able to compare six applications side by side and see exactly
> which requirement each one fails. We also want to measure whether the agent's recommendations
> are trusted — do students act on them, and are the eligibility findings correct? Finally, we
> want to open the source connectors, so a university or scholarship foundation can publish a
> feed the agent reads directly, rather than relying on search to find it.

---

## Optional: pitch deck outline (max 8 slides)

1. **The problem** — weeks of reading, still ineligible. One photo of a stack of printed calls.
2. **What it does** — one sentence and the three-panel screenshot.
3. **The evidence promise** — the source drawer, the conflict panel, the unreachable source.
4. **The agent loop** — plan, search, fetch, extract, check, explain, save, monitor.
5. **Honest scoring** — profile match, not probability. Eligibility, funding, competition and
   confidence, separately.
6. **The AI writes with you** — the diff, the unsupported-claim flag, the version history.
7. **It keeps watching** — a real alert from a scheduled check, with the real check times.
8. **What next** — the three-month plan.

---

## Pre-submission checklist

- [ ] Live link opens in a **private window, logged out**
- [ ] Video is **unlisted**, not private, and plays without a request for access
- [ ] Repository is **public** and the README is complete
- [ ] No secrets anywhere in the repository — run `git grep -iE "gsk_|tvly-|eyJ"` before pushing
- [ ] Project description is under 150 words
- [ ] One-line summary is under 20 words
- [ ] "What happens next" is under 100 words
- [ ] Submitted **before** 31 October, not on it
