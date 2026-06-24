import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { Skeleton } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, BarChart2, ChevronUp, ChevronDown, ChevronsUpDown, X, Check } from 'lucide-react';
import { FilterContext } from '../../utils/FilterContext';
import axiosInstance from '../../api/axiosInstance';
import { cn } from '../../lib/utils';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

const SortIcon = ({ dir }) => {
    if (dir === 'asc')  return <ChevronUp   size={13} className="text-indigo-500" />;
    if (dir === 'desc') return <ChevronDown size={13} className="text-indigo-500" />;
    return <ChevronsUpDown size={13} className="text-slate-300 group-hover/th:text-slate-400 transition-colors" />;
};

const ShareBar = ({ value }) => {
    return (
        <span className="text-[12px] font-semibold text-slate-800 tabular-nums">
            {Number(value).toFixed(2)}%
        </span>
    );
};

// Compact styled custom multiselect dropdown with search
const FilterSelect = ({ label, value = [], options, onChange, color = 'indigo' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    // value is now always an array
    const selected = Array.isArray(value) ? value : (value ? [value] : []);
    const active = selected.length > 0;

    const colors = {
        indigo: 'bg-indigo-50 border-indigo-200/80 text-indigo-700',
        violet: 'bg-violet-50 border-violet-200/80 text-violet-700',
        emerald: 'bg-emerald-50 border-emerald-200/80 text-emerald-700',
        slate: 'bg-slate-50 border-slate-200 text-slate-500',
    };
    const c = active ? colors[color] : colors.slate;
    const ringColor = {
        indigo: 'ring-indigo-200',
        violet: 'ring-violet-200',
        emerald: 'ring-emerald-200',
        slate: 'ring-slate-200',
    };
    const chipBg = {
        indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200/60',
        violet: 'bg-violet-100 text-violet-700 border-violet-200/60',
        emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200/60',
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter options based on search
    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return options;
        return options.filter(o => o.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [options, searchQuery]);

    // Toggle a single option in the selection
    const handleToggle = (val) => {
        if (selected.includes(val)) {
            onChange(selected.filter(v => v !== val));
        } else {
            onChange([...selected, val]);
        }
    };

    // Clear all selections
    const handleClearAll = (e) => {
        if (e) e.stopPropagation();
        onChange([]);
        setSearchQuery('');
    };

    // Select all filtered options
    const handleSelectAll = () => {
        const allFiltered = filteredOptions;
        const newSelected = [...new Set([...selected, ...allFiltered])];
        onChange(newSelected);
    };

    // Deselect all filtered options
    const handleDeselectAll = () => {
        const filteredSet = new Set(filteredOptions);
        onChange(selected.filter(v => !filteredSet.has(v)));
    };

    const allFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(o => selected.includes(o));

    // Display text for the trigger
    const displayText = selected.length === 0
        ? 'All'
        : selected.length === 1
            ? selected[0]
            : `${selected.length} selected`;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* The Trigger Pill */}
            <div 
                className={cn(
                    'flex items-center rounded-xl border transition-all duration-300 ease-out h-[34px] cursor-pointer select-none',
                    c,
                    isOpen ? `ring-2 ring-offset-1 border-transparent ${ringColor[color]}` : 'hover:shadow-sm'
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className={cn(
                    'flex items-center h-full px-3 text-[10px] font-bold uppercase tracking-wider border-r transition-colors rounded-l-xl',
                    active ? 'border-current/15 bg-black/5' : 'border-slate-200 bg-white text-slate-400'
                )}>
                    {label}
                </div>
                
                <div className="relative h-full flex items-center bg-white/50 transition-colors hover:bg-white/80 pr-8 pl-3 min-w-[110px] rounded-r-xl gap-1.5">
                    <span className={cn(
                        'text-[12px] font-semibold truncate max-w-[130px]',
                        active ? 'text-slate-800' : 'text-slate-600'
                    )}>
                        {displayText}
                    </span>
                    
                    {/* Chevron */}
                    <div className="absolute right-2.5 text-slate-400">
                        <ChevronDown size={14} className={cn("transition-transform duration-200", isOpen ? "rotate-180" : "")} />
                    </div>
                    
                    {active && (
                        <button
                            onClick={handleClearAll}
                            className={cn(
                                "absolute right-[22px] h-4 w-4 rounded-full flex items-center justify-center transition-all bg-white shadow-sm border border-black/5 hover:scale-110",
                                `text-${color}-600 hover:text-${color}-700 hover:border-${color}-300`
                            )}
                            title={`Clear ${label} filter`}
                        >
                            <X size={10} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            </div>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute top-[calc(100%+6px)] left-0 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                        {/* Search Input */}
                        <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={`Search ${label}...`}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    className="w-full pl-8 pr-3 py-1.5 text-[12px] font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder-slate-400 text-slate-700"
                                    autoFocus
                                />
                                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                                </svg>
                            </div>
                        </div>

                        {/* Select All / Deselect All */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/30">
                            <button
                                onClick={allFilteredSelected ? handleDeselectAll : handleSelectAll}
                                className={cn(
                                    "text-[11px] font-bold transition-colors",
                                    allFilteredSelected ? "text-rose-500 hover:text-rose-700" : "text-indigo-500 hover:text-indigo-700"
                                )}
                            >
                                {allFilteredSelected ? 'Deselect All' : 'Select All'}
                            </button>
                            {selected.length > 0 && (
                                <span className="text-[10px] font-semibold text-slate-400">
                                    {selected.length} selected
                                </span>
                            )}
                        </div>

                        {/* Options List */}
                        <div className="max-h-56 overflow-y-auto p-1.5 custom-scrollbar">
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-6 text-center text-[12px] text-slate-400 font-medium">
                                    No results found for "{searchQuery}"
                                </div>
                            ) : (
                                filteredOptions.map(o => {
                                    const isSelected = selected.includes(o);
                                    return (
                                        <div
                                            key={o}
                                            onClick={() => handleToggle(o)}
                                            className={cn(
                                                "flex items-center gap-2.5 px-3 py-2 text-[12px] rounded-lg cursor-pointer transition-colors mb-0.5 last:mb-0",
                                                isSelected
                                                    ? `bg-${color}-50 text-${color}-700 font-bold`
                                                    : "text-slate-700 font-medium hover:bg-slate-50"
                                            )}
                                            title={o}
                                        >
                                            {/* Checkbox indicator */}
                                            <div className={cn(
                                                "w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
                                                isSelected
                                                    ? `bg-${color}-500 border-${color}-500`
                                                    : "border-slate-300 bg-white"
                                            )}>
                                                {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                            </div>
                                            <span className="truncate">{o}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const MarketShareShareTable = ({ loading: parentLoading }) => {
    const { platform, selectedCategory, selectedSubCategory, timeStart, timeEnd } = useContext(FilterContext);

    const [tableData,   setTableData]   = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey,     setSortKey]     = useState('categoryShare');
    const [sortDir,     setSortDir]     = useState('desc');

    const [localCategory,    setLocalCategory]    = useState([]);
    const [localSubCategory, setLocalSubCategory] = useState([]);

    // ── Fetch ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchData = async () => {
            setDataLoading(true);
            try {
                const params = {
                    platform:    platform          === 'All' ? undefined : (Array.isArray(platform)          ? platform.join(',')          : platform),
                    category:    selectedCategory  === 'All' ? undefined : (Array.isArray(selectedCategory)  ? selectedCategory.join(',')  : selectedCategory),
                    subCategory: selectedSubCategory === 'All' ? undefined : (Array.isArray(selectedSubCategory) ? selectedSubCategory.join(',') : selectedSubCategory),
                    startDate:   timeStart ? timeStart.format('YYYY-MM-DD') : undefined,
                    endDate:     timeEnd   ? timeEnd.format('YYYY-MM-DD')   : undefined,
                };
                const res = await axiosInstance.get('/market-share/share-table', { params });
                const fetchedData = Array.isArray(res.data?.data) ? res.data.data : [];
                const hardcodedData = fetchedData.filter(r => r.brand && r.brand.toLowerCase() === 'the derma co.');
                setTableData(hardcodedData);
            } catch (err) {
                console.error('[MarketShareShareTable] Fetch error:', err);
                setTableData([]);
            } finally {
                setDataLoading(false);
            }
        };
        fetchData();
        // reset local filters when global filters change
        setLocalCategory([]);
        setLocalSubCategory([]);
    }, [platform, selectedCategory, selectedSubCategory, timeStart, timeEnd]);

    const loading = parentLoading || dataLoading;

    // ── Derive cascaded filter options from raw data ───────────────────────
    const allCategories = useMemo(() =>
        [...new Set(tableData.map(r => r.category).filter(Boolean))].sort(),
        [tableData]
    );

    // sub-categories available under selected category (or all)
    const availableSubCategories = useMemo(() => {
        let base = tableData;
        if (localCategory.length > 0) base = base.filter(r => localCategory.includes(r.category));
        return [...new Set(base.map(r => r.subCategory).filter(Boolean))].sort();
    }, [tableData, localCategory]);

    // reset downstream filters when parent changes
    const handleCategoryChange = (val) => {
        setLocalCategory(val);
        // When category changes, remove any sub-category selections that are no longer valid
        if (val.length > 0) {
            const validSubCats = new Set(
                tableData.filter(r => val.includes(r.category)).map(r => r.subCategory).filter(Boolean)
            );
            setLocalSubCategory(prev => prev.filter(sc => validSubCats.has(sc)));
        } else {
            setLocalSubCategory([]);
        }
        setCurrentPage(1);
    };
    const handleSubCategoryChange = (val) => {
        setLocalSubCategory(val);
        setCurrentPage(1);
    };

    const hasActiveFilters = localCategory.length > 0 || localSubCategory.length > 0;
    const resetAllFilters = () => {
        setLocalCategory([]);
        setLocalSubCategory([]);
        setCurrentPage(1);
    };

    // ── Sort handler ──────────────────────────────────────────────────────
    const handleSort = (key) => {
        setSortKey(prev => {
            if (prev !== key) { setSortDir('desc'); return key; }
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
            return key;
        });
        setCurrentPage(1);
    };

    // ── Filter + Sort pipeline ─────────────────────────────────────────────
    const processedData = useMemo(() => {
        let data = tableData;

        // local section filters (multiselect)
        if (localCategory.length > 0)    data = data.filter(r => localCategory.includes(r.category));
        if (localSubCategory.length > 0) data = data.filter(r => localSubCategory.includes(r.subCategory));

        // search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.filter(r =>
                r.category?.toLowerCase().includes(q) ||
                r.brand?.toLowerCase().includes(q)    ||
                r.subCategory?.toLowerCase().includes(q)
            );
        }

        // sort
        if (sortKey) {
            data = [...data].sort((a, b) => {
                const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
                return sortDir === 'asc' ? va - vb : vb - va;
            });
        }
        return data;
    }, [tableData, localCategory, localSubCategory, searchQuery, sortKey, sortDir]);

    const totalPages  = Math.max(1, Math.ceil(processedData.length / rowsPerPage));
    const currentData = processedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    useEffect(() => { setCurrentPage(1); }, [processedData, rowsPerPage]);

    const maxCategoryShare    = useMemo(() => Math.max(...processedData.map(r => r.categoryShare    || 0), 1), [processedData]);
    const maxSubCategoryShare = useMemo(() => Math.max(...processedData.map(r => r.subCategoryShare || 0), 1), [processedData]);

    const overallCategoryShare = useMemo(() => {
        if (!processedData.length) return 0;
        const sum = processedData.reduce((acc, r) => acc + (r.categoryShare || 0), 0);
        return sum / processedData.length;
    }, [processedData]);

    const overallSubCategoryShare = useMemo(() => {
        if (!processedData.length) return 0;

        // Use brandSubCategorySales / subCategorySales when available (most accurate)
        const hasSalesFields = processedData.some(r =>
            r.brandSubCategorySales !== undefined && r.subCategorySales !== undefined
        );
        if (!hasSalesFields) {
            // Fallback: simple average of per-row subCategoryShare values
            const sum = processedData.reduce((acc, r) => acc + (r.subCategoryShare || 0), 0);
            return sum / processedData.length;
        }

        // Deduplicate by (category, subCategory) for the denominator
        const uniqueSubCatSales = new Map();
        // Deduplicate by (category, subCategory, brand) for the numerator
        const uniqueBrandSubCatSales = new Map();

        processedData.forEach(r => {
            const sKey = `${r.category ?? ''}-${r.subCategory ?? ''}`;
            const bKey = `${r.category ?? ''}-${r.subCategory ?? ''}-${r.brand ?? ''}`;

            if (r.subCategorySales !== undefined) {
                uniqueSubCatSales.set(sKey, r.subCategorySales);
            }
            if (r.brandSubCategorySales !== undefined) {
                uniqueBrandSubCatSales.set(bKey, r.brandSubCategorySales);
            }
        });

        const sumSubCatSales    = Array.from(uniqueSubCatSales.values()).reduce((acc, v) => acc + v, 0);
        const sumBrandSubSales  = Array.from(uniqueBrandSubCatSales.values()).reduce((acc, v) => acc + v, 0);

        if (sumSubCatSales === 0) return 0;
        return (sumBrandSubSales / sumSubCatSales) * 100;
    }, [processedData]);

    const columns = [
        { key: 'category',         label: 'Category',           sortable: false },
        { key: 'brand',            label: 'Brand',              sortable: false },
        { key: 'subCategory',      label: 'Sub Category',       sortable: false },
        { key: 'categoryShare',    label: 'Category Share',     sortable: true,  color: '#6366f1' },
        { key: 'subCategoryShare', label: 'Sub Category Share', sortable: true,  color: '#10b981' },
    ];

    return (
        <motion.div
            className="bg-white rounded-3xl shadow-sm border border-slate-200 mt-6"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        >
            {/* ── Header ── */}
            <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 rounded-t-3xl bg-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <BarChart2 size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-[17px] font-bold text-slate-900" style={{ fontFamily: 'Roboto, sans-serif' }}>
                            Category &amp; Sub-Category Share
                        </h2>
                        <p className="text-[12px] text-slate-500 mt-0.5">
                            Brand-level market share breakdown across categories and sub-categories.
                        </p>
                    </div>
                </div>
                {/* Search */}
                <div className="relative">
                    <input
                        type="text" placeholder="Search…" value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 text-[12px] rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-300 transition-all w-44 text-slate-700 placeholder-slate-400"
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                </div>
            </div>

            {/* ── Section-only filter bar ── */}
            <div className="px-6 py-3.5 flex flex-wrap items-center gap-3.5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2 mr-1">
                    <div className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-200/50 text-slate-500">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    </div>
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Filters</span>
                </div>

                <FilterSelect
                    label="Category" color="indigo"
                    value={localCategory} options={allCategories}
                    onChange={handleCategoryChange}
                />
                <FilterSelect
                    label="Sub Category" color="emerald"
                    value={localSubCategory} options={availableSubCategories}
                    onChange={handleSubCategoryChange}
                />

                <AnimatePresence>
                    {hasActiveFilters && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9, x: -10 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: -10 }}
                            onClick={resetAllFilters}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 px-3 py-1.5 rounded-xl transition-all shadow-sm ml-1"
                        >
                            <X size={12} strokeWidth={2.5} /> Reset
                        </motion.button>
                    )}
                </AnimatePresence>

                <div className="ml-auto text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    {processedData.length} rows
                </div>
            </div>

            {/* ── Table ── */}
            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50/60">
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                    className={cn(
                                        'group/th px-6 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-widest border-b border-slate-100',
                                        col.key === 'category'    && 'sticky left-0 bg-slate-50/60 z-20 min-w-[160px]',
                                        col.key === 'brand'       && 'min-w-[160px]',
                                        col.key === 'subCategory' && 'min-w-[180px]',
                                        (col.sortable || !col.sortable) && 'min-w-[200px]',
                                        col.sortable && 'cursor-pointer select-none hover:bg-indigo-50/40 transition-colors',
                                    )}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={cn(col.sortable && sortKey === col.key ? 'text-indigo-600' : '')}>
                                            {col.label}
                                        </span>
                                        {col.sortable && <SortIcon dir={sortKey === col.key ? sortDir : null} />}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && processedData.length > 0 && (
                            <motion.tr
                                className="bg-purple-50/70 font-bold border-b border-purple-200/60 hover:bg-purple-100/50 transition-colors"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                            >
                                <td className="px-6 py-3.5 sticky left-0 bg-purple-50/95 z-10 border-r border-purple-100/40">
                                    <span className="text-[12px] font-black text-purple-800 tracking-wider">OVERVIEW</span>
                                </td>
                                <td className="px-6 py-3.5 bg-purple-50/40">
                                    <span className="text-[12px] font-semibold text-purple-400">—</span>
                                </td>
                                <td className="px-6 py-3.5 bg-purple-50/40">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200/50">
                                        All Selected ({processedData.length})
                                    </span>
                                </td>
                                <td className={cn('px-6 py-3.5 bg-purple-50/30', sortKey === 'categoryShare' && 'bg-purple-100/40')}>
                                    <span className="text-purple-900 font-extrabold">
                                        <ShareBar value={overallCategoryShare} max={100} color="#6366f1" />
                                    </span>
                                </td>
                                <td className={cn('px-6 py-3.5 bg-purple-50/30', sortKey === 'subCategoryShare' && 'bg-purple-100/40')}>
                                    <span className="text-purple-900 font-extrabold">
                                        <ShareBar value={overallSubCategoryShare} max={100} color="#10b981" />
                                    </span>
                                </td>
                            </motion.tr>
                        )}
                        {loading ? (
                            [...Array(8)].map((_, i) => (
                                <tr key={'sk-' + i} className="border-b border-slate-50">
                                    <td className="px-6 py-3.5 sticky left-0 bg-white z-10"><Skeleton variant="text" width="80%" /></td>
                                    <td className="px-6 py-3.5"><Skeleton variant="text" width="70%" /></td>
                                    <td className="px-6 py-3.5"><Skeleton variant="text" width="75%" /></td>
                                    <td className="px-6 py-3.5"><Skeleton variant="rounded" height={12} width="100%" /></td>
                                    <td className="px-6 py-3.5"><Skeleton variant="rounded" height={12} width="100%" /></td>
                                </tr>
                            ))
                        ) : currentData.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-14 text-center text-slate-400 text-sm">
                                    No data available for the selected filters.
                                </td>
                            </tr>
                        ) : (
                            currentData.map((row, idx) => (
                                <motion.tr
                                    key={`${row.category}-${row.brand}-${row.subCategory}-${idx}`}
                                    className="group border-b border-slate-50/80 last:border-0 hover:bg-indigo-50/30 transition-colors"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.015 }}
                                >
                                    <td className="px-6 py-3.5 sticky left-0 bg-white group-hover:bg-indigo-50/30 transition-colors z-10 border-r border-slate-50/50">
                                        <span className="text-[12px] font-bold text-slate-800 uppercase tracking-wide">{row.category || '—'}</span>
                                    </td>
                                    <td className="px-6 py-3.5">
                                        <span className="text-[12px] font-semibold text-slate-700">{row.brand || '—'}</span>
                                    </td>
                                    <td className="px-6 py-3.5">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-100">
                                            {row.subCategory || '—'}
                                        </span>
                                    </td>
                                    <td className={cn('px-6 py-3.5', sortKey === 'categoryShare' && 'bg-indigo-50/20')}>
                                        <ShareBar value={row.categoryShare} max={100} color="#6366f1" />
                                    </td>
                                    <td className={cn('px-6 py-3.5', sortKey === 'subCategoryShare' && 'bg-emerald-50/20')}>
                                        <ShareBar value={row.subCategoryShare} max={100} color="#10b981" />
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Footer ── */}
            <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 bg-white shadow-[0_-4px_20px_-12px_rgba(0,0,0,0.07)] rounded-b-3xl">
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-[12px] font-bold text-slate-500">
                        Page <span className="text-slate-900">{currentPage}</span> / {totalPages}
                    </span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronRight size={16} />
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Rows/page</span>
                    <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-400/50">
                        {ROWS_PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>
            </div>
        </motion.div>
    );
};

export default MarketShareShareTable;
