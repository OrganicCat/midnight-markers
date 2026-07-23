<script lang="ts">
  import type { Bookmark, Tag } from '$lib/types';
  import type { ListRow } from './listTree';

  let {
    rows,
    tags,
    selectedId = null,
    onOpen,
    onDelete,
    onToggleCollection,
  }: {
    rows: ListRow[];
    tags: Tag[];
    /** Id of the keyboard-selected bookmark, or null when nothing is selected. */
    selectedId?: string | null;
    onOpen: (b: Bookmark) => void;
    onDelete: (b: Bookmark) => void;
    onToggleCollection: (id: string) => void;
  } = $props();

  /** Indent per tree level, in rem, so it scales with the UI-scale setting. */
  const INDENT = 1;

  function tagNames(ids: string[]): string[] {
    return ids
      .map((id) => tags.find((t) => t.id === id)?.name)
      .filter((n): n is string => Boolean(n));
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

{#if rows.length === 0}
  <div class="opacity-50 text-sm py-12 text-center">No bookmarks yet — click the toolbar icon on any page to save.</div>
{:else}
  <div class="flex flex-col" role="tree" aria-label="Bookmarks by collection">
    {#each rows as row (row.key)}
      {#if row.kind === 'collection'}
        <button
          type="button"
          role="treeitem"
          aria-expanded={row.expanded}
          aria-selected="false"
          aria-level={row.depth + 1}
          aria-label="{row.collection.name}, {row.count} bookmark{row.count === 1 ? '' : 's'}"
          onclick={() => onToggleCollection(row.collection.id)}
          class="flex items-center gap-2 py-2 pr-2 border-b border-white/5 hover:bg-white/5 cursor-pointer text-sm text-left w-full"
          style="padding-left: {0.5 + row.depth * INDENT}rem"
        >
          <svg
            class="w-2.5 h-2.5 shrink-0 opacity-50 transition-transform {row.expanded ? 'rotate-90' : ''}"
            viewBox="0 0 8 8"
            aria-hidden="true"
          >
            <path d="M2 0.5 L6.5 4 L2 7.5 Z" fill="currentColor" />
          </svg>
          <span class="w-3 h-3 rounded-sm shrink-0" style="background:{row.collection.color}"></span>
          <span class="font-medium truncate">{row.collection.name}</span>
          <span class="text-[0.625rem] opacity-40 shrink-0">{row.count}</span>
        </button>
      {:else}
        <div
          role="treeitem"
          aria-selected={row.bookmark.id === selectedId}
          aria-level={row.depth + 1}
          tabindex="0"
          draggable="true"
          ondragstart={(e) => {
            e.dataTransfer?.setData('application/x-bookmark-id', row.bookmark.id);
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
          }}
          onclick={() => onOpen(row.bookmark)}
          onkeydown={(e) => e.key === 'Enter' && onOpen(row.bookmark)}
          class="grid grid-cols-[1rem_1fr_8.75rem_3.75rem_1.5rem] gap-3 items-center py-2 pr-2 border-b border-white/5 hover:bg-white/5 cursor-pointer text-sm group {row.bookmark.id === selectedId ? 'bg-accent-violet/10 ring-1 ring-accent-violet/40 rounded' : ''}"
          style="padding-left: {0.5 + row.depth * INDENT}rem"
        >
          {#if row.bookmark.faviconUrl}
            <img src={row.bookmark.faviconUrl} alt="" class="w-3.5 h-3.5 rounded-sm" />
          {:else}
            <div class="w-3.5 h-3.5 rounded-sm bg-white/10"></div>
          {/if}

          <div class="min-w-0">
            <div class="font-medium truncate">{row.bookmark.title}</div>
            <div class="text-[0.625rem] opacity-50 truncate">{row.bookmark.domain}</div>
          </div>

          <div class="flex flex-wrap gap-1 overflow-hidden max-h-5">
            {#each tagNames(row.bookmark.tagIds).slice(0, 3) as t (t)}
              <span class="text-[0.5625rem] px-1.5 py-0.5 rounded bg-white/5">{t}</span>
            {/each}
          </div>

          <div class="text-[0.625rem] opacity-50 text-right">{timeAgo(row.bookmark.createdAt)}</div>

          <button
            class="opacity-0 group-hover:opacity-100 text-base leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20"
            onclick={(e) => { e.stopPropagation(); onDelete(row.bookmark); }}
            aria-label="Delete bookmark"
          >×</button>
        </div>
      {/if}
    {/each}
  </div>
{/if}
