/**
 * The tabs of the window. All tabs share ONE ClickUp page (see docs/decisions.md): a tab is
 * a remembered place in ClickUp (address and title), and showing a tab moves the page there.
 * So more tabs cost almost no memory.
 * Pure functions on plain data: the main process keeps the state and shows it. Unit tested.
 */

export interface Tab {
  id: number;
  url: string;
  title: string;
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
/** A window never has more tabs than this (keeps the tab bar usable). */
export const MAX_TABS = 50;

export function createTabs(url: string): TabsState {
  return { tabs: [{ id: 1, url, title: '' }], activeId: 1, nextId: 2, closed: [] };
}

export function activeTab(state: TabsState): Tab {
  const tab = state.tabs.find((t) => t.id === state.activeId) ?? state.tabs[0];
  if (!tab) throw new Error('A window always has at least one tab');
  return tab;
}

export function activateTab(state: TabsState, id: number): TabsState {
  if (id === state.activeId || !state.tabs.some((t) => t.id === id)) return state;
  return { ...state, activeId: id };
}

export interface OpenOptions {
  title?: string;
  /** Show the new tab straight away (default), or only add it to the bar. */
  activate?: boolean;
}

/** Opens a tab next to the current one (like a browser). At MAX_TABS, nothing happens. */
export function openTab(
  state: TabsState,
  url: string,
  { title = '', activate = true }: OpenOptions = {},
): { state: TabsState; id: number | null } {
  if (state.tabs.length >= MAX_TABS) return { state, id: null };
  const id = state.nextId;
  const index = state.tabs.findIndex((t) => t.id === state.activeId) + 1;
  const tabs = [...state.tabs.slice(0, index), { id, url, title }, ...state.tabs.slice(index)];
  const next = { ...state, tabs, nextId: id + 1 };
  return { state: activate ? activateTab(next, id) : next, id };
}

/**
 * Closes a tab and remembers it for "reopen closed tab". If it was shown, the tab to its right
 * (or else its left) is shown. Closing the last tab leaves one fresh tab at `homeUrl`.
 */
export function closeTab(state: TabsState, id: number, homeUrl: string): TabsState {
  const index = state.tabs.findIndex((t) => t.id === id);
  const tab = state.tabs[index];
  if (!tab) return state;
  const closed = [{ url: tab.url, title: tab.title }, ...state.closed].slice(0, MAX_CLOSED);
  const tabs = state.tabs.filter((t) => t.id !== id);
  if (tabs.length === 0) {
    const fresh: Tab = { id: state.nextId, url: homeUrl, title: '' };
    return { tabs: [fresh], activeId: fresh.id, nextId: fresh.id + 1, closed };
  }
  const next: TabsState = { ...state, tabs, closed };
  if (state.activeId !== id) return next;
  return { ...next, activeId: tabs[Math.min(index, tabs.length - 1)]!.id };
}

/** Closes every tab except `id`. */
export function closeOtherTabs(state: TabsState, id: number, homeUrl: string): TabsState {
  return state.tabs
    .filter((t) => t.id !== id)
    .reduce((s, t) => closeTab(s, t.id, homeUrl), activateTab(state, id));
}

/** Reopens the most recently closed tab, next to the current one. */
export function reopenClosedTab(state: TabsState): TabsState {
  const [last, ...rest] = state.closed;
  if (!last) return state;
  const opened = openTab({ ...state, closed: rest }, last.url, { title: last.title });
  return opened.id === null ? state : opened.state;
}

/** Records the address or title the page reports for a tab. */
export function updateTab(
  state: TabsState,
  id: number,
  patch: Partial<Pick<Tab, 'url' | 'title'>>,
): TabsState {
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab || Object.entries(patch).every(([k, v]) => tab[k as keyof Tab] === v)) return state;
  return { ...state, tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
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

/**
 * How the shared page gets to a tab's address:
 * - `none`: it is already there.
 * - `inPage`: ClickUp moves there itself, like with its Back button. Fast, no reload.
 * - `load`: a full page load (the page is elsewhere: not loaded yet, another ClickUp site,
 *   or a sign-in page).
 */
export function howToShow(currentUrl: string, targetUrl: string): 'none' | 'inPage' | 'load' {
  if (currentUrl === targetUrl) return 'none';
  try {
    const current = new URL(currentUrl);
    const target = new URL(targetUrl);
    return current.origin === target.origin && current.hostname === 'app.clickup.com'
      ? 'inPage'
      : 'load';
  } catch {
    return 'load';
  }
}
