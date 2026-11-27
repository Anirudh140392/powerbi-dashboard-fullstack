import { useState, useRef, useEffect, useContext, useMemo } from 'react'
import { FilterContext } from '../../../utils/FilterContext'
import { motion, AnimatePresence } from 'framer-motion'
import axiosInstance from '../../../api/axiosInstance'
import dayjs from 'dayjs'
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
    Hash,
} from 'lucide-react'
import { cn } from '../../../lib/utils'



const kpiOptions = [
    { key: 'offtakes', label: 'Offtakes' },
    // { key: 'spOfftake', label: 'SP Offtake' }, // Hidden on UI as per request
    // { key: 'mrpOfftake', label: 'MRP Offtake' }, // Hidden on UI as per request
    { key: 'quantitySold', label: 'Qty Sold' },
    { key: 'spend', label: 'Spend' },
    { key: 'inorgSales', label: 'Inorg Sales' },
    { key: 'aov', label: 'AOV' },
    { key: 'cpm', label: 'CPM' },
    { key: 'cpc', label: 'CPC' },
    { key: 'tacos', label: 'TACoS' },
    { key: 'availability', label: 'Availability' },
    { key: 'wtOsa', label: 'Wt OSA' },
    { key: 'wtDiscount', label: 'Wt Discount' },
    { key: 'asp', label: 'ASP' },
    { key: 'listingPercent', label: 'Listing %' },
    { key: 'overall_sov', label: 'Overall SOV' },
    { key: 'ad_sov', label: 'Ad SOS' },
    { key: 'organic_sov', label: 'Organic SOS' },
    { key: 'shareOfVolume', label: 'SOS' },
    { key: 'marketShare', label: 'Mkt Share' },
    { key: 'categorySize', label: 'Cat Size' },
    { key: 'roas_x', label: 'ROAS' },
    { key: 'conversion', label: 'Conversion' },
]

// ========================================
// SINGLE-SELECT DROPDOWN COMPONENT (for MSL)
// ========================================
function SingleSelectDropdown({ label, icon: Icon, options, value, onChange, placeholder }) {
    const [isOpen, setIsOpen] = useState(false)
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

    const selectedOption = options.find(opt => opt.id === value)

    return (
        <div ref={dropdownRef} className="relative font-sans">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'w-full min-h-14 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all duration-200',
                    isOpen
                        ? 'border-blue-400 ring-2 ring-blue-100 bg-white'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                )}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Icon size={16} className="text-slate-400 flex-shrink-0" />
                    <div className="flex flex-col items-start min-w-0 text-left">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider leading-none mb-1">
                            {label}
                        </span>
                        <span className="text-sm text-slate-800 font-medium truncate leading-none">
                            {selectedOption ? selectedOption.name : placeholder || label}
                        </span>
                    </div>
                </div>
                <ChevronDown
                    size={14}
                    className={cn('text-slate-400 transition-transform', isOpen && 'rotate-180')}
                />
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
                        <div className="max-h-48 overflow-y-auto">
                            {options.map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt.id)
                                        setIsOpen(false)
                                    }}
                                    className={cn(
                                        'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                                        opt.id === value
                                            ? 'bg-slate-100 text-slate-900 font-medium'
                                            : 'text-slate-600 hover:bg-slate-50'
                                    )}
                                >
                                    <span className="truncate">{opt.name}</span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ========================================
