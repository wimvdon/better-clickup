import { describe, expect, it } from 'vitest';
import {
  MAX_TABS,
  activateTab,
  activeTab,
  closeOtherTabs,
  closeTab,
  createTabs,
  howToShow,
  moveTab,
  neighbourTabId,
  openTab,
  reopenClosedTab,
  tabIdForNumber,
  updateTab,
  type TabsState,
} from './tabs';

const HOME = 'https://app.clickup.com/';
const url = (n: number) => `https://app.clickup.com/t/${n}`;

/** A state with tabs 1..count in order, tab 1 shown. */
function withTabs(count: number): TabsState {
  let state = createTabs(url(1));
  for (let n = 2; n <= count; n++) state = openTab(state, url(n), { activate: false }).state;
  return { ...state, tabs: [...state.tabs].sort((a, b) => a.id - b.id) };
}
const ids = (state: TabsState) => state.tabs.map((t) => t.id);

describe('openTab', () => {
  it('opens next to the shown tab and shows it', () => {
    const state = activateTab(withTabs(3), 2);
    const { state: next, id } = openTab(state, url(9));
    expect(id).toBe(4);
    expect(ids(next)).toEqual([1, 2, 4, 3]);
    expect(activeTab(next).url).toBe(url(9));
  });

  it('can add a tab without showing it', () => {
    const { state } = openTab(createTabs(HOME), url(2), { activate: false });
    expect(state.activeId).toBe(1);
    expect(state.tabs[1]).toEqual({ id: 2, url: url(2), title: '' });
  });

  it('stops at the maximum number of tabs', () => {
    const state = withTabs(MAX_TABS);
    expect(openTab(state, HOME)).toEqual({ state, id: null });
  });
});

describe('activateTab', () => {
  it('shows the tab', () => {
    expect(activateTab(withTabs(2), 2).activeId).toBe(2);
  });

  it('ignores unknown and already shown tabs', () => {
    const state = withTabs(2);
    expect(activateTab(state, 99)).toBe(state);
    expect(activateTab(state, 1)).toBe(state);
  });
});

describe('closeTab', () => {
  it('shows the tab to the right, or else to the left', () => {
    const state = activateTab(withTabs(3), 2);
    expect(closeTab(state, 2, HOME).activeId).toBe(3);
    expect(closeTab(activateTab(state, 3), 3, HOME).activeId).toBe(2);
  });

  it('keeps the shown tab when closing another', () => {
    const state = closeTab(withTabs(3), 3, HOME);
    expect(ids(state)).toEqual([1, 2]);
    expect(state.activeId).toBe(1);
  });

  it('replaces the last tab with a fresh one', () => {
    const state = closeTab(createTabs(url(1)), 1, HOME);
    expect(state.tabs).toEqual([{ id: 2, url: HOME, title: '' }]);
    expect(state.activeId).toBe(2);
    expect(state.closed).toEqual([{ url: url(1), title: '' }]);
  });

  it('can reopen closed tabs, newest first', () => {
    let state = updateTab(withTabs(3), 3, { title: 'Three' });
    state = closeTab(closeTab(state, 2, HOME), 3, HOME);
    state = reopenClosedTab(state);
    expect(activeTab(state)).toMatchObject({ url: url(3), title: 'Three' });
    state = reopenClosedTab(state);
    expect(activeTab(state).url).toBe(url(2));
    expect(reopenClosedTab(state)).toBe(state);
  });

  it('closes all other tabs', () => {
    const state = closeOtherTabs(withTabs(4), 3, HOME);
    expect(ids(state)).toEqual([3]);
    expect(state.activeId).toBe(3);
    expect(state.closed).toHaveLength(3);
  });
});

describe('updateTab', () => {
  it('records changes, and returns the same state when nothing changed', () => {
    const state = withTabs(2);
    expect(updateTab(state, 2, { title: 'Two' }).tabs[1]?.title).toBe('Two');
    expect(updateTab(state, 2, { url: url(2) })).toBe(state);
    expect(updateTab(state, 99, { title: 'x' })).toBe(state);
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

describe('howToShow', () => {
  it('moves within ClickUp without reloading', () => {
    expect(howToShow(url(1), url(2))).toBe('inPage');
  });

  it('does nothing when the page is already there', () => {
    expect(howToShow(url(1), url(1))).toBe('none');
  });

  it('loads the page when it is somewhere else', () => {
    expect(howToShow('', url(1))).toBe('load');
    expect(howToShow('https://doc.clickup.com/d/1', url(1))).toBe('load');
    expect(howToShow('https://accounts.google.com/x', url(1))).toBe('load');
    expect(howToShow(url(1), 'https://doc.clickup.com/d/1')).toBe('load');
  });
});
