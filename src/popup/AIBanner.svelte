<script lang="ts">
  type State = 'thinking' | 'ready' | 'error' | 'disabled';
  let { state, model, latencyMs }: { state: State; model?: string; latencyMs?: number } = $props();
</script>

<div class="rounded-lg px-3 py-2 flex items-center gap-2 text-[11px] border"
     style="background: {state === 'thinking' || state === 'ready' ? 'rgba(140,150,255,0.06)' : 'rgba(255,255,255,0.04)'}; border-color: {state === 'thinking' || state === 'ready' ? 'rgba(140,150,255,0.3)' : 'rgba(255,255,255,0.1)'}">
  {#if state === 'thinking'}
    <span class="w-1.5 h-1.5 rounded-full bg-accent-violet animate-pulse" style="box-shadow: 0 0 6px var(--color-accent-violet);"></span>
    <span class="opacity-80">Thinking{model ? ` · ${model}` : ''}…</span>
  {:else if state === 'ready'}
    <span class="w-1.5 h-1.5 rounded-full bg-accent-violet"></span>
    <span class="opacity-80">Suggestions ready{model ? ` · ${model}` : ''}{latencyMs ? ` · ${(latencyMs / 1000).toFixed(1)}s` : ''}</span>
  {:else if state === 'error'}
    <span class="opacity-70">⚠ AI request failed — saving without suggestions</span>
  {:else}
    <span class="opacity-50">AI suggestions off · enable in Settings</span>
  {/if}
</div>
