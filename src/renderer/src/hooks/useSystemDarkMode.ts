import { useSyncExternalStore } from 'react';

const query = window.matchMedia('(prefers-color-scheme: dark)');

const subscribe = (onChange: () => void) => {
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

/** True while Windows is in dark mode (Settings > Personalization > Colors). Updates live. */
export function useSystemDarkMode(): boolean {
  return useSyncExternalStore(subscribe, () => query.matches);
}
