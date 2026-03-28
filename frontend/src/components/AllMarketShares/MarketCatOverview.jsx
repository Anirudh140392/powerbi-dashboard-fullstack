
import { useState, useEffect, useMemo, useContext } from 'react'
import { Skeleton } from '@mui/material'
import { motion } from 'framer-motion'
import { FilterContext } from '../../utils/FilterContext'
import axiosInstance from '../../api/axiosInstance'
import {
    TrendingUp,
    TrendingDown,
    Grid3X3,
    MapPin,
    SlidersHorizontal,
    LineChart,
    BarChart3,
} from 'lucide-react'
import AdvancedFilterModal from './../ControlTower/WatchTower/AdvancedFilterModal'
import { cn } from '../../lib/utils'

/* --- HELPERS --- */
const getStatusText = (delta) => {
    if (!delta) return "text-slate-500";
    return delta.dir === 'up' ? "text-emerald-500" : "text-rose-500";
};

const copy = (title, value) => {
    navigator.clipboard.writeText(`${title}: ${value} `);
};

const cardSize = {
    minW: 'min-w-[175px]',
    py: 'py-2.5',
    text: 'text-[15px]',
    delta: 'text-[10px]'
};

/* --- KPI definitions (ROW headers — vertical, left side) --- */
const kpiDefs = [
    { key: 'categorySize', label: 'Category Size' },
    { key: 'mwMarketShare', label: 'Mars Market Share%' },
    { key: 'mwSales', label: 'Mars Sales (Cr)' },
    { key: 'mlMarketShare', label: 'ML Market Share%' },
    { key: 'mlSales', label: 'ML Sales' },
];

const kpiLabels = {
    categorySize: 'Category Size',
    mwMarketShare: 'Mars Market Share%',
    mwSales: 'Mars Sales (Cr)',
    mlMarketShare: 'ML Market Share%',
    mlSales: 'ML Sales',
};

/* --- Platform entities (COLUMN headers — horizontal, top) --- */
/* Fallback while loading; overridden dynamically from backend response */
const defaultPlatformEntities = [
    { key: 'odd_overall', name: 'ODD Overall' },
    { key: 'blinkit', name: 'Blinkit' },
    { key: 'instamart', name: 'Instamart' },
    { key: 'zepto', name: 'Zepto' },
];

