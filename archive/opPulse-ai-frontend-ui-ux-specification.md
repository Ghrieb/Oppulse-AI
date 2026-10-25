# Oppulse AI — Frontend UI/UX Specification

**Product:** Oppulse AI — Opportunity Action Agent  
**Document status:** Frontend design and experience specification  
**Audience:** Product, UX, frontend and demo teams  
**Primary goal:** Make the agent feel trustworthy, calm, actionable and genuinely useful to students and professionals moving from research to application.

---

## 1. Experience North Star

Oppulse AI is not a scholarship directory with a chatbot attached. The interface should feel like a focused personal research workspace where an AI agent helps the user make progress.

The product experience follows one visible loop:

> **Tell us what you want → understand your profile → investigate evidence → decide what is worth your time → prepare the next action → keep watching.**

The interface must make three things obvious at all times:

1. **What the agent is doing now.**
2. **What the agent knows, what it inferred and what remains uncertain.**
3. **What the student can do next.**

The ideal user leaves every important screen with a concrete next action: confirm a fact, open the official call, resolve a missing requirement, start a draft, save a mission or review a change.

### 1.1 Design principles

- **Agent-first, not chatbot-first:** The conversation is an intelligent control surface, while structured results remain easy to scan.
- **Evidence before confidence:** Source citations and uncertainty appear beside the claim they qualify.
- **Progress over decoration:** Every screen should help the user advance a real mission or application.
- **Progressive disclosure:** Ask only what is needed now; reveal advanced controls when the user needs them.
- **Human approval for consequential actions:** The AI proposes; the student reviews and decides.
- **Respectful personalization:** Use confirmed profile context, explain when it is used and never imply certainty the data does not support.
- **Calm under failure:** A provider failure or missing document should produce a useful recovery path, not a dead end.
- **Designed for both students and professionals:** Support first-time applicants who need guidance and experienced applicants who need speed, comparison and control.

---

## 2. Target Users and Experience Modes

### 2.1 First-time or early-stage student

Needs plain-language explanations, examples, confidence-building guidance and help understanding unfamiliar requirements. The interface should explain terms such as “eligibility,” “funding gap,” “source evidence” and “fit score” without condescension.

**UX priorities:** guided onboarding, visible definitions, recommended next steps, document checklist, “why this matters” explanations and safe defaults.

### 2.2 Experienced student or researcher

Needs fast triage across many opportunities, advanced filters, side-by-side comparison, source traceability and efficient drafting.

**UX priorities:** command/search bar, keyboard shortcuts, saved views, compact cards, comparison mode, evidence drawer and batch organization.

### 2.3 Professional or working applicant

May be balancing employment, family responsibilities, relocation and multiple deadlines. They need time-aware planning, financial clarity, reminders and low-friction resume reuse.

**UX priorities:** workload-aware application plans, deadline calendar, funding-gap visibility, time estimates, mobile-friendly alerts and clear task ownership.

### 2.4 Shared experience contract

The product should adapt language and depth without creating separate products. A user can switch between **Guided view** and **Focus view**:

- **Guided view:** more explanations, onboarding prompts and contextual help.
- **Focus view:** denser results, fewer interruptions, keyboard actions and compact evidence.

The setting changes presentation density and coaching—not the underlying truth, permissions or evidence standards.

---

## 3. Information Architecture and Navigation

### 3.1 Primary routes

| Route | Purpose | Primary success action |
|---|---|---|
| `/home` | Workspace overview, active mission, deadlines, agent activity and alerts | Resume the most valuable next action |
| `/goals` | Create, edit, pause and prioritize research missions | Start or refine a mission |
| `/opportunities` | Search, filter, rank and compare findings | Open a grounded opportunity analysis |
| `/opportunities/:id` | Deep analysis with evidence, fit, funding and plan | Decide whether to pursue, save or dismiss |
| `/documents` | Upload, review, confirm and manage documents | Confirm useful profile facts |
| `/applications` | All application workspaces and status | Continue an application |
| `/applications/:id` | Checklist, tasks, drafts, sources and deadlines | Complete the next requirement |
| `/writing/:draftId` | Rich-text editor and reviewable AI proposals | Accept or edit a safe revision |
| `/monitoring` | Monitoring targets, source checks, events and alerts | Review what changed and why |
| `/assistant` | Context-aware agent entry point | Ask, investigate or create a task |
| `/settings` | Profile, privacy, integrations, notifications and preferences | Control data and behavior |

