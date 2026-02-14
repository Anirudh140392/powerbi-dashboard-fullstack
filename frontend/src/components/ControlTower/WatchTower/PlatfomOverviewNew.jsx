import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    TrendingUp,
    TrendingDown,
    Monitor,
    Tag,
    Calendar,
    Grid3X3,
    Package,
    LineChart,
    SlidersHorizontal,
    Settings,
    MapPin,
} from 'lucide-react'
import { Tooltip } from "@mui/material";
import AdvancedFilterModal from './AdvancedFilterModal'
import { cn } from '../../../lib/utils'

/* --- HELPER COMPONENTS & UTILS --- */
const BrandLogo = ({ name, src, className }) => (
    <img src={src} alt={name} className={cn(className, "object-contain")} />
);

const kpiLabels = {
    offtakes: 'OFFTAKES',
    categorySize: 'CATEGORY SIZE',
    spend: 'SPEND',
    roas: 'ROAS',
    availability: 'AVAILABILITY',
    marketShare: 'MARKET',
    conversion: 'CONVERSION',
    shareOfSearch: 'SHARE OF SEARCH',
    inorgSales: 'INORG SALES',
    dspSales: 'DSP SALES',
    promoMy: 'PROMO (MY)',
    promoComp: 'PROMO (COMP)',
    cpm: 'CPM',
    cpc: 'CPC'
};

