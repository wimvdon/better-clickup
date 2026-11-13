import {
  Button,
  Spinner,
  makeStyles,
  mergeClasses,
  tokens,
  typographyStyles,
} from '@fluentui/react-components';
import {
  Add20Regular,
  ArrowClockwise20Regular,
  ArrowLeft20Regular,
  ArrowRight20Regular,
  Dismiss12Regular,
  WeatherMoon16Regular,
} from '@fluentui/react-icons';
import { useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { Translate } from '../../../shared/i18n';
import { TAB_BAR_HEIGHT, type TabView, type TabsView } from '../../../shared/ipc';

// Windows' own -webkit-app-region: the empty parts of the bar move the window, like a title bar.
const drag = { WebkitAppRegion: 'drag' } as const;
const noDrag = { WebkitAppRegion: 'no-drag' } as const;

const useStyles = makeStyles({
  bar: {
    ...drag,
    height: `${TAB_BAR_HEIGHT}px`,
    // Leaves room for Windows' minimise/maximise/close buttons on the right.
    width: 'env(titlebar-area-width, 100%)',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground3,
    userSelect: 'none',
  },
  // Windows 11 draws its Mica material behind the bar.
  mica: { backgroundColor: 'transparent' },
  nav: { ...noDrag, display: 'flex' },
  tabs: {
    flex: '0 1 auto',
    display: 'flex',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    minWidth: 0,
    paddingTop: tokens.spacingVerticalXS,
    gap: '2px',
  },
  tab: {
    ...noDrag,
    // A fixed preferred width (not flex-basis), so tabs only shrink when the bar is full.
    width: '220px',
    flexShrink: 1,
    minWidth: '56px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: `${tokens.borderRadiusMedium} ${tokens.borderRadiusMedium} 0 0`,
    color: tokens.colorNeutralForeground2,
    ':hover': { backgroundColor: tokens.colorSubtleBackgroundHover },
  },
  active: {
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    ':hover': { backgroundColor: tokens.colorNeutralBackground1 },
  },
  asleep: { color: tokens.colorNeutralForeground3 },
  dropTarget: { boxShadow: `inset 2px 0 0 ${tokens.colorBrandStroke1}` },
  label: {
    ...typographyStyles.caption1,
    flex: 1,
    minWidth: 0,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: `0 ${tokens.spacingHorizontalXS} 0 ${tokens.spacingHorizontalS}`,
    border: 'none',
    background: 'none',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    cursor: 'default',
    outlineOffset: '-2px',
  },
  title: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  icon: { flexShrink: 0, display: 'flex', width: '16px', justifyContent: 'center' },
  close: { ...noDrag, flexShrink: 0, marginRight: '2px' },
  add: { ...noDrag, flexShrink: 0 },
});

interface Props {
  tabs: TabsView | null;
  t: Translate;
  mica: boolean;
}

export function TabBar({ tabs, t, mica }: Props) {
  const styles = useStyles();
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const command = window.api.tabCommand;
  const list = tabs?.tabs ?? [];

  const titleOf = (tab: TabView) => tab.title || t('tabs.untitled');

  // Arrow keys move between tabs (the usual keyboard pattern for tab lists).
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const next = list[(index + offset + list.length) % list.length];
    if (!offset || !next) return;
    event.preventDefault();
    command({ type: 'activate', id: next.id });
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  const onDrop = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (dragId !== null) {
      const from = list.findIndex((tab) => tab.id === dragId);
      command({ type: 'move', id: dragId, index: from < index ? index - 1 : index });
    }
    setDragId(null);
    setDropIndex(null);
  };

  return (
    <header className={mergeClasses(styles.bar, mica && styles.mica)}>
      <div className={styles.nav}>
        <Button
          appearance="subtle"
          icon={<ArrowLeft20Regular />}
          aria-label={t('nav.back')}
          title={t('nav.back')}
          disabled={!tabs?.canGoBack}
          onClick={() => command({ type: 'back' })}
        />
        <Button
          appearance="subtle"
          icon={<ArrowRight20Regular />}
          aria-label={t('nav.forward')}
          title={t('nav.forward')}
          disabled={!tabs?.canGoForward}
          onClick={() => command({ type: 'forward' })}
        />
        <Button
          appearance="subtle"
          icon={<ArrowClockwise20Regular />}
          aria-label={t('nav.reload')}
          title={t('nav.reload')}
          onClick={() => command({ type: 'reload' })}
        />
      </div>

      <div className={styles.tabs} role="tablist" aria-label={t('tabs.list')}>
        {list.map((tab, index) => {
          const active = tab.id === tabs?.activeId;
          const title = titleOf(tab);
          return (
            <div
              key={tab.id}
              className={mergeClasses(
                styles.tab,
                active && styles.active,
                tab.asleep && styles.asleep,
                dropIndex === index && styles.dropTarget,
              )}
              draggable
              onDragStart={() => setDragId(tab.id)}
              onDragEnd={() => {
                setDragId(null);
                setDropIndex(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDropIndex(index);
              }}
              onDrop={(event) => onDrop(event, index)}
              onContextMenu={(event: MouseEvent) => {
                event.preventDefault();
                command({ type: 'menu', id: tab.id });
              }}
              onAuxClick={(event: MouseEvent) => {
                if (event.button === 1) command({ type: 'close', id: tab.id });
              }}
            >
              <button
                id={`tab-${tab.id}`}
                className={styles.label}
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                title={tab.asleep ? t('tabs.asleep', { title }) : title}
                onClick={() => command({ type: 'activate', id: tab.id })}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <span className={styles.icon}>
                  {tab.loading ? (
                    <Spinner size="extra-tiny" aria-label={t('tabs.loading')} />
                  ) : tab.asleep ? (
                    <WeatherMoon16Regular />
                  ) : null}
                </span>
                <span className={styles.title}>{title}</span>
              </button>
              <Button
                className={styles.close}
                appearance="subtle"
                size="small"
                icon={<Dismiss12Regular />}
                aria-label={t('tabs.close', { title })}
                title={t('tabs.close', { title })}
                tabIndex={active ? 0 : -1}
                onClick={() => command({ type: 'close', id: tab.id })}
              />
            </div>
          );
        })}
      </div>
      <Button
        className={styles.add}
        appearance="subtle"
        icon={<Add20Regular />}
        aria-label={t('tabs.new')}
        title={t('tabs.new')}
        onClick={() => command({ type: 'new' })}
      />
    </header>
  );
}
