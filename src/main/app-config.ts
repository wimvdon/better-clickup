import { app } from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AppConfig {
  /** Windows App User Model ID: groups taskbar icons and identifies the app's notifications. */
  appId: string;
  /** Whether the app checks GitHub Releases for updates (see docs/decisions.md). */
  autoUpdate: boolean;
}

/**
 * Reads the app's identity from its own package.json at runtime. The build changes these
 * fields for dev builds (".dev" suffix), so they must not be bundled in at compile time.
 */
export function readAppConfig(): AppConfig {
  const pkg = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')) as {
    appId?: unknown;
    autoUpdate?: unknown;
  };
  if (typeof pkg.appId !== 'string' || pkg.appId === '') {
    throw new Error('package.json must have an "appId"');
  }
  return { appId: pkg.appId, autoUpdate: pkg.autoUpdate === true };
}
