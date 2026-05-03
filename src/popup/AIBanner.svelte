<script lang="ts">
  type State = 'thinking' | 'ready' | 'error' | 'disabled';
  let {
    state,
    model,
    latencyMs,
    errorMessage,
  }: {
    state: State;
    model?: string;
    latencyMs?: number;
    errorMessage?: string;
  } = $props();
</script>

<div class="rounded-lg px-3 py-2 text-[11px] border"
     style="background: {state === 'thinking' || state === 'ready' ? 'rgba(140,150,255,0.06)' : 'rgba(255,255,255,0.04)'}; border-color: {state === 'thinking' || state === 'ready' ? 'rgba(140,150,255,0.3)' : 'rgba(255,255,255,0.1)'}">
  {#if state === 'thinking'}
    <div class="flex items-center gap-2">
      <span class="w-1.5 h-1.5 rounded-full bg-accent-violet animate-pulse" style="box-shadow: 0 0 6px var(--color-accent-violet);"></span>
      <span class="opacity-80">Thinking{model ? ` · ${model}` : ''}…</span>
    </div>
  {:else if state === 'ready'}
    <div class="flex items-center gap-2">
      <span class="w-1.5 h-1.5 rounded-full bg-accent-violet"></span>
      <span class="opacity-80">Suggestions ready{model ? ` · ${model}` : ''}{latencyMs ? ` · ${(latencyMs / 1000).toFixed(1)}s` : ''}</span>
    </div>
  {:else if state === 'error'}
    <div class="flex flex-col gap-0.5">
      <div class="opacity-90">⚠ AI request failed</div>
      {#if errorMessage}
        <div class="opacity-60 text-[10px] break-words">{errorMessage}</div>
      {/if}
      <div class="opacity-40 text-[10px]">See popup DevTools console, or Settings → Diagnostics for details.</div>
    </div>
  {:else}
    <span class="opacity-50">AI suggestions off · enable in Settings</span>
  {/if}
</div>
