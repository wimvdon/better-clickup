import { app, Menu, Tray } from 'electron';
import { join } from 'node:path';
import { t } from './i18n';

export interface TrayActions {
  show(): void;
  newTab(): void;
  quit(): void;
}

/** The icon file: packaged next to the app (electron-builder extraResources), or from build/. */
function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tray.ico')
    : join(app.getAppPath(), 'build', 'icon.ico');
}

/** Starting with Windows opens the app hidden in the tray, ready for notifications. */
export const HIDDEN_ARG = '--hidden';
const loginItem = { args: [HIDDEN_ARG] };

/**
 * The icon in the notification area (next to the clock). Closing the window keeps the app
 * running there, so ClickUp notifications keep arriving, like the official app.
 * Returns null if Windows has no notification area (then closing the window quits).
 */
export function createTray(
  actions: TrayActions,
): { tray: Tray; setTabCount(count: number): void } | null {
  let tray: Tray;
  try {
    tray = new Tray(iconPath());
  } catch (error) {
    console.warn('No tray icon:', error instanceof Error ? error.message : error);
    return null;
  }
  const name = app.getName();
  const menu = () =>
    Menu.buildFromTemplate([
      { label: t('tray.open', { app: name }), click: actions.show },
      { label: t('tray.newTab'), click: actions.newTab },
      { type: 'separator' },
      {
        label: t('tray.startWithWindows'),
        type: 'checkbox',
        checked: app.getLoginItemSettings(loginItem).openAtLogin,
        click: (item) => app.setLoginItemSettings({ ...loginItem, openAtLogin: item.checked }),
      },
      { label: t('tray.version', { version: app.getVersion() }), enabled: false },
      { type: 'separator' },
      { label: t('tray.quit'), click: actions.quit },
    ]);
  // Built fresh each time: "Start with Windows" can also change in Windows Settings → Apps → Startup.
  if (process.platform === 'win32') tray.on('right-click', () => tray.popUpContextMenu(menu()));
  else tray.setContextMenu(menu());
  tray.on('click', actions.show);
  tray.setToolTip(name);
  return {
    tray,
    setTabCount: (count) => tray.setToolTip(t('tray.tooltip', { app: name, count })),
  };
}
