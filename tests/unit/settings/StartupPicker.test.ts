import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import StartupPicker from '../../../src/settings/StartupPicker.svelte';

describe('StartupPicker', () => {
  it('reflects the stored preference', () => {
    const { getByRole } = render(StartupPicker, { value: true });
    expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('is off when the preference is off', () => {
    const { getByRole } = render(StartupPicker, { value: false });
    expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });

  it('toggles on click', async () => {
    const { getByRole } = render(StartupPicker, { value: false });
    const box = getByRole('checkbox') as HTMLInputElement;
    await fireEvent.click(box);
    expect(box.checked).toBe(true);
  });

  it('names the hotkey that gets you back to the search box', () => {
    const { container } = render(StartupPicker, { value: false });
    expect(container.textContent).toMatch(/Ctrl\+Shift\+F|⌘⇧F/);
  });
});
