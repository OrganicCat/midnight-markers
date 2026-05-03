# midnight-markers — Design

**Date:** 2026-05-03
**Status:** Approved (brainstorm), pending implementation plan

## Overview

A bookmark-management browser extension for Brave and Chrome (Manifest V3). Replaces the new-tab page with a polished, dark-themed bookmark library and adds a toolbar popup for fast saving. Local-first storage (no backend), with optional AI-powered tag/title/collection suggestions via OpenRouter using a user-supplied API key.

Visual inspiration: Raindrop.io (card grid), mymind (calm dark aesthetic), Anybox (sidebar + density toggle).

## Goals

- Fast, beautiful, dark-themed bookmark library that feels at home on every new tab.
- One-tap save flow with optional AI assistance (title rewrite, tag suggestion, collection routing).
- Local-only storage — no account, no backend, no telemetry.
- Coexists with native browser bookmarks; doesn't try to replace them.
- Provider-agnostic AI through OpenRouter — bring-your-own-key, swap models freely.

## Non-Goals

- Cloud sync, multi-device sync, account system. (Possible future sub-project; out of scope here.)
- Saving non-link content (images, notes, highlights, video clips). Web links only.
- Full-text search over page content. Search is over title / URL / tags / notes.
- Replacing the browser's native bookmark store. We coexist; one-time optional import.
- A mobile companion. Desktop browser extension only.

## Surfaces

Two primary UI surfaces, plus a settings page.

### 1. New Tab page (`chrome_url_overrides.newtab`)

The library. Replaces the default new-tab page. Layout:

- **Left sidebar** (~200px): brand mark · Library section (All / Unread / Starred) · Collections (nested folders) · Tags section. Each entry shows count.
- **Main area**: search input · view toggle (grid / list) · current-view title with metadata · the bookmark list itself.

Two view modes, toggle in toolbar:
- **Grid** (default) — uniform cards, 3-5 per row, rich thumbnail. Raindrop-feel.
- **List** — dense rows: favicon · title + domain · tags · date. Anybox-feel power-user view.

### 2. Toolbar popup (`action.default_popup`)

Save flow. Click toolbar icon on any page → popup appears anchored to icon.

Behavior:
- Bookmark is **created instantly** on click (so closing the popup still saves).
- Popup is the *editor* for the just-created bookmark: collection, tags, star toggle, optional note.
- If AI is enabled, an async banner pulses while the request is in flight, then renders:
  - A suggested title (one-tap "use" to swap; original always recoverable).
  - Tag pill suggestions (existing tags marked ✦, new tags marked +, max 2 new).
  - A suggested collection.
- ⌘Z while popup is open undoes the save entirely.

### 3. Settings page (extension page, opened from sidebar gear icon)

- AI provider section: OpenRouter (active), with disabled/placeholder rows for direct Anthropic / OpenAI / Local labeled "(soon)" — these may stay disabled forever; they exist to set expectations, not to lock us into delivering them.
- API key input (masked, with Test connection / Change / Remove buttons), connection status, last-used timestamp, model picker (defaults to `anthropic/claude-haiku-4.5`).
- AI feature toggles: suggest tags / suggest title / suggest collection (each independent).
- Privacy disclosure block — exact list of what's sent to OpenRouter per save.
- Import / export: JSON export of full database; JSON import (merge); one-time import from native browser bookmarks.

## Visual Design

- **Theme**: dark only. Background `#0b0c14` → `#14172a` gradient on new-tab; popup/settings on `#0d0e15`.
- **Accent**: blue/violet (`#8b9bff` → `#bd93f9` gradient). Secondary accent: teal (`#6fe6cf`) for status/success.
- **Typography**: system UI stack. Tight tracking on titles (`-0.02em`).
- **Cards**: subtle 1px border (`rgba(255,255,255,0.05)`), `rgba(255,255,255,0.03)` fill, 8px radius.
- **Density**: comfortable in grid; tight in list. List view is for finding things, not browsing.
- **Motion**: 200ms ease for hovers and toggles. AI "thinking" banner pulses.

## Data Model

All persisted in IndexedDB. Single database, multiple object stores.

### `bookmarks`