Every meaningful state should have a deep link. A judge or user should be able to refresh, copy a URL and return to the same opportunity, draft or run state.

### 3.2 Desktop shell

- Fixed dark navy sidebar, 240–264 px wide.
- Top bar with global command/search field, run status, notifications and profile menu.
- Light main workspace with a maximum readable content width.
- Optional contextual right panel on research and opportunity routes.
- Never use the sidebar as the only way to understand current location: active route, page title and breadcrumb must also be visible.

### 3.3 Tablet and mobile shell

- Collapse the sidebar into a labelled menu drawer.
- Use a compact top bar with back navigation and page title.
- Convert the contextual right panel into a full route or bottom sheet; do not squeeze three columns into unreadable widths.
- Keep the global “Ask Oppulse” composer available as a bottom action, with safe-area padding.
- Keep a maximum of five primary mobile navigation destinations visible; secondary destinations belong in the menu.

### 3.4 Navigation states

Every route must define:

- first visit / onboarding state;
- loading state;
- populated state;
- empty state;
- partial-data state;
- permission-denied state;
- not-found state;
- offline or provider-unavailable state; and
- recovery action.

---

## 4. Visual Design System

### 4.1 Visual character

**Direction:** Calm premium research workspace. Light main canvas, deep navy navigation, restrained indigo actions, pale blue information surfaces, verified green, caution amber and error red.

Avoid generic AI neon gradients, excessive glassmorphism, giant marketing hero sections, decorative motion and dense CRM-style tables. The product should look intelligent because its information hierarchy is clear—not because it is visually noisy.

### 4.2 Color tokens

Use semantic tokens, not raw colors inside components.

```css
:root {
  --color-sidebar: #0b1730;
  --color-sidebar-raised: #14264a;
  --color-background: #f5f7fb;
  --color-surface: #ffffff;
  --color-surface-subtle: #eef3fb;
  --color-border: #dce4f0;
  --color-text: #12213d;
  --color-text-muted: #60708a;
  --color-primary: #5b4bf2;
  --color-primary-hover: #4939db;
  --color-info: #2f73c9;
  --color-success: #16845a;
  --color-success-surface: #e8f7ef;
  --color-warning: #a96800;
  --color-warning-surface: #fff5dd;
  --color-danger: #c13c48;
  --color-danger-surface: #ffedf0;
  --focus-ring: #7d6cff;
}
```

Required color behavior:

- Text contrast must meet at least 4.5:1 for normal text and 3:1 for large text.
- Never communicate status through color alone; pair color with label, icon and/or text.
- Green means supported/positive, not guaranteed admission.
- Amber means unresolved or needs attention, not failure.
- Red means an actionable error, expired state or confirmed restriction.
- Source links use a consistent blue treatment and remain distinguishable without relying on hover.

### 4.3 Typography

- Use Inter or a comparable freely available, highly legible sans-serif.
- Base body size: 16 px; line-height: approximately 1.5.
- Page title: 28–32 px desktop, 24–28 px mobile.
- Section heading: 18–22 px.
- Card title: 16–18 px with strong weight.
- Metadata: never smaller than 12–13 px; avoid using low-contrast microtext for important information.
- Use sentence case in labels and buttons.
- Prefer concise verbs: “Run research,” “Confirm facts,” “Save mission,” “Review change.”

### 4.4 Spacing and shape

