import { MAX_COLLECTION_DEPTH } from '$lib/storage/collections';
import type { OpenRouterMessage } from '$lib/ai/types';
import type { BookmarkRef, FilingInput, FilingResult, Skeleton } from './types';
import { pathKey, renderPath } from './types';

export const FILING_SYSTEM_PROMPT = `You are filing bookmarks into a fixed folder structure for a personal bookmark manager.

You are given a numbered list of folders and a numbered batch of bookmarks. Decide which folder each bookmark belongs in, and answer with index pairs. Return a single JSON object with this exact shape:

{ "f": [[bookmarkIndex, folderIndex]] }

- Each entry is a pair of numbers: the bookmark's index, then the index of the folder it belongs in. Answer with the numbers from the two lists, never with titles or folder names.
- Only the folders listed are allowed. Do NOT invent folders, do NOT add sub-folders.
- File by subject, not by media type — a soldering video goes under the electronics folder, not a video folder.
- Include every bookmark from the batch exactly once. If a bookmark genuinely fits nowhere in the list, leave its index out rather than forcing it somewhere wrong.

Return only the JSON object — no prose, no markdown fences.`;

export function buildFilingMessages(input: FilingInput): OpenRouterMessage[] {
  const folderLines =
    input.skeleton.length > 0
      ? input.skeleton.map((p, i) => `${i}. ${renderPath(p)}`).join('\n')
      : '(none)';
  const batchLines = input.batch
    .map((b, i) => `${i} — ${b.title} — ${b.domain} — ${renderPath(b.path)}`)
    .join('\n');

  const user = [
    `Available folders (index. path, top → leaf):\n${folderLines}`,
    '',
    `Bookmarks to file (index — title — domain — current folder):\n${batchLines}`,
  ].join('\n');

  return [
    { role: 'system', content: FILING_SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}

function cleanPath(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const path = value
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_COLLECTION_DEPTH);
  return path.length > 0 ? path : null;
}

export function parseSkeleton(raw: unknown): Skeleton {
  const empty: Skeleton = { folders: [], renames: [], merges: [] };
  if (typeof raw !== 'object' || raw === null) return empty;
  const obj = raw as Record<string, unknown>;

  const folders: string[][] = [];
  const seen = new Set<string>();
  if (Array.isArray(obj.folders)) {
    for (const entry of obj.folders) {
      const path = cleanPath(entry);
      if (!path) continue;
      const k = pathKey(path);
      if (seen.has(k)) continue;
      seen.add(k);
      folders.push(path);
    }
  }

  const renames: Skeleton['renames'] = [];
  if (Array.isArray(obj.renames)) {
    for (const entry of obj.renames) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const from = cleanPath(e.from);
      const to = typeof e.to === 'string' ? e.to.trim() : '';
      if (!from || to.length === 0) continue;
      renames.push({ from, to });
    }
  }

  const merges: Skeleton['merges'] = [];
  if (Array.isArray(obj.merges)) {
    for (const entry of obj.merges) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const from = cleanPath(e.from);
      const into = cleanPath(e.into);
      if (!from || !into) continue;
      if (pathKey(from) === pathKey(into)) continue;
      merges.push({ from, into });
    }
  }

  return { folders, renames, merges };
}

/** A non-negative whole number, which is the only thing an index can be. */
function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Reads one entry of the model's answer.
 *
 * The prompt asks for `[bookmarkIndex, folderIndex]`, but models drift toward
 * objects when a shape has named parts, so both are accepted.
 */
function readPair(entry: unknown): { bookmark: number; folder: number } | null {
  if (Array.isArray(entry)) {
    const [bookmark, folder] = entry;
    return isIndex(bookmark) && isIndex(folder) ? { bookmark, folder } : null;
  }
  if (typeof entry === 'object' && entry !== null) {
    const e = entry as Record<string, unknown>;
    const bookmark = e.b ?? e.i ?? e.bookmark;
    const folder = e.f ?? e.folder;
    return isIndex(bookmark) && isIndex(folder) ? { bookmark, folder } : null;
  }
  return null;
}

/**
 * Turns the model's index pairs back into real bookmark ids and folder paths.
 *
 * Bad entries are dropped rather than failing the batch: one nonsense pair in
 * a hundred should cost you that bookmark, not the other ninety-nine.
 */
export function parseFilings(
  raw: unknown,
  allowedPaths: string[][],
  batch: BookmarkRef[],
): FilingResult[] {
  let list: unknown = raw;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    list = obj.f ?? obj.filings ?? obj.results ?? obj.bookmarks;
  }
  if (!Array.isArray(list)) return [];

  const out: FilingResult[] = [];
  const used = new Set<number>();
  for (const entry of list) {
    const pair = readPair(entry);
    if (!pair || used.has(pair.bookmark)) continue;
    const bookmark = batch[pair.bookmark];
    const path = allowedPaths[pair.folder];
    if (!bookmark || !path) continue;
    used.add(pair.bookmark);
    out.push({ id: bookmark.id, path });
  }
  return out;
}
