import React, { useState } from 'react';
import { 
    Copy, 
    Check, 
    ChevronUp, 
    ChevronDown, 
    ArrowUpDown, 
    Clock, 
    Info, 
    Inbox 
} from 'lucide-react';
import { Skeleton, Pagination } from '@mui/material';
import StatusBadge from './StatusBadge';
import StatusCodeChip from './StatusCodeChip';

export default function LogsTable({
    logs = [],
    total = 0,
    pageNumber = 1,
    pageSize = 20,
    sortBy = 'Date',
    sortOrder = 'DESC',
    loading = false,
    onSortChange,
    onPageChange,
    onRowClick,
}) {
    const [copiedIndex, setCopiedIndex] = useState(null);

    const handleCopy = (e, text, idx) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex(null), 1800);
    };

    const handleSort = (column) => {
        if (sortBy === column) {
            onSortChange(column, sortOrder === 'ASC' ? 'DESC' : 'ASC');
        } else {
            onSortChange(column, 'ASC');
        }
    };

    const totalPages = Math.ceil(total / pageSize) || 1;

    return (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            {/* Table wrapper with horizontal and vertical scroll */}
            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/90 backdrop-blur sticky top-0 border-b border-slate-200 z-10">
                        <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            {/* 1. Date */}
                            <th 
                                onClick={() => handleSort('Date')}
                                className="px-4 py-3 cursor-pointer hover:text-slate-900 transition-colors select-none"
                            >
                                <div className="flex items-center gap-1">
                                    <span>Date</span>
                                    {sortBy === 'Date' ? (
                                        sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                                    )}
                                </div>
                            </th>

                            {/* 2. Page */}
                            <th 
                                onClick={() => handleSort('Page')}
                                className="px-4 py-3 cursor-pointer hover:text-slate-900 transition-colors select-none"
                            >
                                <div className="flex items-center gap-1">
                                    <span>Page</span>
                                    {sortBy === 'Page' ? (
                                        sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                                    )}
                                </div>
                            </th>

                            {/* 3. Segment */}
                            <th 
                                onClick={() => handleSort('segment')}
                                className="px-4 py-3 cursor-pointer hover:text-slate-900 transition-colors select-none"
                            >
                                <div className="flex items-center gap-1">
                                    <span>Segment</span>
                                    {sortBy === 'segment' ? (
                                        sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                                    )}
                                </div>
                            </th>

                            {/* 4. API Path */}
                            <th 
                                onClick={() => handleSort('api')}
                                className="px-4 py-3 cursor-pointer hover:text-slate-900 transition-colors select-none min-w-[280px]"
                            >
                                <div className="flex items-center gap-1">
                                    <span>API Endpoint</span>
                                    {sortBy === 'api' ? (
                                        sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                                    )}
                                </div>
                            </th>

                            {/* 5. Status Code */}
                            <th 
                                onClick={() => handleSort('status_code')}
                                className="px-4 py-3 cursor-pointer hover:text-slate-900 transition-colors select-none text-center"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <span>Status Code</span>
                                    {sortBy === 'status_code' ? (
                                        sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                                    )}
                                </div>
                            </th>

                            {/* 6. Response Status */}
                            <th 
                                onClick={() => handleSort('response_status')}
                                className="px-4 py-3 cursor-pointer hover:text-slate-900 transition-colors select-none text-center"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <span>Response Status</span>
                                    {sortBy === 'response_status' ? (
                                        sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                                    )}
                                </div>
                            </th>

                            {/* 7. Response Time */}
                            <th 
                                onClick={() => handleSort('response_time_ms')}
                                className="px-4 py-3 cursor-pointer hover:text-slate-900 transition-colors select-none text-right"
                            >
                                <div className="flex items-center justify-end gap-1">
                                    <span>Latency</span>
                                    {sortBy === 'response_time_ms' ? (
                                        sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                                    )}
                                </div>
                            </th>

                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {loading ? (
                            Array.from({ length: 8 }).map((_, idx) => (
                                <tr key={idx} className="animate-pulse">
                                    <td className="px-4 py-3"><Skeleton variant="text" width={75} /></td>
                                    <td className="px-4 py-3"><Skeleton variant="text" width={95} /></td>
                                    <td className="px-4 py-3"><Skeleton variant="text" width={90} /></td>
                                    <td className="px-4 py-3"><Skeleton variant="text" width={220} /></td>
                                    <td className="px-4 py-3 text-center"><Skeleton variant="rounded" width={45} height={20} className="mx-auto" /></td>
                                    <td className="px-4 py-3 text-center"><Skeleton variant="rounded" width={70} height={20} className="mx-auto" /></td>
                                    <td className="px-4 py-3 text-right"><Skeleton variant="text" width={55} className="ml-auto" /></td>
                                    <td className="px-4 py-3"><Skeleton variant="circular" width={20} height={20} /></td>
                                </tr>
                            ))
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-16 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <Inbox className="w-10 h-10 mb-2 stroke-[1.5]" />
                                        <p className="text-sm font-medium text-slate-600">No logs found</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            No test records match the selected filters or date window.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            logs.map((row, idx) => (
                                <tr 
                                    key={row.id || idx}
                                    onClick={() => onRowClick(row)}
                                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                                >
                                    {/* Date */}
                                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-600">
                                        {row.date}
                                    </td>

                                    {/* Page */}
                                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                                        {row.page}
                                    </td>

                                    {/* Segment */}
                                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                                            {row.segment}
                                        </span>
                                    </td>

                                    {/* API Endpoint Path */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-[11px] text-slate-800 tracking-tight">
                                                {row.api}
                                            </span>
                                            <button
                                                title="Copy API Path"
                                                onClick={(e) => handleCopy(e, row.api, idx)}
                                                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            >
                                                {copiedIndex === idx ? (
                                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </td>

                                    {/* Status Code */}
                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                        <StatusCodeChip code={row.statusCode} />
                                    </td>

                                    {/* Response Status */}
                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                        <StatusBadge status={row.responseStatus} />
                                    </td>

                                    {/* Response Time */}
                                    <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-xs text-slate-600">
                                        <span className={`font-semibold ${row.responseTimeMs > 5000 ? 'text-amber-600' : 'text-slate-700'}`}>
                                            {row.responseTimeMs}
                                        </span>{' '}
                                        ms
                                    </td>

                                    {/* Row action icon */}
                                    <td className="px-4 py-3 text-slate-400 group-hover:text-blue-600 transition-colors text-right">
                                        <Info className="w-4 h-4 inline" />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination footer */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <div>
                    Showing <span className="font-semibold text-slate-700">{logs.length}</span> of{' '}
                    <span className="font-semibold text-slate-700">{total}</span> records
                </div>

                {totalPages > 1 && (
                    <Pagination
                        count={totalPages}
                        page={pageNumber}
                        onChange={(_, newPage) => onPageChange(newPage)}
                        size="small"
                        color="primary"
                        shape="rounded"
                    />
                )}
            </div>
        </div>
    );
}
