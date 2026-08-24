/**
 * The keyboard cheat sheet, in one place. These mirror the switch in
 * App.svelte's `handleKey` — change one, change the other.
 */
import { SEARCH_HOTKEY_LABEL } from '../searchHotkey';

export type Shortcut = { keys: string; description: string };

export const SHORTCUTS: Shortcut[] = [
  { keys: `${SEARCH_HOTKEY_LABEL}  /  /`, description: 'Focus the search box' },
  { keys: 'J  or  ↓', description: 'Move down — works while you type in the search box' },
  { keys: 'K  or  ↑', description: 'Move up — works while you type in the search box' },
  { keys: '←  /  →', description: 'Grid: move a card. List: close / open the folder' },
  { keys: '↵', description: 'Open the selected bookmark in a new tab, or fold a folder' },
  { keys: 'Esc', description: 'In the search box: clear the query, then leave the box' },
  { keys: 'S', description: 'Star / unstar the selected bookmark' },
  { keys: '⌫', description: 'Delete the selected bookmark (asks first)' },
  { keys: '1  /  2', description: 'Switch to grid / list view' },
];
