<script lang="ts">
  let {
    search = $bindable(),
    title,
    count,
    onNewCollection,
  }: { search: string; title: string; count: number; onNewCollection: () => void } = $props();
</script>

<div class="flex items-center gap-3 mb-5">
  <input
    bind:value={search}
    placeholder="Search bookmarks..."
    class="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent-violet/50"
  />
  <button onclick={onNewCollection} class="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">+ Collection</button>
</div>
<div class="mb-4">
  <h1 class="text-2xl font-semibold tracking-tight">
    {title}
    <span class="ml-2 text-xs opacity-50 font-normal">{count} saved</span>
  </h1>
</div>
