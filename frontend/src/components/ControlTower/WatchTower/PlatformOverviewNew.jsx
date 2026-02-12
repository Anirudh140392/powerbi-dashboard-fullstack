import { useState, useMemo, useContext } from 'react'
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
import { getLogicalKpiValue } from '@/components/AllAvailablityAnalysis/availablityDataCenter.jsx'
import AdvancedFilterModal from './AdvancedFilterModal'
import { cn } from '../../../lib/utils'

/* --- HELPER COMPONENTS & UTILS --- */
const BrandLogo = ({ name, src, className, imgClassName }) => (
    <img src={src} alt={name} className={cn(className, "object-contain")} />
);

const getStatusText = (delta) => {
    if (!delta) return "text-slate-500";
    return delta.dir === 'up' ? "text-emerald-500" : "text-rose-500";
};

const copy = (title, value) => {
    navigator.clipboard.writeText(`${title}: ${value}`);
};

const cardSize = {
    minW: 'min-w-[125px]',
    py: 'py-2.5',
    text: 'text-[15px]',
    delta: 'text-[10px]'
};

const kpiLabels = {
    offtakes: 'Offtakes',
    spend: 'Spend',
    roas: 'Category size',
    availability: 'Availability',
    marketShare: 'Market share',
    conversion: 'Conversion',
    sos: 'SOS',
    inorgSales: 'Inorganic Sales',
    dspSales: 'DSP Sales',
    promoMyBrand: 'Promo - My Brand',
    promoCompete: 'Promo - Compete',
    cpm: 'CPM',
    cpc: 'CPC'
};

