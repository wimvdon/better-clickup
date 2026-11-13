import { app } from 'electron';
import electronUpdater from 'electron-updater';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/**
 * Checks GitHub Releases for a newer version, downloads it in the background and shows a
 * Windows notification; the update installs when the app is closed.
 * Only runs in installed release builds with "autoUpdate": true in package.json.
 * Needs a public repository (see README, "Automatic updates").
 */
export function startAutoUpdates(): void {
  const { autoUpdater } = electronUpdater;
  const check = () =>
    autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
      // Offline, rate-limited or a private repository: try again later, never bother the user.
      console.warn('Update check failed:', error instanceof Error ? error.message : error);
    });
  void check();
  setInterval(() => void check(), CHECK_INTERVAL_MS).unref();
  app.on('before-quit', () => autoUpdater.removeAllListeners());
}
