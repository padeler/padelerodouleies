import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { getTranslations } from './api/client';
import { useI18nStore } from './i18n/store';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
    },
  },
});

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
      <Boot />
    </QueryClientProvider>
  </StrictMode>,
);
