import { describe, expect, it } from 'vitest';
import { NotificationDeduper, parseNotificationRequest } from './notifications';

describe('parseNotificationRequest', () => {
  it('accepts a proper request', () => {
    expect(parseNotificationRequest({ id: 3, title: 'New comment', body: 'Hi', tag: '' })).toEqual({
      id: 3,
      title: 'New comment',
      body: 'Hi',
      tag: '',
    });
  });

  it('shortens very long texts', () => {
    const request = parseNotificationRequest({
      id: 1,
      title: 'x'.repeat(999),
      body: 'y'.repeat(9999),
      tag: '',
    });
    expect(request?.title).toHaveLength(256);
    expect(request?.body).toHaveLength(1024);
  });

  it.each([
    null,
    'text',
    { id: -1, title: 'a', body: '', tag: '' },
    { id: 1.5, title: 'a', body: '', tag: '' },
    { id: 1, title: 5, body: '', tag: '' },
    { id: 1, title: ' ', body: '', tag: '' },
    { id: 1, title: 'a', body: '' },
  ])('refuses %j', (value) => expect(parseNotificationRequest(value)).toBeNull());
});

describe('NotificationDeduper', () => {
  it('shows the same notification only once within the time window', () => {
    const dedupe = new NotificationDeduper(1000);
    const n = { title: 'New comment', body: 'Hi', tag: '' };
    expect(dedupe.shouldShow(n, 0)).toBe(true);
    expect(dedupe.shouldShow(n, 500)).toBe(false);
    expect(dedupe.shouldShow({ ...n, body: 'Other' }, 600)).toBe(true);
    expect(dedupe.shouldShow(n, 1500)).toBe(true);
  });

  it('uses the tag when there is one', () => {
    const dedupe = new NotificationDeduper(1000);
    expect(dedupe.shouldShow({ title: 'A', body: '', tag: 'c1' }, 0)).toBe(true);
    expect(dedupe.shouldShow({ title: 'B', body: '', tag: 'c1' }, 1)).toBe(false);
  });
});
