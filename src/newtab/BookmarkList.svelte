<script lang="ts">
  import type { Bookmark, Collection, Tag } from '$lib/types';

  let {
    items,
    collections,
    tags,
    selectedIndex = -1,
    onOpen,
    onDelete,
  }: {
    items: Bookmark[];
    collections: Collection[];
    tags: Tag[];
    selectedIndex?: number;
    onOpen: (b: Bookmark) => void;
    onDelete: (b: Bookmark) => void;
  } = $props();

  function tagNames(ids: string[]): string[] {
    return ids
      .map((id) => tags.find((t) => t.id === id)?.name)
      .filter((n): n is string => Boolean(n));
  }
  function collectionFor(id: string | null): Collection | undefined {
    return id ? collections.find((c) => c.id === id) : undefined;
  }
  function timeAgo(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  }
</script>

{#if items.length === 0}
  <div class="opacity-50 text-sm py-12 text-center">No bookmarks yet — click the toolbar icon on any page to save.</div>
{:else}
  <div class="flex flex-col">
    {#each items as b, i (b.id)}
      <div
        role="button"
        tabindex="0"
        onclick={() => onOpen(b)}
        onkeydown={(e) => e.key === 'Enter' && onOpen(b)}
        class="grid grid-cols-[16px_1fr_140px_60px_24px] gap-3 items-center py-2 px-2 border-b border-white/5 hover:bg-white/5 cursor-pointer text-sm group {i === selectedIndex ? 'bg-accent-violet/10 ring-1 ring-accent-violet/40 rounded' : ''}"
      >
        {#if b.faviconUrl}
          <img src={b.faviconUrl} alt="" class="w-3.5 h-3.5 rounded-sm" />
        {:else}
          <div class="w-3.5 h-3.5 rounded-sm bg-white/10"></div>
        {/if}

        <div class="min-w-0">
          <div class="font-medium truncate">{b.title}</div>
          <div class="text-[10px] opacity-50 truncate">
            {b.domain}
            {#if collectionFor(b.collectionId)}
              · <span style="color:{collectionFor(b.collectionId)?.color}">{collectionFor(b.collectionId)?.name}</span>
            {/if}
          </div>
        </div>

        <div class="flex flex-wrap gap-1 overflow-hidden max-h-5">
          {#each tagNames(b.tagIds).slice(0, 3) as t (t)}
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5">{t}</span>
          {/each}
        </div>

        <div class="text-[10px] opacity-50 text-right">{timeAgo(b.createdAt)}</div>

        <button
          class="opacity-0 group-hover:opacity-100 text-base leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20"
          onclick={(e) => { e.stopPropagation(); onDelete(b); }}
          aria-label="Delete bookmark"
        >×</button>
      </div>
    {/each}
  </div>
{/if}
