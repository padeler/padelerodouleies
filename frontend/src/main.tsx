import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { getTranslations } from './api/client';
import { useI18nStore } from './i18n/store';
import { useAuthStore } from './state/authStore';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
    },
  },
});

function applyTheme(theme: string) {
  const html = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  html.setAttribute('data-theme', effective);
  console.log('[Theme] applied data-theme:', effective, '(preferred:', theme + ')');
}

function ThemeWatcher() {
  const user = useAuthStore((s) => s.user);
  const theme = user?.preferred_theme ?? 'system';

  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return null;
}

function Boot() {
  const setTranslations = useI18nStore((s) => s.setTranslations);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log('[Boot] loading translations...');
    getTranslations()
      .then((t) => {
        console.log('[Boot] translations loaded:', Object.keys(t).length, 'keys');
        setTranslations(t);
        setReady(true);
      })
      .catch((err) => {
        console.error('[Boot] failed to load translations:', err);
        setReady(true); // render anyway so auth guard can run
      });
  }, [setTranslations]);

  if (!ready) {
    return <div className="loading">Loading…</div>;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <ThemeWatcher />
      <Boot />
    </QueryClientProvider>
  </StrictMode>,
);
