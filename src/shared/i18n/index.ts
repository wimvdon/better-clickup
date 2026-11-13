import { en } from './en';
import { nl } from './nl';
import type { Message, MessageKey, Messages, PluralForms } from './types';

export type { MessageKey, Messages } from './types';

/** All supported languages. Add a new language here and in its own file. */
export const LANGUAGES = { en, nl } satisfies Record<string, Messages>;
export type Language = keyof typeof LANGUAGES;
export const DEFAULT_LANGUAGE: Language = 'en';

/**
 * Picks the best supported language for the user's preferred languages (most preferred
 * first, e.g. navigator.languages or app.getPreferredSystemLanguages()).
 * Matches on the language part, so "nl-BE" picks "nl".
 */
export function pickLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split(/[-_]/)[0] ?? '';
    if (Object.hasOwn(LANGUAGES, base)) return base as Language;
  }
  return DEFAULT_LANGUAGE;
}

export type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

function fill(text: string, params: Params): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

function choosePlural(forms: PluralForms, count: number, language: Language): string {
  const rule = new Intl.PluralRules(language).select(count);
  return forms[rule] ?? forms.other;
}

/** Returns a translate function for one language. Plural messages need a numeric {count}. */
export function createTranslator(language: Language): Translate {
  const messages: Messages = LANGUAGES[language];
  return (key, params = {}) => {
    const message: Message = messages[key];
    if (typeof message === 'string') return fill(message, params);
    const count = Number(params.count);
    return fill(choosePlural(message, Number.isFinite(count) ? count : 0, language), params);
  };
}
