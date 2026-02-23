import { useState, useMemo, useContext } from 'react'
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
    minW: 'min-w-[155px]',
    py: 'py-2.5',
    text: 'text-[15px]',
    delta: 'text-[10px]'
};

const kpiLabels = {
    discount: 'Discount',
    pricePerUnit: 'Price per Unit',
    rpi: 'RPI',
    asp: 'Average Selling Price',
};

const LatestOverivewCatCity = ({
    onViewTrends = () => { },
    onViewRca = () => { },
    kpis: propKpis = [],
}) => {
    const kpis = useMemo(() => propKpis.length > 0 ? propKpis : [
        { key: 'discount', label: 'Discount' },
        { key: 'pricePerUnit', label: 'Price per Unit' },
        { key: 'rpi', label: 'RPI' },
        { key: 'asp', label: 'Average Selling Price' },
    ], [propKpis]);

    const {
        selectedChannel,
        platform: globalPlatform,
        selectedBrand,
        selectedCategory,
        selectedLocation,
        timeStart,
        timeEnd
    } = useContext(FilterContext);

    // ✅ Only 2 tabs: Category + City
    const [dimension, setDimension] = useState('category')
    const [glanceKpis, setGlanceKpis] = useState(['discount', 'pricePerUnit', 'rpi', 'asp'])
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

    const [advancedFilters, setAdvancedFilters] = useState({
        categories: [],
        cities: [],
        dateFrom: '',
        dateTo: '',
        kpis: ['discount', 'pricePerUnit', 'rpi', 'asp'],
        filterLogic: 'OR',
    })

    // ✅ Entity list — ice cream categories & brands
    const dimensionData = {
        category: {
            label: 'Category',
            icon: Grid3X3,
            entities: [
                { key: 'cassata', name: 'Cassata' },
                { key: 'core_tubs', name: 'Core Tubs' },
                { key: 'cup', name: 'Cup' },
                { key: 'sandwich', name: 'Sandwich' },
                { key: 'stick', name: 'Stick / Bar' },
                // { key: 'cone', name: 'Cone' },
            ]
        },
        city: {
            label: 'City',
            icon: MapPin,
            entities: [
                { key: 'mumbai', name: 'Mumbai' },
                { key: 'delhi', name: 'Delhi NCR' },
                { key: 'bengaluru', name: 'Bengaluru' },
                { key: 'kolkata', name: 'Kolkata' },
                { key: 'hyderabad', name: 'Hyderabad' },
                { key: 'ahmedabad', name: 'Ahmedabad' },
                { key: 'pune', name: 'Pune' },
            ]
        },
    }


    // ✅ Mock generator (same pattern as your existing logic)
    function generateEntityData(entityKey, entityIdx, context, currentDimensionKey) {
        const data = {}

        kpis.forEach((kpi) => {
            const seed = { ...context, entityKey, entityIdx, kpi: kpi.key };
            const base = getLogicalKpiValue(kpi.key, seed);
            const isUp = getLogicalKpiValue(kpi.key + 'dir', seed) > 50;

            let value, deltaVal;

            switch (kpi.key) {
                case 'discount': {
                    // 5% - 30%
                    const v = 5 + (base % 26);
                    value = `${v.toFixed(1)}%`;
                    deltaVal = `${isUp ? '+' : '-'}${(getLogicalKpiValue(kpi.key + 'delta', seed) / 10).toFixed(1)}%`
                    break;
                }
                case 'pricePerUnit': {
                    // ₹80 - ₹399
                    const v = 80 + (base % 320);
                    value = `₹${v.toFixed(2)}`;
                    deltaVal = `${isUp ? '+' : '-'}${(getLogicalKpiValue(kpi.key + 'delta', seed) / 10).toFixed(1)}%`
                    break;
                }
                case 'rpi': {
                    // 1.5 - 7.5
                    const v = 1.5 + ((base % 61) / 10);
                    value = `${v.toFixed(1)}`;
                    deltaVal = `${isUp ? '+' : '-'}${(getLogicalKpiValue(kpi.key + 'delta', seed) / 20).toFixed(1)}%`
                    break;
                }
                case 'asp': {
                    // ₹60 - ₹349
                    const v = 60 + (base % 290);
                    value = `₹${v.toFixed(2)}`;
                    deltaVal = `${isUp ? '+' : '-'}${(getLogicalKpiValue(kpi.key + 'delta', seed) / 10).toFixed(1)}%`
                    break;
                }
                default: {
                    value = `${base}`;
                    deltaVal = `${isUp ? '+' : '-'}${(getLogicalKpiValue(kpi.key + 'delta', seed) / 10).toFixed(1)}%`
                }
            }

            data[kpi.key] = {
                value,
                delta: { value: deltaVal, dir: isUp ? 'up' : 'down' }
            }
        })

        return data
    }

    const handleApplyFilters = (filters) => {
        setAdvancedFilters(filters)
        setGlanceKpis(filters.kpis)
    }

    const activeDimensionFilters = [
        advancedFilters.categories?.length > 0,
        advancedFilters.cities?.length > 0,
    ].filter(Boolean).length

    const currentDimension = dimensionData[dimension]
    const selectedKpis = kpis.filter(k => glanceKpis.includes(k.key))
    const kpiCount = selectedKpis.length

    const entities = useMemo(() => {
        const context = { selectedChannel, platform: globalPlatform, selectedBrand, selectedCategory, selectedLocation, timeStart, timeEnd };

        let list = currentDimension.entities.slice()

        // Apply dimension-specific advanced filters
        if (dimension === 'category' && advancedFilters.categories?.length > 0) {
            list = list.filter(e => advancedFilters.categories.includes(e.key))
        }
        if (dimension === 'city' && advancedFilters.cities?.length > 0) {
            list = list.filter(e => advancedFilters.cities.includes(e.key))
        }

        return list.map((e, idx) => ({
            ...e,
            data: generateEntityData(e.key, idx, context, dimension)
        }))
    }, [
        currentDimension,
        selectedChannel, globalPlatform, selectedBrand, selectedCategory, selectedLocation, timeStart, timeEnd,
        advancedFilters,
        dimension
    ])

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
                    title="Category Overview"
                    icon={currentDimension.icon}
                    chip={`${entities.length} ${currentDimension.label} × ${kpiCount} KPIs`}
                    headerRight={
                        <div className="flex items-center gap-3">
                            {/* ✅ Only 2 tabs */}
                            <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/50">
                                {Object.entries(dimensionData).map(([key, dim]) => {
                                    const isSelected = dimension === key
                                    const DimIcon = dim.icon
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setDimension(key)}
                                            className={cn(
                                                'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all',
                                                isSelected
                                                    ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            )}
                                            style={{ fontFamily: 'Roboto, sans-serif' }}
                                        >
                                            <DimIcon size={13} />
                                            {dim.label}
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Filters */}
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

                            {/* Rows */}
                            <div className="space-y-3 px-1">
                                {entities.map((e) => (
                                    <motion.div
                                        key={e.key}
                                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50/50 transition-colors"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        {/* ✅ Entity TEXT ONLY (no logo) */}
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
                                                    className="h-6.5 w-6.5 rounded-md bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                                                    title={`View ${e.name} Trend`}
                                                >
                                                    <LineChart size={13} className="text-slate-400" />
                                                </button>
                                                <button
                                                    onClick={(evt) => {
                                                        evt.stopPropagation();
                                                        // onViewRca(e.name);
                                                    }}
                                                    className="h-6.5 w-6.5 rounded-md bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                                                    title={`View ${e.name} RCA`}
                                                >
                                                    <MapPin size={13} className="text-slate-400" />
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

            {/* AdvancedFilterModal (kept same; just pass category+city options) */}
            {(() => {
                const categoryOptions = (dimensionData.category?.entities || []).map(e => ({ id: e.key, name: e.name }))
                const cityOptions = (dimensionData.city?.entities || []).map(e => ({ id: e.key, name: e.name }))

                return (
                    <AdvancedFilterModal
                        isOpen={isFilterModalOpen}
                        onClose={() => setIsFilterModalOpen(false)}
                        filters={advancedFilters}
                        onApply={handleApplyFilters}
                        currentDimension={dimension}
                        brands={[]}               // not used now
                        categories={categoryOptions}
                        platforms={[]}            // not used now
                        skus={[]}                 // not used now
                        cities={cityOptions}      // ✅ if your modal supports cities
                        kpiOptions={kpis}
                    />
                )
            })()}
        </>
    )
}

export default LatestOverivewCatCity
