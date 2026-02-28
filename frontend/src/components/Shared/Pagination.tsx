/**
 * Pagination Component
 * Büyük veri setleri için sayfalama
 * @example
 *   const [page, setPage] = useState(1);
 *   <Pagination
 *     current={page}
 *     total={245}
 *     pageSize={20}
 *     onChange={setPage}
 *   />
 */

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  current: number; // 1-indexed
  total: number; // Total records
  pageSize: number; // Records per page
  onChange: (page: number) => void;
  maxButtons?: number; // Max page buttons to show (default 5)
}

export const Pagination: React.FC<PaginationProps> = ({
  current,
  total,
  pageSize,
  onChange,
  maxButtons = 5,
}) => {
  const totalPages = Math.ceil(total / pageSize);

  const pages = useMemo(() => {
    const pages: (number | string)[] = [];

    if (totalPages <= maxButtons) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page + ellipsis
      pages.push(1);

      // Calculate range around current page
      const halfMax = Math.floor((maxButtons - 2) / 2);
      const start = Math.max(2, current - halfMax);
      const end = Math.min(totalPages - 1, current + halfMax);

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('...');
      }

      // Show last page
      pages.push(totalPages);
    }

    return pages;
  }, [current, totalPages, maxButtons]);

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onChange(page);
    }
  };

  const startRecord = (current - 1) * pageSize + 1;
  const endRecord = Math.min(current * pageSize, total);

  return (
    <div className="flex flex-col gap-4">
      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {startRecord}-{endRecord} / {total} toplam
        </span>
        <select
          value={pageSize}
          onChange={(_e) => {
            // onChange satıf per page
            // Bu genellikle parent component tarafından handle edilir
          }}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value={10}>10 / sayfa</option>
          <option value={20}>20 / sayfa</option>
          <option value={50}>50 / sayfa</option>
          <option value={100}>100 / sayfa</option>
        </select>
      </div>

      {/* Pagination buttons */}
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => handlePageClick(1)}
          disabled={current === 1}
          className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          title="İlk sayfa"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => handlePageClick(current - 1)}
          disabled={current === 1}
          className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Önceki sayfa"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((page, index) =>
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => handlePageClick(page as number)}
              className={`
                min-w-10 h-10 rounded font-semibold transition-colors
                ${
                  current === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {page}
            </button>
          ),
        )}

        <button
          onClick={() => handlePageClick(current + 1)}
          disabled={current === totalPages}
          className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Sonraki sayfa"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => handlePageClick(totalPages)}
          disabled={current === totalPages}
          className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Son sayfa"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * usePagination Hook
 * Sayfalama state yönetimi
 */
export const usePagination = (initialPage = 1, pageSize = 20) => {
  const [current, setCurrent] = React.useState(initialPage);

  const handlePageChange = (page: number) => {
    setCurrent(page);
    // Sayfaya scroll yap
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { current, setCurrent: handlePageChange, pageSize };
};
