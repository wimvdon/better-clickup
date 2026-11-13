/**
 * English (default) text. Every user-visible string in the app lives here and in the
 * other language files. TypeScript refuses to build if a language misses a key.
 *
 * A message is either plain text or plural forms ({ one, other }, plus zero/two/few/many
 * where a language needs them). Use {name} for values filled in at runtime.
 */
export const en = {
  'home.heading': 'Hello!',
  'home.body': 'This is the placeholder screen of the app template.',
  'home.clickCount': { one: 'Clicked {count} time', other: 'Clicked {count} times' },
  'home.clickButton': 'Click me',
  'home.resetButton': 'Reset',
  'footer.version': 'Version {version}',
} as const;
