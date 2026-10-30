# Oppulse AI — Independent Judge Testing Checklist

## Overview
This document outlines the complete testing scenarios for Oppulse AI, designed for independent verification without developer assistance. Test these scenarios using a **clean student account** (no prior data).

**Important**: Use real provider calls (Groq/Tavily) for live scenarios. Use recorded fixtures for automated regression tests. Do not fabricate successful outcomes — record actual results.

---

## Phase 1: Account & Workspace

### 1.1 Account Creation & Workspace Access
- **Judge does**: Visit Oppulse URL, sign up with student email, complete registration
- **Expected**: Account created, redirected to personalized workspace with "Hi [name]!" greeting
- **Actual**: _Fill in after testing_
- **Groq/Tavily**: Not applicable (setup step)

### 1.2 Workspace Navigation
- **Judge does**: Click sidebar links (Home, Opportunities, Profile, Assistant), use top-bar search
- **Expected**: Each navigates correctly, no broken links or 404s
- **Actual**: _Fill in after testing_

---

## Phase 2: AI Conversation

### 2.1 Natural Conversation Start
- **Judge does**: Click agent composer, send "Hello"
- **Expected**: Assistant responds naturally (not robotic), references profile context
- **Actual**: _Fill in after testing_
- **Groq/Tavily**: **Uses Groq** ✅

### 2.2 Conversation Continuity
- **Judge does**: Send multiple messages, observe context carry-over
- **Expected**: Previous messages remembered, context carries forward through the session
- **Actual**: _Fill in after testing_

### 2.3 Clarification Questions
- **Judge does**: Ask "What does 'fully funded' cover?"
- **Expected**: Assistant explains honestly, mentions what's not covered, no fabrication
- **Actual**: _Fill in after testing_
- **Groq/Tavily**: **Uses Groq** ✅

---

## Phase 3: Opportunity Search & Analysis

### 3.1 Search by Academic Interests
- **Judge does**: Send "Find research internships in Europe for AI students"
- **Expected**: Tavily queries with constraints (AI + research internship + Europe); results populate
- **Actual**: _Fill in after testing_
- **Groq/Tavily**: **Uses Tavily** ✅

### 3.2 Change Preference in Follow-up
- **Judge does**: Follow up with "Actually, I want funding for living costs too"
- **Expected**: Assistant acknowledges the updated preference; re-queries with living cost constraint
- **Actual**: _Fill in after testing_
- **Groq/Tavily**: **Uses Groq + Tavily** ✅

### 3.3 Open & Inspect Opportunity
- **Judge does**: Click an opportunity card, navigate tabs (Overview, Eligibility, Funding, Sources)
- **Expected**: Detail page opens; funding badge only shown when evidence exists; competitiveness/confidence badges only when `hasEvidence: true`
- **Actual**: _Fill in after testing_

### 3.3 Inspect Official Sources
- **Judge does**: Open Sources tab, open evidence drawer
- **Expected**: ".edu"/".gov" sources show "Official source" badge; others show "Secondary source"; URLs are clickable; excerpts visible
- **Actual**: _Fill in after testing_
- **Groq/Tavily**: **Uses Tavily** ✅

---

## Phase 4: Profile & CV

### 4.1 Upload CV
- **Judge does**: Upload supported CV file (PDF preferred)
- **Expected**: Headline extracted to profile; up to 10 notes stored in `preferences.cvNotes`; AI overview generated
- **Actual**: _Fill in after testing_
- **Groq/Tavily**: **Uses Groq** ✅

### 4.2 Review Generated Overview
- **Judge does**: Observe profile match percentage displayed; facts with `status: "proposed"` awaiting confirmation
- **Actual**: _Fill in after testing_

### 4.3 Correct/Confirm Profile Information
- **Judge does**: Find a proposed fact, click "Confirm"; try excluding a fact
- **Expected**: Confirmed facts update eligibility; excluded facts no longer used; user-entered data never overwritten without consent
- **Actual**: _Fill in after testing_

---

## Phase 5: Application Workflow

### 5.1 Select Opportunity & Apply
- **Judge does**: Select an opportunity, navigate to Funding/Requirements tabs, click "Start application" or "Save"
- **Expected**: Application workspace created; opportunity saved to list; deadline badges visible
- **Actual**: _Fill in after testing_

### 5.2 Save & Inspect Task/Del Features
- **Judge does**: Save an opportunity, navigate to Saved opportunities, check for tasks/deadlines
- **Expected**: Deadline badge shows verified/unverified/conflict; competitiveness/confidence badges only when `hasEvidence: true`; "Fully funded" only when all components confirmed
- **Actual**: _Fill in after testing_

---

## Verification Notes

| Check | Result |
|---|---|
| `uv run pytest -q` — all tests pass | _______ |
| `npm run lint` — 0 errors | _______ |
| No user-facing development jargon | _______ |
| No fabricated citations/evidence | _______ |
| Synthetic/demo opportunities filtered | _______ |
| Erasmus Mundus: collection clarification | _______ |
| Groq used in: chat, search constraints, funding labels | _______ |
| Tavily used in: constraint search, domain filtering | _______ |

---

## Notes for Judges

- **Use real provider calls** only for essential live scenarios:
  - Groq: natural language responses, context-aware answers
  - Tavily: search with constraints (degree, geography, funding, destination)
- **Use recorded fixtures** for automated regression tests
- **Do not fabricate successful outcomes** — record actual results, including errors/limitations
- **If a blocker is encountered**, record it exactly as it appears; note the reference ID if applicable
- **All scenarios should work with a clean student account** (no prior data)

---

## Phase History

| Phase | Deliverables |
|---|---|
| **Phase 1** | Context-aware Groq AI, constraint-based Tavily search, CV from existing profile fields |
| **Phase 2** | Data cleanup, jargon removal, evidence-backed badges/labels, Erasmus Mundus clarification |
| **Phase 3** | First impression, navigation, AI assistant experience, CV/profile experience, responsive/a11y |
| **Phase 4** | Independent judge testing checklist with real provider calls |

---

**Last verified**: _______ (date)

**Tester**: _______ (username/ID)

**Environment**: 
- Frontend: `localhost:5173` (or deployed URL)
- Backend: `localhost:8000` (uvicorn)
- Groq model: `gsk_...` (len 56, present ✅)
- Tavily key: `tvly-dev-...` (len 58, present ✅)