import { app, ipcMain } from 'electron';
import { isClickUpUrl } from '../shared/clickup-urls';
import { CLICKUP_IPC } from '../shared/clickup-ipc';
import { IPC, parseTabCommand, type AppInfo, type TabsView } from '../shared/ipc';
import { parseNotificationRequest } from '../shared/notifications';
import type { NotificationCenter } from './notifications';
import { isTrustedSender } from './security';
import type { TabManager } from './tabs';

export interface IpcDependencies {
  mica: boolean;
  tabs(): TabManager | null;
  notifications: NotificationCenter;
}

/** Registers the handlers for every channel in src/shared/ipc.ts and src/shared/clickup-ipc.ts. */
export function registerIpcHandlers({ mica, tabs, notifications }: IpcDependencies): void {
  // --- The app's own UI (the tab bar) -----------------------------------------------------
  ipcMain.handle(IPC.getAppInfo, (event): AppInfo => {
    if (!isTrustedSender(event.senderFrame)) throw new Error('Untrusted sender');
    return {
      name: app.getName(),
      version: app.getVersion(),
      languages: app.getPreferredSystemLanguages(),
      mica,
    };
  });

  ipcMain.handle(IPC.getTabs, (event): TabsView | null => {
    if (!isTrustedSender(event.senderFrame)) throw new Error('Untrusted sender');
    return tabs()?.view() ?? null;
  });

  ipcMain.on(IPC.tabCommand, (event, value: unknown) => {
    if (!isTrustedSender(event.senderFrame)) return;
    const command = parseTabCommand(value);
    if (command) tabs()?.command(command);
  });

  // --- ClickUp's pages in the tabs ----------------------------------------------------------
  ipcMain.on(CLICKUP_IPC.notify, (event, value: unknown) => {
    // Only the main frame of one of our tabs, while it shows a ClickUp page, may notify.
    const tabId = tabs()?.tabIdOf(event.sender) ?? null;
    const frame = event.senderFrame;
    if (tabId === null || !frame || frame !== event.sender.mainFrame || !isClickUpUrl(frame.url))
      return;
    const request = parseNotificationRequest(value);
    if (request) notifications.show(tabId, request);
  });
}
