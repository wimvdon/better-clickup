import { describe, expect, it } from 'vitest';
import { EMPTY_SESSION, parseSession, sessionTabs, tabsFromSession } from './session-file';
import { activateTab, createTabs, openTab } from './tabs';

describe('parseSession', () => {
  it('reads a valid file', () => {
    const file = {
      version: 1,
      tabs: [
        { url: 'https://app.clickup.com/t/1', title: 'One' },
        { url: 'https://app.clickup.com/t/2', title: 'Two' },
      ],
      activeIndex: 1,
      bounds: { x: 10, y: 20, width: 1200, height: 800 },
      maximized: true,
      zoomLevel: 1,
      trayHintShown: true,
    };
    expect(parseSession(file)).toEqual(file);
  });

  it('falls back to defaults for broken or unknown files', () => {
    expect(parseSession(null)).toEqual(EMPTY_SESSION);
    expect(parseSession('text')).toEqual(EMPTY_SESSION);
    expect(parseSession({ version: 2, tabs: [] })).toEqual(EMPTY_SESSION);
  });

  it('drops anything that is not a ClickUp page or not sensible', () => {
    const session = parseSession({
      version: 1,
      tabs: [
        { url: 'https://evil.example/', title: 'x' },
        { url: 'file:///C:/x' },
        { url: 'https://app.clickup.com/t/1', title: 42 },
        'nonsense',
      ],
      activeIndex: 7,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      zoomLevel: 99,
    });
    expect(session.tabs).toEqual([{ url: 'https://app.clickup.com/t/1', title: '' }]);
    expect(session.activeIndex).toBe(0);
    expect(session.bounds).toBeNull();
    expect(session.zoomLevel).toBe(0);
  });
});

describe('tabsFromSession', () => {
  it('restores the tabs with only the shown one loaded', () => {
    const state = tabsFromSession(
      {
        ...EMPTY_SESSION,
        tabs: [
          { url: 'https://app.clickup.com/t/1', title: 'One' },
          { url: 'https://app.clickup.com/t/2', title: 'Two' },
        ],
        activeIndex: 1,
      },
      100,
    );
    expect(state?.activeId).toBe(2);
    expect(state?.tabs.map((t) => t.asleep)).toEqual([true, false]);
    expect(state?.nextId).toBe(3);
  });

  it('returns null when nothing was saved', () => {
    expect(tabsFromSession(EMPTY_SESSION, 0)).toBeNull();
  });

  it('round-trips through sessionTabs', () => {
    let state = createTabs('https://app.clickup.com/t/1', 0);
    state = openTab(state, 'https://app.clickup.com/t/2', { now: 0 }).state;
    state = activateTab(state, 2, 1);
    const saved = parseSession({ ...EMPTY_SESSION, ...sessionTabs(state) });
    expect(saved.tabs.map((t) => t.url)).toEqual([
      'https://app.clickup.com/t/1',
      'https://app.clickup.com/t/2',
    ]);
    expect(saved.activeIndex).toBe(1);
  });
});
