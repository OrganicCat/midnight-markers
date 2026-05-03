<script lang="ts">
  import type { Bookmark } from '$lib/types';
  let { bookmark, onOpen, onDelete }: { bookmark: Bookmark; onOpen: () => void; onDelete: () => void } = $props();
</script>

<div class="bm-card overflow-hidden cursor-pointer group" role="button" tabindex="0" onclick={onOpen} onkeydown={(e) => e.key === 'Enter' && onOpen()}>
  <div class="h-[100px] bg-white/5">
    {#if bookmark.thumbnailUrl}
      <img src={bookmark.thumbnailUrl} alt="" class="w-full h-full object-cover" loading="lazy" />
    {/if}
  </div>
  <div class="p-2.5">
    <div class="flex items-center gap-1.5 mb-1.5">
      {#if bookmark.faviconUrl}
        <img src={bookmark.faviconUrl} alt="" class="w-3.5 h-3.5 rounded-sm" />
      {/if}
      <div class="text-[10px] opacity-50 truncate flex-1">{bookmark.domain}</div>
      {#if bookmark.starred}
        <span class="text-yellow-300 text-xs">★</span>
      {/if}
    </div>
    <div class="text-xs font-medium leading-snug line-clamp-2">{bookmark.title}</div>
  </div>
  <button
    class="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center text-base leading-none rounded-md bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
    onclick={(e) => { e.stopPropagation(); onDelete(); }}
    aria-label="Delete bookmark"
  >×</button>
</div>
