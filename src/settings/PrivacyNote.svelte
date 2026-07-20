<script lang="ts">
  let {
    consentAt,
    onAccept,
    onRevoke,
  }: {
    consentAt: number | null;
    onAccept: () => void;
    onRevoke: () => void;
  } = $props();

  const accepted = $derived(consentAt !== null);
</script>

<div
  class="rounded-xl border p-5 {accepted
    ? 'border-white/10 bg-white/[0.02]'
    : 'border-accent-violet/40 bg-accent-violet/[0.06]'}"
>
  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-2">
    Privacy &amp; data sharing
  </div>

  <p class="text-xs leading-relaxed opacity-80">
    AI features are <strong>off until you turn them on</strong>. When you enable one, this is sent to
    <strong>OpenRouter</strong> (openrouter.ai) each time you save a page or run Resort:
  </p>
  <ul class="text-xs leading-relaxed opacity-80 list-disc pl-5 mt-2 space-y-0.5">
    <li>the page <strong>title</strong> and <strong>URL</strong></li>
    <li>its <strong>meta description</strong> and up to <strong>500 characters</strong> of page text</li>
    <li>your existing <strong>tag names</strong> and <strong>collection names</strong></li>
  </ul>
  <p class="text-xs leading-relaxed opacity-80 mt-2">
    Requests go to OpenRouter under <strong>your own API key</strong>, billed to your account. Nothing
    is sent to the developer, and no other server ever receives your data. OpenRouter's handling of it
    is governed by
    <a href="https://openrouter.ai/privacy" target="_blank" rel="noopener noreferrer" class="underline"
      >their privacy policy</a
    >.
  </p>
  <p class="text-xs leading-relaxed opacity-50 mt-2">
    Your API key is encrypted at rest with a non-extractable AES-GCM key held by the browser, and is
    sent only to openrouter.ai. It is excluded from exports. Your bookmarks themselves never leave
    this device except as described above.
  </p>

  <div class="mt-4 pt-3 border-t border-white/10">
    {#if accepted}
      <div class="flex items-center justify-between gap-4">
        <span class="text-xs opacity-60">Accepted {new Date(consentAt!).toLocaleString()}.</span>
        <button
          class="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 whitespace-nowrap"
          onclick={onRevoke}
        >Withdraw consent</button>
      </div>
    {:else}
      <div class="flex items-center justify-between gap-4">
        <span class="text-xs opacity-70">AI features stay disabled until you accept.</span>
        <button
          class="text-xs px-3 py-1.5 rounded-lg bg-accent-violet/25 hover:bg-accent-violet/40 whitespace-nowrap"
          onclick={onAccept}
        >I understand — enable AI features</button>
      </div>
    {/if}
  </div>
</div>
