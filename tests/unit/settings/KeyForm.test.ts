import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import KeyForm from '../../../src/settings/KeyForm.svelte';

/** The props every render needs, defaulted to the OpenRouter provider. */
const base = {
  providerLabel: 'OpenRouter',
  keysUrl: 'https://openrouter.ai/keys',
  keyPlaceholder: 'sk-or-v1-...',
  onSave: () => {},
  onRemove: () => {},
  onTest: async () => 'idle' as const,
};

describe('KeyForm', () => {
  it('shows masked key when one is set', () => {
    const { getByDisplayValue } = render(KeyForm, {
      ...base,
      currentKey: 'sk-or-v1-abc123def456ghi789jkl012mno345',
    });
    // First 8 visible, rest masked
    expect(getByDisplayValue(/^sk-or-v1.*•.*$/)).toBeTruthy();
  });

  it('clicking Edit reveals an input that accepts a new key', async () => {
    const onSave = vi.fn();
    const { getByText, getByLabelText } = render(KeyForm, {
      ...base,
      currentKey: 'sk-or-v1-old',
      onSave,
    });
    await fireEvent.click(getByText('Change'));
    const input = getByLabelText('OpenRouter API key') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'sk-or-v1-new' } });
    await fireEvent.click(getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('sk-or-v1-new');
  });

  it('clicking Remove fires onRemove', async () => {
    const onRemove = vi.fn();
    const { getByText } = render(KeyForm, {
      ...base,
      currentKey: 'sk-or-v1-x',
      onRemove,
    });
    await fireEvent.click(getByText('Remove key'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('shows "Add key" UI when no key is set', () => {
    const { getByText } = render(KeyForm, {
      ...base,
      currentKey: null,
    });
    expect(getByText(/no key set/i)).toBeTruthy();
  });

  it('labels the field with the active provider', () => {
    const { getByText } = render(KeyForm, {
      ...base,
      providerLabel: 'Anthropic',
      currentKey: null,
    });
    expect(getByText('Anthropic API key')).toBeTruthy();
  });

  it('uses the provider placeholder and key link when adding a key', async () => {
    const { getByText, getByLabelText, container } = render(KeyForm, {
      ...base,
      providerLabel: 'Anthropic',
      keysUrl: 'https://console.anthropic.com/settings/keys',
      keyPlaceholder: 'sk-ant-...',
      currentKey: null,
    });
    await fireEvent.click(getByText('Add key'));
    const input = getByLabelText('Anthropic API key') as HTMLInputElement;
    expect(input.placeholder).toBe('sk-ant-...');
    expect(input.type).toBe('password');
    const link = container.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toBe('https://console.anthropic.com/settings/keys');
  });

  it('saves the key for whichever provider is active', async () => {
    const onSave = vi.fn();
    const { getByText, getByLabelText } = render(KeyForm, {
      ...base,
      providerLabel: 'Anthropic',
      keyPlaceholder: 'sk-ant-...',
      currentKey: null,
      onSave,
    });
    await fireEvent.click(getByText('Add key'));
    await fireEvent.input(getByLabelText('Anthropic API key'), {
      target: { value: '  sk-ant-new  ' },
    });
    await fireEvent.click(getByText('Save'));
    // Whitespace from a paste must not reach the API.
    expect(onSave).toHaveBeenCalledWith('sk-ant-new');
  });

  it('does not save an empty key', async () => {
    const onSave = vi.fn();
    const { getByText } = render(KeyForm, { ...base, currentKey: null, onSave });
    await fireEvent.click(getByText('Add key'));
    await fireEvent.click(getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
  });
});
