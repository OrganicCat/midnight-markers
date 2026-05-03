<script lang="ts">
  import type { Collection, Tag, SmartFilter } from '$lib/types';

  export type Selection =
    | { kind: 'all' }
    | { kind: 'smart'; smart: SmartFilter }
    | { kind: 'collection'; id: string }
    | { kind: 'tag'; id: string };

  let {
    collections,
    tags,
    selection,
    onSelect,
  }: {
    collections: Collection[];
    tags: Tag[];
    selection: Selection;
    onSelect: (s: Selection) => void;
  } = $props();

  function isActive(s: Selection): boolean {
    return JSON.stringify(s) === JSON.stringify(selection);
  }
</script>

<aside class="w-[200px] shrink-0 px-3 py-4 border-r border-white/5 text-sm">
  <div class="font-semibold tracking-tight mb-4">⏾ midnight</div>

  <div class="text-[10px] uppercase tracking-wider opacity-50 px-2 mt-3 mb-1">Library</div>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'all' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'all' })}>All</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'recent' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'recent' })}>Recent</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'unread' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'unread' })}>Unread</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'starred' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'starred' })}>Starred</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'untagged' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'untagged' })}>Untagged</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'broken' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'broken' })}>Broken</button>

  {#if collections.length > 0}
    <div class="text-[10px] uppercase tracking-wider opacity-50 px-2 mt-4 mb-1">Collections</div>
    {#each collections as c (c.id)}
      <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 flex items-center gap-2 {isActive({ kind: 'collection', id: c.id }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'collection', id: c.id })}>
        <span class="w-3 h-3 rounded-sm" style="background:{c.color}"></span>
        <span class="flex-1 truncate">{c.name}</span>
      </button>
    {/each}
  {/if}

  {#if tags.length > 0}
    <div class="text-[10px] uppercase tracking-wider opacity-50 px-2 mt-4 mb-1">Tags</div>
    {#each tags as t (t.id)}
      <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 flex items-center justify-between {isActive({ kind: 'tag', id: t.id }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'tag', id: t.id })}>
        <span class="truncate">{t.name}</span>
        <span class="text-xs opacity-40">{t.count}</span>
      </button>
    {/each}
  {/if}

  <div class="mt-6 pt-3 border-t border-white/5">
    <button
      class="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-xs opacity-60 hover:opacity-100"
      onclick={() => chrome.runtime.openOptionsPage()}
    >
      ⚙ Settings
    </button>
  </div>
</aside>
