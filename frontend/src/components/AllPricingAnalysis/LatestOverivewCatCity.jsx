import { useState, useMemo, useContext, useEffect } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { Skeleton, Tooltip, Typography, Box } from '@mui/material'
import { motion } from 'framer-motion'
import { useHelp } from "../../utils/HelpContext";
import { FilterContext } from '../../utils/FilterContext'
import {
    TrendingUp,
    TrendingDown,
    Grid3X3,
    MapPin,
    SlidersHorizontal,
    LineChart,
    LayoutGrid,
    Package,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    ChevronDown,
    Info
} from 'lucide-react'
import { getLogicalKpiValue } from '@/components/AllAvailablityAnalysis/availablityDataCenter.jsx'
import AdvancedFilterModal from './../ControlTower/WatchTower/AdvancedFilterModal'
import { formatNumber } from '../../utils/formatters'
import { cn } from '../../lib/utils'

/* --- HELPERS --- */
const getStatusText = (delta) => {
    if (!delta) return "text-slate-500";
    return delta.dir === 'up' ? "text-emerald-500" : "text-rose-500";
};

const copy = (title, value) => {
    navigator.clipboard.writeText(`${title}: ${value}`);
};

const cardSize = {
    minW: 'min-w-[100px] sm:min-w-[125px]',
    py: 'py-2 sm:py-3',
    text: 'text-[13px]',
    delta: 'text-[10px] sm:text-[11px]'
};

const kpiLabels = {
    discount: 'Discount %',
    pricePerUnit: 'Price/Unit 1g / 1 piece',
    asp: 'Average Selling Price',
};



