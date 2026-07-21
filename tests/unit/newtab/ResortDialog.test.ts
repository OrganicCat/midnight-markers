import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { _resetDbForTests } from '$lib/storage/db';
import { collections } from '$lib/storage/collections';
import { bookmarks } from '$lib/storage/bookmarks';
import { settings } from '$lib/storage/settings';
import ResortDialog from '../../../src/newtab/ResortDialog.svelte';

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
  await settings.set({ openrouterKey: 'sk-test', aiConsentAt: 1 });
});
afterEach(() => vi.unstubAllGlobals());

function reply(payload: unknown): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }));
}

async function seed() {
  const old = await collections.create({ name: 'Old' });
  return bookmarks.create({
    url: 'https://rust-lang.org',
    title: 'Rust book',
    originalTitle: 'Rust book',
    collectionId: old.id,
  });
}

/** Skeleton call returns Dev > Rust; filing call files whatever ids it was given. */
function stubPlan(id: string) {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(reply({ folders: [['Dev', 'Rust']], renames: [], merges: [] }))
      .mockResolvedValue(reply({ filings: [{ id, path: ['Dev', 'Rust'] }] })),
  );
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    scope: { kind: 'all' as const },
    scopeLabel: 'All bookmarks',
    onClose: () => {},
    onApplied: () => {},
    ...overrides,
  };
}

describe('ResortDialog', () => {
  it('shows a planning state first', async () => {
    const b = await seed();
    stubPlan(b.id);
    render(ResortDialog, { props: props() });
    expect(screen.getByText(/planning folders/i)).toBeTruthy();
  });

  it('shows the proposed tree and a change count once planning finishes', async () => {
    const b = await seed();
    stubPlan(b.id);
    render(ResortDialog, { props: props() });
    await waitFor(() => expect(screen.getByText('Rust book')).toBeTruthy());
    expect(screen.getByText(/changes selected/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /apply/i })).toBeTruthy();
  });

  it('drops the count when a change is unchecked', async () => {
    const b = await seed();
    stubPlan(b.id);
    render(ResortDialog, { props: props() });
    await waitFor(() => expect(screen.getByText('Rust book')).toBeTruthy());
    const before = screen.getByText(/changes selected/i).textContent ?? '';
    await fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    await waitFor(() => expect(screen.getByText(/changes selected/i).textContent).not.toBe(before));
  });

  it('applies and reports the result', async () => {
    const b = await seed();
    stubPlan(b.id);
    const onApplied = vi.fn();
    render(ResortDialog, { props: props({ onApplied }) });
    await waitFor(() => expect(screen.getByText('Rust book')).toBeTruthy());
    await fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(onApplied.mock.calls[0]![0].moved).toBe(1);
  });

  it('shows the failure reason when planning fails', async () => {
    await seed();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));
    render(ResortDialog, { props: props() });
    await waitFor(() => expect(screen.getByText(/401/)).toBeTruthy());
  });

  it('refuses to run without an API key', async () => {
    await settings.set({ openrouterKey: '', aiConsentAt: 1 });
    await seed();
    render(ResortDialog, { props: props() });
    await waitFor(() => expect(screen.getByText(/no api key/i)).toBeTruthy());
  });

  it('closes on Cancel', async () => {
    const b = await seed();
    stubPlan(b.id);
    const onClose = vi.fn();
    render(ResortDialog, { props: props({ onClose }) });
    await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('says so when the plan proposes nothing', async () => {
    const dev = await collections.create({ name: 'Dev' });
    await bookmarks.create({ url: 'https://x.com', title: 'X', originalTitle: 'X', collectionId: dev.id });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(reply({ folders: [['Dev']], renames: [], merges: [] }))
        .mockResolvedValue(reply({ filings: [] })),
    );
    render(ResortDialog, { props: props() });
    await waitFor(() => expect(screen.getByText(/already well organized|no changes/i)).toBeTruthy());
  });
});
