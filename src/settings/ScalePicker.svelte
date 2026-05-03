<script lang="ts">
  import { SCALE_OPTIONS, setRootScale } from '$lib/ui-scale';

  let { value = $bindable() }: { value: number } = $props();

  function pick(v: number) {
    value = v;
    // Apply immediately so the user sees the change before saving propagates
    setRootScale(v);
  }
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-2">UI scale</div>
  <p class="text-xs opacity-60 mb-3">Applies to the popup, new tab, and this settings page.</p>

  <div class="flex gap-1.5 flex-wrap">
    {#each SCALE_OPTIONS as opt (opt.value)}
      <button
        class="px-3 py-1.5 rounded text-xs {value === opt.value ? 'bg-accent-violet/20 text-accent-violet ring-1 ring-accent-violet/40' : 'bg-white/5 hover:bg-white/10'}"
        onclick={() => pick(opt.value)}
      >
        {opt.label}
      </button>
    {/each}
  </div>
</div>
