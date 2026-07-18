/**
 * GlobalFilterBar — Premium Glassmorphism Filter Bar
 * Persistent filter ribbon: Platform, Brand, Category, SKU, Date Range
 * Lives below the header on every page
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, ChevronDown, RotateCcw, Tag, Package, Activity, TrendingUp, IndianRupee, X, Check
} from 'lucide-react';
import type { GlobalFilterResult } from '../hooks/useGlobalFilters';
import type { DatePreset, PriceFilterMode, RatingBifurcation } from '../types/filterTypes';
import { getClassificationOptions } from '../config/productClassifications';
import { useProductCategories, useSkuList, usePriceRanges } from '../hooks/useRatingsAPI';
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
    align?: 'left' | 'right'; wide?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        }
        if (isOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, onClose]);

    // After the panel mounts, check if it overflows the right edge and shift inward
    useEffect(() => {
        if (!isOpen || !ref.current) return;
        const panel = ref.current;
        const rect = panel.getBoundingClientRect();
        const viewportWidth = window.innerWidth;

        if (rect.right > viewportWidth - 8) {
            // Shift left so right edge is 8px from viewport edge
            const overflow = rect.right - (viewportWidth - 8);
            const currentLeft = parseFloat(panel.style.left || '0') || 0;
            panel.style.left = `${currentLeft - overflow}px`;
            panel.style.right = 'auto';
        }
        if (rect.left < 8) {
            panel.style.left = '8px';
            panel.style.right = 'auto';
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={ref}
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    className={`
                        absolute top-full mt-2 z-[100]
                        ${wide ? 'w-[380px]' : 'min-w-[240px]'}
                        max-h-[360px] overflow-y-auto
                        bg-white dark:bg-slate-900
                        border border-slate-200 dark:border-slate-700
                        rounded-xl shadow-2xl shadow-black/15 dark:shadow-black/40
                        p-2
                        ${align === 'right' ? 'right-0' : 'left-0'}
                    `}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/** Search input for dropdowns */
