/**
 * The keyboard cheat sheet, in one place. These mirror the switch in
 * App.svelte's `handleKey` — change one, change the other.
 */
export type Shortcut = { keys: string; description: string };

export const SHORTCUTS: Shortcut[] = [
  { keys: '⌘K  /  Ctrl K  /  /', description: 'Focus the search box' },
  { keys: 'J  or  ↓', description: 'Select the next bookmark' },
  { keys: 'K  or  ↑', description: 'Select the previous bookmark' },
  { keys: '↵', description: 'Open the selected bookmark' },
  { keys: 'S', description: 'Star / unstar the selected bookmark' },
  { keys: '⌫', description: 'Delete the selected bookmark (asks first)' },
  { keys: '1  /  2', description: 'Switch to grid / list view' },
];
