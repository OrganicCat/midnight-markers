<script lang="ts">
  import type { Tag } from '$lib/types';

  let { selectedIds = $bindable(), allTags = [] }: { selectedIds: string[]; allTags: Tag[] } = $props();

  let query = $state('');
  let suggestions = $derived(
    query.trim().length === 0
      ? []
      : allTags
          .filter((t) => t.name.includes(query.trim().toLowerCase()) && !selectedIds.includes(t.id))
          .slice(0, 5),
  );

  function add(t: Tag) {
    selectedIds = [...selectedIds, t.id];
    query = '';
  }
  function remove(id: string) {
    selectedIds = selectedIds.filter((x) => x !== id);
  }

  function selectedPills(): Tag[] {
    return selectedIds
      .map((id) => allTags.find((t) => t.id === id))
      .filter((t): t is Tag => Boolean(t));
  }
</script>

<div class="space-y-1">
  <div class="flex flex-wrap gap-1">
    {#each selectedPills() as t (t.id)}
      <button
        type="button"
        class="text-xs px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/15"
        onclick={() => remove(t.id)}
      >
        {t.name} <span class="opacity-50">×</span>
      </button>
    {/each}
  </div>
  <div class="relative">
    <input
      bind:value={query}
      placeholder="add tag"
      class="w-full bg-white/5 rounded px-2 py-1 text-xs outline-none"
    />
    {#if suggestions.length > 0}
      <div class="absolute mt-1 left-0 right-0 bg-bg-raised border border-white/10 rounded shadow-lg z-10">
        {#each suggestions as s (s.id)}
          <button
            type="button"
            class="block w-full text-left px-2 py-1 text-xs hover:bg-white/5"
            onclick={() => add(s)}
          >
            {s.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
