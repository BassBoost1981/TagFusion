import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppInit } from './useAppInit';

const setupSubscriptions = vi.fn();
const loadAllTags = vi.fn();
const initializeTagStore = vi.fn();

vi.mock('../stores/appStore', () => ({
  useAppStore: (
    selector: (state: { setupSubscriptions: typeof setupSubscriptions; loadAllTags: typeof loadAllTags }) => unknown
  ) =>
    selector({
      setupSubscriptions,
      loadAllTags,
    }),
}));

vi.mock('../stores/tagStore', () => ({
  useTagStore: (selector: (state: { initialize: typeof initializeTagStore }) => unknown) =>
    selector({
      initialize: initializeTagStore,
    }),
}));

function TestComponent() {
  useAppInit();
  return null;
}

describe('useAppInit', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sets up subscriptions immediately and defers tag loading to idle time', () => {
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      requestIdleCallback.lastCallback = callback;
      return 1;
    }) as typeof window.requestIdleCallback & { lastCallback?: IdleRequestCallback };

    const cancelIdleCallback = vi.fn();

    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

    render(<TestComponent />);

    expect(setupSubscriptions).toHaveBeenCalledTimes(1);
    expect(loadAllTags).not.toHaveBeenCalled();
    expect(initializeTagStore).not.toHaveBeenCalled();

    requestIdleCallback.lastCallback?.({
      didTimeout: false,
      timeRemaining: () => 10,
    } as IdleDeadline);

    expect(initializeTagStore).toHaveBeenCalledTimes(1);
    expect(loadAllTags).toHaveBeenCalledTimes(1);
  });

  it('cancels deferred initialization on unmount', () => {
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      requestIdleCallback.lastCallback = callback;
      return 7;
    }) as typeof window.requestIdleCallback & { lastCallback?: IdleRequestCallback };

    const cancelIdleCallback = vi.fn();

    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

    const { unmount } = render(<TestComponent />);
    unmount();

    expect(cancelIdleCallback).toHaveBeenCalledWith(7);

    requestIdleCallback.lastCallback?.({
      didTimeout: false,
      timeRemaining: () => 10,
    } as IdleDeadline);

    expect(initializeTagStore).not.toHaveBeenCalled();
    expect(loadAllTags).not.toHaveBeenCalled();
  });
});
