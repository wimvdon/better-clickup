/**
 * The only channels between the renderer (UI) and the main process.
 * Every channel is listed here, exposed by src/preload/index.ts and handled in src/main/ipc.ts.
 * The ClickUp pages in the tabs have their own, smaller bridge: see clickup-ipc.ts.
 */
export const IPC = {
  getAppInfo: 'app:get-info',
  getTabs: 'tabs:get',
  /** Main → UI: the tabs changed. */
  tabsChanged: 'tabs:changed',
  tabCommand: 'tabs:command',
} as const;

/** Height of the tab bar at the top of the window, in pixels. The tabs' pages start below it. */
export const TAB_BAR_HEIGHT = 40;

export interface AppInfo {
  name: string;
  version: string;
  /** Preferred languages of the Windows user, most preferred first. */
  languages: string[];
  /** The window uses Windows 11's Mica material: the tab bar must leave its background clear. */
  mica: boolean;
}

/** What the tab bar shows of one tab. */
export interface TabView {
  id: number;
  title: string;
  asleep: boolean;
  loading: boolean;
}

export interface TabsView {
  tabs: TabView[];
  activeId: number;
  canGoBack: boolean;
  canGoForward: boolean;
}

/** What the tab bar can ask the main process to do. */
export type TabCommand =
  | { type: 'new' }
  | { type: 'activate'; id: number }
  | { type: 'close'; id: number }
  | { type: 'menu'; id: number }
  | { type: 'move'; id: number; index: number }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload' };

const isId = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;

/** Validates a command from the UI (src/main/ipc.ts). Returns null for anything else. */
export function parseTabCommand(value: unknown): TabCommand | null {
  if (typeof value !== 'object' || value === null) return null;
  const { type, id, index } = value as Record<string, unknown>;
  switch (type) {
    case 'new':
    case 'back':
    case 'forward':
    case 'reload':
      return { type };
    case 'activate':
    case 'close':
    case 'menu':
      return isId(id) ? { type, id } : null;
    case 'move':
      return isId(id) && Number.isSafeInteger(index) && (index as number) >= 0
        ? { type, id, index: index as number }
        : null;
    default:
      return null;
  }
}

/** What the preload script exposes to the renderer as window.api. */
export interface Api {
  getAppInfo(): Promise<AppInfo>;
  /** null only for a moment while the app starts. */
  getTabs(): Promise<TabsView | null>;
  /** Calls `listener` whenever the tabs change. Returns a function that stops listening. */
  onTabsChanged(listener: (tabs: TabsView) => void): () => void;
  tabCommand(command: TabCommand): void;
}
