import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { detectLocale, translate, type Locale, type MessageKey } from '../i18n';
import { Home } from './Home';
// Editor (Karte, Export-Engine) erst bei Bedarf laden – kleinerer Start-Download.
const Editor = lazy(() => import('./Editor').then((m) => ({ default: m.Editor })));

interface I18nCtx {
  locale: Locale;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  setLocale: (l: Locale) => void;
}
const I18n = createContext<I18nCtx>(null!);
export const useI18n = () => useContext(I18n);

const LOCALE_KEY = 'arc.locale';

export function App() {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const s = localStorage.getItem(LOCALE_KEY);
      if (s === 'de' || s === 'en') return s;
    } catch { /* ignore */ }
    return detectLocale();
  });
  const [route, setRoute] = useState<{ screen: 'home' } | { screen: 'editor'; projectId: string }>(() => {
    const m = location.hash.match(/^#\/p\/([0-9a-f-]{36})$/);
    return m ? { screen: 'editor', projectId: m[1]! } : { screen: 'home' };
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* ignore */ }
  }, [locale]);

  useEffect(() => {
    const onHash = () => {
      const m = location.hash.match(/^#\/p\/([0-9a-f-]{36})$/);
      setRoute(m ? { screen: 'editor', projectId: m[1]! } : { screen: 'home' });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const t = useCallback((key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params), [locale]);
  const ctx = useMemo(() => ({ locale, t, setLocale: setLocaleState }), [locale, t]);

  return (
    <I18n.Provider value={ctx}>
      {route.screen === 'home' ? (
        <Home open={(id) => (location.hash = `#/p/${id}`)} />
      ) : (
        <Suspense fallback={<div className="screen center" aria-busy="true">…</div>}>
          <Editor key={route.projectId} projectId={route.projectId} close={() => (location.hash = '')} />
        </Suspense>
      )}
    </I18n.Provider>
  );
}
