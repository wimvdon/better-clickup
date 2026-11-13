# Rules for Claude Code sessions in this repository

A Windows desktop app built with Electron. The owner is **not a developer and does not review
code**. CI, tests, lint and these rules are the safety net. Follow them every time.

## Workflow

1. **One focused change per branch and pull request.** Start a new branch from an up-to-date
   `main` (`git fetch origin main && git checkout -b <branch> origin/main`). Never reuse an old
   or merged branch for a new change.
2. **Set up:** `npm ci` (Node.js version in `.nvmrc`).
3. **Before finishing, run and fix everything:**
   ```
   npm run check        # lint + formatting, type check, unit tests, build
   npm run test:e2e     # starts the real app; on Linux run it as: xvfb-run -a npm run test:e2e
   ```
   `npm run format` fixes formatting. Then push and make sure **both** CI jobs on the pull
   request are green ("Checks" and "Windows build"). Only CI can build and install the Windows
   installer; a Linux session cannot.
4. **Write the pull request description in plain language** (fill in
   `.github/pull_request_template.md`): what changed and why, in words a non-developer
   understands, and **exactly what to click on the PC to test it**, step by step, with what they
   should see. The owner tests by installing the Dev installer from the pull request's CI run
   (Checks → CI → Artifacts). It installs as "<App> Dev" next to the real app.

## Never do these without asking first (and saying why)

- Delete, skip (`.skip`, `.only`), or weaken tests, lint rules, type checks, CI steps or
  workflows to make something pass. No `// eslint-disable`, `@ts-ignore` or `any` to silence an
  error: fix the cause. **Never remove the release workflow or the installer smoke test.**
- Weaken the security setup: `contextIsolation`, `sandbox`, `nodeIntegration: false`, the
  Content Security Policy, the `app://` protocol, navigation/permission blocking in
  `src/main/security.ts`, or the Electron fuses in `electron-builder.config.mjs`.
- Add network access (any `fetch`/HTTP to the internet), telemetry, analytics, crash reporting
  or ads, or turn on `"autoUpdate"`.
- Add dependencies. Prefer what is already in `package.json`. If one is needed, say why and
  check it is widely used and maintained.
- Change `appId` or `name` in `package.json` of an app that has already been released
  (Windows would treat it as a different app: a second install, settings left behind).
- Run anything with administrator rights, or make the installer per-machine.

## Never commit

Secrets, certificates (`*.pfx`), passwords, API keys or `.env` files.

## Code rules

- TypeScript (strict), React and **Fluent UI** (`@fluentui/react-components`) for the UI, so it
  looks and behaves like Windows 11 (light/dark, keyboard, screen readers). Mainstream libraries only.
- **Where code goes** (see `docs/architecture.md`):
  - `src/shared/`: plain logic, no Electron/DOM/React. **Every logic change gets unit tests**
    (`*.test.ts` next to the code).
  - `src/main/`: the main process (windows, files, system). Only here may code touch the system.
  - `src/preload/`: the only bridge. A new main-process feature = a channel in `src/shared/ipc.ts`
    - a function in the preload + a handler in `src/main/ipc.ts` that checks `isTrustedSender`
      and validates its input. Never expose `ipcRenderer` or Node.js to the UI.
  - `src/renderer/`: the UI. It may only call `window.api`.
- **All user-visible text goes in `src/shared/i18n/en.ts`** with a translation in **every**
  language file (currently `nl.ts`). Never hard-code text in components. The type check fails
  when a translation is missing.
- Store user data in `app.getPath('userData')` (`%APPDATA%\<App>`), never next to the app or in
  the install folder.
- Versions are automatic (git tags / release workflow). Don't edit `version` in `package.json`.

## Keep docs in sync

- Behaviour change → update `docs/` and, if it touches data, files or the network, `PRIVACY.md`.
- Notable decision (new dependency, architecture choice, Windows version support, …) → add a
  dated entry to `docs/decisions.md`.
- Structure and conventions: `docs/architecture.md`. What is tested and how: `docs/testing.md`.

## Releasing (only when the owner asks)

Actions → Release → Run workflow on `main` → choose `patch`, `minor` or `major`.
See README, "Making a release".
