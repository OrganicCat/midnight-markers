<script lang="ts">
  import { PROVIDERS } from '$lib/ai/provider';
  import type { ProviderId } from '$lib/types';

  let {
    value = $bindable(),
    hasKey,
  }: {
    value: ProviderId;
    /** Which providers already have a key stored, for the "key saved" hint. */
    hasKey: Record<ProviderId, boolean>;
  } = $props();
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-3">AI provider</div>

  <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="AI provider">
    {#each PROVIDERS as p (p.id)}
      <button
        type="button"
        role="radio"
        aria-checked={value === p.id}
        class="rounded-lg px-3 py-2.5 text-left border transition-colors {value === p.id
          ? 'border-accent-violet/50 bg-accent-violet/15'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
        onclick={() => (value = p.id)}
      >
        <div class="text-sm">{p.label}</div>
        <div class="text-[0.625rem] opacity-50 mt-0.5">
          {hasKey[p.id] ? 'Key saved' : 'No key yet'}
        </div>
      </button>
    {/each}
  </div>

  <p class="mt-3 text-xs opacity-50">
    Both keys are kept when you switch, so you can move between providers without pasting again.
  </p>
</div>
