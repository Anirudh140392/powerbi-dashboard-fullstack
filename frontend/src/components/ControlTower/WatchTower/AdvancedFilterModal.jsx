import { useState, useRef, useEffect, useContext, useMemo } from 'react'
import { FilterContext } from '../../../utils/FilterContext'
import { motion, AnimatePresence } from 'framer-motion'
import axiosInstance from '../../../api/axiosInstance'
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

// ========================================
// MOCK DATA (replace with API/DB later)
// ========================================
const mockBrands = [
    { id: 'amul', name: 'Amul' },
    { id: 'mother-dairy', name: 'Mother Dairy' },
    { id: 'vadilal', name: 'Vadilal' },
    { id: 'havmor', name: 'Havmor' },
    { id: 'baskin-robbins', name: 'Baskin Robbins' },
    { id: 'london-dairy', name: 'London Dairy' },
    { id: 'kwality-walls', name: 'Kwality Walls' },
]

const mockCategories = [
    { id: 'cone', name: 'Cone' },
    { id: 'cup', name: 'Cup' },
    { id: 'stick', name: 'Stick' },
    { id: 'tub', name: 'Tub' },
    { id: 'bar', name: 'Bar' },
    { id: 'family-pack', name: 'Family Pack' },
]

const mockSkus = [
    { id: 'amul-tricone', name: 'Amul Tricone 120ml' },
    { id: 'md-cup', name: 'Mother Dairy Vanilla Cup' },
    { id: 'vadilal-bombay', name: 'Vadilal Bombay Kulfi' },
    { id: 'havmor-block', name: 'Havmor Choco Block' },
    { id: 'br-scoop', name: 'BR Gold Medal Ribbon' },
    { id: 'london-tub', name: 'London Dairy Tiramisu' },
]