- Base spacing unit: 4 px.
- Standard layout rhythm: 8, 12, 16, 24, 32, 48 px.
- Card radius: 12–16 px.
- Button radius: 8–10 px.
- Avoid excessive rounded pills; reserve them for compact status tags and filters.
- Use subtle borders before shadows. Elevation should communicate hierarchy, not decorate every surface.

### 4.5 Icons and imagery

- Use Lucide icons consistently.
- Icon-only buttons require an accessible label and a tooltip on desktop.
- Decorative icons are hidden from assistive technology.
- Never use emoji as interface icons.
- Opportunity imagery is optional and must never replace title, institution, source or evidence.
- Use meaningful empty-state illustrations sparingly and provide a text explanation and action.

---

## 5. Global Interaction Patterns

### 5.1 Buttons

Every button has a clear consequence and a state:

- default;
- hover;
- focus-visible;
- pressed;
- disabled with explanation where appropriate;
- loading with progress label; and
- success or follow-up state.

Minimum interactive target: **44 × 44 px**, with at least 8 px separation between adjacent targets. Do not disable a button silently; explain what is missing or why the action is unavailable.

### 5.2 Forms

- Use visible labels, not placeholder-only labels.
- Show helper text before the user makes an error.
- Validate on blur for local fields and on submit for cross-field rules.
- Place field errors beside the field and summarize them at the top for long forms.
- Move focus to the error summary after failed submit, then preserve a logical tab order.
- Use progressive disclosure for optional profile fields.
- Save drafts when leaving a long form, but clearly show “Saved,” “Saving…” or “Not saved.”

### 5.3 Confirmation and destructive actions

Use confirmation only when an action is destructive, external or difficult to reverse. For reversible actions such as save/dismiss, use an undo toast where possible.

Before deleting a document, mission or draft, explain consequences in plain language. Destructive confirmation must identify the item by name and offer Cancel as the safe default.

### 5.4 Toasts and inline feedback

- Toasts confirm low-risk background results; they do not carry the only copy of an important error.
- Inline status belongs near the affected content.
- Use an `aria-live` region for new run events, save completion and alert counts, but avoid announcing every streaming token.
- Keep toasts long enough to read and provide an action when recovery is possible.

### 5.5 Loading and progress

Use skeletons for known content layouts, spinners for short actions and progress steps for agent runs. Never show a fake completed step.

Research progress should display:

- current phase;
- completed phases;
- source count or bounded work performed where meaningful;
- elapsed time or “started at” timestamp;
- provider/source warnings;
- cancel option; and
- what will happen next.

When progress cannot be estimated, say “Working through the available sources” rather than inventing a percentage.

### 5.6 Motion

- Use short, purposeful transitions for expansion, panels and status changes.
- Prefer opacity/transform over animating layout dimensions.
- Respect `prefers-reduced-motion` by removing non-essential movement.
- Never delay access to content for animation.
- Avoid perpetual pulsing or animated “AI thinking” indicators that imply reasoning not actually happening.

---

## 6. Core User Flows

### 6.1 First-run onboarding

**Goal:** Get the user to a useful mission quickly without forcing a long form.

1. Welcome: explain the promise in one sentence and show the five possible starting actions.
2. User chooses: find opportunities, analyze a specific opportunity, prepare an application, monitor something or ask a question.
3. Agent asks only the next necessary question.
4. Optional CV upload appears at the moment profile context would improve results.
5. Extracted facts appear in a review card with “Confirmed,” “Needs correction” and “Not mine” controls.
6. User sees what will be used and can exclude documents or facts.
7. Mission preview summarizes scope, destinations, funding preference, timing and source access.
8. User edits the mission and starts research.

**Error handling:** If upload processing fails, keep the mission draft intact and offer “Continue without this document,” “Retry” and “View supported formats.” If profile facts conflict, pause only the affected decision and allow research using confirmed facts.

### 6.2 Mission builder

Use a conversational left-to-right progression with a persistent structured summary. The summary is editable and should update after every answer.