function DropdownSearch({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder: string;
}) {
    return (
        <div className="relative mb-2 px-1">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-slate-100 dark:bg-slate-800
                    border border-slate-200 dark:border-slate-700
                    text-slate-800 dark:text-slate-200 placeholder:text-slate-400 
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
            />
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT — Single Clean Row
// ============================================================================

/** Compact dropdown trigger: LABEL value ▾ */
function DropdownTrigger({
    label, value, isActive, onClick, icon
}: {
    label: string; value: string; isActive: boolean;
    onClick: () => void; icon?: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-normal
                transition-all duration-200 whitespace-nowrap border h-9
                ${isActive
                    ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm'
                }
            `}
        >
            {icon}
            {label && <span className="text-slate-500 dark:text-slate-400">{label}:</span>}
            <span className={`font-medium ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>{value}</span>
            <ChevronDown size={14} className="text-slate-400 ml-1 transition-transform" />
        </button>
    );
}

const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({ filterResult, tabsNode }) => {
    const {
        filters, setPlatform, setBrandScope, setCategory, setProductCategory,
        setClassification, setSku, setRatingBifurcation, setDatePreset, setCompetitorPlatform, setPriceMode, setPriceRange, resetFilters,
        availablePlatforms, availableCategories,
        totalPrestigeCount, totalCompetitorCount,
    } = filterResult;

    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [categorySearch, setCategorySearch] = useState('');
    const [skuSearch, setSkuSearch] = useState('');
    const shouldLoadSkus = openDropdown === 'sku';
    const shouldLoadPriceRanges = openDropdown === 'price';
    // Categories are now eager-loaded on mount instead of waiting for the
    // dropdown to open. The endpoint is light (~20k row scan) and the
    // 5-minute in-hook cache means subsequent dashboard navigation reuses
    // the data. Filter params dropped: the dropdown only shows category
    // NAMES, not date-filtered counts, so platform+scope are enough.
    const { data: productCategories, loading: categoriesLoading } = useProductCategories({
        platform: filters.platform !== 'all' ? filters.platform : undefined,
        is_competitor: filters.brandScope === 'all' ? 'all' : filters.brandScope === 'prestige' ? 'false' : 'true',
    });

    // Server-driven SKU list — only active when drill-down filters are set
    const statusMap: Record<string, string> = {
        'pareto': 'Pareto', 'non-pareto': 'Non-Pareto',
        'non-pareto-unclassified': 'Non-Pareto (Unclassified)', 'npd': 'NPD',
    };
    const { data: serverSkus, loading: serverSkusLoading } = useSkuList({
        category: filters.productCategory,
        pareto_status: filters.category.classification !== 'all' ? statusMap[filters.category.classification] : null,
        rating_bifurcation: filters.ratingBifurcation,
        platform: filters.platform !== 'all' ? filters.platform : null,
        price_mode: filters.priceMode,
        price_min: filters.priceRange?.min ?? null,
        price_max: filters.priceRange?.max ?? null,
        // Honor the active scope so the SKU picker lists competitor SKUs under
        // Competition/All (previously always Prestige-only).
        is_competitor: filters.brandScope === 'all' ? 'all' : filters.brandScope === 'prestige' ? 'false' : 'true',
    }, { enabled: shouldLoadSkus });

    const { ranges: priceRanges } = usePriceRanges({ enabled: shouldLoadPriceRanges || !!filters.priceRange });

    const toggleDropdown = (name: string) => {
        setOpenDropdown(prev => prev === name ? null : name);
        setCategorySearch('');
        setSkuSearch('');
    };

    const datePresets: { key: DatePreset; label: string }[] = [
        { key: '1M', label: '1M' }, { key: '3M', label: '3M' }, { key: '6M', label: '6M' },
        { key: '12M', label: '1Y' }, { key: '2Y', label: '2Y' }, { key: 'MAX', label: 'All' },
    ];

    const classificationOptions = getClassificationOptions();

    const activeFilterCount = [
        filters.platform !== 'all' ? filters.platform : null,
        filters.brandScope !== 'all' ? filters.brandScope : null,
        filters.productCategory,
        filters.category.selectedCategory,
        filters.sku,
        filters.category.classification !== 'all' ? filters.category.classification : null,
        filters.ratingBifurcation,
        filters.competitorPlatform !== 'all' ? filters.competitorPlatform : null,
        filters.priceRange ? `${filters.priceMode}-${filters.priceRange.min}-${filters.priceRange.max}` : null,
        filters.searchTerm ? filters.searchTerm : null,
    ].filter(Boolean).length;

    // Display values
    const platformLabel = availablePlatforms.find(p => p.id === filters.platform)?.label || 'All';
    const scopeLabel = filters.brandScope === 'all' ? 'All' : filters.brandScope === 'prestige' ? getActiveBrandName() : 'Competition';
    const categoryLabel = filters.productCategory || 'All Categories';
    const sentimentLabel = filters.category.selectedCategory || 'All';
    const classLabel = classificationOptions.find((c: any) => c.value === filters.category.classification)?.label || 'All';
    const skuLabel = filters.sku ? (filters.sku.length > 18 ? filters.sku.substring(0, 18) + '…' : filters.sku) : 'All';
    const RATING_BIFURCATION_OPTIONS: { value: RatingBifurcation; label: string; color: string }[] = [
        { value: 'NP',    label: 'No Problem (≥4.2★)',  color: 'text-emerald-600 dark:text-emerald-400' },
        { value: 'NI',    label: 'No Issue (4.0–4.2★)',  color: 'text-amber-600 dark:text-amber-400' },
        { value: 'Issue', label: 'Has Issues (<4.0★)',    color: 'text-red-600 dark:text-red-400' },
    ];
    const ratingLabel = filters.ratingBifurcation
        ? RATING_BIFURCATION_OPTIONS.find(o => o.value === filters.ratingBifurcation)?.label || filters.ratingBifurcation
        : 'All';

    const priceModeOptions: Array<{ value: PriceFilterMode; label: string }> = [
        { value: 'sp', label: 'Selling Price' },
        { value: 'rp', label: 'MRP' },
    ];
    const activePriceMode = priceRanges?.modes?.[filters.priceMode];
    const activePriceSlabs = activePriceMode?.slabs || [];

    // Build discrete price buckets based on ranges
    const PRESET_PRICE_BUCKETS = [
        { min: 0, max: 1000, label: 'Under ₹1,000' },
        { min: 1000, max: 3000, label: '₹1,000 - ₹3,000' },
        { min: 3000, max: 5000, label: '₹3,000 - ₹5,000' },
        { min: 5000, max: 10000, label: '₹5,000 - ₹10,000' },
        { min: 10000, max: 999999, label: 'Above ₹10,000' },
    ];
    const priceLabel = filters.priceRange 
        ? PRESET_PRICE_BUCKETS.find(b => b.min === filters.priceRange?.min && b.max === filters.priceRange?.max)?.label || `₹${filters.priceRange.min} - ₹${filters.priceRange.max}`
        : 'All Prices';

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

                    {/* ── ROW 2: FILTERS (Interval of months, search, etc) ── */}
                    <div className="flex flex-wrap items-center gap-2 w-full mt-2">

                        {/* ── Global Search Bar ── */}
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">
                                <Search size={13} />
                            </div>
                            <input
                                type="text"
                                value={filters.searchTerm}
                                onChange={(e) => filterResult.setSearchTerm(e.target.value)}
                                placeholder="Search products, issues..."
                                className={`
                                    pl-9 pr-8 rounded-md text-xs font-normal w-48 md:w-56 h-9
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

                        {/* ── Date Range ── */}
                        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-md p-1 h-9 border border-slate-200/60 dark:border-slate-700/60">
                            {datePresets.map(d => (
                                <motion.button
                                    key={d.key}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setDatePreset(d.key)}
                                    className={`px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors
                                        ${filters.dateRange.preset === d.key
                                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm border border-slate-200 dark:border-slate-600'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                        }`}
                                >
                                    {d.label}
                                </motion.button>
                            ))}
                        </div>

                        {/* ── Trend Comparison Months ── */}
                        <div className="relative">
                            <DropdownTrigger
                                label="Trend Vs"
                                value={`${filters.trendPeriodMonths || 6}M`}
                                isActive={(filters.trendPeriodMonths || 6) !== 6}
                                onClick={() => toggleDropdown('trend')}
                                icon={<TrendingUp size={11} className="text-slate-400" />}
                            />
                            <FilterDropdown isOpen={openDropdown === 'trend'} onClose={() => setOpenDropdown(null)}>
                                <div className="px-3 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Comparison Period</span>
                                </div>
                                {[1, 3, 6, 12].map(months => (
                                    <button
                                        key={months}
                                        onClick={() => { filterResult.setTrendPeriodMonths(months); setOpenDropdown(null); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors
                                            ${(filters.trendPeriodMonths || 6) === months
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                            }`}
                                    >
                                        Compare {months} vs prior {months} Months
                                    </button>
                                ))}
                            </FilterDropdown>
                        </div>

                        {/* ── Price Range ── */}
                        <div className="relative">
                            <DropdownTrigger
                                label="Price"
                                value={filters.priceRange ? priceLabel : `All ${activePriceMode?.label || 'Prices'}`}
                                isActive={!!filters.priceRange}
                                onClick={() => toggleDropdown('price')}
                                icon={<IndianRupee size={11} className="text-slate-400" />}
                            />
                            <FilterDropdown isOpen={openDropdown === 'price'} onClose={() => setOpenDropdown(null)}>
                                <div className="px-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                        {priceModeOptions.map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => { setPriceMode(option.value); setPriceRange(null); }}
                                                className={`flex-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                                    filters.priceMode === option.value
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                        : 'text-slate-500 dark:text-slate-400'
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setPriceRange(null); setOpenDropdown(null); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors
                                        ${!filters.priceRange
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    All Prices
                                </button>
                                {(activePriceSlabs.length > 0 ? activePriceSlabs : PRESET_PRICE_BUCKETS).map((bucket, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setPriceRange({ min: bucket.min, max: bucket.max }); setOpenDropdown(null); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors
                                            ${filters.priceRange?.min === bucket.min && filters.priceRange?.max === bucket.max
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span>{bucket.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </FilterDropdown>
                        </div>

                        {/* ── Platform (Marketplace) ── */}
                        <div className="relative">
                            <DropdownTrigger
                                label="Platform"
                                value={platformLabel}
                                isActive={filters.platform !== 'all'}
                                onClick={() => toggleDropdown('platform')}
                            />
                            <FilterDropdown isOpen={openDropdown === 'platform'} onClose={() => setOpenDropdown(null)}>
                                <div className="py-1">
                                    {availablePlatforms.map(p => {
                                        const isSelected = filters.platform === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => { 
                                                    setPlatform(p.id); 
                                                    setCompetitorPlatform(p.id === 'all' ? 'all' : p.id as 'Amazon' | 'Flipkart'); 
                                                    setOpenDropdown(null); 
                                                }}
                                                className={`
                                                    w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between group
                                                    ${isSelected
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-semibold'
                                                        : p.isActive 
                                                            ? 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300' 
                                                            : 'opacity-40 cursor-not-allowed text-slate-400'
                                                    }
                                                `}
                                                disabled={!p.isActive}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-sm grayscale-[0.5] group-hover:grayscale-0 transition-all">{p.icon}</span>
                                                    <span>{p.label}</span>
                                                </div>
                                                {isSelected && (
                                                    <Check size={12} className="text-indigo-500" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </FilterDropdown>
                        </div>

                        {/* ── Scope (Prestige / Competition / All) ── */}
                        <div className="relative">
                            <DropdownTrigger
                                label="Scope"
                                value={scopeLabel}
                                isActive={filters.brandScope !== 'all'}
                                onClick={() => toggleDropdown('scope')}
                            />
                            <FilterDropdown isOpen={openDropdown === 'scope'} onClose={() => setOpenDropdown(null)}>
                                {[
                                    { key: 'all' as const, label: 'All Reviews', desc: `${getActiveBrandName()} + competitors` },
                                    { key: 'prestige' as const, label: getActiveBrandName(), desc: 'Only your brand' },
                                    { key: 'competition' as const, label: 'Competition', desc: 'Only competitor brands' },
                                ].map(b => (
                                    <button
                                        key={b.key}
                                        onClick={() => { setBrandScope(b.key); setOpenDropdown(null); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors
                                            ${filters.brandScope === b.key
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                            }`}
                                    >
                                        <div className="font-medium">{b.label}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">{b.desc}</div>
                                    </button>
                                ))}
                            </FilterDropdown>
                        </div>

                        <div className="w-px h-5 bg-slate-200/60 dark:bg-slate-700/60" />

                        {/* ── Category (Product type — from DB) ── */}
                        <div className="relative">
                            <DropdownTrigger
                                label="Category"
                                value={categoryLabel}
                                isActive={!!filters.productCategory}
                                onClick={() => toggleDropdown('category')}
                                icon={<Package size={11} className="text-slate-400" />}
                            />
                            <FilterDropdown isOpen={openDropdown === 'category'} onClose={() => setOpenDropdown(null)}>
                                <DropdownSearch value={categorySearch} onChange={setCategorySearch} placeholder="Search categories..." />
                                <button
                                    onClick={() => { setProductCategory(null); setOpenDropdown(null); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors
                                        ${!filters.productCategory
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    All Categories
                                </button>
                                {categoriesLoading && productCategories.length === 0 ? (
                                    <div className="px-3 py-4 flex items-center gap-2 text-xs text-slate-500">
                                        <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                                        Loading categories...
                                    </div>
                                ) : productCategories.length === 0 ? (
                                    <div className="px-3 py-4 text-xs text-slate-500 text-center">
                                        No categories found.
                                    </div>
                                ) : productCategories
                                    .filter((pc: { category: string }) => pc.category.toLowerCase().includes(categorySearch.toLowerCase()))
                                    .map((pc: { category: string, count: number }) => (
                                        <button
                                            key={pc.category}
                                            onClick={() => { setProductCategory(pc.category); setOpenDropdown(null); }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex justify-between items-center
                                                ${filters.productCategory === pc.category
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                                }`}
                                        >
                                            <span>{pc.category}</span>
                                            <span className="text-[10px] text-slate-400 tabular-nums">{pc.count}</span>
                                        </button>
                                    ))}
                            </FilterDropdown>
                        </div>

                        {/* ── Sentiment (Quality / Performance / Value etc.) ── */}
                        <div className="relative">
                            <DropdownTrigger
                                label="Sentiment"
                                value={sentimentLabel}
                                isActive={!!filters.category.selectedCategory}
                                onClick={() => toggleDropdown('sentiment')}
                            />
                            <FilterDropdown isOpen={openDropdown === 'sentiment'} onClose={() => setOpenDropdown(null)}>
                                <button
                                    onClick={() => { setCategory(null); setOpenDropdown(null); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors
                                        ${!filters.category.selectedCategory
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    All Sentiments
                                </button>
                                {availableCategories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => { setCategory(cat); setOpenDropdown(null); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors
                                            ${filters.category.selectedCategory === cat
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </FilterDropdown>
                        </div>

                        {/* ── Type (Pareto / Non-Pareto / NPD / All) ── */}
                        <div className="relative">
                            <DropdownTrigger
                                label="Type"
                                value={classLabel}
                                isActive={filters.category.classification !== 'all'}
                                onClick={() => toggleDropdown('type')}
                                icon={<Tag size={11} className="text-slate-400" />}
                            />
                            <FilterDropdown isOpen={openDropdown === 'type'} onClose={() => setOpenDropdown(null)}>
                                {classificationOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => { setClassification(opt.value); setOpenDropdown(null); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors
                                            ${filters.category.classification === opt.value
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                            }`}
                                    >
                                        {opt.icon} {opt.label}
                                    </button>
                                ))}
                            </FilterDropdown>
                        </div>

                        {/* ── Rating Bifurcation (visible when Type is selected) ── */}
                        <AnimatePresence>
                            {filters.category.classification !== 'all' && (
                                <motion.div
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: 'auto' }}
                                    exit={{ opacity: 0, width: 0 }}
                                    className="relative overflow-hidden"
                                >
                                    <DropdownTrigger
                                        label="Rating"
                                        value={ratingLabel}
                                        isActive={!!filters.ratingBifurcation}
                                        onClick={() => toggleDropdown('rating')}
                                        icon={<Activity size={11} className="text-slate-400" />}
                                    />
                                    <FilterDropdown isOpen={openDropdown === 'rating'} onClose={() => setOpenDropdown(null)}>
                                        <button
                                            onClick={() => { setRatingBifurcation(null); setOpenDropdown(null); }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors
                                                ${!filters.ratingBifurcation
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                                }`}
                                        >
                                            All Ratings
                                        </button>
                                        {RATING_BIFURCATION_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => { setRatingBifurcation(opt.value); setOpenDropdown(null); }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors
                                                    ${filters.ratingBifurcation === opt.value
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                <span className={opt.color}>{opt.label}</span>
                                            </button>
                                        ))}
                                    </FilterDropdown>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── SKU ── */}
                        <div className="relative">
                            <DropdownTrigger
                                label="SKU"
                                value={skuLabel}
                                isActive={!!filters.sku}
                                onClick={() => toggleDropdown('sku')}
                                icon={<Search size={11} className="text-slate-400" />}
                            />
                            <FilterDropdown isOpen={openDropdown === 'sku'} onClose={() => setOpenDropdown(null)} align="right" wide={true}>
                                <DropdownSearch value={skuSearch} onChange={setSkuSearch} placeholder="Search SKUs..." />
                                <button
                                    onClick={() => { setSku(null); setOpenDropdown(null); }}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                    All SKUs
                                </button>
                                <div className="max-h-[240px] overflow-y-auto">
                                    {serverSkusLoading && (
                                        <div className="px-3 py-6 flex flex-col items-center gap-2 text-center">
                                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="inline-block text-indigo-500 text-lg">⧗</motion.div>
                                            <span className="text-[11px] text-slate-500">Loading SKUs...</span>
                                        </div>
                                    )}
                                    {!serverSkusLoading && (() => {
                                        const displayList = serverSkus
                                            .filter(s => (s.product_name || s.web_pid).toLowerCase().includes(skuSearch.toLowerCase()))
                                            .slice(0, 100)
                                            .map(s => ({ id: s.web_pid, label: s.product_name?.trim() || s.web_pid, reviewCount: s.review_count }));
                                        if (displayList.length === 0) {
                                            return (
                                                <div className="px-3 py-4 text-center text-[11px] text-slate-400">
                                                    No SKUs found
                                                </div>
                                            );
                                        }
                                        return displayList.map(sku => (
                                            <button
                                                key={sku.id}
                                                onClick={() => { setSku(sku.id); setOpenDropdown(null); }}
                                                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-start justify-between gap-2 group
                                                    ${filters.sku === sku.id
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                                                    }`}
                                            >
                                                <span className="font-medium leading-snug break-words flex-1">{sku.label}</span>
                                                <span className="shrink-0 mt-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">{sku.reviewCount}</span>
                                            </button>
                                        ));
                                    })()}
                                </div>
                            </FilterDropdown>
                        </div>

                            {activeFilterCount > 0 && (
                                <div className="ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={resetFilters}
                                        className="flex items-center gap-1 px-3 h-9 rounded-md text-xs font-medium
                                            bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors shadow-sm"
                                    >
                                        <RotateCcw size={12} />
                                        <span className="hidden lg:inline">Reset</span>
                                        <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-200 dark:bg-red-900/60 text-red-700 dark:text-red-300 font-bold">{activeFilterCount}</span>
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
