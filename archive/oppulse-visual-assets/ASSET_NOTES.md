# Oppulse AI visual asset starter pack

This folder now contains **eight editable SVG binaries** created locally for the Oppulse visual direction. They are original starter assets, not downloaded third-party files. Public web/file hosts could not be reached from this Windows execution environment (TLS credential/network failure), and no external image-generation credits were used.

## Inventory

- `robots/oppulse-robot-avatar.svg` — 256×256 robot profile/avatar with rounded shell, expressive cyan eyes, navy face screen, and indigo accents. Use as a scalable starting identity; refine the details to match product branding.
- `decor/sparkle-orbit.svg` — small transparent sparkle/orbit overlay for subtle workspace decoration.
- `decor/workspace-banner.svg` — wide, soft gradient abstract banner/background. Keep it behind content, never as a substitute for useful information.
- `icons/sparkles.svg` — assistant/AI visual cue.
- `icons/clock-activity.svg` — time/activity indicator.
- `icons/task-check.svg` — task completion/checklist cue.
- `icons/reply.svg` — response/retry/reply action.
- `icons/focus.svg` — focus/target-like decorative status cue.

All SVGs use `currentColor` for stroke icons where suitable, so the app can theme them with CSS. Decorative artwork should be `aria-hidden="true"`; controls that use icon-only buttons need accessible labels. Do not use the clock icon to imply running work unless the backend reports an active task.

## External sources to consider later

The earlier curation identified [Lucide React](https://lucide.dev/guide/react/) for a consistent production icon set and its [license](https://lucide.dev/license). It also identified a generic [unDraw AI-agent illustration](https://undraw.co/illustration/ai-agent_pdkp), which is optional and not required because the local avatar is included. External assets were not fetched, so no third-party image or SVG is bundled and no external license/attribution is implied for the local SVGs.

## Integration suggestions

Use `robots/oppulse-robot-avatar.svg` for the assistant avatar across research, opportunity analysis, writing, alerts, and clarification/error states. Keep it visually consistent and small. For loading/working variants, prefer a CSS ring or subtle motion around this same avatar only when a real backend activity state is active. Keep `workspace-banner.svg` as optional decorative art with a low visual weight. The small icons are starter motifs; use the project's existing icon library if it already has a standard icon system rather than mixing icon families.
