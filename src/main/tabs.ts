import {
  BrowserWindow,
  Menu,
  WebContentsView,
  clipboard,
  nativeTheme,
  shell,
  type ContextMenuParams,
  type HandlerDetails,
  type MenuItemConstructorOptions,
  type Session,
  type WebContents,
  type WindowOpenHandlerResponse,
} from 'electron';
import { CLICKUP_HOME, classifyUrl, cleanTitle, isClickUpUrl } from '../shared/clickup-urls';
import { CLICKUP_IPC } from '../shared/clickup-ipc';
import { IPC, TAB_BAR_HEIGHT, type TabCommand, type TabsView } from '../shared/ipc';
import type { KeyInput, Shortcut } from '../shared/shortcuts';
import { shortcutFor } from '../shared/shortcuts';
import {
  DEFAULT_SLEEP_POLICY,
  activateTab,
  activeTab,
  closeOtherTabs,
  closeTab,
  moveTab,
  neighbourTabId,
  openTab,
  putToSleep,
  reopenClosedTab,
  tabIdForNumber,
  tabsToSleep,
  updateTab,
  type TabsState,
} from '../shared/tabs';
import { t } from './i18n';

export interface TabManagerOptions {
  window: BrowserWindow;
  session: Session;
  partition: string;
  /** The ClickUp pages' preload script (src/preload/clickup.ts). */
  preload: string;
  initial: TabsState;
  zoomLevel: number;
  /** Called after every change, to save the tabs. */
  onChange(state: TabsState): void;
  onZoomChange(level: number): void;
}

const ZOOM_STEP = 0.5;
const MAX_ZOOM = 4;
const SLEEP_CHECK_MS = 60 * 1000;

/**
 * The ClickUp tabs of the main window. Each loaded tab is a separate web page (a
 * WebContentsView) drawn below the tab bar; only the shown one is visible, the others are
 * throttled by Chromium, and tabs not used for a while are unloaded ("asleep") to free memory.
 * The tab logic itself lives in shared/tabs.ts.
 */
export class TabManager {
  private state: TabsState;
  private readonly views = new Map<number, WebContentsView>();
  private readonly loading = new Set<number>();
  private readonly sleepTimer: NodeJS.Timeout;
  private zoomLevel: number;

  constructor(private readonly o: TabManagerOptions) {
    this.state = o.initial;
    this.zoomLevel = o.zoomLevel;
    o.window.on('resize', () => this.layout());
    this.sleepTimer = setInterval(() => this.sleepIdleTabs(), SLEEP_CHECK_MS);
    this.sleepTimer.unref();
    this.apply();
  }

  get current(): TabsState {
    return this.state;
  }

