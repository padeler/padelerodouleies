import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GamesHub } from './GamesHub';
import { useI18nStore } from '../../../i18n/store';

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'games.title': { el: 'Παιχνίδια', en: 'Games' },
  'games.play': { el: 'Παίξε', en: 'Play' },
  'games.memory.title': { el: 'Παιχνίδι Μνήμης', en: 'Memory Match' },
  'games.memory.desc': { el: '…', en: 'Flip the cards and find all the pairs!' },
  'games.simon.title': { el: 'Σάιμον', en: 'Simon' },
  'games.simon.desc': { el: '…', en: 'Remember and repeat the color sequence!' },
  'games.catcher.title': { el: 'Πιάσε τα Αστέρια', en: 'Star Catcher' },
  'games.catcher.desc': { el: '…', en: 'Catch the falling stars with the basket!' },
};

beforeAll(() => {
  useI18nStore.getState().setTranslations(TRANSLATIONS);
  useI18nStore.getState().setLocale('en');
});

function renderHub() {
  render(
    <MemoryRouter initialEntries={['/dashboard/games']}>
      <Routes>
        <Route path="/dashboard/games" element={<GamesHub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GamesHub', () => {
  it('renders a card per game linking to its route', () => {
    renderHub();
    const memory = screen.getByRole('link', { name: /Memory Match/ });
    const simon = screen.getByRole('link', { name: /Simon/ });
    const catcher = screen.getByRole('link', { name: /Star Catcher/ });
    expect(memory).toHaveAttribute('href', '/dashboard/games/memory');
    expect(simon).toHaveAttribute('href', '/dashboard/games/simon');
    expect(catcher).toHaveAttribute('href', '/dashboard/games/catcher');
  });

  it('shows the localized hub title', () => {
    renderHub();
    expect(screen.getByText(/Games/)).toBeInTheDocument();
  });
});
