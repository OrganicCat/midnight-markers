<script lang="ts">
  import { onMount } from 'svelte';
  import { ext } from '$lib/ext';
  import { SAVED_ICON_PERMISSION, savedIconEnabled } from '$lib/savedIcon';

  /**
   * Turns the "already saved" toolbar icon on and off by granting or giving up
   * the optional `tabs` permission. The permission *is* the setting, so this
   * also follows changes made from the browser's own extension page.
   */
  let enabled = $state(false);
  let ready = $state(false);

  function sync() {
    void savedIconEnabled().then((on) => {
      enabled = on;
      ready = true;
    });
  }

  onMount(() => {
    sync();
    // @types/chrome leaves removeListener off these two events, but every
    // extension event object has it at runtime.
    type Ev = chrome.events.Event<() => void>;
    const events = [ext?.permissions?.onAdded, ext?.permissions?.onRemoved] as (Ev | undefined)[];
    for (const ev of events) ev?.addListener(sync);
    return () => {
      for (const ev of events) ev?.removeListener(sync);
    };
  });

  function toggle(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const want = input.checked;
    // Firefox only shows the permission prompt when request() is called
    // directly from the click, so nothing may be awaited before it.
    const call = want
      ? ext.permissions.request(SAVED_ICON_PERMISSION)
      : ext.permissions.remove(SAVED_ICON_PERMISSION).then((removed) => !removed);
    void call.then(
      (on) => {
        enabled = on;
        // A declined prompt leaves `enabled` false, which Svelte sees as no
        // change, so the box the user just ticked has to be unticked by hand.
        input.checked = on;
      },
      () => {
        input.checked = enabled;
        sync();
      },
    );
  }
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-3">Toolbar icon</div>
  <label class="flex items-start justify-between gap-4">
    <div>
      <div class="text-sm">Show when a page is already saved</div>
      <div class="text-xs opacity-50">
        Adds a small "B" to the toolbar icon on pages that are in your library. The browser
        will ask to let the extension read your tabs' addresses. They're checked against your
        library on this device and never sent anywhere.
      </div>
    </div>
    <input
      type="checkbox"
      disabled={!ready}
      checked={enabled}
      onchange={toggle}
      class="mt-1 accent-accent-violet"
    />
  </label>
</div>
