import { app, session, type Session } from 'electron';
import { chromeUserAgent, isClickUpUrl } from '../shared/clickup-urls';

/**
 * All tabs share one browser profile ("partition"), kept on disk in the app's data folder:
 * one ClickUp login, and one disk cache, so a tab that opens or wakes up loads quickly.
 * It is separate from the app's own UI, which keeps its strict lock-down (security.ts).
 */
export const CLICKUP_PARTITION = 'persist:clickup';

/** What ClickUp's pages may use: notifications, copying to the clipboard, full screen video. */
const ALLOWED_PERMISSIONS = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen']);

const allowed = (permission: string, url: string) =>
  ALLOWED_PERMISSIONS.has(permission) && isClickUpUrl(url);

export function setUpClickUpSession(): Session {
  const clickUp = session.fromPartition(CLICKUP_PARTITION);
  clickUp.setUserAgent(
    chromeUserAgent(clickUp.getUserAgent(), `${app.getName()}/${app.getVersion()}`),
  );
  // Camera, microphone, location, … are refused; only ClickUp itself gets the few above.
  clickUp.setPermissionRequestHandler((_contents, permission, callback, details) =>
    callback(allowed(permission, details.requestingUrl)),
  );
  clickUp.setPermissionCheckHandler((_contents, permission, origin) =>
    allowed(permission, `${origin}/`),
  );
  return clickUp;
}
