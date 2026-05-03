<script lang="ts">
  import type { Suggestion } from '$lib/ai/types';
  import type { Collection } from '$lib/types';

  let {
    suggestion,
    collections,
    appliedTagNames = new Set(),
    appliedCollectionId = null,
    onAcceptTitle,
    onAcceptTag,
  }: {
    suggestion: Suggestion;
    collections: Collection[];
    appliedTagNames?: Set<string>;
    appliedCollectionId?: string | null;
    onAcceptTitle: (title: string) => void;
    onAcceptTag: (name: string, isNew: boolean) => void;
  } = $props();

  let titleDismissed = $state(false);
  let tagsManuallyAccepted = $state<Set<string>>(new Set());

  function colName(id: string): string {
    return collections.find((c) => c.id === id)?.name ?? '?';
  }

  function acceptTitle() {
    if (suggestion.suggestedTitle) {
      onAcceptTitle(suggestion.suggestedTitle);
      titleDismissed = true;
    }
  }
  function acceptTag(t: { name: string; isNew: boolean }) {
    onAcceptTag(t.name, t.isNew);
    tagsManuallyAccepted = new Set([...tagsManuallyAccepted, t.name]);
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

{#if suggestion.suggestedCollectionPath && appliedCollectionId}
  <div class="mt-2 flex items-center gap-2 text-[11px]">
    <span class="text-accent-teal">✓</span>
    <span class="opacity-70">Filed in:</span>
    <span class="text-accent-violet font-medium">{suggestion.suggestedCollectionPath.join(' › ')}</span>
    <span class="opacity-40 text-[10px] ml-auto">(change below)</span>
  </div>
{/if}

{#if suggestion.suggestedTags.length > 0}
  <div class="mt-2">
    <div class="flex flex-wrap gap-1">
      {#each suggestion.suggestedTags as t (t.name)}
        {#if !appliedTagNames.has(t.name) && !tagsManuallyAccepted.has(t.name)}
          <button
            class="px-2 py-0.5 rounded-full text-[10px] border border-dashed"
            style="background: {t.isNew ? 'rgba(111,230,207,0.08)' : 'rgba(140,150,255,0.08)'}; color: {t.isNew ? 'var(--color-accent-teal)' : 'var(--color-accent-violet)'}; border-color: {t.isNew ? 'rgba(111,230,207,0.3)' : 'rgba(140,150,255,0.3)'}"
            title={t.isNew ? 'New tag — will be created when added' : 'Existing tag from your library'}
            onclick={() => acceptTag(t)}
          >
            {t.isNew ? '+ ' : '✦ '}{t.name}
          </button>
        {/if}
      {/each}
    </div>
    {#if suggestion.suggestedTags.some((t) => !appliedTagNames.has(t.name) && !tagsManuallyAccepted.has(t.name))}
      <div class="mt-1.5 text-[9px] opacity-40 flex gap-3">
        <span><span class="text-accent-violet">✦</span> existing tag</span>
        <span><span class="text-accent-teal">+</span> new tag</span>
      </div>
    {/if}
  </div>
{/if}
