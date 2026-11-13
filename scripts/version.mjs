// @ts-check
/**
 * Version helpers for builds and the release workflow. Plain functions, unit tested in
 * version.test.ts. Command line (prints one line, or an error with exit code 1):
 *
 *   node scripts/version.mjs dev                   version for a non-release build, from git
 *   node scripts/version.mjs parse-tag vX.Y.Z      X.Y.Z (fails unless the tag is exactly vX.Y.Z)
 *   node scripts/version.mjs next <tag|""> BUMP    next X.Y.Z for BUMP = patch | minor | major
 *   node scripts/version.mjs is-newer X.Y.Z A.B.C  exit code 0 if X.Y.Z is higher than A.B.C
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const DEV_FALLBACK = '0.0.0-dev';
// Windows stores file and product versions as 16-bit numbers.
export const MAX_PART = 65535;

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export class VersionError extends Error {}

/**
 * @param {string} text
 * @returns {[number, number, number]}
 */
export function parseVersion(text) {
  const match = VERSION.exec(text.trim());
  if (!match) throw new VersionError(`'${text}' is not a version like 1.2.3`);
  const parts = /** @type {[number, number, number]} */ (match.slice(1).map(Number));
  if (parts.some((part) => part > MAX_PART)) {
    throw new VersionError(`'${text}': each number must be at most ${MAX_PART} (a Windows limit)`);
  }
  return parts;
}

/** @param {string} tag */
export function parseTag(tag) {
  const trimmed = tag.trim();
  if (!trimmed.startsWith('v')) throw new VersionError(`tag '${tag}' must look like v1.2.3`);
  parseVersion(trimmed.slice(1));
  return trimmed.slice(1);
}

/**
 * @param {string} latestTag  the latest vX.Y.Z tag, or "" before the first release
 * @param {string} bump       patch | minor | major
 */
export function nextVersion(latestTag, bump) {
  let [major, minor, patch] = latestTag.trim() ? parseVersion(parseTag(latestTag)) : [0, 0, 0];
  if (bump === 'patch') patch += 1;
  else if (bump === 'minor') [minor, patch] = [minor + 1, 0];
  else if (bump === 'major') [major, minor, patch] = [major + 1, 0, 0];
  else throw new VersionError(`bump must be patch, minor or major, got '${bump}'`);
  const version = `${major}.${minor}.${patch}`;
  parseVersion(version);
  return version;
}

/**
 * @param {string} version
 * @param {string} than
 */
export function isNewer(version, than) {
  const a = parseVersion(version);
  const b = parseVersion(than);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return /** @type {number} */ (a[i]) > /** @type {number} */ (b[i]);
  }
  return false;
}

/**
 * Turns `git describe --tags --long --dirty` output (v1.2.0-3-gabc1234[-dirty]) into a
 * version that can never be mistaken for a release: 1.2.0-dev.3+abc1234 (3 commits after 1.2.0).
 * @param {string | null} describe  null when git or tags are unavailable
 */
export function devVersionFromDescribe(describe) {
  const match = /^v(\d+\.\d+\.\d+)-(\d+)-g([0-9a-f]+)(-dirty)?$/.exec(describe?.trim() ?? '');
  if (!match) return DEV_FALLBACK;
  const [, base, commits, hash, dirty] = match;
  return `${base}-dev.${commits}+${hash}${dirty ? '.dirty' : ''}`;
}

/** Version for every build that is not a release, from the git history. */
export function devVersion() {
  try {
    const describe = execFileSync(
      'git',
      ['describe', '--tags', '--long', '--dirty', '--match', 'v[0-9]*'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return devVersionFromDescribe(describe);
  } catch {
    // No git, not a git checkout, or no tags yet.
    return DEV_FALLBACK;
  }
}

/** @param {string[]} argv */
export function main(argv) {
  const [command, ...args] = argv;
  try {
    if (command === 'dev' && args.length === 0) console.log(devVersion());
    else if (command === 'parse-tag' && args.length === 1) console.log(parseTag(String(args[0])));
    else if (command === 'next' && args.length === 2)
      console.log(nextVersion(String(args[0]), String(args[1])));
    else if (command === 'is-newer' && args.length === 2)
      return isNewer(String(args[0]), String(args[1])) ? 0 : 1;
    else {
      console.error('usage: version.mjs dev | parse-tag TAG | next TAG BUMP | is-newer A B');
      return 2;
    }
  } catch (error) {
    if (!(error instanceof VersionError)) throw error;
    console.error(`error: ${error.message}`);
    return 1;
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.argv.slice(2));
}
