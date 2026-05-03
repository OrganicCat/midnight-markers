import type { OpenRouterMessage, SuggestInput } from './types';

const SYSTEM_PROMPT = `You are a concise tagging assistant for a personal bookmark manager.

Given a saved web page (title, URL, description, content excerpt) and the user's existing tags and collections, return suggestions as a single JSON object with this exact shape:

{
  "title": string | null,
  "tags": string[],
  "collectionId": string | null
}

Rules:
- "title": a clearer, friendlier display title (5-12 words). Return null if the original title is already good.
- "tags": 2-5 lowercased single-word or hyphenated tags. PREFER existing tags. You may invent at most 2 new tags if no existing tag fits well.
- "collectionId": the ID of the best-fit collection from the supplied list, or null if none fit.

Return only the JSON object — no prose, no markdown fences.`;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

export function buildMessages(input: SuggestInput): OpenRouterMessage[] {
  const tagsLine = input.existingTags.length > 0 ? input.existingTags.join(', ') : '(none yet)';
  const colLines = input.existingCollections.length > 0
    ? input.existingCollections.map((c) => `${c.name} (${c.id})`).join('\n')
    : '(none yet)';

  const userParts: string[] = [
    `Title: ${input.title}`,
    `URL: ${input.url}`,
  ];
  if (input.description) userParts.push(`Description: ${input.description}`);
  if (input.excerpt) userParts.push(`Excerpt: ${truncate(input.excerpt, 500)}`);
  userParts.push('', `Existing tags: ${tagsLine}`);
  userParts.push('', `Existing collections:\n${colLines}`);

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userParts.join('\n') },
  ];
}
