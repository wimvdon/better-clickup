import { describe, expect, it } from 'vitest';
import {
  DEV_FALLBACK,
  VersionError,
  devVersionFromDescribe,
  isNewer,
  nextVersion,
  parseTag,
  parseVersion,
} from './version.mjs';

describe('parseTag', () => {
  it('accepts vX.Y.Z', () => {
    expect(parseTag('v1.2.3')).toBe('1.2.3');
  });

  it.each(['1.2.3', 'v1.2', 'v1.2.3-beta', 'v01.2.3', 'release', ''])('rejects %j', (tag) => {
    expect(() => parseTag(tag)).toThrow(VersionError);
  });
});

describe('parseVersion', () => {
  it('rejects numbers Windows cannot store', () => {
    expect(() => parseVersion('1.65536.0')).toThrow(VersionError);
    expect(parseVersion('1.65535.0')).toEqual([1, 65535, 0]);
  });
});

describe('nextVersion', () => {
  it('starts from 0.0.0 before the first release', () => {
    expect(nextVersion('', 'patch')).toBe('0.0.1');
    expect(nextVersion('', 'minor')).toBe('0.1.0');
    expect(nextVersion('', 'major')).toBe('1.0.0');
  });

  it('bumps the right part', () => {
    expect(nextVersion('v1.2.3', 'patch')).toBe('1.2.4');
    expect(nextVersion('v1.2.3', 'minor')).toBe('1.3.0');
    expect(nextVersion('v1.2.3', 'major')).toBe('2.0.0');
  });

  it('rejects an unknown bump', () => {
    expect(() => nextVersion('v1.0.0', 'none')).toThrow(VersionError);
  });
});

describe('isNewer', () => {
  it('compares numerically, not as text', () => {
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('1.2.3', '1.2.3')).toBe(false);
    expect(isNewer('1.2.3', '1.3.0')).toBe(false);
  });
});

describe('devVersionFromDescribe', () => {
  it('marks builds after a release as dev builds', () => {
    expect(devVersionFromDescribe('v1.2.0-3-gabc1234\n')).toBe('1.2.0-dev.3+abc1234');
  });

  it('never looks like a release, even exactly on a release tag', () => {
    expect(devVersionFromDescribe('v1.2.0-0-gabc1234')).toBe('1.2.0-dev.0+abc1234');
  });

  it('marks uncommitted changes', () => {
    expect(devVersionFromDescribe('v1.2.0-3-gabc1234-dirty')).toBe('1.2.0-dev.3+abc1234.dirty');
  });

  it('falls back without git or tags', () => {
    expect(devVersionFromDescribe(null)).toBe(DEV_FALLBACK);
    expect(devVersionFromDescribe('abc1234')).toBe(DEV_FALLBACK);
  });
});
