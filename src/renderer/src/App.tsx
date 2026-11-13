import {
  FluentProvider,
  makeStyles,
  webDarkTheme,
  webLightTheme,
} from '@fluentui/react-components';
import { useEffect, useMemo } from 'react';
import { createTranslator, pickLanguage } from '../../shared/i18n';
import { TabBar } from './components/TabBar';
import { useAppInfo } from './hooks/useAppInfo';
import { useSystemDarkMode } from './hooks/useSystemDarkMode';
import { useTabs } from './hooks/useTabs';

const useStyles = makeStyles({
  page: { height: '100%', backgroundColor: 'transparent' },
});

/**
 * The app's own UI is only the tab bar at the top of the window. The ClickUp pages are drawn
 * by the main process below it (src/main/tabs.ts).
 */
export function App() {
  const styles = useStyles();
  const dark = useSystemDarkMode();
  const info = useAppInfo();
  const tabs = useTabs();

  const language = pickLanguage(info?.languages ?? navigator.languages);
  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
    // The window title is the app's name from package.json ("<App> Dev" for dev builds).
    if (info) document.title = info.name;
  }, [language, info]);

  return (
    <FluentProvider theme={dark ? webDarkTheme : webLightTheme} className={styles.page}>
      <TabBar tabs={tabs} t={t} mica={info?.mica ?? false} />
    </FluentProvider>
  );
}
