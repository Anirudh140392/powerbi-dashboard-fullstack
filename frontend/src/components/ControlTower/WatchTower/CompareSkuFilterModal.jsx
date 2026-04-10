import { useState, useRef, useEffect, useMemo } from 'react'
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
    MapPin,
} from 'lucide-react'
import { cn } from '../../../lib/utils'

// ========================================
// KPI Options for Compare SKU
// ========================================
const defaultKpiOptions = [
    { key: 'offtakes', label: 'Offtakes' },
    { key: 'spend', label: 'Spend' },
    { key: 'categorySize', label: 'Category size' },
    { key: 'inorgSales', label: 'Inorg Sales' },
    { key: 'conversion', label: 'Conversion' },
    { key: 'availability', label: 'Availability' },
    { key: 'shareOfVolume', label: 'Share of Search' },
    { key: 'ad_sov', label: 'Ad SOV' },
    { key: 'organic_sov', label: 'Organic SOV' },
    { key: 'marketShare', label: 'Est Market share' },
    { key: 'cpm', label: 'CPM' },
    { key: 'cpc', label: 'CPC' },
]

// ========================================
// MULTI-SELECT DROPDOWN (self-contained)
// ========================================
function CskuMultiSelectDropdown({ label, icon: Icon, options, selected = [], onChange, placeholder }) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const dropdownRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filteredOptions = (options || []).filter(opt =>
        opt && opt.name && typeof opt.name === 'string' && opt.name.toLowerCase().includes(search.toLowerCase())
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
// COMPARE SKU FILTER MODAL (standalone)
// ========================================
export default function CompareSkuFilterModal({ isOpen, onClose, filters, onApply, brands = null, categories = null, platforms = null, locations = null, kpiOptions: propKpiOptions = null }) {
    const isBoatUser = useMemo(() => {
        try {
            const u = JSON.parse(sessionStorage.getItem('user'));
            return u?.dbName?.toLowerCase() === 'boat';
        } catch {
            return false;
        }
    }, []);

    // For Compare SKU, dimension is always 'sku'
    const currentDimension = 'sku';

    const baseKpiOptions = propKpiOptions || defaultKpiOptions;
    const kpisToUse = baseKpiOptions.filter(k => {
        if (k.key === 'categorySize') return false;
        if (isBoatUser && (k.key === 'spend' || k.key === 'conversion')) return false;
        return true;
    });

    // Local filter state (applied on confirm)
    const [localFilters, setLocalFilters] = useState({
        brands: [],
        categories: [],
        platforms: [],
        locations: [],
        skus: [],
        dateFrom: '',
        dateTo: '',
        kpis: ['offtakes', 'spend', 'availability', 'marketShare', 'conversion'].filter(k => {
            if (k === 'categorySize' || k === 'shareOfVolume' || k === 'ad_sov' || k === 'organic_sov') return false;
            if (isBoatUser && (k === 'spend' || k === 'conversion')) return false;
            return true;
        }),
        filterLogic: 'OR',
    })

    // Sync with parent filters when modal opens
    useEffect(() => {
        if (isOpen && filters) {
            setLocalFilters(prev => ({ ...prev, ...filters }))
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
            locations: [],
            skus: [],
            kpis: ['offtakes', 'spend', 'availability', 'marketShare', 'conversion'].filter(k => {
                if (k === 'categorySize' || k === 'shareOfVolume' || k === 'ad_sov' || k === 'organic_sov') return false;
                if (isBoatUser && (k === 'spend' || k === 'conversion')) return false;
                return true;
            }),
            filterLogic: 'OR',
        })
    }

    const handleApply = () => {
        onApply(localFilters)
        onClose()
    }

    // Compare SKU always shows Brand, Category, Platform filters (dimension is 'sku')
    const activeFilterCount = [
        localFilters.brands.length > 0,
        localFilters.categories.length > 0,
        localFilters.platforms.length > 0,
        localFilters.locations.length > 0,
    ].filter(Boolean).length

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
                                        <h2 className="text-base font-bold text-slate-900">Compare SKU Filters</h2>
                                        <p className="text-xs text-slate-400">
                                            {activeFilterCount > 0
                                                ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`
                                                : 'Customize your SKU comparison'}
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
                                            Filter by Entities
                                        </span>
                                        <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                            Compare SKU
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <CskuMultiSelectDropdown
                                            label="Brand"
                                            icon={Tag}
                                            options={brands && brands.length ? brands : []}
                                            selected={localFilters.brands}
                                            onChange={(val) => updateFilter('brands', val)}
                                            placeholder="All Brands"
                                        />
                                        <CskuMultiSelectDropdown
                                            label="Category"
                                            icon={Package}
                                            options={categories && categories.length ? categories : []}
                                            selected={localFilters.categories}
                                            onChange={(val) => updateFilter('categories', val)}
                                            placeholder="All Categories"
                                        />
                                        <CskuMultiSelectDropdown
                                            label="Location"
                                            icon={MapPin}
                                            options={locations && locations.length ? locations : []}
                                            selected={localFilters.locations}
                                            onChange={(val) => updateFilter('locations', val)}
                                            placeholder="All Locations"
                                        />
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
                                            {kpisToUse.map(kpi => {
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
