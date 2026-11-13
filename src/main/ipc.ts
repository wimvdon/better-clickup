import { app, ipcMain } from 'electron';
import { IPC, type AppInfo } from '../shared/ipc';
import { isTrustedSender } from './security';

/** Registers the handlers for every channel in src/shared/ipc.ts. */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.getAppInfo, (event): AppInfo => {
    if (!isTrustedSender(event.senderFrame)) throw new Error('Untrusted sender');
    return {
      name: app.getName(),
      version: app.getVersion(),
      languages: app.getPreferredSystemLanguages(),
    };
  });
}