```ts
type Bookmark = {
  id: string;              // ULID
  url: string;             // canonical URL
  title: string;           // current display title (may be AI-rewritten)
  originalTitle: string;   // page's original <title>; never overwritten
  domain: string;          // extracted from URL, indexed
  faviconUrl: string | null;
  thumbnailUrl: string | null;     // og:image, or data: URL from screenshot
  description: string | null;      // og:description / meta description
  excerpt: string | null;          // ~500 chars of main content (used for AI + search)
  collectionId: string | null;     // null = uncategorized / inbox
  tagIds: string[];
  starred: boolean;
  unread: boolean;                 // defaults true on save
  note: string | null;             // user note
  createdAt: number;
  updatedAt: number;
  lastCheckedAt: number | null;    // for broken-link smart filter
  isBroken: boolean;
};
```

### `collections`

```ts
type Collection = {
  id: string;
  name: string;
  parentId: string | null;   // for nesting
  color: string;             // hex; auto-assigned from a 12-color palette on creation, user-editable
  sortOrder: number;
  createdAt: number;
};
```

### `tags`

```ts
type Tag = {
  id: string;
  name: string;              // unique, lowercased
  count: number;             // denormalized usage count for sidebar
};
```

### `settings`

Single-row key-value store: `aiKey` (OpenRouter), `aiModel` (e.g. `anthropic/claude-haiku-4.5`), `aiFeatures: { tags, title, collection }`, `defaultView: 'grid' | 'list'`, `defaultCollectionId`. No `aiProvider` field — provider is implicit (OpenRouter only). If we ever add direct providers, that's a separate migration.

## Architecture

Module boundaries — each is independently testable and replaceable.

### `src/storage/`

IndexedDB wrapper around the four stores. Public API:

- `bookmarks.create(input) -> Bookmark`
- `bookmarks.update(id, patch) -> Bookmark`
- `bookmarks.delete(id) -> void`
- `bookmarks.list(filter) -> Bookmark[]` where `filter` is `{ collectionId?, tagId?, smart?: 'unread'|'starred'|'untagged'|'broken'|'recent', search? }`
- `collections.*`, `tags.*`, `settings.get/set` similar.

