<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar, { type Selection } from './Sidebar.svelte';
  import Toolbar from './Toolbar.svelte';
  import BookmarkGrid from './BookmarkGrid.svelte';
  import BookmarkList from './BookmarkList.svelte';
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
    <Toolbar bind:search bind:view title={titleFor(selection)} count={items.length} onNewCollection={newCollection} />
    {#if view === 'grid'}
      <BookmarkGrid {items} onOpen={openBookmark} onDelete={deleteBookmark} />
    {:else}
      <BookmarkList {items} {collections} {tags} onOpen={openBookmark} onDelete={deleteBookmark} />
    {/if}
  </main>
</div>
