<script lang="ts">
  import { untrack } from 'svelte';

  let {
    value = $bindable(),
    presets,
    providerLabel,
    modelsUrl,
  }: {
    value: string;
    presets: string[];
    providerLabel: string;
    modelsUrl: string;
  } = $props();

  const startsAsPreset = untrack(() => presets.includes(value));
  let custom = $state(startsAsPreset ? '' : untrack(() => value));
  let mode = $state<'preset' | 'custom'>(startsAsPreset ? 'preset' : 'custom');

  // Re-derive the mode when the *provider* swaps the preset list underneath us,
  // otherwise an OpenRouter id can sit in the picker while Anthropic is active.
  //
  // Deliberately keyed on the preset list alone: reacting to `value` too would
  // snap the picker back to preset mode the instant the user clicked through to
  // custom entry, since at that moment `value` is still a preset.
  let lastPresets = untrack(() => presets);
  $effect(() => {
    if (presets === lastPresets) return;
    lastPresets = presets;
    const current = untrack(() => value);
    const isPreset = presets.includes(current);
    mode = isPreset ? 'preset' : 'custom';
    custom = isPreset ? '' : current;
  });

  function commit() {
    if (mode === 'custom' && custom.trim()) value = custom.trim();
  }
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-2">Model</div>

  {#if mode === 'preset'}
    <!-- The select is wrapped so switching modes detaches this div rather than
         the select itself: HTMLSelectElement.remove() is the remove-option-by-
         index API, which shadows ChildNode.remove() and blows up on teardown. -->
    <div>
      <select
        bind:value
        class="w-full bg-black/40 rounded px-3 py-2 text-sm"
        aria-label="Model preset"
      >
        {#each presets as p (p)}
          <option value={p}>{p}</option>
        {/each}
      </select>
    </div>
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

  <p class="mt-3 text-xs opacity-50">Haiku is the fastest and cheapest option. See the <a href={modelsUrl} target="_blank" rel="noreferrer noopener" class="underline">{providerLabel} model list</a> for the full catalog.</p>
</div>
