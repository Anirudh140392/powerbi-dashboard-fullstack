import React, { useState, useRef, useEffect } from 'react';
import { 
    Search, 
    X, 
    RotateCcw, 
    Calendar, 
    Layers, 
    LayoutGrid, 
    Filter,
    ChevronDown,
    Check,
    Database
} from 'lucide-react';

/**
 * Custom Dropdown Select Component that ALWAYS opens downwards,
 * supports searchable filtering, clean scrolling, and click-outside dismissal.
 */
function CustomDropdown({
    label,
    icon: Icon,
    value,
    options = [],
    allLabel = 'All',
    onChange,
    searchable = false,
    placeholder = 'Select...',
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen]);

    // Format display label
    const isAllSelected = !value || value === '' || value === 'All';
    const displayLabel = isAllSelected ? allLabel : value;

    // Filtered options based on search query
    const filteredOptions = searchable && searchQuery.trim()
        ? options.filter((opt) => String(opt).toLowerCase().includes(searchQuery.toLowerCase()))
        : options;

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
                {label}
            </label>

            <button
                type="button"
                onClick={() => {
                    setIsOpen((prev) => !prev);
                    setSearchQuery('');
                }}
                className={`w-full flex items-center justify-between text-xs font-medium bg-slate-50 border rounded-lg px-3 py-2 text-slate-700 transition-all text-left ${
                    isOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                }`}
            >
                <span className={`truncate mr-2 ${isAllSelected ? 'text-slate-600' : 'text-slate-900 font-semibold'}`}>
                    {displayLabel}
                </span>
                <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                    }`}
                />
            </button>

            {/* Dropdown Menu: explicitly positioned top-full to ALWAYS drop downwards */}
            {isOpen && (
                <div
                    className="absolute top-full left-0 mt-1.5 w-full min-w-[210px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden"
                    style={{ maxHeight: '300px' }}
                >
                    {/* Optional Search Input */}
                    {searchable && options.length > 5 && (
                        <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                            <div className="relative">
                                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder={placeholder === 'Select...' ? 'Search...' : placeholder}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full text-xs pl-7 pr-6 py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Options List */}
                    <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
                        {/* Default "All" option */}
                        <button
                            type="button"
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                                isAllSelected
                                    ? 'bg-blue-50 text-blue-700 font-semibold'
                                    : 'text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <span>{allLabel}</span>
                            {isAllSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        </button>

                        {/* Filtered items */}
                        {filteredOptions.map((opt) => {
                            const isSelected = value === opt;
                            return (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                                        isSelected
                                            ? 'bg-blue-50 text-blue-700 font-semibold'
                                            : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="truncate mr-2">{opt}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                </button>
                            );
                        })}

                        {filteredOptions.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-400 text-center italic">
                                No matching options
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* 1. Date Selector Dropdown */}
                <CustomDropdown
                    label="Run Date"
                    icon={Calendar}
                    value={filters.date || ''}
                    options={availableOptions.dates || []}
                    allLabel="All Dates"
                    onChange={(val) => onChange({ ...filters, date: val })}
                />

                {/* 2. Client DB Selector Dropdown */}
                <CustomDropdown
                    label="Client DB"
                    icon={Database}
                    value={filters.clientDb || ''}
                    options={availableOptions.clients || []}
                    allLabel="All Clients"
                    searchable={true}
                    placeholder="Search client (e.g. boat)..."
                    onChange={(val) => onChange({ ...filters, clientDb: val })}
                />

                {/* 3. Page Dropdown (Custom downward dropdown with search) */}
                <CustomDropdown
                    label="Page"
                    icon={Layers}
                    value={filters.page || ''}
                    options={availableOptions.pages || []}
                    allLabel="All Pages"
                    searchable={true}
                    onChange={(val) => onChange({ ...filters, page: val })}
                />

                {/* 4. Segment Dropdown */}
                <CustomDropdown
                    label="Segment / Tab"
                    icon={LayoutGrid}
                    value={filters.segment || ''}
                    options={availableOptions.segments || []}
                    allLabel="All Segments"
                    searchable={true}
                    onChange={(val) => onChange({ ...filters, segment: val })}
                />

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

            {/* Status & Empty Response Filter Chips */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                {/* Status Chips */}
                <div className="flex items-center gap-2 flex-wrap">
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

                {/* Empty Response Filter Chips (0 / 1) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-slate-400 mr-1">Empty Response:</span>
                    {[
                        { label: 'All', value: 'All' },
                        { label: '0 (Has Data)', value: '0' },
                        { label: '1 (Empty Body)', value: '1' },
                    ].map((opt) => {
                        const isSelected = (filters.emptyResponse || 'All') === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => onChange({ ...filters, emptyResponse: opt.value })}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                    isSelected
                                        ? opt.value === '1'
                                            ? 'bg-rose-600 text-white font-semibold shadow-xs'
                                            : opt.value === '0'
                                            ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                                            : 'bg-slate-800 text-white font-semibold shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
