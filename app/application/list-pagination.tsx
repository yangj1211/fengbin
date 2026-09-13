'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

const pageSizes = Array.from({ length: 10 }, (_, index) => (index + 1) * 10);

export function getPageRange(total: number, page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.min(page, pageCount));
  const offset = (currentPage - 1) * pageSize;
  return {
    pageCount,
    currentPage,
    offset,
    from: total ? offset + 1 : 0,
    to: Math.min(offset + pageSize, total),
  };
}

function visiblePageNumbers(
  current: number,
  total: number,
): (number | 'start-gap' | 'end-gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(2, Math.min(current - 1, total - 3));
  const end = Math.min(total - 1, Math.max(current + 1, 4));
  const pages: (number | 'start-gap' | 'end-gap')[] = [1];
  if (start > 2) pages.push('start-gap');
  for (let page = start; page <= end; page++) pages.push(page);
  if (end < total - 1) pages.push('end-gap');
  pages.push(total);
  return pages;
}

export default function ListPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  controls,
  label,
  sizeLabel = '每页条数',
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  controls: string;
  label: string;
  sizeLabel?: string;
}) {
  const { currentPage, pageCount, from, to } = getPageRange(
    total,
    page,
    pageSize,
  );
  return (
    <Pagination className="list-pagination" aria-label={label}>
      <p
        className="list-pagination-summary"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {total ? `显示第 ${from}~${to} 条 / 共 ${total} 条` : '共 0 条'}
      </p>
      <div className="list-pagination-controls">
        <PaginationContent className="list-page-links">
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              aria-label="上一页"
              aria-controls={controls}
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft size={17} />
            </Button>
          </PaginationItem>
          {visiblePageNumbers(currentPage, pageCount).map((number) => (
            <PaginationItem key={number}>
              {typeof number === 'number' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`第 ${number} 页`}
                  aria-current={number === currentPage ? 'page' : undefined}
                  aria-controls={controls}
                  disabled={total === 0}
                  onClick={() => onPageChange(number)}
                >
                  {number}
                </Button>
              ) : (
                <PaginationEllipsis />
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              aria-label="下一页"
              aria-controls={controls}
              disabled={currentPage === pageCount}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <ChevronRight size={17} />
            </Button>
          </PaginationItem>
        </PaginationContent>
        <Select
          value={pageSize}
          items={pageSizes.map((size) => ({
            label: `${size} 条/页`,
            value: size,
          }))}
          onValueChange={(size) => {
            if (typeof size !== 'number' || !pageSizes.includes(size)) return;
            onPageSizeChange(size);
            onPageChange(1);
          }}
        >
          <SelectTrigger aria-label={sizeLabel} aria-controls={controls}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {pageSizes.map((size) => (
              <SelectItem key={size} value={size}>
                {size} 条/页
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Pagination>
  );
}
