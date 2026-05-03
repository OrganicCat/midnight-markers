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
    onMoveBookmarkToCollection,
  }: {
    collections: Collection[];
    tags: Tag[];
    selection: Selection;
    onSelect: (s: Selection) => void;
    onMoveBookmarkToCollection?: (bookmarkId: string, collectionId: string) => void;
  } = $props();

  let dragOverId = $state<string | null>(null);

  function isActive(s: Selection): boolean {
    return JSON.stringify(s) === JSON.stringify(selection);
  }

  type FlatNode = { c: Collection; depth: number };

  // Flatten the collection forest into a depth-first list with depth annotations.
  let collectionTree = $derived.by<FlatNode[]>(() => {
    const byParent = new Map<string | null, Collection[]>();
    for (const c of collections) {
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
    for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

    const out: FlatNode[] = [];
    const walk = (parentId: string | null, depth: number): void => {
      const children = byParent.get(parentId);
      if (!children) return;
      for (const c of children) {
        if (depth > 2) continue; // cap at 3 levels (depths 0-2)
        out.push({ c, depth });
        walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  });
</script>

<aside class="w-[12.5rem] shrink-0 px-3 py-4 border-r border-white/5 text-sm">
  <div class="font-semibold tracking-tight mb-4">⏾ midnight</div>

  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 px-2 mt-3 mb-1">Library</div>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'all' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'all' })}>All</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'recent' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'recent' })}>Recent</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'unread' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'unread' })}>Unread</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'starred' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'starred' })}>Starred</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'untagged' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'untagged' })}>Untagged</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'broken' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'broken' })}>Broken</button>

  {#if collectionTree.length > 0}
    <div class="text-[0.625rem] uppercase tracking-wider opacity-50 px-2 mt-4 mb-1">Collections</div>
    {#each collectionTree as { c, depth } (c.id)}
      <button
        class="w-full text-left py-1 rounded hover:bg-white/5 flex items-center gap-2 {isActive({ kind: 'collection', id: c.id }) ? 'bg-white/10' : ''} {dragOverId === c.id ? 'bg-accent-violet/20 ring-1 ring-accent-violet/40' : ''}"
        style="padding-left: {8 + depth * 14}px; padding-right: 8px;"
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
        <span class="w-3 h-3 rounded-sm shrink-0" style="background:{c.color}"></span>
        <span class="flex-1 truncate">{c.name}</span>
      </button>
    {/each}
  {/if}

  {#if tags.length > 0}
    <div class="text-[0.625rem] uppercase tracking-wider opacity-50 px-2 mt-4 mb-1">Tags</div>
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
