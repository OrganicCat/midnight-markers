# Guided tour and Help panel — design

Date: 2026-07-21

## Goal

A new user opening the new tab page for the first time sees a bookmark library
with no explanation of what the smart filters are, what ✦ Resort does, or that
AI is off until they opt in. Give them a step-by-step walkthrough that dims the
page and spotlights one control at a time, and a Help button that both explains
the app in prose and can replay that walkthrough later.

## Decisions

| Question | Choice |
| --- | --- |
| What the Help button opens | A modal with prose sections, the keyboard cheat sheet, and a "Replay guided tour" button |
| Tour scope | New tab page only. The popup closes on blur, so a spotlight cannot follow the user into it; the popup and Settings are described in prose instead |
| Auto-run | Once, on the first new tab, with a visible Skip |
| Overlay | Hand-rolled Svelte component — no new dependency, no MV3 CSP question, matches the midnight theme |

## Components

- `src/newtab/tour/steps.ts` — the tour as data. Each step names a target by
  `data-tour` value, or `null` for a centered card. Prose and ordering live
  here and nowhere else.
- `src/newtab/tour/geometry.ts` — pure functions: `inflate` (spotlight padding),
  `placeTooltip` (preferred side, then opposite, then the rest, then clamp),
  `centerTooltip`. No DOM access, so it is directly unit-testable.
- `src/newtab/tour/tour.svelte.ts` — the state machine. Owns which step is
  showing; `start()` resolves targets against the live DOM so a step pointing
  at something absent (no bookmarks yet) is dropped rather than spotlighting
  empty space. `end()` is the single exit for Done, Skip and Esc.
- `src/newtab/tour/Spotlight.svelte` — the overlay: an SVG mask cuts a rounded
  hole out of a dimming rect, a violet stroke rings the hole, and the card is
  placed beside it. Owns the keyboard (←/→/Enter/Esc) in the capture phase so
  the page's own j/k/s/⌫ shortcuts don't fire underneath.
- `src/newtab/HelpDialog.svelte` — prose sections (Saving, Organising, AI,
  Backups) plus the cheat sheet from `tour/shortcuts.ts`, with the replay
  button pinned in a non-scrolling footer.

Targets are `data-tour` attributes on the existing Sidebar, Toolbar and results
markup. Nothing was restructured to accommodate them.

## Persistence

`Settings.tourSeenAt: number | null`. Null is the one and only condition for
auto-running. It is written when the tour **opens**, not when it closes:
otherwise a user who skips and immediately closes the tab loses the write and
gets ambushed by the same walkthrough on their next new tab.

## Bugs found and fixed along the way

- **`settings.set()` clobbered concurrent writes.** It was an unserialized
  read-modify-write: two overlapping callers each read the same "current" and
  the second `put()` silently dropped the first one's field. The new tab page
  writes `defaultView` and `tourSeenAt` within the same frame, which made this
  reproducible. Writes are now serialized through a promise chain, with a
  regression test that fails against the old implementation.
- **Plain `K` did not move the selection up**, despite the README claiming
  `J/K or ↑/↓ navigate` — the `k` case only fired with a modifier, to focus
  search. Now `⌘K`/`Ctrl-K` focuses search and bare `K` moves up.

## Testing

- Unit: geometry placement and clamping; the state machine (target resolution,
  bounds, single-fire end, re-resolution across runs); Spotlight rendering and
  keyboard; HelpDialog contents; the settings concurrency regression.
- E2E (Playwright, needs a head): first visit auto-runs the tour, stepping
  forward and back works, Skip persists, a reload does not re-run it, the Help
  button reopens and replays it, Esc closes it.
