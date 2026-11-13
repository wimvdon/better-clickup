import { app, BrowserWindow, Menu, nativeTheme } from 'electron';
import { join } from 'node:path';
import { readAppConfig } from './app-config';
import { APP_ORIGIN } from './bundle-path';
import { registerIpcHandlers } from './ipc';
import { registerAppScheme, serveBundle } from './protocol';
import { hardenWebContents } from './security';
import { startAutoUpdates } from './updater';

// Windows users often double-click a shortcut again: focus the open window instead of
// starting a second copy of the app.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  registerAppScheme();

  let mainWindow: BrowserWindow | null = null;

  const createWindow = () => {
    mainWindow = new BrowserWindow({
      width: 960,
      height: 640,
      minWidth: 480,
      minHeight: 360,
      show: false,
      // Matches the Fluent UI page background, so there is no white flash in dark mode.
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#292929' : '#ffffff',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.cjs'),
        // Electron security checklist: keep all three of these exactly like this.
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    hardenWebContents(mainWindow.webContents);
    mainWindow.once('ready-to-show', () => mainWindow?.show());
    mainWindow.on('closed', () => (mainWindow = null));

    const devServer = process.env.ELECTRON_RENDERER_URL;
    if (!app.isPackaged && devServer) {
      void mainWindow.loadURL(devServer);
    } else {
      void mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
    }
  };

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
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
    serveBundle(join(import.meta.dirname, '../renderer'));
    registerIpcHandlers();
    createWindow();
    if (app.isPackaged && config.autoUpdate) startAutoUpdates();
  });
}
