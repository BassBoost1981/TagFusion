import { describe, it, expect } from 'vitest';
import i18n from '../i18n';

describe('test setup', () => {
  it('initializes i18n for component tests', () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it('provides an IndexedDB mock in jsdom', () => {
    expect(globalThis.indexedDB).toBeDefined();
    expect(typeof globalThis.indexedDB.open).toBe('function');
  });

  it('provides a Redux devtools extension stub', () => {
    expect(
      (globalThis as typeof globalThis & { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__
    ).toBeDefined();
  });
});
