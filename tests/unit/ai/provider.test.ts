import { describe, it, expect } from 'vitest';
import {
  PROVIDERS,
  getProvider,
  activeProvider,
  activeKey,
  activeModel,
  isProviderError,
} from '$lib/ai/provider';
import { DEFAULT_SETTINGS } from '$lib/storage/settings';
import { OpenRouterError } from '$lib/ai/openrouter';
import { AnthropicError } from '$lib/ai/anthropic';
import type { Settings } from '$lib/types';

function settingsWith(patch: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

describe('getProvider', () => {
  it('returns the OpenRouter provider', () => {
    const p = getProvider('openrouter');
    expect(p.id).toBe('openrouter');
    expect(p.label).toBe('OpenRouter');
    expect(p.endpointUrl).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('returns the Anthropic provider', () => {
    const p = getProvider('anthropic');
    expect(p.id).toBe('anthropic');
    expect(p.label).toBe('Anthropic');
    expect(p.endpointUrl).toBe('https://api.anthropic.com/v1/messages');
  });

  it('exposes exactly the two providers, each with a distinct endpoint', () => {
    expect(PROVIDERS.map((p) => p.id).sort()).toEqual(['anthropic', 'openrouter']);
    const endpoints = new Set(PROVIDERS.map((p) => p.endpointUrl));
    expect(endpoints.size).toBe(PROVIDERS.length);
  });

  it('gives every provider the metadata the settings UI needs', () => {
    for (const p of PROVIDERS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.keysUrl).toMatch(/^https:\/\//);
      expect(p.privacyUrl).toMatch(/^https:\/\//);
      expect(p.modelsUrl).toMatch(/^https:\/\//);
      expect(p.keyPlaceholder.length).toBeGreaterThan(0);
      expect(p.presetModels.length).toBeGreaterThan(0);
    }
  });
});

describe('active provider selection', () => {
  it('defaults to OpenRouter', () => {
    expect(activeProvider(DEFAULT_SETTINGS).id).toBe('openrouter');
  });

  it('reads the key and model of the selected provider', () => {
    const s = settingsWith({
      aiProvider: 'anthropic',
      openrouterKey: 'sk-or-v1-abc',
      openrouterModel: 'openai/gpt-4o-mini',
      anthropicKey: 'sk-ant-xyz',
      anthropicModel: 'claude-sonnet-5',
    });
    expect(activeProvider(s).id).toBe('anthropic');
    expect(activeKey(s)).toBe('sk-ant-xyz');
    expect(activeModel(s)).toBe('claude-sonnet-5');
  });

  it('does not leak the other provider key when the active one is unset', () => {
    const s = settingsWith({
      aiProvider: 'anthropic',
      openrouterKey: 'sk-or-v1-abc',
      anthropicKey: null,
    });
    expect(activeKey(s)).toBeNull();
  });

  it('switches cleanly back to OpenRouter', () => {
    const s = settingsWith({
      aiProvider: 'openrouter',
      openrouterKey: 'sk-or-v1-abc',
      anthropicKey: 'sk-ant-xyz',
    });
    expect(activeKey(s)).toBe('sk-or-v1-abc');
  });
});

describe('isProviderError', () => {
  it('recognises an OpenRouter error', () => {
    expect(isProviderError(new OpenRouterError('boom', 500, 'body'))).toBe(true);
  });

  it('recognises an Anthropic error', () => {
    expect(isProviderError(new AnthropicError('boom', 500, 'body'))).toBe(true);
  });

  it('exposes status and body uniformly across providers', () => {
    for (const e of [new OpenRouterError('a', 401, 'x'), new AnthropicError('b', 401, 'y')]) {
      expect(isProviderError(e)).toBe(true);
      if (isProviderError(e)) {
        expect(e.status).toBe(401);
        expect(typeof e.body).toBe('string');
      }
    }
  });

  it('rejects unrelated errors', () => {
    expect(isProviderError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isProviderError(new Error('plain'))).toBe(false);
    expect(isProviderError(null)).toBe(false);
  });
});
