<script lang="ts">
  import type { Collection, Tag, SmartFilter } from '$lib/types';
  import { ext } from '$lib/ext';

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
    onMoveCollection,
    onResortCollection,
    onRenameCollection,
    onDeleteCollection,
    onMergeDuplicates,
  }: {
    collections: Collection[];
    tags: Tag[];
    selection: Selection;
    onSelect: (s: Selection) => void;
    onMoveBookmarkToCollection?: (bookmarkId: string, collectionId: string) => void;
    onMoveCollection?: (id: string, parentId: string | null, index: number) => void;
    onResortCollection?: (id: string) => void;
    onRenameCollection?: (id: string) => void;
    onDeleteCollection?: (id: string) => void;
    onMergeDuplicates?: (id: string) => void;
  } = $props();

  // Right-click menu on a collection row.
  let menuFor = $state<{ id: string; x: number; y: number } | null>(null);

  const hasMenu = $derived(
    !!onResortCollection || !!onRenameCollection || !!onDeleteCollection || !!onMergeDuplicates,
  );

  function openMenu(e: MouseEvent, id: string): void {
    if (!hasMenu) return;
    e.preventDefault();
    menuFor = { id, x: e.clientX, y: e.clientY };
  }

  function closeMenu(): void {
    menuFor = null;
  }

  /**
   * Same-named siblings of the right-clicked collection. Current builds refuse
   * to create these, but libraries made before that guard can still hold them,
   * and they are the one thing the sidebar cannot otherwise tell apart.
   */
  const duplicatesOfMenuTarget = $derived.by<Collection[]>(() => {
    const id = menuFor?.id;
    if (!id) return [];
    const self = collections.find((c) => c.id === id);
    if (!self) return [];
    const name = self.name.trim().toLowerCase();
    return collections.filter(
      (c) => c.id !== id && c.parentId === self.parentId && c.name.trim().toLowerCase() === name,
    );
  });

  const COLLECTION_MIME = 'application/x-collection-id';
  const BOOKMARK_MIME = 'application/x-bookmark-id';

  // Highlight for a bookmark being dragged onto a collection (drop = move bookmark in).
  let dragOverId = $state<string | null>(null);
  // The collection currently being dragged, and where it would land.
  let draggingId = $state<string | null>(null);
  type Zone = 'before' | 'into' | 'after';
  let dropTarget = $state<{ id: string; zone: Zone } | null>(null);
  let rootDropActive = $state(false);

  function isActive(s: Selection): boolean {
    return JSON.stringify(s) === JSON.stringify(selection);
  }

  function isCollectionDrag(e: DragEvent): boolean {
    return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes(COLLECTION_MIME);
  }

  // Ordered siblings of `parentId`, excluding the collection being dragged.
  function siblingsOf(parentId: string | null): Collection[] {
    return collections
      .filter((c) => c.parentId === parentId && c.id !== draggingId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function clearDrag(): void {
    draggingId = null;
    dropTarget = null;
    rootDropActive = false;
  }

  function onCollectionDragOver(e: DragEvent, target: Collection): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    const zone: Zone = y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'into';
    dropTarget = { id: target.id, zone };
  }

  function onCollectionDrop(e: DragEvent, target: Collection): void {
    const id = e.dataTransfer?.getData(COLLECTION_MIME);
    const zone = dropTarget?.zone ?? 'into';
    // Compute the landing slot while `draggingId` is still set so siblingsOf()
    // excludes the dragged collection, then clear the drag state.
    let move: { parentId: string | null; index: number } | null = null;
    if (id && id !== target.id && onMoveCollection) {
      if (zone === 'into') {
        move = { parentId: target.id, index: siblingsOf(target.id).length };
      } else {
        const group = siblingsOf(target.parentId);
        const pos = group.findIndex((c) => c.id === target.id);
        const index = pos < 0 ? group.length : zone === 'before' ? pos : pos + 1;
        move = { parentId: target.parentId, index };
      }
    }
    clearDrag();
    if (id && move && onMoveCollection) onMoveCollection(id, move.parentId, move.index);
  }

  type FlatNode = { c: Collection; depth: number };

  // Flatten the collection forest into a depth-first list with depth annotations.
  let collectionTree = $derived.by<FlatNode[]>(() => {
    // Local to this derivation, rebuilt each run, never reactive state.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const byParent = new Map<string | null, Collection[]>();
    for (const c of collections) {
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
    for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

    const out: FlatNode[] = [];
    // Cycle guard local to this derivation; never read outside it.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const seen = new Set<string>();
    const walk = (parentId: string | null, depth: number): void => {
      const children = byParent.get(parentId);
      if (!children) return;
      for (const c of children) {
        if (seen.has(c.id)) continue; // guard against malformed cycles
        seen.add(c.id);
        out.push({ c, depth });
        walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  });
</script>

<aside data-tour="sidebar" class="w-[12.5rem] shrink-0 px-3 py-4 border-r border-white/5 text-sm">
  <div class="font-semibold tracking-tight mb-4">⏾ midnight</div>

  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 px-2 mt-3 mb-1">Library</div>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'all' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'all' })}>All</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'recent' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'recent' })}>Recent</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'unread' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'unread' })}>Unread</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'starred' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'starred' })}>Starred</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'untagged' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'untagged' })}>Untagged</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'broken' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'broken' })}>Broken</button>

  {#if collectionTree.length > 0}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="text-[0.625rem] uppercase tracking-wider opacity-50 px-2 mt-4 mb-1 rounded {rootDropActive ? 'bg-accent-violet/20 ring-1 ring-accent-violet/40 opacity-100' : ''}"
      ondragover={(e) => { if (!isCollectionDrag(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; rootDropActive = true; }}
      ondragleave={() => { rootDropActive = false; }}
      ondrop={(e) => {
        if (!isCollectionDrag(e)) return;
        e.preventDefault();
        const id = e.dataTransfer?.getData(COLLECTION_MIME);
        const index = siblingsOf(null).length;
        clearDrag();
        if (id && onMoveCollection) onMoveCollection(id, null, index);
      }}
    >Collections</div>
    {#each collectionTree as { c, depth } (c.id)}
      <button
        draggable="true"
        class="w-full text-left py-1 rounded hover:bg-white/5 flex items-center gap-2 {isActive({ kind: 'collection', id: c.id }) ? 'bg-white/10' : ''} {dragOverId === c.id || (dropTarget?.id === c.id && dropTarget.zone === 'into') ? 'bg-accent-violet/20 ring-1 ring-accent-violet/40' : ''} {dropTarget?.id === c.id && dropTarget.zone === 'before' ? 'shadow-[inset_0_2px_0_0_var(--color-accent-violet)]' : ''} {dropTarget?.id === c.id && dropTarget.zone === 'after' ? 'shadow-[inset_0_-2px_0_0_var(--color-accent-violet)]' : ''} {draggingId === c.id ? 'opacity-40' : ''}"
        style="padding-left: {8 + depth * 14}px; padding-right: 8px;"
        onclick={() => onSelect({ kind: 'collection', id: c.id })}
        oncontextmenu={(e) => openMenu(e, c.id)}
        ondragstart={(e) => {
          draggingId = c.id;
          if (e.dataTransfer) {
            e.dataTransfer.setData(COLLECTION_MIME, c.id);
            e.dataTransfer.effectAllowed = 'move';
          }
        }}
        ondragend={clearDrag}
        ondragover={(e) => {
          if (isCollectionDrag(e)) { onCollectionDragOver(e, c); return; }
          e.preventDefault();
          dragOverId = c.id;
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        }}
        ondragleave={() => {
          if (dragOverId === c.id) dragOverId = null;
          if (dropTarget?.id === c.id) dropTarget = null;
        }}
        ondrop={(e) => {
          e.preventDefault();
          if (isCollectionDrag(e)) { onCollectionDrop(e, c); return; }
          const id = e.dataTransfer?.getData(BOOKMARK_MIME);
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
      onclick={() => ext.runtime.openOptionsPage()}
    >
      ⚙ Settings
    </button>
  </div>
</aside>

{#if menuFor}
  <button
    class="fixed inset-0 z-40 cursor-default"
    aria-label="Close menu"
    onclick={closeMenu}
    oncontextmenu={(e) => { e.preventDefault(); closeMenu(); }}
  ></button>
  <div
    class="fixed z-50 rounded-lg border border-white/10 bg-[#12131a] py-1 shadow-xl"
    style="left: {menuFor.x}px; top: {menuFor.y}px"
  >
    {#if onRenameCollection}
      <button
        class="block w-full text-left text-xs px-3 py-1.5 hover:bg-white/10 whitespace-nowrap"
        onclick={() => { const id = menuFor!.id; closeMenu(); onRenameCollection(id); }}
      >Rename…</button>
    {/if}
    {#if onMergeDuplicates && duplicatesOfMenuTarget.length > 0}
      <button
        class="block w-full text-left text-xs px-3 py-1.5 hover:bg-white/10 whitespace-nowrap"
        onclick={() => { const id = menuFor!.id; closeMenu(); onMergeDuplicates(id); }}
      >Merge {duplicatesOfMenuTarget.length} duplicate{duplicatesOfMenuTarget.length === 1 ? '' : 's'} into this</button>
    {/if}
    {#if onResortCollection}
      <button
        class="block w-full text-left text-xs px-3 py-1.5 hover:bg-white/10 whitespace-nowrap"
        onclick={() => { const id = menuFor!.id; closeMenu(); onResortCollection(id); }}
      >✦ Resort this folder</button>
    {/if}
    {#if onDeleteCollection}
      <div class="my-1 border-t border-white/10"></div>
      <button
        class="block w-full text-left text-xs px-3 py-1.5 hover:bg-white/10 whitespace-nowrap text-red-300"
        onclick={() => { const id = menuFor!.id; closeMenu(); onDeleteCollection(id); }}
      >Delete</button>
    {/if}
  </div>
{/if}
