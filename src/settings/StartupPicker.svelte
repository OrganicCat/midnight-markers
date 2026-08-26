<script lang="ts">
  import { SEARCH_HOTKEY_LABEL } from '../newtab/searchHotkey';

  let { value = $bindable() }: { value: boolean } = $props();
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-2">New tab</div>

  <label class="flex items-start justify-between gap-4">
    <div>
      <div class="text-sm">Start typing in the search box</div>
      <div class="text-xs opacity-50">
        Puts the cursor in search as soon as a new tab opens. Press Escape to get back to the
        single-letter shortcuts, or {SEARCH_HOTKEY_LABEL} to return to the box.
      </div>
    </div>
    <input
      type="checkbox"
      bind:checked={value}
      class="mt-1 accent-accent-violet"
      data-startup-focus
    />
  </label>
</div>
