import type { OpenRouterMessage, SuggestInput } from './types';

const SYSTEM_PROMPT = `You are a concise tagging assistant for a personal bookmark manager.

Given a saved web page (title, URL, description, content excerpt) and the user's existing tags and collection hierarchy, return suggestions as a single JSON object with this exact shape:

{
  "title": string | null,
  "tags": string[],
  "collectionPath": string[] | null
}

Rules:
- "title": a clearer, friendlier display title (5-12 words). Return null if the original title is already good.
- "tags": 2-5 lowercased single-word or hyphenated tags. PREFER existing tags. You may invent at most 2 new tags if no existing tag fits well.
- "collectionPath": an array of collection names from top → leaf. May be 1, 2, or 3 elements (NEVER more than 3). Choose where the page belongs, in this order:
  1. FIT FIRST: check the existing collections above. If the page genuinely belongs to one, reuse that path exactly (match capitalization). Reuse: existing ["Web Development", "CSS"] + a CSS-grid guide → ["Web Development", "CSS"].
  2. CLOSE BUT NOT EXACT → NEST: if an existing collection is the right general area but not a precise fit, add a NEW sub-folder under it — do not force the poor fit and do not make a new top-level. Nest: existing ["Web Development", "CSS"] + a Tailwind guide → ["Web Development", "Tailwind"] (not dumped into CSS, not a new top-level "Tailwind").
  3. OTHERWISE INVENT at the right altitude. Prefer TWO levels: a real topic domain as the top folder, a specific sub-folder as the leaf. Good: ["Electronics", "Single-board computers"], ["Cooking", "Sourdough"], ["Personal Finance", "Index investing"], ["Photography", "Lightroom"], ["Machine Learning", "Transformers"], ["Woodworking", "Hand tools"].
  AVOID over-general top folders (junk drawers): ["Learning"], ["Entertainment"], ["Misc"], ["Resources"]. AVOID filing by media FORMAT instead of topic: ["Videos", "Tutorials"], ["Articles"], ["PDFs"] — a YouTube soldering video is ["Electronics", "Soldering"], filed by subject, never by media type. AVOID over-specific top folders: ["Raspberry Pi"] belongs at ["Electronics", "Single-board computers"]; ["React useState hook"] belongs at ["Web Development", "React"].
  Return null ONLY when the page has no discernible topic at all (login screens, error pages, blank tabs).

Return only the JSON object — no prose, no markdown fences.`;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

export function buildMessages(input: SuggestInput): OpenRouterMessage[] {
  const tagsLine = input.existingTags.length > 0 ? input.existingTags.join(', ') : '(none yet)';

  const collectionLines =
    input.existingCollections.length > 0
      ? input.existingCollections.map((c) => c.path.join(' > ')).join('\n')
      : '(none yet)';

  const userParts: string[] = [
    `Title: ${input.title}`,
    `URL: ${input.url}`,
  ];
  if (input.description) userParts.push(`Description: ${input.description}`);
  if (input.excerpt) userParts.push(`Excerpt: ${truncate(input.excerpt, 500)}`);
  userParts.push('', `Existing tags: ${tagsLine}`);
  userParts.push('', `Existing collections (paths, top → leaf):\n${collectionLines}`);

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userParts.join('\n') },
  ];
}
