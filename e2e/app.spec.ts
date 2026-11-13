import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let app: ElectronApplication;
let dataDir: string;
let consoleErrors: string[];

interface E2E {
  notifications: { title: string; body: string; emit(event: string): void }[];
  external: string[];
}

/** Starts the app with an empty data folder (optionally with a saved session) and fake ClickUp. */
async function launch(session?: object) {
  if (session) writeFileSync(join(dataDir, 'session.json'), JSON.stringify(session));
  app = await electron.launch({
    args: [
      '-r',
      join(import.meta.dirname, 'fake-clickup.mjs'),
      '.',
      // Linux containers (Claude Code cloud sessions) run as root, where Chromium's sandbox
      // cannot start. Windows, where the app really runs, keeps the sandbox.
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      '--lang=en-US',
    ],
    env: { ...process.env, APP_USER_DATA_DIR: dataDir },
  });
  // Any error in a page (a crash, a blocked script, a failed IPC call) fails the test.
  const watch = (page: Page) => {
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(`${page.url()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => consoleErrors.push(`${page.url()}: ${error.message}`));
  };
  app.windows().forEach(watch);
  app.on('window', watch);
}

/** The window's own UI: the tab bar. */
async function tabBar(): Promise<Page> {
  return findPage((url) => url.startsWith('app://bundle/'));
}

/** A ClickUp page in one of the tabs. */
async function clickUpPage(path: string): Promise<Page> {
  return findPage((url) => url === `https://app.clickup.com${path}`);
}

async function findPage(match: (url: string) => boolean): Promise<Page> {
  let found: Page | undefined;
  await expect
    .poll(() => (found = app.windows().find((page) => match(page.url()))), { timeout: 15_000 })
    .toBeTruthy();
  return found!;
}

/**
 * Presses a key the way Windows delivers it, so the app's shortcut handling sees it
 * (Playwright's own key presses skip that step). `where`: the tab bar or a ClickUp page.
 */
async function press(where: 'bar' | 'page', keyCode: string, modifiers: string[] = []) {
  await app.evaluate(
    ({ webContents }, { where, keyCode, modifiers }) => {
      const target = webContents
        .getAllWebContents()
        .find((c) => c.getURL().startsWith(where === 'bar' ? 'app://' : 'https://'));
      target?.sendInputEvent({ type: 'keyDown', keyCode, modifiers: modifiers as never });
      target?.sendInputEvent({ type: 'keyUp', keyCode, modifiers: modifiers as never });
    },
    { where, keyCode, modifiers },
  );
}

const e2e = () => app.evaluate(() => (globalThis as unknown as { __e2e: E2E }).__e2e);
const notificationTitles = () =>
  app.evaluate(() =>
    (globalThis as unknown as { __e2e: E2E }).__e2e.notifications.map((n) => n.title),
  );
/** How many ClickUp pages are loaded in memory. */
const loadedPages = () =>
  app.evaluate(
    ({ webContents }) =>
      webContents.getAllWebContents().filter((c) => c.getURL().startsWith('https://')).length,
  );

test.beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'better-clickup-e2e-'));
  consoleErrors = [];
});

test.afterEach(async () => {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
  expect(consoleErrors).toEqual([]);
});

