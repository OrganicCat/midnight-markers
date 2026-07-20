# AI Resort — bulk reorganization with preview

Date: 2026-07-20

## Problem

Bookmarks accumulate in the wrong folders. The filing-aware AI suggestion system
(`src/lib/ai/prompt.ts`, added 2026-07-18) files bookmarks well *at save time*, but
there is no way to apply that judgment retroactively to a library that grew before it
existed — or to a messy tree imported from native browser bookmarks.

## Goal

A "Resort" action that re-plans the organization of either one folder's subtree or the
entire library, shows the proposed result as a reviewable tree, and applies only the
changes the user accepts — with a one-click undo.

## Scope

Full reorganize. The planner may:

- move bookmarks between folders
- create new folders
- rename existing folders
- merge near-duplicate folders
- delete folders left empty by the above

Tags are out of scope. Bookmark titles are out of scope. Both remain the job of the
per-bookmark save flow.

## Architecture

```
src/lib/ai/resort/
  types.ts       ResortScope, Skeleton, FilingResult, ResortPlan, Change
  skeleton.ts    buildSkeletonMessages() — pass 1 prompt
  filing.ts      buildFilingMessages()   — pass 2 prompt
  planner.ts     runResort() — orchestrates both passes, emits progress
  diff.ts        planToChanges() — pure: current tree + plan → Change[]
  apply.ts       applyChanges() — snapshot, then mutate
src/lib/storage/snapshot.ts       save/restore/clear one undo snapshot
src/newtab/ResortDialog.svelte    overlay: progress → preview → apply
src/newtab/ResortTree.svelte      annotated tree with per-node toggles
```

Existing code is reused, not modified: `collections.listWithPaths()` for prompt
context, `collections.resolvePath()` to materialize new paths at apply time,
`chatComplete()` + `parseModelJSON()` for the API, `classifyError()`/`reasonMessage()`
from `suggest.ts` for error text, `storageEvents.emit()` to refresh open pages.
`prompt.ts` and `suggest.ts` are untouched — the single-bookmark save path keeps
working exactly as it does today.

## Entry points

- A `✦ Resort` button in `src/newtab/Toolbar.svelte`, next to `+ Collection`. Scope
  follows the current sidebar selection: `{kind:'all'}` → the whole library,
  `{kind:'collection', id}` → that collection and its descendants. Under a smart
  filter or tag selection the button is disabled with a title explaining why.
- A right-click context menu on sidebar collection rows with a single "Resort this
  folder" item, opening the same dialog scoped to that collection.

## AI passes

### Pass 1 — skeleton (one call)

Input: every folder path in scope rendered `A > B > C`, one per line (same rendering
as the existing prompt), plus an evenly-sampled set of at most 200 bookmarks rendered
`title — domain — current path`. Sampling is round-robin across folders so no single
large folder dominates the sample.

Output:

```json
{
  "folders": ["Design > Typography", "Dev > Rust"],
  "renames": [{ "from": ["Stuff"], "to": "Reference" }],
  "merges":  [{ "from": ["Web Dev"], "into": ["Dev"] }]
}
```

`folders` is the complete proposed folder set (the skeleton). `renames` map an
existing path to a new *leaf name*. `merges` fold one existing path into another.

The system prompt inherits the filing doctrine already proven in `SYSTEM_PROMPT`:
fit-first reuse, prefer two levels, never deeper than 3, and the existing AVOID lists
(junk-drawer names `Learning`/`Entertainment`/`Misc`/`Resources`, media-format folders,
over-specific top levels). It adds whole-library guidance: fold near-duplicate folders
together, and do not invent a folder that would hold fewer than 3 bookmarks.

### Pass 2 — filing (batched)

Bookmarks are batched at 100 per call, run with concurrency 2. Every call receives the
*full* skeleton — this is what keeps batches consistent with each other — plus its
batch rendered `id — title — domain — current path`.

Output:

```json
[{ "id": "01J...", "path": ["Dev", "Rust"] }]
```

A returned path that is not in the skeleton is rejected and the bookmark is left where
it is. This prevents batch 3 from inventing folders batch 1 never saw.

### Limits and failure

- Both passes clamp returned paths to `MAX_COLLECTION_DEPTH = 3` client-side.
- Hard cap of 5000 bookmarks in scope. Above that the dialog refuses to run and
  suggests resorting a subfolder instead.