Show:

- objective;
- opportunity types;
- academic interests;
- destinations;
- education level;
- nationality/eligibility attributes when supplied;
- funding preference;
- intended start period;
- selected documents;
- source scope; and
- monitoring preference.

The primary action label changes based on state: “Continue,” “Review mission,” then “Run research.” Never label an action “Submit” when it only saves a draft.

### 6.3 Research workspace

Desktop layout:

- **Left:** persistent navigation.
- **Center:** mission conversation, real progress events and result list.
- **Right:** selected opportunity summary and next actions.

At the top, show the mission name, status, last run time and edit control. The search composer accepts natural language, a URL and a supported upload.

During research, the center shows an event timeline. Events are factual UI state: “Retrieved source,” “Source unavailable,” “Extracted deadline,” “Needs profile confirmation.” Do not show fabricated internal chain-of-thought.

When complete, show a compact result summary:

> “Reviewed 12 accessible sources. Found 4 candidate opportunities. 2 require eligibility verification. One source could not be reached.”

### 6.4 Opportunity card

Card order:

1. Title and institution.
2. Opportunity type, destination and official source domain.
3. Deadline with verification status and remaining time.
4. Funding coverage summary, never only “funded.”
5. Fit score with label “profile match,” not probability.
6. Eligibility state and confidence.
7. One-sentence recommendation.
8. One warning or unresolved item.
9. Actions: “Deep analysis,” “Save,” “Add to application,” “Track,” “Dismiss.”

Card actions must persist and provide immediate feedback. If a save fails, keep the card state unchanged, explain the failure and offer Retry.

### 6.5 Deep opportunity analysis

Use a clear header with title, institution, source and status. Under it, display five compact but labelled concepts:

- **Fit:** profile-to-opportunity match.
- **Eligibility:** likely, unresolved or ineligible based on known requirements.
- **Funding:** what is covered and what may remain.
- **Competitiveness:** only when evidence exists; otherwise “Unknown.”
- **Confidence:** completeness and quality of supporting evidence.

Tabs or sections:

1. Overview
2. Eligibility
3. Funding
4. Requirements
5. Deadline
6. Evidence
7. Application plan

Every high-stakes claim has a nearby “View evidence” action that opens a source drawer with URL, excerpt, page reference, retrieval date and source quality. Conflicting sources appear as a conflict notice, not silently merged.

### 6.6 Application workspace

The application workspace is a progress cockpit, not a bookmark list.

Header:

- opportunity title;
- application status;
- verified deadline;
- overall completion percentage only when derived from explicit checklist items;
- “Next best action”; and
- “Ask Oppulse” entry.

Main sections:

- checklist with source, status, due date and linked document;
- document readiness;
- writing drafts;
- recommendation tracking;
- tasks and notes;
- official application links; and
- evidence/updates.

Use statuses that reflect reality: Considering, Preparing, Waiting for documents, Waiting for recommender, Ready for review, Submitted, Accepted, Rejected and Withdrawn.

### 6.7 Writing studio

Three-pane desktop layout:

- left: application context and required document checklist;
- center: editable Tiptap document;
- right: AI assistant and revision proposal.

The assistant must show the context it is using: selected text, opportunity details and selected profile facts. A proposal is displayed as a diff with Accept, Reject, Edit and Regenerate actions.

Autosave status is always visible. If autosave fails, preserve local draft state, show “Changes not saved,” provide Retry and allow the user to copy/export the local content before leaving.

Do not present a generated letter as a recommendation from another person. For recommendation support, label the result as “Briefing material for your recommender.”

### 6.8 Monitoring and alerts

Monitoring cards show:

- target;
- frequency;
- last successful check;
- next scheduled check;
- source status;
- events detected; and
- pause/resume controls.

An alert answers three questions immediately:

1. What changed?
2. Why does it matter to me?
3. What should I do next?

If an external notification fails, the in-app alert remains available with “Email delivery failed” and a retry action. Never hide an event because one channel failed.