// MULTI-SELECT DROPDOWN COMPONENT
// ========================================
function MultiSelectDropdown({ label, icon: Icon, options, selected = [], onChange, placeholder, showSapCode = false }) {
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

    const filteredOptions = (options || []).filter(opt => {
        if (!opt || !opt.name || typeof opt.name !== 'string') return false;
        const q = search.toLowerCase();
        if (!q) return true;
        if (opt.name.toLowerCase().includes(q)) return true;
        // Match against the product identifiers exposed by the shared SKU endpoint.
        if (showSapCode && opt.sapCode && String(opt.sapCode).toLowerCase().includes(q)) return true;
        if (opt.webPid && String(opt.webPid).toLowerCase().includes(q)) return true;
        return false;
    })

    const isOptionSelected = (opt) => {
        if (!selected || !selected.length || !opt) return false;
        const optIdStr = String(opt.id || '').toLowerCase().trim();
        const optNameStr = String(opt.name || '').toLowerCase().trim();
        return selected.some(s => {
            const sStr = String(s || '').toLowerCase().trim();
            return sStr === optIdStr || sStr === optNameStr;
        });
    };

    const toggleOption = (optId) => {
        const targetOpt = (options || []).find(o => o.id === optId) || { id: optId, name: optId };
        const isSel = isOptionSelected(targetOpt);
        const optIdStr = String(targetOpt.id || '').toLowerCase().trim();
        const optNameStr = String(targetOpt.name || '').toLowerCase().trim();

        if (isSel) {
            onChange(selected.filter(s => {
                const sStr = String(s || '').toLowerCase().trim();
                return sStr !== optIdStr && sStr !== optNameStr;
            }));
        } else {
            onChange([...selected, optId]);
        }
    };

    const selectAll = () => onChange(options.map(o => o.id));
    const clearAll = () => onChange([]);

    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'w-full min-h-14 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all duration-200',
                    isOpen
                        ? 'border-blue-400 ring-2 ring-blue-100 bg-white'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                )}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Icon size={16} className="text-slate-400 flex-shrink-0" />
                    <div className="flex flex-col items-start min-w-0 text-left">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider leading-none mb-1">
                            {label}
                        </span>
                        <span className="text-sm text-slate-800 font-medium truncate leading-none">
                            {selected.length === 0
                                ? placeholder || label
                                : `${selected.length} selected`}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {selected.length > 0 && (
                        <span className="bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium leading-none">
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
                                    placeholder={label.toLowerCase() === 'sku'
                                        ? (showSapCode ? 'Search SKU name, SAP code or Web PID...' : 'Search SKU name or Web PID...')
                                        : `Search ${label.toLowerCase()}...`}
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
                                filteredOptions.map(opt => {
                                    const isOptSelected = isOptionSelected(opt);
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => toggleOption(opt.id)}
                                            className={cn(
                                                'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                                                isOptSelected
                                                    ? 'bg-slate-100 text-slate-900'
                                                    : 'text-slate-600 hover:bg-slate-50'
                                            )}
                                        >
                                            <div className={cn(
                                                'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                                                isOptSelected
                                                    ? 'bg-slate-900 border-slate-900'
                                                    : 'border-slate-300'
                                            )}>
                                                {isOptSelected && (
                                                    <Check size={10} className="text-white" strokeWidth={3} />
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="truncate capitalize text-xs leading-tight">{opt.name}</span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// MAIN ADVANCED FILTER MODAL
// ========================================
export default function AdvancedFilterModal({ isOpen, onClose, filters, onApply, currentDimension = 'platform', brands = null, categories = null, platforms = null, skus = null, grammages = null, kpiOptions: propKpiOptions = null, platformScope }) {
    const isDrlUser = useMemo(() => {
        try {
            const u = JSON.parse(sessionStorage.getItem('user') || '{}');
            return u?.dbName?.toLowerCase() === 'drl';
        } catch {
            return false;
        }
    }, []);

    const isBoatUser = useMemo(() => {
        try {
            const u = JSON.parse(sessionStorage.getItem('user'));
            return u?.dbName?.toLowerCase() === 'boat';
        } catch {
            return false;
        }
    }, []);

    // Filter out "Category size" (key: 'categorySize') when on SKU dimension
    const baseKpiOptions = propKpiOptions || kpiOptions;
    const kpisToUse = currentDimension === 'sku'
        ? baseKpiOptions.filter(k => {
            if (k.key === 'categorySize') return false;
            // Also exclude Spend and Conversion for boat users on SKU dimension
            if (isBoatUser && (k.key === 'spend' || k.key === 'conversion')) return false;
            return true;
        })
        : baseKpiOptions;

    // Local filter state (applied on confirm)
    const [localFilters, setLocalFilters] = useState({
        brands: [],
        categories: [],
        platforms: [],
        subBrands: [],
        skus: [],
        sapCodes: [],
        grammages: [],
        msl: '0',
        kpis: ['offtakes', 'spend', 'categorySize', 'availability', 'marketShare', 'conversion'].filter(k => {
            if (currentDimension === 'sku') {
                if (k === 'categorySize' || k === 'shareOfVolume' || k === 'ad_sov' || k === 'organic_sov' || k === 'overall_sov') return false;
                if (isBoatUser && (k === 'spend' || k === 'conversion')) return false;
                return true;
            }
            if (currentDimension === 'brand') return k !== 'categorySize' && k !== 'marketShare';
            return true;
        }),
        filterLogic: 'OR',
    })

    const { maxDate, minDate, selectedChannel, selectedLocation, platform: globalPlatform, selectedBrand, selectedCategory, selectedMsl, selectedSubBrand, subBrands: subBrandsContext, timeStart, setTimeStart, timeEnd, setTimeEnd, setUserSetDate, setCompareStart, setCompareEnd, setComparisonLabel } = useContext(FilterContext)
    const maxDateStr = useMemo(() => maxDate?.format('YYYY-MM-DD'), [maxDate])
    const minDateStr = useMemo(() => minDate?.format('YYYY-MM-DD'), [minDate])

    const updateDateRange = (field, value) => {
        if (!value) return
        let changedDate = dayjs(value)
        if (!changedDate.isValid()) return
        if (minDate && changedDate.isBefore(minDate)) changedDate = minDate
        if (maxDate && changedDate.isAfter(maxDate)) changedDate = maxDate

        let start = field === 'from' ? changedDate : timeStart
        let end = field === 'to' ? changedDate : timeEnd
        if (!start) start = changedDate
        if (!end) end = changedDate
        if (start.isAfter(end)) {
            if (field === 'from') end = start
            else start = end
        }

        const periodDays = end.diff(start, 'day') + 1
        const previousEnd = start.subtract(1, 'day')
        const previousStart = previousEnd.subtract(periodDays - 1, 'day')
        setTimeStart(start)
        setTimeEnd(end)
        setCompareStart(minDate && previousStart.isBefore(minDate) ? minDate : previousStart)
        setCompareEnd(minDate && previousEnd.isBefore(minDate) ? minDate : previousEnd)
        setComparisonLabel('VS PREV. PERIOD')
        setUserSetDate(true)
    }

    const [dynamicBrands, setDynamicBrands] = useState([])
    const [dynamicCategories, setDynamicCategories] = useState([])
    const [dynamicPlatforms, setDynamicPlatforms] = useState([])
    const [dynamicSubBrands, setDynamicSubBrands] = useState([])
    const [dynamicSkus, setDynamicSkus] = useState([])
    const [dynamicSapCodes, setDynamicSapCodes] = useState([])
    const [dynamicGrammages, setDynamicGrammages] = useState([])
    const [loadingFilters, setLoadingFilters] = useState(false)

    // Synchronize initial options from props when props change
    useEffect(() => {
        setDynamicBrands(brands && brands.length ? brands : [])
    }, [brands])

    useEffect(() => {
        setDynamicCategories(categories && categories.length ? categories : [])
    }, [categories])

    useEffect(() => {
        setDynamicPlatforms(platforms && platforms.length ? platforms : [])
    }, [platforms])

    useEffect(() => {
        if (subBrandsContext && subBrandsContext.length > 0) {
            setDynamicSubBrands(subBrandsContext.map(s => typeof s === 'object' ? s : { id: String(s).toLowerCase(), name: String(s) }))
        }
    }, [subBrandsContext])

    useEffect(() => {
        setDynamicSkus(skus && skus.length ? skus : [])
    }, [skus])

    useEffect(() => {
        if (grammages && grammages.length) {
            setDynamicGrammages(grammages)
        }
    }, [grammages])


    // Cascaded dynamic fetching effect
    useEffect(() => {
        if (!isOpen) return

        let active = true

        const fetchCascadedFilters = async () => {
            setLoadingFilters(true)
            try {
                const cleanParam = (val) => {
                    if (!val) return undefined
                    if (Array.isArray(val)) {
                        if (val.length === 0) return undefined
                        return val.map(v => typeof v === 'string' ? v.replace(/_/g, ' ') : v).join(',')
                    }
                    if (typeof val === 'string') {
                        if (val === 'All') return undefined
                        return val.replace(/_/g, ' ')
                    }
                    return val
                }

                // If local platform selection is empty, fall back to global platform selected in the sidebar/filterbar
                const activePlatforms = localFilters.platforms && localFilters.platforms.length > 0
                    ? localFilters.platforms
                    : (globalPlatform && globalPlatform !== 'All' ? [globalPlatform] : []);

                // If local brand selection is empty, fall back to global brand
                const activeBrands = localFilters.brands && localFilters.brands.length > 0
                    ? localFilters.brands
                    : (selectedBrand && selectedBrand !== 'All' ? [selectedBrand] : []);

                // If local category selection is empty, fall back to global category
                const activeCategories = localFilters.categories && localFilters.categories.length > 0
                    ? localFilters.categories
                    : (selectedCategory && selectedCategory !== 'All' ? [selectedCategory] : []);

                const activeSubBrands = localFilters.subBrands && localFilters.subBrands.length > 0
                    ? localFilters.subBrands
                    : (selectedSubBrand && selectedSubBrand !== 'All' ? (Array.isArray(selectedSubBrand) ? selectedSubBrand : [selectedSubBrand]) : []);

                const activeSapCodes = localFilters.sapCodes && localFilters.sapCodes.length > 0
                    ? localFilters.sapCodes
                    : [];

                const startDate = timeStart?.format('YYYY-MM-DD');
                const endDate = timeEnd?.format('YYYY-MM-DD');

                const params = {
                    channel: cleanParam(selectedChannel),
                    location: cleanParam(selectedLocation),
                    platform: cleanParam(activePlatforms),
                    brand: cleanParam(activeBrands),
                    category: cleanParam(activeCategories),
                    subBrand: cleanParam(activeSubBrands),
                    sapCode: cleanParam(activeSapCodes),
                    startDate,
                    endDate
                }

                const productsEndpoint = '/watchtower/products-with-sap';

                const [cascadedRes, productsRes] = await Promise.allSettled([
                    axiosInstance.get('/watchtower/cascaded-filters', { params }),
                    axiosInstance.get(productsEndpoint, {
                        params: {
                            platform: params.platform,
                            brand: params.brand,
                            category: params.category,
                            sapCode: params.sapCode
                        }
                    })
                ])

                if (!active) return

                if (cascadedRes.status === 'fulfilled' && cascadedRes.value.data) {
                    const data = cascadedRes.value.data

                    if (data.brands && Array.isArray(data.brands)) {
                        const mappedBrands = data.brands.map(b => {
                            const parentOpt = brands?.find(opt => opt.name?.toLowerCase() === b.toLowerCase())
                            if (parentOpt) return parentOpt
                            return { id: b.toLowerCase().replace(/\s+/g, '_'), name: b }
                        })
                        setDynamicBrands(mappedBrands)
                    }

                    if (data.categories && Array.isArray(data.categories)) {
                        const mappedCategories = data.categories.map(c => {
                            const parentOpt = categories?.find(opt => opt.name?.toLowerCase() === c.toLowerCase() || opt.id?.toLowerCase() === c.toLowerCase())
                            if (parentOpt) return parentOpt
                            return { id: c, name: c }
                        })
                        setDynamicCategories(mappedCategories)
                    }

                    if (data.platforms && Array.isArray(data.platforms)) {
                        const mappedPlatforms = data.platforms.map(p => {
                            const parentOpt = platforms?.find(opt => opt.name?.toLowerCase() === p.toLowerCase() || opt.id?.toLowerCase() === p.toLowerCase())
                            if (parentOpt) return parentOpt
                            return { id: p.toLowerCase().replace(/\s+/g, '_'), name: p }
                        })
                        setDynamicPlatforms(mappedPlatforms)
                    }

                    if (data.subBrands && Array.isArray(data.subBrands)) {
                        const mappedSubBrands = data.subBrands.map(s => ({ id: String(s).toLowerCase(), name: String(s) }))
                        setDynamicSubBrands(mappedSubBrands)
                    }

                    if (data.grammages && Array.isArray(data.grammages)) {
                        const mappedGrammages = data.grammages
                            .filter(g => g !== null && g !== undefined && String(g).trim() !== '')
                            .map(g => ({ id: String(g), name: String(g) }));
                        if (mappedGrammages.length > 0) {
                            setDynamicGrammages(mappedGrammages);
                        }
                    }
                }

                if (productsRes.status === 'fulfilled' && productsRes.value.data && Array.isArray(productsRes.value.data)) {
                    const allProducts = productsRes.value.data;

                    const sapSet = new Set();
                    const rawSapOpts = [];
                    const rawSkus = allProducts.map(p => {
                        // Shared endpoint returns identifiers for every client.
                        const productName = typeof p === 'object' ? (p.name || p.product_name || '') : String(p);
                        const sapCode = typeof p === 'object' ? (p.sapCode || p.sap_code || null) : null;
                        const webPid = typeof p === 'object' ? (p.webPid || p.web_pid || null) : null;

                        if (sapCode && !sapSet.has(String(sapCode))) {
                            sapSet.add(String(sapCode));
                            rawSapOpts.push({ id: String(sapCode), name: String(sapCode) });
                        }

                        const parentOpt = skus?.find(opt =>
                            opt.name?.toLowerCase() === productName.toLowerCase() ||
                            opt.id?.toLowerCase() === productName.toLowerCase()
                        );
                        if (parentOpt) return { ...parentOpt, sapCode: sapCode ?? parentOpt.sapCode ?? null, webPid: webPid ?? parentOpt.webPid ?? null };
                        return { id: productName, name: productName, sapCode, webPid };
                    }).filter(p => p.name);

                    rawSapOpts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                    // Bidirectional cross-filtering between SKUs and SAP Codes
                    const selectedSapSet = new Set((localFilters.sapCodes || []).map(s => String(s).toLowerCase().trim()));
                    const filteredSkus = (selectedSapSet.size > 0)
                        ? rawSkus.filter(s => s.sapCode && selectedSapSet.has(String(s.sapCode).toLowerCase().trim()))
                        : rawSkus;

                    const selectedSkuSet = new Set((localFilters.skus || []).map(s => String(s).toLowerCase().trim()));
                    const filteredSapOpts = (selectedSkuSet.size > 0)
                        ? rawSapOpts.filter(opt => {
                            return rawSkus.some(s =>
                                s.sapCode &&
                                String(s.sapCode).toLowerCase().trim() === String(opt.id).toLowerCase().trim() &&
                                (selectedSkuSet.has(String(s.id).toLowerCase().trim()) || selectedSkuSet.has(String(s.name).toLowerCase().trim()))
                            );
                        })
                        : rawSapOpts;

                    setDynamicSkus(filteredSkus);
                    setDynamicSapCodes(filteredSapOpts);
                }
            } catch (err) {
                console.error('[AdvancedFilterModal] Error fetching cascaded options:', err)
            } finally {
                if (active) setLoadingFilters(false)
            }
        }

        fetchCascadedFilters()

        return () => {
            active = false
        }
    }, [
        isOpen,
        localFilters.brands,
        localFilters.categories,
        localFilters.platforms,
        localFilters.sapCodes,
        localFilters.skus,
        timeStart,
        timeEnd,
        selectedChannel,
        selectedLocation,
        globalPlatform,
        selectedBrand,
        selectedCategory,
        brands,
        categories,
        platforms,
        skus
    ])

    // Fallback: Populate dynamicSapCodes from dynamicSkus or skus prop if empty
    useEffect(() => {
        if (isDrlUser && (dynamicSkus.length > 0 || (skus && skus.length > 0)) && dynamicSapCodes.length === 0) {
            const sapSet = new Set();
            const sapOpts = [];
            const sourceList = dynamicSkus.length > 0 ? dynamicSkus : (skus || []);
            sourceList.forEach(s => {
                const code = s.sapCode || s.sap_code;
                if (code && !sapSet.has(String(code))) {
                    sapSet.add(String(code));
                    sapOpts.push({ id: String(code), name: String(code) });
                }
            });
            if (sapOpts.length > 0) {
                sapOpts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                setDynamicSapCodes(sapOpts);
            }
        }
    }, [isDrlUser, dynamicSkus, skus, dynamicSapCodes.length]);

    // Fetch grammage dropdown values from dimension-overview API on every brand/category/platform/date change
    useEffect(() => {
        if (!isOpen) return;

        let active = true;

        const fetchGrammages = async () => {
            try {
                // Only platform and category drive the grammage dropdown options
                const activePlatforms = localFilters.platforms?.length > 0
                    ? localFilters.platforms
                    : (globalPlatform && globalPlatform !== 'All' ? [globalPlatform] : []);

                const activeCategories = localFilters.categories?.length > 0
                    ? localFilters.categories
                    : (selectedCategory && selectedCategory !== 'All' ? [selectedCategory] : []);

                const startDate = timeStart?.format('YYYY-MM-DD');
                const endDate = timeEnd?.format('YYYY-MM-DD');

                const params = new URLSearchParams();
                params.append('dimension', 'sku');
                if (activePlatforms.length > 0) params.append('platform', activePlatforms.join(','));
                if (activeCategories.length > 0) params.append('category', activeCategories.join(','));
                if (selectedChannel && selectedChannel !== 'All') params.append('channel', selectedChannel);
                if (selectedLocation && selectedLocation !== 'All') params.append('location', selectedLocation);
                if (startDate) params.append('startDate', startDate);
                if (endDate) params.append('endDate', endDate);

                const response = await axiosInstance.get(`/pricing-analysis/dimension-overview?${params.toString()}`);

                if (!active) return;

                if (response.data?.success && Array.isArray(response.data.data)) {
                    const weights = [...new Set(
                        response.data.data
                            .map(row => row.weight)
                            .filter(w => w !== null && w !== undefined && w !== '')
                    )].sort();
                    setDynamicGrammages(weights.map(w => ({ id: w, name: w })));
                }
            } catch (err) {
                console.error('[AdvancedFilterModal] Error fetching grammages from dimension-overview:', err);
            }
        };

        fetchGrammages();

        return () => { active = false; };
    }, [
        isOpen,
        currentDimension,
        localFilters.categories,
        localFilters.platforms,
        timeStart,
        timeEnd,
        selectedChannel,
        selectedLocation,
        globalPlatform,
        selectedCategory,
    ])

    // Initialize drafts once per opening so shared date changes do not discard edits.
    const initializedForDimension = useRef(null)
    useEffect(() => {
        if (!isOpen) {
            initializedForDimension.current = null
            return
        }
        if (initializedForDimension.current === currentDimension) return
        initializedForDimension.current = currentDimension

        const normalizeArr = (val) => {
            if (!val || val === 'All') return [];
            if (Array.isArray(val)) return val.filter(v => v !== 'All');
            return [val];
        };

        setLocalFilters(prev => {
            const categories = (filters?.categories && filters.categories.length > 0)
                ? filters.categories
                : normalizeArr(selectedCategory);

            const brands = (filters?.brands && filters.brands.length > 0)
                ? filters.brands
                : normalizeArr(selectedBrand);

            const platforms = (filters?.platforms && (platformScope || filters.platforms.length > 0))
                ? filters.platforms
                : normalizeArr(globalPlatform);

            const subBrands = (filters?.subBrands && filters.subBrands.length > 0)
                ? filters.subBrands
                : normalizeArr(selectedSubBrand);

            const msl = (filters?.msl !== undefined && filters.msl !== '0')
                ? filters.msl
                : (selectedMsl || '0');

            const sapCodes = (filters?.sapCodes && filters.sapCodes.length > 0)
                ? filters.sapCodes
                : ((filters?.sapCode && filters.sapCode.length > 0) ? (Array.isArray(filters.sapCode) ? filters.sapCode : [filters.sapCode]) : (prev.sapCodes || []));

            return {
                ...prev,
                ...(filters || {}),
                categories,
                brands,
                platforms,
                subBrands,
                msl,
                sapCodes,
            };
        });
    }, [isOpen, currentDimension, filters, selectedCategory, selectedBrand, globalPlatform, selectedMsl, selectedSubBrand, platformScope]);

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
            platforms: platformScope || [],
            subBrands: [],
            skus: [],
            sapCodes: [],
            grammages: [],
            msl: '0',
            kpis: ['offtakes', 'spend', 'categorySize', 'availability', 'marketShare', 'conversion'].filter(k => {
                if (currentDimension === 'sku') {
                    if (k === 'categorySize' || k === 'shareOfVolume' || k === 'ad_sov' || k === 'organic_sov' || k === 'overall_sov') return false;
                    if (isBoatUser && (k === 'spend' || k === 'conversion')) return false;
                    return true;
                }
                if (currentDimension === 'brand') return k !== 'categorySize' && k !== 'marketShare';
                return true;
            }),
            filterLogic: 'OR',
        })
    }

    const handleApply = () => {
        const lowerFilters = {
            ...localFilters,
            platforms: localFilters.platforms.map(p => typeof p === 'string' ? p.toLowerCase() : p),
            brands: localFilters.brands.map(b => typeof b === 'string' ? b.toLowerCase() : b),
            categories: localFilters.categories.map(c => typeof c === 'string' ? c.toLowerCase() : c),
            subBrands: (localFilters.subBrands || []).map(s => typeof s === 'string' ? s.toLowerCase() : s),
            skus: localFilters.skus.map(s => typeof s === 'string' ? s.toLowerCase() : s),
            sapCodes: localFilters.sapCodes || [],
            skuName: localFilters.skus.map(s => typeof s === 'string' ? s.toLowerCase() : s),
            skuCode: localFilters.skus
                .map(s => dynamicSkus.find(opt => String(opt.id).toLowerCase() === String(s).toLowerCase() || String(opt.name).toLowerCase() === String(s).toLowerCase())?.webPid)
                .filter(Boolean),
            grammages: localFilters.grammages,
        };
        onApply(lowerFilters)
        onClose()
    }

    // Determine which filters to show based on current dimension
    const showPlatformFilter = currentDimension !== 'platform'
    const showBrandFilter = currentDimension !== 'brand'
    const showCategoryFilter = currentDimension !== 'category'
    const showSubBrandFilter = currentDimension !== 'sub_brand'
    const showSkuFilter = currentDimension !== 'sku'

    const subBrandsAvailable = (subBrandsContext && subBrandsContext.length > 0) || (dynamicSubBrands && dynamicSubBrands.length > 0)

    const activeFilterCount = [
        showBrandFilter && localFilters.brands.length > 0,
        showSubBrandFilter && subBrandsAvailable && localFilters.subBrands && localFilters.subBrands.length > 0,
        showCategoryFilter && localFilters.categories.length > 0,
        showPlatformFilter && localFilters.platforms.length > 0,
        showSkuFilter && localFilters.skus.length > 0,
        isDrlUser && localFilters.sapCodes && localFilters.sapCodes.length > 0,
        localFilters.grammages && localFilters.grammages.length > 0,
        localFilters.msl === '1',
    ].filter(Boolean).length

    // Get dimension label for context
    const dimensionLabels = {
        platform: 'Platform',
        location: 'City',
        brand: 'Brand',
        month: 'Month',
        category: 'Category',
        sku: 'SKU',
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
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="advanced-filters-title"
                            className="w-full max-w-[640px] max-h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto border border-slate-200"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
                                        <SlidersHorizontal size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 id="advanced-filters-title" className="text-base font-bold text-slate-900">Advanced Filters</h2>
                                        <p className="text-xs text-slate-500">
                                            {activeFilterCount > 0
                                                ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`
                                                : `Customize ${dimensionLabels[currentDimension] || 'overview'} overview`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    aria-label="Close advanced filters"
                                    className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                                >
                                    <X size={18} className="text-slate-400" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 no-scrollbar">
                                {/* Dimension Filters */}
                                <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs text-slate-700 uppercase tracking-[0.1em] font-bold">
                                            Entities
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {showBrandFilter && (
                                            <MultiSelectDropdown
                                                label="Brand"
                                                icon={Tag}
                                                options={dynamicBrands}
                                                selected={localFilters.brands}
                                                onChange={(val) => updateFilter('brands', val)}
                                                placeholder="All Brands"
                                            />
                                        )}
                                        {showSubBrandFilter && subBrandsAvailable && (
                                            <MultiSelectDropdown
                                                label="Sub Brand"
                                                icon={Tag}
                                                options={dynamicSubBrands.length > 0 ? dynamicSubBrands : (subBrandsContext || []).map(s => ({ id: String(s).toLowerCase(), name: String(s) }))}
                                                selected={localFilters.subBrands || []}
                                                onChange={(val) => updateFilter('subBrands', val)}
                                                placeholder="All Sub Brands"
                                            />
                                        )}
                                        {showCategoryFilter && (
                                            <MultiSelectDropdown
                                                label="Category"
                                                icon={Package}
                                                options={dynamicCategories}
                                                selected={localFilters.categories}
                                                onChange={(val) => updateFilter('categories', val)}
                                                placeholder="All Categories"
                                            />
                                        )}
                                        {showPlatformFilter && (
                                            <MultiSelectDropdown
                                                label="Platform"
                                                icon={Monitor}
                                                options={platformScope ? dynamicPlatforms.filter(option => platformScope.some(p => p.toLowerCase() === String(option.name).toLowerCase())) : dynamicPlatforms}
                                                selected={localFilters.platforms}
                                                onChange={(val) => updateFilter('platforms', val)}
                                                placeholder="All Platforms"
                                            />
                                        )}
                                        {showSkuFilter && (
                                            <MultiSelectDropdown
                                                label="Sku"
                                                icon={Package}
                                                options={dynamicSkus}
                                                selected={localFilters.skus}
                                                onChange={(val) => updateFilter('skus', val)}
                                                placeholder="All Skus"
                                                showSapCode={isDrlUser}
                                            />
                                        )}
                                        {isDrlUser && (
                                            <MultiSelectDropdown
                                                label="SAP Code"
                                                icon={Hash}
                                                options={dynamicSapCodes}
                                                selected={localFilters.sapCodes || []}
                                                onChange={(val) => updateFilter('sapCodes', val)}
                                                placeholder="All SAP Codes"
                                            />
                                        )}
                                        <MultiSelectDropdown
                                            label="Grammage"
                                            icon={Filter}
                                            options={dynamicGrammages}
                                            selected={localFilters.grammages || []}
                                            onChange={(val) => updateFilter('grammages', val)}
                                            placeholder="All Grammages"
                                        />
                                        <SingleSelectDropdown
                                            label="Top SKU"
                                            icon={Filter}
                                            options={[
                                                { id: '0', name: 'All SKUs' },
                                                { id: '1', name: 'Top SKUs' }
                                            ]}
                                            value={localFilters.msl || '0'}
                                            onChange={(val) => updateFilter('msl', val)}
                                            placeholder="Top SKU Status"
                                        />
                                    </div>
                                </section>

                                {/* Both controls edit the same shared time period. */}
                                <section className="rounded-2xl border border-slate-200 p-4">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={15} className="text-blue-600" />
                                            <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Date range</span>
                                        </div>
                                        <span className="text-xs text-slate-500">Changes apply immediately to Time Period above</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <label className="block text-xs font-semibold text-slate-600">
                                            From
                                            <input
                                                type="date"
                                                value={timeStart?.format('YYYY-MM-DD') || ''}
                                                onChange={(e) => updateDateRange('from', e.target.value)}
                                                min={minDateStr}
                                                max={maxDateStr}
                                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                        <label className="block text-xs font-semibold text-slate-600">
                                            To
                                            <input
                                                type="date"
                                                value={timeEnd?.format('YYYY-MM-DD') || ''}
                                                onChange={(e) => updateDateRange('to', e.target.value)}
                                                min={minDateStr}
                                                max={maxDateStr}
                                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                </section>

                                {/* KPI Selection */}
                                <section className="rounded-2xl border border-slate-200 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Filter size={12} className="text-slate-400" />
                                            <span className="text-xs text-slate-700 uppercase tracking-[0.1em] font-bold">
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
                                    <div className="max-h-[190px] overflow-y-auto pr-1">
                                        <div className="flex flex-wrap gap-2">
                                            {kpisToUse.map(kpi => {
                                                const isSelected = localFilters.kpis.includes(kpi.key)
                                                return (
                                                    <motion.button
                                                        key={kpi.key}
                                                        onClick={() => toggleKpi(kpi.key)}
                                                        className={cn(
                                                            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border',
                                                            isSelected
                                                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                                                        )}
                                                        whileHover={{ y: -1 }}
                                                        whileTap={{ scale: 0.98 }}
                                                    >
                                                        <div className={cn(
                                                            'w-1.5 h-1.5 rounded-full',
                                                            isSelected ? 'bg-blue-600' : 'bg-slate-300'
                                                        )} />
                                                        {kpi.label}
                                                    </motion.button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-slate-200 bg-white">
                                <button
                                    onClick={resetFilters}
                                    className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors"
                                >
                                    <RotateCcw size={13} />
                                    Reset filters
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={onClose}
                                        className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <motion.button
                                        onClick={handleApply}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-blue-700 transition-colors"
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