test('opens ClickUp in a tab', async () => {
  await launch();
  const bar = await tabBar();
  await expect(bar).toHaveTitle('Better ClickUp');
  await expect(bar.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
  await expect((await clickUpPage('/')).getByRole('heading', { name: 'Home' })).toBeVisible();
});

test('opens, switches, closes and reopens tabs', async () => {
  await launch();
  const bar = await tabBar();
  await expect(bar.getByRole('tab')).toHaveCount(1);

  await bar.getByRole('button', { name: 'New tab (Ctrl+T)' }).click();
  await expect(bar.getByRole('tab')).toHaveCount(2);
  await expect(bar.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');

  await bar.getByRole('tab').nth(0).click();
  await expect(bar.getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true');

  await bar.getByRole('button', { name: 'Close Home' }).first().click();
  await expect(bar.getByRole('tab')).toHaveCount(1);

  // Keyboard shortcuts, in the tab bar and inside ClickUp.
  await press('bar', 'T', ['control', 'shift']);
  await expect(bar.getByRole('tab')).toHaveCount(2);
  await press('page', 'T', ['control']);
  await expect(bar.getByRole('tab')).toHaveCount(3);
  await expect(bar.getByRole('tab').nth(2)).toHaveAttribute('aria-selected', 'true');
  await press('page', 'Tab', ['control']);
  await expect(bar.getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true');
  await press('bar', 'W', ['control']);
  await expect(bar.getByRole('tab')).toHaveCount(2);
});

test('opens ClickUp links as tabs, and other links in the browser', async () => {
  await launch();
  const bar = await tabBar();
  const home = await clickUpPage('/');

  await home.locator('#task').click();
  await expect(bar.getByRole('tab', { name: 'Task 42' })).toHaveAttribute('aria-selected', 'true');
  await expect((await clickUpPage('/t/42')).getByRole('heading')).toHaveText('Task 42');

  await home.locator('#external').click();
  await expect.poll(async () => (await e2e()).external).toEqual(['https://example.com/']);
  await expect(bar.getByRole('tab')).toHaveCount(2);
});

test('opens clickup:// links in a new tab', async () => {
  await launch();
  const bar = await tabBar();
  await expect(bar.getByRole('tab')).toHaveCount(1);
  // What Windows does when a clickup:// link is opened while the app runs.
  await app.evaluate(({ app }) =>
    app.emit('second-instance', {}, ['Better ClickUp.exe', 'clickup://t/77'], ''),
  );
  await expect(bar.getByRole('tab', { name: 'Task 77' })).toHaveAttribute('aria-selected', 'true');
});

test('shows ClickUp notifications once and opens their tab when clicked', async () => {
  await launch();
  const bar = await tabBar();
  const home = await clickUpPage('/');
  await expect(home.getByRole('heading')).toHaveText('Home');
  expect(await home.evaluate(() => Notification.permission)).toBe('granted');

  await home.evaluate(() => (window as unknown as { notify(t: string): void }).notify('Assigned'));
  // The same notification again (as a second tab would report it) is not shown twice.
  await home.evaluate(() => (window as unknown as { notify(t: string): void }).notify('Assigned'));
  await expect.poll(notificationTitles).toEqual(['Assigned']);
  expect(
    await app.evaluate(
      () => (globalThis as unknown as { __e2e: E2E }).__e2e.notifications[0]?.body,
    ),
  ).toBe('From Home');

  await press('bar', 'T', ['control']);
  await expect(bar.getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'false');

  await app.evaluate(() =>
    (globalThis as unknown as { __e2e: E2E }).__e2e.notifications[0]?.emit('click'),
  );
  await expect(bar.getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true');
  // The page's own click handler ran (ClickUp uses it to open the task).
  await expect(bar.getByRole('tab', { name: 'Clicked' })).toBeVisible();
});

test('restores the saved tabs, loading only the one that was shown', async () => {
  await launch({
    version: 1,
    tabs: [
      { url: 'https://app.clickup.com/t/1', title: 'Task 1' },
      { url: 'https://app.clickup.com/t/2', title: 'Task 2' },
      { url: 'https://app.clickup.com/t/3', title: 'Task 3' },
    ],
    activeIndex: 1,
  });
  const bar = await tabBar();
  await expect(bar.getByRole('tab')).toHaveCount(3);
  await expect(bar.getByRole('tab', { name: 'Task 2' })).toHaveAttribute('aria-selected', 'true');
  await clickUpPage('/t/2');
  expect(await loadedPages()).toBe(1);
  await expect(bar.getByRole('tab', { name: 'Task 3' })).toHaveAttribute('title', /asleep/);

  // A sleeping tab loads when you open it.
  await bar.getByRole('tab', { name: 'Task 3' }).click();
  await clickUpPage('/t/3');
  await expect.poll(loadedPages).toBe(2);
});

test('keeps the pages locked down', async () => {
  await launch();
  const bar = await tabBar();
  const home = await clickUpPage('/');
  await expect(home.getByRole('heading')).toHaveText('Home');

  // No Node.js in any page; the tab bar gets only the small API from its preload script,
  // ClickUp's pages get nothing.
  for (const page of [bar, home]) {
    expect(await page.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe(
      'undefined',
    );
  }
  expect(await bar.evaluate(() => Object.keys(window.api).sort())).toEqual([
    'getAppInfo',
    'getTabs',
    'onTabsChanged',
    'tabCommand',
  ]);
  expect(await home.evaluate(() => 'api' in window)).toBe(false);
  const version = await app.evaluate(({ app }) => app.getVersion());
  expect((await bar.evaluate(() => window.api.getAppInfo())).version).toBe(version);

  // The window cannot be navigated away from the app (the attempt is cancelled).
  await bar.evaluate(() => {
    setTimeout(() => (window.location.href = 'https://example.com/'), 0);
  });
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const url = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.webContents.getURL(),
  );
  expect(url).toBe('app://bundle/index.html');

  // A ClickUp tab cannot be navigated to another site either: the link opens in the browser.
  await home.evaluate(() => {
    setTimeout(() => (window.location.href = 'https://example.org/'), 0);
  });
  await expect.poll(async () => (await e2e()).external).toEqual(['https://example.org/']);
  expect(home.url()).toBe('https://app.clickup.com/');
});