const MarketCatOverview = ({
    loading: parentLoading,
    onViewTrends = () => { },
    onViewRca = () => { },
}) => {
    const {
        selectedChannel,
        platform: globalPlatform,
        selectedBrand,
        selectedCategory,
        selectedLocation,
        timeStart,
        timeEnd,
        compareStart,
        compareEnd,
        categories: contextCategories,
        locations: contextLocations,
        brands: contextBrands,
    } = useContext(FilterContext);

    const [glanceKpis, setGlanceKpis] = useState([
        'categorySize', 'mwMarketShare', 'mwSales', 'mlMarketShare', 'mlSales'
    ])
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

    const [advancedFilters, setAdvancedFilters] = useState({
        categories: [],
        cities: [],
        dateFrom: '',
        dateTo: '',
        kpis: ['categorySize', 'mwMarketShare', 'mwSales', 'mlMarketShare', 'mlSales'],
        filterLogic: 'OR',
    })

    // Backend data state
    const [backendData, setBackendData] = useState(null);
    const [dataLoading, setDataLoading] = useState(true);

    // Fetch cross-platform data from backend
    useEffect(() => {
        const fetchCrossPlatformData = async () => {
            setDataLoading(true);
            try {
                // Enforced isolation from global location filter
                const selectedCities = undefined;

                // Construct parameters avoiding empty arrays
                const selectedCats = advancedFilters.categories?.length > 0 ? advancedFilters.categories : (selectedCategory === 'All' ? undefined : (Array.isArray(selectedCategory) ? selectedCategory : [selectedCategory]));
                const selectedBrands = advancedFilters.brands?.length > 0 ? advancedFilters.brands : undefined;

                const params = {
                    platform: globalPlatform === 'All' ? undefined : (Array.isArray(globalPlatform) ? globalPlatform.join(",") : globalPlatform),
                    category: selectedCats ? (Array.isArray(selectedCats) ? selectedCats.join(",") : selectedCats) : undefined,
                    location: selectedCities ? (Array.isArray(selectedCities) ? selectedCities.join(",") : selectedCities) : undefined,
                    brand: selectedBrands ? selectedBrands.join(",") : undefined,
                    startDate: timeStart ? timeStart.format("YYYY-MM-DD") : undefined,
                    endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : undefined,
                    compareStartDate: compareStart ? compareStart.format("YYYY-MM-DD") : undefined,
                    compareEndDate: compareEnd ? compareEnd.format("YYYY-MM-DD") : undefined,
                };


                const response = await axiosInstance.get('/market-share/cross-platform', { params });
                console.log("Cross Platform Data:", response.data);

                if (response.data && response.data.platforms) {
                    setBackendData(response.data.platforms);
                }
            } catch (error) {
                console.error("Error fetching Cross Platform data:", error);
            } finally {
                setDataLoading(false);
            }
        };

        fetchCrossPlatformData();
    }, [globalPlatform, selectedCategory, selectedLocation, timeStart, timeEnd, compareStart, compareEnd, advancedFilters]);

    const loading = parentLoading || dataLoading;

    const handleApplyFilters = (filters) => {
        setAdvancedFilters(filters)
        setGlanceKpis(filters.kpis)
    }

    const activeDimensionFilters = [
        advancedFilters.categories?.length > 0,
        advancedFilters.cities?.length > 0,
    ].filter(Boolean).length

    const selectedKpis = kpiDefs.filter(k => glanceKpis.includes(k.key))
    const kpiCount = selectedKpis.length

    // Derive dynamic platform entities from backend response
    const platformEntities = useMemo(() => {
        if (!backendData) return defaultPlatformEntities;

        // Use _availablePlatforms from backend if present
        if (backendData._availablePlatforms) {
            return backendData._availablePlatforms.map(key => ({
                key,
                name: key === 'odd_overall' ? 'ODD Overall' : key.charAt(0).toUpperCase() + key.slice(1)
            }));
        }

        // Fallback: derive from response keys, filtering out internal keys
        const keys = Object.keys(backendData).filter(k => !k.startsWith('_'));
        // Ensure odd_overall comes first
        const sorted = ['odd_overall', ...keys.filter(k => k !== 'odd_overall')];
        return sorted.map(key => ({
            key,
            name: key === 'odd_overall' ? 'ODD Overall' : key.charAt(0).toUpperCase() + key.slice(1)
        }));
    }, [backendData]);

    // Build platformData from backend response
    const platformData = useMemo(() => {
        if (!backendData) {
            // Return empty structure while loading
            return platformEntities.map(e => ({
                ...e,
                data: kpiDefs.reduce((acc, kpi) => {
                    acc[kpi.key] = { value: '—', delta: { value: '—', dir: 'up' }, raw: 0 };
                    return acc;
                }, {})
            }));
        }

        return platformEntities.map(e => ({
            ...e,
            data: backendData[e.key] || kpiDefs.reduce((acc, kpi) => {
                acc[kpi.key] = { value: '—', delta: { value: '—', dir: 'up' }, raw: 0 };
                return acc;
            }, {})
        }));
    }, [backendData, platformEntities]);

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
                className={`bg - white rounded - 3xl shadow - lg border border - slate - 100 / 60 ${className} `}
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
                    title="Cross Platform Overview"
                    icon={BarChart3}
                    chip={`${platformEntities.length} Platforms × ${kpiCount} KPIs`}
                    headerRight={
                        <div className="flex items-center gap-3">
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
                    {/* ===== TRANSPOSED GRID: KPIs as rows, Platforms as columns ===== */}
                    <div className="overflow-x-auto no-scrollbar pb-2">
                        <div className="min-w-max pb-2">
                            {/* Column Header Row — Platform names */}
                            <div className="flex items-center gap-2 mb-4 px-1">
                                <div className="w-48 flex-shrink-0 sticky left-4 bg-white z-20 pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                    <span className="text-xs font-bold text-slate-900 uppercase tracking-[0.15em]">Entity</span>
                                </div>
                                {platformEntities.map(plat => (
                                    <div
                                        key={plat.key}
                                        className={cn(
                                            'flex-1 text-center py-2 px-2 rounded-lg bg-white border border-slate-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]',
                                            cardSize.minW
                                        )}
                                    >
                                        <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.12em] whitespace-nowrap">
                                            {plat.name}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Data Rows — one row per KPI */}
                            <div className="space-y-3 px-1">
                                {selectedKpis.map((kpi) => (
                                    <motion.div
                                        key={kpi.key}
                                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50/50 transition-colors"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        {/* KPI Label (row header) + Trend/RCA buttons */}
                                        <div className="w-48 flex-shrink-0 flex items-center gap-2 sticky left-0 bg-white z-20 pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                            <span
                                                className="text-[12px] font-bold text-slate-600 flex-1 whitespace-nowrap uppercase tracking-wide"
                                                style={{ fontFamily: 'Roboto, sans-serif' }}
                                            >
                                                {kpiLabels[kpi.key] || kpi.label}
                                            </span>

                                            {/* <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(evt) => {
                                                        evt.stopPropagation();
                                                        onViewTrends(kpi.label, 'KPI');
                                                    }}
                                                    className="h-6.5 w-6.5 rounded-md bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                                                    title={`View ${kpi.label} Trend`}
                                                >
                                                    <LineChart size={13} className="text-slate-400" />
                                                </button>
                                                <button
                                                    onClick={(evt) => {
                                                        evt.stopPropagation();
                                                        onViewRca(kpi.label);
                                                    }}
                                                    className="h-6.5 w-6.5 rounded-md bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                                                    title={`View ${kpi.label} RCA`}
                                                >
                                                    <MapPin size={13} className="text-slate-400" />
                                                </button>
                                            </div> */}
                                        </div>

                                        {/* Platform value cards for this KPI */}
                                        {platformData.map(plat => {
                                            const cell = plat.data[kpi.key]
                                            const textColor = getStatusText(cell?.delta)
                                            const isUp = cell?.delta?.dir === 'up'


                                            if (loading) {
                                                return (
                                                    <div key={plat.key} className={cn('flex-1 px-3', cardSize.minW, cardSize.py)}>
                                                        <Skeleton variant="rounded" height={45} width="100%" style={{ borderRadius: "12px" }} />
                                                        <Skeleton variant="text" width="60%" height={15} className="mx-auto mt-1" />
                                                    </div>
                                                )
                                            }
                                            return (
                                                <motion.button
                                                    key={plat.key}
                                                    onClick={() => copy(`${plat.name} ${kpi.label} `, cell?.value)}
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
                                                    title={`${plat.name} — ${kpi.label}: ${cell?.value} (${cell?.delta?.value})`}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    <div className={cn(
                                                        'absolute inset-0 opacity-10 rounded-xl',
                                                        isUp ? 'bg-gradient-to-br from-emerald-100 to-transparent' : 'bg-gradient-to-br from-rose-100 to-transparent'
                                                    )} />
                                                    <div className={cn('font-bold text-slate-900 tabular-nums relative z-10 leading-tight', cardSize.text)} style={{ fontFamily: 'Roboto, sans-serif' }}>
                                                        {cell?.value}
                                                    </div>
                                                    <div className={cn('font-bold flex items-center justify-center gap-0.5 mt-0.5 relative z-10 whitespace-nowrap', textColor, cardSize.delta)}>
                                                        <span>{cell?.delta?.value}</span>
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
                                    {platformData.reduce((sum, p) => sum + selectedKpis.filter(k => p.data[k.key]?.delta?.dir === 'up').length, 0)}
                                </span>
                                <span className="text-slate-500 text-xs">positive</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                <div className="h-6 w-6 rounded-lg bg-slate-400 flex items-center justify-center">
                                    <TrendingDown size={14} className="text-white" />
                                </div>
                                <span className="text-slate-800 text-sm font-bold">
                                    {platformData.reduce((sum, p) => sum + selectedKpis.filter(k => p.data[k.key]?.delta?.dir === 'down').length, 0)}
                                </span>
                                <span className="text-slate-500 text-xs">negative</span>
                            </div>
                        </div>
                    </div>
                </SectionWrapper>
            </div>

            {/* AdvancedFilterModal */}
            {(() => {
                // Build dynamic {id, name} arrays from FilterContext values
                const toOpts = (arr) =>
                    (arr || [])
                        .filter(v => v && v !== 'All')
                        .map(v => ({ id: v, name: v }));

                const categoryOptions = toOpts(contextCategories);
                const cityOptions = toOpts(contextLocations);
                const brandOptions = toOpts(contextBrands);

                return (
                    <AdvancedFilterModal
                        isOpen={isFilterModalOpen}
                        onClose={() => setIsFilterModalOpen(false)}
                        filters={advancedFilters}
                        onApply={handleApplyFilters}
                        currentDimension={'platform'}
                        brands={brandOptions}
                        categories={categoryOptions}
                        platforms={[]}
                        skus={[]}
                        cities={cityOptions}
                        kpiOptions={kpiDefs}
                    />
                )
            })()}
        </>
    )
}

export default MarketCatOverview
