import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalRows: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
}

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100, 200, 500];

export default function Pagination({
  currentPage,
  totalRows,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const [pageInput, setPageInput] = useState(String(currentPage));

  // Sync the input field when currentPage changes externally (e.g. reset to 1)
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitPageInput();
    }
  };

  const handlePageInputBlur = () => {
    commitPageInput();
  };

  const commitPageInput = () => {
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      onPageChange(parsed);
    } else {
      // Reset to current page if invalid
      setPageInput(String(currentPage));
    }
  };

  const goToPrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const goToNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  const startRow = (currentPage - 1) * rowsPerPage + 1;
  const endRow = Math.min(currentPage * rowsPerPage, totalRows);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-sidebar)] text-xs select-none shrink-0">
      {/* Left: showing range */}
      <span className="text-[var(--text-muted)] font-medium hidden sm:inline">
        Showing {totalRows > 0 ? startRow.toLocaleString() : 0}–{endRow.toLocaleString()} of {totalRows.toLocaleString()}
      </span>

      {/* Center: page navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={goToPrev}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-medium">
          <span>Page</span>
          <input
            type="text"
            value={pageInput}
            onChange={handlePageInputChange}
            onKeyDown={handlePageInputSubmit}
            onBlur={handlePageInputBlur}
            className="w-12 text-center bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg py-1 px-1.5 text-xs text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary-500 transition-colors"
            aria-label="Page number"
          />
          <span>of {totalPages.toLocaleString()}</span>
        </div>

        <button
          onClick={goToNext}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: rows per page + total count */}
      <div className="flex items-center gap-3">
        <select
          value={rowsPerPage}
          onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
          className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg py-1 px-2 text-xs text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary-500 transition-colors cursor-pointer"
          aria-label="Rows per page"
        >
          {ROWS_PER_PAGE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt} rows</option>
          ))}
        </select>

        <span className="text-[var(--text-muted)] font-medium">
          {totalRows.toLocaleString()} records
        </span>
      </div>
    </div>
  );
}
