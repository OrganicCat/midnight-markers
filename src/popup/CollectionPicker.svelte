<script lang="ts">
  import type { Collection } from '$lib/types';

  let {
    selectedId = $bindable(),
    collections = [],
  }: { selectedId: string | null; collections: Collection[] } = $props();
</script>

<select
  class="w-full bg-white/5 rounded px-2 py-1 text-xs outline-none"
  bind:value={selectedId}
>
  <option value={null}>(none)</option>
  {#each collections as c (c.id)}
    <option value={c.id}>{c.name}</option>
  {/each}
</select>
