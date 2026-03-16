import { useState, useMemo, useContext, useEffect } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { Skeleton } from '@mui/material'
import { motion } from 'framer-motion'
import { FilterContext } from '../../utils/FilterContext'
import {
    TrendingUp,
    TrendingDown,
    Grid3X3,
    MapPin,
    SlidersHorizontal,
    LineChart,
} from 'lucide-react'
import { getLogicalKpiValue } from '@/components/AllAvailablityAnalysis/availablityDataCenter.jsx'
import AdvancedFilterModal from './../ControlTower/WatchTower/AdvancedFilterModal'
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
    py: 'py-2.5 sm:py-3',
    text: 'text-lg sm:text-xl',
    delta: 'text-[13px] sm:text-[14px]'
};

const kpiLabels = {
    discount: 'MW discount',
    rpi: 'RPI',
    asp: 'MW Average Selling Price',
    offtake: 'Offtake',
};

const CITY_TIERS = {
    T1: ['mumbai', 'delhi', 'bengaluru', 'hyderabad', 'ahmedabad', 'kolkata', 'chennai', 'pune', 'gurugram', 'noida', 'faridabad', 'ghaziabad'],
    T2: ['lucknow', 'jaipur', 'surat', 'nagpur', 'indore', 'bhopal', 'chandigarh', 'patna', 'kochi', 'coimbatore', 'rajkot', 'ludhiana', 'jalandhar', 'guwahati', 'bhubaneswar', 'nashik'],
    T3: ['agra', 'meerut', 'kanpur', 'varanasi', 'vijayawada', 'visakhapatnam', 'jodhpur', 'ranchi', 'amritsar', 'dehradun', 'hubballi', 'madurai', 'warangal', 'gwalior', 'prayagraj', 'bareilly'],
    T4: ['ajmer', 'alwar', 'asansol', 'bathinda', 'bhagalpur', 'bhiwadi', 'hapur', 'haridwar', 'hisar', 'jhansi', 'kanchipuram', 'karnal', 'khammam', 'kota', 'kottayam', 'mathura', 'muzaffarpur', 'panchkula', 'patiala', 'pondicherry', 'rewari', 'roorkee', 'rudrapur', 'saharanpur', 'shillong', 'sonipat', 'udaipur', 'ujjain', 'vapi', 'vellore', 'vizianagaram', 'zirakpur', 'durg', 'eluru', 'gorakhpur', 'guntur']
};

