import { app, shell, type WebContents, type WebFrameMain } from 'electron';
import { APP_ORIGIN } from './bundle-path';

/** The renderer is only ever loaded from the bundled files or, during development, the dev server. */
export function isAppUrl(url: string): boolean {
  if (url.startsWith(`${APP_ORIGIN}/`)) return true;
  const devServer = process.env.ELECTRON_RENDERER_URL;
  return !app.isPackaged && devServer !== undefined && url.startsWith(devServer);
}

/** IPC messages are only answered when they come from the app's own page. */
export function isTrustedSender(frame: WebFrameMain | null): boolean {
  return frame !== null && isAppUrl(frame.url);
}

/**
 * Locks down a window's web contents (Electron security checklist):
 * no navigation away from the app, no new windows, no permission prompts.
 * Web links open in the user's default browser instead.
 */
export function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  contents.session.setPermissionCheckHandler(() => false);
}
