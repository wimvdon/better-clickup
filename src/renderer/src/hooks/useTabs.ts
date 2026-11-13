import { useEffect, useState } from 'react';
import type { TabsView } from '../../../shared/ipc';

/** The tabs as the main process reports them. Updates live. */
export function useTabs(): TabsView | null {
  const [tabs, setTabs] = useState<TabsView | null>(null);
  useEffect(() => {
    let active = true;
    const stop = window.api.onTabsChanged((value) => {
      active = false; // A live update beats the first answer, whichever arrives first.
      setTabs(value);
    });
    void window.api.getTabs().then((value) => {
      if (active && value) setTabs(value);
    });
    return () => {
      active = false;
      stop();
    };
  }, []);
  return tabs;
}
