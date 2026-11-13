/**
 * Preload script of the ClickUp pages in the tabs. ClickUp's web app shows its notifications
 * with the browser's Notification API. This replaces that API inside the page with one that
 * hands each notification to the main process, which shows a real Windows notification,
 * drops duplicates from other tabs, and brings the right tab to the front when it is clicked.
 *
 * The page gets nothing else: no Node.js, no ipcRenderer, no other functions.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { CLICKUP_IPC } from '../shared/clickup-ipc';

interface Payload {
  id: number;
  title: string;
  body: string;
  tag: string;
}

/**
 * Runs inside the page itself (Electron copies the function's text there), so it must not use
 * anything from outside the function, and it avoids syntax a bundler might rewrite with helpers.
 */
function installNotifications(
  send: (payload: Payload) => void,
  onClick: (listener: (id: number) => void) => void,
): void {
  type Handler = ((this: unknown, event: Event) => unknown) | null;
  const live = new Map<number, EventTarget>();
  let nextId = 1;

  class Notification extends EventTarget {
    static get permission(): string {
      return 'granted';
    }
    static requestPermission(callback?: (permission: string) => void): Promise<string> {
      if (typeof callback === 'function') callback('granted');
      return Promise.resolve('granted');
    }
    static get maxActions(): number {
      return 0;
    }

    declare readonly title: string;
    declare readonly body: string;
    declare readonly tag: string;
    declare readonly data: unknown;
    declare readonly icon: string;
    declare readonly silent: boolean;
    declare onclick: Handler;
    declare onshow: Handler;
    declare onclose: Handler;
    declare onerror: Handler;
    declare readonly notificationId: number;

    constructor(title: string, options?: Record<string, unknown>) {
      super();
      if (arguments.length === 0) {
        throw new TypeError("Failed to construct 'Notification': 1 argument required.");
      }
      const o = options ?? {};
      const id = nextId++;
      Object.defineProperties(this, {
        title: { value: String(title), enumerable: true },
        body: { value: o.body === undefined ? '' : String(o.body), enumerable: true },
        tag: { value: o.tag === undefined ? '' : String(o.tag), enumerable: true },
        data: { value: o.data ?? null, enumerable: true },
        icon: { value: o.icon === undefined ? '' : String(o.icon), enumerable: true },
        silent: { value: o.silent === true, enumerable: true },
        notificationId: { value: id },
      });
      this.onclick = this.onshow = this.onclose = this.onerror = null;
      live.set(id, this);
      // Forget the oldest when a page creates many and never closes them.
      if (live.size > 100) live.delete(live.keys().next().value as number);
      send({ id, title: this.title, body: this.body, tag: this.tag });
      setTimeout(() => this.dispatchEvent(new Event('show')), 0);
    }

    close(): void {
      if (live.delete(this.notificationId)) this.dispatchEvent(new Event('close'));
    }

    override dispatchEvent(event: Event): boolean {
      const handler = (this as unknown as Record<string, unknown>)[`on${event.type}`];
      if (typeof handler === 'function') handler.call(this, event);
      return super.dispatchEvent(event);
    }
  }

  onClick((id) => {
    const notification = live.get(id);
    if (!notification) return;
    live.delete(id);
    notification.dispatchEvent(new Event('click', { cancelable: true }));
  });

  Object.defineProperty(globalThis, 'Notification', {
    value: Notification,
    writable: true,
    configurable: true,
  });

  // Notifications shown through a service worker go the same way (they have no click handler).
  const registration = (globalThis as Record<string, unknown>).ServiceWorkerRegistration as
    { prototype: Record<string, unknown> } | undefined;
  if (registration) {
    registration.prototype.showNotification = (
      title: unknown,
      options?: Record<string, unknown>,
    ) => {
      const o = options ?? {};
      send({
        id: 0,
        title: String(title),
        body: o.body === undefined ? '' : String(o.body),
        tag: o.tag === undefined ? '' : String(o.tag),
      });
      return Promise.resolve();
    };
    registration.prototype.getNotifications = () => Promise.resolve([]);
  }
}

let clickListener: ((id: number) => void) | null = null;
ipcRenderer.on(CLICKUP_IPC.notificationClick, (_event, id: unknown) => {
  if (typeof id === 'number') clickListener?.(id);
});

contextBridge.executeInMainWorld({
  func: installNotifications,
  args: [
    (payload: Payload) => ipcRenderer.send(CLICKUP_IPC.notify, payload),
    (listener: (id: number) => void) => {
      clickListener = listener;
    },
  ],
});