---

## 7. Error Handling and Recovery Matrix

| Scenario | User-visible state | Recovery |
|---|---|---|
| Network lost before save | Banner: “You’re offline. Your last local changes are preserved.” | Retry when connection returns; show unsynced count. |
| Session expired | Modal explaining the session expired | Sign in again, return to the previous route after success. |
| Unauthorized resource | Neutral “You don’t have access to this item.” | Link back to workspace; never reveal whether another user owns it. |
| Route/resource not found | Explain that the item may have been deleted or link is outdated | Return to relevant list; preserve query/filter when possible. |
| Unsupported upload type | Inline error naming accepted formats and size limit | Choose another file; keep mission/profile form state. |
| Upload interrupted | Document status “Upload incomplete” | Resume or restart; do not create a misleading processed record. |
| Document extraction failed | “We could not read this file.” with cause if safe | Retry, upload another format, or continue manually. |
| Ambiguous extracted fact | “Needs confirmation” badge | Confirm, correct, exclude or inspect source excerpt. |
| Search provider unavailable | Partial run state with affected source | Retry source, continue with available results or upload/paste source. |
| Source blocked or inaccessible | Evidence warning, not a success state | Open official link, upload PDF or paste relevant text. |
| Research timeout | Run marked partial or retryable | Resume from saved progress; show completed work. |
| Rate limit | “Research paused briefly due to provider limits.” | Automatic bounded retry; allow user to leave and return. |
| No opportunities found | Explain search scope and limitations | Broaden filters, change funding scope, edit mission or retry. |
| Conflicting deadline | Amber conflict panel | Show both sources and ask user to verify before marking deadline safe. |
| AI response unavailable | Keep user content and context | Retry with same request; provide manual editing fallback. |
| Draft autosave failure | Persistent “Not saved” state | Retry, download/copy local content, do not silently discard. |
| AI proposal contains unsupported claim | Flag in proposal review | Reject or edit; show unsupported-claim warning. |
| Duplicate monitoring event | Suppress duplicate alert | Show event history and last detected timestamp. |
| Notification delivery failure | In-app alert remains; channel marked failed | Retry channel or configure another notification method. |
| Destructive delete | Confirmation with exact item name and consequences | Cancel or confirm; support recovery only where implemented. |
| Browser refresh during run | Run resumes from persisted state | Show status and event history; never restart silently. |

### 7.1 Error copy rules

- Say what happened, not only “Something went wrong.”
- Say whether user data was saved.
- Say what the user can do next.
- Avoid blame and technical jargon.
- Never claim success when the backend has not confirmed it.
- Do not expose provider secrets, stack traces or private source content.

Example:

> **This source could not be reached**  
> We found the link, but the site did not return usable content. No claims from this source were marked as verified. Try opening the official page, uploading the announcement PDF, or running the analysis again.

---

## 8. Accessibility Requirements

Accessibility is a product requirement, not a final polish pass.

- All functionality works by keyboard.
- Focus states are visible and never removed.
- Focus moves into dialogs and returns to the triggering control on close.
- Focus is not trapped in non-modal panels.
- Landmarks identify navigation, main content, complementary detail panel and footer actions.
- Headings follow a logical hierarchy.
- Every input has a visible label and programmatic description when needed.
- Errors are associated with fields and announced through an error summary.
- Status changes use polite live regions; urgent failures use assertive announcement sparingly.
- Icons are labelled or hidden appropriately.
- Tables and comparison views have headers and row/column relationships.
- Color is never the sole status signal.
- Touch targets are at least 44 × 44 px.
- Text can zoom to 200% without loss of content or horizontal scrolling.
- Reduced-motion preferences are honored.
- Upload and document processing states are understandable without visual animation.
- Screen-reader text distinguishes “fit score” from “admission probability.”

### 8.1 Accessible status examples

Bad: green circle with “92.”  
Good: “Profile match: 92 out of 100. This is not an admission probability.”

