import { useState, useEffect, useCallback, useContext } from 'react'
import { motion } from 'framer-motion'
import { FilterContext } from '../../utils/FilterContext'
import {
    TrendingUp,
    TrendingDown,
    Grid3X3,
    MapPin,
    SlidersHorizontal,
    LineChart,
    RefreshCw,
} from 'lucide-react'
import AdvancedFilterModal from './../ControlTower/WatchTower/AdvancedFilterModal'
import { cn } from '../../lib/utils'
import axiosInstance from '../../api/axiosInstance'

/* --- HELPERS --- */
const cardSize = {
    minW: 'min-w-[155px]',
    py: 'py-2.5',
    text: 'text-[15px]',
    delta: 'text-[10px]'
};

const kpiLabels = {
    discount: 'Discount',
    pricePerUnit: 'Price Per Unit',
    rpi: 'RPI',
    asp: 'Average Selling Price',
};

const ALL_KPI_KEYS = ['discount', 'pricePerUnit', 'rpi', 'asp'];

const CITY_TIERS = {
    T1: ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'ahmedabad'],
    T2: ['kolkata', 'pune', 'chennai', 'lucknow', 'jaipur'],
    T3: ['patna', 'indore', 'bhopal', 'chandigarh', 'ranchi'],
    T4: ['varanasi', 'kanpur', 'meerut', 'agra', 'noida']
};

// Skeleton row for loading state
const SkeletonRow = ({ kpiCount }) => (
    <div className="flex items-center gap-2 p-2 rounded-xl animate-pulse">
        <div className="w-56 flex-shrink-0 pr-4 border-r border-slate-50">
            <div className="h-4 bg-slate-200 rounded w-28" />
        </div>
        {Array.from({ length: kpiCount }).map((_, i) => (
            <div key={i} className={cn('flex-1 rounded-xl bg-slate-100 h-14', cardSize.minW)} />
        ))}
    </div>
);