Internally uses [`idb`](https://github.com/jakearchibald/idb) for promise-based IDB. Storage layer emits change events on a tiny pub-sub for the UI to subscribe to.

### `src/metadata/`

Extracts page metadata. Two modes:

- **Active-tab extract** (called from popup): runs a content script in the active tab, scrapes `<title>`, `<meta name="description">`, `<meta property="og:image">`, favicon `<link>`, and ~500 chars of main text via Mozilla's [Readability](https://github.com/mozilla/readability).
- **Thumbnail fallback**: if no `og:image`, calls `chrome.tabs.captureVisibleTab()` and stores the result as a data URL (capped at ~100KB after compression to JPEG).

### `src/ai/`

OpenRouter client. Stateless. Single function:

```ts
async function suggestForBookmark(input: {
  title: string;
  url: string;
  description: string | null;
  excerpt: string | null;
  existingTags: string[];
  existingCollections: { id: string; name: string }[];
}): Promise<{
  suggestedTitle: string | null;
  suggestedTags: { name: string; isNew: boolean }[];
  suggestedCollectionId: string | null;
} | null>
```

- Reads key + model from settings on each call. Returns `null` if no key configured.
- Calls `https://openrouter.ai/api/v1/chat/completions` with JSON-mode prompt that returns the structured object directly.
- Prompt instructs: prefer existing tags; allow up to 2 new tags max; pick from existing collections; rewrite title only if it's significantly clearer.
- Times out at 10s. Catches network errors and returns `null` — popup degrades gracefully.

### `src/search/`

In-memory fuzzy index. Wraps [MiniSearch](https://github.com/lucaong/minisearch). Indexes title, domain, tags, note. Rebuilt on storage change events. Returns ranked bookmark IDs.

### `src/ui/library/` (Svelte app)

The new-tab page. Mounts at `newtab.html`. Components:

- `App.svelte` — shell, theme, keyboard shortcuts.
- `Sidebar.svelte` — collections, tags, smart filters.
- `Toolbar.svelte` — search, view toggle.
- `BookmarkGrid.svelte` / `BookmarkList.svelte` — the two view modes.
- `BookmarkCard.svelte` / `BookmarkRow.svelte` — single-item components with hover actions (star, edit, delete).

Drag-and-drop via [svelte-dnd-action](https://github.com/isaacHagoel/svelte-dnd-action) for moving bookmarks into collections and reordering.

### `src/ui/popup/` (Svelte app)

The toolbar popup. Mounts at `popup.html`. Components:

- `App.svelte` — orchestrates the save flow.
- `AIBanner.svelte` — pulsing while in flight, replaced by suggestions when ready.
- `TagPicker.svelte` — autocomplete from existing tags + AI-suggested pills.
- `CollectionPicker.svelte` — dropdown of collections, AI-suggested highlighted.

### `src/ui/settings/` (Svelte app)

Mounts at `settings.html`. Provider/key management, feature toggles, import/export. Plain forms; no surprises.

### `src/background/`

Manifest V3 service worker. Responsibilities:

- Toolbar click → open popup (declarative; minimal code).
- Periodic alarm (`chrome.alarms`, daily): re-check bookmarks for broken links, update `isBroken` and `lastCheckedAt`. Throttled to 30 HEAD requests/minute, oldest `lastCheckedAt` first, with a 7-day cool-down per URL.
- Import job runner: native bookmarks import streams in batches and writes via storage layer.

## Save Flow (end-to-end)

The popup runs in the extension's popup context (full DOM, can call `chrome.*` APIs and open IDB directly).

1. User clicks the toolbar icon. The browser opens the popup.
2. Popup mounts. On mount, in parallel:
   a. Injects content script via `chrome.scripting.executeScript` into the active tab to extract metadata (title, description, og:image, excerpt). Falls back to `chrome.tabs.captureVisibleTab` if no og:image.
   b. Generates ULID, computes domain.
   c. Writes the bookmark via the storage layer (IDB) with `unread: true`, `collectionId: null`, and a transient `pending: true` flag in component state for undo.
3. Popup renders the bookmark immediately (favicon, title, domain).
4. If AI is enabled and a key is set: popup calls `ai.suggestForBookmark(...)`. Banner pulses while in flight.
5. AI returns (or times out at 10s, or returns `null` if no key). Popup renders suggestions inline. User accepts/rejects each independently.
6. User edits collection / tags / star / note. Each change writes via `bookmarks.update()` immediately (no save button needed).
7. User closes popup. Bookmark persists.
8. ⌘Z within the popup, or clicking the toast on the new-tab page within 10s, calls `bookmarks.delete(id)` to fully undo (including any updates made during step 6).

## Smart Filters

Computed views over the bookmark store. Not stored.

- **Recent** — created within last 7 days, sorted desc.
- **Unread** — `unread: true`, sorted by createdAt desc.
- **Starred** — `starred: true`.
- **Untagged** — `tagIds.length === 0`.
- **Broken** — `isBroken: true` (set by background link checker).

## Keyboard Shortcuts

In the new-tab library:
- `⌘K` / `Ctrl+K` — focus search.
- `J` / `K` — next / previous bookmark.
- `↵` — open selected.
- `⌘E` — edit selected (opens inline editor).
- `⌫` — delete selected (with undo toast).
- `S` — toggle star.
- `1` / `2` — switch grid / list.

In the popup:
- `⌘Z` — undo save.
- `⌘↵` — close (already saved).

## Privacy & Security

- All bookmark data stays on-device in IndexedDB.
- API key in `chrome.storage.local` — unencrypted at rest, as is standard for browser extensions. Disclosed in settings UI.
- AI requests go directly from the user's browser to OpenRouter (`https://openrouter.ai/api/v1/chat/completions`). Each request includes: page title, URL, meta description, up to 500 chars of main content, the user's existing tags, and existing collection names. No request body is logged or persisted by the extension.
- Settings page contains a verbatim copy of what is sent.

## Tech Stack

- **Language**: TypeScript (strict).
- **Framework**: Svelte 5 (runes mode).
- **Styling**: Tailwind CSS 4.
- **Build**: Vite + `vite-plugin-web-extension` (Manifest V3 cross-browser).
- **Storage**: `idb` (IndexedDB wrapper).
- **Search**: `minisearch`.
- **Readability**: `@mozilla/readability` for content extraction.
- **DnD**: `svelte-dnd-action`.
- **HTTP**: native `fetch`.
- **Lint/format**: ESLint + Prettier.
- **Tests**: Vitest (unit), Playwright (e2e for the popup and new-tab pages).

## Distribution

- **Chrome Web Store** as the primary channel (works for Brave too).
- Manifest V3, with permissions: `storage`, `tabs`, `activeTab`, `alarms`, `bookmarks` (for one-time import), and host permission for `https://openrouter.ai/*`.
- No host permissions for arbitrary sites — content script is injected via `activeTab` only on toolbar click.

## Open Questions

None blocking. Known follow-ups for future sub-projects:

- Cloud sync (separate spec).
- Direct Anthropic / OpenAI / local-LLM providers (only if OpenRouter proves insufficient).
- Highlights / annotations on bookmarked pages.
- Mobile companion / sync.
