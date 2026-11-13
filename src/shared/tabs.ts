/**
 * The tabs of the window: which exist, which is shown, and which are "asleep" (unloaded to
 * save memory; they load again, with fresh data, when you open them).
 * Pure functions on plain data: the main process keeps the state and shows it. Unit tested.
 */

export interface Tab {
  id: number;
  url: string;
  title: string;
  /** Unloaded: no page in memory. Opening the tab loads it again. */
  asleep: boolean;
  /** When the tab was last shown (ms since 1970). Used to decide which tabs go to sleep. */
  lastActiveAt: number;
}

export interface ClosedTab {
  url: string;
  title: string;
}

export interface TabsState {
  tabs: Tab[];
  activeId: number;
  nextId: number;
  /** Recently closed tabs, newest first, for "reopen closed tab". */
  closed: ClosedTab[];
}

/** How many closed tabs "reopen closed tab" remembers. */
export const MAX_CLOSED = 20;
/** A window never has more tabs than this (protects memory and the tab bar). */
export const MAX_TABS = 50;

export function createTabs(url: string, now: number): TabsState {
  return {
    tabs: [{ id: 1, url, title: '', asleep: false, lastActiveAt: now }],
    activeId: 1,
    nextId: 2,
    closed: [],
  };
}

export function activeTab(state: TabsState): Tab {
  const tab = state.tabs.find((t) => t.id === state.activeId) ?? state.tabs[0];
  if (!tab) throw new Error('A window always has at least one tab');
  return tab;
}

/** Shows a tab. The previous tab is stamped, so its idle time starts now. */
export function activateTab(state: TabsState, id: number, now: number): TabsState {
  if (!state.tabs.some((t) => t.id === id)) return state;
  return {
    ...state,
    activeId: id,
    tabs: state.tabs.map((t) =>
      t.id === id || t.id === state.activeId ? { ...t, asleep: false, lastActiveAt: now } : t,
    ),
  };
}

export interface OpenOptions {
  title?: string;
  /** Show the new tab straight away (default), or open it in the background. */
  activate?: boolean;
  now: number;
}

/** Opens a tab next to the current one (like a browser). At MAX_TABS, nothing happens. */
export function openTab(
  state: TabsState,
  url: string,
  { title = '', activate = true, now }: OpenOptions,
): { state: TabsState; id: number | null } {
  if (state.tabs.length >= MAX_TABS) return { state, id: null };
  const id = state.nextId;
  const index = state.tabs.findIndex((t) => t.id === state.activeId) + 1;
  // A background tab doesn't load until it is opened: no memory used for it yet.
  const tab: Tab = { id, url, title, asleep: !activate, lastActiveAt: now };
  const tabs = [...state.tabs.slice(0, index), tab, ...state.tabs.slice(index)];
  const next = { ...state, tabs, nextId: id + 1 };
  return { state: activate ? activateTab(next, id, now) : next, id };
}

/**
 * Closes a tab and remembers it for "reopen closed tab". If it was shown, the tab to its right
 * (or else its left) is shown. Closing the last tab leaves one fresh tab at `homeUrl`.
 */
export function closeTab(state: TabsState, id: number, homeUrl: string, now: number): TabsState {
  const index = state.tabs.findIndex((t) => t.id === id);
  const tab = state.tabs[index];
  if (!tab) return state;
  const closed = [{ url: tab.url, title: tab.title }, ...state.closed].slice(0, MAX_CLOSED);
  const tabs = state.tabs.filter((t) => t.id !== id);
  if (tabs.length === 0) {
    const fresh: Tab = {
      id: state.nextId,
      url: homeUrl,
      title: '',
      asleep: false,
      lastActiveAt: now,
    };
    return { tabs: [fresh], activeId: fresh.id, nextId: fresh.id + 1, closed };
  }
  const next: TabsState = { ...state, tabs, closed };
  if (state.activeId !== id) return next;
  const neighbour = tabs[Math.min(index, tabs.length - 1)]!;
  return activateTab({ ...next, activeId: neighbour.id }, neighbour.id, now);
}

/** Closes every tab except `id`. */
export function closeOtherTabs(state: TabsState, id: number, homeUrl: string, now: number) {
  return state.tabs
    .filter((t) => t.id !== id)
    .reduce((s, t) => closeTab(s, t.id, homeUrl, now), activateTab(state, id, now));
}

/** Reopens the most recently closed tab, next to the current one. */
export function reopenClosedTab(state: TabsState, now: number): TabsState {
  const [last, ...rest] = state.closed;
  if (!last) return state;
  const opened = openTab({ ...state, closed: rest }, last.url, { title: last.title, now });
  return opened.id === null ? state : opened.state;
}

/** Records the address or title a tab's page reports. */
export function updateTab(
  state: TabsState,
  id: number,
  patch: Partial<Pick<Tab, 'url' | 'title'>>,
): TabsState {
  return { ...state, tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
}

/** Unloads a tab. The shown tab never sleeps. */
export function putToSleep(state: TabsState, ids: readonly number[]): TabsState {
  if (!ids.some((id) => id !== state.activeId)) return state;
  return {
    ...state,
    tabs: state.tabs.map((t) =>
      ids.includes(t.id) && t.id !== state.activeId ? { ...t, asleep: true } : t,
    ),
  };
}

export interface SleepPolicy {
  /** A tab that hasn't been shown for this long goes to sleep. */
  idleMs: number;
  /** At most this many tabs stay loaded (including the shown one); the longest-unused sleep first. */
  maxAwake: number;
}

/** Background tabs are unloaded after 10 minutes, and at most 4 tabs stay loaded. */
export const DEFAULT_SLEEP_POLICY: SleepPolicy = { idleMs: 10 * 60 * 1000, maxAwake: 4 };

/** Which tabs should go to sleep now. */
export function tabsToSleep(state: TabsState, now: number, policy: SleepPolicy): number[] {
  const awake = state.tabs
    .filter((t) => !t.asleep && t.id !== state.activeId)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  return awake
    .filter((t, index) => now - t.lastActiveAt >= policy.idleMs || index >= policy.maxAwake - 1)
    .map((t) => t.id);
}

/** Moves a tab to another position (drag and drop). */
export function moveTab(state: TabsState, id: number, toIndex: number): TabsState {
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab) return state;
  const rest = state.tabs.filter((t) => t.id !== id);
  const index = Math.max(0, Math.min(Math.trunc(toIndex), rest.length));
  return { ...state, tabs: [...rest.slice(0, index), tab, ...rest.slice(index)] };
}

/** The tab `offset` places from the shown one, wrapping around (Ctrl+Tab, Ctrl+Shift+Tab). */
export function neighbourTabId(state: TabsState, offset: number): number {
  const count = state.tabs.length;
  const index = state.tabs.findIndex((t) => t.id === state.activeId);
  return state.tabs[(((index + offset) % count) + count) % count]!.id;
}

/** Ctrl+1 … Ctrl+8 pick that tab, Ctrl+9 the last one (like browsers). */
export function tabIdForNumber(state: TabsState, number: number): number | null {
  const tab = number === 9 ? state.tabs.at(-1) : state.tabs[number - 1];
  return tab?.id ?? null;
}
