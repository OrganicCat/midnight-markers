# midnight-markers — Plan 3: Polish & advanced features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the spec — list view toggle, drag-and-drop, native bookmarks import, JSON export/import, broken-link checker, keyboard shortcuts, MiniSearch, missing smart-filter UI, real icons, README.

**Architecture:** Each feature lands in its own focused module. Search migrates from substring filter to a `MiniSearch` index that listens to storage events. DnD uses `svelte-dnd-action` (already in scope). Native import reads `chrome.bookmarks.getTree()` recursively and feeds the existing `bookmarks.create()`. Broken-link checker runs in the service worker on a daily `chrome.alarms` tick.

**Tech Stack:** Same as Plans 1+2. New deps: `minisearch`, `svelte-dnd-action`.

**Reference spec:** `docs/superpowers/specs/2026-05-03-midnight-markers-design.md`

**Prerequisites:** Plans 1 & 2 complete. Verify: `git tag` shows `plan-1-mvp` and `plan-2-ai`. `npm test` reports 60 passing. `npm run check` reports 0 errors.

---

## File Structure (Plan 3)

```
midnight-markers/
├── package.json                              # MODIFY: add minisearch, svelte-dnd-action
├── src/
│   ├── lib/
│   │   ├── search/
│   │   │   └── index.ts                      # NEW: MiniSearch wrapper
│   │   ├── storage/
│   │   │   ├── exportImport.ts               # NEW: JSON serialize/deserialize
│   │   │   └── bookmarks.ts                  # MODIFY: substring → optional, search via index
│   │   └── native/
│   │       └── importBookmarks.ts            # NEW: Chrome bookmarks tree → flat list
│   ├── newtab/
│   │   ├── App.svelte                        # MODIFY: keyboard shortcuts + view switching + DnD
│   │   ├── BookmarkGrid.svelte               # MODIFY: dnd source
│   │   ├── BookmarkList.svelte               # NEW: dense list view
│   │   ├── Sidebar.svelte                    # MODIFY: untagged/broken filters + DnD target
│   │   └── Toolbar.svelte                    # MODIFY: view toggle buttons
│   ├── settings/
│   │   ├── App.svelte                        # MODIFY: integrate Data section
│   │   └── DataSection.svelte                # NEW: import/export/native bookmarks UI
│   ├── background/
│   │   ├── service-worker.ts                 # MODIFY: alarm + handler
│   │   └── brokenLinks.ts                    # NEW: HEAD-check logic
│   └── icons/                                # NEW: real PNGs (replace 1×1 placeholders)
└── tests/
    └── unit/
        ├── search/
        │   └── index.test.ts                 # NEW
        ├── storage/
        │   └── exportImport.test.ts          # NEW
        ├── native/
        │   └── importBookmarks.test.ts       # NEW
        └── background/
            └── brokenLinks.test.ts           # NEW
```

---

## Task 1: Install dependencies

**Files:** `package.json` (modify), `package-lock.json` (modify)

- [ ] **Step 1: Install**

```bash
npm install minisearch svelte-dnd-action
```

Expected: both packages added to `dependencies`. No vulnerabilities in runtime deps (`npm audit --omit=dev` should still report 0).

- [ ] **Step 2: Verify**

```bash
npm test
```

Expected: 60 passing — new packages don't break the existing suite.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add minisearch and svelte-dnd-action

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: MiniSearch index

**Files:**
- Create: `src/lib/search/index.ts`, `tests/unit/search/index.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/search/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildIndex, searchIds } from '$lib/search/index';
import type { Bookmark } from '$lib/types';

function bm(over: Partial<Bookmark>): Bookmark {
  return {
    id: 'X',
    url: 'https://x',
    title: 'X',
    originalTitle: 'X',
    domain: 'x',
    faviconUrl: null,
    thumbnailUrl: null,
    description: null,
    excerpt: null,
    collectionId: null,
    tagIds: [],
    starred: false,
    unread: false,
    note: null,
    createdAt: 0,
    updatedAt: 0,
    lastCheckedAt: null,
    isBroken: false,
    ...over,
  };
}

describe('search index', () => {
  it('matches by title', () => {
    const idx = buildIndex([
      bm({ id: 'A', title: 'Type theory primer' }),
      bm({ id: 'B', title: 'Async Rust patterns' }),
    ]);
    expect(searchIds(idx, 'type')).toEqual(['A']);
    expect(searchIds(idx, 'rust')).toEqual(['B']);
  });

  it('matches by domain', () => {
    const idx = buildIndex([
      bm({ id: 'A', title: 'X', domain: 'fly.io' }),
      bm({ id: 'B', title: 'Y', domain: 'github.com' }),
    ]);
    expect(searchIds(idx, 'fly')).toEqual(['A']);
  });

  it('matches by note', () => {
    const idx = buildIndex([
      bm({ id: 'A', title: 'X', note: 'great essay on hyperloop scaling' }),
    ]);
    expect(searchIds(idx, 'hyperloop')).toEqual(['A']);
  });

  it('returns empty array for empty query', () => {
    const idx = buildIndex([bm({ id: 'A', title: 'foo' })]);
    expect(searchIds(idx, '')).toEqual([]);
  });

  it('is fuzzy — handles small typos', () => {
    const idx = buildIndex([bm({ id: 'A', title: 'Designing for the long now' })]);
    const results = searchIds(idx, 'desingn');
    expect(results).toContain('A');
  });

  it('is prefix — partial words match', () => {
    const idx = buildIndex([bm({ id: 'A', title: 'webdevelopment' })]);
    expect(searchIds(idx, 'webdev')).toContain('A');
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- tests/unit/search/index.test.ts
```

Expected: fails on missing module.

- [ ] **Step 3: Implement**

`src/lib/search/index.ts`:

