/**
 * The only channels between the renderer (UI) and the main process.
 * Every channel is listed here, exposed by src/preload/index.ts and handled in src/main/ipc.ts.
 */
export const IPC = {
  getAppInfo: 'app:get-info',
} as const;

export interface AppInfo {
  name: string;
  version: string;
  /** Preferred languages of the Windows user, most preferred first. */
  languages: string[];
}

/** What the preload script exposes to the renderer as window.api. */
export interface Api {
  getAppInfo(): Promise<AppInfo>;
}
