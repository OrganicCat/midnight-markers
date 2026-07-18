# Filing-aware collection suggestions

**Date:** 2026-07-18
**Status:** Approved

## Problem

The AI tagging flow (`src/lib/ai/prompt.ts`) suggests a `collectionPath` for each
saved bookmark, but its guidance is thin: "reuse existing names where they fit;
otherwise propose a new path." The app runs on **Haiku**, a small model that, left
to its own devices, defaults to two bad habits:

1. **Over-general top folders** — dumping everything into junk drawers like
   `["Learning"]`, `["Entertainment"]`, `["Misc"]`.
2. **Format-not-topic grouping** — filing by media type (`["Videos", "Tutorials"]`,
   `["Articles"]`) instead of subject.
3. **Over-specific top folders** — a single narrow topic as its own top-level, e.g.
   `["Raspberry Pi"]` instead of `["Electronics", "Single-board computers"]`.

We want the model to file the way a careful person does: reuse a good existing fit,
nest a sub-folder when the fit is close-but-not-exact, and otherwise invent a path at
the right altitude.

## Scope

**Prompt-only.** The single `"collectionPath"` bullet in `SYSTEM_PROMPT` is rewritten.
No changes to types, parsing (`parse.ts`), suggestion assembly (`suggest.ts`), or
storage. The model already receives the full existing-collection hierarchy via
`buildMessages` (`existingCollections`, rendered top→leaf), so it has the context it
needs; this only changes *how* it chooses.

Rule-encoding style (decided during brainstorming): **principle + examples**, not a
hard blocklist and not code validation. A small model follows illustrated principles
better than rules it can't apply, and examples avoid drift between prompt and code.

## The rule

1. **Fit first** — check existing collections; if the page genuinely belongs to an
   existing path, reuse it verbatim (match capitalization).
2. **Close but not exact → nest** — if an existing collection is the right general
   area but not a precise fit, add a new sub-folder *under* it rather than forcing the
   poor fit or creating a new top-level.
3. **Right altitude** — otherwise invent a path, preferring **two levels**: a real
   topic domain as the top folder, a specific sub-folder as the leaf. Avoid
   over-general tops (`Learning`, `Entertainment`, `Misc`) and over-specific tops
   (`Raspberry Pi` → `Electronics > Single-board computers`). Never file by media
   format.
4. Unchanged: 1–3 elements (never more than 3); return `null` only when the page has
   no discernible topic (login screens, error pages, blank tabs).

## Examples baked into the prompt

- **Reuse:** existing `["Web Development", "CSS"]`, CSS-grid guide → `["Web Development", "CSS"]`.
- **Nest:** existing `["Web Development", "CSS"]`, Tailwind guide → `["Web Development", "Tailwind"]`.
- **Invent (good):** `["Electronics", "Single-board computers"]`, `["Cooking", "Sourdough"]`,
  `["Personal Finance", "Index investing"]`, `["Photography", "Lightroom"]`,
  `["Machine Learning", "Transformers"]`, `["Woodworking", "Hand tools"]`.
- **Bad — too general:** `["Learning"]`, `["Entertainment"]`, `["Misc"]`, `["Resources"]`.
- **Bad — format not topic:** `["Videos", "Tutorials"]`, `["Articles"]`; a YouTube
  soldering video is `["Electronics", "Soldering"]`.
- **Bad — too specific for a top folder:** `["Raspberry Pi"]` →
  `["Electronics", "Single-board computers"]`; `["React useState hook"]` →
  `["Web Development", "React"]`.

## Testing

Extend `tests/unit/ai/prompt.test.ts` with assertions that `buildMessages` output
carries the key filing directives (fit-first / nest / right-altitude / no-format), so
the rule can't silently regress. No behavioral test of Haiku itself — that's a model
property, not a unit-test property.
