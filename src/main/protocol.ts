import { net, protocol } from 'electron';
import { pathToFileURL } from 'node:url';
import { APP_SCHEME, resolveBundlePath } from './bundle-path';

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/**
 * Serves the bundled UI from app://bundle/ instead of file:// (Electron security checklist),
 * so the page gets no access to other files on the PC.
 */
export function serveBundle(root: string): void {
  protocol.handle(APP_SCHEME, (request) => {
    const file = resolveBundlePath(root, request.url);
    if (!file) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}
