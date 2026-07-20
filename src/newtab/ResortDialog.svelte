<script lang="ts">
  import { settings } from '$lib/storage/settings';
  import { gatherScope } from '$lib/ai/resort/scope';
  import { runResort, resortReasonMessage } from '$lib/ai/resort/planner';
  import { planToChanges } from '$lib/ai/resort/diff';
  import { buildPreviewTree } from '$lib/ai/resort/tree';
  import { allKeys, toggle } from '$lib/ai/resort/selection';
  import { applyChanges, type ApplyResult } from '$lib/ai/resort/apply';
  import type { BookmarkRef, Change, FolderNode, ResortScope } from '$lib/ai/resort/types';
  import ResortTree from './ResortTree.svelte';

  let {
    scope,
    scopeLabel,
    onClose,
    onApplied,
  }: {
    scope: ResortScope;
    scopeLabel: string;
    onClose: () => void;
    onApplied: (result: ApplyResult) => void;
  } = $props();

  type Phase = 'planning' | 'preview' | 'applying' | 'error';

  let phase = $state<Phase>('planning');
  let progressLabel = $state('Planning folders…');
  let errorMessage = $state('');
  let folders = $state<FolderNode[]>([]);
  let scopeBookmarks = $state<BookmarkRef[]>([]);
  let changes = $state<Change[]>([]);
  let selected = $state<Set<string>>(new Set());
  let unplannedCount = $state(0);

  const controller = new AbortController();

  const tree = $derived(
    buildPreviewTree({ folders, bookmarks: scopeBookmarks, changes, selected }),
  );
  const selectedCount = $derived(changes.filter((c) => selected.has(c.key)).length);

  function close(): void {
    controller.abort();
    onClose();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }

  function onToggle(key: string): void {
    selected = toggle(changes, selected, key);
  }

  async function apply(): Promise<void> {
    phase = 'applying';
    const accepted = changes.filter((c) => selected.has(c.key));
    const result = await applyChanges(accepted);
    onApplied(result);
  }

  async function plan(): Promise<void> {
    const s = await settings.get();
    if (!s.aiKey) {
      errorMessage = 'No API key set — add one in Settings.';
      phase = 'error';
      return;
    }

    const gathered = await gatherScope(scope);
    folders = gathered.folders;
    scopeBookmarks = gathered.bookmarks;

    if (scopeBookmarks.length === 0) {
      errorMessage = 'Nothing to resort here.';
      phase = 'error';
      return;
    }

    const run = await runResort({
      folders: gathered.folders,
      bookmarks: gathered.bookmarks,
      apiKey: s.aiKey,
      model: s.aiModel,
      signal: controller.signal,
      onProgress: (p) => {
        progressLabel =
          p.phase === 'skeleton' ? 'Planning folders…' : `Filing ${p.done} of ${p.total}…`;
      },
    });

    if (!run.ok) {
      errorMessage = resortReasonMessage(run.reason);
      phase = 'error';
      return;
    }

    unplannedCount = run.plan.unplannedIds.length;
    changes = planToChanges({
      folders: gathered.folders,
      bookmarks: gathered.bookmarks,
      plan: run.plan,
    });
    selected = allKeys(changes);
    phase = 'preview';
  }

  let started = false;
  $effect(() => {
    if (started) return;
    started = true;
    void plan();
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
  role="dialog"
  aria-modal="true"
  aria-label="Resort {scopeLabel}"
>
  <div class="flex flex-col w-full max-w-2xl max-h-full rounded-xl border border-white/10 bg-[#12131a] shadow-2xl">
    <div class="flex items-baseline gap-3 px-5 py-4 border-b border-white/10">
      <h2 class="text-sm font-semibold">Resort — {scopeLabel}</h2>
      {#if phase === 'preview'}
        <span class="text-xs opacity-60">{selectedCount} of {changes.length} changes selected</span>
      {/if}
    </div>

    <div class="flex-1 overflow-y-auto px-5 py-4 min-h-[8rem]">
      {#if phase === 'planning'}
        <p class="text-sm opacity-70">{progressLabel}</p>
      {:else if phase === 'error'}
        <p class="text-sm text-red-300">{errorMessage}</p>
      {:else if phase === 'applying'}
        <p class="text-sm opacity-70">Applying…</p>
      {:else if changes.length === 0}
        <p class="text-sm opacity-70">No changes — this looks already well organized.</p>
      {:else}
        {#if unplannedCount > 0}
          <p class="text-xs opacity-50 mb-3">
            {unplannedCount} bookmark{unplannedCount === 1 ? '' : 's'} couldn't be planned — left where they are.
          </p>
        {/if}
        <ResortTree nodes={tree} {selected} {onToggle} />
      {/if}
    </div>

    <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10">
      <button class="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10" onclick={close}>Cancel</button>
      {#if phase === 'preview' && changes.length > 0}
        <button
          class="text-xs px-3 py-2 rounded-lg bg-accent-violet/25 hover:bg-accent-violet/40 disabled:opacity-40"
          disabled={selectedCount === 0}
          onclick={apply}
        >
          Apply {selectedCount} change{selectedCount === 1 ? '' : 's'}
        </button>
      {/if}
    </div>
  </div>
</div>
