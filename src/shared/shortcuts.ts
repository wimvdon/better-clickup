/**
 * Keyboard shortcuts of the app, the same as in Edge and Chrome. Plain logic, unit tested;
 * the main process listens to the keys of the window and every tab.
 */

export type Shortcut =
  | { action: 'newTab' }
  | { action: 'closeTab' }
  | { action: 'reopenTab' }
  | { action: 'nextTab' }
  | { action: 'previousTab' }
  | { action: 'goToTab'; number: number }
  | { action: 'reload' }
  | { action: 'hardReload' }
  | { action: 'back' }
  | { action: 'forward' }
  | { action: 'zoomIn' }
  | { action: 'zoomOut' }
  | { action: 'zoomReset' };

/** The fields of Electron's input event that matter here. */
export interface KeyInput {
  type: string;
  key: string;
  control: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export function shortcutFor(input: KeyInput): Shortcut | null {
  if (input.type !== 'keyDown' || input.meta) return null;
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  const { control: ctrl, shift, alt } = input;

  if (alt && !ctrl && !shift) {
    if (key === 'ArrowLeft') return { action: 'back' };
    if (key === 'ArrowRight') return { action: 'forward' };
    return null;
  }
  if (key === 'F5' && !alt) return { action: ctrl || shift ? 'hardReload' : 'reload' };
  if (alt || !ctrl) return null;

  if (key === 'Tab') return { action: shift ? 'previousTab' : 'nextTab' };
  if (key === 'PageDown' && !shift) return { action: 'nextTab' };
  if (key === 'PageUp' && !shift) return { action: 'previousTab' };
  if (key === 't') return { action: shift ? 'reopenTab' : 'newTab' };
  if (key === 'r') return { action: shift ? 'hardReload' : 'reload' };
  if ((key === 'w' || key === 'F4') && !shift) return { action: 'closeTab' };
  if (key === '=' || key === '+') return { action: 'zoomIn' };
  if ((key === '-' || key === '_') && !shift) return { action: 'zoomOut' };
  if (key === '0' && !shift) return { action: 'zoomReset' };
  if (/^[1-9]$/.test(key) && !shift) return { action: 'goToTab', number: Number(key) };
  return null;
}
