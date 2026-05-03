export type StorageEvent =
  | { type: 'bookmarks:changed' }
  | { type: 'collections:changed' }
  | { type: 'tags:changed' }
  | { type: 'settings:changed' };

type Listener = (e: StorageEvent) => void;

class Bus {
  private listeners = new Map<StorageEvent['type'], Set<Listener>>();

  on(type: StorageEvent['type'], fn: Listener): void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn);
  }

  off(type: StorageEvent['type'], fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }

  removeAll(): void {
    this.listeners.clear();
  }

  emit(e: StorageEvent): void {
    this.listeners.get(e.type)?.forEach((fn) => fn(e));
  }
}

export const storageEvents = new Bus();

export function emit(e: StorageEvent): void {
  storageEvents.emit(e);
}
