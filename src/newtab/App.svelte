<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar, { type Selection } from './Sidebar.svelte';
  import Toolbar from './Toolbar.svelte';
  import BookmarkGrid from './BookmarkGrid.svelte';
  import BookmarkList from './BookmarkList.svelte';
  import ResortDialog from './ResortDialog.svelte';
  import HelpDialog from './HelpDialog.svelte';
  import Spotlight from './tour/Spotlight.svelte';
  import { focusSearch, isSearchHotkey } from './searchHotkey';
  import { createTour } from './tour/tour.svelte';
  import { snapshots } from '$lib/storage/snapshot';
  import type { ResortScope } from '$lib/ai/resort/types';
  import type { ApplyResult } from '$lib/ai/resort/apply';
  import { bookmarks } from '$lib/storage/bookmarks';
  import { collections as colStore } from '$lib/storage/collections';
  import { tags as tagsStore } from '$lib/storage/tags';
  import { settings } from '$lib/storage/settings';
  import { ext } from '$lib/ext';
  import { storageEvents } from '$lib/storage/events';
  import { buildIndex, searchIds, type SearchIndex } from '$lib/search/index';
  import { buildListRows, type ListRow } from './listTree';
  import { stepIndex, gridDelta, enterAction, folderArrow, navigableRows } from './keynav';
  import type { Bookmark, Collection, Tag } from '$lib/types';

  let selection = $state<Selection>({ kind: 'all' });
  let search = $state('');
  let view = $state<'grid' | 'list'>('grid');
  let collections = $state<Collection[]>([]);
  let tags = $state<Tag[]>([]);
  let allBookmarks = $state<Bookmark[]>([]);
  let index = $state<SearchIndex | null>(null);
  let items = $state<Bookmark[]>([]);
  let selectedIndex = $state(0);

  // --- List view tree -------------------------------------------------------

  /** Storage key for which collections the user has folded shut in list view. */
  const COLLAPSED_KEY = 'mm:list-collapsed';

  /**
   * Ids of collections collapsed in the list view. Stored as an array rather
   * than a Set so it stays plain reactive state, and persisted so the tree
   * looks the same on the next new tab. Empty means everything is expanded,
   * which is the first-run state: show the whole library.
   */
  let collapsed = $state<string[]>(readCollapsed());

  function readCollapsed(): string[] {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }

  function toggleCollection(id: string) {
    // Folding a folder shifts every row beneath it, so follow the selected row
    // by key rather than leaving the cursor on whatever slid into its slot. If
    // it was inside the folder just closed it is gone from the tree, and the
    // clamp effect takes over.
    const keep = selectedKey;
    collapsed = collapsed.includes(id) ? collapsed.filter((c) => c !== id) : [...collapsed, id];
    const moved = navRows.findIndex((r) => r.key === keep);
    if (moved >= 0) selectedIndex = moved;
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
      // Persistence is a nicety; a full or blocked store shouldn't break the tree.
    }
  }

  /**
   * Empty folders are worth showing when browsing the whole library — they are
   * something the user made — but are pure noise once a search or filter has
   * narrowed the pool.
   */
  const isFiltered = $derived(search.trim() !== '' || selection.kind !== 'all');

  const listRows = $derived(
    buildListRows(items, collections, {
      collapsed: new Set(collapsed),
      pruneEmpty: isFiltered,
      expandAll: isFiltered,
    }),
  );

  /**
   * What the keyboard cursor walks. In list view that is the tree in the order
   * it is drawn — folders included, since Enter folds them — minus anything
   * hidden inside a collapsed folder. In grid view it is simply the cards.
   */
  const navRows = $derived<ListRow[]>(
    view === 'list'
      ? navigableRows(listRows, isFiltered)
      : items.map((b) => ({ kind: 'bookmark', key: b.id, bookmark: b, depth: 0 })),
  );
  const selectedRow = $derived(navRows[selectedIndex]);
  const selectedKey = $derived(selectedRow?.key ?? null);
  /** The bookmark under the cursor, or null when it is parked on a folder. */
  const selectedBookmark = $derived(selectedRow?.kind === 'bookmark' ? selectedRow.bookmark : null);

  async function loadData() {
    const [colList, tagList, bmList, s] = await Promise.all([
      colStore.list(),
      tagsStore.list(),
      bookmarks.list({}),
      settings.get(),
    ]);
    collections = colList;
    tags = tagList;
    allBookmarks = bmList;
    view = s.defaultView;
    index = buildIndex(allBookmarks);
    if (s.tourSeenAt === null) maybeAutoStartTour();
  }

  $effect(() => {
    if (!index) return;
    void settings.set({ defaultView: view });
  });

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

  $effect(() => {
    // reset selection when the navigable rows change shape
    void navRows;
    if (selectedIndex >= navRows.length) selectedIndex = Math.max(0, navRows.length - 1);
  });

  /**
   * A new query or a new filter means a new list, so send the cursor back to
   * the top. Without this, typing a search and pressing Enter would open
   * whatever happened to sit at the old cursor position.
   */
  $effect(() => {
    void search;
    void selection;
    selectedIndex = 0;
  });

  /**
   * Keep the cursor on screen. Driving the list from the search box otherwise
   * walks it straight out of view. Waiting a frame lets the row exist first;
   * `nearest` scrolls the minimum needed, so the page doesn't lurch.
   */
  $effect(() => {
    const key = selectedKey;
    if (key === null) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-nav-key="${CSS.escape(key)}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    });
  });

  /**
   * How many cards the grid is fitting across right now. The count comes from
   * `auto-fill`, so it depends on the window width and has to be read off the
   * live layout rather than assumed.
   */
  function gridColumns(): number {
    const el = document.querySelector('[data-bookmark-grid]');
    if (!el) return 1;
    const template = getComputedStyle(el).gridTemplateColumns;
    const n = template ? template.split(' ').filter(Boolean).length : 0;
    return n > 0 ? n : 1;
  }

  /**
   * Move the cursor with an arrow key. `sideways` is false while the user is
   * typing in the search box, where left and right belong to the text caret.
   * Returns whether the key was used, so the caller knows to swallow it.
   */
  function moveCursor(key: string, sideways: boolean): boolean {
    if (navRows.length === 0) return false;
    if (view === 'grid') {
      if (!sideways && (key === 'ArrowLeft' || key === 'ArrowRight')) return false;
      const delta = gridDelta(key, gridColumns());
      if (delta === null) return false;
      selectedIndex = stepIndex(selectedIndex, navRows.length, delta);
      return true;
    }
    if (key === 'ArrowDown') {
      selectedIndex = stepIndex(selectedIndex, navRows.length, 1);
      return true;
    }
    if (key === 'ArrowUp') {
      selectedIndex = stepIndex(selectedIndex, navRows.length, -1);
      return true;
    }
    if (!sideways) return false;
    const folder = folderArrow(selectedRow, key);
    if (folder !== null) {
      toggleCollection(folder);
      return true;
    }
    return false;
  }

  /**
   * Tab and click move the cursor too, so the highlight is never somewhere the
   * user isn't. Without this you could tab to one row while the arrows still
   * walked from another.
   */
  function focusRow(key: string): void {
    const i = navRows.findIndex((r) => r.key === key);
    if (i >= 0) selectedIndex = i;
  }

  /** Enter: open the bookmark under the cursor, or fold the folder under it. */
  function activateSelection(): boolean {
    const action = enterAction(selectedRow);
    if (action === null) return false;
    if (action.kind === 'toggle') {
      toggleCollection(action.id);
    } else if (selectedBookmark) {
      void openBookmark(selectedBookmark);
    }
    return true;
  }

  function handleKey(e: KeyboardEvent) {
    // While the tour or the help panel is up they own the keyboard.
    if (tour.active || helpOpen) return;

    // Typing wins over shortcuts, with one exception: the search box hands
    // back the arrows, Enter and Escape so you can find something and open it
    // without ever letting go of the keyboard.
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      if (isSearchHotkey(e)) {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (!t.hasAttribute?.('data-search-input')) return;
      if (e.key === 'Escape') {
        // Clear first, so one press undoes the query and a second gets you out
        // of the box and back to the letter shortcuts.
        e.preventDefault();
        if (search !== '') search = '';
        else t.blur();
        return;
      }
      if (e.key === 'Enter') {
        if (activateSelection()) e.preventDefault();
        return;
      }
      if (moveCursor(e.key, false)) e.preventDefault();
      return;
    }

    // The search hotkey works from anywhere, including the bookmark grid.
    if (isSearchHotkey(e)) {
      e.preventDefault();
      focusSearch();
      return;
    }

    switch (e.key) {
      case '?':
        e.preventDefault();
        helpOpen = true;
        break;
      case '/': // common search-focus shortcut
        e.preventDefault();
        focusSearch();
        break;
      case 'k':
      case 'K':
        selectedIndex = stepIndex(selectedIndex, navRows.length, -1);
        break;
      case 'j':
      case 'J':
        selectedIndex = stepIndex(selectedIndex, navRows.length, 1);
        break;
      case 'ArrowDown':
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'ArrowRight':
        if (moveCursor(e.key, true)) e.preventDefault();
        break;
      case 'Enter':
        if (activateSelection()) e.preventDefault();
        break;
      case 'Backspace':
      case 'Delete': {
        // Folders are deleted from the sidebar, where the prompt can explain
        // what happens to what's inside them.
        if (selectedBookmark) deleteBookmark(selectedBookmark);
        break;
      }
      case 's':
      case 'S': {
        const b = selectedBookmark;
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

  /** A short message with nothing to undo — a refused drop, a name clash. */
  let notice = $state<string | null>(null);
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;

  function notify(message: string): void {
    notice = message;
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice = null), 6000);
  }

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
    const trimmed = name?.trim();
    if (!trimmed) return;
    if (await colStore.findSibling(null, trimmed)) {
      notify(`You already have a top-level collection called "${trimmed}".`);
      return;
    }
    await colStore.create({ name: trimmed });
  }

  async function renameCollection(id: string) {
    const cur = collections.find((c) => c.id === id);
    if (!cur) return;
    const name = prompt('Rename collection', cur.name)?.trim();
    if (!name || name === cur.name) return;
    const clash = await colStore.findSibling(cur.parentId, name);
    if (clash && clash.id !== id) {
      notify(`Another collection here is already called "${name}".`);
      return;
    }
    await colStore.update(id, { name });
  }

  /**
   * Deleting a folder should not take its contents with it: bookmarks inside
   * become unfiled and sub-folders move up a level. The prompt says so, because
   * "Delete" on a folder full of things is otherwise a frightening button.
   */
  async function deleteCollection(id: string) {
    const cur = collections.find((c) => c.id === id);
    if (!cur) return;
    const { bookmarks: n, children } = await colStore.countContents(id);
    const parts: string[] = [];
    if (n > 0) parts.push(`${n} bookmark${n === 1 ? '' : 's'} will become unfiled`);
    if (children > 0) parts.push(`${children} sub-folder${children === 1 ? '' : 's'} will move up a level`);
    const detail = parts.length > 0 ? `\n\n${parts.join('.\n')}.` : '';
    if (!confirm(`Delete "${cur.name}"?${detail}`)) return;
    await colStore.remove(id);
    if (selection.kind === 'collection' && selection.id === id) selection = { kind: 'all' };
  }

  async function mergeDuplicates(id: string) {
    const cur = collections.find((c) => c.id === id);
    if (!cur) return;
    const dups = await colStore.duplicateSiblings(id);
    if (dups.length === 0) return;
    const label = `${dups.length} duplicate${dups.length === 1 ? '' : 's'} of "${cur.name}"`;
    if (!confirm(`Merge ${label} into this one?\n\nTheir bookmarks and sub-folders move across, then the empty copies are deleted.`)) {
      return;
    }
    let bookmarksMoved = 0;
    for (const d of dups) {
      const moved = await colStore.absorb(d.id, id);
      bookmarksMoved += moved.bookmarks;
    }
    notify(`Merged ${label} — ${bookmarksMoved} bookmark${bookmarksMoved === 1 ? '' : 's'} moved.`);
  }

  /**
   * Opens a bookmark. `background` is what a middle click asks for: a new tab
   * that doesn't steal focus, the way a middle click on a link behaves.
   */
  async function openBookmark(b: Bookmark, background = false) {
    if (b.unread) await bookmarks.update(b.id, { unread: false });
    if (background && ext?.tabs?.create) {
      await ext.tabs.create({ url: b.url, active: false });
      return;
    }
    window.open(b.url, '_blank');
  }

  async function deleteBookmark(b: Bookmark) {
    if (confirm(`Delete "${b.title}"?`)) await bookmarks.delete(b.id);
  }

  async function moveBookmarkToCollection(bookmarkId: string, collectionId: string) {
    await bookmarks.update(bookmarkId, { collectionId });
  }

  async function moveCollection(id: string, parentId: string | null, index: number) {
    const result = await colStore.move(id, parentId, index);
    if (result.ok) return;
    // A refused drop used to look identical to a drop that did nothing.
    const name = collections.find((c) => c.id === id)?.name ?? 'That collection';
    if (result.reason === 'name-collision') {
      notify(`There's already a collection called "${name}" there.`);
    } else if (result.reason === 'cycle') {
      notify(`"${name}" can't be moved inside itself.`);
    }
  }

  // --- Resort ---------------------------------------------------------------

  let resortScope = $state<ResortScope | null>(null);
  let undoToast = $state<{ message: string } | null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | null = null;

  const canResort = $derived(selection.kind === 'all' || selection.kind === 'collection');

  const resortScopeLabel = $derived.by(() => {
    const s = resortScope;
    if (s === null) return '';
    if (s.kind === 'all') return 'All bookmarks';
    return collections.find((c) => c.id === s.id)?.name ?? 'Collection';
  });

  function openResort() {
    if (selection.kind === 'all') resortScope = { kind: 'all' };
    else if (selection.kind === 'collection') resortScope = { kind: 'collection', id: selection.id };
  }

  function resortCollection(id: string) {
    resortScope = { kind: 'collection', id };
  }

  async function undoResort() {
    if (undoTimer) clearTimeout(undoTimer);
    undoToast = null;
    await snapshots.restore();
    await loadData();
  }

  // --- Help & guided tour ---------------------------------------------------

  const tour = createTour();
  let helpOpen = $state(false);
  /** Guards against a second storage event re-triggering the first-run tour. */
  let autoStartAttempted = false;

  /**
   * Record that the tour has been shown. Called as it opens, not as it closes,
   * so that reloading or closing the tab mid-tour can't lose the write and
   * hand the user the same walkthrough again tomorrow.
   */
  function markTourSeen() {
    void settings.set({ tourSeenAt: Date.now() });
  }

  function startTour() {
    helpOpen = false;
    markTourSeen();
    // Let the help panel unmount first so its backdrop isn't caught in the cutout.
    queueMicrotask(() => void tour.start());
  }

  /**
   * First run only: show the tour once the page has actually painted, so the
   * steps measure real element positions rather than an empty skeleton.
   */
  function maybeAutoStartTour() {
    if (autoStartAttempted) return;
    autoStartAttempted = true;
    markTourSeen();
    requestAnimationFrame(() => void tour.start());
  }

  function onResortApplied(result: ApplyResult) {
    resortScope = null;
    const total = result.moved + result.created + result.renamed + result.merged + result.deleted;
    undoToast = { message: `Resorted — ${total} change${total === 1 ? '' : 's'} applied.` };
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (undoToast = null), 30_000);
    void loadData();
  }
