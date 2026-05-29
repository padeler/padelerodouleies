import { useState, useMemo } from 'react';
import { useT } from '../i18n/store';
import './Pagination.css';

export const PAGE_SIZE = 10;

/**
 * Client-side pagination over an in-memory array. Returns the current page's
 * slice plus the controls needed to render <Pagination />. The page index is
 * clamped when the underlying list shrinks (e.g. after a delete).
 */
export function usePagination<T>(items: T[] | undefined, pageSize: number = PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const total = items?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = useMemo(
    () => (items ?? []).slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize],
  );
  return { page: safePage, setPage, pageCount, pageItems, total };
}

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  const t = useT();
  if (pageCount <= 1) return null;
  return (
    <div className="admin-pagination">
      <button className="admin-btn" type="button" disabled={page <= 0} onClick={() => onChange(page - 1)}>
        ‹ {t('pagination.prev')}
      </button>
      <span className="admin-pagination-info">
        {t('pagination.page', { page: String(page + 1), total: String(pageCount) })}
      </span>
      <button className="admin-btn" type="button" disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)}>
        {t('pagination.next')} ›
      </button>
    </div>
  );
}
