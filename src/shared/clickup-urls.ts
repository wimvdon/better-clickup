/**
 * Which web addresses belong to ClickUp, and what the app does with every other address.
 * Plain TypeScript (no Electron), unit tested in clickup-urls.test.ts.
 */

/** Where a new tab starts. ClickUp forwards it to the last workspace you used. */
export const CLICKUP_HOME = 'https://app.clickup.com/';

/** The custom link type ClickUp uses for "open in the desktop app" (clickup://t/abc123). */
export const CLICKUP_PROTOCOL = 'clickup';

/** Hosts of sign-in pages that ClickUp's "Continue with Google/Microsoft/Apple/SSO" uses. */
const AUTH_HOSTS = new Set([
  'accounts.google.com',
  'accounts.youtube.com',
  'login.microsoftonline.com',
  'login.microsoft.com',
  'login.live.com',
  'account.live.com',
  'appleid.apple.com',
  'idmsa.apple.com',
]);
/** Common single sign-on providers used by companies (any subdomain). */
const AUTH_DOMAINS = [
  'okta.com',
  'oktapreview.com',
  'onelogin.com',
  'auth0.com',
  'duosecurity.com',
];

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

const hasDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** True for https pages on clickup.com and its subdomains (app., doc., sharing., forms. …). */
export function isClickUpUrl(url: string): boolean {
  const parsed = parse(url);
  return (
    parsed !== null &&
    parsed.protocol === 'https:' &&
    parsed.username === '' &&
    parsed.password === '' &&
    hasDomain(parsed.hostname, 'clickup.com')
  );
}

function isAuthUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    (AUTH_HOSTS.has(url.hostname) || AUTH_DOMAINS.some((d) => hasDomain(url.hostname, d)))
  );
}

/**
 * - `clickup`: stays inside the app (as a tab).
 * - `auth`: a sign-in page; may be shown inside the app while logging in.
 * - `external`: opens in the default browser or mail app.
 * - `blocked`: anything else (file:, javascript:, …) is never opened.
 */
export type LinkKind = 'clickup' | 'auth' | 'external' | 'blocked';

export function classifyUrl(url: string): LinkKind {
  if (isClickUpUrl(url)) return 'clickup';
  const parsed = parse(url);
  if (!parsed) return 'blocked';
  if (isAuthUrl(parsed)) return 'auth';
  if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:')
    return 'external';
  return 'blocked';
}

/**
 * Turns a link the app was started with (from Windows, another app or a second start) into a
 * ClickUp page address, or null. Accepts https ClickUp links and clickup:// links, which map
 * onto app.clickup.com the same way the official app does (clickup://t/abc → /t/abc).
 */
export function clickUpLinkFrom(arg: string): string | null {
  if (arg.length > 2048) return null;
  if (isClickUpUrl(arg)) return arg;
  const match = /^clickup:(?:\/\/)?(.*)$/i.exec(arg);
  if (!match) return null;
  const url = `${CLICKUP_HOME}${(match[1] ?? '').replace(/^\/+/, '')}`;
  return isClickUpUrl(url) && new URL(url).hostname === 'app.clickup.com' ? url : null;
}

/** The first ClickUp link in a list of command-line arguments, or null. */
export function clickUpLinkFromArgs(args: readonly string[]): string | null {
  for (const arg of args) {
    const link = clickUpLinkFrom(arg);
    if (link) return link;
  }
  return null;
}

/** "Sprint 12 | ClickUp" → "Sprint 12". Page titles without a name become "". */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[|\-–—]\s*ClickUp\s*$/i, '')
    .trim()
    .slice(0, 200);
}

/**
 * Electron's default user agent names Electron and this app ("Better ClickUp/1.2.3"), which
 * makes some sites treat it as an unknown browser. Removing both leaves the Chrome user agent.
 * `appToken` is "<app name>/<version>", as Electron adds it.
 */
export function chromeUserAgent(userAgent: string, appToken: string): string {
  return userAgent
    .split(` ${appToken}`)
    .join('')
    .replace(/\s+Electron\/\S+/g, '');
}
