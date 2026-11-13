import { isAbsolute, join, normalize, relative } from 'node:path';

export const APP_SCHEME = 'app';
export const APP_HOST = 'bundle';
/** Where the UI is loaded from: app://bundle/index.html */
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/**
 * Maps an app://bundle/... URL to a file inside the bundled UI folder.
 * Returns null for anything else, including attempts to reach files outside it ("../").
 * Plain Node.js (no Electron), so it is unit tested in bundle-path.test.ts.
 */
export function resolveBundlePath(root: string, requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) return null;

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;

  const file = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
  const inside = relative(root, file);
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) return null;
  return file;
}
