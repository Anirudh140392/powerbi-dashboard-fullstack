import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X,
    Search,
    Check,
    ChevronDown,
    SlidersHorizontal,
    Tag,
    Package,
    Monitor,
    Filter,
    RotateCcw,
    Calendar,
} from 'lucide-react'
import { cn } from '../../../lib/utils'

// ========================================
// MOCK DATA (replace with API/DB later)
// ========================================
const mockBrands = [
    { id: 'colgate', name: 'Colgate' },
    { id: 'halo', name: 'Halo' },
    { id: 'palmolive', name: 'Palmolive' },
]

const mockCategories = [
    { id: 'toothpaste', name: 'Toothpaste' },
    { id: 'mouthwash', name: 'Mouthwash' },
    { id: 'toothbrush', name: 'Toothbrush' },
    { id: 'bodywash', name: 'Bodywash' },
]

const mockPlatforms = [
    { id: 'blinkit', name: 'Blinkit' },
    { id: 'zepto', name: 'Zepto' },
    { id: 'instamart', name: 'Swiggy Instamart' },
    { id: 'amazon', name: 'Amazon' },
    { id: 'flipkart', name: 'Flipkart' },
]

const kpiOptions = [
    { key: 'offtakes', label: 'Offtakes' },
    { key: 'categorySize', label: 'Category size' },
    { key: 'spend', label: 'Spend' },
    { key: 'roas', label: 'ROAS' },
    { key: 'inorgSales', label: 'Inorg Sales' },
    { key: 'dspSales', label: 'DSP Sales' },
    { key: 'conversion', label: 'Conversion' },
    { key: 'availability', label: 'Availability' },
    { key: 'shareOfSearch', label: 'Share of Search' },
    { key: 'marketShare', label: 'Market share' },
    { key: 'promoMy', label: 'Promo (My)' },
    { key: 'promoComp', label: 'Promo (Comp)' },
    { key: 'cpm', label: 'CPM' },
    { key: 'cpc', label: 'CPC' },
]

// ========================================
// MULTI-SELECT DROPDOWN COMPONENT
// ========================================
function MultiSelectDropdown({ label, icon: Icon, options, selected, onChange, placeholder }) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const dropdownRef = useRef(null)

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filteredOptions = options.filter(opt =>
        opt.name.toLowerCase().includes(search.toLowerCase())
    )

    const toggleOption = (id) => {
        if (selected.includes(id)) {
            onChange(selected.filter(s => s !== id))
        } else {
            onChange([...selected, id])
        }
    }

    const selectAll = () => onChange(options.map(o => o.id))
    const clearAll = () => onChange([])

    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all duration-200',
                    isOpen
                        ? 'border-slate-400 ring-2 ring-slate-200 bg-white'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                )}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Icon size={16} className="text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-600 truncate">
                        {selected.length === 0
                            ? placeholder || label
                            : `${selected.length} selected`}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {selected.length > 0 && (
                        <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                            {selected.length}
                        </span>
                    )}
                    <ChevronDown
                        size={14}
                        className={cn('text-slate-400 transition-transform', isOpen && 'rotate-180')}
                    />
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden"
                    >
                        {/* Search */}
                        <div className="p-2 border-b border-slate-100">
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={`Search ${label.toLowerCase()}...`}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
                                />
                            </div>
                        </div>

                        {/* Quick actions */}
                        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                            <button
                                onClick={selectAll}
                                className="text-[10px] text-slate-500 hover:text-slate-700 font-medium"
                            >
                                Select All
                            </button>
                            <button
                                onClick={clearAll}
                                className="text-[10px] text-slate-500 hover:text-slate-700 font-medium"
                            >
                                Clear
                            </button>
                        </div>

                        {/* Options */}
                        <div className="max-h-48 overflow-y-auto">
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-4 text-xs text-slate-400 text-center">
                                    No results found
                                </div>
                            ) : (
                                filteredOptions.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => toggleOption(opt.id)}
                                        className={cn(
                                            'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                                            selected.includes(opt.id)
                                                ? 'bg-slate-100 text-slate-900'
                                                : 'text-slate-600 hover:bg-slate-50'
                                        )}
                                    >
                                        <div className={cn(
                                            'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                                            selected.includes(opt.id)
                                                ? 'bg-slate-900 border-slate-900'
                                                : 'border-slate-300'
                                        )}>
                                            {selected.includes(opt.id) && (
                                                <Check size={10} className="text-white" strokeWidth={3} />
                                            )}
                                        </div>
                                        <span className="truncate">{opt.name}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ========================================
