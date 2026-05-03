export type SuggestInput = {
  title: string;
  url: string;
  description: string | null;
  excerpt: string | null;
  existingTags: string[];
  existingCollections: { id: string; name: string }[];
};

export type SuggestedTag = {
  name: string;
  isNew: boolean;
};

export type Suggestion = {
  suggestedTitle: string | null;
  suggestedTags: SuggestedTag[];
  suggestedCollectionId: string | null;
};

export type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatCompletionRequest = {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  response_format?: { type: 'json_object' };
};

export type ChatCompletionResponse = {
  choices: Array<{ message: { content: string } }>;
};