const LatestOverivewCatCity = ({
    onViewTrends = () => { },
    onViewRca = () => { },
    kpis: propKpis = [],
    loading = false,
}) => {
    const kpis = useMemo(() => propKpis.length > 0 ? propKpis : [
        { key: 'discount', label: 'MW discount' },
        { key: 'rpi', label: 'RPI' },
        { key: 'asp', label: 'MW Average Selling Price' },
        { key: 'offtake', label: 'Offtake' },
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
    const [dimension, setDimension] = useState('category')
    const [selectedTier, setSelectedTier] = useState('T1')
    const [glanceKpis, setGlanceKpis] = useState(['discount', 'rpi', 'asp', 'offtake'])
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

    const [advancedFilters, setAdvancedFilters] = useState({
        brands: [],
        categories: [],
        platforms: [],
        skus: [],
        dateFrom: '',
        dateTo: '',
        kpis: ['discount', 'rpi', 'asp', 'offtake'],
        filterLogic: 'OR',
    })

    // ✅ Entity list — dynamically built from FilterContext
    const dimensionData = useMemo(() => ({
        category: {
            label: 'Category',
            icon: Grid3X3,
            entities: (contextCategories || []).filter(c => c && c !== 'All').map(c => ({
                key: c, // Use raw name for direct matching
                name: c,
            })),
        },
        city: {
            label: 'City',
            icon: MapPin,
            entities: (contextLocations || []).filter(l => l && l !== 'All').map(l => ({
                key: l.toLowerCase().replace(/\s+/g, '_'),
                name: l,
            })),
        },
    }), [contextCategories, contextLocations]);

    // Dynamic options for AdvancedFilterModal dropdowns
    const brandOptions = useMemo(() =>
        (contextBrands || []).filter(b => b && b !== 'All').map(b => ({ id: b.toLowerCase().replace(/\s+/g, '_'), name: b })),
        [contextBrands]
    );
    const platformOptions = useMemo(() =>
        (contextPlatforms || []).filter(p => p && p !== 'All').map(p => ({ id: p.toLowerCase().replace(/\s+/g, '_'), name: p })),
        [contextPlatforms]
    );


    const [apiData, setApiData] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const skuOptions = useMemo(() =>
        apiData.map(item => ({ id: item.key, name: item.name })).filter(s => s.name),
        [apiData]
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
                
                // Use advanced filters if sets, otherwise fall back to global context filters
                const pl = toParam(advancedFilters.platforms?.length > 0 ? advancedFilters.platforms : globalPlatform); 
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
    }, [dimension, selectedChannel, globalPlatform, selectedBrand, selectedCategory, selectedLocation, timeStart, timeEnd, datesInitialized, advancedFilters.brands, advancedFilters.platforms, advancedFilters.categories, advancedFilters.dateFrom, advancedFilters.dateTo]);

    const handleApplyFilters = (filters) => {
        setAdvancedFilters(filters)
        setGlanceKpis(filters.kpis)
    }

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
        if (dimension === 'category' && advancedFilters.skus?.length > 0) {
            list = list.filter(e => advancedFilters.skus.includes(e.key));
        }
        if (dimension === 'city') {
            // Apply Tier filter first (using lowercase for robust comparison)
            const tierCities = CITY_TIERS[selectedTier] || [];
            list = list.filter(e => e.key && tierCities.includes(e.key.toLowerCase()));

            // Then apply advanced filters if any (City Filter uses 'skus' key in modal)
            if (advancedFilters.skus?.length > 0) {
                list = list.filter(e => advancedFilters.skus.includes(e.key));
            }
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
                        // Large number formatting for offtake
                        if (cell.value >= 1000000) valStr = `${(cell.value / 1000000).toFixed(1)}M`;
                        else if (cell.value >= 1000) valStr = `${(cell.value / 1000).toFixed(1)}K`;
                        else valStr = cell.value.toFixed(0);
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
    }, [apiData, dimension, advancedFilters, selectedTier, kpis]);

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
                            <span className="text-[20px] font-bold text-slate-900" style={{ fontFamily: 'Roboto, sans-serif' }}>
                                {title}
                            </span>
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
                    title="Category Overview"
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
                                                onClick={() => setDimension(key)}
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

                                {/* ✅ T1-T4 Tier Toggle */}
                                {dimension === 'city' && (
                                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-300">
                                        {Object.keys(CITY_TIERS).map((tier) => {
                                            const isSelected = selectedTier === tier
                                            return (
                                                <button
                                                    key={tier}
                                                    onClick={() => setSelectedTier(tier)}
                                                    className={cn(
                                                        'px-3.5 py-1.5 rounded-xl text-[14px] font-bold transition-all',
                                                        isSelected
                                                            ? 'bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]'
                                                            : 'text-slate-500 hover:text-blue-600'
                                                    )}
                                                    style={{ fontFamily: 'Roboto, sans-serif' }}
                                                >
                                                    {tier}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
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
                                        <div className="text-[12px] font-bold text-slate-500 uppercase tracking-[0.12em]">
                                            {kpiLabels[kpi.key] || kpi.label}
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
                                ) : entities.map((e) => (
                                    <motion.div
                                        key={e.key}
                                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50/50 transition-colors group"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        {/* ✅ Entity TEXT ONLY (no logo) */}
                                        <div className="w-56 flex-shrink-0 flex items-center gap-2 sticky left-0 bg-white z-20 pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                            <span
                                                className="text-[15px] font-medium text-slate-700 flex-1 whitespace-nowrap"
                                                style={{ fontFamily: 'Roboto, sans-serif' }}
                                            >
                                                {e.name}
                                            </span>

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
                                                <div
                                                    className="p-1 text-slate-300 cursor-default"
                                                    title="Map Analysis (Coming Soon)"
                                                >
                                                    <MapPin size={14} />
                                                </div>
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
                                ))}
                            </div>
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