</script>

<div class="min-h-screen flex" style="background: linear-gradient(180deg, #0b0c14 0%, #14172a 100%);">
  <Sidebar
    {collections}
    {tags}
    {selection}
    onSelect={(s) => (selection = s)}
    onMoveBookmarkToCollection={moveBookmarkToCollection}
    onMoveCollection={moveCollection}
    onResortCollection={resortCollection}
    onRenameCollection={renameCollection}
    onDeleteCollection={deleteCollection}
    onMergeDuplicates={mergeDuplicates}
  />
  <main class="flex-1 px-8 py-6 overflow-auto">
    <Toolbar bind:search bind:view title={titleFor(selection)} count={items.length} onNewCollection={newCollection} onResort={openResort} {canResort} onHelp={() => (helpOpen = true)} />
    <!-- The tour hook only exists when there is something to point at. -->
    <div data-tour={items.length > 0 ? 'results' : null}>
      {#if view === 'grid'}
        <BookmarkGrid {items} {selectedIndex} onOpen={openBookmark} onDelete={deleteBookmark} onFocusItem={focusRow} />
      {:else}
        <BookmarkList rows={listRows} {tags} {selectedKey} onOpen={openBookmark} onDelete={deleteBookmark} onToggleCollection={toggleCollection} onFocusRow={focusRow} />
      {/if}
    </div>
  </main>
</div>

{#if resortScope}
  <ResortDialog
    scope={resortScope}
    scopeLabel={resortScopeLabel}
    onClose={() => (resortScope = null)}
    onApplied={onResortApplied}
  />
{/if}

{#if undoToast}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-lg border border-white/10 bg-[#12131a] px-4 py-3 shadow-xl">
    <span class="text-xs">{undoToast.message}</span>
    <button class="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20" onclick={undoResort}>Undo</button>
  </div>
{/if}

{#if notice}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-white/10 bg-[#12131a] px-4 py-3 shadow-xl">
    <span class="text-xs">{notice}</span>
  </div>
{/if}

{#if helpOpen}
  <HelpDialog onClose={() => (helpOpen = false)} onStartTour={startTour} />
{/if}

<Spotlight {tour} />
