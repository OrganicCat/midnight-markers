import type { ProviderId, Settings } from '$lib/types';
import type { ChatMessage } from './types';
import * as openrouter from './openrouter';
import * as anthropic from './anthropic';

export type { ProviderId };

export type ChatCompleteArgs = {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  /**
   * Ceiling on the response, in tokens. Omit for the small single-object
   * replies most prompts ask for; set it when the reply scales with the input,
   * as resort's filing pass does — one entry per bookmark in the batch.
   */
  maxTokens?: number;
};

export interface ChatProvider {
  id: ProviderId;
  /** Vendor name, for UI copy and error messages. */
  label: string;
  /** Where a key is obtained, linked from the settings form. */
  keysUrl: string;
  /** Vendor privacy policy, linked from the disclosure. */
  privacyUrl: string;
  /** Vendor model catalogue, linked from the model picker. */
  modelsUrl: string;
  /** Recorded in AI-error diagnostics so a failure names the right endpoint. */
  endpointUrl: string;
  /** Placeholder shown in the key input. */
  keyPlaceholder: string;
  /** Model ids offered in the picker; a custom id is always allowed too. */
  presetModels: string[];
  chatComplete(args: ChatCompleteArgs): Promise<unknown>;
  validateKey(apiKey: string): Promise<boolean>;
}

const OPENROUTER: ChatProvider = {
  id: 'openrouter',
  label: 'OpenRouter',
  keysUrl: 'https://openrouter.ai/keys',
  privacyUrl: 'https://openrouter.ai/privacy',
  modelsUrl: 'https://openrouter.ai/models',
  endpointUrl: openrouter.OPENROUTER_ENDPOINT,
  keyPlaceholder: 'sk-or-v1-...',
  presetModels: [
    'anthropic/claude-haiku-4.5',
    'anthropic/claude-sonnet-4.6',
    'openai/gpt-4o-mini',
    'google/gemini-2.0-flash',
    'meta-llama/llama-3.3-70b-instruct',
  ],
  chatComplete: (args) => openrouter.chatComplete(args),
  validateKey: (apiKey) => openrouter.validateKey(apiKey),
};

const ANTHROPIC: ChatProvider = {
  id: 'anthropic',
  label: 'Anthropic',
  keysUrl: 'https://console.anthropic.com/settings/keys',
  privacyUrl: 'https://www.anthropic.com/legal/privacy',
  modelsUrl: 'https://docs.claude.com/en/docs/about-claude/models/overview',
  endpointUrl: anthropic.ANTHROPIC_ENDPOINT,
  keyPlaceholder: 'sk-ant-...',
  presetModels: ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8'],
  chatComplete: (args) => anthropic.chatComplete(args),
  validateKey: (apiKey) => anthropic.validateKey(apiKey),
};

export const PROVIDERS: ChatProvider[] = [OPENROUTER, ANTHROPIC];

export function getProvider(id: ProviderId): ChatProvider {
  return id === 'anthropic' ? ANTHROPIC : OPENROUTER;
}

/** The provider every AI request currently routes through. */
export function activeProvider(s: Settings): ChatProvider {
  return getProvider(s.aiProvider);
}

/** The active provider's key, or null when the user has not set one for it. */
export function activeKey(s: Settings): string | null {
  return s.aiProvider === 'anthropic' ? s.anthropicKey : s.openrouterKey;
}

/** The active provider's model id. */
export function activeModel(s: Settings): string {
  return s.aiProvider === 'anthropic' ? s.anthropicModel : s.openrouterModel;
}

/**
 * True when the error came from a provider call and carries HTTP detail.
 * Both provider error classes expose the same `status` / `body` surface, so
 * callers classify failures without knowing which vendor produced them.
 */
export type ProviderHttpError = Error & { status?: number; body?: string };

export function isProviderError(e: unknown): e is ProviderHttpError {
  return e instanceof openrouter.OpenRouterError || e instanceof anthropic.AnthropicError;
}
