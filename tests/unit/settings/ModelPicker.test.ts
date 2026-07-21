import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ModelPicker from '../../../src/settings/ModelPicker.svelte';

const OR = {
  presets: ['anthropic/claude-haiku-4.5', 'openai/gpt-4o-mini'],
  providerLabel: 'OpenRouter',
  modelsUrl: 'https://openrouter.ai/models',
};
const ANT = {
  presets: ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8'],
  providerLabel: 'Anthropic',
  modelsUrl: 'https://docs.claude.com/en/docs/about-claude/models/overview',
};

describe('ModelPicker', () => {
  it('lists the provider presets', () => {
    const { getByRole } = render(ModelPicker, { value: 'claude-haiku-4-5', ...ANT });
    const select = getByRole('combobox', { name: 'Model preset' }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(ANT.presets);
  });

  it('does not offer OpenRouter model ids when Anthropic is active', () => {
    const { getByRole } = render(ModelPicker, { value: 'claude-haiku-4-5', ...ANT });
    const select = getByRole('combobox', { name: 'Model preset' }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).not.toContain('openai/gpt-4o-mini');
  });

  it('starts in custom mode for a model id outside the presets', () => {
    const { getByLabelText } = render(ModelPicker, { value: 'some/custom-model', ...OR });
    expect((getByLabelText('Custom model id') as HTMLInputElement).value).toBe('some/custom-model');
  });

  it('accepts a custom model id', async () => {
    const { getByText, getByLabelText } = render(ModelPicker, {
      value: 'claude-haiku-4-5',
      ...ANT,
    });
    await fireEvent.click(getByText(/different model id/i));
    const input = getByLabelText('Custom model id') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'claude-opus-4-8-custom' } });
    await fireEvent.blur(input);
    expect(input.value).toBe('claude-opus-4-8-custom');
  });

  it('links to the active provider model catalogue', () => {
    const { container } = render(ModelPicker, { value: 'claude-haiku-4-5', ...ANT });
    const link = container.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toBe(ANT.modelsUrl);
    expect(link.textContent).toContain('Anthropic');
  });

  it('keeps the user in custom mode after clicking through (regression)', async () => {
    // The mode effect must key on the preset list, not on `value` — otherwise
    // clicking "use a different model id" snaps straight back to the dropdown,
    // because at that moment `value` is still one of the presets.
    const { getByText, getByLabelText, queryByLabelText } = render(ModelPicker, {
      value: 'claude-haiku-4-5',
      ...ANT,
    });
    await fireEvent.click(getByText(/different model id/i));
    expect(queryByLabelText('Model preset')).toBeNull();
    expect(getByLabelText('Custom model id')).toBeTruthy();
  });
});
