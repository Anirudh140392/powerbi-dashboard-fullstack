import React from 'react';
import { 
    Search, 
    X, 
    RotateCcw, 
    Calendar, 
    Layers, 
    LayoutGrid, 
    Filter 
} from 'lucide-react';

export default function FiltersBar({
    filters,
    availableOptions,
    onChange,
    onReset,
}) {
    const statuses = ['All', 'Success', 'Slow', 'Failed'];

    return (
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 mb-5 shadow-sm space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <span>Filter & Search</span>
                </div>

                {/* Reset Filters button */}
                <button
                    onClick={onReset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Filters
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Date Selector */}
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Run Date
                    </label>
                    <select
                        value={filters.date || ''}
                        onChange={(e) => onChange({ ...filters, date: e.target.value })}
                        className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                        <option value="">All Dates</option>
                        {availableOptions.dates?.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 2. Page Dropdown */}
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        Page
                    </label>
                    <select
                        value={filters.page || ''}
                        onChange={(e) => onChange({ ...filters, page: e.target.value })}
                        className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                        <option value="">All Pages</option>
                        {availableOptions.pages?.map((p) => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 3. Segment Dropdown */}
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                        <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
                        Segment / Tab
                    </label>
                    <select
                        value={filters.segment || 'All'}
                        onChange={(e) => onChange({ ...filters, segment: e.target.value })}
                        className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                        <option value="All">All Segments</option>
                        {availableOptions.segments?.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 4. API Search Box */}
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        Search Endpoint
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="e.g. /kpis or /discount"
                            value={filters.search || ''}
                            onChange={(e) => onChange({ ...filters, search: e.target.value })}
                            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-2 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        {filters.search && (
                            <button
                                onClick={() => onChange({ ...filters, search: '' })}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Filter Chips */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-400 mr-1">Status:</span>
                {statuses.map((st) => {
                    const isSelected = (filters.status || 'All') === st;
                    return (
                        <button
                            key={st}
                            onClick={() => onChange({ ...filters, status: st })}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                isSelected
                                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                            }`}
                        >
                            {st}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
