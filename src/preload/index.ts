import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type Api, type TabsView } from '../shared/ipc';

// The renderer gets these functions and nothing else: no Node.js, no ipcRenderer.
const api: Api = {
  getAppInfo: () => ipcRenderer.invoke(IPC.getAppInfo),
  getTabs: () => ipcRenderer.invoke(IPC.getTabs),
  onTabsChanged: (listener) => {
    const handler = (_event: unknown, tabs: TabsView) => listener(tabs);
    ipcRenderer.on(IPC.tabsChanged, handler);
    return () => void ipcRenderer.removeListener(IPC.tabsChanged, handler);
  },
  tabCommand: (command) => ipcRenderer.send(IPC.tabCommand, command),
};

contextBridge.exposeInMainWorld('api', api);
