<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar, { type Selection } from './Sidebar.svelte';
  import Toolbar from './Toolbar.svelte';
  import BookmarkGrid from './BookmarkGrid.svelte';
  import BookmarkList from './BookmarkList.svelte';
  import ResortDialog from './ResortDialog.svelte';
  import HelpDialog from './HelpDialog.svelte';
  import Spotlight from './tour/Spotlight.svelte';
  import { createTour } from './tour/tour.svelte';
  import { snapshots } from '$lib/storage/snapshot';
  import type { ResortScope } from '$lib/ai/resort/types';
  import type { ApplyResult } from '$lib/ai/resort/apply';
  import { bookmarks } from '$lib/storage/bookmarks';
  import { collections as colStore } from '$lib/storage/collections';
  import { tags as tagsStore } from '$lib/storage/tags';
  import { settings } from '$lib/storage/settings';
  import { storageEvents } from '$lib/storage/events';
  import { buildIndex, searchIds, type SearchIndex } from '$lib/search/index';
  import { buildListRows, visibleBookmarks } from './listTree';
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
    // Folding a folder shifts every row beneath it, so follow the selected
    // bookmark by id rather than leaving the cursor on whatever slid into its
    // slot. If it was inside the folder just closed it is gone from the tree,
    // and the clamp effect takes over.
    const keep = selectedId;
    collapsed = collapsed.includes(id) ? collapsed.filter((c) => c !== id) : [...collapsed, id];
    const moved = navItems.findIndex((b) => b.id === keep);
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
    buildListRows(items, collections, { collapsed: new Set(collapsed), pruneEmpty: isFiltered }),
  );

  /**
   * What j/k, Enter and Delete walk. In list view that is the tree in the order
   * it is drawn, minus anything hidden inside a collapsed folder; in grid view
   * it is simply the items.
   */
  const navItems = $derived(view === 'list' ? visibleBookmarks(listRows) : items);
  const selectedId = $derived(navItems[selectedIndex]?.id ?? null);

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
    void navItems;
    if (selectedIndex >= navItems.length) selectedIndex = Math.max(0, navItems.length - 1);
  });

  function handleKey(e: KeyboardEvent) {
    // While the tour or the help panel is up they own the keyboard.
    if (tour.active || helpOpen) return;

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
      case '?':
        e.preventDefault();
        helpOpen = true;
        break;
      case '/': // common search-focus shortcut
        e.preventDefault();
        (document.querySelector('input[placeholder^="Search"]') as HTMLInputElement | null)?.focus();
        break;
      case 'k':
      case 'K':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          (document.querySelector('input[placeholder^="Search"]') as HTMLInputElement | null)?.focus();
        } else if (navItems.length > 0) {
          selectedIndex = Math.max(0, selectedIndex - 1);
        }
        break;
      case 'j':
      case 'J':
        if (navItems.length > 0) selectedIndex = Math.min(navItems.length - 1, selectedIndex + 1);
        break;
      case 'ArrowDown':
        if (navItems.length > 0) {
          e.preventDefault();
          selectedIndex = Math.min(navItems.length - 1, selectedIndex + 1);
        }
        break;
      case 'ArrowUp':
        if (navItems.length > 0) {
          e.preventDefault();
          selectedIndex = Math.max(0, selectedIndex - 1);
        }
        break;
      case 'Enter': {
        const b = navItems[selectedIndex];
        if (b) openBookmark(b);
        break;
      }
      case 'Backspace':
      case 'Delete': {
        const b = navItems[selectedIndex];
        if (b) deleteBookmark(b);
        break;
      }
      case 's':
      case 'S': {
        const b = navItems[selectedIndex];
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

  async function openBookmark(b: Bookmark) {
    if (b.unread) await bookmarks.update(b.id, { unread: false });
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
        <BookmarkGrid {items} {selectedIndex} onOpen={openBookmark} onDelete={deleteBookmark} />
      {:else}
        <BookmarkList rows={listRows} {tags} {selectedId} onOpen={openBookmark} onDelete={deleteBookmark} onToggleCollection={toggleCollection} />
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
