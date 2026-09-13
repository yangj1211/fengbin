'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function useChartWindow<T>(
  items: T[],
  pageSize: number,
  keyOf: (item: T) => string,
) {
  const key = JSON.stringify(items.map(keyOf));
  const [position, setPosition] = useState({ key, page: 1 });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(position.key === key ? position.page : 1, pageCount);
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    page,
    pageCount,
    total: items.length,
    from: items.length ? offset + 1 : 0,
    to: Math.min(offset + pageSize, items.length),
    setPage: (next: number) =>
      setPosition({ key, page: Math.max(1, Math.min(next, pageCount)) }),
  };
}

export function ChartWindowControls({
  window,
  label,
}: {
  window: Omit<ReturnType<typeof useChartWindow>, 'items'>;
  label: string;
}) {
  if (window.pageCount <= 1) return null;
  return (
    <nav className="chart-window-controls" aria-label={`${label}分段浏览`}>
      <output aria-live="polite" aria-atomic="true">
        第 {window.from}–{window.to} 项 / 共 {window.total} 项
      </output>
      <div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="上一组"
          disabled={window.page === 1}
          onClick={() => window.setPage(window.page - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="下一组"
          disabled={window.page === window.pageCount}
          onClick={() => window.setPage(window.page + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </nav>
  );
}

export function shortChartLabel(value: string) {
  const characters = Array.from(String(value));
  return characters.length > 6 ? `${characters.slice(0, 5).join('')}…` : value;
}
