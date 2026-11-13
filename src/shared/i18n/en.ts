/**
 * English (default) text. Every user-visible string in the app lives here and in the
 * other language files. TypeScript refuses to build if a language misses a key.
 *
 * A message is either plain text or plural forms ({ one, other }, plus zero/two/few/many
 * where a language needs them). Use {name} for values filled in at runtime.
 */
export const en = {
  'tabs.list': 'Open tabs',
  'tabs.new': 'New tab (Ctrl+T)',
  'tabs.close': 'Close {title}',
  'tabs.untitled': 'ClickUp',
  'tabs.loading': 'Loading',
  'nav.back': 'Back (Alt+Left)',
  'nav.forward': 'Forward (Alt+Right)',
  'nav.reload': 'Reload (F5)',

  'menu.reload': 'Reload',
  'menu.duplicate': 'Duplicate tab',
  'menu.copyLink': 'Copy link',
  'menu.closeTab': 'Close tab',
  'menu.closeOthers': 'Close other tabs',
  'menu.reopenClosed': 'Reopen closed tab',
  'menu.openLinkInNewTab': 'Open link in new tab',
  'menu.openLinkInBrowser': 'Open link in browser',
  'menu.copyLinkAddress': 'Copy link address',
  'menu.addToDictionary': 'Add to dictionary',
  'menu.cut': 'Cut',
  'menu.copy': 'Copy',
  'menu.paste': 'Paste',
  'menu.selectAll': 'Select all',
  'menu.back': 'Back',
  'menu.forward': 'Forward',

  'tray.open': 'Open {app}',
  'tray.newTab': 'New tab',
  'tray.startWithWindows': 'Start with Windows',
  'tray.tooltip': { one: '{app}: {count} tab open', other: '{app}: {count} tabs open' },
  'tray.version': 'Version {version}',
  'tray.quit': 'Quit',
  'tray.hintTitle': '{app} is still running',
  'tray.hintBody':
    'It keeps showing your ClickUp notifications. To quit, right-click its icon here and choose Quit.',
} as const;
