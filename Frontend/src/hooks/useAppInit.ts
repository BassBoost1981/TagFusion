import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { useTagStore } from '../stores/tagStore';

/**
 * App initialization hook - runs once on mount.
 * Subscribes only to stable function references (never change).
 *
 * PERF: Subscriptions run immediately, but tag loading is deferred
 * so it doesn't block the first paint / UI render.
 */
export function useAppInit() {
  const setupSubscriptions = useAppStore((state) => state.setupSubscriptions);
  const loadAllTags = useAppStore((state) => state.loadAllTags);
  const initTagStore = useTagStore((state) => state.initialize);

  useEffect(() => {
    setupSubscriptions();

    let cancelled = false;

    const runDeferredInit = () => {
      if (cancelled) return;
      initTagStore();
      loadAllTags();
    };

    if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(() => {
        runDeferredInit();
      });

      return () => {
        cancelled = true;
        if ('cancelIdleCallback' in window && typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(runDeferredInit, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [setupSubscriptions, loadAllTags, initTagStore]);
}
