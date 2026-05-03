<script lang="ts">
  import { onMount } from 'svelte';
  import { extractFromDocument, type ExtractedMetadata } from '$lib/metadata/extract';
  import { captureActiveTabThumbnail } from '$lib/metadata/thumbnail';
  import { performSave } from './saveFlow';
  import { bookmarks } from '$lib/storage/bookmarks';
  import { tags as tagsStore } from '$lib/storage/tags';
  import { collections as colStore } from '$lib/storage/collections';
  import { settings } from '$lib/storage/settings';
  import { suggestForBookmarkResult } from '$lib/ai/suggest';
  import type { Bookmark, Collection, Tag } from '$lib/types';
  import type { Suggestion } from '$lib/ai/types';
  import TagPicker from './TagPicker.svelte';
  import CollectionPicker from './CollectionPicker.svelte';
  import AIBanner from './AIBanner.svelte';
  import AISuggestions from './AISuggestions.svelte';

  let bookmark = $state<Bookmark | null>(null);
  let error = $state<string | null>(null);
  let allTags = $state<Tag[]>([]);
  let allCollections = $state<Collection[]>([]);
  let selectedTagIds = $state<string[]>([]);
  let selectedCollectionId = $state<string | null>(null);

  let aiState = $state<'thinking' | 'ready' | 'error' | 'disabled'>('disabled');
  let aiModel = $state<string | undefined>(undefined);
  let aiLatencyMs = $state<number | undefined>(undefined);
  let aiErrorMessage = $state<string | undefined>(undefined);
  let suggestion = $state<Suggestion | null>(null);

  $effect(() => {
    if (!bookmark) return;
    const before = new Set(bookmark.tagIds);
    const after = new Set(selectedTagIds);
    for (const id of after) if (!before.has(id)) bookmarks.addTag(bookmark.id, id);
    for (const id of before) if (!after.has(id)) bookmarks.removeTag(bookmark.id, id);
  });

  $effect(() => {
    if (!bookmark) return;
    if (selectedCollectionId !== bookmark.collectionId) {
      bookmarks.update(bookmark.id, { collectionId: selectedCollectionId });
    }
  });

  async function runAI(b: Bookmark): Promise<void> {
    const s = await settings.get();
    if (!s.aiKey) {
      aiState = 'disabled';
      return;
    }
    aiModel = s.aiModel;
    aiState = 'thinking';
    const t0 = performance.now();
    const result = await suggestForBookmarkResult({
      title: b.originalTitle,
      url: b.url,
      description: b.description,
      excerpt: b.excerpt,
      existingTags: allTags.map((t) => t.name),
      existingCollections: allCollections.map((c) => ({ id: c.id, name: c.name })),
    });
    aiLatencyMs = performance.now() - t0;
    if (!result.ok) {
      aiState = 'error';
      aiErrorMessage = formatReason(result.reason);
      return;
    }
    suggestion = result.suggestion;
    aiState = 'ready';
  }

  function formatReason(r: { kind: string } & Record<string, unknown>): string {
    switch (r.kind) {
      case 'http': return `HTTP ${r['status']}: ${(r['body'] as string)?.slice(0, 200) || (r['message'] as string)}`;
      case 'timeout': return 'Request timed out (10s)';
      case 'parse': return `Bad model output: ${r['message']}`;
      case 'unknown': return r['message'] as string;
      default: return 'Unknown error';
    }
  }

  onMount(async () => {
    [allTags, allCollections] = await Promise.all([tagsStore.list(), colStore.list()]);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://')) {
        error = "Can't save this page (browser internal).";
        return;
      }
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractFromDocument,
      });
      const extracted = result?.result as ExtractedMetadata | undefined;
      if (!extracted) {
        error = "Couldn't read page metadata.";
        return;
      }
      if (!extracted.ogImageUrl) {
        const thumb = await captureActiveTabThumbnail(tab.id);
        if (thumb) extracted.ogImageUrl = thumb;
      }
      const id = await performSave({ url: tab.url, extracted });
      bookmark = await bookmarks.get(id);
      if (bookmark) void runAI(bookmark);
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

  async function acceptTitle(title: string) {
    if (!bookmark) return;
    bookmark = await bookmarks.update(bookmark.id, { title });
  }
  async function acceptTag(name: string, isNew: boolean) {
    if (!bookmark) return;
    if (isNew) {
      const t = await tagsStore.upsertByName(name);
      allTags = await tagsStore.list();
      selectedTagIds = [...selectedTagIds, t.id];
    } else {
      const t = allTags.find((x) => x.name === name);
      if (t && !selectedTagIds.includes(t.id)) selectedTagIds = [...selectedTagIds, t.id];
    }
  }
  function acceptCollection(id: string) {
    selectedCollectionId = id;
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

    <div class="mt-3">
      <AIBanner state={aiState} {...(aiModel ? { model: aiModel } : {})} {...(aiLatencyMs !== undefined ? { latencyMs: aiLatencyMs } : {})} {...(aiErrorMessage ? { errorMessage: aiErrorMessage } : {})} />
      {#if aiState === 'ready' && suggestion}
        <AISuggestions
          {suggestion}
          collections={allCollections}
          onAcceptTitle={acceptTitle}
          onAcceptTag={acceptTag}
          onAcceptCollection={acceptCollection}
        />
      {/if}
    </div>

    <div class="mt-3">
      <div class="text-[10px] uppercase tracking-wide opacity-50 mb-1">Tags</div>
      <TagPicker bind:selectedIds={selectedTagIds} {allTags} />
    </div>
    <div class="mt-3">
      <div class="text-[10px] uppercase tracking-wide opacity-50 mb-1">Collection</div>
      <CollectionPicker bind:selectedId={selectedCollectionId} collections={allCollections} />
    </div>
    <div class="mt-3 text-xs opacity-50">Saved · <button onclick={undoSave} class="underline">undo</button></div>
  {:else}
    <div class="opacity-50">Saving…</div>
  {/if}
</div>
