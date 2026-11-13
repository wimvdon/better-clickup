import type { en } from './en';

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Message = string | PluralForms;

export type MessageKey = keyof typeof en;

/** Every language must provide every key, with the same shape (text or plural forms) as English. */
export type Messages = {
  [K in MessageKey]: (typeof en)[K] extends string ? string : PluralForms;
};
