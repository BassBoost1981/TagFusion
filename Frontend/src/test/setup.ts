import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import '../i18n';

vi.stubGlobal('bridge', {
  invoke: vi.fn(),
  postMessage: vi.fn(),
});

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

class MockIDBRequest {
  public result: unknown;
  public error: Error | null = null;
  public onsuccess: ((this: IDBRequest, ev: Event) => unknown) | null = null;
  public onerror: ((this: IDBRequest, ev: Event) => unknown) | null = null;
  public onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null = null;

  constructor(result: unknown) {
    this.result = result;
  }
}

const mockObjectStore = {
  get: vi.fn(() => {
    const request = new MockIDBRequest(undefined);
    queueMicrotask(() => request.onsuccess?.call(request as unknown as IDBRequest, new Event('success')));
    return request;
  }),
  put: vi.fn(),
  count: vi.fn(() => {
    const request = new MockIDBRequest(0);
    queueMicrotask(() => request.onsuccess?.call(request as unknown as IDBRequest, new Event('success')));
    return request;
  }),
  openCursor: vi.fn(() => new MockIDBRequest(null)),
};

const mockDb = {
  objectStoreNames: {
    contains: vi.fn(() => true),
  },
  createObjectStore: vi.fn(),
  transaction: vi.fn(() => ({
    objectStore: vi.fn(() => mockObjectStore),
  })),
};

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
vi.stubGlobal('indexedDB', {
  open: vi.fn(() => {
    const request = new MockIDBRequest(mockDb);
    queueMicrotask(() => request.onsuccess?.call(request as unknown as IDBRequest, new Event('success')));
    return request;
  }),
});

vi.stubGlobal('__REDUX_DEVTOOLS_EXTENSION__', {
  connect: vi.fn(() => ({
    subscribe: vi.fn(() => vi.fn()),
    unsubscribe: vi.fn(),
    send: vi.fn(),
    init: vi.fn(),
    error: vi.fn(),
  })),
});

// localStorage mock for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);
