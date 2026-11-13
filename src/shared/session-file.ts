/**
 * The file that remembers the open tabs, the window's size and a few settings between starts
 * (%APPDATA%\<App>\session.json). Reading it treats the contents as untrusted: anything
 * unexpected is dropped instead of crashing the app. Unit tested.
 */
import { isClickUpUrl } from './clickup-urls';
import { MAX_TABS, type TabsState } from './tabs';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SessionFile {
  version: 1;
  tabs: { url: string; title: string }[];
  activeIndex: number;
  bounds: WindowBounds | null;
  maximized: boolean;
  /** Page zoom of ClickUp (0 = 100 %). */
  zoomLevel: number;
  /** The "still running in the tray" hint has been shown once. */
  trayHintShown: boolean;
}

export const EMPTY_SESSION: SessionFile = {
  version: 1,
  tabs: [],
  activeIndex: 0,
  bounds: null,
  maximized: false,
  zoomLevel: 0,
  trayHintShown: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isInt = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

function parseBounds(value: unknown): WindowBounds | null {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  if (!isInt(x, -100_000, 100_000) || !isInt(y, -100_000, 100_000)) return null;
  if (!isInt(width, 200, 100_000) || !isInt(height, 200, 100_000)) return null;
  return { x, y, width, height };
}

/** Reads the file's contents (already JSON-parsed). Never throws. */
export function parseSession(value: unknown): SessionFile {
  if (!isRecord(value) || value.version !== 1) return EMPTY_SESSION;
  const tabs = (Array.isArray(value.tabs) ? value.tabs : [])
    .filter(isRecord)
    .filter((t) => typeof t.url === 'string' && t.url.length <= 2048 && isClickUpUrl(t.url))
    .map((t) => ({
      url: t.url as string,
      title: typeof t.title === 'string' ? t.title.slice(0, 200) : '',
    }))
    .slice(0, MAX_TABS);
  const activeIndex = isInt(value.activeIndex, 0, Math.max(0, tabs.length - 1))
    ? value.activeIndex
    : 0;
  return {
    version: 1,
    tabs,
    activeIndex,
    bounds: parseBounds(value.bounds),
    maximized: value.maximized === true,
    zoomLevel:
      typeof value.zoomLevel === 'number' && Math.abs(value.zoomLevel) <= 5 ? value.zoomLevel : 0,
    trayHintShown: value.trayHintShown === true,
  };
}

/** The saved tabs as a fresh tab state. */
export function tabsFromSession(session: SessionFile): TabsState | null {
  if (session.tabs.length === 0) return null;
  const tabs = session.tabs.map((t, index) => ({ id: index + 1, url: t.url, title: t.title }));
  return { tabs, activeId: session.activeIndex + 1, nextId: tabs.length + 1, closed: [] };
}

/** The part of the tab state that is saved. */
export function sessionTabs(state: TabsState): Pick<SessionFile, 'tabs' | 'activeIndex'> {
  return {
    tabs: state.tabs.map((t) => ({ url: t.url, title: t.title })),
    activeIndex: Math.max(
      0,
      state.tabs.findIndex((t) => t.id === state.activeId),
    ),
  };
}
