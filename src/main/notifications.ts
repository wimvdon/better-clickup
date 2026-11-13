import { Notification } from 'electron';
import { NotificationDeduper, type NotificationRequest } from '../shared/notifications';

/**
 * Shows ClickUp's notifications as Windows notifications (they also land in the Windows
 * notification centre). A notification that several tabs report is shown once.
 */
export class NotificationCenter {
  private readonly dedupe = new NotificationDeduper();
  /** Kept so their click handlers stay alive until Windows is done with them. */
  private readonly live = new Set<Notification>();

  constructor(
    private readonly appName: string,
    private readonly onShow: () => void,
    private readonly onClick: (tabId: number, notificationId: number) => void,
  ) {}

  show(tabId: number, request: NotificationRequest): void {
    if (!Notification.isSupported() || !this.dedupe.shouldShow(request, Date.now())) return;
    const notification = new Notification({
      title: request.title || this.appName,
      body: request.body,
    });
    const forget = () => this.live.delete(notification);
    notification.on('click', () => {
      forget();
      this.onClick(tabId, request.id);
    });
    notification.on('close', forget);
    notification.on('failed', forget);
    this.live.add(notification);
    if (this.live.size > 50) this.live.delete(this.live.values().next().value as Notification);
    notification.show();
    this.onShow();
  }
}
