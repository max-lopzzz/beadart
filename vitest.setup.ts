import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom's window.localStorage isn't functional under this environment
// (its methods throw "not a function"), so tests that touch localStorage
// (e.g. the overview-share slug) get a minimal in-memory polyfill instead.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(window, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
});

// jsdom doesn't implement ResizeObserver (and doesn't do real layout, so
// there's nothing meaningful to observe anyway) — stub it out so code that
// uses it for responsive sizing doesn't throw in tests.
class StubResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

window.ResizeObserver = StubResizeObserver;
