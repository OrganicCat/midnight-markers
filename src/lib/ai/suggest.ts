import { settings } from '$lib/storage/settings';
import { chatComplete, OpenRouterError } from './openrouter';
import { buildMessages } from './prompt';
import type { Suggestion, SuggestInput, SuggestedTag } from './types';

type RawModelOutput = {
  title?: unknown;
  tags?: unknown;
  collectionId?: unknown;
};

const MAX_TAGS = 5;
const DEFAULT_TIMEOUT_MS = 10_000;

export async function suggestForBookmark(
  input: SuggestInput,
  options: { timeoutMs?: number } = {},
): Promise<Suggestion | null> {
  const s = await settings.get();
  if (!s.aiKey) return null;

  const anyFeatureOn = s.aiFeatures.tags || s.aiFeatures.title || s.aiFeatures.collection;
  if (!anyFeatureOn) return null;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const raw = (await chatComplete({
      apiKey: s.aiKey,
      model: s.aiModel,
      messages: buildMessages(input),
      signal: ac.signal,
    })) as RawModelOutput;

    return shapeSuggestion(raw, input, s.aiFeatures);
  } catch (e) {
    if (e instanceof OpenRouterError || (e as { name?: string }).name === 'AbortError') {
      return null;
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function shapeSuggestion(
  raw: RawModelOutput,
  input: SuggestInput,
  features: { tags: boolean; title: boolean; collection: boolean },
): Suggestion {
  const existingTagSet = new Set(input.existingTags);
  const collectionIds = new Set(input.existingCollections.map((c) => c.id));

  const suggestedTitle =
    features.title && typeof raw.title === 'string' && raw.title.trim().length > 0
      ? raw.title.trim()
      : null;

  let suggestedTags: SuggestedTag[] = [];
  if (features.tags && Array.isArray(raw.tags)) {
    suggestedTags = raw.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)
      .slice(0, MAX_TAGS)
      .map((name) => ({ name, isNew: !existingTagSet.has(name) }));
  }

  const suggestedCollectionId =
    features.collection && typeof raw.collectionId === 'string' && collectionIds.has(raw.collectionId)
      ? raw.collectionId
      : null;

  return { suggestedTitle, suggestedTags, suggestedCollectionId };
}
