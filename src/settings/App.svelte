<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from '$lib/storage/settings';
  import { getProvider } from '$lib/ai/provider';
  import type { ProviderId, Settings } from '$lib/types';
  import KeyForm from './KeyForm.svelte';
  import ProviderPicker from './ProviderPicker.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import PrivacyNote from './PrivacyNote.svelte';
  import DataSection from './DataSection.svelte';
  import Diagnostics from './Diagnostics.svelte';
  import ScalePicker from './ScalePicker.svelte';

  // Read from the manifest rather than hardcoding, so the footer can't drift
  // out of step with the version that actually shipped.
  const build = (() => {
    try {
      const m = chrome?.runtime?.getManifest?.();
      return m ? `${m.name} · v${m.version}` : '';
    } catch {
      return '';
    }
  })();

  let s = $state<Settings | null>(null);
  let modelDraft = $state<string>('anthropic/claude-haiku-4.5');
  let providerDraft = $state<ProviderId>('openrouter');
  let scaleDraft = $state<number>(1);

  const provider = $derived(getProvider(providerDraft));
  const currentKey = $derived(
    s === null ? null : providerDraft === 'anthropic' ? s.anthropicKey : s.openrouterKey,
  );

  async function refresh() {
    const next = await settings.get();
    providerDraft = next.aiProvider;
    modelDraft = next.aiProvider === 'anthropic' ? next.anthropicModel : next.openrouterModel;
    scaleDraft = next.uiScale;
    s = next;
  }

  /** The key/model field names for whichever provider is selected. */
  function fieldsFor(id: ProviderId): { key: 'openrouterKey' | 'anthropicKey'; model: 'openrouterModel' | 'anthropicModel' } {
    return id === 'anthropic'
      ? { key: 'anthropicKey', model: 'anthropicModel' }
      : { key: 'openrouterKey', model: 'openrouterModel' };
  }

  onMount(refresh);

  async function saveKey(key: string) {
    await settings.set({ [fieldsFor(providerDraft).key]: key });
    await refresh();
  }
  async function removeKey() {
    if (
      !confirm(
        `Remove the saved ${provider.label} API key? AI suggestions will stop until you add one again.`,
      )
    )
      return;
    await settings.set({ [fieldsFor(providerDraft).key]: null });
    await refresh();
  }
  async function testConnection(): Promise<'idle' | 'testing' | 'ok' | 'fail'> {
    if (!currentKey) return 'fail';
    const ok = await provider.validateKey(currentKey);
    return ok ? 'ok' : 'fail';
  }

  async function setModel(m: string) {
    await settings.set({ [fieldsFor(providerDraft).model]: m });
    await refresh();
  }

  async function toggleFeature(k: 'tags' | 'title' | 'collection') {
    if (!s || s.aiConsentAt === null) return;
    await settings.set({ aiFeatures: { ...s.aiFeatures, [k]: !s.aiFeatures[k] } });
    await refresh();
  }

  async function acceptConsent() {
    await settings.set({ aiConsentAt: Date.now() });
    await refresh();
  }

  /**
   * Withdrawing consent also forces every feature off, so revoking can never
   * leave a toggle in a state that would transmit.
   */
  async function revokeConsent() {
    if (!confirm('Withdraw consent? All AI features will be turned off.')) return;
    await settings.set({
      aiConsentAt: null,
      aiFeatures: { tags: false, title: false, collection: false },
    });
    await refresh();
  }

  // Sync ProviderPicker's bindable value back to settings. Switching provider
  // only changes which pair is active — neither key is touched.
  $effect(() => {
    if (!s) return;
    if (providerDraft !== s.aiProvider) {
      void settings.set({ aiProvider: providerDraft }).then(refresh);
    }
  });

  // Sync ModelPicker's bindable value back to settings when it changes.
  // We compare against the persisted truth for the *active* provider to avoid
  // writing on refresh-driven sync, and to avoid writing an OpenRouter model
  // id into the Anthropic slot during a provider switch.
  $effect(() => {
    if (!s) return;
    if (providerDraft !== s.aiProvider) return;
    const persisted = providerDraft === 'anthropic' ? s.anthropicModel : s.openrouterModel;
    if (modelDraft && modelDraft !== persisted) {
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
      <p class="text-xs opacity-50 mt-1">{build}</p>
    </header>

    {#if s}
      <ProviderPicker
        bind:value={providerDraft}
        hasKey={{ openrouter: s.openrouterKey !== null, anthropic: s.anthropicKey !== null }}
      />

      <KeyForm
        {currentKey}
        providerLabel={provider.label}
        keysUrl={provider.keysUrl}
        keyPlaceholder={provider.keyPlaceholder}
        onSave={saveKey}
        onRemove={removeKey}
        onTest={testConnection}
      />

      <ModelPicker
        bind:value={modelDraft}
        presets={provider.presetModels}
        providerLabel={provider.label}
        modelsUrl={provider.modelsUrl}
      />

      <ScalePicker bind:value={scaleDraft} />

      <PrivacyNote
        consentAt={s.aiConsentAt}
        providerLabel={provider.label}
        privacyUrl={provider.privacyUrl}
        onAccept={acceptConsent}
        onRevoke={revokeConsent}
      />

      <div class="rounded-xl border border-white/10 p-5 bg-white/[0.02] {s.aiConsentAt === null ? 'opacity-50' : ''}">
        <div class="flex items-baseline gap-2 mb-3">
          <span class="text-[0.625rem] uppercase tracking-wider opacity-50">AI features</span>
          {#if s.aiConsentAt === null}
            <span class="text-[0.625rem] opacity-60">— accept the disclosure above to enable</span>
          {/if}
        </div>
        {#each [['tags','Suggest tags','Prefer existing · max 2 new per save'],['title','Suggest title','Show a friendlier title; original always recoverable'],['collection','Suggest collection','Pick from existing collections only']] as [key, label, desc] (key)}
          <label class="flex items-start justify-between gap-4 py-2">
            <div>
              <div class="text-sm">{label}</div>
              <div class="text-xs opacity-50">{desc}</div>
            </div>
            <input
              type="checkbox"
              disabled={s.aiConsentAt === null}
              checked={s.aiFeatures[key as 'tags'|'title'|'collection']}
              onchange={() => toggleFeature(key as 'tags'|'title'|'collection')}
              class="mt-1 accent-accent-violet"
            />
          </label>
        {/each}
      </div>
      <Diagnostics />
      <DataSection />
    {:else}
      <p class="opacity-50">Loading…</p>
    {/if}
  </div>
</div>
