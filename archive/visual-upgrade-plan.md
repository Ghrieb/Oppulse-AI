# Oppulse AI visual upgrade: implementation plan

## Visual direction from the reference

Treat the supplied screenshot as a design direction, not a pixel-perfect specification. It shows a calm, light workspace with a deep-navy navigation rail, muted lavender/indigo actions, cool-gray page surfaces, white content panels, restrained semantic status colors, and a consistent line-icon language. The Oppulse robot is a small recurring identity cue, not a large hero decoration. Use stronger page hierarchy and generous readable widths rather than repeating uniform cards.

The reference depicts five principal surfaces: Research Workspace, Monitoring & Alerts, Application Workspace, Opportunity Details, and Writing Studio. Their shared chrome should feel like one product, while each page should foreground its own task.

## Recommended implementation sequence

1. **Audit before changing code.** Map the routes, shared layout, UI primitives, data contracts, and current behaviors. Record which controls invoke real actions and which are still demo-only. Identify the current CSS/design system and test commands before choosing whether to extend or replace a component.
2. **Establish tokens and shared primitives.** Define color, typography, spacing, radius, border, shadow, focus-ring, and content-width tokens. Standardize the sidebar, page header, buttons, badges, tabs, cards, form controls, empty/error/loading states, and assistant identity. Keep status colors semantic and labels present so meaning never depends on color alone.
3. **Refine the Research Workspace.** Make the greeting, active mission, and next-best action compact. Use a 60/40 desktop workbench: conversation, discovery controls, and result list in the main column; selected opportunity details in the secondary column. Preserve full titles where possible, keep filters connected to real data, and place the composer within easy reach without covering content.
4. **Give Monitoring its own information hierarchy.** Lead with title and scheduled-monitoring explanation, then a compact data-derived summary, clear tabs, and aligned target rows. Keep source failures explicit and non-conclusive; retry only when the backend supports it. Show event source, detection time, significance, and next action together.
5. **Recompose Applications around completion tasks.** Put progress, verified deadline, missing documents, and next action into a compact summary. Use a primary requirements/document column and a secondary tasks/drafts/recommendations column. Each requirement should show its status, evidence/source, applicable date, and a real contextual action.
6. **Polish Opportunity Details and Writing Studio.** For opportunity details, order title/source, funding, fit, eligibility, requirements, evidence, and actions by importance. Label fit as relevance, not admission probability. For writing, preserve document/version context and make proposed edits reviewable and reversible; accept/reject must affect the actual draft workflow.
7. **Verify behavior and responsive states.** Test desktop, tablet, and narrow mobile layouts. Use a single-column mobile flow and an accessible detail route/sheet instead of shrinking the desktop workbench. Test keyboard navigation, visible focus, empty/loading/error states, pending/disabled controls, and failed-message retry that preserves the user's text. Confirm existing core interactions still work.

## Technical implementation guidance

- **Build on the current stack.** Reuse existing router, state/data-fetching layer, form validation, and component library where sound. Avoid a redesign that silently replaces working product behavior. Keep visual components presentational where practical and pass them explicit data/state/action props.
- **Use design tokens and shared variants.** Centralize tokens as CSS custom properties or the project's existing theme format. Define explicit button variants (primary, secondary, tertiary, destructive), compact semantic badges, and a small set of card layouts. Avoid per-screen one-off values and deeply nested cards.
- **Treat data states as first-class.** Model loading, success, partial/unverified, empty, error, and stale states explicitly. Derive summary counts from application data. Show progress or activity only when supported by actual backend events; do not simulate tool steps with timers. Keep cancellation conditional on real cancellation support.
- **Preserve evidence and uncertainty.** Represent verified facts, assumptions, unknowns, and source failures distinctly. Keep source URL and retrieval context attached to evidence where the current API contract permits. Never interpret a failed fetch as proof that a program closed.
- **Make actions honest and accessible.** Use native buttons/links, visible labels or accessible names, keyboard-operable tabs/menus, and textual statuses alongside color. Disable duplicate mutation submissions while pending. Announce asynchronous results and validation feedback with appropriate live regions. Decorative icons should be hidden from assistive technology; icon-only controls need an accessible label.
- **Use a consistent icon source.** Lucide supports React components that render inline SVG and can be tree-shaken; its official license is ISC, with some icons derived from Feather under MIT terms [1] [2]. Prefer package imports from the current dependency ecosystem rather than copying dozens of standalone SVGs into application source. The companion folder catalogs candidate icons and their source; the external SVG files could not be downloaded in this environment.
- **Use photography selectively.** Use a campus photo only for an actual institution/program context, with a source/creator and license record. Do not use an unrelated stock photo as if it represented the real university. The candidate is an Unsplash search result describing Amsterdam's Roeterseiland campus, but the image itself was not downloaded or independently verified [3] [4].
- **Create a bespoke mascot.** The target calls for a recognizable Oppulse robot. A generic stock illustration is not a durable brand identity. Create one master vector/illustration with a consistent silhouette, expressive screen/eyes, restrained indigo accent, and a few controlled variants (small avatar, neutral/working/error). Keep meaningful state changes tied to actual app state. unDraw's AI-agent illustration is a general illustration, not a matching mascot; its license permits project use but bars redistributing its assets as a pack, so it is intentionally not bundled here [5] [6].
- **Protect conversation continuity.** Keep mission/conversation state in the existing shared state or backend persistence layer, not component-local state that resets on navigation. Apply the project's privacy rules to unsent drafts. Preserve failed user input and offer retry/copy.
- **Add focused quality gates.** Run the repository's lint, typecheck, unit/component tests, and production build. Add or update tests for interactions altered by the redesign. Capture comparable screenshots for the five reference surfaces at desktop and mobile sizes and inspect for overflow, truncation, and visual regressions.

## Definition-of-done checklist

- The home/research page uses a readable two-column desktop workbench and a genuinely single-column mobile flow.
- Monitoring and application pages each have a distinct, task-appropriate hierarchy.
- Shared controls have consistent dimensions, variants, focus/disabled/loading states, and accessible labels.
- Titles and source details are not clipped unnecessarily; unverified information is not presented as verified.
- Every visible action either performs its real action or is clearly disabled/unavailable with an explanation.
- Assistant identity and activity remain consistent, and activity reflects actual backend state only.
- Existing product interactions pass the repository's quality gates, with before/after screenshots captured for review.

## Asset folder notes

The companion `visual-upgrade-assets` folder contains an original editable SVG starter pack: an Oppulse-style robot avatar, decorative background accents, and five small icons. External stock files could not be downloaded from this machine, so the bundled files are locally created rather than third-party assets. See `ASSET_NOTES.md` for inventory and integration guidance.

## References

[1]: https://lucide.dev/guide/react/ "Lucide for React"
[2]: https://lucide.dev/license "Lucide license"
[3]: https://unsplash.com/photos/a-building-next-to-a-body-of-water-8LFngUN4_Sw "Amsterdam university campus photo result"
[4]: https://unsplash.com/license "Unsplash license"
[5]: https://undraw.co/illustration/ai-agent_pdkp "unDraw AI Agent illustration"
[6]: https://undraw.co/license "unDraw license"
