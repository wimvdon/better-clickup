import {
  Body1,
  Button,
  Caption1,
  FluentProvider,
  LargeTitle,
  Subtitle2,
  makeStyles,
  tokens,
  webDarkTheme,
  webLightTheme,
} from '@fluentui/react-components';
import { useEffect, useMemo, useState } from 'react';
import { createCounter, increment, reset } from '../../shared/counter';
import { createTranslator, pickLanguage } from '../../shared/i18n';
import { useAppInfo } from './hooks/useAppInfo';
import { useSystemDarkMode } from './hooks/useSystemDarkMode';

const useStyles = makeStyles({
  page: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalXXL,
    textAlign: 'center',
  },
  buttons: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
  },
  footer: {
    padding: tokens.spacingHorizontalM,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
});

export function App() {
  const styles = useStyles();
  const dark = useSystemDarkMode();
  const info = useAppInfo();
  const [counter, setCounter] = useState(createCounter);

  const language = pickLanguage(info?.languages ?? navigator.languages);
  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
    // The window title is the app's name from package.json ("<App> Dev" for dev builds).
    if (info) document.title = info.name;
  }, [language, info]);

  return (
    <FluentProvider theme={dark ? webDarkTheme : webLightTheme} className={styles.page}>
      <main className={styles.content}>
        <LargeTitle as="h1">{t('home.heading')}</LargeTitle>
        <Body1>{t('home.body')}</Body1>
        <Subtitle2 role="status">{t('home.clickCount', { count: counter.count })}</Subtitle2>
        <div className={styles.buttons}>
          <Button appearance="primary" onClick={() => setCounter(increment)}>
            {t('home.clickButton')}
          </Button>
          <Button onClick={() => setCounter(reset())}>{t('home.resetButton')}</Button>
        </div>
      </main>
      <footer className={styles.footer}>
        <Caption1>{info ? t('footer.version', { version: info.version }) : ' '}</Caption1>
      </footer>
    </FluentProvider>
  );
}
