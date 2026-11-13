import { describe, expect, it } from 'vitest';
import { LANGUAGES, createTranslator, pickLanguage } from './index';
import { en } from './en';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const texts = (message: unknown): string[] =>
  typeof message === 'string' ? [message] : Object.values(message as Record<string, string>);

describe('translations', () => {
  for (const [language, messages] of Object.entries(LANGUAGES)) {
    describe(language, () => {
      it('has exactly the same keys as English', () => {
        expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
      });

      it('uses the same {placeholders} as English', () => {
        for (const [key, message] of Object.entries(messages)) {
          const expected = placeholders(texts(en[key as keyof typeof en])[0] ?? '');
          for (const text of texts(message)) {
            expect(placeholders(text), `${language}: ${key}`).toEqual(expected);
          }
        }
      });

      it('has no empty texts', () => {
        for (const [key, message] of Object.entries(messages)) {
          for (const text of texts(message))
            expect(text.trim(), `${language}: ${key}`).not.toBe('');
        }
      });
    });
  }
});

describe('pickLanguage', () => {
  it('matches on the language part', () => {
    expect(pickLanguage(['nl-BE', 'en-US'])).toBe('nl');
  });

  it('uses the first supported language', () => {
    expect(pickLanguage(['fr-FR', 'nl-NL', 'en'])).toBe('nl');
  });

  it('falls back to English', () => {
    expect(pickLanguage(['fr-FR'])).toBe('en');
    expect(pickLanguage([])).toBe('en');
  });
});

describe('createTranslator', () => {
  it('fills in placeholders', () => {
    expect(createTranslator('en')('footer.version', { version: '1.2.3' })).toBe('Version 1.2.3');
  });

  it('chooses the plural form', () => {
    const t = createTranslator('en');
    expect(t('home.clickCount', { count: 1 })).toBe('Clicked 1 time');
    expect(t('home.clickCount', { count: 0 })).toBe('Clicked 0 times');
    expect(t('home.clickCount', { count: 5 })).toBe('Clicked 5 times');
  });

  it('translates', () => {
    expect(createTranslator('nl')('home.clickButton')).toBe('Klik hier');
  });

  it('leaves unknown placeholders visible instead of dropping them', () => {
    expect(createTranslator('en')('footer.version')).toBe('Version {version}');
  });
});
