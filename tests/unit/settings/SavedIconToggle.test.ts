import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/svelte';

// $lib/ext captures the global when first imported, so the fake has to exist
// before any import runs. Each test swaps in its own answers via `opts`.
const opts = vi.hoisted(() => ({ granted: false, userAccepts: false }));
const fake = vi.hoisted(() => {
  const noop = { addListener: () => {}, removeListener: () => {} };
  const f = {
    permissions: {
      contains: async () => opts.granted,
      request: async (_p: unknown) => opts.userAccepts,
      remove: async (_p: unknown) => true,
      onAdded: noop,
      onRemoved: noop,
    },
  };
  (globalThis as { chrome?: unknown }).chrome = f;
  return f;
});

import SavedIconToggle from '../../../src/settings/SavedIconToggle.svelte';

async function setup(o: { granted: boolean; userAccepts: boolean }) {
  Object.assign(opts, o);
  vi.spyOn(fake.permissions, 'request');
  vi.spyOn(fake.permissions, 'remove');
  const view = render(SavedIconToggle);
  const box = view.getByRole('checkbox') as HTMLInputElement;
  await waitFor(() => expect(box.disabled).toBe(false));
  return { fake, box };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SavedIconToggle', () => {
  it('reflects whether the tabs permission is already granted', async () => {
    const { box } = await setup({ granted: true, userAccepts: true });
    expect(box.checked).toBe(true);
  });

  it('asks for the tabs permission when switched on', async () => {
    const { fake, box } = await setup({ granted: false, userAccepts: true });
    await fireEvent.click(box);
    expect(fake.permissions.request).toHaveBeenCalledWith({ permissions: ['tabs'] });
    await waitFor(() => expect(box.checked).toBe(true));
  });

  it('unticks itself when the user declines the prompt', async () => {
    const { box } = await setup({ granted: false, userAccepts: false });
    await fireEvent.click(box);
    await waitFor(() => expect(box.checked).toBe(false));
  });

  it('gives the permission back when switched off', async () => {
    const { fake, box } = await setup({ granted: true, userAccepts: true });
    await fireEvent.click(box);
    expect(fake.permissions.remove).toHaveBeenCalledWith({ permissions: ['tabs'] });
    await waitFor(() => expect(box.checked).toBe(false));
  });
});
