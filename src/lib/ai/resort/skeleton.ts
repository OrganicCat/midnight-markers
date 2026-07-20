import type { OpenRouterMessage } from '$lib/ai/types';
import type { BookmarkRef, SkeletonInput } from './types';
import { renderPath, pathKey } from './types';

export const SKELETON_SYSTEM_PROMPT = `You are reorganizing the folder structure of a personal bookmark manager.

You are given the user's current folder tree and a representative sample of their bookmarks. Propose a better folder structure for the whole library. Return a single JSON object with this exact shape:

{
  "folders": string[][],
  "renames": [{ "from": string[], "to": string }],
  "merges":  [{ "from": string[], "into": string[] }]
}

- "folders": the COMPLETE proposed folder set. Each entry is a path of names from top → leaf, 1 to 3 elements (NEVER more than 3). Include folders you are keeping unchanged, not just new ones. Every bookmark must have somewhere sensible to go among these.
- "renames": rename an existing folder's own name. "from" is its current full path, "to" is the new leaf name only. Use this when a folder holds the right things under a bad name.
- "merges": fold one existing folder into another. "from" and "into" are current full paths. Use this for near-duplicates — ["Web Dev"] and ["Web Development"], or ["JS"] and ["Javascript"]. Merge aggressively when two folders clearly hold the same subject.

Structure rules:
- Prefer TWO levels: a real topic domain as the top folder, a specific sub-folder as the leaf. Good: ["Electronics", "Single-board computers"], ["Cooking", "Sourdough"], ["Machine Learning", "Transformers"], ["Woodworking", "Hand tools"].
- Do not create a folder that would hold fewer than 3 bookmarks. Fold thin topics up into their parent instead.
- AVOID over-general top folders (junk drawers): "Learning", "Entertainment", "Misc", "Resources", "Other", "Bookmarks".
- AVOID filing by media FORMAT rather than topic: "Videos", "Articles", "PDFs", "Tutorials". A soldering video is ["Electronics", "Soldering"] — filed by subject, never by media type.
- AVOID over-specific top folders: "Raspberry Pi" belongs at ["Electronics", "Single-board computers"]; "React useState hook" belongs at ["Web Development", "React"].
- Keep the user's existing names when they are already good. Reorganizing is not an excuse to rename everything.

Return only the JSON object — no prose, no markdown fences.`;

/**
 * Picks up to `limit` bookmarks, spread evenly across folders so one large
 * folder cannot crowd the sample. Deterministic: no randomness, so a rerun on
 * unchanged data produces the same prompt.
 */
export function sampleBookmarks(bookmarks: BookmarkRef[], limit: number): BookmarkRef[] {
  if (bookmarks.length <= limit) return [...bookmarks];

  const groups = new Map<string, BookmarkRef[]>();
  for (const b of bookmarks) {
    const k = pathKey(b.path);
    const g = groups.get(k);
    if (g) g.push(b);
    else groups.set(k, [b]);
  }

  const buckets = [...groups.values()];
  const out: BookmarkRef[] = [];
  let round = 0;
  while (out.length < limit) {
    let tookAny = false;
    for (const bucket of buckets) {
      const item = bucket[round];
      if (!item) continue;
      out.push(item);
      tookAny = true;
      if (out.length >= limit) break;
    }
    if (!tookAny) break;
    round++;
  }
  return out;
}

export function buildSkeletonMessages(input: SkeletonInput): OpenRouterMessage[] {
  const folderLines =
    input.folders.length > 0
      ? input.folders.map((f) => renderPath(f.path)).join('\n')
      : '(none yet)';

  const sampleLines =
    input.sample.length > 0
      ? input.sample.map((b) => `${b.title} — ${b.domain} — ${renderPath(b.path)}`).join('\n')
      : '(none yet)';

  const user = [
    `Current folders (paths, top → leaf):\n${folderLines}`,
    '',
    `Sample of bookmarks (title — domain — current folder):\n${sampleLines}`,
  ].join('\n');

  return [
    { role: 'system', content: SKELETON_SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}
