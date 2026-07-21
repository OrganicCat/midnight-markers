export type SuggestInput = {
  title: string;
  url: string;
  description: string | null;
  excerpt: string | null;
  existingTags: string[];
  existingCollections: { id: string; path: string[] }[]; // path top→leaf, max 3 deep
};

export type SuggestedTag = {
  name: string;
  isNew: boolean;
};

export type Suggestion = {
  suggestedTitle: string | null;
  suggestedTags: SuggestedTag[];
  suggestedCollectionPath: string[] | null; // path of names, top→leaf, may include new names
};

/**
 * Provider-agnostic message shape. The prompt builders emit an OpenAI-shaped
 * list with the system prompt first; the Anthropic path splits that leading
 * system message out (see anthropic.ts splitSystem).
 */
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/** @deprecated Use ChatMessage — kept so existing imports keep compiling. */
export type OpenRouterMessage = ChatMessage;

export type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  response_format?: { type: 'json_object' };
};

export type ChatCompletionResponse = {
  choices: Array<{ message: { content: string } }>;
};
