<script lang="ts">
  import type { Suggestion } from '$lib/ai/types';
  import type { Collection } from '$lib/types';

  let {
    suggestion,
    collections,
    onAcceptTitle,
    onAcceptTag,
    onAcceptCollection,
  }: {
    suggestion: Suggestion;
    collections: Collection[];
    onAcceptTitle: (title: string) => void;
    onAcceptTag: (name: string, isNew: boolean) => void;
    onAcceptCollection: (id: string) => void;
  } = $props();

  function colName(id: string): string {
    return collections.find((c) => c.id === id)?.name ?? '?';
  }

  let titleDismissed = $state(false);
  let tagsAccepted = $state<Set<string>>(new Set());
  let collectionAccepted = $state(false);

  function acceptTitle() {
    if (suggestion.suggestedTitle) {
      onAcceptTitle(suggestion.suggestedTitle);
      titleDismissed = true;
    }
  }
  function acceptTag(t: { name: string; isNew: boolean }) {
    onAcceptTag(t.name, t.isNew);
    tagsAccepted = new Set([...tagsAccepted, t.name]);
  }
  function acceptCollection() {
    if (suggestion.suggestedCollectionId) {
      onAcceptCollection(suggestion.suggestedCollectionId);
      collectionAccepted = true;
    }
  }
</script>

{#if suggestion.suggestedTitle && !titleDismissed}
  <div class="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-md bg-accent-violet/10 border border-accent-violet/20 text-[11px]">
    <span class="text-accent-violet">✦</span>
    <span class="flex-1 truncate font-medium">{suggestion.suggestedTitle}</span>
    <button class="px-2 py-0.5 rounded bg-accent-violet/30 text-accent-violet text-[10px]" onclick={acceptTitle}>use</button>
    <button class="px-1.5 py-0.5 rounded bg-white/5 text-[10px]" onclick={() => (titleDismissed = true)} aria-label="Dismiss">×</button>
  </div>
{/if}

{#if suggestion.suggestedTags.length > 0}
  <div class="mt-2 flex flex-wrap gap-1">
    {#each suggestion.suggestedTags as t (t.name)}
      {#if !tagsAccepted.has(t.name)}
        <button
          class="px-2 py-0.5 rounded-full text-[10px] border border-dashed"
          style="background: {t.isNew ? 'rgba(111,230,207,0.08)' : 'rgba(140,150,255,0.08)'}; color: {t.isNew ? 'var(--color-accent-teal)' : 'var(--color-accent-violet)'}; border-color: {t.isNew ? 'rgba(111,230,207,0.3)' : 'rgba(140,150,255,0.3)'}"
          onclick={() => acceptTag(t)}
        >
          {t.isNew ? '+ ' : '✦ '}{t.name}
        </button>
      {/if}
    {/each}
  </div>
{/if}

{#if suggestion.suggestedCollectionId && !collectionAccepted}
  <div class="mt-2 flex items-center gap-2 text-[11px]">
    <span class="opacity-50">Collection:</span>
    <button class="px-2 py-0.5 rounded bg-accent-violet/10 text-accent-violet text-[10px]" onclick={acceptCollection}>
      ✦ {colName(suggestion.suggestedCollectionId)}
    </button>
  </div>
{/if}
