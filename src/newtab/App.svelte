<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar, { type Selection } from './Sidebar.svelte';
  import Toolbar from './Toolbar.svelte';
  import BookmarkGrid from './BookmarkGrid.svelte';
  import { bookmarks } from '$lib/storage/bookmarks';
  import { collections as colStore } from '$lib/storage/collections';
  import { tags as tagsStore } from '$lib/storage/tags';
  import { storageEvents } from '$lib/storage/events';
  import type { Bookmark, Collection, Tag } from '$lib/types';

  let selection = $state<Selection>({ kind: 'all' });
  let search = $state('');
  let collections = $state<Collection[]>([]);
  let tags = $state<Tag[]>([]);
  let items = $state<Bookmark[]>([]);

  async function refresh() {
    [collections, tags] = await Promise.all([colStore.list(), tagsStore.list()]);
    const filter =
      selection.kind === 'all' ? {} :
      selection.kind === 'smart' ? { smart: selection.smart } :
      selection.kind === 'collection' ? { collectionId: selection.id } :
      { tagId: selection.id };
    items = await bookmarks.list({ ...filter, ...(search ? { search } : {}) });
  }

  $effect(() => { void selection; void search; refresh(); });

  onMount(() => {
    refresh();
    const sub = () => refresh();
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
