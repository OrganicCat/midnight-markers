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
    // reset selection when items change shape
    void items;
    if (selectedIndex >= items.length) selectedIndex = Math.max(0, items.length - 1);
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
        } else if (items.length > 0) {
          selectedIndex = Math.max(0, selectedIndex - 1);
        }
        break;
      case 'j':
      case 'J':
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

  async function moveBookmarkToCollection(bookmarkId: string, collectionId: string) {
    await bookmarks.update(bookmarkId, { collectionId });
  }

  async function moveCollection(id: string, parentId: string | null, index: number) {
    await colStore.move(id, parentId, index);
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
  <Sidebar {collections} {tags} {selection} onSelect={(s) => (selection = s)} onMoveBookmarkToCollection={moveBookmarkToCollection} onMoveCollection={moveCollection} onResortCollection={resortCollection} />
  <main class="flex-1 px-8 py-6 overflow-auto">
    <Toolbar bind:search bind:view title={titleFor(selection)} count={items.length} onNewCollection={newCollection} onResort={openResort} {canResort} onHelp={() => (helpOpen = true)} />
    <!-- The tour hook only exists when there is something to point at. -->
    <div data-tour={items.length > 0 ? 'results' : null}>
      {#if view === 'grid'}
        <BookmarkGrid {items} {selectedIndex} onOpen={openBookmark} onDelete={deleteBookmark} />
      {:else}
        <BookmarkList {items} {collections} {tags} {selectedIndex} onOpen={openBookmark} onDelete={deleteBookmark} />
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

{#if helpOpen}
  <HelpDialog onClose={() => (helpOpen = false)} onStartTour={startTour} />
{/if}

<Spotlight {tour} />
