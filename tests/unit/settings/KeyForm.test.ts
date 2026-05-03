import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import KeyForm from '../../../src/settings/KeyForm.svelte';

describe('KeyForm', () => {
  it('shows masked key when one is set', () => {
    const { getByDisplayValue } = render(KeyForm, {
      currentKey: 'sk-or-v1-abc123def456ghi789jkl012mno345',
      onSave: () => {},
      onRemove: () => {},
      onTest: async () => 'idle',
    });
    // First 8 visible, rest masked
    expect(getByDisplayValue(/^sk-or-v1.*•.*$/)).toBeTruthy();
  });

  it('clicking Edit reveals an input that accepts a new key', async () => {
    const onSave = vi.fn();
    const { getByText, getByLabelText } = render(KeyForm, {
      currentKey: 'sk-or-v1-old',
      onSave,
      onRemove: () => {},
      onTest: async () => 'idle',
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
      currentKey: 'sk-or-v1-x',
      onSave: () => {},
      onRemove,
      onTest: async () => 'idle',
    });
    await fireEvent.click(getByText('Remove key'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('shows "Add key" UI when no key is set', () => {
    const { getByText } = render(KeyForm, {
      currentKey: null,
      onSave: () => {},
      onRemove: () => {},
      onTest: async () => 'idle',
    });
    expect(getByText(/no key set/i)).toBeTruthy();
  });
});