const PlatformOverviewNew = ({
    onViewTrends = () => { },
    onViewRca = () => { },
    data = [],
    loading = false,
    onDimensionChange = () => { },
    onFiltersChange = () => { },
    currentDimension: propDimension = 'platform',
}) => {
    const kpis = [
        { key: 'offtakes', label: 'Offtakes' },
        { key: 'categorySize', label: 'Category Size' },
        { key: 'spend', label: 'Spend' },
        { key: 'roas', label: 'ROAS' },
        { key: 'inorgSales', label: 'Inorg Sales' },
        { key: 'dspSales', label: 'DSP Sales' },
        { key: 'conversion', label: 'Conversion' },
        { key: 'availability', label: 'Availability' },
        { key: 'shareOfSearch', label: 'Share of Search' },
        { key: 'marketShare', label: 'Market Share' },
        { key: 'promoMy', label: 'Promo (My)' },
        { key: 'promoComp', label: 'Promo (Comp)' },
        { key: 'cpm', label: 'CPM' },
        { key: 'cpc', label: 'CPC' },
    ]

    // Use dimension from prop directly - fully controlled component
    const dimension = propDimension;
    const [glanceKpis, setGlanceKpis] = useState(['offtakes', 'categorySize', 'spend', 'roas', 'conversion', 'availability', 'marketShare'])
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

    const [advancedFilters, setAdvancedFilters] = useState({
        brands: [],
        categories: [],
        platforms: [],
        skuName: '',
        skuCode: '',
        dateFrom: '',
        dateTo: '',
        kpis: ['offtakes', 'categorySize', 'spend', 'roas', 'conversion', 'availability', 'marketShare'],
        filterLogic: 'OR',
    })

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
                    key: 'zepto',
                    name: 'Zepto',
                    logoSrc: 'https://upload.wikimedia.org/wikipedia/commons/8/81/Zepto_Logo.svg',
                    color: '#8b5cf6'
                },
                {
                    key: 'swiggy',
                    name: 'Swiggy Instamart',
                    logoSrc: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp',
                    color: '#f97316'
                },
                {
                    key: 'amazon',
                    name: 'Amazon',
                    logoSrc: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
                    color: '#f59e0b'
                },
                {
                    key: 'flipkart',
                    name: 'Flipkart',
                    logoSrc: 'https://logos-world.net/wp-content/uploads/2020/11/Flipkart-Logo.png',
                    color: '#2874f0'
                },
                {
                    key: 'myntra',
                    name: 'Myntra',
                    logoSrc: 'https://cdn.worldvectorlogo.com/logos/myntra-1.svg',
                    color: '#ff3f6c'
                },
            ]
        },
        brand: {
            label: 'Brand',
            icon: Tag,
            entities: [
                { key: 'colgate', name: 'Colgate', color: '#ef4444' },
                { key: 'halo', name: 'Halo', color: '#8b5cf6' },
                { key: 'palmolive', name: 'Palmolive', color: '#22c55e' },
            ]
        },
        month: {
            label: 'Month',
            icon: Calendar,
            entities: [
                { key: 'jan', name: 'Jan 2025', color: '#6366f1' },
                { key: 'feb', name: 'Feb 2025', color: '#8b5cf6' },
                { key: 'mar', name: 'Mar 2025', color: '#a855f7' },
                { key: 'apr', name: 'Apr 2025', color: '#c084fc' },
                { key: 'may', name: 'May 2025', color: '#0ea5e9' },
                { key: 'jun', name: 'Jun 2025', color: '#22c55e' },
                { key: 'jul', name: 'Jul 2025', color: '#f59e0b' },
                { key: 'aug', name: 'Aug 2025', color: '#f97316' },
                { key: 'sep', name: 'Sep 2025', color: '#ef4444' },
                { key: 'oct', name: 'Oct 2025', color: '#6366f1' },
                { key: 'nov', name: 'Nov 2025', color: '#8b5cf6' },
                { key: 'dec', name: 'Dec 2025', color: '#a855f7' },
            ]
        },
        category: {
            label: 'Category',
            icon: Grid3X3,
            entities: [
                { key: 'toothpaste', name: 'Toothpaste', color: '#14b8a6' },
                { key: 'mouthwash', name: 'Mouthwash', color: '#06b6d4' },
                { key: 'toothbrush', name: 'Toothbrush', color: '#0ea5e9' },
                { key: 'bodywash', name: 'Bodywash', color: '#22c55e' },
            ]
        },
        sku: {
            label: 'SKU',
            icon: Package,
            entities: [
                { key: 'colgate_maxfresh_1', name: 'Colgate Maxfresh Plax', color: '#0ea5e9' },
                { key: 'colgate_maxfresh_2', name: 'Colgate Maxfresh Plax', color: '#1d4ed8' },
                { key: 'colgate_active_salt', name: 'Colgate Active Salt', color: '#f97316' },
                { key: 'dabur_red', name: 'Dabur Red Herbal', color: '#ec4899' },
            ]
        },
        city: {
            label: 'City',
            icon: MapPin,
            entities: [
                { key: 'agra', name: 'Agra', color: '#0ea5e9' },
                { key: 'karnal', name: 'Karnal', color: '#1d4ed8' },
                { key: 'faridabad', name: 'Faridabad', color: '#f97316' },
                { key: 'bengaluru', name: 'Bengaluru', color: '#ec4899' },
                { key: 'mumbai', name: 'Mumbai', color: '#14b8a6' },
            ]
        },
    }

    function generateEntityData(entityKey, entityIdx) {
        const data = {}
        kpis.forEach((kpi, kpiIdx) => {
            const baseVal = 10 + entityIdx * 5 + kpiIdx * 2
            const isUp = (entityIdx + kpiIdx) % 3 !== 0

            let value, deltaVal
            switch (kpi.key) {
                case 'offtakes':
                    value = `₹${(1 + entityIdx * 0.5).toFixed(2)} Cr`
                    deltaVal = `+${(1 + kpiIdx * 0.3).toFixed(1)}%`
                    break
                case 'spend':
                    value = `₹${(0.6 + entityIdx * 0.25).toFixed(2)} Cr`
                    deltaVal = `+${(0.5 + kpiIdx * 0.2).toFixed(1)}%`
                    break
                case 'roas':
                    value = `${(4.2 + entityIdx * 0.5).toFixed(1)}`
                    deltaVal = `+${(0.3 + kpiIdx * 0.1).toFixed(1)}`
                    break
                case 'categorySize':
                    value = `₹${(10 + entityIdx * 5).toFixed(1)} Cr`
                    deltaVal = `+${(1 + kpiIdx * 0.3).toFixed(1)}%`
                    break
                case 'conversion':
                    value = `${(75 + entityIdx * 3).toFixed(1)}%`
                    deltaVal = `+${(1 + kpiIdx * 0.2).toFixed(1)}%`
                    break
                case 'availability':
                    value = `${(76 + entityIdx * 3).toFixed(1)}%`
                    deltaVal = `+${(1 + kpiIdx * 0.1).toFixed(1)}%`
                    break
                case 'marketShare':
                    value = `${(78 + entityIdx * 3).toFixed(1)}%`
                    deltaVal = `+${(1.3 + kpiIdx * 0.1).toFixed(1)}%`
                    break
                default:
                    value = `${(baseVal * 0.8).toFixed(1)}%`
                    deltaVal = `+${(0.3 + kpiIdx * 0.1).toFixed(1)}%`
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
        // Notify parent to refetch data with new filters
        onFiltersChange(filters)
    }

    const currentDimension = dimensionData[dimension]
    const selectedKpis = kpis.filter(k => glanceKpis.includes(k.key))
    const kpiCount = selectedKpis.length

    // Handle dimension change - notify parent to fetch new data
    const handleDimensionChange = (newDimension) => {
        onDimensionChange(newDimension);
    };

    // Transform passed data to entity format, or use fallback dummy data
    const entities = useMemo(() => {
        // When loading, return empty array to show skeleton
        if (loading) {
            return [];
        }
        if (data && data.length > 0) {
            // Transform backend data to the expected entity format
            return data.map((item, idx) => {
                // Extract KPI data from columns array
                const columnsData = {};
                if (item.columns) {
                    item.columns.forEach(col => {
                        const key = col.title.toLowerCase().replace(/\s+/g, '').replace('(', '').replace(')', '');
                        // Map column titles to KPI keys
                        const keyMap = {
                            'offtakes': 'offtakes',
                            'categorysize': 'categorySize',
                            'spend': 'spend',
                            'roas': 'roas',
                            'inorgsales': 'inorgSales',
                            'dspsales': 'dspSales',
                            'conversion': 'conversion',
                            'availability': 'availability',
                            'sos': 'shareOfSearch',
                            'marketshare': 'marketShare',
                            'promomybrand': 'promoMy',
                            'promocompete': 'promoComp',
                            'cpm': 'cpm',
                            'cpc': 'cpc'
                        };
                        const mappedKey = keyMap[key] || key;
                        columnsData[mappedKey] = {
                            value: mappedKey === 'roas' && typeof col.value === 'string' ? col.value.replace(/x/gi, '') : col.value,
                            delta: col.change ? {
                                value: col.change.text ? col.change.text.replace(/pp|pt/gi, '%').replace(/x/gi, '') : '',
                                dir: col.change.positive ? 'up' : 'down'
                            } : { value: '', dir: 'up' }
                        };
                    });
                }
                return {
                    key: item.key || `entity-${idx}`,
                    name: item.label || item.name || 'Unknown',
                    logoSrc: item.logo || item.logoSrc,
                    color: item.color || '#6366f1',
                    data: columnsData
                };
            });
        }
        // Fallback to dummy data from dimensionData only if not loading
        return currentDimension.entities.map((e, idx) => ({
            ...e,
            data: generateEntityData(e.key, idx)
        }));
    }, [data, currentDimension, loading])

    return (
        <div style={{ fontFamily: 'Roboto, sans-serif' }} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            {/* VIEW BY Header */}
            <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between flex-wrap gap-6">
                    {/* Left: VIEW BY + Dimension Tabs */}
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">VIEW BY</span>
                        <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-lg border border-slate-100">
                            {Object.entries(dimensionData).map(([key, dim]) => {
                                const isSelected = dimension === key
                                const DimIcon = dim.icon
                                return (
                                    <button
                                        key={key}
                                        onClick={() => handleDimensionChange(key)}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all',
                                            isSelected
                                                ? 'bg-slate-800 text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                        )}
                                    >
                                        <DimIcon size={12} />
                                        {dim.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Right: Filters Button */}
                    <motion.button
                        onClick={() => setIsFilterModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:shadow-sm transition-all"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <SlidersHorizontal size={12} />
                        <span>Filters</span>
                        <span className="bg-teal-500 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                            {kpiCount} KPIs
                        </span>
                    </motion.button>
                </div>
            </div>

            {/* Performance Matrix Header */}
            <div className="px-5 py-2 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-slate-800">Performance Matrix</span>
                    <span className="text-[11px] text-slate-400">{entities.length} {currentDimension.label} × {kpiCount} KPIs</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Growth
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-rose-500 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span> Decline
                    </span>
                </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-max">
                    {/* Table Header */}
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="text-left py-3 px-5 w-52">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ENTITY</span>
                            </th>
                            {selectedKpis.map(kpi => (
                                <th key={kpi.key} className="text-center py-3 px-3 min-w-[120px]">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {kpiLabels[kpi.key] || kpi.label.toUpperCase()}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    {/* Table Body */}
                    <tbody>
                        {/* Skeleton Loaders when loading */}
                        {loading && (
                            <>
                                {[1, 2, 3, 4, 5].map((rowIdx) => (
                                    <tr key={`skeleton-${rowIdx}`} className="border-b border-slate-50">
                                        <td className="py-4 px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse" />
                                                <div className="h-4 w-24 rounded bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse" />
                                            </div>
                                        </td>
                                        {selectedKpis.map((kpi, kpiIdx) => (
                                            <td key={`skeleton-${rowIdx}-${kpi.key}`} className="py-4 px-3">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <div className="h-5 w-20 rounded bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse" />
                                                    <div className="h-3 w-10 rounded bg-gradient-to-r from-slate-100 to-slate-50 animate-pulse" />
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </>
                        )}
                        {/* Actual data rows */}
                        {!loading && entities.map((e, entityIdx) => (
                            <motion.tr
                                key={e.key}
                                className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: entityIdx * 0.05 }}
                            >
                                {/* Entity Cell */}
                                <td className="py-3 px-5">
                                    <div className="flex items-center gap-3">
                                        {e.logoSrc ? (
                                            <div className="h-8 w-8 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                <BrandLogo name={e.name} src={e.logoSrc} className="h-6 w-6" />
                                            </div>
                                        ) : (
                                            <div
                                                className="h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0"
                                                style={{ backgroundColor: e.color || '#6366f1' }}
                                            >
                                                {e.name.slice(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        {dimension === 'platform' ? (
                                            <Tooltip title={e.name} arrow placement="top">
                                                <span className="text-[12px] font-semibold text-slate-700 overflow-x-auto whitespace-nowrap scrollbar-hide max-w-[150px] inline-block align-middle">
                                                    {e.name}
                                                </span>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip
                                                title={e.name}
                                                arrow
                                                placement="top"
                                                slotProps={{
                                                    tooltip: {
                                                        sx: {
                                                            maxWidth: 400,
                                                            whiteSpace: 'normal',
                                                            wordBreak: 'break-word',
                                                            fontSize: '12px',
                                                            lineHeight: 1.4,
                                                        }
                                                    }
                                                }}
                                            >
                                                <span className="text-[12px] font-semibold text-slate-700 truncate max-w-[250px] inline-block">
                                                    {e.name}
                                                </span>
                                            </Tooltip>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-1 ml-1">
                                            <button
                                                onClick={() => onViewTrends(e.name, currentDimension.label)}
                                                className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 hover:bg-slate-100 flex items-center justify-center transition-all"
                                                title="View Trends"
                                            >
                                                <LineChart size={11} className="text-slate-400" />
                                            </button>
                                            <button
                                                onClick={() => onViewRca(e.name)}
                                                className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 hover:bg-slate-100 flex items-center justify-center transition-all"
                                                title="Settings"
                                            >
                                                <Settings size={11} className="text-slate-400" />
                                            </button>
                                        </div>
                                    </div>
                                </td>

                                {/* KPI Cells */}
                                {selectedKpis.map(kpi => {
                                    const cell = e.data[kpi.key]
                                    const isUp = cell?.delta?.dir === 'up'

                                    return (
                                        <td key={kpi.key} className="py-3 px-2">
                                            <div
                                                className={cn(
                                                    'px-4 py-2 rounded-lg text-center transition-all',
                                                    isUp
                                                        ? 'bg-gradient-to-r from-emerald-50 to-emerald-100/50'
                                                        : 'bg-gradient-to-r from-rose-50 to-rose-100/50'
                                                )}
                                            >
                                                <div className="text-[13px] font-bold text-slate-800">
                                                    {cell?.value}
                                                </div>
                                                <div className={cn(
                                                    'text-[10px] font-semibold mt-0.5',
                                                    isUp ? 'text-emerald-600' : 'text-rose-500'
                                                )}>
                                                    {cell?.delta?.value}
                                                </div>
                                            </div>
                                        </td>
                                    )
                                })}
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Advanced Filter Modal */}
            <AdvancedFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                filters={advancedFilters}
                onApply={handleApplyFilters}
                currentDimension={dimension}
            />
        </div>
    )
}

export default PlatformOverviewNew
