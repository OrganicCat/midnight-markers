<script lang="ts">
  let {
    value = $bindable(),
  }: { value: string } = $props();

  const presets = [
    'anthropic/claude-haiku-4.5',
    'anthropic/claude-sonnet-4.6',
    'openai/gpt-4o-mini',
    'google/gemini-2.0-flash',
    'meta-llama/llama-3.3-70b-instruct',
  ];

  let custom = $state(presets.includes(value) ? '' : value);
  let mode = $state<'preset' | 'custom'>(presets.includes(value) ? 'preset' : 'custom');

  function commit() {
    if (mode === 'custom' && custom.trim()) value = custom.trim();
  }
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-2">Model</div>

  {#if mode === 'preset'}
    <select
      bind:value
      class="w-full bg-black/40 rounded px-3 py-2 text-sm"
      aria-label="Model preset"
    >
      {#each presets as p (p)}
        <option value={p}>{p}</option>
      {/each}
    </select>
    <button class="mt-2 text-xs underline opacity-60 hover:opacity-100" onclick={() => (mode = 'custom')}>Use a different model id…</button>
  {:else}
    <input
      bind:value={custom}
      onblur={commit}
      class="w-full bg-black/40 rounded px-3 py-2 text-xs font-mono"
      placeholder="provider/model-id"
      aria-label="Custom model id"
    />
    <button class="mt-2 text-xs underline opacity-60 hover:opacity-100" onclick={() => (mode = 'preset')}>Choose from presets</button>
  {/if}

  <p class="mt-3 text-xs opacity-50">Default Haiku 4.5 is fastest and cheapest. See <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer noopener" class="underline">openrouter.ai/models</a> for the full catalog.</p>
</div>
