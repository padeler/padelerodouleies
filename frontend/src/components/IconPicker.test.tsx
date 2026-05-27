import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { IconPicker } from './IconPicker';
import { useI18nStore } from '../i18n/store';

const server = setupServer(
  http.get('/api/icons/catalog', async () => {
    return HttpResponse.json([
      { name: 'tooth', category: 'hygiene', svg_ref: 'icons/svg/tooth.svg', keywords_en: ['tooth', 'teeth', 'brush'], keywords_el: ['δόντι', 'δόντια', 'βούρτσισμα'] },
      { name: 'star', category: 'rewards', svg_ref: 'icons/svg/star.svg', keywords_en: ['star', 'points', 'reward'], keywords_el: ['άστρο', 'πόντοι', 'βραβείο'] },
      { name: 'shield', category: 'parent', svg_ref: 'icons/svg/shield.svg', keywords_en: ['shield', 'admin'], keywords_el: ['στούπενο', 'διοίκηση'] },
      { name: 'fox', category: 'avatars', svg_ref: 'icons/svg/fox.svg', keywords_en: ['fox', 'animal'], keywords_el: ['αλεπού', 'ζώο'] },
    ]);
  }),
);

function renderIconPicker() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChange = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <IconPicker onChange={onChange} />
    </QueryClientProvider>,
  );
  return { onChange };
}

beforeAll(() => {
  server.listen();
  // Seed i18n store so t() doesn't throw
  useI18nStore.getState().setTranslations({
    'icon_picker.search': { el: 'Αναζήτηση', en: 'Search' },
    'icon_picker.category_hygiene': { el: 'Υγιεινή', en: 'Hygiene' },
    'icon_picker.category_meals': { el: 'Γεύματα', en: 'Meals' },
    'icon_picker.category_tidying': { el: 'Τακτοποίηση', en: 'Tidying' },
    'icon_picker.category_school': { el: 'Σχολείο', en: 'School' },
    'icon_picker.category_pets': { el: 'Ζώα', en: 'Pets' },
    'icon_picker.category_avatars': { el: 'Προφίλ', en: 'Avatars' },
    'icon_picker.category_parent': { el: 'Γονείς', en: 'Parent' },
    'icon_picker.category_rewards': { el: 'Βραβεία', en: 'Rewards' },
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('IconPicker', () => {
  it('renders search input', async () => {
    renderIconPicker();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Αναζήτηση')).toBeInTheDocument();
    });
  });

  it('renders category chips', async () => {
    renderIconPicker();
    await waitFor(() => {
      const chips = document.querySelectorAll('.icon-picker-chip');
      expect(chips.length).toBeGreaterThan(0);
    });
    // Verify a chip contains expected category label
    const chipTexts = Array.from(document.querySelectorAll('.icon-picker-chip')).map(c => c.textContent);
    expect(chipTexts).toContain('Υγιεινή');
  });

  it('filters icons by search term', async () => {
    renderIconPicker();
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Αναζήτηση');
      fireEvent.change(input, { target: { value: 'tooth' } });
    });
    // Should show only hygiene group with tooth icon
    await waitFor(() => {
      const tiles = document.querySelectorAll('.icon-picker-tile');
      expect(tiles.length).toBe(1);
    });
  });

  it('filters icons by Greek search term without accents', async () => {
    renderIconPicker();
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Αναζήτηση');
      fireEvent.change(input, { target: { value: 'δοντι' } });
    });
    await waitFor(() => {
      const tiles = document.querySelectorAll('.icon-picker-tile');
      expect(tiles.length).toBe(1);
    });
  });

  it('calls onChange when icon is selected', async () => {
    const { onChange } = renderIconPicker();
    await waitFor(() => {
      const tiles = document.querySelectorAll('.icon-picker-tile');
      expect(tiles.length).toBeGreaterThan(0);
      fireEvent.click(tiles[0]);
    });
    expect(onChange).toHaveBeenCalled();
  });

  it('shows selected state on tile', async () => {
    const onChange = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <IconPicker onChange={onChange} selected="tooth" />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      const tiles = document.querySelectorAll('.icon-picker-tile');
      expect(tiles.length).toBeGreaterThan(0);
    });
    const selected = document.querySelector('.icon-picker-tile.selected');
    expect(selected).toBeInTheDocument();
    expect(selected).toHaveAttribute('title', 'tooth');
  });
});
