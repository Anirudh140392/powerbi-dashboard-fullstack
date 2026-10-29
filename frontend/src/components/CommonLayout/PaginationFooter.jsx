import React from 'react';
import { ChevronRight } from 'lucide-react';

const PaginationFooter = ({
    isVisible,
    currentPage,
    totalPages,
    onPageChange,
    pageSize,
    onPageSizeChange,
    pageSizeOptions = [5, 10, 20, 50],
    itemsLabel = "Rows/page",
}) => {
    if (isVisible === false) return null;

    return (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-2">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
                >
                    Prev
                </button>
                <span className="text-xs font-medium text-slate-600">
                    Page {currentPage} / {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
                >
                    Next
                </button>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-slate-400">{itemsLabel}</span>
                <select
                    className="h-6 rounded border border-slate-200 bg-white text-xs text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                >
                    {pageSizeOptions.map((size) => (
                        <option key={size} value={size}>
                            {size}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default PaginationFooter;
