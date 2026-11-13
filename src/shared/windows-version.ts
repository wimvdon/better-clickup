/**
 * Windows version checks. Plain logic on os.release() ("10.0.22631"), unit tested.
 */

/** Mica, the Windows 11 window material, needs Windows 11 22H2 (build 22621) or later. */
const MICA_BUILD = 22621;

export function supportsMica(platform: string, release: string): boolean {
  if (platform !== 'win32') return false;
  const [major, minor, build] = release.split('.').map(Number);
  return major === 10 && minor === 0 && Number.isInteger(build) && (build as number) >= MICA_BUILD;
}
