import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getIconCatalog } from '../api/client';
import type { IconCatalogItem } from '../lib/types';
import { normalizeSearchTerm } from '../lib/search';
import { useT } from '../i18n/store';
import './IconPicker.css';

const categoryKeyMap: Record<string, string> = {
  hygiene: 'icon_picker.category_hygiene',
  meals: 'icon_picker.category_meals',
  tidying: 'icon_picker.category_tidying',
  school: 'icon_picker.category_school',
  pets: 'icon_picker.category_pets',
  avatars: 'icon_picker.category_avatars',
  parent: 'icon_picker.category_parent',
  rewards: 'icon_picker.category_rewards',
};

interface IconPickerProps {
  selected?: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ selected, onChange }: IconPickerProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: catalog = [] } = useQuery({
    queryKey: ['icon-catalog'],
    queryFn: getIconCatalog,
    staleTime: 300_000,
  });

  const categories = useMemo(() => {
    const set = new Set(catalog.map((i: IconCatalogItem) => i.category));
    return Array.from(set);
  }, [catalog]);

  const filtered = useMemo(() => {
    let items = catalog as IconCatalogItem[];
    if (selectedCategory) {
      items = items.filter((i) => i.category === selectedCategory);
    }
    if (query.trim()) {
      const nq = normalizeSearchTerm(query);
      items = items.filter((i) => {
        const allKeywords = [...i.keywords_en, ...i.keywords_el];
        return allKeywords.some((kw) => normalizeSearchTerm(kw).includes(nq));
      });
    }
    return items;
  }, [catalog, query, selectedCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, IconCatalogItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="icon-picker">
      <input
        type="text"
        className="icon-picker-search"
        placeholder={t('icon_picker.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="icon-picker-chips">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`icon-picker-chip ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
          >
            {categoryKeyMap[cat] ? t(categoryKeyMap[cat]) : cat}
          </button>
        ))}
      </div>
      <div className="icon-picker-grid">
        {Array.from(grouped.entries()).map(([cat, icons]) => (
          <div key={cat} className="icon-picker-group">
            <div className="icon-picker-group-title">
              {categoryKeyMap[cat] ? t(categoryKeyMap[cat]) : cat}
            </div>
            <div className="icon-picker-icons">
              {icons.map((icon) => (
                <button
                  key={icon.name}
                  type="button"
                  className={`icon-picker-tile ${selected === icon.name ? 'selected' : ''}`}
                  onClick={() => onChange(icon.name)}
                  title={icon.name}
                >
                  <img loading="lazy" decoding="async" src={`/api/icons/svg/${icon.name}`} alt={icon.name} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
