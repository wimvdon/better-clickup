# Decision log

Newest first. Add an entry for every notable choice: what was decided, why, and what was rejected.

## 2026-11-13: Better ClickUp

### What it is

- **A tabbed desktop wrapper around ClickUp's web app**, not a new ClickUp client. ClickUp's
  public API covers only part of the product, so rebuilding it would be huge and always behind.
  The official desktop app is the same web app in one Electron window.
- **Rejected alternatives** (discussed with the owner):
  - _ClickUp as an Edge/Chrome app (PWA)_: has notifications, and Edge can open ClickUp links in
    it, but no tabs in one window and no unloading of idle ClickUp pages.
  - _A browser extension_: cannot make ClickUp itself lighter; browsers already put idle tabs to
    sleep.
  - _Tauri (WebView2)_: smaller installer and shell, but the ClickUp page dominates memory either
    way; multiple web views per window are still experimental there, it needs Rust, and this
    repository's tooling, tests and security setup are Electron.
- **Where the saving comes from:** each loaded ClickUp page costs a few hundred MB. Tabs sleep
  after 10 minutes unused, at most 4 stay loaded, hidden tabs are throttled, and only the shown
  tab loads at start-up. The app shell itself costs roughly 100 MB more than an Edge PWA.

### Choices

- **Network access to ClickUp** (asked for by the owner: it is the app's purpose). Pages run in
  a separate persistent profile (`persist:clickup`) with sandbox and context isolation; only
  `notifications`, `clipboard-sanitized-write` and `fullscreen` are allowed, and only for
  `*.clickup.com`. The app's own UI keeps its strict CSP and default lock-down.
- **Navigation inside a tab** is limited to ClickUp and known sign-in providers (Google,
  Microsoft, Apple, Okta, OneLogin, Auth0, Duo). Anything else opens in the default browser.
  Companies using another single sign-on provider may need its host added
  (`src/shared/clickup-urls.ts`).
- **Notifications** are taken over in the page (preload, `contextBridge.executeInMainWorld`)
  rather than letting Chromium show them: so duplicates from several tabs can be dropped and a
  click can open the right tab. Web push through a service worker is not supported by Electron;
  ClickUp's live connection in an open tab delivers them.
- **User agent:** Electron's default names Electron and the app; it is reduced to the plain
  Chrome user agent so ClickUp treats the app as Chrome.
- **Close to tray** instead of quitting, like the official app, so notifications keep coming.
  If Windows has no notification area, closing quits.
- **`clickup://` links** are registered by the installer (per user, removed on uninstall), as
  the official app does. If both apps are installed, the one installed last handles them.
- **Mica** (Windows 11 22H2+) behind the tab bar; earlier versions get a solid colour.
- **New dev dependency: `@fluentui/react-icons`** (Microsoft's official Fluent icons; it was
  already installed as part of `@fluentui/react-components`, now listed because the UI imports it).
- **End-to-end tests use a fake ClickUp** (`e2e/fake-clickup.mjs`, loaded with `electron -r`),
  so CI never needs the internet or a ClickUp account. `APP_USER_DATA_DIR` gives each test run
  its own data folder; it is ignored by the installed app.

## 2026-10-14: Template baseline

### Stack

- **Electron + React + TypeScript**, the mainstream way to build a desktop app with web
  technology. TypeScript (strict) because types catch mistakes that nobody reviews by hand.
- **Fluent UI React v9** (Microsoft's design system, used in Windows 11 and Office) instead of a
  generic CSS framework: Windows look, light/dark/high-contrast themes and accessibility built in.
- **electron-vite** builds the three parts (main, preload, UI) with one config and live reload.
  It replaces the hand-made "vite + concurrently + wait-on" scripts many projects use.
- **electron-builder** for the installer: the most widely used Electron packager with a proper
  Windows (NSIS) installer and a matching auto-updater. Electron Forge, the official
  alternative, makes Squirrel.Windows installers by default, which are less flexible (no
  install-location control, older update mechanism).
- **Node.js 24** (current LTS) for tooling; `.nvmrc` is the single place for the version.
- **Versions (latest that work together, 2026-10-14):** Electron 44, electron-builder 26,
  React 19, Fluent UI 9, ESLint 10, Vitest 5, Playwright 1.64.
  - **Vite 7, not 8:** electron-vite 5 supports Vite up to 7. Dependabot ignores Vite major updates
    until it does.
  - **TypeScript 6.0, not 7:** typescript-eslint supports TypeScript up to 6.0. TypeScript 7 is the
    new native compiler; Dependabot ignores major updates until typescript-eslint supports it.
- **UI libraries are dev dependencies.** Vite bundles React and Fluent UI into the UI files, so
  they don't need to ship as separate packages. Only main-process packages (electron-updater)
  are runtime dependencies. This cut the packaged app code from ~200 MB to ~3 MB.
- **npm 11's install-script allowlist** (`allowScripts` in `package.json`): only esbuild may run
  its install script; electron-winstaller (Squirrel, unused) may not.

### Windows behaviour

- **Per-user, one-click NSIS installer** (`%LOCALAPPDATA%\Programs`): no administrator rights or
  UAC prompt, which is Microsoft's recommendation for apps that don't need system-wide access.
  The user's data (`%APPDATA%\<App>`) is kept on uninstall so a reinstall keeps settings.
- **x64 only.** Windows on ARM PCs run x64 apps through emulation. Add `arm64` to the `nsis`
  target when ARM users need native speed (the installer roughly doubles in size).
- **App User Model ID = `appId`**, set at start-up, so taskbar pinning and notifications are
  grouped under the right app.
- **Single instance**: starting the app again focuses the open window.
- **No application menu** (File/Edit/View): it would be English-only and offers developer reloads.
- **Dev builds are a separate app** ("<App> Dev", appId `<appId>.dev`, orange icon, own data
  folder), so testing a pull request never overwrites the real app or its settings.
- **Not code-signed.** Signing needs a paid certificate or Azure Artifact Signing. For personal
  apps, SmartScreen's "Run anyway" is acceptable. Options are listed in the README.
- **Automatic updates are built in but off** (`"autoUpdate": false`). electron-updater needs
  publicly downloadable releases, and all the owner's repositories are private. A GitHub token
  inside the app would leak repository access to anyone with the app, so that was rejected.

### Security (Electron security checklist)

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; the UI only gets the
  typed `window.api` from the preload script. Every IPC handler checks the sender.
- Strict Content Security Policy in production builds (no remote scripts or connections).
- The UI is served from a custom `app://bundle/` protocol instead of `file://`, so the page cannot
  read other local files. The path mapping is unit tested against `../` tricks.
- Navigation, new windows, `<webview>` and permission requests (camera, location, …) are blocked;
  `https` links open in the default browser.
- **Electron fuses** turn off `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect`, enable
  cookie encryption, only load the app from its (integrity-checked) `app.asar` archive, and remove
  `file://`'s extra privileges.
- ESLint forbids importing `electron` or `node:*` in the UI.

### Testing and CI

- **Unit tests with Vitest** (shares the Vite setup), **end-to-end tests with Playwright**, which
  can start and drive an Electron app, and a **PowerShell installer smoke test**. The last one is
  the only way to test the packaged app: the fuses (correctly) block the debugging hooks Playwright
  uses.
- **Two CI jobs**: fast checks on Linux, everything Windows-specific on a Windows machine.
  Windows machines are slower and, for private repositories, use the free Actions minutes faster,
  so only what needs Windows runs there.
- **Release from CI only**, in three jobs: decide the version (with the refusal rules), build and
  test on Windows, publish. Only the publish job may write to the repository. Version helpers are
  JavaScript (`scripts/version.mjs`, unit tested), the project's own language.
- **Version numbers:** releases `X.Y.Z` (each number ≤ 65535, a Windows limit); other builds
  `X.Y.Z-dev.N+hash` from `git describe`, or `0.0.0-dev`.

### Data

- **Persistence**: JSON files in `userData` from the main process; secrets via `safeStorage`
  (Windows DPAPI). No store library is added until an app needs one.
- **No network, analytics or crash reporting** by default.