const PlatformOverviewNew = ({
    onViewTrends = () => { },
    onViewRca = () => { },
}) => {
    const {
        selectedChannel,
        platform: globalPlatform,
        selectedBrand,
        selectedLocation,
        timeStart,
        timeEnd
    } = useContext(FilterContext);

    const kpis = [
        { key: 'offtakes', label: 'Offtakes' },
        { key: 'spend', label: 'Spend' },
        { key: 'roas', label: 'Category size' },
        { key: 'inorgSales', label: 'Inorg Sales' },
        { key: 'dspSales', label: 'DSP Sales' },
        { key: 'conversion', label: 'Conversion' },
        { key: 'availability', label: 'Availability' },
        { key: 'sos', label: 'SOS' },
        { key: 'marketShare', label: 'Market share' },
        { key: 'promoMyBrand', label: 'Promo - My Brand' },
        { key: 'promoCompete', label: 'Promo - Compete' },
        { key: 'cpm', label: 'CPM' },
        { key: 'cpc', label: 'CPC' },
    ]
    // Dimension for glance view (single select)
    const [dimension, setDimension] = useState('platform')
    const [glanceKpis, setGlanceKpis] = useState(['offtakes', 'spend', 'roas', 'availability', 'marketShare', 'conversion'])
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
    const [advancedFilters, setAdvancedFilters] = useState({
        brands: [],
        categories: [],
        platforms: [],
        skuName: '',
        skuCode: '',
        dateFrom: '',
        dateTo: '',
        kpis: ['offtakes', 'spend', 'roas', 'availability', 'marketShare', 'conversion'],
        filterLogic: 'OR',
    })
    // Dimension entities (same as App.jsx)
    const dimensionData = {
        platform: {
            label: 'Platform',
            icon: Monitor,
            entities: [
                {
                    key: 'blinkit',
                    name: 'Blinkit',
                    logoSrc: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Blinkit-yellow-app-icon.svg',
                    color: '#fbbf24'
                },
                {
                    key: 'instamart',
                    name: 'Instamart',
                    logoSrc: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp',
                    color: '#f97316'
                },
                {
                    key: 'zepto',
                    name: 'Zepto',
                    logoSrc: 'https://upload.wikimedia.org/wikipedia/commons/8/81/Zepto_Logo.svg',
                    color: '#8b5cf6'
                },
                {
                    key: 'flipkart',
                    name: 'Flipkart',
                    logoSrc: 'https://logos-world.net/wp-content/uploads/2020/11/Flipkart-Logo.png',
                    color: '#2874f0'
                },
                {
                    key: 'amazon',
                    name: 'Amazon',
                    logoSrc: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
                    color: '#f59e0b'
                }
            ]
        },
        brand: {
            label: 'Brand',
            icon: Tag,
            entities: [
                { key: 'cornetto', name: 'Cornetto', color: '#e11d48' },
                { key: 'magnum', name: 'Magnum', color: '#7c3aed' },
                { key: 'feast', name: 'Feast', color: '#0ea5e9' },
                { key: 'twister', name: 'Twister', color: '#f97316' },
            ]
        },
        month: {
            label: 'Month',
            icon: Calendar,
            entities: [
                { key: 'oct', name: 'Oct 2025', color: '#6366f1' },
                { key: 'nov', name: 'Nov 2025', color: '#8b5cf6' },
                { key: 'dec', name: 'Dec 2025', color: '#a855f7' },
                { key: 'jan', name: 'Jan 2026', color: '#c084fc' },
            ]
        },
        category: {
            label: 'Category',
            icon: Grid3X3,
            entities: [
                { key: 'cassata', name: 'Cassata', color: '#14b8a6' },
                { key: 'core tub', name: 'Core Tub', color: '#06b6d4' },
                { key: 'cup', name: 'Cup', color: '#0ea5e9' },
                { key: 'sandwich', name: 'Sandwich', color: '#22c55e' },
            ]
        },
        sku: {
            label: 'SKU',
            icon: Package,
            entities: [
                { key: 'sku1', name: 'KW Cornetto Disc 110ml', color: '#0ea5e9' },
                { key: 'sku2', name: 'KW Magnum Almond 90ml', color: '#1d4ed8' },
                { key: 'sku3', name: 'KW Feast Jaljeera 65ml', color: '#f97316' },
                { key: 'sku4', name: 'KW Cup Vanilla 100ml', color: '#ec4899' },
            ]
        },
    }
    // Generate mock data for each entity (same as App.jsx)
    // Note: context is now defined in useMemo to ensure it updates with filter changes
    function generateEntityData(entityKey, entityIdx, context) {
        const data = {}

        kpis.forEach((kpi, kpiIdx) => {
            const seed = { ...context, entityKey, entityIdx, kpi: kpi.key };
            const val = getLogicalKpiValue(kpi.key, seed);
            const isUp = getLogicalKpiValue(kpi.key + 'dir', seed) > 50;

            let value, deltaVal
            switch (kpi.key) {
                case 'offtakes':
                    value = `₹${val} Cr`
                    deltaVal = `${isUp ? '+' : '-'}${(getLogicalKpiValue(kpi.key + 'delta', seed) / 10).toFixed(1)}%`
                    break
                case 'spend':
                    value = `₹${val} L`
                    deltaVal = `${isUp ? '+' : '-'}${(getLogicalKpiValue(kpi.key + 'delta', seed) / 10).toFixed(1)}%`
                    break
                case 'roas':
                    value = `${val.toFixed(1)}`
                    deltaVal = `${isUp ? '+' : '-'}${(getLogicalKpiValue(kpi.key + 'delta', seed) / 10).toFixed(1)}%`
                    break
                case 'availability':
                case 'conversion':
                case 'sos':
                case 'marketShare':
                case 'inorgSales':
                case 'dspSales':
                case 'promoMyBrand':
                case 'promoCompete':
                    value = `${val}%`
                    deltaVal = `${isUp ? '+' : '-'}${(getLogicalKpiValue(kpi.key + 'delta', seed) / 20).toFixed(1)} pp`
                    break
                case 'cpm':
                    value = `₹${val}`
                    deltaVal = `${isUp ? '+' : '-'}${Math.floor(getLogicalKpiValue(kpi.key + 'delta', seed) / 5)}`
                    break
                case 'cpc':
                    value = `₹${val}`
                    deltaVal = `${isUp ? '+' : '-'}${(getLogicalKpiValue(kpi.key + 'delta', seed) / 20).toFixed(1)}`
                    break
                default:
                    value = `${val}%`
                    deltaVal = `${isUp ? '+' : '-'}${(getLogicalKpiValue(kpi.key + 'delta', seed) / 10).toFixed(1)}%`
            }

            data[kpi.key] = {
                value,
                delta: { value: deltaVal, dir: isUp ? 'up' : 'down' }
            }
        })
        return data
    }
    // Handle filter apply from modal
    const handleApplyFilters = (filters) => {
        setAdvancedFilters(filters)
        setGlanceKpis(filters.kpis)
    }
    // Count active dimension filters
    const activeDimensionFilters = [
        advancedFilters.brands.length > 0,
        advancedFilters.categories.length > 0,
        advancedFilters.platforms.length > 0,
        advancedFilters.skuName.length > 0,
        advancedFilters.skuCode.length > 0,
    ].filter(Boolean).length

    const currentDimension = dimensionData[dimension]
    // Get selected KPIs in order
    const selectedKpis = kpis.filter(k => glanceKpis.includes(k.key))
    const kpiCount = selectedKpis.length

    const entities = useMemo(() => {
        // Define context here so it updates when filter values change
        const context = { selectedChannel, platform: globalPlatform, selectedBrand, selectedLocation, timeStart, timeEnd };

        return currentDimension.entities.map((e, idx) => ({
            ...e,
            data: generateEntityData(e.key, idx, context)
        }))
    }, [currentDimension, selectedChannel, globalPlatform, selectedBrand, selectedLocation, timeStart, timeEnd])

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
                <div className="px-6 py-4 border-b border-slate-100/60">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        {/* Left: Icon + Title + Chip */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <Icon size={20} className="text-blue-600" />
                            </div>
                            <span className="text-[17px] font-bold text-slate-900" style={{ fontFamily: 'Roboto, sans-serif' }}>{title}</span>
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
                <div className="p-6">
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
                        <div className="flex items-center gap-3">
                            {/* Dimension Tabs */}
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

                            {/* Advanced Filter Modal Trigger */}
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

                            {/* Legend indicators */}
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
                    {/* Grid Content - Horizontal Scrollable Area */}
                    <div className="overflow-x-auto no-scrollbar pb-2">
                        <div className="min-w-max pb-2">
                            {/* KPI Labels Header - Premium */}
                            <div className="flex items-center gap-2 mb-4 px-1">
                                <div className="w-56 flex-shrink-0 sticky left-0 bg-white z-20 pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Entity</span>
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
                            <div className="space-y-3 px-1">
                                {entities.map((e) => (
                                    <motion.div
                                        key={e.key}
                                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50/50 transition-colors"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        {/* Entity with Trend & RCA buttons - Sticky */}
                                        <div className="w-56 flex-shrink-0 flex items-center gap-2 sticky left-0 bg-white z-20 pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                            {e.logoSrc ? (
                                                <div className="h-9 w-9 rounded-lg bg-white shadow-sm ring-1 ring-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    <BrandLogo name={e.name} src={e.logoSrc} className="h-9 w-9" imgClassName="h-6 w-6" />
                                                </div>
                                            ) : (
                                                <div
                                                    className="h-9 w-9 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0"
                                                    style={{ background: `linear-gradient(135deg, ${e.color || '#6366f1'}, ${e.color || '#6366f1'}dd)` }}
                                                >
                                                    {e.name.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="text-[13px] font-bold text-slate-700 flex-1 whitespace-nowrap" style={{ fontFamily: 'Roboto, sans-serif' }}>{e.name}</span>

                                            {/* Trend & RCA buttons */}
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(evt) => {
                                                        evt.stopPropagation();
                                                        onViewTrends(e.name || e.label, dimensionData[dimension].label);
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

                    {/* Footer - Summary Stats */}
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
                        <span className="text-xs text-slate-500 font-medium">Click any card to copy • Select KPIs above</span>
                    </div>
                </SectionWrapper>
            </div>
            <AdvancedFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                filters={advancedFilters}
                onApply={handleApplyFilters}
                currentDimension={dimension}
            />
        </>
    )
}

export default PlatformOverviewNew