// MAIN ADVANCED FILTER MODAL
// ========================================
export default function AdvancedFilterModal({ isOpen, onClose, filters, onApply, currentDimension = 'platform' }) {
    // Local filter state (applied on confirm)
    const [localFilters, setLocalFilters] = useState({
        brands: [],
        categories: [],
        platforms: [],
        skuName: '',
        skuCode: '',
        dateFrom: '',
        dateTo: '',
        kpis: ['offtakes', 'categorySize', 'spend', 'roas', 'inorgSales', 'dspSales', 'conversion'],
        filterLogic: 'OR',
    })

    // Sync with parent filters when modal opens
    useEffect(() => {
        if (isOpen && filters) {
            setLocalFilters(filters)
        }
    }, [isOpen, filters])

    const updateFilter = (key, value) => {
        setLocalFilters(prev => ({ ...prev, [key]: value }))
    }

    const toggleKpi = (kpiKey) => {
        setLocalFilters(prev => {
            const current = prev.kpis
            if (current.includes(kpiKey)) {
                if (current.length <= 1) return prev // Keep at least 1
                return { ...prev, kpis: current.filter(k => k !== kpiKey) }
            }
            return { ...prev, kpis: [...current, kpiKey] }
        })
    }

    const resetFilters = () => {
        setLocalFilters({
            brands: [],
            categories: [],
            platforms: [],
            skuName: '',
            skuCode: '',
            kpis: ['offtakes', 'categorySize', 'spend', 'roas', 'inorgSales', 'dspSales', 'conversion'],
            filterLogic: 'OR',
        })
    }

    const handleApply = () => {
        onApply(localFilters)
        onClose()
    }

    // Determine which filters to show based on current dimension
    const showPlatformFilter = currentDimension !== 'platform'
    const showBrandFilter = currentDimension !== 'brand'
    const showCategoryFilter = currentDimension !== 'category'
    const showSkuFilter = currentDimension === 'sku' || currentDimension === 'platform' || currentDimension === 'brand' || currentDimension === 'category'

    const activeFilterCount = [
        showBrandFilter && localFilters.brands.length > 0,
        showCategoryFilter && localFilters.categories.length > 0,
        showPlatformFilter && localFilters.platforms.length > 0,
        showSkuFilter && localFilters.skuName.length > 0,
        showSkuFilter && localFilters.skuCode.length > 0,
    ].filter(Boolean).length

    // Get dimension label for context
    const dimensionLabels = {
        platform: 'Platform',
        brand: 'Brand',
        category: 'Category',
        sku: 'SKU',
        month: 'Month'
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[100]"
                    />

                    {/* Modal Container - Centered */}
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                            className="w-full max-w-[500px] max-h-[75vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto border border-slate-200/50"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center">
                                        <SlidersHorizontal size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-slate-900">Advanced Filters</h2>
                                        <p className="text-xs text-slate-400">
                                            {activeFilterCount > 0
                                                ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`
                                                : 'Customize your view'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                                >
                                    <X size={18} className="text-slate-400" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
                                {/* Dimension Filters */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs text-slate-500 uppercase tracking-[0.1em] font-bold">
                                            Filter by {dimensionLabels[currentDimension]} Entities
                                        </span>
                                        <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                            Viewing: {dimensionLabels[currentDimension]}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {showBrandFilter && (
                                            <MultiSelectDropdown
                                                label="Brand"
                                                icon={Tag}
                                                options={mockBrands}
                                                selected={localFilters.brands}
                                                onChange={(val) => updateFilter('brands', val)}
                                                placeholder="All Brands"
                                            />
                                        )}
                                        {showCategoryFilter && (
                                            <MultiSelectDropdown
                                                label="Category"
                                                icon={Package}
                                                options={mockCategories}
                                                selected={localFilters.categories}
                                                onChange={(val) => updateFilter('categories', val)}
                                                placeholder="All Categories"
                                            />
                                        )}
                                        {showPlatformFilter && (
                                            <MultiSelectDropdown
                                                label="Platform"
                                                icon={Monitor}
                                                options={mockPlatforms}
                                                selected={localFilters.platforms}
                                                onChange={(val) => updateFilter('platforms', val)}
                                                placeholder="All Platforms"
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* SKU Search */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs text-slate-500 uppercase tracking-[0.1em] font-bold">
                                            SKU Search
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={localFilters.skuName}
                                                onChange={(e) => updateFilter('skuName', e.target.value)}
                                                placeholder="SKU Name..."
                                                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-100 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all bg-slate-50/30"
                                            />
                                        </div>
                                        <div className="relative">
                                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={localFilters.skuCode}
                                                onChange={(e) => updateFilter('skuCode', e.target.value)}
                                                placeholder="SKU Code..."
                                                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-100 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all bg-slate-50/30"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Date Range Filter */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Calendar size={14} className="text-slate-400" />
                                        <span className="text-xs text-slate-500 uppercase tracking-[0.1em] font-bold">
                                            Date Range
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1 block">From</label>
                                            <input
                                                type="date"
                                                value={localFilters.dateFrom}
                                                onChange={(e) => updateFilter('dateFrom', e.target.value)}
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-100 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all bg-slate-50/30"
                                            />
                                        </div>
                                        <div className="relative">
                                            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1 block">To</label>
                                            <input
                                                type="date"
                                                value={localFilters.dateTo}
                                                onChange={(e) => updateFilter('dateTo', e.target.value)}
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-100 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all bg-slate-50/30"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* KPI Selection */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Filter size={12} className="text-slate-400" />
                                            <span className="text-xs text-slate-500 uppercase tracking-[0.1em] font-bold">
                                                KPIs
                                            </span>
                                            <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full border border-slate-200/50">
                                                {localFilters.kpis.length} Selected
                                            </span>
                                        </div>
                                        {/* AND/OR Toggle */}
                                        <div className="flex items-center bg-slate-100/50 rounded-lg p-0.5 border border-slate-200/50">
                                            <button
                                                onClick={() => updateFilter('filterLogic', 'AND')}
                                                className={cn(
                                                    'px-2.5 py-1 text-[9px] font-bold rounded-md transition-all',
                                                    localFilters.filterLogic === 'AND'
                                                        ? 'bg-slate-900 text-white shadow-sm'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                )}
                                            >
                                                AND
                                            </button>
                                            <button
                                                onClick={() => updateFilter('filterLogic', 'OR')}
                                                className={cn(
                                                    'px-2.5 py-1 text-[9px] font-bold rounded-md transition-all',
                                                    localFilters.filterLogic === 'OR'
                                                        ? 'bg-slate-900 text-white shadow-sm'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                )}
                                            >
                                                OR
                                            </button>
                                        </div>
                                    </div>
                                    <div className="max-h-[160px] overflow-y-auto no-scrollbar pr-1">
                                        <div className="flex flex-wrap gap-1.5">
                                            {kpiOptions.map(kpi => {
                                                const isSelected = localFilters.kpis.includes(kpi.key)
                                                return (
                                                    <motion.button
                                                        key={kpi.key}
                                                        onClick={() => toggleKpi(kpi.key)}
                                                        className={cn(
                                                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 border',
                                                            isSelected
                                                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                                                : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                                                        )}
                                                        whileHover={{ y: -1 }}
                                                        whileTap={{ scale: 0.98 }}
                                                    >
                                                        <div className={cn(
                                                            'w-1.5 h-1.5 rounded-full',
                                                            isSelected ? 'bg-white' : 'bg-slate-300'
                                                        )} />
                                                        {kpi.label}
                                                    </motion.button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
                                <button
                                    onClick={resetFilters}
                                    className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
                                >
                                    <RotateCcw size={13} />
                                    Reset
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <motion.button
                                        onClick={handleApply}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-[11px] font-bold rounded-xl shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-colors"
                                        whileHover={{ y: -1 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <Check size={14} strokeWidth={3} />
                                        Apply Filters
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
