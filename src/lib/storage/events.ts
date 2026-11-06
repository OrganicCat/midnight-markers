import { ext } from '$lib/ext';
import { BOOKMARKS_CHANGED_MESSAGE } from '$lib/savedIcon';

export type StorageEvent =
  | { type: 'bookmarks:changed' }
  | { type: 'collections:changed' }
  | { type: 'tags:changed' }
  | { type: 'settings:changed' };

type Listener = (e: StorageEvent) => void;

class Bus {
  private listeners = new Map<StorageEvent['type'], Set<Listener>>();

  on(type: StorageEvent['type'], fn: Listener): void {
    // Listener-only pages (e.g. the new-tab page) may never call emit(), so
    // we ensure the cross-page channel is wired up whenever something
    // subscribes — otherwise broadcasts from other pages would be dropped.
    getChannel();
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn);
  }

  off(type: StorageEvent['type'], fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }

  removeAll(): void {
    this.listeners.clear();
  }

  emit(e: StorageEvent): void {
    this.listeners.get(e.type)?.forEach((fn) => fn(e));
  }
}

export const storageEvents = new Bus();

// BroadcastChannel propagates events across same-origin extension pages
// (popup, new tab, settings) and the MV3 service worker. By default the
// channel does not echo to the sender, so a single emit() reaches every
// page exactly once.
const CHANNEL_NAME = 'mm.storage';
let bc: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (bc) return bc;
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.addEventListener('message', (ev) => {
      const e = ev.data as StorageEvent;
      // Re-emit locally so existing UI listeners fire on this page too.
      storageEvents.emit(e);
    });
  } catch {
    bc = null;
  }
  return bc;
}

export function emit(e: StorageEvent): void {
  storageEvents.emit(e);
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage(e);
    } catch {
      // Best-effort cross-page sync; fall back silently.
    }
  }
  if (e.type === 'bookmarks:changed') wakeBackground();
}

/**
 * BroadcastChannel only reaches pages that are already running. A Manifest V3
 * service worker is shut down when idle, and the "already saved" toolbar icon
 * lives there, so it also gets a runtime message, which starts it back up.
 */
function wakeBackground(): void {
  try {
    const sent = ext?.runtime?.sendMessage?.(BOOKMARKS_CHANGED_MESSAGE) as unknown;
    // Rejects with "Receiving end does not exist" when nothing is listening,
    // e.g. when the sender is the service worker itself. That's fine.
    if (sent instanceof Promise) sent.catch(() => {});
  } catch {
    // Extension context gone (the extension was reloaded under this page).
  }
}

// Test helper: tear down the broadcast channel so test isolation is clean.
export function _resetBroadcastForTests(): void {
  if (bc) {
    try { bc.close(); } catch { /* ignore */ }
    bc = null;
  }
}
