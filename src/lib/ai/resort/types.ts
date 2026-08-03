/** What the user asked to resort. */
export type ResortScope =
  | { kind: 'all' }
  | { kind: 'collection'; id: string };

/** A folder in the current tree, with its materialized path. */
export type FolderNode = {
  id: string;
  name: string;
  parentId: string | null;
  path: string[]; // top → leaf, includes own name
};

/** A bookmark as the planner sees it. */
export type BookmarkRef = {
  id: string;
  title: string;
  domain: string;
  path: string[]; // current folder path; [] when unfiled
};

/** Pass 1 output: the proposed folder structure. */
export type Skeleton = {
  /** The complete proposed folder set, each top → leaf. */
  folders: string[][];
  /** Rename an existing folder's leaf name. `from` is its current full path. */
  renames: { from: string[]; to: string }[];
  /** Fold folder `from` into folder `into`. Both are current paths. */
  merges: { from: string[]; into: string[] }[];
};

/** Pass 2 output: one bookmark's destination. */
export type FilingResult = { id: string; path: string[] };

export type ResortPlan = {
  skeleton: Skeleton;
  filings: FilingResult[];
  /** Bookmarks the model never returned a usable path for. Left in place. */
  unplannedIds: string[];
};

/**
 * One reviewable change. `key` is stable and unique within a plan; the UI uses
 * it as the identity for checkbox selection.
 */
export type Change =
  | { kind: 'folder-new'; key: string; path: string[] }
  | { kind: 'folder-rename'; key: string; id: string; from: string; to: string; path: string[] }
  | { kind: 'folder-merge'; key: string; sourceId: string; sourcePath: string[]; targetPath: string[] }
  | { kind: 'folder-delete'; key: string; id: string; path: string[] }
  | {
      kind: 'bookmark-move';
      key: string;
      id: string;
      title: string;
      fromPath: string[];
      toPath: string[];
    };

export type SkeletonInput = {
  folders: FolderNode[];
  sample: BookmarkRef[];
};

export type FilingInput = {
  skeleton: string[][];
  batch: BookmarkRef[];
};

export type ResortProgress =
  | { phase: 'skeleton' }
  | { phase: 'filing'; done: number; total: number };

/** Joins a path for display and for prompts: ['A','B'] → 'A > B'. */
export function renderPath(path: string[]): string {
  return path.length === 0 ? '(unfiled)' : path.join(' > ');
}

/**
 * Stable comparison key for a path, case-insensitive.
 *
 * Segments are joined with a NUL byte rather than a space, so ['A B', 'C'] and
 * ['A', 'B C'] get different keys. Folder names come from a language model and
 * from the user, and a space separator let those two collapse into one.
 */
export function pathKey(path: string[]): string {
  return path.map((s) => s.trim().toLowerCase()).join('\0');
}

/** True when `prefix` is `path` or an ancestor of it. */
export function isPathPrefix(prefix: string[], path: string[]): boolean {
  if (prefix.length > path.length) return false;
  return prefix.every((s, i) => s.trim().toLowerCase() === path[i]!.trim().toLowerCase());
}

export type PreviewBadge =
  | { kind: 'new' }
  | { kind: 'renamed'; from: string }
  | { kind: 'merged'; from: string }
  | { kind: 'deleted' };

export type PreviewBookmark = {
  id: string;
  title: string;
  /** Where it is coming from, when this row represents a move. */
  fromPath: string[] | null;
  changeKey: string | null;
};

export type PreviewNode = {
  id: string;
  name: string;
  path: string[];
  badge: PreviewBadge | null;
  changeKey: string | null;
  children: PreviewNode[];
  bookmarks: PreviewBookmark[];
};
