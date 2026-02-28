import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { useTagStore } from '../stores/tagStore';

/**
 * App initialization hook - runs once on mount.
 * Subscribes only to stable function references (never change).
 */
export function useAppInit() {
  const setupSubscriptions = useAppStore((state) => state.setupSubscriptions);
  const loadAllTags = useAppStore((state) => state.loadAllTags);
  const initTagStore = useTagStore((state) => state.initialize);

  useEffect(() => {
    setupSubscriptions();
    loadAllTags();
    initTagStore();
  }, [setupSubscriptions, loadAllTags, initTagStore]);
}

