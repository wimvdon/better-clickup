# Windows app template (Electron)

A starting point for Windows desktop apps built with Claude Code and GitHub. Out of the box it
**builds, tests, installs and releases**. The only app content is a placeholder screen with a
click counter.

- Electron + React + TypeScript, with **Fluent UI** so it looks like a Windows 11 app
  (follows light/dark mode). English and Dutch.
- A normal Windows installer: one click, **no administrator rights**, Start menu and desktop
  shortcuts, uninstall from Settings → Apps.
- Locked down following the Electron security checklist.
- CI on every pull request: lint, type checks, unit tests, end-to-end tests of the real app, and
  a test install on Windows, plus an installer you can try on your PC.
- One-click GitHub Releases with automatic version numbers.
- Weekly dependency updates (Dependabot).
- Rules for Claude Code sessions in [`CLAUDE.md`](CLAUDE.md).

> **New app from this template?** Start with [Using this template](#using-this-template).

---

## Installing the app

### From a GitHub Release (the normal way)

1. Open the repository on GitHub → **Releases** → the latest release.
2. Under **Assets**, download `<app>-<version>-setup.exe` and open it.
3. Windows may show **"Windows protected your PC"** (SmartScreen), because the installer isn't
   code-signed (see [Code signing](#code-signing-and-smartscreen)). Click **More info** →
   **Run anyway**.
4. It installs in a few seconds and starts. It's in the Start menu and on the desktop.

**Updating:** download and run the newer installer; your settings are kept. (Or turn on
[automatic updates](#automatic-updates).)
**Uninstalling:** Settings → Apps → Installed apps → the app → Uninstall. Your settings stay in
`%APPDATA%\<App name>`, so a reinstall picks them up again. Delete that folder to remove them.

### Testing a pull request

Every pull request builds a **Dev installer**:

1. Open the pull request → **Checks** → **CI** → scroll down to **Artifacts**.
2. Download `<app>-dev-<version>-setup.exe` and run it (SmartScreen: **More info** → **Run anyway**).

It installs as **"<App> Dev"** with an orange icon, **next to** your real app and with its own
settings, so testing never touches the app you use every day. Each newer Dev installer updates
the Dev app. Uninstall it from Settings → Apps when you're done.

---

## Using this template

Work through this list once for every new app. You can ask Claude Code to do steps 2–4
(for example: _"Rename this app to Plant Diary with ID com.yourname.plantdiary and give it a
green leaf icon"_).

- [ ] **1. Create the repository.** On GitHub, open this template → **Use this template** →
      **Create a new repository**.
- [ ] **2. Rename the app.** All in `package.json`:
  - `name`: short, lowercase, with dashes, e.g. `plant-diary` (used in file names).
  - `productName`: the name people see, e.g. `Plant Diary` (window title, Start menu, Settings → Apps).
  - `appId`: a unique ID you never change after the first release, e.g. `com.yourname.plantdiary`.
  - `description` and `author`.

  Also change `<title>` in `src/renderer/index.html` and the title of this README.

- [ ] **3. Replace the icon.** `build/icon.ico` (the app) and `build/icon-dev.ico` (Dev builds,
      ideally the same icon in another colour). Each `.ico` should contain the sizes 16 to 256
      pixels. Any "PNG to ICO" converter works; start from a 1024 × 1024 PNG.
- [ ] **4. Replace the placeholder screen** with your app (or ask Claude Code to).
- [ ] **5. Apply the GitHub settings.** See [GitHub settings](#github-settings).
- [ ] **6. Make the first release.** See [Making a release](#making-a-release).
- [ ] **7. Update `PRIVACY.md` and `docs/architecture.md`** for your app.

No secrets are needed: the installer is not code-signed by default.

### Making a release

1. Make sure `main` contains what you want to release and CI is green.
2. **Actions → Release → Run workflow**, branch `main`, choose:
   - `patch` (1.2.**3**): fixes, small changes
   - `minor` (1.**3**.0): new features
   - `major` (**2**.0.0): big changes
   - `none`: only build a downloadable Dev installer (no version, no release)
3. After about 10 minutes, the new release with its installer is on the **Releases** page.

The first `patch`/`minor`/`major` release becomes `0.0.1` / `0.1.0` / `1.0.0`. Pushing a tag
(`git tag v1.2.3 && git push origin v1.2.3`) also releases.

The workflow **refuses** to publish when you're not on `main`, when the tag already exists, when
the version would not be higher than the last one, or when nothing changed since the last
release. Before publishing it builds the installer on Windows, installs it, starts the app and
uninstalls it again.

**Version numbers:** releases are `X.Y.Z`. Every other build is named after `git describe`, e.g.
`1.2.0-dev.3+abc1234` (3 commits after 1.2.0), or `0.0.0-dev` without tags, so it never looks
like a release. The version is shown at the bottom of the app's window.

### Automatic updates

Off by default. When on, the installed app checks the latest GitHub Release when it starts and
every 4 hours, downloads a newer version in the background, shows a Windows notification, and
installs the update when you close the app.

**It needs the releases to be publicly downloadable.** The app downloads updates without
logging in to GitHub, and putting a GitHub token inside the app would let anyone who has the app
read (or worse) your repository. So it works only if:

- the repository is **public**, or
- you publish releases to a **separate public repository** (ask Claude Code to set this up).

To turn it on: set `"autoUpdate": true` in `package.json`, update `PRIVACY.md` (the app then
contacts GitHub), and make a release. Updates start working from the release _after_ the first
one that has it turned on.

### Code signing and SmartScreen

Windows warns about installers that aren't signed with a code-signing certificate ("Windows
protected your PC"). For apps you use yourself, clicking **More info → Run anyway** is fine. To
get rid of the warning you'd need, roughly in order of ease:

- **Microsoft Store**: free for individual developers; the Store signs the app and updates it
  automatically, also for private repositories. electron-builder can build the Store package
  (`appx` target).
- **Azure Artifact Signing** (formerly Trusted Signing): a low monthly fee, works with
  electron-builder and GitHub Actions; check whether it's available in your country.
- A classic code-signing certificate from a certificate authority (more expensive; the key must
  live on a hardware token or cloud service).

Even signed, a new app can get warnings until it has built up reputation with Microsoft.

### GitHub settings

Apply these once per repository (**Settings**):

1. **General → Template repository**: tick it, but only for the template itself, not for apps made from it.
2. **General → Pull Requests**: allow **squash merging** and tick **Automatically delete head branches**.
3. **Branches → Add branch ruleset** (or classic _branch protection rule_) for `main`:
   - Require a pull request before merging.
   - Require status checks to pass → add **`Checks`** and **`Windows build`** (they appear in the
     list after CI has run once).
   - Block force pushes.

   ⚠️ Branch protection/rulesets on **private** repositories need **GitHub Pro** (or Team). On a
   free account they work only for **public** repositories. Without it, CI still runs and shows
   ✅/❌ on every pull request, but GitHub won't _stop_ you merging a red one, so only merge when
   both checks are green.

**Actions minutes:** private repositories get a monthly allowance of free GitHub Actions minutes,
and Windows machines use it up faster than Linux ones (see GitHub's billing page). Each CI run uses
about 5 minutes on a Windows machine. Check **Settings → Billing** if you make many changes a day.

The same settings with the [GitHub CLI](https://cli.github.com/) (replace `OWNER/REPO`):

```sh
gh repo edit OWNER/REPO --template            # template repository only
gh repo edit OWNER/REPO --enable-squash-merge --delete-branch-on-merge
gh api -X PUT repos/OWNER/REPO/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["Checks", "Windows build"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

---

## For developers

Requirements: Node.js (version in `.nvmrc`) and Windows 10 or 11 to run the app. Building the
installer needs Windows. Everything else also works on Linux and macOS.

```sh
npm ci                 # install exactly what package-lock.json lists
npm run dev            # start the app with live reload
npm run check          # lint + formatting, type check, unit tests, build (what every change must pass)
npm run test:e2e       # end-to-end tests: starts the real app (Linux: xvfb-run -a npm run test:e2e)
npm run format         # fix formatting
npm run dist           # build the Windows installer into dist/ (a Dev build unless APP_RELEASE_VERSION is set)
```

Docs: [`docs/architecture.md`](docs/architecture.md) · [`docs/testing.md`](docs/testing.md) ·
[`docs/decisions.md`](docs/decisions.md) · [`PRIVACY.md`](PRIVACY.md)
