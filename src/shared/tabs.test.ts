import { describe, expect, it } from 'vitest';
import {
  MAX_TABS,
  activateTab,
  activeTab,
  closeOtherTabs,
  closeTab,
  createTabs,
  moveTab,
  neighbourTabId,
  openTab,
  putToSleep,
  reopenClosedTab,
  tabIdForNumber,
  tabsToSleep,
  updateTab,
  type TabsState,
} from './tabs';

const HOME = 'https://app.clickup.com/';
const url = (n: number) => `https://app.clickup.com/t/${n}`;

/** A state with tabs 1..count (tab 1 shown), all opened at time 0. */
function withTabs(count: number): TabsState {
  let state = createTabs(url(1), 0);
  for (let n = 2; n <= count; n++)
    state = openTab(state, url(n), { activate: false, now: 0 }).state;
  // Background tabs open in place next to the shown tab; sort them for readable tests.
  return { ...state, tabs: [...state.tabs].sort((a, b) => a.id - b.id) };
}
const ids = (state: TabsState) => state.tabs.map((t) => t.id);

describe('openTab', () => {
  it('opens next to the shown tab and shows it', () => {
    let state = withTabs(3);
    state = activateTab(state, 2, 5);
    const { state: next, id } = openTab(state, url(9), { now: 10 });
    expect(id).toBe(4);
    expect(ids(next)).toEqual([1, 2, 4, 3]);
    expect(next.activeId).toBe(4);
    expect(activeTab(next).asleep).toBe(false);
  });

  it('opens background tabs asleep, so they use no memory until opened', () => {
    const { state } = openTab(createTabs(HOME, 0), url(2), { activate: false, now: 1 });
    expect(state.activeId).toBe(1);
    expect(state.tabs[1]).toMatchObject({ url: url(2), asleep: true });
  });

  it('stops at the maximum number of tabs', () => {
    const state = withTabs(MAX_TABS);
    expect(openTab(state, HOME, { now: 1 })).toEqual({ state, id: null });
  });
});

describe('activateTab', () => {
  it('wakes the tab and stamps both tabs', () => {
    const state = activateTab(putToSleep(withTabs(2), [2]), 2, 50);
    expect(state.activeId).toBe(2);
    expect(state.tabs.map((t) => [t.asleep, t.lastActiveAt])).toEqual([
      [false, 50],
      [false, 50],
    ]);
  });

  it('ignores unknown tabs', () => {
    const state = withTabs(2);
    expect(activateTab(state, 99, 1)).toBe(state);
  });
});

describe('closeTab', () => {
  it('shows the tab to the right, or else to the left', () => {
    const state = activateTab(withTabs(3), 2, 0);
    expect(closeTab(state, 2, HOME, 1).activeId).toBe(3);
    expect(closeTab(activateTab(state, 3, 0), 3, HOME, 1).activeId).toBe(2);
  });

  it('keeps the shown tab when closing another', () => {
    const state = closeTab(withTabs(3), 3, HOME, 1);
    expect(ids(state)).toEqual([1, 2]);
    expect(state.activeId).toBe(1);
  });

  it('replaces the last tab with a fresh one', () => {
    const state = closeTab(createTabs(url(1), 0), 1, HOME, 1);
    expect(state.tabs).toEqual([{ id: 2, url: HOME, title: '', asleep: false, lastActiveAt: 1 }]);
    expect(state.activeId).toBe(2);
    expect(state.closed).toEqual([{ url: url(1), title: '' }]);
  });

  it('can reopen closed tabs, newest first', () => {
    let state = updateTab(withTabs(3), 3, { title: 'Three' });
    state = closeTab(closeTab(state, 2, HOME, 1), 3, HOME, 2);
    state = reopenClosedTab(state, 3);
    expect(activeTab(state)).toMatchObject({ url: url(3), title: 'Three' });
    state = reopenClosedTab(state, 4);
    expect(activeTab(state).url).toBe(url(2));
    expect(reopenClosedTab(state, 5)).toBe(state);
  });

  it('closes all other tabs', () => {
    const state = closeOtherTabs(withTabs(4), 3, HOME, 1);
    expect(ids(state)).toEqual([3]);
    expect(state.activeId).toBe(3);
    expect(state.closed).toHaveLength(3);
  });
});

describe('tabsToSleep', () => {
  const policy = { idleMs: 100, maxAwake: 3 };

  it('puts tabs to sleep that were not shown for a while', () => {
    let state = withTabs(3);
    state = activateTab(state, 2, 0); // wakes 2
    state = activateTab(state, 3, 60); // wakes 3, stamps 2
    state = activateTab(state, 1, 90);
    expect(tabsToSleep(state, 160, policy)).toEqual([2]);
    expect(tabsToSleep(state, 200, policy).sort()).toEqual([2, 3]);
  });

  it('never puts the shown tab to sleep', () => {
    const state = withTabs(1);
    expect(tabsToSleep(state, 10_000, policy)).toEqual([]);
    expect(putToSleep(state, [1])).toBe(state);
  });

  it('keeps at most maxAwake tabs loaded, unloading the longest-unused first', () => {
    let state = withTabs(5);
    for (const [id, now] of [
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 4],
      [1, 5],
    ] as const)
      state = activateTab(state, id, now);
    // Shown: 1. Awake, newest first: 5, 4, 3, 2. Only 2 more may stay awake.
    expect(tabsToSleep(state, 6, policy).sort()).toEqual([2, 3]);
  });
});

describe('moving and picking tabs', () => {
  it('moves a tab', () => {
    expect(ids(moveTab(withTabs(4), 1, 2))).toEqual([2, 3, 1, 4]);
    expect(ids(moveTab(withTabs(3), 3, -5))).toEqual([3, 1, 2]);
    expect(ids(moveTab(withTabs(3), 1, 99))).toEqual([2, 3, 1]);
  });

  it('finds the next and previous tab, wrapping around', () => {
    const state = withTabs(3);
    expect(neighbourTabId(state, 1)).toBe(2);
    expect(neighbourTabId(state, -1)).toBe(3);
  });

  it('picks a tab by number, 9 being the last', () => {
    const state = withTabs(3);
    expect(tabIdForNumber(state, 2)).toBe(2);
    expect(tabIdForNumber(state, 9)).toBe(3);
    expect(tabIdForNumber(state, 5)).toBeNull();
  });
});
