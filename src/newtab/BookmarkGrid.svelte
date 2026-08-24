<script lang="ts">
  import type { Bookmark } from '$lib/types';
  import BookmarkCard from './BookmarkCard.svelte';

  let {
    items,
    selectedIndex = -1,
    onOpen,
    onDelete,
    onFocusItem = () => {},
  }: {
    items: Bookmark[];
    selectedIndex?: number;
    onOpen: (b: Bookmark, background?: boolean) => void;
    onDelete: (b: Bookmark) => void;
    /** Tabbing to a card moves the keyboard cursor onto it. */
    onFocusItem?: (id: string) => void;
  } = $props();
</script>

{#if items.length === 0}
  <div class="opacity-50 text-sm py-12 text-center">No bookmarks yet — click the toolbar icon on any page to save.</div>
{:else}
  <div class="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] relative" data-bookmark-grid>
    {#each items as b, i (b.id)}
      <div
        class="relative {i === selectedIndex ? 'ring-2 ring-accent-violet rounded-lg' : ''}"
        role="listitem"
        data-nav-key={b.id}
        onfocusin={() => onFocusItem(b.id)}
        draggable="true"
        ondragstart={(e) => {
          e.dataTransfer?.setData('application/x-bookmark-id', b.id);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <BookmarkCard bookmark={b} onOpen={(background) => onOpen(b, background)} onDelete={() => onDelete(b)} />
      </div>
    {/each}
  </div>
{/if}
