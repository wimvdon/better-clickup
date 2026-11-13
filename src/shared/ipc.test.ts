import { describe, expect, it } from 'vitest';
import { parseTabCommand } from './ipc';

describe('parseTabCommand', () => {
  it.each([
    { type: 'new' },
    { type: 'back' },
    { type: 'forward' },
    { type: 'reload' },
    { type: 'activate', id: 3 },
    { type: 'close', id: 3 },
    { type: 'menu', id: 3 },
    { type: 'move', id: 3, index: 0 },
  ])('accepts %j', (command) => expect(parseTabCommand(command)).toEqual(command));

  it('drops extra fields', () => {
    expect(parseTabCommand({ type: 'new', url: 'file:///x' })).toEqual({ type: 'new' });
  });

  it.each([
    null,
    'new',
    { type: 'open', url: 'https://example.com' },
    { type: 'close' },
    { type: 'close', id: '3' },
    { type: 'close', id: 0 },
    { type: 'close', id: 1.5 },
    { type: 'move', id: 1, index: -1 },
  ])('refuses %j', (command) => expect(parseTabCommand(command)).toBeNull());
});
