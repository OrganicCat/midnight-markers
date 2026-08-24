import type { ListRow } from './listTree';

/**
 * Cursor arithmetic for the keyboard. Kept apart from App.svelte so the rules —
 * where the cursor lands, what Enter does to the row under it — can be tested
 * without a browser.
 */

/**
 * Move the cursor by `delta` and stop at the ends. Wrapping is tempting but
 * disorienting when you're holding a key down: a run of ArrowDown should park
 * you on the last row, not spit you back to the top.
 */
export function stepIndex(current: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, current + delta));
}

/**
 * How far an arrow key moves the grid cursor. The grid wraps cards into
 * however many columns fit, so ↓ has to jump a whole row — stepping one card
 * would move the cursor sideways, which is not what the arrow is pointing at.
 * A column count we can't measure is treated as one column, which degrades to
 * plain list behaviour rather than a jump into nowhere.
 */
export function gridDelta(key: string, columns: number): number | null {
  const cols = Number.isFinite(columns) && columns >= 1 ? Math.floor(columns) : 1;
  switch (key) {
    case 'ArrowRight': return 1;
    case 'ArrowLeft': return -1;
    case 'ArrowDown': return cols;
    case 'ArrowUp': return -cols;
    default: return null;
  }
}

/** What Enter does to the row under the cursor. */
export type EnterAction =
  | { kind: 'open'; id: string }
  | { kind: 'toggle'; id: string };

/**
 * Enter opens a bookmark, and folds a folder open or shut. One key, two
 * meanings, but never an ambiguous one: the row under the cursor decides.
 */
export function enterAction(row: ListRow | undefined): EnterAction | null {
  if (!row) return null;
  if (row.kind === 'bookmark') return { kind: 'open', id: row.bookmark.id };
  return { kind: 'toggle', id: row.collection.id };
}

/**
 * The collection ← or → should fold, or null if the key has nothing to do
 * here. Right only opens a shut folder and Left only shuts an open one, so
 * leaning on an arrow can't flap the same folder back and forth.
 */
export function folderArrow(row: ListRow | undefined, key: string): string | null {
  if (!row || row.kind !== 'collection') return null;
  if (key === 'ArrowRight' && !row.expanded) return row.collection.id;
  if (key === 'ArrowLeft' && row.expanded) return row.collection.id;
  return null;
}

/**
 * The rows the cursor may land on. While a search or filter is narrowing the
 * pool, every surviving folder is drawn open no matter what the user folded
 * earlier — so Enter on one would toggle a fold nobody can see. Skip the
 * folders in that state and let the cursor walk results.
 */
export function navigableRows(rows: readonly ListRow[], filtered: boolean): ListRow[] {
  return filtered ? rows.filter((r) => r.kind === 'bookmark') : [...rows];
}
