<script lang="ts">
  import { onMount } from 'svelte';
  import { extractFromDocument, type ExtractedMetadata } from '$lib/metadata/extract';
  import { captureActiveTabThumbnail } from '$lib/metadata/thumbnail';
  import { performSave } from './saveFlow';
  import { bookmarks } from '$lib/storage/bookmarks';
  import type { Bookmark } from '$lib/types';

  let bookmark = $state<Bookmark | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://')) {
        error = "Can't save this page (browser internal).";
        return;
      }

      // Inject extractor into active tab
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractFromDocument,
      });
      const extracted = result?.result as ExtractedMetadata;
      if (!extracted) {
        error = "Couldn't read page metadata.";
        return;
      }

      // og:image fallback to screenshot
      if (!extracted.ogImageUrl) {
        const thumb = await captureActiveTabThumbnail(tab.id);
        if (thumb) (extracted as ExtractedMetadata).ogImageUrl = thumb;
      }

      const id = await performSave({ url: tab.url, extracted });
      bookmark = await bookmarks.get(id);
    } catch (e) {
      error = (e as Error).message;
    }
  });

  async function toggleStar() {
    if (!bookmark) return;
    bookmark = await bookmarks.update(bookmark.id, { starred: !bookmark.starred });
  }

  async function undoSave() {
    if (!bookmark) return;
    await bookmarks.delete(bookmark.id);
    window.close();
  }
</script>

<div class="p-4 w-[320px] text-sm">
  {#if error}
    <div class="opacity-70">{error}</div>
  {:else if bookmark}
    <div class="flex gap-2 items-start">
      {#if bookmark.faviconUrl}
        <img src={bookmark.faviconUrl} alt="" class="w-8 h-8 rounded-md" />
      {:else}
        <div class="w-8 h-8 rounded-md bg-accent-violet/30"></div>
      {/if}
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate">{bookmark.title}</div>
        <div class="opacity-50 text-xs truncate">{bookmark.domain}</div>
      </div>
      <button onclick={toggleStar} class="px-2 py-1 rounded {bookmark.starred ? 'text-yellow-300' : 'opacity-50'}">★</button>
    </div>
    <div class="mt-3 text-xs opacity-50">Saved · <button onclick={undoSave} class="underline">undo</button></div>
  {:else}
    <div class="opacity-50">Saving...</div>
  {/if}
</div>
