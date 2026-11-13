import { describe, expect, it } from 'vitest';
import { shortcutFor, type KeyInput } from './shortcuts';

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  type: 'keyDown',
  key: k,
  control: false,
  shift: false,
  alt: false,
  meta: false,
  ...mods,
});
const ctrl = { control: true };

describe('shortcutFor', () => {
  it.each([
    [key('t', ctrl), { action: 'newTab' }],
    [key('T', { control: true, shift: true }), { action: 'reopenTab' }],
    [key('w', ctrl), { action: 'closeTab' }],
    [key('F4', ctrl), { action: 'closeTab' }],
    [key('Tab', ctrl), { action: 'nextTab' }],
    [key('Tab', { control: true, shift: true }), { action: 'previousTab' }],
    [key('PageDown', ctrl), { action: 'nextTab' }],
    [key('PageUp', ctrl), { action: 'previousTab' }],
    [key('3', ctrl), { action: 'goToTab', number: 3 }],
    [key('F5'), { action: 'reload' }],
    [key('F5', ctrl), { action: 'hardReload' }],
    [key('r', ctrl), { action: 'reload' }],
    [key('R', { control: true, shift: true }), { action: 'hardReload' }],
    [key('ArrowLeft', { alt: true }), { action: 'back' }],
    [key('ArrowRight', { alt: true }), { action: 'forward' }],
    [key('=', ctrl), { action: 'zoomIn' }],
    [key('-', ctrl), { action: 'zoomOut' }],
    [key('0', ctrl), { action: 'zoomReset' }],
  ] as const)('%j', (input, expected) => expect(shortcutFor(input)).toEqual(expected));

  it('leaves other keys to ClickUp', () => {
    expect(shortcutFor(key('t'))).toBeNull();
    expect(shortcutFor(key('k', ctrl))).toBeNull();
    expect(shortcutFor(key('t', { control: true, alt: true }))).toBeNull();
    expect(shortcutFor(key('ArrowLeft'))).toBeNull();
    expect(shortcutFor({ ...key('t', ctrl), type: 'keyUp' })).toBeNull();
  });
});
