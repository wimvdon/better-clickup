# Testing

## Automatic (CI, on every pull request and push to `main`)

| Check                | Command                            | Where   | Catches                                                                                                                                                |
| -------------------- | ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lint + formatting    | `npm run lint`                     | Linux   | Common bugs, React hook mistakes, the UI importing Node.js/Electron, inconsistent formatting                                                           |
| Type check           | `npm run typecheck`                | Linux   | Type errors, **missing translations**, wrong IPC types                                                                                                 |
| Unit tests           | `npm test` (Vitest)                | Linux   | Logic bugs in `src/shared/`, the `app://` path checks, version rules                                                                                   |
| Dependency audit     | `npm audit --omit=dev`             | Linux   | Known vulnerabilities in what ships inside the app                                                                                                     |
| End-to-end tests     | `npm run test:e2e` (Playwright)    | Windows | The real app: it starts, shows the screen, buttons work, no errors in the page, the page stays locked down                                             |
| Installer smoke test | `scripts/smoke-test-installer.ps1` | Windows | The installer works, the Start menu shortcut exists, the **installed** app (with all security switches on) opens and doesn't crash, uninstalling works |

Reports (Playwright HTML report, screenshots and traces of failures) are attached to every CI
run as the `test-reports` artifact.

Run the same locally before pushing:

```sh
npm run check
npm run test:e2e          # Linux without a screen: xvfb-run -a npm run test:e2e
```

### Writing tests

- **Unit tests** (`*.test.ts` next to the code): every logic change. Keep the logic in plain
  TypeScript so it needs no Electron. See `src/shared/counter.test.ts`.
- **End-to-end tests** (`e2e/*.spec.ts`): one per important user flow. Find elements the way a
  user would (`getByRole('button', { name: 'Click me' })`), not by CSS classes. Test in English
  (`--lang=en-US` is passed).
- Test names describe behaviour: `it('stops at the maximum')`.

## Manual (on your PC)

What automation can't judge: how it looks and feels. For each pull request, install the Dev
installer (see README, "Testing a pull request") and follow the steps in the pull request
description. In addition, check every now and then (always before a release):

- [ ] The app starts from the Start menu, and the changed screen looks right.
- [ ] **Dark mode**: Settings → Personalization → Colors → Choose your mode. The app follows it
      straight away.
- [ ] **Window size**: make the window small and large, and maximise it. Nothing is cut off.
- [ ] **Display scaling**: Settings → System → Display → Scale at 150 % or more. Text is sharp, nothing overlaps.
- [ ] **Keyboard only**: Tab through everything, Enter/Space activates buttons, focus is visible.
- [ ] **Language**: Settings → Time & language → Language & region → put Nederlands first (sign
      out and in). The app is in Dutch.
- [ ] **Second start**: start the app again while it's open; the open window comes to the front.
- [ ] After a release: install it over the previous release. It updates and keeps your settings.
