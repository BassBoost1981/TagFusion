import { afterEach, describe, expect, it, vi } from 'vitest';

describe('settingsStore', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('loads and updates settings even when localStorage is blocked', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      removeItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    });

    const { useSettingsStore } = await import('../settingsStore');

    expect(() => useSettingsStore.getState().setTheme('light')).not.toThrow();
    expect(useSettingsStore.getState().theme).toBe('light');

    expect(() => useSettingsStore.getState().setPerformanceMode(true)).not.toThrow();
    expect(useSettingsStore.getState().performanceMode).toBe(true);
  });
});
