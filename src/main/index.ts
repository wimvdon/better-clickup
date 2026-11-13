import { app, BrowserWindow, Menu, nativeTheme, screen } from 'electron';
import { release } from 'node:os';
import { join } from 'node:path';
import { CLICKUP_HOME, clickUpLinkFromArgs } from '../shared/clickup-urls';
import { TAB_BAR_HEIGHT } from '../shared/ipc';
import { sessionTabs, tabsFromSession, type WindowBounds } from '../shared/session-file';
import { createTabs } from '../shared/tabs';
import { supportsMica } from '../shared/windows-version';
import { readAppConfig } from './app-config';
import { APP_ORIGIN } from './bundle-path';
import { CLICKUP_PARTITION, setUpClickUpSession } from './clickup-session';
import { t } from './i18n';
import { registerIpcHandlers } from './ipc';
import { NotificationCenter } from './notifications';
import { registerAppScheme, serveBundle } from './protocol';
import { hardenWebContents } from './security';
import { SessionStore } from './session-store';
import { TabManager } from './tabs';
import { HIDDEN_ARG, createTray } from './tray';
import { startAutoUpdates } from './updater';

// End-to-end tests give each run its own empty data folder. Never used by the installed app.
if (!app.isPackaged && process.env.APP_USER_DATA_DIR) {
  app.setPath('userData', process.env.APP_USER_DATA_DIR);
}

/**
 * Windows 11's Mica material: the tab bar shows a soft tint of the desktop wallpaper, like
 * Edge, Explorer and Settings. Older Windows versions get the solid Fluent UI colour instead.
 */
const MICA = supportsMica(process.platform, release());

/**
 * Colours of the window's own minimise/maximise/close buttons, which Windows draws over the
 * right end of the tab bar. They match Fluent UI's colorNeutralBackground3/Foreground1
 * (the tab bar's colours), which can't be read here, outside the UI. With Mica the buttons'
 * background is clear, so the material shows through.
 */
const titleBarOverlay = () => {
  const dark = nativeTheme.shouldUseDarkColors;
  const solid = dark ? '#141414' : '#f5f5f5';
  return {
    color: MICA ? '#00000000' : solid,
    symbolColor: dark ? '#ffffff' : '#242424',
    height: TAB_BAR_HEIGHT,
  };
};

/** Saved window bounds, if they still fit on one of the screens (a monitor may be gone). */
function visibleBounds(bounds: WindowBounds | null): WindowBounds | null {
  if (!bounds) return null;
  const area = screen.getDisplayMatching(bounds).workArea;
  const overlaps =
    bounds.x < area.x + area.width - 100 &&
    bounds.x + bounds.width > area.x + 100 &&
    bounds.y >= area.y - 10 &&
    bounds.y < area.y + area.height - 100;
  return overlaps ? bounds : null;
}