const LatestOverivewCatCity = ({
    onViewTrends = () => { },
    onViewRca = () => { },
    kpis: propKpis = [],
    loading = false,
}) => {
    const { openHelpWithMenu } = useHelp();
    const kpis = useMemo(() => propKpis.length > 0 ? propKpis : [
        { key: 'discount', label: 'Discount %' },
        { key: 'pricePerUnit', label: 'Price/Unit 1g / 1 piece', infoTooltip: 'Wt. PPU represents the average price per unit across a category, with each SKU weighted based on its sales.' },
        { key: 'asp', label: 'Average Selling Price' },
    ], [propKpis]);

    const {
        selectedChannel,
        platform: globalPlatform,
        selectedBrand,
        selectedCategory,
        selectedLocation,
        timeStart,
        timeEnd,
        datesInitialized,
        brands: contextBrands,
        platforms: contextPlatforms,
        categories: contextCategories,
        locations: contextLocations,
    } = useContext(FilterContext);

    // ✅ Dimension + Tier State
    const [dimension, setDimension] = useState('platform')
    const [glanceKpis, setGlanceKpis] = useState(['discount', 'pricePerUnit', 'asp'])
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

    const [advancedFilters, setAdvancedFilters] = useState({
        brands: [],
        categories: [],
        platforms: [],
        skus: [],
        dateFrom: '',
        dateTo: '',
        kpis: ['discount', 'pricePerUnit', 'asp'],
        filterLogic: 'OR',
    })

    const [apiData, setApiData] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const [expandedSku, setExpandedSku] = useState(null)
    const [expandedCityData, setExpandedCityData] = useState({})
    const [isCityLoading, setIsCityLoading] = useState(false)
    const itemsPerPage = 10;

    // ✅ Entity list — dynamically built from FilterContext
    const dimensionData = useMemo(() => ({
        platform: {
            label: 'Platform',
            icon: LayoutGrid,
            entities: (contextPlatforms || []).filter(p => p && p !== 'All').map(p => ({
                key: p,
                name: p,
            })),
        },
        category: {
            label: 'Category',
            icon: Grid3X3,
            entities: (contextCategories || []).filter(c => c && c !== 'All').map(c => ({
                key: c, // Use raw name for direct matching
                name: c,
            })),
        },
        sku: {
            label: 'SKU',
            icon: Package,
            entities: [], // Will be filled by API data
        },
    }), [contextPlatforms, contextCategories]);

    // Dynamic options for AdvancedFilterModal dropdowns
    const brandOptions = useMemo(() =>
        (contextBrands || []).filter(b => b && b !== 'All').map(b => ({ id: b.toLowerCase().replace(/\s+/g, '_'), name: b })),
        [contextBrands]
    );
    const platformOptions = useMemo(() =>
        (contextPlatforms || []).filter(p => p && p !== 'All').map(p => ({ id: p.toLowerCase().replace(/\s+/g, '_'), name: p })),
        [contextPlatforms]
    );

    // Fetch product/SKU options from DB for the filter dropdown
    const [productOptions, setProductOptions] = useState([]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                // Ignore global platform filter to show cross-platform data
                const res = await axiosInstance.get('/watchtower/products');
                if (res.data && Array.isArray(res.data)) {
                    setProductOptions(res.data.map(p => ({ id: p, name: p })));
                }
            } catch (err) {
                console.warn('[CategoryOverview] Failed to fetch products for filter:', err.message);
            }
        };
        if (datesInitialized) {
            fetchProducts();
        }
    }, [datesInitialized]);

    const skuOptions = useMemo(() => 
        productOptions.length > 0 ? productOptions : (dimension === 'sku' ? apiData.map(e => ({ id: e.key, name: e.name })) : []), 
        [productOptions, dimension, apiData]
    );

    useEffect(() => {
        if (!datesInitialized) return;
        let isMounted = true;
        
        const toParam = (val) => {
            if (!val) return null;
            if (Array.isArray(val)) return val.length > 0 ? val.join(',') : null;
            return val;
        };

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams();
                
                // Use advanced filters if sets, do not fall back to global context filter
                const pl = toParam(advancedFilters.platforms?.length > 0 ? advancedFilters.platforms : null); 
                if (pl) params.append('platform', pl);
                
                const br = toParam(advancedFilters.brands?.length > 0 ? advancedFilters.brands : selectedBrand); 
                if (br) params.append('brand', br);
                
                const ca = toParam(advancedFilters.categories?.length > 0 ? advancedFilters.categories : selectedCategory); 
                if (ca) params.append('category', ca);
                
                const lo = toParam(selectedLocation); 
                if (lo) params.append('location', lo);
                
                const ch = toParam(selectedChannel); 
                if (ch) params.append('channel', ch);

                params.append('dimension', dimension);
                // if (drilldownSku) params.append('sku', drilldownSku); // No longer needed for main list
                
                // Date overrides from advanced filters
                const start = advancedFilters.dateFrom || (typeof timeStart === 'string' ? timeStart : timeStart?.format('YYYY-MM-DD'));
                const end = advancedFilters.dateTo || (typeof timeEnd === 'string' ? timeEnd : timeEnd?.format('YYYY-MM-DD'));
                
                if (start) params.append('startDate', start);
                if (end) params.append('endDate', end);

                const url = `/pricing-analysis/dimension-overview?${params.toString()}`;
                console.log('[CategoryOverview] Fetching:', url);
                const response = await axiosInstance.get(url);
                
                if (isMounted && response.data?.success) {
                    setApiData(response.data.data);
                }
            } catch (error) {
                console.error("[CategoryOverview] Failed to fetch:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [dimension, selectedChannel, selectedBrand, selectedCategory, selectedLocation, timeStart, timeEnd, datesInitialized, advancedFilters.brands, advancedFilters.platforms, advancedFilters.categories, advancedFilters.dateFrom, advancedFilters.dateTo]);

    // Reset pagination when dimension or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [dimension, advancedFilters, selectedBrand, selectedCategory, expandedSku]);

    const handleApplyFilters = (filters) => {
        setAdvancedFilters(filters)
        setGlanceKpis(filters.kpis)
    }

    const handleToggleExpand = async (skuName) => {
        if (expandedSku === skuName) {
            setExpandedSku(null);
            return;
        }

        setExpandedSku(skuName);
        if (expandedCityData[skuName]) return;

        setIsCityLoading(true);
        try {
            const params = new URLSearchParams();
            
            // Re-use logic for filters but target 'city' dimension for specific SKU
            const pl = toParam(advancedFilters.platforms?.length > 0 ? advancedFilters.platforms : null); 
            if (pl) params.append('platform', pl);
            
            const br = toParam(advancedFilters.brands?.length > 0 ? advancedFilters.brands : selectedBrand); 
            if (br) params.append('brand', br);
            
            const ca = toParam(advancedFilters.categories?.length > 0 ? advancedFilters.categories : selectedCategory); 
            if (ca) params.append('category', ca);
            
            const ch = toParam(selectedChannel); 
            if (ch) params.append('channel', ch);

            params.append('dimension', 'city');
            params.append('sku', skuName);
            
            const start = advancedFilters.dateFrom || (typeof timeStart === 'string' ? timeStart : timeStart?.format('YYYY-MM-DD'));
            const end = advancedFilters.dateTo || (typeof timeEnd === 'string' ? timeEnd : timeEnd?.format('YYYY-MM-DD'));
            
            if (start) params.append('startDate', start);
            if (end) params.append('endDate', end);

            const url = `/pricing-analysis/dimension-overview?${params.toString()}`;
            const response = await axiosInstance.get(url);
            
            if (response.data?.success) {
                // Format the city data like we do for entities
                const formattedCities = response.data.data.map(city => {
                    const formattedData = {};
                    kpis.forEach(kpi => {
                        const cell = city.data[kpi.key];
                        if (cell) {
                            let valStr = cell.value;
                            if (kpi.key === 'discount') valStr = `${cell.value.toFixed(1)}%`;
                            else if (kpi.key === 'asp' || kpi.key === 'pricePerUnit') valStr = `₹${cell.value.toFixed(2)}`;
                            else valStr = cell.value.toFixed(2);

                            formattedData[kpi.key] = {
                                value: valStr,
                                delta: { value: `${cell.dir === 'up' ? '+' : ''}${cell.change.toFixed(1)}%`, dir: cell.dir }
                            };
                        } else {
                            formattedData[kpi.key] = { value: '-', delta: { value: '-', dir: 'neutral' } };
                        }
                    });
                    return { ...city, data: formattedData };
                });
                setExpandedCityData(prev => ({ ...prev, [skuName]: formattedCities }));
            }
        } catch (error) {
            console.error("[CategoryOverview] Expansion failed:", error);
        } finally {
            setIsCityLoading(false);
        }
    };

    const toParam = (val) => {
        if (!val) return null;
        if (Array.isArray(val)) return val.length > 0 ? val.join(',') : null;
        return val;
    };

    const activeDimensionFilters = [
        advancedFilters.brands?.length > 0,
        advancedFilters.categories?.length > 0,
        advancedFilters.platforms?.length > 0,
        advancedFilters.skus?.length > 0,
        advancedFilters.dateFrom !== '',
        advancedFilters.dateTo !== '',
    ].filter(Boolean).length

    const currentDimension = dimensionData[dimension]
    const selectedKpis = kpis.filter(k => glanceKpis.includes(k.key))
    const kpiCount = selectedKpis.length

    const entities = useMemo(() => {
        let list = [...apiData];

        // Apply dimension-specific advanced filters locally
        if ((dimension === 'category' || dimension === 'platform' || dimension === 'sku') && advancedFilters.skus?.length > 0) {
            list = list.filter(e => advancedFilters.skus.includes(e.key));
        }

        // Format to match the component's expected display formatting
        return list.map((e) => {
            const formattedData = {};
            kpis.forEach(kpi => {
                const cell = e.data[kpi.key];
                if (cell) {
                    let valStr = cell.value;
                    let deltaStr = `${cell.dir === 'up' ? '+' : ''}${cell.change.toFixed(1)}%`;

                    if (kpi.key === 'discount') {
                        valStr = `${cell.value.toFixed(1)}%`;
                    } else if (kpi.key === 'pricePerUnit' || kpi.key === 'asp') {
                        valStr = `₹${cell.value.toFixed(2)}`;
                    } else if (kpi.key === 'rpi') {
                        valStr = `${cell.value.toFixed(1)}`;
                        deltaStr = `${cell.dir === 'up' ? '+' : ''}${cell.change.toFixed(2)}%`;
                    } else if (kpi.key === 'offtake') {
                        // Large number formatting for offtake using centralized formatter
                        valStr = formatNumber(cell.value, 1);
                    } else {
                        valStr = cell.value.toFixed(2);
                    }

                    formattedData[kpi.key] = {
                        value: valStr,
                        delta: { value: deltaStr, dir: cell.dir }
                    };
                } else {
                    formattedData[kpi.key] = { value: '-', delta: { value: '-', dir: 'neutral' } };
                }
            });
            return {
                ...e,
                data: formattedData
            };
        });
    }, [apiData, dimension, advancedFilters, kpis]);

    const paginatedEntities = useMemo(() => {
        if (dimension !== 'sku') return entities;
        return entities.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [entities, dimension, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(entities.length / itemsPerPage);

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
                <div className="px-6 py-4 border-b border-slate-100/60">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <Icon size={20} className="text-blue-600" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[20px] font-bold text-slate-900" style={{ fontFamily: 'Roboto, sans-serif' }}>
                                    {title}
                                </span>
                            </div>
                        </div>

                        {headerRight && (
                            <div className="flex items-center gap-3">
                                {headerRight}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6">{children}</div>
            </motion.div>
        )
    }

    return (
        <>
            <div>
                <SectionWrapper
                    title={`${currentDimension.label} Overview`}
                    icon={currentDimension.icon}
                    chip={`${entities.length} ${currentDimension.label} × ${kpiCount} KPIs`}
                    headerRight={
                        <div className="flex items-center gap-3">
                            {/* ✅ Only 2 tabs */}
                            <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/50">
                                <div className="flex items-center gap-1 border-r border-slate-200/60 pr-2 mr-1">
                                    {Object.entries(dimensionData).map(([key, dim]) => {
                                        const isSelected = dimension === key
                                        const DimIcon = dim.icon
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    setDimension(key);
                                                    setExpandedSku(null);
                                                }}
                                                className={cn(
                                                    'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[14px] font-bold transition-all',
                                                    isSelected
                                                        ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                                                        : 'text-slate-500 hover:text-slate-800'
                                                )}
                                                style={{ fontFamily: 'Roboto, sans-serif' }}
                                            >
                                                <DimIcon size={14} />
                                                {dim.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Filters */}
                            <motion.button
                                onClick={() => setIsFilterModalOpen(true)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border',
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

                            {/* Legend */}
                            <div className="flex items-center gap-2">
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
                    <div className="overflow-x-auto no-scrollbar pb-2">
                        <div className="min-w-max pb-2">
                            {/* KPI Header */}
                            <div className="flex items-center gap-2 mb-4 px-1">
                                <div className="w-56 flex-shrink-0 sticky left-0 bg-white z-20 pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                    <span className="text-sm font-bold text-slate-400 uppercase tracking-[0.15em]">Entity</span>
                                </div>
                                {selectedKpis.map(kpi => (
                                    <div
                                        key={kpi.key}
                                        className={cn(
                                            'flex-1 text-center py-2 px-2 rounded-lg bg-white border border-slate-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]',
                                            cardSize.minW
                                        )}
                                    >
                                        <div className="flex items-center justify-center gap-1.5 text-[12px] font-bold text-slate-500 uppercase tracking-[0.12em]">
                                            <span>{kpiLabels[kpi.key] || kpi.label}</span>
                                            {kpi.infoTooltip && (
                                                <Tooltip
                                                    title={
                                                        <Box>
                                                            <Typography sx={{ fontSize: '12px', lineHeight: 1.5, p: 0.5 }}>{kpi.infoTooltip}</Typography>
                                                            <Box sx={{ mt: 1, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{
                                                                        color: '#60a5fa',
                                                                        cursor: 'pointer',
                                                                        fontWeight: 600,
                                                                        fontSize: '11px',
                                                                        '&:hover': { textDecoration: 'underline', color: '#93c5fd' }
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openHelpWithMenu('Pricing Analysis');
                                                                    }}
                                                                >
                                                                    Learn more →
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    }
                                                    arrow placement="top" enterDelay={200} leaveDelay={100}
                                                    slotProps={{ tooltip: { sx: { bgcolor: '#1e293b', color: '#f8fafc', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxWidth: 300, px: 1.5, py: 1 } }, arrow: { sx: { color: '#1e293b' } } }}
                                                >
                                                    <span className="cursor-help inline-flex items-center"><Info size={14} color="#94a3b8" strokeWidth={2} /></span>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Rows */}
                            <div className="space-y-3 px-1">
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 rounded-xl">
                                            <div className="w-56 flex-shrink-0 flex items-center gap-2 h-10 pr-4">
                                                <Skeleton variant="text" width="80%" height={24} />
                                            </div>
                                            {selectedKpis.map(kpi => (
                                                <div key={kpi.key} className={cn("flex-1 px-3", cardSize.minW, cardSize.py)}>
                                                    <Skeleton variant="rounded" width="100%" height={48} className="rounded-xl" />
                                                </div>
                                            ))}
                                        </div>
                                    ))
                                ) : entities.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-8 text-slate-500">
                                        <Grid3X3 size={32} className="text-slate-300 mb-2" />
                                        <p className="text-sm font-medium">No data available for the selected filters.</p>
                                    </div>
                                ) : paginatedEntities.map((e) => (
                                    <div key={e.key} className="space-y-1">
                                        <motion.div
                                            className={cn(
                                                "flex items-center gap-2 p-2 rounded-xl transition-all group cursor-pointer",
                                                expandedSku === e.key ? "bg-slate-50 shadow-sm" : "hover:bg-slate-50/50"
                                            )}
                                            onClick={() => dimension === 'sku' && handleToggleExpand(e.key)}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <div className="w-56 flex-shrink-0 flex items-center gap-2 sticky left-0 bg-white z-20 pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                                {dimension === 'sku' && (
                                                    <div className="flex-shrink-0 p-1 rounded-lg bg-slate-50 text-slate-400 group-hover:text-blue-600 transition-colors">
                                                        {expandedSku === e.key ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </div>
                                                )}
                                                
                                                {/* Rendering Image if present, else fallback to standard icons */}
                                                {(e.image_url && e.image_url !== '') ? (
                                                    <div className="relative w-6 h-6 flex-shrink-0">
                                                        <img 
                                                            src={e.image_url} 
                                                            alt={e.name} 
                                                            className="w-full h-full rounded-md object-contain bg-slate-50 border border-slate-100" 
                                                            onError={(ev) => {
                                                                ev.currentTarget.style.display = 'none';
                                                                if (ev.currentTarget.nextElementSibling) {
                                                                    ev.currentTarget.nextElementSibling.style.display = 'flex';
                                                                }
                                                            }}
                                                        />
                                                        <div className="w-full h-full rounded-md bg-slate-100 items-center justify-center text-slate-400 hidden">
                                                            {dimension === 'platform' ? <LayoutGrid size={14} /> :
                                                             dimension === 'sku' ? <Package size={14} /> :
                                                             <Grid3X3 size={14} />}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 flex-shrink-0 rounded-md bg-slate-100 flex items-center justify-center text-slate-400">
                                                        {dimension === 'platform' ? <LayoutGrid size={14} /> :
                                                         dimension === 'sku' ? <Package size={14} /> :
                                                         <Grid3X3 size={14} />}
                                                    </div>
                                                )}

                                                <div className="flex flex-col flex-1 truncate">
                                                    <span
                                                        className="text-[13px] font-bold text-slate-700 truncate capitalize"
                                                        style={{ fontFamily: 'Roboto, sans-serif' }}
                                                        title={e.name}
                                                    >
                                                        {e.name}
                                                    </span>
                                                    {dimension === 'sku' && (
                                                        <span className="text-[13px] text-slate-400 font-medium truncate uppercase tracking-wider">
                                                            {e.key}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onViewTrends(e.name, currentDimension.label, dimension);
                                                        }}
                                                        className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                                        title="View Trends"
                                                    >
                                                        <LineChart size={14} />
                                                    </button>
                                                </div>
                                        </div>

                                        {/* KPI Cards */}
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
                                                    title={`${kpi.label}: ${cell?.value} (${isUp ? '▲' : '▼'} ${cell?.delta?.value})`}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    <div className={cn(
                                                        'absolute inset-0 opacity-10 rounded-xl',
                                                        isUp ? 'bg-gradient-to-br from-emerald-100 to-transparent' : 'bg-gradient-to-br from-rose-100 to-transparent'
                                                    )} />
                                                    <div className={cn('font-bold text-black tabular-nums relative z-10 leading-tight', cardSize.text)} style={{ fontFamily: 'Roboto, sans-serif' }}>
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

                                        {/* Nested City Rows */}
                                        {expandedSku === e.key && (
                                            <div className="ml-8 space-y-1 mt-1 border-l-2 border-slate-100/60 pl-2">
                                                {(isCityLoading && !expandedCityData[e.key]) ? (
                                                    Array(3).fill(0).map((_, i) => (
                                                        <div key={i} className="flex items-center gap-2 p-1.5 opacity-50">
                                                            <div className="w-56 flex-shrink-0 h-6">
                                                                <Skeleton variant="text" width="60%" height={24} />
                                                            </div>
                                                            {selectedKpis.map(kpi => (
                                                                <div key={kpi.key} className={cn("flex-1", cardSize.minW)}>
                                                                    <Skeleton variant="rounded" width="100%" height={32} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))
                                                ) : expandedCityData[e.key]?.map((city) => (
                                                    <motion.div
                                                        key={city.key}
                                                        className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50/30 hover:bg-slate-50 transition-colors"
                                                        initial={{ opacity: 0, y: -5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                    >
                                                        <div className="w-56 flex-shrink-0 flex items-center pr-4">
                                                            <span className="text-[13px] font-medium text-slate-500 italic pl-6 capitalize">{city.name}</span>
                                                        </div>

                                                        {selectedKpis.map(kpi => {
                                                            const cell = city.data[kpi.key]
                                                            const isUp = cell?.delta?.dir === 'up'
                                                            return (
                                                                <div
                                                                    key={kpi.key}
                                                                    className={cn(
                                                                        "flex-1 py-1.5 px-2 text-center rounded-lg border border-slate-100/50 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
                                                                        cardSize.minW
                                                                    )}
                                                                >
                                                                    <div className="text-[13px] font-bold text-slate-800">{cell?.value}</div>
                                                                    <div className={cn("text-[9px] font-bold", getStatusText(cell?.delta))}>
                                                                        {isUp ? '↑' : '↓'} {cell?.delta?.value?.replace(/[+-]/, '')}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Pagination for SKU level (or any dimension with many results) */}
                            {totalPages > 1 && (
                                <div className="mt-6 flex items-center justify-between px-2 py-4 border-t border-slate-100">
                                    <div className="text-sm text-slate-500">
                                        Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-700">{Math.min(currentPage * itemsPerPage, entities.length)}</span> of <span className="font-semibold text-slate-700">{entities.length}</span> results
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft size={18} className="text-slate-600" />
                                        </button>
                                        
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                // Page number logic for 5 visible slots
                                                let pageNum = i + 1;
                                                if (totalPages > 5 && currentPage > 3) {
                                                    pageNum = currentPage - 2 + i;
                                                    if (pageNum + (4 - i) > totalPages) pageNum = totalPages - (4 - i);
                                                }
                                                
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className={cn(
                                                            "w-9 h-9 rounded-lg text-sm font-medium transition-colors",
                                                            currentPage === pageNum 
                                                                ? "bg-blue-600 text-white shadow-sm" 
                                                                : "text-slate-600 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRight size={18} className="text-slate-600" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        </div>
                    

                    {/* Footer */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                <div className="h-6 w-6 rounded-lg bg-slate-900 flex items-center justify-center">
                                    <TrendingUp size={14} className="text-white" />
                                </div>
                                <span className="text-slate-800 text-sm font-bold">
                                    {entities.reduce((sum, e) => sum + selectedKpis.filter(k => e.data[k.key]?.delta?.dir === 'up').length, 0)}
                                </span>
                                <span className="text-slate-500 text-xs">positive</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                <div className="h-6 w-6 rounded-lg bg-slate-400 flex items-center justify-center">
                                    <TrendingDown size={14} className="text-white" />
                                </div>
                                <span className="text-slate-800 text-sm font-bold">
                                    {entities.reduce((sum, e) => sum + selectedKpis.filter(k => e.data[k.key]?.delta?.dir === 'down').length, 0)}
                                </span>
                                <span className="text-slate-500 text-xs">negative</span>
                            </div>
                        </div>
                        {/* <span className="text-xs text-slate-500 font-medium">Click any card to copy • Select KPIs above</span> */}
                    </div>
                </SectionWrapper>
            </div>

            {/* AdvancedFilterModal — fully dynamic from FilterContext + API */}
            <AdvancedFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                filters={advancedFilters}
                onApply={handleApplyFilters}
                currentDimension={dimension}
                brands={brandOptions}
                categories={(dimensionData.category?.entities || []).map(e => ({ id: e.key, name: e.name }))}
                platforms={platformOptions}
                skus={skuOptions}
                kpiOptions={kpis}
            />
        </>
    )
}

export default LatestOverivewCatCity