  /** What the tab bar shows. */
  view(): TabsView {
    const history = this.activeContents()?.navigationHistory;
    return {
      tabs: this.state.tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        asleep: tab.asleep,
        loading: this.loading.has(tab.id),
      })),
      activeId: this.state.activeId,
      canGoBack: history?.canGoBack() ?? false,
      canGoForward: history?.canGoForward() ?? false,
    };
  }

  /** Which tab a page belongs to, or null if it is not one of the tabs. */
  tabIdOf(contents: WebContents): number | null {
    for (const [id, view] of this.views) if (view.webContents === contents) return id;
    return null;
  }

  open(url: string, activate = true): void {
    this.set(openTab(this.state, url, { activate, now: Date.now() }).state);
    if (activate) this.focusActive();
  }

  activate(id: number): void {
    this.set(activateTab(this.state, id, Date.now()));
    this.focusActive();
  }

  close(id: number): void {
    this.set(closeTab(this.state, id, CLICKUP_HOME, Date.now()));
  }

  /** The user clicked a notification: show its tab, and let the page react to the click. */
  notificationClicked(tabId: number, notificationId: number): void {
    if (!this.state.tabs.some((tab) => tab.id === tabId)) return;
    const wasAwake = this.views.has(tabId);
    this.activate(tabId);
    if (wasAwake && notificationId > 0) {
      this.views.get(tabId)?.webContents.send(CLICKUP_IPC.notificationClick, notificationId);
    }
  }

  command(command: TabCommand): void {
    switch (command.type) {
      case 'new':
        return this.open(CLICKUP_HOME);
      case 'activate':
        return this.activate(command.id);
      case 'close':
        return this.close(command.id);
      case 'move':
        return this.set(moveTab(this.state, command.id, command.index));
      case 'menu':
        return this.showTabMenu(command.id);
      case 'back':
        return this.run({ action: 'back' });
      case 'forward':
        return this.run({ action: 'forward' });
      case 'reload':
        return this.run({ action: 'reload' });
    }
  }

  /** Handles the app's keyboard shortcuts. Returns true if the key was one of them. */
  handleKey(input: KeyInput): boolean {
    const shortcut = shortcutFor(input);
    if (shortcut) this.run(shortcut);
    return shortcut !== null;
  }

  run(shortcut: Shortcut): void {
    const contents = this.activeContents();
    switch (shortcut.action) {
      case 'newTab':
        return this.open(CLICKUP_HOME);
      case 'closeTab':
        return this.close(this.state.activeId);
      case 'reopenTab':
        this.set(reopenClosedTab(this.state, Date.now()));
        return this.focusActive();
      case 'nextTab':
        return this.activate(neighbourTabId(this.state, 1));
      case 'previousTab':
        return this.activate(neighbourTabId(this.state, -1));
      case 'goToTab': {
        const id = tabIdForNumber(this.state, shortcut.number);
        return id === null ? undefined : this.activate(id);
      }
      case 'reload':
        return contents?.reload();
      case 'hardReload':
        return contents?.reloadIgnoringCache();
      case 'back':
        if (contents?.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
        return;
      case 'forward':
        if (contents?.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
        return;
      case 'zoomIn':
        return this.setZoom(this.zoomLevel + ZOOM_STEP);
      case 'zoomOut':
        return this.setZoom(this.zoomLevel - ZOOM_STEP);
      case 'zoomReset':
        return this.setZoom(0);
    }
  }

  destroy(): void {
    clearInterval(this.sleepTimer);
    for (const id of [...this.views.keys()]) this.destroyView(id);
  }

  // --- Internals ---------------------------------------------------------------------------

  private set(next: TabsState): void {
    if (next === this.state) return;
    this.state = next;
    this.apply();
  }

  /** Makes the pages match the state: load the shown tab, unload sleeping and closed ones. */
  private apply(): void {
    for (const id of [...this.views.keys()]) {
      const tab = this.state.tabs.find((t) => t.id === id);
      if (!tab || tab.asleep) this.destroyView(id);
    }
    const active = activeTab(this.state);
    if (!this.views.has(active.id)) this.createView(active.id, active.url);
    for (const [id, view] of this.views) view.setVisible(id === active.id);
    this.layout();
    this.emit();
    this.o.onChange(this.state);
  }

  private emit(): void {
    if (!this.o.window.isDestroyed()) this.o.window.webContents.send(IPC.tabsChanged, this.view());
  }

  private layout(): void {
    if (this.o.window.isDestroyed()) return;
    const [width = 0, height = 0] = this.o.window.getContentSize();
    const bounds = { x: 0, y: TAB_BAR_HEIGHT, width, height: Math.max(0, height - TAB_BAR_HEIGHT) };
    for (const view of this.views.values()) view.setBounds(bounds);
  }

  private activeContents(): WebContents | undefined {
    return this.views.get(this.state.activeId)?.webContents;
  }

  private focusActive(): void {
    if (this.o.window.isFocused()) this.activeContents()?.focus();
  }

  private sleepIdleTabs(): void {
    const ids = tabsToSleep(this.state, Date.now(), DEFAULT_SLEEP_POLICY);
    if (ids.length > 0) this.set(putToSleep(this.state, ids));
  }

  private setZoom(level: number): void {
    this.zoomLevel = Math.max(-MAX_ZOOM, Math.min(MAX_ZOOM, level));
    for (const view of this.views.values()) view.webContents.setZoomLevel(this.zoomLevel);
    this.o.onZoomChange(this.zoomLevel);
  }

  private createView(id: number, url: string): void {
    const view = new WebContentsView({
      webPreferences: {
        session: this.o.session,
        preload: this.o.preload,
        // Electron security checklist: keep all three of these exactly like this.
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        // Hidden tabs run their timers less often, to save CPU and battery.
        backgroundThrottling: true,
        spellcheck: true,
      },
    });
    view.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff');
    this.views.set(id, view);
    this.o.window.contentView.addChildView(view);
    this.wire(id, view.webContents);
    view.webContents.setZoomLevel(this.zoomLevel);
    // Fails when ClickUp can't be reached (offline); the page shows Chromium's error then.
    view.webContents.loadURL(url).catch(() => undefined);
  }

  private destroyView(id: number): void {
    const view = this.views.get(id);
    if (!view) return;
    this.views.delete(id);
    this.loading.delete(id);
    if (!this.o.window.isDestroyed()) this.o.window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }

  private wire(id: number, contents: WebContents): void {
    const update = (patch: { url?: string; title?: string }) => {
      if (this.views.get(id)?.webContents === contents) this.set(updateTab(this.state, id, patch));
    };
    contents.on('page-title-updated', (_event, title) => update({ title: cleanTitle(title) }));
    // Only ClickUp addresses are remembered (not, say, a sign-in page halfway through logging in).
    const navigated = (url: string) => (isClickUpUrl(url) ? update({ url }) : this.emit());
    contents.on('did-navigate', (_event, url) => navigated(url));
    contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (isMainFrame) navigated(url);
    });
    contents.on('did-start-loading', () => {
      this.loading.add(id);
      this.emit();
    });
    contents.on('did-stop-loading', () => {
      this.loading.delete(id);
      this.emit();
    });
    // A crashed page is unloaded; opening the tab loads it again.
    contents.on('render-process-gone', () => {
      if (this.views.get(id)?.webContents !== contents) return;
      this.destroyView(id);
      if (id === this.state.activeId) this.apply();
      else this.set(putToSleep(this.state, [id]));
    });
    contents.on('before-input-event', (event, input) => {
      if (this.handleKey(input)) event.preventDefault();
    });
    contents.on('context-menu', (_event, params) => this.showPageMenu(contents, params));

    // Links: ClickUp pages open as tabs, sign-in pages may load here, the rest opens in Windows.
    contents.setWindowOpenHandler((details) => this.windowOpen(details));
    contents.on('will-navigate', (event) => {
      if (this.allowInTab(event.url)) return;
      event.preventDefault();
      this.openOutside(event.url);
    });
    contents.on('will-redirect', (event) => {
      if (classifyUrl(event.url) === 'blocked') event.preventDefault();
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.on('did-create-window', (popup) => this.hardenPopup(popup));
  }

  private allowInTab(url: string): boolean {
    const kind = classifyUrl(url);
    return kind === 'clickup' || kind === 'auth';
  }

  private openOutside(url: string): void {
    if (classifyUrl(url) === 'external') void shell.openExternal(url);
  }

  private windowOpen({ url, disposition }: HandlerDetails): WindowOpenHandlerResponse {
    switch (classifyUrl(url)) {
      case 'clickup':
        // Ctrl+click and middle-click open in the background, like in a browser.
        this.open(url, disposition !== 'background-tab');
        return { action: 'deny' };
      case 'auth':
        // "Continue with Google/Microsoft/…" may sign in through a small pop-up window.
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            parent: this.o.window,
            width: 520,
            height: 720,
            autoHideMenuBar: true,
            webPreferences: {
              partition: this.o.partition,
              contextIsolation: true,
              sandbox: true,
              nodeIntegration: false,
            },
          },
        };
      case 'external':
        void shell.openExternal(url);
        return { action: 'deny' };
      case 'blocked':
        return { action: 'deny' };
    }
  }

  private hardenPopup(popup: BrowserWindow): void {
    const contents = popup.webContents;
    contents.setWindowOpenHandler(({ url }) => {
      this.openOutside(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event) => {
      if (this.allowInTab(event.url)) return;
      event.preventDefault();
      this.openOutside(event.url);
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
  }

  private popup(items: MenuItemConstructorOptions[]): void {
    if (items.length > 0 && !this.o.window.isDestroyed()) {
      Menu.buildFromTemplate(items).popup({ window: this.o.window });
    }
  }

  private showTabMenu(id: number): void {
    const tab = this.state.tabs.find((t) => t.id === id);
    if (!tab) return;
    const awake = this.views.get(id);
    this.popup([
      { label: t('menu.reload'), enabled: !!awake, click: () => awake?.webContents.reload() },
      { label: t('menu.duplicate'), click: () => this.open(tab.url) },
      { label: t('menu.copyLink'), click: () => clipboard.writeText(tab.url) },
      {
        label: t('menu.sleep'),
        enabled: !!awake && id !== this.state.activeId,
        click: () => this.set(putToSleep(this.state, [id])),
      },
      { type: 'separator' },
      { label: t('menu.closeTab'), click: () => this.close(id) },
      {
        label: t('menu.closeOthers'),
        enabled: this.state.tabs.length > 1,
        click: () => this.set(closeOtherTabs(this.state, id, CLICKUP_HOME, Date.now())),
      },
      {
        label: t('menu.reopenClosed'),
        enabled: this.state.closed.length > 0,
        click: () => this.run({ action: 'reopenTab' }),
      },
    ]);
  }

  /** Right-click inside a page: spelling suggestions, links, cut/copy/paste. */
  private showPageMenu(contents: WebContents, params: ContextMenuParams): void {
    const items: MenuItemConstructorOptions[] = [];
    const separate = () => {
      if (items.length > 0 && items.at(-1)?.type !== 'separator') items.push({ type: 'separator' });
    };

    if (params.isEditable && params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        items.push({ label: suggestion, click: () => contents.replaceMisspelling(suggestion) });
      }
      items.push({
        label: t('menu.addToDictionary'),
        click: () => this.o.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      separate();
    }

    const link = params.linkURL;
    if (link) {
      const kind = classifyUrl(link);
      if (kind === 'clickup') {
        items.push({ label: t('menu.openLinkInNewTab'), click: () => this.open(link, false) });
      } else if (kind === 'external') {
        items.push({
          label: t('menu.openLinkInBrowser'),
          click: () => void shell.openExternal(link),
        });
      }
      if (kind !== 'blocked') {
        items.push({ label: t('menu.copyLinkAddress'), click: () => clipboard.writeText(link) });
      }
      separate();
    }

    const flags = params.editFlags;
    if (params.isEditable) {
      items.push(
        { label: t('menu.cut'), enabled: flags.canCut, click: () => contents.cut() },
        { label: t('menu.copy'), enabled: flags.canCopy, click: () => contents.copy() },
        { label: t('menu.paste'), enabled: flags.canPaste, click: () => contents.paste() },
        { type: 'separator' },
        {
          label: t('menu.selectAll'),
          enabled: flags.canSelectAll,
          click: () => contents.selectAll(),
        },
      );
    } else if (params.selectionText.trim() !== '') {
      items.push({ label: t('menu.copy'), click: () => contents.copy() });
    } else if (!link) {
      const history = contents.navigationHistory;
      items.push(
        { label: t('menu.back'), enabled: history.canGoBack(), click: () => history.goBack() },
        {
          label: t('menu.forward'),
          enabled: history.canGoForward(),
          click: () => history.goForward(),
        },
        { label: t('menu.reload'), click: () => contents.reload() },
      );
    }
    if (items.at(-1)?.type === 'separator') items.pop();
    this.popup(items);
  }
}
