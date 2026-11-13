import { describe, expect, it } from 'vitest';
import { supportsMica } from './windows-version';

describe('supportsMica', () => {
  it('is on for Windows 11 22H2 and later', () => {
    expect(supportsMica('win32', '10.0.22621')).toBe(true);
    expect(supportsMica('win32', '10.0.26100')).toBe(true);
  });

  it('is off for Windows 10, the first Windows 11 and other systems', () => {
    expect(supportsMica('win32', '10.0.19045')).toBe(false);
    expect(supportsMica('win32', '10.0.22000')).toBe(false);
    expect(supportsMica('linux', '10.0.22621')).toBe(false);
    expect(supportsMica('win32', 'unknown')).toBe(false);
  });
});
