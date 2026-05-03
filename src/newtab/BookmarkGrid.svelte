<script lang="ts">
  import type { Bookmark } from '$lib/types';
  import BookmarkCard from './BookmarkCard.svelte';

  let { items, onOpen, onDelete }: { items: Bookmark[]; onOpen: (b: Bookmark) => void; onDelete: (b: Bookmark) => void } = $props();
</script>

{#if items.length === 0}
  <div class="opacity-50 text-sm py-12 text-center">No bookmarks yet — click the toolbar icon on any page to save.</div>
{:else}
  <div class="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] relative">
    {#each items as b (b.id)}
      <div class="relative">
        <BookmarkCard bookmark={b} onOpen={() => onOpen(b)} onDelete={() => onDelete(b)} />
      </div>
    {/each}
  </div>
{/if}
