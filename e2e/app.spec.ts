import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';

let app: ElectronApplication;
let consoleErrors: string[];

test.beforeEach(async () => {
  app = await electron.launch({
    args: [
      '.',
      // Linux containers (Claude Code cloud sessions) run as root, where Chromium's sandbox
      // cannot start. Windows, where the app really runs, keeps the sandbox.
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      '--lang=en-US',
    ],
  });
  // Any error in the page (a crash, a blocked script, a failed IPC call) fails the test.
  consoleErrors = [];
  const watch = (page: Page) => {
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
  };
  app.windows().forEach(watch);
  app.on('window', watch);
});

test.afterEach(async () => {
  await app.close();
  expect(consoleErrors).toEqual([]);
});

test('opens the home screen and counts clicks', async () => {
  const page = await app.firstWindow();

  await expect(page.getByRole('heading', { name: 'Hello!' })).toBeVisible();
  await expect(page).toHaveTitle('Template');
  await expect(page.getByRole('status')).toHaveText('Clicked 0 times');

  await page.getByRole('button', { name: 'Click me' }).click();
  await expect(page.getByRole('status')).toHaveText('Clicked 1 time');
  await page.getByRole('button', { name: 'Click me' }).click();
  await expect(page.getByRole('status')).toHaveText('Clicked 2 times');

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('status')).toHaveText('Clicked 0 times');
});

test('shows the version', async () => {
  const page = await app.firstWindow();
  const version = await app.evaluate(({ app }) => app.getVersion());
  await expect(page.getByText(`Version ${version}`)).toBeVisible();
});

test('keeps the page locked down', async () => {
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'Hello!' })).toBeVisible();

  // No Node.js in the page; only the small API from the preload script.
  expect(await page.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe(
    'undefined',
  );
  expect(await page.evaluate(() => Object.keys(window.api))).toEqual(['getAppInfo']);

  // The window cannot be navigated away from the app (the attempt is cancelled).
  await page.evaluate(() => {
    setTimeout(() => (window.location.href = 'https://example.com/'), 0);
  });
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const url = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.webContents.getURL(),
  );
  expect(url).toBe('app://bundle/index.html');
});
