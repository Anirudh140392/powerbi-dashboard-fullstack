/**
 * GlobalFilterBar — Premium Glassmorphism Filter Bar
 * Persistent filter ribbon: Platform, Brand, Category, SKU, Date Range
 * Lives below the header on every page
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, ChevronDown, RotateCcw, Package, Activity, TrendingUp, X, Check, SlidersHorizontal
} from 'lucide-react';
import type { GlobalFilterResult } from '../hooks/useGlobalFilters';
import { getDateRangeForPreset } from '../hooks/useGlobalFilters';
import type { GlobalFilterState, DatePreset, PriceFilterMode, RatingBifurcation, BrandScope } from '../types/filterTypes';
import { getClassificationOptions } from '../config/productClassifications';
import { useProductCategories, useSkuList, usePriceRanges, useClientBrands } from '../hooks/useRatingsAPI';
import { getActiveBrandName } from '../utils/tenant';


interface GlobalFilterBarProps {
    filterResult: GlobalFilterResult;
    headlineMetrics?: {
        pdpRating?: number;
        userRating?: number;
        mlRating?: number;
        reviewCount?: number;
        ratingCount?: number;
    };
    tabsNode?: React.ReactNode;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================


/** Dropdown wrapper — viewport-aware positioning so it never overflows the screen */
function FilterDropdown({
    isOpen, onClose, children, align = 'left', wide = false
}: {
    isOpen: boolean; onClose: () => void; children: React.ReactNode;
    align?: 'left' | 'right' | 'center'; wide?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [xOffset, setXOffset] = useState<number>(0);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        }
        if (isOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, onClose]);

    // After the panel mounts, check if it overflows the viewport and calculate shift
    useEffect(() => {
        if (!isOpen || !ref.current) {
            setXOffset(0);
            return;
        }
        // Small delay to ensure initial layout is calculated
        requestAnimationFrame(() => {
            if (!ref.current) return;
            const rect = ref.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;

            let adjust = 0;
            if (rect.right > viewportWidth - 8) {
                adjust = -(rect.right - (viewportWidth - 8));
            } else if (rect.left < 8) {
                adjust = 8 - rect.left;
            }
            if (adjust !== 0) {
                setXOffset(adjust);
            }
        });
    }, [isOpen, align]);

    const baseX = align === 'center' ? '-50%' : '0px';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={ref}
                    initial={{ opacity: 0, y: -8, x: `calc(${baseX} + ${xOffset}px)`, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, x: `calc(${baseX} + ${xOffset}px)`, scale: 1 }}
                    exit={{ opacity: 0, y: -8, x: `calc(${baseX} + ${xOffset}px)`, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    className={`
                        absolute top-full mt-2 z-[100]
                        ${wide ? 'w-[min(720px,calc(100vw-24px))]' : 'min-w-[240px] max-w-[calc(100vw-24px)]'}
                        max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-hidden
                        bg-white dark:bg-slate-900
                        border border-slate-200 dark:border-slate-700
                        rounded-xl shadow-2xl shadow-black/15 dark:shadow-black/40
                        p-2
                        ${align === 'right' ? 'right-0' : align === 'center' ? 'left-1/2' : 'left-0'}
                    `}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}// ============================================================================
// MAIN COMPONENT — Single Clean Row
// ============================================================================

const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({ filterResult, tabsNode }) => {
    const {
        filters, setCategory, setRatingBifurcation, setPriceMode, setPriceRange, resetFilters,
        availablePlatforms, availableCategories,
    } = filterResult;

    const [stagedFilters, setStagedFilters] = useState<GlobalFilterState>(filters);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    useEffect(() => {
        if (openDropdown === 'main_filter') {
            setStagedFilters(filters);
        }
    }, [openDropdown, filters]);

    const { brands: clientBrands } = useClientBrands();
    const availableClientBrands = clientBrands;

    const [skuSearch, setSkuSearch] = useState('');
    const [activeFilterTab, setActiveFilterTab] = useState<'general' | 'categorization' | 'skus' | 'performance'>('general');
    const shouldLoadSkus = openDropdown === 'main_filter' || openDropdown === 'sku';
    const shouldLoadPriceRanges = openDropdown === 'main_filter' || openDropdown === 'price';
    // Categories are now eager-loaded on mount instead of waiting for the
    // dropdown to open. The endpoint is light (~20k row scan) and the
    // 5-minute in-hook cache means subsequent dashboard navigation reuses
    // the data. Filter params dropped: the dropdown only shows category
    // NAMES, not date-filtered counts, so platform+scope are enough.
    const { data: productCategories } = useProductCategories({
        platform: stagedFilters.platform !== 'all' ? stagedFilters.platform : undefined,
        is_competitor: stagedFilters.brandScope === 'all' ? 'all' : stagedFilters.brandScope === 'prestige' ? 'false' : 'true',
    });

    // Server-driven SKU list — only active when drill-down filters are set
    const statusMap: Record<string, string> = {
        'pareto': 'Pareto', 'non-pareto': 'Non-Pareto',
        'non-pareto-unclassified': 'Non-Pareto (Unclassified)', 'npd': 'NPD',
    };
    const { data: serverSkus, loading: serverSkusLoading } = useSkuList({
        category: stagedFilters.productCategory,
        pareto_status: stagedFilters.category.classification !== 'all' ? statusMap[stagedFilters.category.classification] : null,
        rating_bifurcation: stagedFilters.ratingBifurcation,
        platform: stagedFilters.platform !== 'all' ? stagedFilters.platform : null,
        price_mode: stagedFilters.priceMode,
        price_min: stagedFilters.priceRange?.min ?? null,
        price_max: stagedFilters.priceRange?.max ?? null,
        // Honor the active scope so the SKU picker lists competitor SKUs under
        // Competition/All (previously always Prestige-only).
        is_competitor: stagedFilters.brandScope === 'all' ? 'all' : stagedFilters.brandScope === 'prestige' ? 'false' : 'true',
    }, { enabled: shouldLoadSkus });

    const { ranges: priceRanges } = usePriceRanges({ enabled: shouldLoadPriceRanges || !!stagedFilters.priceRange });

    const toggleDropdown = (name: string) => {
        setOpenDropdown(prev => prev === name ? null : name);
        setSkuSearch('');
    };

    const toggleSku = (id: string) => {
        if (stagedFilters.sku.includes(id)) {
            setStagedFilters(prev => ({ ...prev, sku: prev.sku.filter(s => s !== id) }));
        } else {
            setStagedFilters(prev => ({ ...prev, sku: [...prev.sku, id] }));
        }
    };

    const applyStagedFilters = () => {
        filterResult.applyFilters(stagedFilters);
        setOpenDropdown(null);
    };

    const datePresets: { key: DatePreset; label: string }[] = [
        { key: '1M', label: '1M' }, { key: '3M', label: '3M' }, { key: '6M', label: '6M' },
        { key: '12M', label: '1Y' }, { key: '2Y', label: '2Y' }, { key: 'MAX', label: 'All' },
    ];

    const classificationOptions = getClassificationOptions();
    // Build discrete price buckets based on ranges
    const PRESET_PRICE_BUCKETS = [
        { min: 0, max: 1000, label: 'Under ₹1,000' },
        { min: 1000, max: 3000, label: '₹1,000 - ₹3,000' },
        { min: 3000, max: 5000, label: '₹3,000 - ₹5,000' },
        { min: 5000, max: 10000, label: '₹5,000 - ₹10,000' },
        { min: 10000, max: 999999, label: 'Above ₹10,000' },
    ];

    const RATING_BIFURCATION_OPTIONS: { value: RatingBifurcation; label: string; color: string }[] = [
        { value: 'NP',    label: 'No Problem (≥4.2★)',  color: 'text-emerald-600 dark:text-emerald-400' },
        { value: 'NI',    label: 'No Issue (4.0–4.2★)',  color: 'text-amber-600 dark:text-amber-400' },
        { value: 'Issue', label: 'Has Issues (<4.0★)',    color: 'text-red-600 dark:text-red-400' },
    ];

    const priceModeOptions: Array<{ value: PriceFilterMode; label: string }> = [
        { value: 'sp', label: 'Selling Price' },
        { value: 'rp', label: 'MRP' },
    ];
    const activePriceMode = priceRanges?.modes?.[filters.priceMode];
    const activePriceSlabs = activePriceMode?.slabs || [];

    const activeFilterCount = [
        filters.platform !== 'all' ? filters.platform : null,
        filters.brandScope !== 'all' ? filters.brandScope : null,
        filters.productCategory,
        filters.category.selectedCategory,
        filters.sku.length > 0 ? filters.sku.join(',') : null,
        filters.category.classification !== 'all' ? filters.category.classification : null,
        filters.ratingBifurcation,
        filters.competitorPlatform !== 'all' ? filters.competitorPlatform : null,
        filters.priceRange ? `${filters.priceMode}-${filters.priceRange.min}-${filters.priceRange.max}` : null,
        filters.searchTerm ? filters.searchTerm : null,
    ].filter(Boolean).length;


    return (
        <div className="sticky top-0 z-30 w-full">
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                <div className="w-full px-2 lg:px-4 py-3 flex flex-col gap-4">

                    {/* ── ROW 1: TABS (Overview filters) ── */}
                    {tabsNode && (
                        <div className="flex justify-center w-full overflow-x-auto no-scrollbar">
                            {tabsNode}
                        </div>
                    )}

                    {/* ── ROW 2: FILTERS ── */}
                    <div className="flex flex-wrap items-center justify-center gap-2 w-full mt-2">

                        {/* ── Global Search Bar ── */}
                        <div className="relative group flex-1 min-w-[200px] max-w-[300px]">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">
                                <Search size={13} />
                            </div>
                            <input
                                type="text"
                                value={filters.searchTerm}
                                onChange={(e) => filterResult.setSearchTerm(e.target.value)}
                                placeholder="Search products, issues..."
                                className={`
                                    pl-9 pr-8 rounded-md text-xs font-normal w-full h-9
                                    bg-white dark:bg-slate-800 shadow-sm
                                    border border-slate-200 dark:border-slate-700
                                    focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500
                                    placeholder:text-slate-400 transition-colors
                                    hover:border-slate-300 dark:hover:border-slate-600
                                `}
                            />
                            {filters.searchTerm && (
                                <button
                                    onClick={() => filterResult.setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>

                        {/* ── Main Filter Button ── */}
                        <div className="relative">
                            <button
                                onClick={() => toggleDropdown('main_filter')}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 border shadow-sm
                                    ${openDropdown === 'main_filter' || activeFilterCount > 0
                                        ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                                    }
                                `}
                            >
                                <SlidersHorizontal size={15} className="text-indigo-600 dark:text-indigo-400" />
                                <span>Advanced Filters</span>
                                {activeFilterCount > 0 && (
                                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-indigo-500 text-white rounded-full text-[11px] font-bold ml-1 shadow-sm">
                                        {activeFilterCount}
                                    </span>
                                )}
                                <ChevronDown size={15} className={`text-slate-400 transition-transform ${openDropdown === 'main_filter' ? 'rotate-180' : ''}`} />
                            </button>

                            <FilterDropdown isOpen={openDropdown === 'main_filter'} onClose={() => setOpenDropdown(null)} align="center" wide={true}>
                                <div className="w-full h-[min(540px,calc(100vh-150px))] min-h-[420px] bg-white dark:bg-slate-900 rounded-2xl flex overflow-hidden border border-slate-200/60 dark:border-slate-700/60 flex-col">
                                    <div className="flex flex-row flex-1 min-h-0">
                                    {/* Tabs Sidebar */}
                                    <div className="w-[200px] max-w-[34%] bg-slate-50 dark:bg-slate-800/30 border-r border-slate-100 dark:border-slate-800 p-4 flex flex-col gap-2 relative z-10 shrink-0">
                                        {[
                                            { id: 'general', label: 'General', icon: <Activity size={16} /> },
                                            { id: 'categorization', label: 'Categorization', icon: <Package size={16} /> },
                                            { id: 'skus', label: 'SKUs', icon: <Search size={16} /> },
                                            { id: 'performance', label: 'Performance', icon: <TrendingUp size={16} /> }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveFilterTab(tab.id as any)}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all text-left ${
                                                    activeFilterTab === tab.id
                                                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/80'
                                                }`}
                                            >
                                                <span className={`${activeFilterTab === tab.id ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                    {tab.icon}
                                                </span>
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {/* Right Content Panel */}
                                    <div className="flex-1 min-w-0 p-5 lg:p-6 overflow-y-auto no-scrollbar bg-white dark:bg-slate-900">
                                        {activeFilterTab === 'general' && (
                                            <div className="space-y-6">
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">General</h3>
                                                {/* Date Range */}
                                                <div>
                                                    <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-3">Date Range</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {datePresets.map(d => (
                                                            <button
                                                                key={d.key}
                                                                onClick={() => setStagedFilters(prev => ({ ...prev, dateRange: { preset: d.key, ...getDateRangeForPreset(d.key) } }))}
                                                                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border ${
                                                                    stagedFilters.dateRange.preset === d.key
                                                                        ? 'bg-indigo-50/50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300 shadow-sm'
                                                                        : 'bg-white border-slate-200/80 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm'
                                                                }`}
                                                            >
                                                                {d.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Platform */}
                                                <div>
                                                    <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-3">Platform</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {availablePlatforms.map(p => {
                                                            const isSelected = stagedFilters.platform === p.id;
                                                            return (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => setStagedFilters(prev => ({ ...prev, platform: p.id, competitorPlatform: p.id === 'all' ? 'all' : p.id as 'Amazon' | 'Flipkart' }))}
                                                                    disabled={!p.isActive}
                                                                    className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border flex items-center gap-2 ${
                                                                        isSelected
                                                                            ? 'bg-indigo-50/50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300 shadow-sm'
                                                                            : p.isActive 
                                                                                ? 'bg-white border-slate-200/80 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm'
                                                                                : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-900/50 dark:border-slate-800 cursor-not-allowed opacity-50'
                                                                    }`}
                                                                >
                                                                    <span className="grayscale-[0.5]">{p.icon}</span>
                                                                    {p.label}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                                
                                                {/* Scope */}
                                                <div>
                                                    <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-3">Scope</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[
                                                            { key: 'all' as const, label: 'All Reviews', desc: `${getActiveBrandName()} + competitors` },
                                                            { key: 'prestige' as const, label: getActiveBrandName(), desc: 'Only your brand' },
                                                            { key: 'competition' as const, label: 'Competition', desc: 'Only competitor brands' },
                                                        ].map(b => (
                                                            <button
                                                                key={b.key}
                                                                onClick={() => setStagedFilters(prev => ({ ...prev, brandScope: b.key }))}
                                                                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border ${
                                                                    stagedFilters.brandScope === b.key
                                                                        ? 'bg-indigo-50/50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300 shadow-sm'
                                                                        : 'bg-white border-slate-200/80 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm'
                                                                }`}
                                                                title={b.desc}
                                                            >
                                                                {b.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Brand */}
                                                {getActiveBrandName().toLowerCase() !== 'prestige' && (
                                                    <div>
                                                        <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-3">Brand</label>
                                                        <select
                                                            value={stagedFilters.brand || ''}
                                                            onChange={(e) => setStagedFilters(prev => ({ ...prev, brand: e.target.value || null }))}
                                                            className="w-full px-3 py-1.5 text-[13px] rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 shadow-sm"
                                                        >
                                                            <option value="">All Brands</option>
                                                            {availableClientBrands.map(b => (
                                                                <option key={b} value={b}>{b}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {activeFilterTab === 'categorization' && (
                                            <div className="space-y-6">
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Categorization</h3>
                                                {/* Category */}
                                                <div>
                                                    <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-3">Product Category</label>
                                                    <select
                                                        value={stagedFilters.productCategory || ''}
                                                        onChange={(e) => setStagedFilters(prev => ({ ...prev, productCategory: e.target.value || null, sku: [], category: { ...prev.category, selectedCategory: null } }))}
                                                        className="w-full px-3 py-1.5 text-[13px] rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 shadow-sm"
                                                    >
                                                        <option value="">All Categories</option>
                                                        {productCategories?.map((pc: { category: string, count: number }) => (
                                                            <option key={pc.category} value={pc.category}>{pc.category} ({pc.count})</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Type (Pareto) */}
                                                {false && (
                                                    <div>
                                                        <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-3">Type</label>
                                                        <div className="grid grid-cols-1 gap-3">
                                                            {classificationOptions.map((opt: any) => (
                                                                <button
                                                                    key={opt.value}
                                                                    onClick={() => setStagedFilters(prev => ({ ...prev, category: { ...prev.category, classification: opt.value }, ratingBifurcation: null, sku: [] }))}
                                                                    className={`w-full px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all border flex items-center justify-between gap-3 shadow-sm ${
                                                                        stagedFilters.category.classification === opt.value
                                                                            ? 'bg-white border-indigo-500 text-indigo-700 dark:bg-slate-800 dark:border-indigo-500 dark:text-indigo-300 ring-1 ring-indigo-500/20'
                                                                            : 'bg-white border-slate-200/80 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <span className={stagedFilters.category.classification === opt.value ? 'text-indigo-500 text-lg' : 'text-slate-400 text-lg'}>{opt.icon}</span> 
                                                                        <span>{opt.label}</span>
                                                                    </div>
                                                                    {stagedFilters.category.classification === opt.value && (
                                                                        <div className="text-indigo-600 dark:text-indigo-400">
                                                                            <Check size={18} strokeWidth={3} />
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {activeFilterTab === 'skus' && (
                                            <div className="space-y-6 flex flex-col h-full">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">SKUs</h3>
                                                    {stagedFilters.sku.length > 0 && (
                                                        <button 
                                                            onClick={() => setStagedFilters(prev => ({ ...prev, sku: [] }))}
                                                            className="text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                                                        >
                                                            Clear Selection
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex-1 flex flex-col min-h-0 h-full">
                                                    <div className="relative mb-3 shrink-0">
                                                        <input 
                                                            type="text" 
                                                            value={skuSearch} 
                                                            onChange={(e) => setSkuSearch(e.target.value)} 
                                                            placeholder="Search SKUs..."
                                                            className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 shadow-sm"
                                                        />
                                                        <Search size={14} className="absolute left-3 top-2 text-slate-400" />
                                                    </div>
                                                    
                                                    <div className="flex-1 overflow-y-auto border border-slate-200/80 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                                        {serverSkusLoading ? (
                                                            <div className="px-4 py-3 text-center text-[13px] text-slate-500">Loading SKUs...</div>
                                                        ) : (
                                                            serverSkus
                                                                ?.filter(s => ((s.product_name || '') + ' ' + (s.web_pid || '')).toLowerCase().includes(skuSearch.toLowerCase()))
                                                                ?.slice(0, 100)
                                                                ?.map(s => {
                                                                    const id = s.web_pid || 'unknown';
                                                                    const label = s.product_name?.trim() || s.web_pid || 'Unknown SKU';
                                                                    const isSelected = stagedFilters.sku.includes(id);
                                                                    return (
                                                                        <div
                                                                            key={id}
                                                                            onClick={() => toggleSku(id)}
                                                                            className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 cursor-pointer ${
                                                                                isSelected
                                                                                    ? 'bg-indigo-50/50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-semibold'
                                                                                    : 'hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                                                                                    {isSelected && <Check size={12} strokeWidth={3} />}
                                                                                </div>
                                                                                <span className="truncate">{label}</span>
                                                                            </div>
                                                                            <span className="shrink-0 text-[11px] text-slate-400 font-medium">{s.review_count}</span>
                                                                        </div>
                                                                    );
                                                                })
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeFilterTab === 'performance' && (
                                            <div className="space-y-6">
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Performance</h3>
                                                {/* Trend Vs */}
                                                <div>
                                                    <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-3">Trend Comparison</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[1, 3, 6, 12].map(months => (
                                                            <button
                                                                key={months}
                                                                onClick={() => filterResult.setTrendPeriodMonths(months)}
                                                                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border shadow-sm ${
                                                                    (filters.trendPeriodMonths || 6) === months
                                                                        ? 'bg-indigo-50/50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300'
                                                                        : 'bg-white border-slate-200/80 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                                }`}
                                                            >
                                                                {months} Months
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Rating Bifurcation */}
                                                {stagedFilters.category.classification !== 'all' && (
                                                    <div>
                                                        <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-3">Rating Breakup</label>
                                                        <div className="grid grid-cols-1 gap-2">
                                                            <button
                                                                onClick={() => setStagedFilters(prev => ({ ...prev, ratingBifurcation: null }))}
                                                                className={`text-left px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border shadow-sm flex items-center justify-between ${
                                                                    !stagedFilters.ratingBifurcation
                                                                        ? 'bg-indigo-50/50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300'
                                                                        : 'bg-white border-slate-200/80 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                                }`}
                                                            >
                                                                <span>All Ratings</span>
                                                                {!stagedFilters.ratingBifurcation && <Check size={16} />}
                                                            </button>
                                                            {RATING_BIFURCATION_OPTIONS.map(opt => (
                                                                <button
                                                                    key={opt.value}
                                                                    onClick={() => setStagedFilters(prev => ({ ...prev, ratingBifurcation: opt.value }))}
                                                                    className={`text-left px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border shadow-sm flex items-center justify-between ${
                                                                        stagedFilters.ratingBifurcation === opt.value
                                                                            ? 'bg-indigo-50/50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300'
                                                                            : 'bg-white border-slate-200/80 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                                    }`}
                                                                >
                                                                    <span className={stagedFilters.ratingBifurcation === opt.value ? 'text-indigo-700 dark:text-indigo-300' : opt.color}>{opt.label}</span>
                                                                    {stagedFilters.ratingBifurcation === opt.value && <Check size={16} className="text-indigo-500" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Sentiment */}
                                                <div>
                                                    <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-3">Sentiment Classification</label>
                                                    <select
                                                        value={stagedFilters.category.selectedCategory || ''}
                                                        onChange={(e) => setStagedFilters(prev => ({ ...prev, category: { ...prev.category, selectedCategory: e.target.value || null } }))}
                                                        className="w-full px-3 py-1.5 text-[13px] rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 shadow-sm"
                                                    >
                                                        <option value="">All Sentiments</option>
                                                        {availableCategories.map(cat => (
                                                            <option key={cat} value={cat}>{cat}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Price */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase">Price Range</label>
                                                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                                            {priceModeOptions.map(option => (
                                                                <button
                                                                    key={option.value}
                                                                    onClick={() => setStagedFilters(prev => ({ ...prev, priceMode: option.value, priceRange: null }))}
                                                                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                                                        stagedFilters.priceMode === option.value
                                                                            ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm'
                                                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                                                    }`}
                                                                >
                                                                    {option.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <select
                                                        value={stagedFilters.priceRange ? `${stagedFilters.priceRange.min}-${stagedFilters.priceRange.max}` : ''}
                                                        onChange={(e) => {
                                                            if (!e.target.value) setStagedFilters(prev => ({ ...prev, priceRange: null }));
                                                            else {
                                                                const [min, max] = e.target.value.split('-').map(Number);
                                                                setStagedFilters(prev => ({ ...prev, priceRange: { min, max } }));
                                                            }
                                                        }}
                                                        className="w-full px-3 py-1.5 text-[13px] rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 shadow-sm"
                                                    >
                                                        <option value="">All Prices</option>
                                                        {(activePriceSlabs.length > 0 ? activePriceSlabs : PRESET_PRICE_BUCKETS).map((bucket, i) => (
                                                            <option key={i} value={`${bucket.min}-${bucket.max}`}>{bucket.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    </div>
                                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0 bg-slate-50 dark:bg-slate-800/30">
                                        <button
                                            onClick={applyStagedFilters}
                                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            </FilterDropdown>
                        </div>

                        {activeFilterCount > 0 && (
                            <div className="ml-2 pl-3 border-l border-slate-200 dark:border-slate-700 h-9 flex items-center">
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={resetFilters}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold
                                        bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors shadow-sm"
                                >
                                    <RotateCcw size={15} />
                                    <span className="hidden lg:inline">Reset</span>
                                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 rounded-full text-[11px] font-bold shadow-sm">{activeFilterCount}</span>
                                </motion.button>
                            </div>
                        )}

                    </div>

                </div>
            </div>
        </div>
    );
};

export default GlobalFilterBar;