```ts
import MiniSearch from 'minisearch';
import type { Bookmark } from '$lib/types';

export type SearchIndex = MiniSearch<Bookmark>;

export function buildIndex(items: Bookmark[]): SearchIndex {
  const idx = new MiniSearch<Bookmark>({
    fields: ['title', 'domain', 'url', 'note'],
    storeFields: ['id'],
    idField: 'id',
    searchOptions: { fuzzy: 0.2, prefix: true, boost: { title: 2 } },
  });
  idx.addAll(items.map((b) => ({ ...b, note: b.note ?? '' })));
  return idx;
}

export function searchIds(idx: SearchIndex, query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  return idx.search(q).map((r) => r.id as string);
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- tests/unit/search/index.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/search/index.ts tests/unit/search/index.test.ts
git commit -m "feat(search): MiniSearch-based fuzzy/prefix index over title/domain/url/note

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire search index into newtab App

**Files:**
- Modify: `src/newtab/App.svelte`

- [ ] **Step 1: Read current**

```bash
cat src/newtab/App.svelte
```

- [ ] **Step 2: Replace App.svelte**

Replace `src/newtab/App.svelte` with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar, { type Selection } from './Sidebar.svelte';
  import Toolbar from './Toolbar.svelte';
  import BookmarkGrid from './BookmarkGrid.svelte';
  import { bookmarks } from '$lib/storage/bookmarks';
  import { collections as colStore } from '$lib/storage/collections';
  import { tags as tagsStore } from '$lib/storage/tags';
  import { storageEvents } from '$lib/storage/events';
  import { buildIndex, searchIds, type SearchIndex } from '$lib/search/index';
  import type { Bookmark, Collection, Tag } from '$lib/types';

  let selection = $state<Selection>({ kind: 'all' });
  let search = $state('');
  let collections = $state<Collection[]>([]);
  let tags = $state<Tag[]>([]);
  let allBookmarks = $state<Bookmark[]>([]);
  let index = $state<SearchIndex | null>(null);
  let items = $state<Bookmark[]>([]);

  async function loadData() {
    [collections, tags, allBookmarks] = await Promise.all([
      colStore.list(),
      tagsStore.list(),
      bookmarks.list({}),
    ]);
    index = buildIndex(allBookmarks);
  }

  $effect(() => {
    if (!index) {
      items = [];
      return;
    }
    let pool = allBookmarks;

    if (selection.kind === 'smart') {
      const smart = selection.smart;
      pool = pool.filter((b) => {
        switch (smart) {
          case 'recent': return b.createdAt >= Date.now() - 7 * 24 * 60 * 60 * 1000;
          case 'unread': return b.unread;
          case 'starred': return b.starred;
          case 'untagged': return b.tagIds.length === 0;
          case 'broken': return b.isBroken;
        }
      });
    } else if (selection.kind === 'collection') {
      const id = selection.id;
      pool = pool.filter((b) => b.collectionId === id);
    } else if (selection.kind === 'tag') {
      const id = selection.id;
      pool = pool.filter((b) => b.tagIds.includes(id));
    }

    if (search.trim()) {
      const matchingIds = new Set(searchIds(index, search));
      pool = pool.filter((b) => matchingIds.has(b.id));
    }

    items = [...pool].sort((a, b) => b.createdAt - a.createdAt);
  });

  onMount(() => {
    loadData();
    const sub = () => loadData();
    storageEvents.on('bookmarks:changed', sub);
    storageEvents.on('collections:changed', sub);
    storageEvents.on('tags:changed', sub);
    return () => {
      storageEvents.off('bookmarks:changed', sub);
      storageEvents.off('collections:changed', sub);
      storageEvents.off('tags:changed', sub);
    };
  });

  function titleFor(s: Selection): string {
    switch (s.kind) {
      case 'all': return 'All bookmarks';
      case 'smart': return ({ recent: 'Recent', unread: 'Unread', starred: 'Starred', untagged: 'Untagged', broken: 'Broken' })[s.smart] ?? 'Filter';
      case 'collection': return collections.find((c) => c.id === s.id)?.name ?? 'Collection';
      case 'tag': return '#' + (tags.find((t) => t.id === s.id)?.name ?? 'tag');
    }
  }

  async function newCollection() {
    const name = prompt('Collection name?');
    if (name?.trim()) await colStore.create({ name: name.trim() });
  }

  async function openBookmark(b: Bookmark) {
    if (b.unread) await bookmarks.update(b.id, { unread: false });
    window.open(b.url, '_blank');
  }

  async function deleteBookmark(b: Bookmark) {
    if (confirm(`Delete "${b.title}"?`)) await bookmarks.delete(b.id);
  }
</script>

<div class="min-h-screen flex" style="background: linear-gradient(180deg, #0b0c14 0%, #14172a 100%);">
  <Sidebar {collections} {tags} {selection} onSelect={(s) => (selection = s)} />
  <main class="flex-1 px-8 py-6 overflow-auto">
    <Toolbar bind:search title={titleFor(selection)} count={items.length} onNewCollection={newCollection} />
    <BookmarkGrid {items} onOpen={openBookmark} onDelete={deleteBookmark} />
  </main>
</div>
```

- [ ] **Step 3: Build and test**

```bash
npm run build && npm test
```

Expected: clean, 66 passing (60 + 6 search).

- [ ] **Step 4: Commit**

```bash
git add src/newtab/App.svelte
git commit -m "feat(newtab): replace substring filter with MiniSearch index

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Untagged/Broken smart filters in Sidebar

**Files:**
- Modify: `src/newtab/Sidebar.svelte`

- [ ] **Step 1: Add the two filter buttons**

In `src/newtab/Sidebar.svelte`, replace the Library section (the four buttons under `<div class="text-[10px] uppercase tracking-wider opacity-50 px-2 mt-3 mb-1">Library</div>`) with:

```svelte
  <div class="text-[10px] uppercase tracking-wider opacity-50 px-2 mt-3 mb-1">Library</div>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'all' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'all' })}>All</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'recent' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'recent' })}>Recent</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'unread' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'unread' })}>Unread</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'starred' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'starred' })}>Starred</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'untagged' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'untagged' })}>Untagged</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'broken' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'broken' })}>Broken</button>
```

- [ ] **Step 2: Test runs and Sidebar tests still pass**

```bash
npm test -- tests/unit/newtab/Sidebar.test.ts
```

Expected: 2 tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/newtab/Sidebar.svelte
git commit -m "feat(sidebar): add Untagged and Broken smart filters

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: BookmarkList component

**Files:**
- Create: `src/newtab/BookmarkList.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import type { Bookmark, Collection, Tag } from '$lib/types';

  let {
    items,
    collections,
    tags,
    onOpen,
    onDelete,
  }: {
    items: Bookmark[];
    collections: Collection[];
    tags: Tag[];
    onOpen: (b: Bookmark) => void;
    onDelete: (b: Bookmark) => void;
  } = $props();

  function tagNames(ids: string[]): string[] {
    return ids
      .map((id) => tags.find((t) => t.id === id)?.name)
      .filter((n): n is string => Boolean(n));
  }
  function collectionFor(id: string | null): Collection | undefined {
    return id ? collections.find((c) => c.id === id) : undefined;
  }
  function timeAgo(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  }
