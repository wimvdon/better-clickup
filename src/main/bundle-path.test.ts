import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveBundlePath } from './bundle-path';

const root = join('/', 'app', 'renderer');

describe('resolveBundlePath', () => {
  it('maps app://bundle/ URLs to files in the UI folder', () => {
    expect(resolveBundlePath(root, 'app://bundle/index.html')).toBe(join(root, 'index.html'));
    expect(resolveBundlePath(root, 'app://bundle/assets/a.js')).toBe(join(root, 'assets', 'a.js'));
    expect(resolveBundlePath(root, 'app://bundle/')).toBe(join(root, 'index.html'));
  });

  it('ignores query strings', () => {
    expect(resolveBundlePath(root, 'app://bundle/index.html?x=1')).toBe(join(root, 'index.html'));
  });

  it.each([
    'app://bundle/../secret.txt',
    'app://bundle/%2e%2e/secret.txt',
    'app://bundle/assets/%2e%2e%2f%2e%2e%2fsecret.txt',
    'app://bundle/..%5csecret.txt',
    'app://bundle/a%00.js',
    'app://bundle/%E0%A4%A',
  ])('refuses %s', (url) => {
    const file = resolveBundlePath(root, url);
    if (file !== null) expect(file.startsWith(root)).toBe(true);
  });

  it('refuses other schemes and hosts', () => {
    expect(resolveBundlePath(root, 'file:///etc/passwd')).toBeNull();
    expect(resolveBundlePath(root, 'app://other/index.html')).toBeNull();
    expect(resolveBundlePath(root, 'not a url')).toBeNull();
  });
});
