<script lang="ts">
  type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

  let {
    currentKey,
    providerLabel,
    keysUrl,
    keyPlaceholder,
    onSave,
    onRemove,
    onTest,
  }: {
    currentKey: string | null;
    providerLabel: string;
    keysUrl: string;
    keyPlaceholder: string;
    onSave: (key: string) => void | Promise<void>;
    onRemove: () => void | Promise<void>;
    onTest: () => Promise<TestStatus>;
  } = $props();

  let editing = $state(false);
  let draft = $state('');
  let status = $state<TestStatus>('idle');

  // Switching provider swaps which key this form is bound to, so a stale
  // "✓ OK" from the previous provider must not linger over the new one.
  $effect(() => {
    void providerLabel;
    status = 'idle';
    editing = false;
    draft = '';
  });

  function maskKey(k: string): string {
    if (k.length <= 12) return k;
    return k.slice(0, 8) + '•'.repeat(Math.min(24, k.length - 12)) + k.slice(-4);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await onSave(trimmed);
    draft = '';
    editing = false;
    status = 'idle';
  }

  async function test() {
    status = 'testing';
    status = await onTest();
  }
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-2">{providerLabel} API key</div>

  {#if !currentKey && !editing}
    <p class="text-sm opacity-70">No key set. Add one to enable AI suggestions.</p>
    <button class="mt-3 px-3 py-1.5 rounded bg-accent-violet/20 text-sm" onclick={() => (editing = true)}>Add key</button>
  {:else if !editing}
    <input
      class="w-full bg-black/40 rounded px-3 py-2 text-xs font-mono"
      value={maskKey(currentKey ?? '')}
      readonly
      aria-label="{providerLabel} API key (masked)"
    />
    <div class="flex gap-2 mt-3">
      <button class="px-3 py-1.5 rounded bg-white/5 text-xs" onclick={() => (editing = true)}>Change</button>
      <button class="px-3 py-1.5 rounded bg-white/5 text-xs" onclick={test}>
        {#if status === 'testing'}Testing…{:else if status === 'ok'}✓ OK{:else if status === 'fail'}✗ Failed{:else}Test connection{/if}
      </button>
      <button class="px-3 py-1.5 rounded bg-red-500/15 text-red-300 text-xs ml-auto" onclick={onRemove}>Remove key</button>
    </div>
  {:else}
    <input
      type="password"
      class="w-full bg-black/40 rounded px-3 py-2 text-xs font-mono"
      bind:value={draft}
      placeholder={keyPlaceholder}
      aria-label="{providerLabel} API key"
    />
    <div class="flex gap-2 mt-3">
      <button class="px-3 py-1.5 rounded bg-accent-violet/20 text-xs" onclick={save}>Save</button>
      <button class="px-3 py-1.5 rounded bg-white/5 text-xs" onclick={() => { editing = false; draft = ''; }}>Cancel</button>
    </div>
    <p class="mt-3 text-xs opacity-50">Get a key from <a href={keysUrl} target="_blank" rel="noreferrer noopener" class="underline">{providerLabel}</a>.</p>
  {/if}
</div>
