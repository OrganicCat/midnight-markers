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
      <div
        class="relative {i === selectedIndex ? 'ring-2 ring-accent-violet rounded-lg' : ''}"
        role="listitem"
        draggable="true"
        ondragstart={(e) => {
          e.dataTransfer?.setData('application/x-bookmark-id', b.id);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <BookmarkCard bookmark={b} onOpen={() => onOpen(b)} onDelete={() => onDelete(b)} />
      </div>
    {/each}
  </div>
{/if}
