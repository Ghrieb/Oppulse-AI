import { useCallback, useSyncExternalStore } from 'react';

/**
 * Tracks a media query.
 *
 * Used where rendering the same navigation twice would create duplicate
 * landmarks and duplicate controls for assistive technology.
 *
 * `useSyncExternalStore` is the right primitive here: the media query list
 * *is* an external store, and this subscribes to it without a state
 * synchronisation effect.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