Bad: red border around a deadline.  
Good: “Deadline conflict: two official sources show different dates. Verification required.”

---

## 9. Responsive Layout Rules

### 9.1 Breakpoints

Use content-driven breakpoints rather than device-specific assumptions:

- Mobile: under 640 px.
- Tablet: 640–1023 px.
- Desktop: 1024 px and above.
- Wide desktop: 1440 px and above, with a capped readable canvas.

### 9.2 Mobile priorities

On mobile, prioritize:

1. mission status and next action;
2. selected opportunity title, deadline and funding summary;
3. evidence access;
4. checklist and draft continuation;
5. alerts and monitoring status.

Move comparison, dense evidence tables and advanced filters into full-screen routes or horizontal sections with accessible alternatives. Do not require precision hover interactions.

### 9.3 Responsive research workspace

- Desktop: three areas.
- Tablet: center results plus collapsible detail drawer.
- Mobile: result list → dedicated opportunity detail route; persistent bottom composer becomes a labelled action button that opens a full-screen composer.

### 9.4 Responsive writing studio

- Desktop: context/editor/assistant split.
- Tablet: editor first; context and assistant as tabs/drawers.
- Mobile: editor full screen; “Review AI proposal” opens a focused diff route with sticky Accept/Reject controls.

---

## 10. Frontend Component Inventory

### Shell and navigation

`AppShell`, `Sidebar`, `MobileNavDrawer`, `TopBar`, `Breadcrumbs`, `GlobalCommandSearch`, `NotificationBell`, `ProfileMenu`, `RouteAnnouncer`.

### Agent and execution

`AgentComposer`, `MissionConversation`, `MissionSummary`, `RunStatus`, `RunTimeline`, `ProgressStep`, `ProviderWarning`, `RetryAction`, `CancelRunButton`.

### Opportunities

`OpportunityCard`, `OpportunityList`, `OpportunityFilters`, `OpportunitySort`, `FitScore`, `EligibilityBadge`, `FundingCoverage`, `DeadlineBadge`, `EvidenceDrawer`, `ComparisonTable`, `DismissFeedbackDialog`.

### Profile and documents

`DocumentUploader`, `UploadProgress`, `DocumentCard`, `FactReviewCard`, `FactConfidence`, `ConsentSelector`, `ProfileSnapshotSummary`.

### Applications and writing

`ApplicationHeader`, `Checklist`, `ChecklistItem`, `TaskList`, `RecommendationTracker`, `DraftList`, `WritingEditor`, `EditorToolbar`, `AIProposalPanel`, `DiffViewer`, `AutosaveIndicator`, `VersionHistory`, `ExportMenu`.

### Monitoring and alerts

`MonitorCard`, `CheckStatus`, `ChangeEventCard`, `AlertList`, `AlertDetail`, `DeliveryStatus`, `SnoozeMenu`.

### System feedback

`Skeleton`, `EmptyState`, `ErrorState`, `PermissionState`, `NotFoundState`, `OfflineBanner`, `ToastRegion`, `ConfirmDialog`, `InlineValidation`, `ErrorSummary`, `HelpPopover`.

All components should accept semantic states as typed props rather than relying on ad hoc CSS class combinations.

---

## 11. Frontend State and Data Behavior

Use TanStack Query for server state and a small local state layer for transient UI state.

### Server state

- profile and confirmed facts;
- documents and processing status;
- missions and run state;
- opportunities, matches and evidence;
- applications, checklists, tasks and drafts;
- monitoring targets, events and alerts.

### Local UI state

- open drawers and dialogs;
- selected opportunity;
- active filters before applying;
- editor selection and pending proposal;
- local unsynced draft content;
- guided/focus view preference.

Never treat local optimistic state as confirmed persistence. Optimistic save actions must have rollback and visible failure feedback.

### Polling and event updates

