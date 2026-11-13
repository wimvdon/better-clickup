## What changed

<!-- Plain language, for someone who doesn't read code. What does the app do differently now, and why? -->

## How to test on the PC

<!-- Install the Dev installer: Checks → CI → Artifacts → <app>-dev-<version>-setup.exe
     (SmartScreen: More info → Run anyway). It installs as "<App> Dev" next to the real app.
     Then give exact steps: what to click, and what you should see. -->

1. Open **<App> Dev** from the Start menu.
2. …
3. You should see …

## Risks

<!-- What could go wrong or behave differently? Anything not covered by automatic tests? "None" is fine if true. -->

## Checklist

- [ ] `npm run check` and `npm run test:e2e` pass locally, and both CI jobs are green
- [ ] Unit tests added or updated for every logic change
- [ ] No tests, lint rules, type checks, CI steps or workflows removed or weakened
- [ ] Security setup unchanged (sandbox, context isolation, CSP, fuses, IPC sender checks)
- [ ] All new text is in `src/shared/i18n/`, with translations for every language
- [ ] `docs/`, `PRIVACY.md` and `docs/decisions.md` updated where needed
- [ ] No new network access, telemetry or dependencies (or: asked first, explained below)
- [ ] No secrets, certificates or `.env` files committed
