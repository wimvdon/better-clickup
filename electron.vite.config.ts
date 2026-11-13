import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

/**
 * Adds a strict Content Security Policy to the built page (Electron security checklist).
 * Only for production builds: the dev server's hot reload needs inline scripts.
 * Fluent UI injects its styles at runtime, hence 'unsafe-inline' for styles only.
 */
const contentSecurityPolicy = (): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'" />`,
    ),
});

export default defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        // Two preload scripts: the tab bar's (index) and the ClickUp pages' (clickup).
        // They share no modules, so each builds to one self-contained file, as sandboxing requires.
        input: { index: 'src/preload/index.ts', clickup: 'src/preload/clickup.ts' },
        // Sandboxed preload scripts must be CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    plugins: [react(), contentSecurityPolicy()],
  },
});