- A failed batch retries once. Bookmarks in a still-failing batch are reported in the
  preview as "N bookmarks couldn't be planned — left where they are" and do not block
  applying the rest.
- Skeleton failure aborts the run and shows the existing `reasonMessage()` text for the
  `SuggestFailReason`.
- The whole run is cancellable; cancelling aborts in-flight requests via `AbortSignal`.

## Change set

`planToChanges(currentTree, plan)` is pure and fully unit-testable. It returns a sorted
`Change[]`:

| kind | payload |
| --- | --- |
| `folder-new` | `path: string[]` |
| `folder-rename` | `id`, `from: string`, `to: string` |
| `folder-merge` | `sourceId`, `targetPath: string[]` |
| `folder-delete` | `id` — emitted only when the folder is empty after all accepted moves |
| `bookmark-move` | `id`, `fromPath: string[]`, `toPath: string[]` |

No-op moves (target equals current path) are dropped, so the preview only ever shows
real changes.

## Preview UI

A full-screen overlay — the app's first modal — using the existing settings-card
vocabulary (`rounded-xl border border-white/10 bg-white/[0.02]`), a blurred backdrop,
Escape to close, and a focus trap.

States: `planning` (progress: "Planning folders…", then "Filing 300 of 812…", with a
Cancel button) → `preview` → `applying` → closed.

The body renders the **proposed** tree, not a side-by-side diff. Each folder node
carries a badge — `new`, `renamed from X`, `merged from Y`, `will be deleted` — and
each bookmark row shows its origin as dim `← Old > Path`. Every changed row has a
checkbox, default checked. Unchecking a folder cascades: its badge reverts and every
bookmark move targeting it is unchecked too. Folders and bookmarks with no proposed
change render collapsed and dimmed, without checkboxes, for orientation.

The header shows a live count (`142 of 168 changes selected`). The footer is `Cancel`
and `Apply 142 changes`.

## Apply and undo

`applyChanges(accepted)` runs in order:

1. Write the undo snapshot.
2. Apply accepted renames (`collections.update`).
3. Apply accepted merges — move the source's children and bookmarks to the target,
   then delete the source.
4. `collections.resolvePath()` for every accepted new path, materializing folders.
5. Update `collectionId` on every accepted bookmark move.
6. Delete folders left empty, for accepted `folder-delete` changes.
7. Emit `collections:changed` and `bookmarks:changed` once, at the end.

### Snapshot

A new `snapshots` IndexedDB object store, added by bumping `DB_VERSION` from 1 to 2 in
an additive upgrade that leaves existing stores untouched. It holds a single record:

```ts
{
  id: 'last-resort',
  createdAt: number,
  collections: Collection[],                       // full tree, verbatim
  bookmarkAssignments: { id: string; collectionId: string | null }[]
}
```

One slot, overwritten by each resort. Restore rewrites the collections store wholesale
and reassigns every recorded bookmark, then clears the slot.

Undo is offered two ways: a toast in the newtab for 30 seconds after applying, and a
"Restore last resort" button in Settings → Data that stays available until the next
resort overwrites the snapshot.

## Testing

Pure logic, unit tested with vitest per existing idiom:

- skeleton and filing prompt builders, including a regression assertion that the filing
  doctrine text survives edits (mirroring the existing guard in
  `tests/unit/ai/prompt.test.ts`)
- depth clamping and rejection of off-skeleton paths
- batching (sizes, remainder batch, empty input)
- `planToChanges` for every change kind and the no-op filter
- toggle-cascade logic

Against `fake-indexeddb`, using the existing `_resetDbForTests()` idiom:

- `apply.ts` for each change kind
- `snapshot.ts` save/restore round-trip
- a full apply → undo round-trip asserting exact restoration of tree and assignments

Component and integration:

- `ResortTree` cascade behavior via `@testing-library/svelte`
- `planner.ts` with a stubbed `fetch` per the existing AI test idiom, covering batch
  retry, partial failure, and cancellation

## Non-goals

- Retagging or retitling during resort.
- Chunked *skeleton* planning — the skeleton is always one call. Only filing is
  batched.
- Multiple undo history. One snapshot slot.
- Scheduled or automatic resorting.
