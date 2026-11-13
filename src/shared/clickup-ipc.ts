/**
 * The channels between the ClickUp pages in the tabs and the main process
 * (src/preload/clickup.ts ↔ src/main/ipc.ts). Kept apart from ipc.ts on purpose: each
 * sandboxed preload script must be a single file, so the two preload scripts share no code.
 * Messages are checked in the main process (shared/notifications.ts).
 */
export const CLICKUP_IPC = {
  /** Page → main: show a Windows notification (a NotificationRequest). */
  notify: 'clickup:notify',
  /** Main → page: the user clicked the notification with this id. */
  notificationClick: 'clickup:notification-click',
} as const;
