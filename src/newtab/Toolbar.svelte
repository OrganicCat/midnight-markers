<script lang="ts">
  let {
    search = $bindable(),
    title,
    count,
    view = $bindable(),
    onNewCollection,
  }: {
    search: string;
    title: string;
    count: number;
    view: 'grid' | 'list';
    onNewCollection: () => void;
  } = $props();
</script>

<div class="flex items-center gap-3 mb-5">
  <input
    bind:value={search}
    placeholder="Search bookmarks..."
    class="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent-violet/50"
  />
  <div class="flex items-center bg-white/5 rounded-lg p-0.5">
    <button
      class="px-2.5 py-1.5 rounded {view === 'grid' ? 'bg-white/10 text-white' : 'opacity-50 hover:opacity-100'}"
      onclick={() => (view = 'grid')}
      aria-label="Grid view"
      title="Grid view (1)"
    >⊞</button>
    <button
      class="px-2.5 py-1.5 rounded {view === 'list' ? 'bg-white/10 text-white' : 'opacity-50 hover:opacity-100'}"
      onclick={() => (view = 'list')}
      aria-label="List view"
      title="List view (2)"
    >≡</button>
  </div>
  <button onclick={onNewCollection} class="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">+ Collection</button>
</div>
<div class="mb-4">
  <h1 class="text-2xl font-semibold tracking-tight">
    {title}
    <span class="ml-2 text-xs opacity-50 font-normal">{count} saved</span>
  </h1>
</div>