</script>

{#if items.length === 0}
  <div class="opacity-50 text-sm py-12 text-center">No bookmarks yet — click the toolbar icon on any page to save.</div>
{:else}
  <div class="flex flex-col">
    {#each items as b (b.id)}
      <div
        role="button"
        tabindex="0"
        onclick={() => onOpen(b)}
        onkeydown={(e) => e.key === 'Enter' && onOpen(b)}
        class="grid grid-cols-[16px_1fr_140px_60px_24px] gap-3 items-center py-2 px-1 border-b border-white/5 hover:bg-white/5 cursor-pointer text-sm group"
      >
        {#if b.faviconUrl}
          <img src={b.faviconUrl} alt="" class="w-3.5 h-3.5 rounded-sm" />
        {:else}
          <div class="w-3.5 h-3.5 rounded-sm bg-white/10"></div>
        {/if}

        <div class="min-w-0">
          <div class="font-medium truncate">{b.title}</div>
          <div class="text-[10px] opacity-50 truncate">
            {b.domain}
            {#if collectionFor(b.collectionId)}
              · <span style="color:{collectionFor(b.collectionId)?.color}">{collectionFor(b.collectionId)?.name}</span>
            {/if}
          </div>
        </div>

        <div class="flex flex-wrap gap-1 overflow-hidden max-h-5">
          {#each tagNames(b.tagIds).slice(0, 3) as t (t)}
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5">{t}</span>
          {/each}
        </div>

        <div class="text-[10px] opacity-50 text-right">{timeAgo(b.createdAt)}</div>

        <button
          class="opacity-0 group-hover:opacity-100 text-base leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20"
          onclick={(e) => { e.stopPropagation(); onDelete(b); }}
          aria-label="Delete bookmark"
        >×</button>
      </div>
    {/each}
  </div>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/newtab/BookmarkList.svelte
git commit -m "feat(newtab): dense list view component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: View toggle in Toolbar + persist defaultView

**Files:**
- Modify: `src/newtab/Toolbar.svelte`, `src/newtab/App.svelte`

- [ ] **Step 1: Replace Toolbar.svelte**

```svelte
<script lang="ts">
  let {
    search = $bindable(),
    title,
    count,
    view = $bindable(),
    onNewCollection,
  }: {
    search: string;
    title: string;
    count: number;
    view: 'grid' | 'list';
    onNewCollection: () => void;
  } = $props();
</script>

<div class="flex items-center gap-3 mb-5">
  <input
    bind:value={search}
    placeholder="Search bookmarks..."
    class="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent-violet/50"
  />
  <div class="flex items-center bg-white/5 rounded-lg p-0.5">
    <button
      class="px-2.5 py-1.5 rounded {view === 'grid' ? 'bg-white/10 text-white' : 'opacity-50 hover:opacity-100'}"
      onclick={() => (view = 'grid')}
      aria-label="Grid view"
      title="Grid view (1)"
    >⊞</button>
    <button
      class="px-2.5 py-1.5 rounded {view === 'list' ? 'bg-white/10 text-white' : 'opacity-50 hover:opacity-100'}"
      onclick={() => (view = 'list')}
      aria-label="List view"
      title="List view (2)"
    >≡</button>
  </div>
  <button onclick={onNewCollection} class="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">+ Collection</button>
</div>
<div class="mb-4">
  <h1 class="text-2xl font-semibold tracking-tight">
    {title}
    <span class="ml-2 text-xs opacity-50 font-normal">{count} saved</span>
  </h1>
</div>
```

- [ ] **Step 2: Modify App.svelte**

In `src/newtab/App.svelte`, add:

- Import: `import { settings } from '$lib/storage/settings';` and `import BookmarkList from './BookmarkList.svelte';`
- State: `let view = $state<'grid' | 'list'>('grid');`
- In `loadData`, after the existing assignments, add:
  ```ts
  const s = await settings.get();
  view = s.defaultView;
  ```
- Add an effect to persist:
  ```ts
  $effect(() => {
    if (!index) return; // skip pre-load fire
    void settings.set({ defaultView: view });
  });
  ```
- Pass `bind:view` to `<Toolbar>`.
- Replace `<BookmarkGrid {items} ... />` with:
  ```svelte
  {#if view === 'grid'}
    <BookmarkGrid {items} onOpen={openBookmark} onDelete={deleteBookmark} />
  {:else}
    <BookmarkList {items} {collections} {tags} onOpen={openBookmark} onDelete={deleteBookmark} />
  {/if}
  ```

- [ ] **Step 3: Build and verify**

```bash
npm run build && npm run check && npm test
```

Expected: clean build, 0 TS errors, 66 tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/newtab/Toolbar.svelte src/newtab/App.svelte
git commit -m "feat(newtab): grid/list view toggle persisted to settings.defaultView

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Keyboard shortcuts in newtab

**Files:**
- Modify: `src/newtab/App.svelte`

- [ ] **Step 1: Add shortcut handler**

In `src/newtab/App.svelte`, add inside the script block (after the existing state declarations and effects):

```ts
let selectedIndex = $state(0);

$effect(() => {
  // reset selection when items change shape
  void items;
  if (selectedIndex >= items.length) selectedIndex = Math.max(0, items.length - 1);
});

function handleKey(e: KeyboardEvent) {
  // Don't intercept when an input/textarea has focus.
  const t = e.target as HTMLElement;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      (document.querySelector('input[placeholder^="Search"]') as HTMLInputElement | null)?.focus();
    }
    return;
  }

  switch (e.key) {
    case '/': // common search-focus shortcut
    case 'k':
      if ((e.metaKey || e.ctrlKey) || e.key === '/') {
        e.preventDefault();
        (document.querySelector('input[placeholder^="Search"]') as HTMLInputElement | null)?.focus();
      }
      break;
    case 'j':
      if (items.length > 0) selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
      break;
    case 'ArrowDown':
      if (items.length > 0) {
        e.preventDefault();
        selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
      }
      break;
    case 'ArrowUp':
      if (items.length > 0) {
        e.preventDefault();
        selectedIndex = Math.max(0, selectedIndex - 1);
      }
      break;
    case 'Enter': {
      const b = items[selectedIndex];
      if (b) openBookmark(b);
      break;
    }
    case 'Backspace':
    case 'Delete': {
      const b = items[selectedIndex];
      if (b) deleteBookmark(b);
      break;
    }
    case 's':
    case 'S': {
      const b = items[selectedIndex];
      if (b) bookmarks.update(b.id, { starred: !b.starred });
      break;
    }
    case '1':
      view = 'grid';
      break;
    case '2':
      view = 'list';
      break;
  }
}
```

Update `onMount` to register/unregister the listener — replace the existing `onMount` body with:

```ts
onMount(() => {
  loadData();
  const sub = () => loadData();
  storageEvents.on('bookmarks:changed', sub);
  storageEvents.on('collections:changed', sub);
  storageEvents.on('tags:changed', sub);
  document.addEventListener('keydown', handleKey);
  return () => {
    storageEvents.off('bookmarks:changed', sub);
    storageEvents.off('collections:changed', sub);
    storageEvents.off('tags:changed', sub);
    document.removeEventListener('keydown', handleKey);
  };
});
```

- [ ] **Step 2: Visual selection indicator**

Pass `{selectedIndex}` to both `BookmarkGrid` and `BookmarkList`. In each, render a ring on the selected card/row.

In `src/newtab/BookmarkGrid.svelte`:

Replace the current contents with:

```svelte
<script lang="ts">
  import type { Bookmark } from '$lib/types';
  import BookmarkCard from './BookmarkCard.svelte';

  let {
    items,
    selectedIndex = -1,
    onOpen,
    onDelete,
  }: {
    items: Bookmark[];
    selectedIndex?: number;
    onOpen: (b: Bookmark) => void;
    onDelete: (b: Bookmark) => void;
  } = $props();
</script>

{#if items.length === 0}
  <div class="opacity-50 text-sm py-12 text-center">No bookmarks yet — click the toolbar icon on any page to save.</div>
{:else}
  <div class="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] relative">
    {#each items as b, i (b.id)}
      <div class="relative {i === selectedIndex ? 'ring-2 ring-accent-violet rounded-lg' : ''}">
        <BookmarkCard bookmark={b} onOpen={() => onOpen(b)} onDelete={() => onDelete(b)} />
      </div>
    {/each}
  </div>
{/if}
```

In `src/newtab/BookmarkList.svelte`, modify the `<div role="button"...>` to apply the selected class:

Replace `class="grid grid-cols-[16px_1fr_140px_60px_24px] gap-3 items-center py-2 px-1 border-b border-white/5 hover:bg-white/5 cursor-pointer text-sm group"` with:

```svelte
class="grid grid-cols-[16px_1fr_140px_60px_24px] gap-3 items-center py-2 px-2 border-b border-white/5 hover:bg-white/5 cursor-pointer text-sm group {i === selectedIndex ? 'bg-accent-violet/10 ring-1 ring-accent-violet/40 rounded' : ''}"
```

And modify the `{#each items as b}` to `{#each items as b, i (b.id)}`. Add `selectedIndex` to props:

```ts
let {
  items,
  collections,
  tags,
  selectedIndex = -1,
  onOpen,
  onDelete,
}: {
  items: Bookmark[];
  collections: Collection[];
  tags: Tag[];
  selectedIndex?: number;
  onOpen: (b: Bookmark) => void;
  onDelete: (b: Bookmark) => void;
} = $props();
```

In `src/newtab/App.svelte`, pass `{selectedIndex}` to both view components.

- [ ] **Step 3: Build and check**

```bash
npm run build && npm run check
```

Expected: clean.

- [ ] **Step 4: Manual smoke**

Reload extension, open new tab. Save a few bookmarks. Press `j`/`k` (or arrow keys) — selection ring moves. `Enter` opens. `s` toggles star. `1`/`2` swaps grid/list. `⌘K` focuses search.

- [ ] **Step 5: Commit**

```bash
git add src/newtab/App.svelte src/newtab/BookmarkGrid.svelte src/newtab/BookmarkList.svelte
git commit -m "feat(newtab): keyboard shortcuts (j/k navigation, Enter, S, 1/2, ⌘K)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Drag-and-drop bookmarks to collections

**Files:**
- Modify: `src/newtab/BookmarkGrid.svelte`, `src/newtab/Sidebar.svelte`, `src/newtab/App.svelte`

The simplest viable DnD: items in the grid are draggable; collection rows in the sidebar are drop targets. We use HTML5 drag-and-drop natively (no library needed for this minimal interaction). svelte-dnd-action is more powerful but overkill for one-way drop targets.

- [ ] **Step 1: Make grid cards draggable**

Replace the `<div class="relative ...">` wrapper in `src/newtab/BookmarkGrid.svelte` with:

```svelte
<div
  class="relative {i === selectedIndex ? 'ring-2 ring-accent-violet rounded-lg' : ''}"
  draggable="true"
  ondragstart={(e) => {
    e.dataTransfer?.setData('application/x-bookmark-id', b.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }}
>
  <BookmarkCard bookmark={b} onOpen={() => onOpen(b)} onDelete={() => onDelete(b)} />
</div>
```

- [ ] **Step 2: Make sidebar collections drop targets**

In `src/newtab/Sidebar.svelte`, add to the script block:

```ts
let dragOverId = $state<string | null>(null);

let onDropOnCollection: ((bookmarkId: string, collectionId: string) => void) | undefined = $derived(
  // populated via prop below
  undefined,
);
```

Update the `$props` block to include the optional drop callback:

```ts
let {
  collections,
  tags,
  selection,
  onSelect,
  onMoveBookmarkToCollection,
}: {
  collections: Collection[];
  tags: Tag[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  onMoveBookmarkToCollection?: (bookmarkId: string, collectionId: string) => void;
} = $props();
```

Replace the collections `{#each}` block with:

```svelte
{#if collections.length > 0}
  <div class="text-[10px] uppercase tracking-wider opacity-50 px-2 mt-4 mb-1">Collections</div>
  {#each collections as c (c.id)}
    <button
      class="w-full text-left px-2 py-1 rounded hover:bg-white/5 flex items-center gap-2 {isActive({ kind: 'collection', id: c.id }) ? 'bg-white/10' : ''} {dragOverId === c.id ? 'bg-accent-violet/20 ring-1 ring-accent-violet/40' : ''}"
      onclick={() => onSelect({ kind: 'collection', id: c.id })}
      ondragover={(e) => { e.preventDefault(); dragOverId = c.id; if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; }}
      ondragleave={() => { if (dragOverId === c.id) dragOverId = null; }}
      ondrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer?.getData('application/x-bookmark-id');
        if (id && onMoveBookmarkToCollection) onMoveBookmarkToCollection(id, c.id);
        dragOverId = null;
      }}
    >
      <span class="w-3 h-3 rounded-sm" style="background:{c.color}"></span>
      <span class="flex-1 truncate">{c.name}</span>
    </button>
  {/each}
{/if}
```

- [ ] **Step 3: Wire in App.svelte**

In `src/newtab/App.svelte`, add a handler:

```ts
async function moveBookmarkToCollection(bookmarkId: string, collectionId: string) {
  await bookmarks.update(bookmarkId, { collectionId });
}
```

Pass to Sidebar:

```svelte
<Sidebar {collections} {tags} {selection} onSelect={(s) => (selection = s)} onMoveBookmarkToCollection={moveBookmarkToCollection} />
```

- [ ] **Step 4: Build and verify Sidebar tests still pass**

```bash
npm run build && npm test -- tests/unit/newtab/Sidebar.test.ts
```

Expected: 2 tests still pass (the new optional prop doesn't affect existing tests).

- [ ] **Step 5: Manual smoke**

Reload extension. Save a bookmark. Drag it from the grid onto a collection in the sidebar. The collection highlights on drag-over; the bookmark moves on drop. Open the collection — bookmark appears.

- [ ] **Step 6: Commit**

```bash
git add src/newtab/BookmarkGrid.svelte src/newtab/Sidebar.svelte src/newtab/App.svelte
git commit -m "feat(newtab): drag bookmarks onto collections in sidebar

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Native bookmarks importer

**Files:**
- Create: `src/lib/native/importBookmarks.ts`, `tests/unit/native/importBookmarks.test.ts`
- Modify: `src/manifest.json` (add `bookmarks` permission)

- [ ] **Step 1: Add permission to manifest**

In `src/manifest.json`, change `"permissions": ["storage", "activeTab", "scripting", "tabs"]` to:

```json
"permissions": ["storage", "activeTab", "scripting", "tabs", "bookmarks"]
```

- [ ] **Step 2: Failing test**

`tests/unit/native/importBookmarks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { flattenBookmarkTree, type ChromeBookmarkNode } from '$lib/native/importBookmarks';

describe('flattenBookmarkTree', () => {
  it('returns leaves (nodes with url) and skips folders', () => {
    const tree: ChromeBookmarkNode[] = [
      {
        id: '0', title: '', children: [
          { id: '1', title: 'Bookmarks bar', children: [
            { id: '2', title: 'Hacker News', url: 'https://news.ycombinator.com/' },
            { id: '3', title: 'Inner folder', children: [
              { id: '4', title: 'GitHub', url: 'https://github.com/' },
            ] },
          ] },
        ],
      },
    ];
    const out = flattenBookmarkTree(tree);
    expect(out).toEqual([
      { title: 'Hacker News', url: 'https://news.ycombinator.com/', folderPath: ['Bookmarks bar'] },
      { title: 'GitHub', url: 'https://github.com/', folderPath: ['Bookmarks bar', 'Inner folder'] },
    ]);
  });

  it('skips entries without url', () => {
    const tree: ChromeBookmarkNode[] = [
      { id: '1', title: 'X', children: [{ id: '2', title: 'No URL' }] },
    ];
    expect(flattenBookmarkTree(tree)).toEqual([]);
  });

  it('handles empty tree', () => {
    expect(flattenBookmarkTree([])).toEqual([]);
  });

  it('handles a node with empty title by using URL hostname', () => {
    const tree: ChromeBookmarkNode[] = [
      { id: '1', title: 'Folder', children: [
        { id: '2', title: '', url: 'https://example.com/foo' },
      ] },
    ];
    expect(flattenBookmarkTree(tree)).toEqual([
      { title: 'example.com', url: 'https://example.com/foo', folderPath: ['Folder'] },
    ]);
  });
});
```

- [ ] **Step 3: Verify failure**

```bash
npm test -- tests/unit/native/importBookmarks.test.ts
```

Expected: fails on missing module.

- [ ] **Step 4: Implement**

`src/lib/native/importBookmarks.ts`:

```ts
import { bookmarks } from '$lib/storage/bookmarks';
import { collections as colStore } from '$lib/storage/collections';

export type ChromeBookmarkNode = {
  id: string;
  title: string;
  url?: string;
  children?: ChromeBookmarkNode[];
};

export type FlatNativeBookmark = {
  title: string;
  url: string;
  folderPath: string[];   // sequence of folder names from root child to leaf parent
};

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function flattenBookmarkTree(roots: ChromeBookmarkNode[]): FlatNativeBookmark[] {
  const out: FlatNativeBookmark[] = [];
  // The Chrome tree root is always one synthetic node with empty title and children
  // like "Bookmarks bar" and "Other bookmarks". We skip the root node itself.
  const walk = (node: ChromeBookmarkNode, path: string[]): void => {
    if (node.url) {
      out.push({
        title: node.title.trim() || domainOf(node.url),
        url: node.url,
        folderPath: path,
      });
      return;
    }
    if (node.children) {
      const nextPath = node.title ? [...path, node.title] : path;
      for (const child of node.children) walk(child, nextPath);
    }
  };

  for (const root of roots) {
    if (root.children) for (const child of root.children) walk(child, []);
  }
  return out;
}

export type ImportProgress = { total: number; done: number };

export async function importNativeBookmarks(
  onProgress?: (p: ImportProgress) => void,
): Promise<{ imported: number; skipped: number }> {
  const tree = await chrome.bookmarks.getTree();
  const flat = flattenBookmarkTree(tree as ChromeBookmarkNode[]);

  const folderToCollection = new Map<string, string>(); // joined path -> collectionId
  const existingCollections = await colStore.list();
  for (const c of existingCollections) folderToCollection.set(c.name.toLowerCase(), c.id);

  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < flat.length; i++) {
    const item = flat[i]!;
    onProgress?.({ total: flat.length, done: i });
    try {
      // Map deepest folder name to a collection (create if needed).
      const leafFolder = item.folderPath[item.folderPath.length - 1];
      let collectionId: string | null = null;
      if (leafFolder) {
        const key = leafFolder.toLowerCase();
        let id = folderToCollection.get(key);
        if (!id) {
          const c = await colStore.create({ name: leafFolder });
          id = c.id;
          folderToCollection.set(key, id);
        }
        collectionId = id;
      }
      await bookmarks.create({
        url: item.url,
        title: item.title,
        originalTitle: item.title,
        ...(collectionId ? { collectionId } : {}),
      });
      imported++;
    } catch {
      skipped++;
    }
  }
  onProgress?.({ total: flat.length, done: flat.length });
  return { imported, skipped };
}
```

- [ ] **Step 5: Verify pass**

```bash
npm test -- tests/unit/native/importBookmarks.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/manifest.json src/lib/native/importBookmarks.ts tests/unit/native/importBookmarks.test.ts
git commit -m "feat(import): native bookmark tree flattener and importer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: JSON export/import

**Files:**
- Create: `src/lib/storage/exportImport.ts`, `tests/unit/storage/exportImport.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/storage/exportImport.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { bookmarks } from '$lib/storage/bookmarks';
import { collections } from '$lib/storage/collections';
import { tags } from '$lib/storage/tags';
import { exportToJSON, importFromJSON } from '$lib/storage/exportImport';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('export/import', () => {
  it('exports an empty store as an empty payload', async () => {
    const json = await exportToJSON();
    expect(json.version).toBe(1);
    expect(json.bookmarks).toEqual([]);
    expect(json.collections).toEqual([]);
    expect(json.tags).toEqual([]);
  });

  it('round-trips bookmarks/collections/tags', async () => {
    const c = await collections.create({ name: 'Reading' });
    const t = await tags.upsertByName('design');
    const b = await bookmarks.create({
      url: 'https://example.com',
      title: 'X',
      originalTitle: 'X',
      collectionId: c.id,
    });
    await bookmarks.addTag(b.id, t.id);

    const exported = await exportToJSON();

    // Wipe and reimport
    globalThis.indexedDB = new IDBFactory();
    _resetDbForTests();

    const result = await importFromJSON(exported);
    expect(result.imported.bookmarks).toBe(1);
    expect(result.imported.collections).toBe(1);
    expect(result.imported.tags).toBe(1);

    const list = await bookmarks.list({});
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe('X');
    expect(list[0]!.tagIds).toContain(t.id);
    expect(list[0]!.collectionId).toBe(c.id);
  });

  it('importFromJSON skips entries that already exist (by id)', async () => {
    const c = await collections.create({ name: 'Reading' });
    const exported = await exportToJSON();
    const result = await importFromJSON(exported);
    expect(result.imported.collections).toBe(0);
    expect(result.skipped.collections).toBe(1);
    void c;
  });

  it('importFromJSON rejects an invalid payload', async () => {
    await expect(importFromJSON({ version: 999 } as unknown as any)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- tests/unit/storage/exportImport.test.ts
```

Expected: fails on missing module.

- [ ] **Step 3: Implement**

`src/lib/storage/exportImport.ts`:

```ts
import { getDb } from './db';
import { emit } from './events';
import type { Bookmark, Collection, Tag } from '$lib/types';

export type ExportPayload = {
  version: 1;
  exportedAt: number;
  bookmarks: Bookmark[];
  collections: Collection[];
  tags: Tag[];
};

export async function exportToJSON(): Promise<ExportPayload> {
  const db = await getDb();
  const [bms, cols, tgs] = await Promise.all([
    db.getAll('bookmarks'),
    db.getAll('collections'),
    db.getAll('tags'),
  ]);
  return {
    version: 1,
    exportedAt: Date.now(),
    bookmarks: bms,
    collections: cols,
    tags: tgs,
  };
}

export type ImportResult = {
  imported: { bookmarks: number; collections: number; tags: number };
  skipped: { bookmarks: number; collections: number; tags: number };
};

function validate(payload: unknown): payload is ExportPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (p['version'] !== 1) return false;
  if (!Array.isArray(p['bookmarks']) || !Array.isArray(p['collections']) || !Array.isArray(p['tags'])) return false;
  return true;
}

export async function importFromJSON(payload: unknown): Promise<ImportResult> {
  if (!validate(payload)) throw new Error('Invalid export payload (expected version 1)');
  const db = await getDb();

  const result: ImportResult = {
    imported: { bookmarks: 0, collections: 0, tags: 0 },
    skipped: { bookmarks: 0, collections: 0, tags: 0 },
  };

  const tx = db.transaction(['bookmarks', 'collections', 'tags'], 'readwrite');

  for (const c of payload.collections) {
    const existing = await tx.objectStore('collections').get(c.id);
    if (existing) {
      result.skipped.collections++;
    } else {
      await tx.objectStore('collections').put(c);
      result.imported.collections++;
    }
  }

  for (const t of payload.tags) {
    const existing = await tx.objectStore('tags').get(t.id);
    if (existing) {
      result.skipped.tags++;
    } else {
      await tx.objectStore('tags').put(t);
      result.imported.tags++;
    }
  }

  for (const b of payload.bookmarks) {
    const existing = await tx.objectStore('bookmarks').get(b.id);
    if (existing) {
      result.skipped.bookmarks++;
    } else {
      await tx.objectStore('bookmarks').put(b);
      result.imported.bookmarks++;
    }
  }

  await tx.done;

  emit({ type: 'bookmarks:changed' });
  emit({ type: 'collections:changed' });
  emit({ type: 'tags:changed' });

  return result;
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- tests/unit/storage/exportImport.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/exportImport.ts tests/unit/storage/exportImport.test.ts
git commit -m "feat(storage): JSON export/import with id-based dedup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: DataSection in settings

**Files:**
- Create: `src/settings/DataSection.svelte`
- Modify: `src/settings/App.svelte`

- [ ] **Step 1: Implement DataSection.svelte**

```svelte
<script lang="ts">
  import { exportToJSON, importFromJSON, type ImportResult } from '$lib/storage/exportImport';
  import { importNativeBookmarks } from '$lib/native/importBookmarks';

  let busy = $state<'idle' | 'export' | 'import' | 'native'>('idle');
  let lastResult = $state<string | null>(null);

  async function doExport() {
    busy = 'export';
    try {
      const payload = await exportToJSON();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `midnight-markers-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      lastResult = `Exported ${payload.bookmarks.length} bookmarks.`;
    } finally {
      busy = 'idle';
    }
  }

  async function doImport(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    busy = 'import';
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const r: ImportResult = await importFromJSON(payload);
      lastResult = `Imported ${r.imported.bookmarks} bookmarks (${r.skipped.bookmarks} duplicates skipped).`;
    } catch (e) {
      lastResult = 'Import failed: ' + (e as Error).message;
    } finally {
      busy = 'idle';
      (ev.target as HTMLInputElement).value = '';
    }
  }

  async function doNative() {
    if (!confirm('Import all browser bookmarks into midnight-markers? Folder names become collections.')) return;
    busy = 'native';
    try {
      const r = await importNativeBookmarks();
      lastResult = `Imported ${r.imported} from browser bookmarks (${r.skipped} skipped).`;
    } catch (e) {
      lastResult = 'Native import failed: ' + (e as Error).message;
    } finally {
      busy = 'idle';
    }
  }
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[10px] uppercase tracking-wider opacity-50 mb-3">Data</div>

  <div class="space-y-3">
    <div class="flex items-center gap-3">
      <button class="px-3 py-1.5 rounded bg-white/5 text-sm" disabled={busy !== 'idle'} onclick={doExport}>
        {busy === 'export' ? 'Exporting…' : 'Export to JSON'}
      </button>
      <span class="text-xs opacity-50">Download a backup of your library.</span>
    </div>

    <div class="flex items-center gap-3">
      <label class="px-3 py-1.5 rounded bg-white/5 text-sm cursor-pointer">
        {busy === 'import' ? 'Importing…' : 'Import from JSON'}
        <input type="file" accept="application/json" class="hidden" onchange={doImport} disabled={busy !== 'idle'} />
      </label>
      <span class="text-xs opacity-50">Merge a previously-exported file (id-based dedup).</span>
    </div>

    <div class="flex items-center gap-3">
      <button class="px-3 py-1.5 rounded bg-white/5 text-sm" disabled={busy !== 'idle'} onclick={doNative}>
        {busy === 'native' ? 'Importing…' : 'Import browser bookmarks'}
      </button>
      <span class="text-xs opacity-50">Folder names become collections.</span>
    </div>

    {#if lastResult}
      <p class="text-xs opacity-60 mt-2">{lastResult}</p>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Wire into settings App**

In `src/settings/App.svelte`, add:

```ts
import DataSection from './DataSection.svelte';
```

Add `<DataSection />` between `<PrivacyNote />` and the closing `{:else}` block (above `Loading…`):

```svelte
      <PrivacyNote />
      <DataSection />
```

- [ ] **Step 3: Build and verify**

```bash
npm run build && npm run check
```

Expected: clean.

- [ ] **Step 4: Manual smoke**

Settings → Export → file downloads. Save a few bookmarks, Import → merged with skip count. Click "Import browser bookmarks" → confirms → all native bookmarks appear (folder names mapped to collections).

- [ ] **Step 5: Commit**

```bash
git add src/settings/DataSection.svelte src/settings/App.svelte
git commit -m "feat(settings): Data section with JSON export/import and native bookmarks import

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Broken-link checker

**Files:**
- Create: `src/background/brokenLinks.ts`, `tests/unit/background/brokenLinks.test.ts`
- Modify: `src/background/service-worker.ts`

- [ ] **Step 1: Failing test**

`tests/unit/background/brokenLinks.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { bookmarks } from '$lib/storage/bookmarks';
import { checkOnce, pickBatch } from '../../../src/background/brokenLinks';

const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('pickBatch', () => {
  it('returns up to N bookmarks with oldest lastCheckedAt first, only those past cooldown', async () => {
    const week = 7 * 24 * 60 * 60 * 1000;
    const a = await bookmarks.create({ url: 'https://a', title: 'A', originalTitle: 'A' });
    const b = await bookmarks.create({ url: 'https://b', title: 'B', originalTitle: 'B' });
    const c = await bookmarks.create({ url: 'https://c', title: 'C', originalTitle: 'C' });
    // a was checked 8 days ago (eligible), b checked 2 days ago (in cooldown), c never checked
    await bookmarks.update(a.id, { lastCheckedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });
    await bookmarks.update(b.id, { lastCheckedAt: Date.now() - 2 * 24 * 60 * 60 * 1000 });
    void c; // never-checked, eligible

    const batch = await pickBatch(10, week);
    const ids = batch.map((x) => x.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(c.id);
    expect(ids).not.toContain(b.id);
  });

  it('caps at the requested batch size', async () => {
    for (let i = 0; i < 5; i++) {
      await bookmarks.create({ url: 'https://x' + i, title: 'X', originalTitle: 'X' });
    }
    const batch = await pickBatch(3, 0);
    expect(batch).toHaveLength(3);
  });
});

describe('checkOnce', () => {
  it('marks 4xx/5xx as broken', async () => {
    const b = await bookmarks.create({ url: 'https://broken', title: 'B', originalTitle: 'B' });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
    await checkOnce(b);
    const after = await bookmarks.get(b.id);
    expect(after!.isBroken).toBe(true);
    expect(after!.lastCheckedAt).toBeGreaterThan(0);
  });

  it('marks 2xx/3xx as not broken', async () => {
    const b = await bookmarks.create({ url: 'https://ok', title: 'O', originalTitle: 'O' });
    await bookmarks.update(b.id, { isBroken: true });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));
    await checkOnce(b);
    const after = await bookmarks.get(b.id);
    expect(after!.isBroken).toBe(false);
  });

  it('treats network errors as broken', async () => {
    const b = await bookmarks.create({ url: 'https://offline', title: 'X', originalTitle: 'X' });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await checkOnce(b);
    const after = await bookmarks.get(b.id);
    expect(after!.isBroken).toBe(true);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- tests/unit/background/brokenLinks.test.ts
```

Expected: fails on missing module.

- [ ] **Step 3: Implement**

`src/background/brokenLinks.ts`:

```ts
import { getDb } from '$lib/storage/db';
import { bookmarks } from '$lib/storage/bookmarks';
import type { Bookmark } from '$lib/types';

const DEFAULT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export async function pickBatch(size: number, cooldownMs: number = DEFAULT_COOLDOWN_MS): Promise<Bookmark[]> {
  const db = await getDb();
  const all = await db.getAll('bookmarks');
  const cutoff = Date.now() - cooldownMs;
  const eligible = all.filter((b) => b.lastCheckedAt === null || b.lastCheckedAt < cutoff);
  eligible.sort((a, b) => (a.lastCheckedAt ?? 0) - (b.lastCheckedAt ?? 0));
  return eligible.slice(0, size);
}

export async function checkOnce(b: Bookmark): Promise<void> {
  let isBroken = false;
  try {
    const res = await fetch(b.url, { method: 'HEAD', redirect: 'follow' });
    isBroken = !res.ok;
  } catch {
    isBroken = true;
  }
  await bookmarks.update(b.id, { isBroken, lastCheckedAt: Date.now() });
}

export async function checkBatch(size = 30, cooldownMs = DEFAULT_COOLDOWN_MS): Promise<{ checked: number }> {
  const batch = await pickBatch(size, cooldownMs);
  for (const b of batch) {
    await checkOnce(b);
  }
  return { checked: batch.length };
}
```

- [ ] **Step 4: Wire into service worker**

Replace `src/background/service-worker.ts` with:

```ts
import { checkBatch } from './brokenLinks';

const ALARM_NAME = 'broken-link-check';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[midnight-markers] installed');
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 24 * 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    const r = await checkBatch();
    console.log('[midnight-markers] broken-link batch checked', r);
  }
});
```

Add `"alarms"` to manifest permissions. In `src/manifest.json`, change `"permissions"` to:

```json
"permissions": ["storage", "activeTab", "scripting", "tabs", "bookmarks", "alarms"]
```

- [ ] **Step 5: Verify pass**

```bash
npm test -- tests/unit/background/brokenLinks.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 6: Build and verify**

```bash
npm run build && npm run check
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/background/brokenLinks.ts src/background/service-worker.ts src/manifest.json tests/unit/background/brokenLinks.test.ts
git commit -m "feat(background): broken-link checker with daily alarm and 7-day cooldown

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Real icons

**Files:** `public/icons/icon-{16,32,48,128}.png` (replace)

- [ ] **Step 1: Generate icons via script**

Use Node + the canvas-free PNG approach: render a crescent moon glyph as SVG, then rasterize via `sharp` if available, else accept stylized placeholder PNGs.

If `sharp` isn't already a dev dep, install it:

```bash
npm install --save-dev sharp
```

- [ ] **Step 2: Create generator script**

Create `scripts/generate-icons.mjs`:

```js
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d0e15"/>
      <stop offset="100%" stop-color="#14172a"/>
    </linearGradient>
    <linearGradient id="moon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8b9bff"/>
      <stop offset="100%" stop-color="#bd93f9"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)"/>
  <path d="M82 28a46 46 0 1 0 18 75 38 38 0 0 1-18-75z" fill="url(#moon)"/>
</svg>`;

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const buf = await sharp(Buffer.from(SVG)).resize(size, size).png().toBuffer();
  writeFileSync(`public/icons/icon-${size}.png`, buf);
  console.log(`wrote public/icons/icon-${size}.png`);
}
```

- [ ] **Step 3: Run it**

```bash
node scripts/generate-icons.mjs
```

Expected: prints 4 lines, four PNGs are now non-trivial (each > 200 bytes).

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: clean. Reload extension — toolbar icon now shows the crescent.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-icons.mjs public/icons package.json package-lock.json
git commit -m "feat: real crescent-moon extension icons (16/32/48/128)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: README and final verification

**Files:** `README.md` (modify)

- [ ] **Step 1: Update README**

Replace `README.md` with:

```markdown
# midnight-markers

A dark, polished bookmark extension for Brave & Chrome — Raindrop-flavored, midnight-themed, AI-optional.

## Features

- **New tab page** as your bookmark library: card grid (default) or dense list.
- **Toolbar popup** for one-tap save with star, tags, collection, AI suggestions.
- **AI suggestions** via OpenRouter (BYOK): friendlier title, tag picks, collection routing.
- **Native bookmarks import** in one click (folder names → collections).
- **JSON export/import** for portable backups.
- **Broken-link checker** runs daily in the background.
- **Drag-and-drop** bookmarks into collections.
- **Keyboard-first**: ⌘K search · J/K or ↑/↓ navigate · ↵ open · S star · ⌫ delete · 1/2 grid/list.
- **Local-only** storage (IndexedDB). No account, no cloud, no telemetry.

## Dev

    npm install
    npm run dev          # vite dev mode
    npm run build        # outputs dist/ — load as unpacked extension
    npm test             # unit suite
    npm run test:e2e     # playwright smoke
    npm run check        # svelte-check

## Loading the unpacked extension

1. `npm run build`
2. Brave/Chrome → Extensions → enable Developer mode → Load unpacked → pick `dist/`.
3. Right-click the toolbar icon → Options to add an OpenRouter API key (optional, enables AI).

## Docs

- Design: [`docs/superpowers/specs/2026-05-03-midnight-markers-design.md`](docs/superpowers/specs/2026-05-03-midnight-markers-design.md)
- Plans: [`docs/superpowers/plans/`](docs/superpowers/plans/)
```

- [ ] **Step 2: Run full verification**

```bash
npm test && npm run check && npm run build && npm run test:e2e
```

Expected: all green. Tests should be 60 + 6 (search) + 4 (importBookmarks) + 4 (exportImport) + 5 (brokenLinks) = 79.

- [ ] **Step 3: Tag**

```bash
git add README.md
git commit -m "docs: README with the full feature list

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git tag plan-3-polish
git log --oneline | head -30
```

---

## Self-Review

**Spec coverage:**

| Spec section | Plan 3 task |
| --- | --- |
| List view (toggle from grid) | Tasks 5–6 |
| MiniSearch fuzzy/prefix search | Task 2–3 |
| Smart filters: Untagged + Broken | Task 4 |
| Drag-and-drop bookmarks → collections | Task 8 |
| Native bookmarks import (one-time) | Task 9 |
| JSON export/import | Tasks 10–11 |
| Broken-link checker (daily, 30/min, 7-day cooldown) | Task 12 |
| Keyboard shortcuts: ⌘K, J/K, ↵, ⌫, S, 1/2 | Task 7 |
| Real icons | Task 13 |
| README | Task 14 |

**Placeholder scan:** clean. No TBD/TODO. Each step has actual code blocks or commands.

**Type consistency:**
- `Bookmark`/`Collection`/`Tag` from `$lib/types` used everywhere consistently.
- `SearchIndex` from Task 2 used in Task 3.
- `ChromeBookmarkNode`/`FlatNativeBookmark` from Task 9 used in Task 11.
- `ExportPayload`/`ImportResult` from Task 10 used in Task 11.
- `pickBatch`/`checkOnce`/`checkBatch` from Task 12 used in service worker.

**Scope check:** This plan closes out the spec — every deferred feature lands here. Each task is self-contained and small enough to execute in a single subagent dispatch (the largest, Task 7, is the keyboard-shortcut wiring which is one App.svelte change).
