import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type Api } from '../shared/ipc';

// The renderer gets these functions and nothing else: no Node.js, no ipcRenderer.
const api: Api = {
  getAppInfo: () => ipcRenderer.invoke(IPC.getAppInfo),
};

contextBridge.exposeInMainWorld('api', api);