- Poll active run status with backoff, or use SSE where deployment supports it.
- Stop polling when the run reaches a terminal state.
- Preserve the last event cursor to avoid duplicate announcements.
- Invalidate relevant queries after confirmed mutations.
- Keep stale results labelled when a newer run is in progress.

---

## 12. Performance and Quality Targets

- Fast first meaningful render on the primary workspace.
- Lazy-load writing studio, comparison mode and heavy document preview code.
- Reserve image and panel space to avoid layout shift.
- Avoid rendering all evidence excerpts at once; virtualize or paginate long lists.
- Debounce global search and autosave without delaying explicit save actions.
- Use compressed WebP/AVIF imagery where imagery is necessary.
- Keep animations on compositor-friendly properties.
- Maintain a responsive interface during long agent runs; background work must never block the main thread.
- Verify no horizontal scroll at common laptop, tablet and mobile widths.

Recommended acceptance targets:

- no uncaught console errors on core routes;
- no inaccessible unlabeled interactive controls;
- no cumulative layout shift caused by late content reservation;
- all core actions expose loading and failure states;
- judge can complete the primary demo without knowing hidden shortcuts.

---

## 13. Demo-Ready Experience

The criteria reward a working product over a broad but incomplete interface. The demo should open directly on a real or controlled workspace and show:

1. The user mission and why it matters.
2. A real document/profile confirmation step.
3. A research run with honest progress.
4. Ranked findings with source evidence.
5. A deep analysis showing eligibility, funding and uncertainty.
6. An application workspace with a concrete next task.
7. A writing proposal reviewed through a diff.
8. A saved monitoring target and visible alert from a controlled source change.

The product should communicate the story in under thirty seconds:

> “Oppulse AI helps students and professionals decide which opportunities are genuinely worth pursuing, then turns that decision into an application plan and keeps watching for changes.”

Do not spend the opening of the demo on a decorative dashboard tour. Put the user goal and working agent journey first.

---

## 14. Frontend Quality Checklist

### Before implementation

- [ ] Routes and success actions are defined.
- [ ] Empty, loading, partial, permission and failure states are designed.
- [ ] Each action has a backend contract and persistence behavior.
- [ ] Content hierarchy is understandable without color or animation.

### Before merging

- [ ] Keyboard navigation works across every core flow.
- [ ] Focus-visible styles are present.
- [ ] Labels, descriptions and errors are programmatically associated.
- [ ] Touch targets are at least 44 × 44 px.
- [ ] Mobile layouts do not require hover or horizontal scrolling.
- [ ] Loading states do not claim completion.
- [ ] Optimistic actions roll back on failure.
- [ ] Long-running runs survive refresh.
- [ ] AI proposals are reviewable and never destructively overwrite content.
- [ ] Source evidence is accessible from every high-stakes claim.
- [ ] Unsupported, inaccessible and conflicting sources are honestly represented.

### Before the Thirduni submission

- [ ] Deployed link works in a private browser window while logged out or with demo access as intended.
- [ ] Core journey works from a clean session without developer intervention.
- [ ] Error states are tested, not only happy paths.
- [ ] Demo screen text is readable at recording resolution.
- [ ] The README explains the frontend stack, setup and known limitations.
- [ ] No secrets or private files appear in the client bundle.
- [ ] The experience demonstrates one complete working feature rather than five disconnected screens.

---

## 15. Final Frontend Recommendation

Build the Oppulse AI frontend as a **responsive, accessible React workspace with a dark navy navigation shell, light evidence-first canvas, calm indigo actions and a context-aware agent composer**. Keep the interface structured enough for experienced applicants to move quickly, but guided enough for a student opening an application for the first time.

The defining quality is not visual polish alone. It is the combination of:

> **clear next actions + visible evidence + honest uncertainty + safe AI assistance + recoverable errors.**

If every important interaction preserves those five qualities, Oppulse AI will feel less like a generic AI dashboard and more like a dependable partner that helps people turn opportunity research into accepted applications.
