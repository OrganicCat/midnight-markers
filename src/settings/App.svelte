<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from '$lib/storage/settings';
  import { validateKey } from '$lib/ai/openrouter';
  import type { Settings } from '$lib/types';
  import KeyForm from './KeyForm.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import PrivacyNote from './PrivacyNote.svelte';
  import DataSection from './DataSection.svelte';
  import Diagnostics from './Diagnostics.svelte';
  import ScalePicker from './ScalePicker.svelte';

  let s = $state<Settings | null>(null);
  let modelDraft = $state<string>('anthropic/claude-haiku-4.5');
  let scaleDraft = $state<number>(1);

  async function refresh() {
    s = await settings.get();
    modelDraft = s.aiModel;
    scaleDraft = s.uiScale;
  }

  onMount(refresh);

  async function saveKey(key: string) {
    await settings.set({ aiKey: key });
    await refresh();
  }
  async function removeKey() {
    if (!confirm('Remove the saved API key? AI suggestions will stop until you add one again.')) return;
    await settings.set({ aiKey: null });
    await refresh();
  }
  async function testConnection(): Promise<'idle' | 'testing' | 'ok' | 'fail'> {
    if (!s?.aiKey) return 'fail';
    const ok = await validateKey(s.aiKey);
    return ok ? 'ok' : 'fail';
  }

  async function setModel(m: string) {
    await settings.set({ aiModel: m });
    await refresh();
  }

  async function toggleFeature(k: 'tags' | 'title' | 'collection') {
    if (!s) return;
    await settings.set({ aiFeatures: { ...s.aiFeatures, [k]: !s.aiFeatures[k] } });
    await refresh();
  }

  // Sync ModelPicker's bindable value back to settings when it changes.
  // We compare against s.aiModel (the persisted truth) to avoid writing on
  // refresh-driven sync.
  $effect(() => {
    if (!s) return;
    if (modelDraft && modelDraft !== s.aiModel) {
      void setModel(modelDraft);
    }
  });

  $effect(() => {
    if (!s) return;
    if (scaleDraft !== s.uiScale) {
      void settings.set({ uiScale: scaleDraft }).then(refresh);
    }
  });
</script>

<div class="min-h-screen p-10" style="background: linear-gradient(180deg, #0b0c14 0%, #14172a 100%);">
  <div class="max-w-2xl mx-auto space-y-5">
    <header>
      <h1 class="text-3xl font-semibold tracking-tight">Settings</h1>
      <p class="text-xs opacity-50 mt-1">midnight-markers · v0.2.0</p>
    </header>

    {#if s}
      <KeyForm
        currentKey={s.aiKey}
        onSave={saveKey}
        onRemove={removeKey}
        onTest={testConnection}
      />

      <ModelPicker bind:value={modelDraft} />

      <ScalePicker bind:value={scaleDraft} />

      <div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
        <div class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-3">AI features</div>
        {#each [['tags','Suggest tags','Prefer existing · max 2 new per save'],['title','Suggest title','Show a friendlier title; original always recoverable'],['collection','Suggest collection','Pick from existing collections only']] as [key, label, desc]}
          <label class="flex items-start justify-between gap-4 py-2">
            <div>
              <div class="text-sm">{label}</div>
              <div class="text-xs opacity-50">{desc}</div>
            </div>
            <input
              type="checkbox"
              checked={s.aiFeatures[key as 'tags'|'title'|'collection']}
              onchange={() => toggleFeature(key as 'tags'|'title'|'collection')}
              class="mt-1 accent-accent-violet"
            />
          </label>
        {/each}
      </div>

      <PrivacyNote />
      <Diagnostics />
      <DataSection />
    {:else}
      <p class="opacity-50">Loading…</p>
    {/if}
  </div>
</div>
