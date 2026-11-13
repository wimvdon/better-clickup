# Architecture

## This app

**Better ClickUp** is a lighter desktop app for ClickUp's web app (`app.clickup.com`), with tabs.

- **One window, with tabs.** The window's own UI is only the tab bar (React, `src/renderer/`),
  which sits in the title bar like in Edge. Each loaded tab is a separate ClickUp page (an
  Electron `WebContentsView`) that the main process draws below the bar (`src/main/tabs.ts`).
  The tab logic itself (open, close, reopen, move, which tabs sleep) is plain TypeScript in
  `src/shared/tabs.ts`.
- **Saving memory.** Only the shown tab is visible; Chromium slows down hidden ones. A tab not
  shown for 10 minutes is unloaded ("asleep", moon icon), and at most 4 tabs stay loaded. A
  sleeping tab loads again, with fresh data, when you open it. After a restart only the shown
  tab loads. All tabs share one login and one disk cache (`persist:clickup` partition).
- **Notifications.** ClickUp's pages use the browser's `Notification` API. The ClickUp preload
  script (`src/preload/clickup.ts`) replaces it with one that sends each notification to the
  main process, which drops duplicates from other tabs (`src/shared/notifications.ts`) and shows
  a Windows notification. Clicking it brings the window and the right tab to the front, and
  passes the click on to the page (ClickUp then opens the task). The taskbar button flashes.
- **Tray.** Closing the window keeps the app running in the notification area, so notifications
  keep coming. The tray menu has "Start with Windows" (starts hidden, `--hidden`) and Quit.
- **Links.** ClickUp links inside ClickUp open as tabs (Ctrl+click: in the background). Sign-in
  pages (Google, Microsoft, Apple, common SSO providers) may load inside the app while logging
  in. Every other link opens in the default browser; other kinds of links are blocked
  (`src/shared/clickup-urls.ts`). `clickup://` links, and ClickUp links passed on the command
  line, open as a new tab (the installer registers `clickup://`).
- **Window.** Windows 11 22H2+ gets the Mica material behind the tab bar; older versions a
  solid colour. Size, position and zoom are remembered.
- **Shortcuts** (`src/shared/shortcuts.ts`): Ctrl+T, Ctrl+W, Ctrl+Shift+T, Ctrl+Tab,
  Ctrl+Shift+Tab, Ctrl+1…9, F5/Ctrl+R, Ctrl+F5, Alt+Left/Right (and the mouse's side
  buttons), Ctrl+= / Ctrl+- / Ctrl+0. Right-clicking a tab or inside a page opens a menu
  (spelling suggestions, cut/copy/paste, links).

**Stored data** (in `%APPDATA%\Better ClickUp`):

- `session.json`: the open tabs (address and title), the shown tab, window size and position,
  zoom, and whether the tray hint was shown. Read through `parseSession`, which drops anything
  unexpected.
- `Partitions\clickup\`: ClickUp's login cookies (encrypted by the cookie-encryption fuse),
  cache and local storage, the same things a browser keeps for ClickUp.

## How an Electron app is put together

An Electron app is two kinds of program working together:

| Part                  | Runs as                                | Can do                                              | Folder          |
| --------------------- | -------------------------------------- | --------------------------------------------------- | --------------- |
| **Main process**      | Node.js, one per app                   | Everything: windows, files, the system, the network | `src/main/`     |
| **Renderer** (the UI) | A locked-down web page, one per window | Only show things and call `window.api`              | `src/renderer/` |
| **Preload**           | A tiny script between the two          | Defines exactly what `window.api` offers            | `src/preload/`  |

The UI is treated like an untrusted web page: if it were ever tricked into running bad code, that
code could not reach the PC. That's why every system feature goes through a named, checked channel.

## Structure

```
src/
  main/                 Main process
    index.ts              Start-up: single instance, window, tray, links, App User Model ID, updates
    tabs.ts               The ClickUp tabs: pages, sleeping, links, shortcuts, right-click menus
    clickup-session.ts    The shared ClickUp profile: user agent, allowed permissions
    notifications.ts      Shows ClickUp notifications as Windows notifications
    session-store.ts      Saves session.json
    tray.ts               The icon in the notification area
    i18n.ts               Text for menus and the tray
    security.ts           Blocks navigation, new windows, permission prompts; trusted-sender check
    protocol.ts           Serves the UI from app://bundle/ (instead of file://)
    bundle-path.ts        Safe URL → file mapping for that protocol (unit tested)
    ipc.ts                Handlers for every channel in shared/ipc.ts
    app-config.ts         Reads appId/autoUpdate from the packaged package.json
    updater.ts            Optional automatic updates (off by default)
  preload/index.ts      Exposes window.api to the UI (nothing else)
  preload/clickup.ts    ClickUp pages: replaces their Notification API (nothing else)
  renderer/             UI: React + Fluent UI
    index.html
    src/App.tsx           The window's UI: the tab bar
    src/components/       TabBar
    src/hooks/            Small React hooks (dark mode, app info, tabs)
  shared/               Plain TypeScript used by both sides, unit tested
    tabs.ts               Tab state: open, close, reopen, move, which tabs sleep
    clickup-urls.ts       Which links stay in the app, open in the browser or are blocked
    notifications.ts      Checks notifications, drops duplicates
    session-file.ts       Reads and writes session.json safely
    shortcuts.ts          Keyboard shortcuts
    windows-version.ts    Whether Windows supports Mica
    ipc.ts                The list of channels and their types (tab bar)
    clickup-ipc.ts        The channels of the ClickUp pages (kept apart: see the file)
    i18n/                 All user-visible text: en.ts (default), nl.ts, …
e2e/                    End-to-end tests: start the real app and click through it
scripts/                Version helpers, installer smoke test, icon generator
build/                  Installer resources: icon.ico, icon-dev.ico
electron.vite.config.ts      How main, preload and UI are built
electron-builder.config.mjs  How the Windows installer is built (release vs Dev, fuses)
```

## Conventions

- **Logic in `src/shared/`** (or another plain-TypeScript folder), with no Electron, DOM or React
  types, so it is unit tested quickly. Components only display state and forward clicks.
- **Adding a system feature** (files, notifications, the clipboard, …):
  1. add the channel and its types to `src/shared/ipc.ts`;
  2. add the function to `src/preload/index.ts`;
  3. handle it in `src/main/ipc.ts`: check `isTrustedSender(event.senderFrame)` and validate
     every argument (type, length, allowed values) before using it;
  4. add a test (unit test for the logic, end-to-end test for the feature).
- **UI**: Fluent UI v9 components and `tokens` for colours and spacing, so light/dark mode, high
  contrast and keyboard navigation work automatically. No hard-coded colours.
- **Text**: only via `t('key')`, with every key in every file in `src/shared/i18n/`.
- **State**: React state for a screen. If several screens share state, add a small store and
  record the choice in `decisions.md`.
- **Storing data**: JSON files in `app.getPath('userData')` (`%APPDATA%\<App>`), written by the
  main process. Record the format in this file and in `PRIVACY.md`.
- **Secrets the user enters** (API keys, tokens): encrypt with Electron's `safeStorage` (uses
  Windows' DPAPI, tied to the Windows user) before writing them to disk, and keep them in the main process.
- **No network** unless the owner agreed (see `CLAUDE.md`). If the app calls a web service, do it
  from the main process, and add the host to the Content Security Policy only if the UI itself
  must load something from it. Exception by design: the tabs show ClickUp's website. They run in
  their own locked-down profile, separate from the app's UI, whose CSP stays strict.
- **App identity** (`name`, `productName`, `appId`) only in `package.json`.
