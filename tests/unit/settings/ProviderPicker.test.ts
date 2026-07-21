import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ProviderPicker from '../../../src/settings/ProviderPicker.svelte';

const noKeys = { openrouter: false, anthropic: false };

describe('ProviderPicker', () => {
  it('offers both providers', () => {
    const { getByText } = render(ProviderPicker, { value: 'openrouter', hasKey: noKeys });
    expect(getByText('OpenRouter')).toBeTruthy();
    expect(getByText('Anthropic')).toBeTruthy();
  });

  it('marks the active provider as checked', () => {
    const { getByRole } = render(ProviderPicker, { value: 'anthropic', hasKey: noKeys });
    expect(getByRole('radio', { name: /Anthropic/ }).getAttribute('aria-checked')).toBe('true');
    expect(getByRole('radio', { name: /OpenRouter/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('selects a provider on click', async () => {
    const { getByRole } = render(ProviderPicker, { value: 'openrouter', hasKey: noKeys });
    const anthropic = getByRole('radio', { name: /Anthropic/ });
    await fireEvent.click(anthropic);
    expect(anthropic.getAttribute('aria-checked')).toBe('true');
  });

  it('shows which providers already have a key saved', () => {
    const { getByRole } = render(ProviderPicker, {
      value: 'openrouter',
      hasKey: { openrouter: true, anthropic: false },
    });
    expect(getByRole('radio', { name: /OpenRouter/ }).textContent).toContain('Key saved');
    expect(getByRole('radio', { name: /Anthropic/ }).textContent).toContain('No key yet');
  });

  it('is exposed as a labelled radiogroup', () => {
    const { getByRole } = render(ProviderPicker, { value: 'openrouter', hasKey: noKeys });
    expect(getByRole('radiogroup', { name: 'AI provider' })).toBeTruthy();
  });
});
