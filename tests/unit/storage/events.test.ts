import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storageEvents, emit } from '$lib/storage/events';

beforeEach(() => storageEvents.removeAll());

describe('storageEvents', () => {
  it('notifies subscribers when an event is emitted', () => {
    const fn = vi.fn();
    storageEvents.on('bookmarks:changed', fn);
    emit({ type: 'bookmarks:changed' });
    expect(fn).toHaveBeenCalledWith({ type: 'bookmarks:changed' });
  });

  it('off removes a single listener', () => {
    const fn = vi.fn();
    storageEvents.on('bookmarks:changed', fn);
    storageEvents.off('bookmarks:changed', fn);
    emit({ type: 'bookmarks:changed' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not crash when no listeners', () => {
    expect(() => emit({ type: 'collections:changed' })).not.toThrow();
  });
});
