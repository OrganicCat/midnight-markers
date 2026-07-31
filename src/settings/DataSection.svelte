<script lang="ts">
  import { exportToJSON, importFromJSON, type ImportResult } from '$lib/storage/exportImport';
  import { importNativeBookmarks } from '$lib/native/importBookmarks';
  import { snapshots } from '$lib/storage/snapshot';

  let busy = $state<'idle' | 'export' | 'import' | 'native'>('idle');
  let lastResult = $state<string | null>(null);

  async function doExport() {
    busy = 'export';
    try {
      const payload = await exportToJSON();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `midnight-markers-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      lastResult = `Exported ${payload.bookmarks.length} bookmarks.`;
    } finally {
      busy = 'idle';
    }
  }

  async function doImport(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    busy = 'import';
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const r: ImportResult = await importFromJSON(payload);
      lastResult = `Imported ${r.imported.bookmarks} bookmarks (${r.skipped.bookmarks} duplicates skipped).`;
    } catch (e) {
      lastResult = 'Import failed: ' + (e as Error).message;
    } finally {
      busy = 'idle';
      (ev.target as HTMLInputElement).value = '';
    }
  }

  async function doNative() {
    if (!confirm('Import all browser bookmarks into Midnight Markers? Folder names become collections.')) return;
    busy = 'native';
    try {
      const r = await importNativeBookmarks();
      lastResult = `Imported ${r.imported} from browser bookmarks (${r.skipped} skipped).`;
    } catch (e) {
      lastResult = 'Native import failed: ' + (e as Error).message;
    } finally {
      busy = 'idle';
    }
  }

  // --- Undo the last resort -------------------------------------------------

  let lastSnapshot = $state<number | null>(null);
  let restoring = $state(false);

  async function loadSnapshot() {
    lastSnapshot = (await snapshots.get())?.createdAt ?? null;
  }

  async function restoreSnapshot() {
    if (!confirm('Undo the last resort? Bookmarks and folders will go back to how they were.')) return;
    restoring = true;
    try {
      await snapshots.restore();
    } finally {
      restoring = false;
    }
    await loadSnapshot();
  }

  $effect(() => {
    void loadSnapshot();
  });
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[0.625rem] uppercase tracking-wider opacity-50 mb-3">Data</div>

  <div class="space-y-3">
    <div class="flex items-center gap-3">
      <button class="px-3 py-1.5 rounded bg-white/5 text-sm" disabled={busy !== 'idle'} onclick={doExport}>
        {busy === 'export' ? 'Exporting…' : 'Export to JSON'}
      </button>
      <span class="text-xs opacity-50">Download a backup of your library.</span>
    </div>

    <div class="flex items-center gap-3">
      <label class="px-3 py-1.5 rounded bg-white/5 text-sm cursor-pointer">
        {busy === 'import' ? 'Importing…' : 'Import from JSON'}
        <input type="file" accept="application/json" class="hidden" onchange={doImport} disabled={busy !== 'idle'} />
      </label>
      <span class="text-xs opacity-50">Merge a previously-exported file (id-based dedup).</span>
    </div>

    <div class="flex items-center gap-3">
      <button class="px-3 py-1.5 rounded bg-white/5 text-sm" disabled={busy !== 'idle'} onclick={doNative}>
        {busy === 'native' ? 'Importing…' : 'Import browser bookmarks'}
      </button>
      <span class="text-xs opacity-50">Folder names become collections.</span>
    </div>

    {#if lastSnapshot !== null}
      <div class="pt-3 border-t border-white/10">
        <div class="flex items-center gap-3">
          <button class="px-3 py-1.5 rounded bg-white/5 text-sm" disabled={restoring} onclick={restoreSnapshot}>
            {restoring ? 'Restoring…' : 'Restore last resort'}
          </button>
          <span class="text-xs opacity-50">
            Undo the resort from {new Date(lastSnapshot).toLocaleString()}.
          </span>
        </div>
      </div>
    {/if}

    {#if lastResult}
      <p class="text-xs opacity-60 mt-2">{lastResult}</p>
    {/if}
  </div>
</div>
