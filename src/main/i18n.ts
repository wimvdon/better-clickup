import { app } from 'electron';
import { createTranslator, pickLanguage, type Translate } from '../shared/i18n';

let translator: Translate | null = null;

/** Text for menus, the tray and notifications, in the Windows user's language. */
export function t(...args: Parameters<Translate>): string {
  translator ??= createTranslator(pickLanguage(app.getPreferredSystemLanguages()));
  return translator(...args);
}
