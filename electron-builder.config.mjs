// @ts-check
/**
 * Builds the Windows installer (npm run dist). The app's identity comes from package.json
 * (name, productName, appId), the one place to change it.
 *
 * Two kinds of build:
 *  - Release: the release workflow sets APP_RELEASE_VERSION=X.Y.Z.
 *  - Dev (everything else, e.g. pull requests): named "<App> Dev" with appId "<appId>.dev",
 *    an orange icon and a git-describe version. It installs NEXT TO the real app, with its
 *    own data, so testing a pull request never touches your installed app or its settings.
 */
import { readFileSync } from 'node:fs';
import { devVersion, parseVersion } from './scripts/version.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const releaseVersion = process.env.APP_RELEASE_VERSION;
const isRelease = Boolean(releaseVersion);
if (releaseVersion) parseVersion(releaseVersion);

const name = isRelease ? pkg.name : `${pkg.name}-dev`;
const productName = isRelease ? pkg.productName : `${pkg.productName} Dev`;
const appId = isRelease ? pkg.appId : `${pkg.appId}.dev`;
const version = releaseVersion ?? devVersion();
const autoUpdate = isRelease && pkg.autoUpdate === true;

// "owner/repo", from GitHub Actions or the "repository" field in package.json.
const repository = process.env.GITHUB_REPOSITORY ?? pkg.repository;

/** @type {import('electron-builder').Configuration} */
const config = {
  appId,
  productName,
  // Written into the packaged package.json, which the app reads at runtime.
  extraMetadata: { name, productName, appId, version, autoUpdate },
  copyright: `Copyright © ${new Date().getFullYear()} ${pkg.author}`,
  directories: { output: 'dist', buildResources: 'build' },
  files: ['out/**', 'package.json'],
  asar: true,
  // The icon in the notification area (src/main/tray.ts).
  extraResources: [{ from: isRelease ? 'build/icon.ico' : 'build/icon-dev.ico', to: 'tray.ico' }],
  // ClickUp's "open in the desktop app" links (clickup://…) open in this app. The installer
  // registers them for the current Windows user and the uninstaller removes them.
  protocols: [{ name: 'ClickUp link', schemes: ['clickup'] }],

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: isRelease ? 'build/icon.ico' : 'build/icon-dev.ico',
    artifactName: '${name}-${version}-setup.${ext}',
  },
  nsis: {
    // Per-user, one-click install: no administrator rights or UAC prompt, installs into
    // %LOCALAPPDATA%\Programs, updates without asking. Uninstall via Settings > Apps.
    oneClick: true,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    // Keep the user's data when uninstalling, so a reinstall keeps their settings.
    deleteAppDataOnUninstall: false,
  },

  // Electron "fuses" switch off features that only attackers need (Electron security checklist).
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
  },

  // Automatic updates read latest.yml from GitHub Releases (see README, "Automatic updates").
  publish:
    autoUpdate && repository
      ? {
          provider: 'github',
          owner: repository.split('/')[0],
          repo: repository.split('/')[1],
          releaseType: 'release',
        }
      : null,
};

export default config;
