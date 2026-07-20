import { MAX_COLLECTION_DEPTH } from '$lib/storage/collections';
import type { OpenRouterMessage } from '$lib/ai/types';
import type { FilingInput, FilingResult, Skeleton } from './types';
import { pathKey, renderPath } from './types';

export const FILING_SYSTEM_PROMPT = `You are filing bookmarks into a fixed folder structure for a personal bookmark manager.

You are given the complete list of available folders and a batch of bookmarks. Assign every bookmark to the folder where it best belongs. Return a single JSON object with this exact shape:

{ "filings": [{ "id": string, "path": string[] }] }

- "id" must be copied exactly from the bookmark you are filing.
- "path" must be one of the folders listed, copied exactly. Do NOT invent folders, do NOT add sub-folders, do NOT reword names. Only the folders listed are allowed.
- File by subject, not by media type — a soldering video goes under the electronics folder, not a video folder.
- Include every bookmark from the batch exactly once. If a bookmark genuinely fits nowhere in the list, omit it rather than forcing it somewhere wrong.

Return only the JSON object — no prose, no markdown fences.`;

export function buildFilingMessages(input: FilingInput): OpenRouterMessage[] {
  const folderLines =
    input.skeleton.length > 0 ? input.skeleton.map(renderPath).join('\n') : '(none)';
  const batchLines = input.batch
    .map((b) => `${b.id} — ${b.title} — ${b.domain} — ${renderPath(b.path)}`)
    .join('\n');

  const user = [
    `Available folders (paths, top → leaf):\n${folderLines}`,
    '',
    `Bookmarks to file (id — title — domain — current folder):\n${batchLines}`,
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

export function parseFilings(
  raw: unknown,
  allowedPaths: string[][],
  validIds: Set<string>,
): FilingResult[] {
  const canonical = new Map<string, string[]>();
  for (const p of allowedPaths) canonical.set(pathKey(p), p);

  let list: unknown = raw;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    list = obj.filings ?? obj.results ?? obj.bookmarks;
  }
  if (!Array.isArray(list)) return [];

  const out: FilingResult[] = [];
  const used = new Set<string>();
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === 'string' ? e.id : '';
    if (!validIds.has(id) || used.has(id)) continue;
    const path = cleanPath(e.path);
    if (!path) continue;
    const match = canonical.get(pathKey(path));
    if (!match) continue;
    used.add(id);
    out.push({ id, path: match });
  }
  return out;
}