const LatestOverivewCatCity = ({
    onViewTrends = () => { },
    onViewRca = () => { },
}) => {
    const {
        timeStart,
        timeEnd,
        compareStart,
        compareEnd,
        datesInitialized,
    } = useContext(FilterContext);

    // Dimension toggle (category | city)
    const [dimension, setDimension] = useState('category');
    const [selectedTier, setSelectedTier] = useState('T1');
    const [glanceKpis, setGlanceKpis] = useState(ALL_KPI_KEYS);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    // Advanced filters from the filter modal
    const [advancedFilters, setAdvancedFilters] = useState({
        categories: [],
        cities: [],
        dateFrom: '',
        dateTo: '',
        kpis: ALL_KPI_KEYS,
        filterLogic: 'OR',
    });

    // API data state
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [skuOptions, setSkuOptions] = useState([]);
    const [allPlatforms, setAllPlatforms] = useState([]);
    const [allBrands, setAllBrands] = useState([]);
    const [allCategories, setAllCategories] = useState([]);
    const [allCities, setAllCities] = useState([]);

    const kpis = ALL_KPI_KEYS.map(key => ({ key, label: kpiLabels[key] }));
    const selectedKpis = kpis.filter(k => glanceKpis.includes(k.key));

    const dimensionData = {
        category: { label: 'Category', icon: Grid3X3 },
        city: { label: 'City', icon: MapPin },
    };
    const currentDimension = dimensionData[dimension];

    // Filter modal active count
    const activeDimensionFilters = [
        advancedFilters.categories?.length > 0,
        advancedFilters.cities?.length > 0,
    ].filter(Boolean).length;

    const handleApplyFilters = (filters) => {
        setAdvancedFilters(filters);
        setGlanceKpis(filters.kpis?.length > 0 ? filters.kpis : ALL_KPI_KEYS);
    };

    // Fetch data from backend
    const fetchData = useCallback(async () => {
        if (!datesInitialized) return;

        setLoading(true);
        setError(null);

        try {
            const params = {
                dimension,
                startDate: timeStart?.format('YYYY-MM-DD'),
                endDate: timeEnd?.format('YYYY-MM-DD'),
                compareStartDate: compareStart?.format('YYYY-MM-DD'),
                compareEndDate: compareEnd?.format('YYYY-MM-DD'),
            };
            // Advanced filter: selected categories
            if (advancedFilters.categories?.length > 0) {
                params.filterCategories = advancedFilters.categories.join(',');
            }
            // Advanced filter: selected cities
            if (advancedFilters.cities?.length > 0) {
                params.filterCities = advancedFilters.cities.join(',');
            }
            // Advanced filter: selected brands
            if (advancedFilters.brands?.length > 0) {
                params.filterBrands = advancedFilters.brands.join(',');
            }
            // Advanced filter: selected platforms
            if (advancedFilters.platforms?.length > 0) {
                params.filterPlatforms = advancedFilters.platforms.join(',');
            }
            // Advanced filter: selected skus
            if (advancedFilters.skus?.length > 0) {
                params.filterSkus = advancedFilters.skus.join(',');
            }

            console.log('[LatestOverivewCatCity] fetching category-overview-kpis:', params);
            const response = await axiosInstance.get('/pricing-analysis/category-overview-kpis', {
                params: { ...params, _t: Date.now() },
            });

            if (response.data?.success && Array.isArray(response.data.rows)) {
                let apiRows = response.data.rows;

                // For city view, apply client-side tier filtering (based on city name matching)
                if (dimension === 'city') {
                    const tierKeys = CITY_TIERS[selectedTier] || [];
                    // Match against the name (lowercase)
                    apiRows = apiRows.filter(r =>
                        tierKeys.some(t => r.name?.toLowerCase().includes(t))
                    );
                }

                setRows(apiRows);
            } else {
                setRows([]);
            }
        } catch (err) {
            console.error('[LatestOverivewCatCity] Error:', err);
            setError(err.message || 'Failed to load data');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [
        datesInitialized, dimension, selectedTier,
        timeStart, timeEnd, compareStart, compareEnd,
        advancedFilters,
    ]);

    // Re-fetch only when core parameters or advanced filters change
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fetch SKUs for advanced filter modal (Unrestricted)
    useEffect(() => {
        const fetchSkus = async () => {
            try {
                const response = await axiosInstance.get('/pricing-analysis/trends-filter-options', {
                    params: { filterType: 'skus' }
                });
                if (response.data?.success && Array.isArray(response.data.options)) {
                    const skus = response.data.options
                        .filter(opt => opt !== 'All')
                        .map(opt => ({ id: opt, name: opt }));
                    setSkuOptions(skus);
                }
            } catch (err) {
                console.error('[LatestOverivewCatCity] Failed to fetch SKUs:', err);
            }
        };
        fetchSkus();
    }, []);

    // Fetch all other filter options independently (Unrestricted)
    useEffect(() => {
        const fetchAllOptions = async () => {
            const types = ['platforms', 'brands', 'categories', 'cities'];
            try {
                const results = await Promise.all(
                    types.map(type =>
                        axiosInstance.get('/pricing-analysis/trends-filter-options', { params: { filterType: type } })
                    )
                );

                results.forEach((res, index) => {
                    if (res.data?.success && Array.isArray(res.data.options)) {
                        const opts = res.data.options
                            .filter(opt => opt !== 'All')
                            .map(opt => ({ id: opt, name: opt }));

                        const type = types[index];
                        if (type === 'platforms') setAllPlatforms(opts);
                        if (type === 'brands') setAllBrands(opts);
                        if (type === 'categories') setAllCategories(opts);
                        if (type === 'cities') setAllCities(opts);
                    }
                });
            } catch (err) {
                console.error('[LatestOverivewCatCity] Failed to fetch filter options:', err);
            }
        };
        fetchAllOptions();
    }, []);

    // Re-fetch when tier changes for city view
    useEffect(() => {
        if (dimension === 'city') fetchData();
    }, [selectedTier]);

    const SectionWrapper = ({ title, icon: Icon, children, headerRight }) => (
        <motion.div
            className="bg-white rounded-3xl shadow-lg border border-slate-100/60"
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
                        <span className="text-[17px] font-bold text-slate-900" style={{ fontFamily: 'Roboto, sans-serif' }}>
                            {title}
                        </span>
                    </div>
                    {headerRight && <div className="flex items-center gap-3">{headerRight}</div>}
                </div>
            </div>
            <div className="p-6">{children}</div>
        </motion.div>
    );

    return (
        <>
            <div>
                <SectionWrapper
                    title="Category Overview"
                    icon={currentDimension.icon}
                    headerRight={
                        <div className="flex items-center gap-3">
                            {/* Dimension Toggle: Category / City */}
                            <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/50">
                                <div className="flex items-center gap-1 border-r border-slate-200/60 pr-2 mr-1">
                                    {Object.entries(dimensionData).map(([key, dim]) => {
                                        const isSelected = dimension === key;
                                        const DimIcon = dim.icon;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setDimension(key)}
                                                className={cn(
                                                    'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all',
                                                    isSelected
                                                        ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                                                        : 'text-slate-500 hover:text-slate-800'
                                                )}
                                            >
                                                <DimIcon size={14} />
                                                {dim.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* T1–T4 Tier Toggle for City view */}
                                {dimension === 'city' && (
                                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-300">
                                        {Object.keys(CITY_TIERS).map((tier) => {
                                            const isSelected = selectedTier === tier;
                                            return (
                                                <button
                                                    key={tier}
                                                    onClick={() => setSelectedTier(tier)}
                                                    className={cn(
                                                        'px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all',
                                                        isSelected
                                                            ? 'bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]'
                                                            : 'text-slate-500 hover:text-blue-600'
                                                    )}
                                                >
                                                    {tier}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Refresh button */}
                            <motion.button
                                onClick={fetchData}
                                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:shadow-sm transition-all"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.95 }}
                                title="Refresh data"
                            >
                                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                            </motion.button>

                            {/* Filters button */}
                            <motion.button
                                onClick={() => setIsFilterModalOpen(true)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border',
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
                                    {selectedKpis.length} KPIs
                                </span>
                            </motion.button>

                            {/* Legend */}
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 text-[9px] text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded-full font-bold border border-emerald-100/50 uppercase tracking-tight">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500" /> Growth
                                </span>
                                <span className="flex items-center gap-1.5 text-[9px] text-rose-600 bg-rose-50/50 px-2 py-0.5 rounded-full font-bold border border-rose-100/50 uppercase tracking-tight">
                                    <span className="w-1 h-1 rounded-full bg-rose-500" /> Decline
                                </span>
                            </div>
                        </div>
                    }
                >
                    {/* Error state */}
                    {error && (
                        <div className="text-center py-8 text-rose-500 text-sm">
                            <p className="font-medium">Failed to load data</p>
                            <p className="text-xs text-slate-400 mt-1">{error}</p>
                            <button onClick={fetchData} className="mt-3 px-4 py-1.5 text-xs bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100">
                                Retry
                            </button>
                        </div>
                    )}

                    {!error && (
                        <div className="overflow-x-auto no-scrollbar pb-2">
                            <div className="min-w-max pb-2">
                                {/* KPI Header */}
                                <div className="flex items-center gap-2 mb-4 px-1">
                                    <div className="w-56 flex-shrink-0 sticky left-0 bg-white z-20 pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Entity</span>
                                    </div>
                                    {selectedKpis.map(kpi => (
                                        <div
                                            key={kpi.key}
                                            className={cn(
                                                'flex-1 text-center py-2 px-2 rounded-lg bg-white border border-slate-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]',
                                                cardSize.minW
                                            )}
                                        >
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em]">
                                                {kpiLabels[kpi.key] || kpi.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Loading skeletons */}
                                {loading && (
                                    <div className="space-y-3 px-1">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <SkeletonRow key={i} kpiCount={selectedKpis.length} />
                                        ))}
                                    </div>
                                )}

                                {/* Empty state */}
                                {!loading && rows.length === 0 && (
                                    <div className="text-center py-12 text-slate-400">
                                        <p className="text-sm font-medium">No data found</p>
                                        <p className="text-xs mt-1">Try changing your filters or date range</p>
                                    </div>
                                )}

                                {/* Data rows */}
                                {!loading && rows.length > 0 && (
                                    <div className="space-y-3 px-1">
                                        {rows.map((e) => (
                                            <motion.div
                                                key={e.key}
                                                className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50/50 transition-colors"
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                {/* Entity label */}
                                                <div className="w-56 flex-shrink-0 flex items-center gap-2 sticky left-0 bg-white z-20 pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                                    <span
                                                        className="text-[13px] font-bold text-slate-700 flex-1 whitespace-nowrap"
                                                        style={{ fontFamily: 'Roboto, sans-serif' }}
                                                    >
                                                        {e.name}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={(evt) => {
                                                                evt.stopPropagation();
                                                                onViewTrends(e.name, dimensionData[dimension].label);
                                                            }}
                                                            className="h-6 w-6 rounded-md bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all"
                                                            title={`View ${e.name} Trend`}
                                                        >
                                                            <LineChart size={13} className="text-slate-400" />
                                                        </button>
                                                        <button
                                                            onClick={(evt) => evt.stopPropagation()}
                                                            className="h-6 w-6 rounded-md bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all"
                                                            title={`View ${e.name} Location`}
                                                        >
                                                            <MapPin size={13} className="text-slate-400" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* KPI cells */}
                                                {selectedKpis.map(kpi => {
                                                    const cell = e.metrics?.[kpi.key];
                                                    const isUp = cell?.dir === 'up';
                                                    const textColor = isUp ? 'text-emerald-500' : 'text-rose-500';
                                                    const deltaAbs = cell?.delta !== undefined
                                                        ? `${Math.abs(cell.delta).toFixed(1)}%`
                                                        : '—';

                                                    return (
                                                        <motion.button
                                                            key={kpi.key}
                                                            onClick={() => navigator.clipboard?.writeText(`${e.name} ${kpi.label}: ${cell?.value}`)}
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
                                                            title={`${kpi.label}: ${cell?.value} (${isUp ? '▲' : '▼'} ${deltaAbs})`}
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                        >
                                                            <div className={cn(
                                                                'absolute inset-0 opacity-10 rounded-xl',
                                                                isUp ? 'bg-gradient-to-br from-emerald-100 to-transparent' : 'bg-gradient-to-br from-rose-100 to-transparent'
                                                            )} />
                                                            <div className={cn('font-bold text-slate-900 tabular-nums relative z-10 leading-tight', cardSize.text)}>
                                                                {cell?.value ?? '—'}
                                                            </div>
                                                            <div className={cn('font-bold flex items-center justify-center gap-0.5 mt-0.5 relative z-10', textColor, cardSize.delta)}>
                                                                <span className="opacity-80">{isUp ? '↑' : '↓'}</span>
                                                                <span>{deltaAbs}</span>
                                                            </div>
                                                        </motion.button>
                                                    );
                                                })}
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer summary */}
                    {!loading && rows.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="h-6 w-6 rounded-lg bg-slate-900 flex items-center justify-center">
                                        <TrendingUp size={14} className="text-white" />
                                    </div>
                                    <span className="text-slate-800 text-sm font-bold">
                                        {rows.reduce((sum, e) =>
                                            sum + selectedKpis.filter(k => e.metrics?.[k.key]?.dir === 'up').length, 0
                                        )}
                                    </span>
                                    <span className="text-slate-500 text-xs">positive</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="h-6 w-6 rounded-lg bg-slate-400 flex items-center justify-center">
                                        <TrendingDown size={14} className="text-white" />
                                    </div>
                                    <span className="text-slate-800 text-sm font-bold">
                                        {rows.reduce((sum, e) =>
                                            sum + selectedKpis.filter(k => e.metrics?.[k.key]?.dir === 'down').length, 0
                                        )}
                                    </span>
                                    <span className="text-slate-500 text-xs">negative</span>
                                </div>
                                <span className="text-xs text-slate-400">
                                    {rows.length} {dimension === 'category' ? 'categories' : 'cities'}
                                </span>
                            </div>
                        </div>
                    )}
                </SectionWrapper>
            </div>

            {/* AdvancedFilterModal */}
            {(() => {
                const kpiOptions = ALL_KPI_KEYS.map(key => ({ key, label: kpiLabels[key] }));

                return (
                    <AdvancedFilterModal
                        isOpen={isFilterModalOpen}
                        onClose={() => setIsFilterModalOpen(false)}
                        filters={advancedFilters}
                        onApply={handleApplyFilters}
                        currentDimension={dimension}
                        brands={allBrands}
                        categories={allCategories}
                        platforms={allPlatforms}
                        skus={skuOptions}
                        cities={allCities}
                        kpiOptions={kpiOptions}
                    />
                );
            })()}
        </>
    );
};

export default LatestOverivewCatCity;
