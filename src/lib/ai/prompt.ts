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
- "collectionPath": an array of collection names from top → leaf. May be 1, 2, or 3 elements (NEVER more than 3). Reuse existing collection names where they fit; otherwise propose a new path. Match capitalization of existing names exactly when reusing. Return null only if the bookmark really doesn't belong in any group.

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
