import { useState, useMemo, useContext, useEffect, useCallback, useRef } from 'react'
import axiosInstance from '../../../api/axiosInstance'
import { motion } from 'framer-motion'
import { FilterContext } from '../../../utils/FilterContext'
import {
    TrendingUp,
    TrendingDown,
    Monitor,
    Tag,
    Calendar,
    Grid3X3,
    Package,
    LineChart,
    MapPin,
    SlidersHorizontal,
} from 'lucide-react'
import AdvancedFilterModal from './AdvancedFilterModal'
import { cn } from '../../../lib/utils'
import FlipkartLogo from '@/lib/Flipkart logo.png'

/* --- HELPER COMPONENTS & UTILS --- */
const BrandLogo = ({ name, src, className, imgClassName }) => {
    const [error, setError] = useState(false);

    if (error || !src) {
        return (
            <div className={cn("flex items-center justify-center font-bold text-white uppercase", className)}
                style={{ fontSize: '10px' }}>
                {name?.slice(0, 1) || '?'}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={name}
            className={cn(className, "object-contain")}
            onError={() => setError(true)}
        />
    );
};

const getStatusText = (delta) => {
    if (!delta) return "text-slate-500";
    return delta.dir === 'up' ? "text-emerald-500" : "text-rose-500";
};

const copy = (title, value) => {
    navigator.clipboard.writeText(`${title}: ${value}`);
};

// Truncate text to a given number of words, appending "..." if truncated
const truncateToWords = (text, maxWords = 5) => {
    if (!text) return '';
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
};

const cardSize = {
    minW: 'min-w-[100px] sm:min-w-[125px]',
    py: 'py-2 sm:py-2.5',
    text: 'text-[13px] sm:text-[15px]',
    delta: 'text-[9px] sm:text-[10px]'
};

const kpiLabels = {
    offtakes: 'Offtakes',
    spend: 'Spend',
    roas: 'Category size',
    availability: 'Availability',
    marketShare: 'Market share',
    conversion: 'Conversion',
    shareOfVolume: 'Share of Volume',
    ad_sov: 'Ad SOV',
    organic_sov: 'Organic SOV',
    inorgSales: 'Inorganic Sales',
    dspSales: 'DSP Sales',
    promoMyBrand: 'Promo - My Brand',
    promoCompete: 'Promo - Compete',
    cpm: 'CPM',
    cpc: 'CPC',
    asp: 'ASP'
};

// Map backend KPI title → frontend kpiKey
const BACKEND_TITLE_TO_KEY = {
    'Offtakes': 'offtakes',
    'Category Size': 'roas',
    'Spend': 'spend',
    'ROAS': 'roas_x',
    'Inorg Sales': 'inorgSales',
    'Conversion': 'conversion',
    'Availability': 'availability',
    'SOS': 'shareOfVolume',
    'Ad SOV': 'ad_sov',
    'Organic SOV': 'organic_sov',
    'Market Share': 'marketShare',
    'Promo My Brand': 'promoMyBrand',
    'Promo Compete': 'promoCompete',
    'CPM': 'cpm',
    'CPC': 'cpc',
}

// Map backend API response entity → frontend entity format
const mapApiEntityToFrontend = (apiEntity) => {
    const data = {}
    if (apiEntity.columns && Array.isArray(apiEntity.columns)) {
        apiEntity.columns.forEach(col => {
            const key = BACKEND_TITLE_TO_KEY[col.title]
            if (key) {
                const changeText = col.change?.text || '0%'
                const isPositive = col.change?.positive !== false
                data[key] = {
                    value: col.value || '0',
                    delta: {
                        value: changeText.replace(/^[+-]/, ''),
                        dir: isPositive ? 'up' : 'down'
                    }
                }
            }
        })
    }
    return data
}

// Dimension → API endpoint mapping
const DIMENSION_API_MAP = {
    platform: '/watchtower/platform-overview',
    brand: '/watchtower/brands-overview',
    month: '/watchtower/month-overview',
    category: '/watchtower/category-overview',
    sku: '/watchtower/sku-overview',
}

// Color palette for dynamically created entities
const ENTITY_COLORS = ['#6366f1', '#8b5cf6', '#f97316', '#14b8a6', '#e11d48', '#06b6d4', '#0ea5e9', '#22c55e', '#eab308', '#ec4899', '#a855f7', '#f43f5e']

const PlatformOverviewNew = ({
    onViewTrends = () => { },
    onViewRca = () => { },
}) => {
    const {
        selectedChannel,
        platform: globalPlatform,
        selectedBrand,
        brands: globalBrands,
        selectedCategory,
        categories: globalCategories,
        selectedLocation,
        platforms: globalPlatforms,
        timeStart,
        timeEnd,
        compareStart,
        compareEnd,
        datesFetched,
        platformsFetched
    } = useContext(FilterContext);

    const kpis = [
        { key: 'offtakes', label: 'Offtakes' },
        { key: 'spend', label: 'Spend' },
        { key: 'roas', label: 'Category size' },
        { key: 'inorgSales', label: 'Inorg Sales' },
        { key: 'dspSales', label: 'DSP Sales' },
        { key: 'conversion', label: 'Conversion' },
        { key: 'availability', label: 'Availability' },
        { key: 'shareOfVolume', label: 'Share of Volume' },
        { key: 'ad_sov', label: 'Ad SOV' },
        { key: 'organic_sov', label: 'Organic SOV' },
        { key: 'marketShare', label: 'Market share' },
        { key: 'promoMyBrand', label: 'Promo - My Brand' },
        { key: 'promoCompete', label: 'Promo - Compete' },
        { key: 'cpm', label: 'CPM' },
        { key: 'cpc', label: 'CPC' },
        { key: 'asp', label: 'ASP' },
    ]
    // Dimension for glance view (single select)
    const [dimension, setDimension] = useState('platform')

    // Filter out Category size (key: 'roas') when viewing SKU dimension
    const filteredKpis = dimension === 'sku' ? kpis.filter(k => k.key !== 'roas') : kpis;
    const defaultKpiKeys = dimension === 'sku'
        ? ['offtakes', 'spend', 'availability', 'marketShare', 'conversion']
        : ['offtakes', 'spend', 'roas', 'availability', 'marketShare', 'conversion'];

    const [glanceKpis, setGlanceKpis] = useState(defaultKpiKeys)
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
    const [apiData, setApiData] = useState({})
    const [apiLoading, setApiLoading] = useState(false)
    const [apiError, setApiError] = useState(null)
    const [isRetrying, setIsRetrying] = useState(false)
    const [productOptions, setProductOptions] = useState([])
    const [advancedFilters, setAdvancedFilters] = useState({
        brands: [],
        categories: [],
        platforms: [],
        skus: [],
        skuName: '',
        skuCode: '',
        dateFrom: '',
        dateTo: '',
        kpis: defaultKpiKeys,
        filterLogic: 'OR',
    })
    const fetchIdRef = useRef(0)

    // Re-sync glanceKpis when dimension changes (remove 'roas'/Category size for SKU)
    useEffect(() => {
        if (dimension === 'sku') {
            setGlanceKpis(prev => prev.filter(k => k !== 'roas'));
        }
    }, [dimension]);

    // Static dimension metadata (icons, logos for known platforms)
    const dimensionMeta = {
        platform: { label: 'Platform', icon: Monitor },
        brand: { label: 'Brand', icon: Tag },
        month: { label: 'Month', icon: Calendar },
        category: { label: 'Category', icon: Grid3X3 },
        sku: { label: 'SKU', icon: Package },
    }

    // Known platform logos for enriching API data
    const platformLogos = {
        'blinkit': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Blinkit-yellow-app-icon.svg',
        'instamart': '\instamart_photo.png',
        'swiggy instamart': '\instamart_photo.png',
        'swiggy': '\instamart_photo.png',
        'zepto': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Zepto_Logo.svg',
        'flipkart': FlipkartLogo,
        'amazon': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
    }
    const platformColors = {
        'blinkit': '#fbbf24', 'instamart': '#f97316', 'swiggy instamart': '#f97316', 'swiggy': '#f97316',
        'zepto': '#8b5cf6', 'flipkart': '#2874f0', 'amazon': '#f59e0b',
    }

    // Fetch data from backend API when dimension or filters change
    const fetchDimensionData = useCallback(async () => {
        const endpoint = DIMENSION_API_MAP[dimension]
        if (!endpoint) return

        setApiLoading(true)
        setApiError(null)
        try {
            // Priority: Local Advanced Filters > Global Context Filters
            const reqPlatform = advancedFilters.platforms?.length > 0 ? advancedFilters.platforms.join(',')
                : (globalPlatform === 'All' ? undefined : (Array.isArray(globalPlatform) ? globalPlatform.join(',') : globalPlatform));

            const reqBrand = advancedFilters.brands?.length > 0 ? advancedFilters.brands.join(',')
                : undefined;

            const reqCategory = advancedFilters.categories?.length > 0 ? advancedFilters.categories.join(',')
                : (selectedCategory === 'All' ? undefined : (Array.isArray(selectedCategory) ? selectedCategory.join(',') : selectedCategory));

            const reqStartDate = advancedFilters.dateFrom ? advancedFilters.dateFrom
                : (timeStart ? timeStart.format('YYYY-MM-DD') : undefined);

            const reqEndDate = advancedFilters.dateTo ? advancedFilters.dateTo
                : (timeEnd ? timeEnd.format('YYYY-MM-DD') : undefined);

            // Combine SKUs filter mapping specifically
            let skuNameParam, skuCodeParam;
            if (advancedFilters.skus?.length > 0) {
                skuNameParam = advancedFilters.skus.join(',');
            } else if (advancedFilters.skuName) {
                skuNameParam = advancedFilters.skuName;
            }
            skuCodeParam = advancedFilters.skuCode || undefined;

            const params = {
                platform: reqPlatform,
                brand: reqBrand,
                category: reqCategory,
                location: selectedLocation === 'All' ? undefined : (Array.isArray(selectedLocation) ? selectedLocation.join(',') : selectedLocation),
                startDate: reqStartDate,
                endDate: reqEndDate,
                compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : undefined,
                compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : undefined,
                channel: selectedChannel || undefined,
                skuName: skuNameParam,
                skuCode: skuCodeParam,
                filterLogic: advancedFilters.filterLogic || 'OR'
            }
            console.log(`[PlatformOverviewNew] Fetching ${dimension} data from ${endpoint}`, params)
            const res = await axiosInstance.get(endpoint, { params, timeout: 60000 })

            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                console.log(`[PlatformOverviewNew] Got ${res.data.length} ${dimension} entities from API`)
                setApiData(prev => ({ ...prev, [dimension]: res.data }))
            } else {
                console.warn(`[PlatformOverviewNew] Empty response for ${dimension}`)
                setApiData(prev => ({ ...prev, [dimension]: [] }))
            }
        } catch (err) {
            console.error(`[PlatformOverviewNew] API error for ${dimension}:`, err.message)
            setApiError(err.message || `Failed to load ${dimension} data`)
            setApiData(prev => ({ ...prev, [dimension]: null }))
        } finally {
            setApiLoading(false)
        }
    }, [dimension, globalPlatform, selectedCategory, selectedLocation, timeStart, timeEnd, compareStart, compareEnd, selectedChannel, advancedFilters])

    useEffect(() => {
        if (!datesFetched || !platformsFetched) {
            console.log("[PlatformOverviewNew] Waiting for context to initialize dates/platforms...");
            return;
        }

        const currentFetchId = ++fetchIdRef.current;

        const debounceTimer = setTimeout(() => {
            // Skip if a newer update arrived during the debounce window
            if (currentFetchId !== fetchIdRef.current) return;
            fetchDimensionData()
        }, 800);

        return () => clearTimeout(debounceTimer);
    }, [fetchDimensionData, datesFetched, platformsFetched])

    // Fetch product/SKU options from DB for the filter dropdown
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const params = {};
                if (globalPlatform && globalPlatform !== 'All') {
                    params.platform = Array.isArray(globalPlatform) ? globalPlatform[0] : globalPlatform;
                }
                const res = await axiosInstance.get('/watchtower/products', { params });
                if (res.data && Array.isArray(res.data)) {
                    setProductOptions(res.data.map(p => ({ id: p, name: p })));
                }
            } catch (err) {
                console.warn('[PlatformOverviewNew] Failed to fetch products for filter:', err.message);
            }
        };
        if (datesFetched) {
            fetchProducts();
        }
    }, [datesFetched, globalPlatform])

    // Retry function for error state
    const retryFetch = async () => {
        setIsRetrying(true)
        await fetchDimensionData()
        setIsRetrying(false)
    }

    // Handle filter apply from modal
    const handleApplyFilters = (filters) => {
        setAdvancedFilters(filters)
        setGlanceKpis(filters.kpis)
    }
    // Count active dimension filters
    const activeDimensionFilters = [
        advancedFilters.brands?.length > 0,
        advancedFilters.categories?.length > 0,
        advancedFilters.platforms?.length > 0,
        advancedFilters.skuName?.length > 0,
        advancedFilters.skuCode?.length > 0,
    ].filter(Boolean).length

    const currentDimension = dimensionMeta[dimension] || dimensionMeta.platform
    // Get selected KPIs in order
    const selectedKpis = filteredKpis.filter(k => glanceKpis.includes(k.key))
    const kpiCount = selectedKpis.length

    // Build entities from API data only — NO hardcoded fallback
    const entities = useMemo(() => {
        const rawApiEntities = apiData[dimension]

        let result = []
        if (rawApiEntities && rawApiEntities.length > 0) {
            // Use real API data
            result = rawApiEntities.map((apiEntity, idx) => {
                const key = (apiEntity.key || apiEntity.label || `entity-${idx}`).toLowerCase()
                const name = apiEntity.label || apiEntity.key || `Entity ${idx + 1}`
                const logoSrc = apiEntity.logo || platformLogos[key] || null
                const color = platformColors[key] || ENTITY_COLORS[idx % ENTITY_COLORS.length]
                return {
                    key,
                    name,
                    logoSrc,
                    color,
                    data: mapApiEntityToFrontend(apiEntity)
                }
            })
        }

        // When dimension is 'platform' and a specific platform is selected,
        // only show the 'All' row + selected platform rows (remove unselected 0-value rows)
        if (dimension === 'platform' && globalPlatform && globalPlatform !== 'All') {
            const selectedPlatforms = Array.isArray(globalPlatform)
                ? globalPlatform.map(p => p.toLowerCase())
                : globalPlatform.split(',').map(p => p.trim().toLowerCase())

            result = result.filter(e => {
                const entityKey = e.key.toLowerCase()
                const entityName = e.name.toLowerCase()
                // Always keep the 'All' row
                if (entityKey === 'all' || entityName === 'all') return true
                // Keep rows matching selected platforms
                return selectedPlatforms.some(p => entityKey.includes(p) || entityName.includes(p) || p.includes(entityKey))
            })
        }

        return result
    }, [apiData, dimension, globalPlatform])

    const SectionWrapper = ({
        title,
        icon: Icon,
        children,
        className = '',
        chip,
        headerRight
    }) => {
        return (
            <motion.div
                className={`bg-white rounded-3xl shadow-lg border border-slate-100/60 ${className}`}
                style={{ boxShadow: '0 2px 0px rgba(0, 0, 0, 0.04)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                {/* Header */}
                <div className="px-3 py-3 sm:px-6 sm:py-4 border-b border-slate-100/60">
                    <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
                        {/* Left: Icon + Title + Chip */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <Icon size={18} className="text-blue-600 sm:w-5 sm:h-5" />
                            </div>
                            <span className="text-[14px] sm:text-[17px] font-bold text-slate-900" style={{ fontFamily: 'Roboto, sans-serif' }}>{title}</span>
                            {/* {chip && (
                                <span className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full border border-slate-200">
                                    {chip}
                                </span>
                            )} */}
                        </div>

                        {/* Right: Custom Actions */}
                        {headerRight && (
                            <div className="flex items-center gap-3">
                                {headerRight}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-3 sm:p-6">
                    {children}
                </div>
            </motion.div>
        )
    }
    return (
        <>
            <div>
                {/* SECTION 2: Performance Matrix - Wrapped in PowerBI Container */}
                <SectionWrapper
                    title="Platform Overview"
                    icon={currentDimension.icon}
                    chip={`${entities.length} ${currentDimension.label} × ${kpiCount} KPIs`}
                    headerRight={
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            {/* Dimension Tabs */}
                            <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/50 overflow-x-auto no-scrollbar max-w-full">
                                {Object.entries(dimensionMeta).map(([key, dim]) => {
                                    const isSelected = dimension === key
                                    const DimIcon = dim.icon
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setDimension(key)}
                                            className={cn(
                                                'flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-bold transition-all whitespace-nowrap',
                                                isSelected
                                                    ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            )}
                                            style={{ fontFamily: 'Roboto, sans-serif' }}
                                        >
                                            <DimIcon size={13} className="flex-shrink-0" />
                                            <span className="hidden xs:inline sm:inline">{dim.label}</span>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Advanced Filter Modal Trigger */}
                            <motion.button
                                onClick={() => setIsFilterModalOpen(true)}
                                className={cn(
                                    'hidden sm:flex',
                                    'items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border',
                                    activeDimensionFilters > 0
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                )}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <SlidersHorizontal size={14} />
                                <span>Filters</span>
                                {activeDimensionFilters > 0 && (
                                    <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                        {activeDimensionFilters}
                                    </span>
                                )}
                                <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full">
                                    {kpiCount} KPIs
                                </span>
                            </motion.button>

                            {/* Mobile-only compact filter trigger */}
                            <motion.button
                                onClick={() => setIsFilterModalOpen(true)}
                                className={cn(
                                    'flex sm:hidden items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 border',
                                    activeDimensionFilters > 0
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-600 border-slate-200'
                                )}
                                whileTap={{ scale: 0.95 }}
                            >
                                <SlidersHorizontal size={12} />
                                {activeDimensionFilters > 0 && (
                                    <span className="bg-emerald-500 text-white text-[9px] px-1 py-0.5 rounded-full">
                                        {activeDimensionFilters}
                                    </span>
                                )}
                            </motion.button>

                            {/* Legend indicators */}
                            <div className="hidden sm:flex items-center gap-2">
                                <span className="flex items-center gap-1.5 text-[9px] text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded-full font-bold border border-emerald-100/50 uppercase tracking-tight">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500"></span> Growth
                                </span>
                                <span className="flex items-center gap-1.5 text-[9px] text-rose-600 bg-rose-50/50 px-2 py-0.5 rounded-full font-bold border border-rose-100/50 uppercase tracking-tight">
                                    <span className="w-1 h-1 rounded-full bg-rose-500"></span> Decline
                                </span>
                            </div>
                        </div>
                    }
                >
                    {/* Grid Content - Or Error/Loading State */}
                    {apiLoading ? (
                        /* Loading skeleton rows */
                        <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="flex items-center gap-2 sm:gap-3 px-1 sm:px-2">
                                    <div className="w-36 sm:w-56 flex-shrink-0 flex items-center gap-2 sm:gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-slate-100 animate-pulse" />
                                        <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                                    </div>
                                    {selectedKpis.map(kpi => (
                                        <div key={kpi.key} className="flex-1 min-w-[125px] px-3 py-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="h-4 w-16 mx-auto bg-slate-100 rounded animate-pulse mb-1" />
                                            <div className="h-3 w-10 mx-auto bg-slate-100 rounded animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ) : apiError && entities.length === 0 ? (
                        /* Error state with Refresh button */
                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[200px] gap-4">
                            <div className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-semibold text-slate-800 mb-1">Failed to load Platform Overview</h3>
                                <p className="text-sm text-slate-500 mb-4">{apiError}</p>
                            </div>
                            <button
                                onClick={retryFetch}
                                disabled={isRetrying}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all
                                    ${isRetrying
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-slate-700 text-white hover:bg-slate-800 shadow-md hover:shadow-lg'
                                    }`}
                            >
                                {isRetrying ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-500" />
                                        <span>Retrying...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Refresh</span>
                                    </>
                                )}
                            </button>
                        </div>
                    ) : entities.length === 0 ? (
                        /* No data state */
                        <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 flex flex-col items-center justify-center min-h-[150px] gap-2">
                            <p className="text-sm text-slate-400 font-medium">No data available for the current selection</p>
                        </div>
                    ) : (
                        /* Normal data grid */
                        <div className="overflow-x-auto no-scrollbar pb-2">
                            <div className="min-w-max pb-2">
                                {/* KPI Labels Header - Premium */}
                                <div className="flex items-center gap-2 mb-3 sm:mb-4 px-1">
                                    <div className="w-36 sm:w-56 flex-shrink-0 sticky left-0 bg-white z-20 pr-2 sm:pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                        <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Entity</span>
                                    </div>
                                    {selectedKpis.map(kpi => (
                                        <div key={kpi.key} className={cn('flex-1 text-center py-2 px-2 rounded-lg bg-white border border-slate-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]', cardSize.minW)}>
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em]">
                                                {kpiLabels[kpi.key] || kpi.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Entity Rows */}
                                <div className="space-y-2 sm:space-y-3 px-1">
                                    {entities.map((e) => (
                                        <motion.div
                                            key={e.key}
                                            className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl hover:bg-slate-50/50 transition-colors"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            {/* Entity with Trend & RCA buttons - Sticky */}
                                            <div className="w-36 sm:w-56 flex-shrink-0 flex items-center gap-1.5 sm:gap-2 sticky left-0 bg-white z-20 pr-2 sm:pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                                {e.logoSrc ? (
                                                    <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-white shadow-sm ring-1 ring-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        <BrandLogo name={e.name} src={e.logoSrc} className="h-7 w-7 sm:h-9 sm:w-9" imgClassName="h-5 w-5 sm:h-6 sm:w-6" />
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white shadow-sm flex-shrink-0"
                                                        style={{ background: `linear-gradient(135deg, ${e.color || '#6366f1'}, ${e.color || '#6366f1'}dd)` }}
                                                    >
                                                        {e.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <span
                                                    className="text-[11px] sm:text-[13px] font-bold text-slate-700 flex-1 whitespace-nowrap overflow-hidden text-ellipsis"
                                                    style={{ fontFamily: 'Roboto, sans-serif', maxWidth: dimension === 'sku' ? '100px' : undefined }}
                                                    title={e.name}
                                                >
                                                    {dimension === 'sku' ? truncateToWords(e.name, 5) : e.name}
                                                </span>

                                                {/* Trend & RCA buttons */}
                                                <div className="hidden sm:flex items-center gap-1">
                                                    <button
                                                        onClick={(evt) => {
                                                            evt.stopPropagation();
                                                            onViewTrends(e.name || e.label, currentDimension.label);
                                                        }}
                                                        className="h-6.5 w-6.5 rounded-md bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                                                        title={`View ${e.name} Trend`}
                                                    >
                                                        <LineChart size={13} className="text-slate-400" />
                                                    </button>
                                                    <button
                                                        onClick={(evt) => {
                                                            evt.stopPropagation();
                                                            onViewRca(e.name || e.label);
                                                        }}
                                                        className="h-6.5 w-6.5 rounded-md bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                                                        title={`View ${e.name} RCA`}
                                                    >
                                                        <MapPin size={13} className="text-slate-400" />
                                                    </button>
                                                </div>
                                            </div>


                                            {/* KPI Cards - Enhanced with gradient glow */}
                                            {selectedKpis.map(kpi => {
                                                const cell = e.data[kpi.key]
                                                const textColor = getStatusText(cell?.delta)
                                                const isUp = cell?.delta?.dir === 'up'

                                                return (
                                                    <motion.button
                                                        key={kpi.key}
                                                        onClick={() => copy(`${e.name} ${kpi.label}`, cell?.value)}
                                                        className={cn(
                                                            'flex-1 px-3 rounded-xl text-center transition-all duration-200 relative overflow-hidden',
                                                            'bg-gradient-to-br from-white to-slate-50',
                                                            'border',
                                                            isUp ? 'border-emerald-100' : 'border-rose-100',
                                                            'shadow-[0_4px_16px_rgba(0,0,0,0.06)]',
                                                            'hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:-translate-y-1',
                                                            'active:scale-[0.98]',
                                                            cardSize.minW, cardSize.py
                                                        )}
                                                        title={`${kpi.label}: ${cell?.value} (${cell?.delta?.dir === 'up' ? '▲' : '▼'} ${cell?.delta?.value})`}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                    >
                                                        {/* Subtle glow effect */}
                                                        <div className={cn(
                                                            'absolute inset-0 opacity-10 rounded-xl',
                                                            isUp ? 'bg-gradient-to-br from-emerald-100 to-transparent' : 'bg-gradient-to-br from-rose-100 to-transparent'
                                                        )} />
                                                        <div className={cn('font-bold text-slate-900 tabular-nums relative z-10 leading-tight', cardSize.text)} style={{ fontFamily: 'Roboto, sans-serif' }}>
                                                            {cell?.value}
                                                        </div>
                                                        <div className={cn('font-bold flex items-center justify-center gap-0.5 mt-0.5 relative z-10', textColor, cardSize.delta)}>
                                                            <span className="opacity-80">{isUp ? '↑' : '↓'}</span>
                                                            <span>{cell?.delta?.value?.replace(/[+-]/, '')}</span>
                                                        </div>
                                                    </motion.button>
                                                )
                                            })}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer - Summary Stats */}
                    <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-200 shadow-sm">
                                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-lg bg-slate-900 flex items-center justify-center">
                                    <TrendingUp size={14} className="text-white" />
                                </div>
                                <span className="text-slate-800 text-xs sm:text-sm font-bold">
                                    {entities.reduce((sum, e) => sum + selectedKpis.filter(k => e.data[k.key]?.delta?.dir === 'up').length, 0)}
                                </span>
                                <span className="text-slate-500 text-xs">positive</span>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-200 shadow-sm">
                                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-lg bg-slate-400 flex items-center justify-center">
                                    <TrendingDown size={14} className="text-white" />
                                </div>
                                <span className="text-slate-800 text-xs sm:text-sm font-bold">
                                    {entities.reduce((sum, e) => sum + selectedKpis.filter(k => e.data[k.key]?.delta?.dir === 'down').length, 0)}
                                </span>
                                <span className="text-slate-500 text-xs">negative</span>
                            </div>
                        </div>
                        <span className="text-[10px] sm:text-xs text-slate-500 font-medium text-center">Click any card to copy • Select KPIs above</span>
                    </div>
                </SectionWrapper>
            </div>
            {/* Prepare options for advanced filter dropdowns */}
            {(() => {
                const brandOptions = globalBrands.map(b => ({ id: b, name: b }))
                const categoryOptions = globalCategories.map(c => ({ id: c, name: c }))
                const platformOptions = globalPlatforms.map(p => ({ id: p, name: p }))
                // SKUs: if current dimension is sku, use them, else empty (fetching all SKUs is too heavy)
                const skuOptions = productOptions.length > 0 ? productOptions
                    : (dimension === 'sku' ? entities.map(e => ({ id: e.key, name: e.name })) : [])

                return (
                    <AdvancedFilterModal
                        isOpen={isFilterModalOpen}
                        onClose={() => setIsFilterModalOpen(false)}
                        filters={advancedFilters}
                        onApply={handleApplyFilters}
                        currentDimension={dimension}
                        brands={brandOptions}
                        categories={categoryOptions}
                        platforms={platformOptions}
                        skus={skuOptions}
                    />
                )
            })()}
        </>
    )
}

export default PlatformOverviewNew