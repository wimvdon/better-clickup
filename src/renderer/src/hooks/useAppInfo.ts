import { useEffect, useState } from 'react';
import type { AppInfo } from '../../../shared/ipc';

/** Name, version and the user's Windows languages, from the main process. */
export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    let active = true;
    void window.api.getAppInfo().then((value) => {
      if (active) setInfo(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return info;
}
