# Architecture

> Template skeleton. Fill in the "This app" section for each app and keep it up to date.

## This app

_What the app does, its screens, and where its data lives. (Placeholder: one screen with a click counter. No stored data.)_

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
    index.ts              Start-up: single instance, window, App User Model ID, updates
    security.ts           Blocks navigation, new windows, permission prompts; trusted-sender check
    protocol.ts           Serves the UI from app://bundle/ (instead of file://)
    bundle-path.ts        Safe URL → file mapping for that protocol (unit tested)
    ipc.ts                Handlers for every channel in shared/ipc.ts
    app-config.ts         Reads appId/autoUpdate from the packaged package.json
    updater.ts            Optional automatic updates (off by default)
  preload/index.ts      Exposes window.api to the UI (nothing else)
  renderer/             UI: React + Fluent UI
    index.html
    src/App.tsx           The (placeholder) screen
    src/hooks/            Small React hooks (dark mode, app info)
  shared/               Plain TypeScript used by both sides, unit tested
    counter.ts            Placeholder logic
    ipc.ts                The list of channels and their types
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
  must load something from it.
- **App identity** (`name`, `productName`, `appId`) only in `package.json`.
