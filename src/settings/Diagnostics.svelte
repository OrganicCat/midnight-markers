<script lang="ts">
  import { onMount } from 'svelte';
  import { getLastAIError, clearLastAIError, type LastAIError } from '$lib/log';

  let lastError = $state<LastAIError | null>(null);
  let copyStatus = $state<'idle' | 'copied'>('idle');

  async function refresh() {
    lastError = await getLastAIError();
  }

  onMount(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  });

  async function copyToClipboard() {
    if (!lastError) return;
    const text = JSON.stringify(lastError, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      copyStatus = 'copied';
      setTimeout(() => (copyStatus = 'idle'), 1500);
    } catch {
      // ignore
    }
  }

  async function clear() {
    await clearLastAIError();
    lastError = null;
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
  }
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-3">Diagnostics</div>

  {#if lastError}
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-3">
        <div class="text-xs">
          <div class="font-medium">Last AI error</div>
          <div class="opacity-50 text-[0.625rem]">{formatTime(lastError.ts)}</div>
        </div>
        <div class="flex gap-2">
          <button class="px-2 py-1 rounded bg-white/5 text-xs" onclick={copyToClipboard}>
            {copyStatus === 'copied' ? 'Copied!' : 'Copy JSON'}
          </button>
          <button class="px-2 py-1 rounded bg-white/5 text-xs" onclick={clear}>Clear</button>
        </div>
      </div>

      <div class="bg-black/40 rounded p-3 font-mono text-[0.625rem] leading-relaxed space-y-1">
        <div><span class="opacity-50">message:</span> <span class="text-red-300">{lastError.message}</span></div>
        {#if lastError.status !== undefined}
          <div><span class="opacity-50">status:</span> {lastError.status}</div>
        {/if}
        {#if lastError.model}
          <div><span class="opacity-50">model:</span> {lastError.model}</div>
        {/if}
        {#if lastError.url}
          <div><span class="opacity-50">url:</span> {lastError.url}</div>
        {/if}
        {#if lastError.body}
          <div class="opacity-50 mt-2">body:</div>
          <pre class="whitespace-pre-wrap break-all opacity-80">{lastError.body.slice(0, 1000)}</pre>
        {/if}
      </div>
    </div>
  {:else}
    <p class="text-xs opacity-50">No recent AI errors recorded.</p>
  {/if}

  <p class="mt-3 text-[0.625rem] opacity-50 leading-relaxed">
    Verbose request/response logs print to the popup's DevTools console. Right-click the toolbar icon → Inspect popup → Console.
  </p>
</div>
