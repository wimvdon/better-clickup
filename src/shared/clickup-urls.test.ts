import { describe, expect, it } from 'vitest';
import {
  chromeUserAgent,
  classifyUrl,
  cleanTitle,
  clickUpLinkFrom,
  clickUpLinkFromArgs,
  isClickUpUrl,
} from './clickup-urls';

describe('isClickUpUrl', () => {
  it.each([
    'https://app.clickup.com/',
    'https://app.clickup.com/t/abc123',
    'https://doc.clickup.com/d/xyz',
    'https://clickup.com/',
  ])('accepts %s', (url) => expect(isClickUpUrl(url)).toBe(true));

  it.each([
    'http://app.clickup.com/',
    'https://app.clickup.com.evil.example/',
    'https://evilclickup.com/',
    'https://user:pass@app.clickup.com/',
    'file:///C:/clickup.com',
    'not a url',
  ])('refuses %s', (url) => expect(isClickUpUrl(url)).toBe(false));
});

describe('classifyUrl', () => {
  it('keeps ClickUp pages in the app', () => {
    expect(classifyUrl('https://app.clickup.com/t/1')).toBe('clickup');
  });

  it('recognises sign-in pages', () => {
    expect(classifyUrl('https://accounts.google.com/o/oauth2/auth')).toBe('auth');
    expect(classifyUrl('https://login.microsoftonline.com/common')).toBe('auth');
    expect(classifyUrl('https://acme.okta.com/sso')).toBe('auth');
    expect(classifyUrl('http://accounts.google.com/')).toBe('external');
  });

  it('sends other web and mail links to Windows', () => {
    expect(classifyUrl('https://github.com/')).toBe('external');
    expect(classifyUrl('http://example.com/')).toBe('external');
    expect(classifyUrl('mailto:someone@example.com')).toBe('external');
  });

  it('blocks everything else', () => {
    expect(classifyUrl('javascript:alert(1)')).toBe('blocked');
    expect(classifyUrl('file:///C:/Windows/notepad.exe')).toBe('blocked');
    expect(classifyUrl('ms-settings:privacy')).toBe('blocked');
    expect(classifyUrl('nonsense')).toBe('blocked');
  });
});

describe('clickUpLinkFrom', () => {
  it('accepts ClickUp web links as they are', () => {
    expect(clickUpLinkFrom('https://app.clickup.com/t/abc')).toBe('https://app.clickup.com/t/abc');
  });

  it('maps clickup:// links onto app.clickup.com', () => {
    expect(clickUpLinkFrom('clickup://t/abc123')).toBe('https://app.clickup.com/t/abc123');
    expect(clickUpLinkFrom('clickup:///9012/v/l/6')).toBe('https://app.clickup.com/9012/v/l/6');
    expect(clickUpLinkFrom('CLICKUP://t/abc?x=1')).toBe('https://app.clickup.com/t/abc?x=1');
    expect(clickUpLinkFrom('clickup://')).toBe('https://app.clickup.com/');
  });

  it('cannot be tricked into another site', () => {
    for (const trick of [
      'clickup://@evil.example/',
      'clickup://\\evil.example/',
      'clickup:////evil.example',
    ]) {
      const link = clickUpLinkFrom(trick);
      expect(link && new URL(link).hostname, trick).toBe('app.clickup.com');
    }
    expect(clickUpLinkFrom('https://evil.example/')).toBeNull();
    expect(clickUpLinkFrom('--hidden')).toBeNull();
    expect(clickUpLinkFrom(`clickup://t/${'a'.repeat(3000)}`)).toBeNull();
  });

  it('finds the link among command-line arguments', () => {
    expect(clickUpLinkFromArgs(['C:\\app.exe', '--hidden', 'clickup://t/1'])).toBe(
      'https://app.clickup.com/t/1',
    );
    expect(clickUpLinkFromArgs(['C:\\app.exe', '.'])).toBeNull();
  });
});

describe('cleanTitle', () => {
  it('removes the ClickUp suffix', () => {
    expect(cleanTitle('Sprint 12 | ClickUp')).toBe('Sprint 12');
    expect(cleanTitle('Inbox - ClickUp')).toBe('Inbox');
    expect(cleanTitle('ClickUp')).toBe('ClickUp');
    expect(cleanTitle('  Plain  ')).toBe('Plain');
  });
});

describe('chromeUserAgent', () => {
  it('removes Electron and the app name', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Better ClickUp/1.2.3 Chrome/140.0.0.0 Electron/44.1.0 Safari/537.36';
    expect(chromeUserAgent(ua, 'Better ClickUp/1.2.3')).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    );
  });
});