const mockCategoriesAlt = [
    { id: 'cat1', name: 'Cookware' },
    { id: 'cat2', name: 'Kitchen Appliances' },
    { id: 'cat3', name: 'Home Appliances' },
    { id: 'cat4', name: 'Lighting' },
    { id: 'cat5', name: 'Personal Care' },
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
    { key: 'spend', label: 'Spend' },
    { key: 'tacos', label: 'TACoS' },
    { key: 'roas_x', label: 'ROAS' },
    { key: 'categorySize', label: 'Category size' },
    { key: 'inorgSales', label: 'Inorg Sales' },
    { key: 'conversion', label: 'Conversion' },
    { key: 'availability', label: 'Availability' },
    { key: 'shareOfVolume', label: 'Share of Search' },
    { key: 'ad_sov', label: 'Ad SOV' },
    { key: 'organic_sov', label: 'Organic SOV' },
    { key: 'marketShare', label: 'Market share' },
    { key: 'cpm', label: 'CPM' },
    { key: 'cpc', label: 'CPC' },
    { key: 'aov', label: 'AOV' },
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
                    'w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200',
                    isOpen
                        ? 'border-slate-400 ring-2 ring-slate-200 bg-white'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                )}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Icon size={16} className="text-slate-400 flex-shrink-0" />
                    <div className="flex flex-col items-start min-w-0 text-left">
                        <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider leading-none mb-1">
                            {label}
                        </span>
                        <span className="text-xs text-slate-700 font-medium truncate leading-none">
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
                    'w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200',
                    isOpen
                        ? 'border-slate-400 ring-2 ring-slate-200 bg-white'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                )}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Icon size={16} className="text-slate-400 flex-shrink-0" />
                    <div className="flex flex-col items-start min-w-0 text-left">
                        <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider leading-none mb-1">
                            {label}
                        </span>
                        <span className="text-xs text-slate-700 font-medium truncate leading-none">
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
export default function AdvancedFilterModal({ isOpen, onClose, filters, onApply, currentDimension = 'platform', brands = null, categories = null, platforms = null, skus = null, kpiOptions: propKpiOptions = null }) {
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
        skus: [],
        sapCodes: [],
        grammages: [],
        dateFrom: '',
        dateTo: '',
        msl: '0',
        kpis: ['offtakes', 'spend', 'categorySize', 'availability', 'marketShare', 'conversion', 'aov'].filter(k => {
            if (currentDimension === 'sku') {
                if (k === 'categorySize' || k === 'shareOfVolume' || k === 'ad_sov' || k === 'organic_sov') return false;
                if (isBoatUser && (k === 'spend' || k === 'conversion')) return false;
                return true;
            }
            if (currentDimension === 'brand') return k !== 'categorySize' && k !== 'marketShare';
            return true;
        }),
        filterLogic: 'OR',
    })

    const { maxDate, selectedChannel, selectedLocation, platform: globalPlatform, selectedBrand, selectedCategory, selectedMsl, timeStart, timeEnd } = useContext(FilterContext)
    const maxDateStr = useMemo(() => maxDate?.format('YYYY-MM-DD'), [maxDate])

    const [dynamicBrands, setDynamicBrands] = useState([])
    const [dynamicCategories, setDynamicCategories] = useState([])
    const [dynamicPlatforms, setDynamicPlatforms] = useState([])
    const [dynamicSkus, setDynamicSkus] = useState([])
    const [dynamicSapCodes, setDynamicSapCodes] = useState([])
    const [dynamicGrammages, setDynamicGrammages] = useState([])
    const [loadingFilters, setLoadingFilters] = useState(false)

    // Synchronize initial options from props when props change
    useEffect(() => {
        if (brands && brands.length) {
            setDynamicBrands(brands)
        } else {
            setDynamicBrands(mockBrands)
        }
    }, [brands])

    useEffect(() => {
        if (categories && categories.length) {
            setDynamicCategories(categories)
        } else {
            setDynamicCategories(mockCategories)
        }
    }, [categories])

    useEffect(() => {
        if (platforms && platforms.length) {
            setDynamicPlatforms(platforms)
        } else {
            setDynamicPlatforms(mockPlatforms)
        }
    }, [platforms])

    useEffect(() => {
        if (skus && skus.length) {
            setDynamicSkus(skus)
        } else {
            setDynamicSkus([])
        }
    }, [skus])


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

                const startDate = localFilters.dateFrom || (timeStart ? timeStart.format('YYYY-MM-DD') : undefined);
                const endDate = localFilters.dateTo || (timeEnd ? timeEnd.format('YYYY-MM-DD') : undefined);

                const params = {
                    channel: cleanParam(selectedChannel),
                    location: cleanParam(selectedLocation),
                    platform: cleanParam(activePlatforms),
                    brand: cleanParam(activeBrands),
                    category: cleanParam(activeCategories),
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
                            category: params.category
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
                        setDynamicBrands(mappedBrands.length ? mappedBrands : mockBrands)
                    }

                    if (data.categories && Array.isArray(data.categories)) {
                        const mappedCategories = data.categories.map(c => {
                            const parentOpt = categories?.find(opt => opt.name?.toLowerCase() === c.toLowerCase() || opt.id?.toLowerCase() === c.toLowerCase())
                            if (parentOpt) return parentOpt
                            return { id: c, name: c }
                        })
                        setDynamicCategories(mappedCategories.length ? mappedCategories : mockCategories)
                    }

                    if (data.platforms && Array.isArray(data.platforms)) {
                        const mappedPlatforms = data.platforms.map(p => {
                            const parentOpt = platforms?.find(opt => opt.name?.toLowerCase() === p.toLowerCase() || opt.id?.toLowerCase() === p.toLowerCase())
                            if (parentOpt) return parentOpt
                            return { id: p.toLowerCase().replace(/\s+/g, '_'), name: p }
                        })
                        setDynamicPlatforms(mappedPlatforms.length ? mappedPlatforms : mockPlatforms)
                    }
                }

                if (productsRes.status === 'fulfilled' && productsRes.value.data && Array.isArray(productsRes.value.data)) {
                    const sapSet = new Set();
                    const sapOpts = [];
                    const mappedSkus = productsRes.value.data.map(p => {
                        // Shared endpoint returns identifiers for every client.
                        const productName = typeof p === 'object' ? (p.name || p.product_name || '') : String(p);
                        const sapCode = typeof p === 'object' ? (p.sapCode || p.sap_code || null) : null;
                        const webPid = typeof p === 'object' ? (p.webPid || p.web_pid || null) : null;

                        if (sapCode && !sapSet.has(String(sapCode))) {
                            sapSet.add(String(sapCode));
                            sapOpts.push({ id: String(sapCode), name: String(sapCode) });
                        }

                        const parentOpt = skus?.find(opt =>
                            opt.name?.toLowerCase() === productName.toLowerCase() ||
                            opt.id?.toLowerCase() === productName.toLowerCase()
                        );
                        if (parentOpt) return { ...parentOpt, sapCode: sapCode ?? parentOpt.sapCode ?? null, webPid: webPid ?? parentOpt.webPid ?? null };
                        return { id: productName, name: productName, sapCode, webPid };
                    }).filter(p => p.name);
                    setDynamicSkus(mappedSkus);
                    sapOpts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                    setDynamicSapCodes(sapOpts);
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
        localFilters.dateFrom,
        localFilters.dateTo,
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
        if (!isOpen || currentDimension !== 'sku') return;

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

                const startDate = localFilters.dateFrom || (timeStart ? timeStart.format('YYYY-MM-DD') : undefined);
                const endDate = localFilters.dateTo || (timeEnd ? timeEnd.format('YYYY-MM-DD') : undefined);

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
        localFilters.dateFrom,
        localFilters.dateTo,
        selectedChannel,
        selectedLocation,
        globalPlatform,
        selectedCategory,
    ])

    // Sync with parent filters + FilterContext when modal opens
    useEffect(() => {
        if (!isOpen) return;

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

            const platforms = (filters?.platforms && filters.platforms.length > 0)
                ? filters.platforms
                : normalizeArr(globalPlatform);

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
                msl,
                sapCodes,
            };
        });
    }, [isOpen, filters, selectedCategory, selectedBrand, globalPlatform, selectedMsl]);

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
            skus: [],
            sapCodes: [],
            grammages: [],
            dateFrom: '',
            dateTo: '',
            msl: '0',
            kpis: ['offtakes', 'spend', 'categorySize', 'availability', 'marketShare', 'conversion', 'aov'].filter(k => {
                if (currentDimension === 'sku') {
                    if (k === 'categorySize' || k === 'shareOfVolume' || k === 'ad_sov' || k === 'organic_sov') return false;
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
    const showSkuFilter = currentDimension !== 'sku'

    const activeFilterCount = [
        showBrandFilter && localFilters.brands.length > 0,
        showCategoryFilter && localFilters.categories.length > 0,
        showPlatformFilter && localFilters.platforms.length > 0,
        showSkuFilter && localFilters.skus.length > 0,
        isDrlUser && localFilters.sapCodes && localFilters.sapCodes.length > 0,
        localFilters.msl === '1',
    ].filter(Boolean).length

    // Get dimension label for context
    const dimensionLabels = {
        platform: 'Platform',
        brand: 'Brand',
        category: 'Category',
        sku: 'Sku',
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
                                                options={dynamicBrands}
                                                selected={localFilters.brands}
                                                onChange={(val) => updateFilter('brands', val)}
                                                placeholder="All Brands"
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
                                                options={dynamicPlatforms}
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
                                        {(currentDimension === 'sku' && dynamicGrammages.length > 0) && (
                                            <MultiSelectDropdown
                                                label="Grammage"
                                                icon={Filter}
                                                options={dynamicGrammages}
                                                selected={localFilters.grammages || []}
                                                onChange={(val) => updateFilter('grammages', val)}
                                                placeholder="All Grammages"
                                            />
                                        )}
                                        <SingleSelectDropdown
                                            label="MSL"
                                            icon={Filter}
                                            options={[
                                                { id: '0', name: 'All SKUs' },
                                                { id: '1', name: 'Top SKUs' }
                                            ]}
                                            value={localFilters.msl || '0'}
                                            onChange={(val) => updateFilter('msl', val)}
                                            placeholder="MSL Status"
                                        />
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
                                                max={maxDateStr}
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-100 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all bg-slate-50/30"
                                            />
                                        </div>
                                        <div className="relative">
                                            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1 block">To</label>
                                            <input
                                                type="date"
                                                value={localFilters.dateTo}
                                                onChange={(e) => updateFilter('dateTo', e.target.value)}
                                                max={maxDateStr}
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
