/**
 * The hotkey that jumps to the search box.
 *
 * Ctrl+Shift+F (⌘⇧F on macOS) is the advertised one because no major browser
 * binds it — unlike Ctrl+K and Ctrl+E, which Chrome hands to the address bar.
 * `/` and Ctrl+K still work for anyone with the muscle memory.
 */

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** How the hotkey is written for humans, e.g. "⌘⇧F" or "Ctrl+Shift+F". */
export const SEARCH_HOTKEY_LABEL = isMac ? '⌘⇧F' : 'Ctrl+Shift+F';

/** Placeholder text for the search input. */
export const SEARCH_PLACEHOLDER = `Search bookmarks — press ${SEARCH_HOTKEY_LABEL}`;

/** True when the event is the search hotkey (the main one or a legacy alias). */
export function isSearchHotkey(e: KeyboardEvent): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.shiftKey && e.key.toLowerCase() === 'f') return true;
  if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') return true;
  return false;
}

/** Move focus to the search input, wherever it is on the page. */
export function focusSearch(): void {
  const el = document.querySelector('input[data-search-input]') as HTMLInputElement | null;
  el?.focus();
  el?.select();
}