// Windows users often double-click a shortcut again: focus the open window instead of
// starting a second copy of the app. ClickUp links opened later arrive the same way.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  registerAppScheme();

  let mainWindow: BrowserWindow | null = null;
  let tabs: TabManager | null = null;
  let quitting = false;
  let store: SessionStore | null = null;
  let tray: ReturnType<typeof createTray> = null;

  const showWindow = () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };

  const notifications = new NotificationCenter(
    app.getName(),
    () => {
      // Like other chat and work apps: the taskbar button flashes until you look.
      if (mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(true);
    },
    (tabId, notificationId) => {
      showWindow();
      tabs?.notificationClicked(tabId, notificationId);
    },
  );

  const createWindow = (store: SessionStore, session: Electron.Session, startHidden: boolean) => {
    const saved = store.get();
    const bounds = visibleBounds(saved.bounds);
    const window = new BrowserWindow({
      ...(bounds ?? { width: 1280, height: 820 }),
      minWidth: 640,
      minHeight: 400,
      show: false,
      // Mica needs a clear window background. Otherwise: the tab bar's colour, so there is
      // no white flash in dark mode.
      ...(MICA
        ? { backgroundMaterial: 'mica' as const, backgroundColor: '#00000000' }
        : { backgroundColor: nativeTheme.shouldUseDarkColors ? '#141414' : '#f5f5f5' }),
      // The tabs sit in the title bar, like in Edge; Windows still draws its own buttons.
      titleBarStyle: 'hidden',
      titleBarOverlay: titleBarOverlay(),
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.cjs'),
        // Electron security checklist: keep all three of these exactly like this.
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    mainWindow = window;
    hardenWebContents(window.webContents);
    if (saved.maximized) window.maximize();
    if (!startHidden) window.once('ready-to-show', () => window.show());

    tabs = new TabManager({
      window,
      session,
      partition: CLICKUP_PARTITION,
      preload: join(import.meta.dirname, '../preload/clickup.cjs'),
      initial: tabsFromSession(saved, Date.now()) ?? createTabs(CLICKUP_HOME, Date.now()),
      zoomLevel: saved.zoomLevel,
      onChange: (state) => {
        store.update(sessionTabs(state));
        tray?.setTabCount(state.tabs.length);
      },
      onZoomChange: (zoomLevel) => store.update({ zoomLevel }),
    });

    // Shortcuts work while the tab bar has focus too, not just inside ClickUp.
    window.webContents.on('before-input-event', (event, input) => {
      if (tabs?.handleKey(input)) event.preventDefault();
    });
    // The back/forward buttons on the side of many mice.
    window.on('app-command', (_event, command) => {
      if (command === 'browser-backward') tabs?.run({ action: 'back' });
      if (command === 'browser-forward') tabs?.run({ action: 'forward' });
    });
    window.on('focus', () => window.flashFrame(false));
    nativeTheme.on('updated', () => {
      if (!window.isDestroyed()) window.setTitleBarOverlay(titleBarOverlay());
    });

    const saveBounds = () => {
      if (window.isDestroyed() || window.isMinimized()) return;
      store.update({ bounds: window.getNormalBounds(), maximized: window.isMaximized() });
    };
    window.on('resize', saveBounds);
    window.on('move', saveBounds);
    window.on('maximize', saveBounds);
    window.on('unmaximize', saveBounds);

    // Closing the window keeps the app running in the tray, so notifications keep coming.
    window.on('close', (event) => {
      if (quitting || !tray) return;
      event.preventDefault();
      window.hide();
      if (!store.get().trayHintShown) {
        tray.tray.displayBalloon({
          title: t('tray.hintTitle', { app: app.getName() }),
          content: t('tray.hintBody'),
          iconType: 'info',
        });
        store.update({ trayHintShown: true });
      }
    });
    window.on('closed', () => {
      tabs?.destroy();
      tabs = null;
      mainWindow = null;
    });

    const devServer = process.env.ELECTRON_RENDERER_URL;
    if (!app.isPackaged && devServer) {
      void window.loadURL(devServer);
    } else {
      void window.loadURL(`${APP_ORIGIN}/index.html`);
    }
  };

  // A ClickUp link opened while the app runs (clickup:// link, or the app started with a link).
  app.on('second-instance', (_event, argv) => {
    const link = clickUpLinkFromArgs(argv);
    if (link) tabs?.open(link);
    showWindow();
  });

  app.on('before-quit', () => {
    quitting = true;
    store?.flush();
  });

  // Windows apps quit when their last window closes.
  app.on('window-all-closed', () => app.quit());

  void app.whenReady().then(() => {
    const config = readAppConfig();
    // Must match the installer's shortcuts (electron-builder uses the appId), or Windows
    // shows notifications and taskbar pins under the wrong name.
    app.setAppUserModelId(config.appId);
    // No File/Edit/View menu: it would be English-only and exposes developer reloads.
    Menu.setApplicationMenu(null);
    const sessionStore = new SessionStore(join(app.getPath('userData'), 'session.json'));
    store = sessionStore;
    serveBundle(join(import.meta.dirname, '../renderer'));
    registerIpcHandlers({ mica: MICA, tabs: () => tabs, notifications });
    tray = createTray({
      show: showWindow,
      newTab: () => {
        showWindow();
        tabs?.open(CLICKUP_HOME);
      },
      quit: () => app.quit(),
    });
    const startHidden = process.argv.includes(HIDDEN_ARG) && tray !== null;
    createWindow(sessionStore, setUpClickUpSession(), startHidden);
    const link = clickUpLinkFromArgs(process.argv);
    if (link) tabs?.open(link);
    if (app.isPackaged && config.autoUpdate) startAutoUpdates();
  });
}
