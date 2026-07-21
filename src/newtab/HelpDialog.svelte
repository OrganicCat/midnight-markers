<script lang="ts">
  import { SHORTCUTS } from './tour/shortcuts';

  let { onClose, onStartTour }: { onClose: () => void; onStartTour: () => void } = $props();

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Backdrop. Clicking it closes; the panel stops propagation. -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
  role="presentation"
  onclick={onClose}
>
  <div
    class="flex w-full max-w-lg max-h-[85vh] flex-col rounded-xl border border-white/10 bg-[#12131a] shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="help-title"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    tabindex="-1"
  >
    <div class="flex shrink-0 items-start gap-3 px-5 pt-5 pb-3 border-b border-white/5">
      <div class="flex-1">
        <h2 id="help-title" class="text-base font-semibold tracking-tight">Help</h2>
        <p class="text-xs opacity-50 mt-0.5">midnight markers — your bookmarks, on this machine only.</p>
      </div>
      <button
        class="text-sm px-2 py-1 rounded opacity-50 hover:opacity-100 hover:bg-white/10"
        onclick={onClose}
        aria-label="Close help"
      >✕</button>
    </div>

    <div class="flex-1 overflow-auto px-5 py-4 space-y-5 text-xs leading-relaxed">
      <section>
        <h3 class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-1.5">Saving</h3>
        <p class="opacity-75">
          Click the extension's toolbar icon on any page to save it. The popup lets you star it,
          tag it, and drop it into a collection in one pass. Already-saved pages open in edit mode.
        </p>
      </section>

      <section>
        <h3 class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-1.5">Organising</h3>
        <p class="opacity-75">
          The sidebar's smart filters — Recent, Unread, Starred, Untagged, Broken — are computed,
          not maintained. Collections are yours and they nest: drag a bookmark onto one to file it,
          or drag a collection onto another to reparent it. Right-click a collection to resort just
          that folder.
        </p>
      </section>

      <section>
        <h3 class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-1.5">AI (optional)</h3>
        <p class="opacity-75">
          Everything AI is off until you add your own OpenRouter or Anthropic key in Settings and accept the
          disclosure. Nothing leaves this machine before that. Once on, the popup can suggest
          titles, tags and a collection, and ✦ Resort proposes a reorganisation you approve — or
          undo — before anything moves.
        </p>
      </section>

      <section>
        <h3 class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-1.5">Backups</h3>
        <p class="opacity-75">
          Settings → Data imports your browser's native bookmarks (folder names become collections)
          and exports everything to a JSON file you can re-import later.
        </p>
      </section>

      <section>
        <h3 class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-2">Keyboard</h3>
        <dl class="space-y-1.5">
          {#each SHORTCUTS as s (s.keys)}
            <div class="flex items-baseline gap-3">
              <dt class="w-40 shrink-0 font-mono text-[0.6875rem] opacity-90">{s.keys}</dt>
              <dd class="opacity-70">{s.description}</dd>
            </div>
          {/each}
        </dl>
      </section>
    </div>

    <div class="flex shrink-0 items-center gap-2 px-5 py-4 border-t border-white/5">
      <button
        class="text-xs px-3 py-2 rounded-lg bg-accent-violet/80 hover:bg-accent-violet text-white"
        onclick={onStartTour}
        data-tour-replay
      >▷ Replay guided tour</button>
      <button
        class="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 ml-auto"
        onclick={onClose}
      >Close</button>
    </div>
  </div>
</div>
