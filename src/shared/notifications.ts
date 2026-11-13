/**
 * Checks the notifications ClickUp's pages ask to show, and drops duplicates: when several
 * tabs are open, each of them hears about the same new comment and would show it again.
 * Unit tested.
 */

export interface NotificationRequest {
  /** Number the page uses to recognise its notification when it is clicked. */
  id: number;
  title: string;
  body: string;
  /** ClickUp's own label for the notification, used to spot duplicates. Can be "". */
  tag: string;
}

const MAX_TITLE = 256;
const MAX_BODY = 1024;

/** Validates what a page sent. Returns null for anything that isn't a proper notification. */
export function parseNotificationRequest(value: unknown): NotificationRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, title, body, tag } = value as Record<string, unknown>;
  if (!Number.isSafeInteger(id) || (id as number) < 0) return null;
  if (typeof title !== 'string' || typeof body !== 'string' || typeof tag !== 'string') return null;
  if (title.trim() === '' && body.trim() === '') return null;
  return {
    id: id as number,
    title: title.slice(0, MAX_TITLE),
    body: body.slice(0, MAX_BODY),
    tag: tag.slice(0, MAX_TITLE),
  };
}

/** Remembers recent notifications for `windowMs` and says whether a new one is a repeat. */
export class NotificationDeduper {
  private readonly seen = new Map<string, number>();

  constructor(private readonly windowMs = 10_000) {}

  /** True if this notification should be shown (and records it). */
  shouldShow(request: Pick<NotificationRequest, 'title' | 'body' | 'tag'>, now: number): boolean {
    for (const [key, at] of this.seen) if (now - at >= this.windowMs) this.seen.delete(key);
    const key = request.tag ? `tag\n${request.tag}` : `text\n${request.title}\n${request.body}`;
    if (this.seen.has(key)) return false;
    this.seen.set(key, now);
    return true;
  }
}
