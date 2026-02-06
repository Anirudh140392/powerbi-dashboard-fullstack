import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, X, Search } from 'lucide-react'
import { cn } from '../../lib/utils'
import { generateDateOptions } from '../../lib/pricingUtils'

// ========================================
// UTILITIES
// ========================================

// Font color heatmap for day-wise values (green=high, red=low)
const getDayWiseFontColor = (value, min = 30, max = 60) => {
    if (value === null || value === undefined) return 'text-slate-400 font-normal'
    const normalized = (value - min) / (max - min)
    if (normalized >= 0.8) return 'text-emerald-600 font-bold'
    if (normalized >= 0.6) return 'text-emerald-500 font-semibold'
    if (normalized >= 0.4) return 'text-slate-700 font-medium'
    if (normalized >= 0.2) return 'text-amber-600 font-medium'
    return 'text-rose-600 font-semibold'
}

// ========================================
// MOCK DATA
// ========================================
const BRAND_SKU_DAY_DATA = [
    {
        id: 'b1',
        brand: 'Colgate',
        skus: [
            {
                id: 's1',
                name: 'Colgate MaxFresh Peppermint Ice Toothpaste',
                ml: '150 g',
                days: {
                    '2026-02-06': { ecp: 145, discount: 5, rpi: 1.2 },
                    '2026-02-05': { ecp: 145, discount: 5, rpi: 1.2 },
                    '2026-02-04': { ecp: 145, discount: 5, rpi: 1.2 },
                    '2026-02-03': { ecp: 136, discount: 12, rpi: 1.1 },
                    '2026-02-02': { ecp: 145, discount: 5, rpi: 1.2 },
                    '2026-02-01': { ecp: 140, discount: 8, rpi: 1.15 },
                    '2026-01-31': { ecp: 142, discount: 6, rpi: 1.18 }
                }
            },
            {
                id: 's2',
                name: 'Colgate Visible White Teeth Whitening',
                ml: '100 g',
                days: {
                    '2026-02-06': { ecp: 99, discount: 10, rpi: 0.95 },
                    '2026-02-05': { ecp: 99, discount: 10, rpi: 0.95 },
                    '2026-02-04': { ecp: 99, discount: 10, rpi: 0.95 },
                    '2026-02-03': { ecp: 99, discount: 10, rpi: 0.95 },
                    '2026-02-02': { ecp: 99, discount: 10, rpi: 0.95 },
                    '2026-02-01': { ecp: 99, discount: 10, rpi: 0.95 },
                    '2026-01-31': { ecp: 95, discount: 12, rpi: 0.9 }
                }
            },
        ]
    },
    {
        id: 'b2',
        brand: 'Dabur',
        skus: [
            {
                id: 's3',
                name: 'Dabur Red Paste - Ayurvedic Health',
                ml: '200 g',
                days: {
                    '2026-02-06': { ecp: 110, discount: 15, rpi: 1.4 },
                    '2026-02-05': { ecp: 110, discount: 15, rpi: 1.4 },
                    '2026-02-04': { ecp: 110, discount: 15, rpi: 1.4 },
                    '2026-02-03': { ecp: 110, discount: 15, rpi: 1.4 },
                    '2026-02-02': { ecp: 110, discount: 15, rpi: 1.4 },
                    '2026-02-01': { ecp: 110, discount: 15, rpi: 1.4 },
                    '2026-01-31': { ecp: 105, discount: 17, rpi: 1.3 }
                }
            },
            {
                id: 's4',
                name: 'Dabur Meswak Complete Oral Care',
                ml: '150 g',
                days: {
                    '2026-02-06': { ecp: 85, discount: 0, rpi: 1.1 },
                    '2026-02-05': { ecp: 85, discount: 0, rpi: 1.1 },
                    '2026-02-04': { ecp: 88, discount: 3, rpi: 1.05 },
                    '2026-02-03': { ecp: 85, discount: 0, rpi: 1.1 },
                    '2026-02-02': { ecp: 88, discount: 3, rpi: 1.05 },
                    '2026-02-01': { ecp: 85, discount: 0, rpi: 1.1 },
                    '2026-01-31': { ecp: 82, discount: 2, rpi: 1.08 }
                }
            },
        ]
    },
    {
        id: 'b3',
        brand: 'Fiama',
        skus: [
            {
                id: 's5',
                name: 'Fiama Shower Gel - Blackcurrant & Bearberry',
                ml: '250 ml',
                days: {
                    '2026-02-06': { ecp: 199, discount: 5, rpi: 0.85 },
                    '2026-02-05': { ecp: 199, discount: 5, rpi: 0.85 },
                    '2026-02-04': { ecp: 199, discount: 5, rpi: 0.85 },
                    '2026-02-03': { ecp: 185, discount: 8, rpi: 0.8 },
                    '2026-02-02': { ecp: 199, discount: 5, rpi: 0.85 },
                    '2026-02-01': { ecp: 199, discount: 5, rpi: 0.85 },
                    '2026-01-31': { ecp: 210, discount: 3, rpi: 0.9 }
                }
            },
        ]
    },
]

// ========================================
// MAIN COMPONENT
// ========================================

function DateWiseDrilldownTable() {
    const [expandedBrands, setExpandedBrands] = useState(['Colgate'])
    const [dayRange, setDayRange] = useState(7)
    const [metricType, setMetricType] = useState('ecp') // 'ecp', 'discount', 'rpi'
    const [searchQuery, setSearchQuery] = useState('')

    const dates = useMemo(() => generateDateOptions(dayRange), [dayRange])

    const filteredData = useMemo(() => {
        if (!searchQuery) return BRAND_SKU_DAY_DATA
        const q = searchQuery.toLowerCase()
        return BRAND_SKU_DAY_DATA.map(brand => {
            const matchesBrand = brand.brand.toLowerCase().includes(q)
            const matchedSkus = brand.skus.filter(sku => sku.name.toLowerCase().includes(q))

            if (matchesBrand) return brand
            if (matchedSkus.length > 0) return { ...brand, skus: matchedSkus }
            return null
        }).filter(Boolean)
    }, [searchQuery])

    const METRIC_OPTIONS = [
        { key: 'ecp', label: 'ECP' },
        { key: 'discount', label: 'Discount' },
        { key: 'rpi', label: 'RPI' },
    ]

    const toggleBrand = (brand) => {
        setExpandedBrands(prev =>
            prev.includes(brand)
                ? prev.filter(b => b !== brand)
                : [...prev, brand]
        )
    }

    const closeAll = () => setExpandedBrands([])

    const getMetricValue = (dayData) => {
        if (!dayData) return null
        return dayData[metricType.toLowerCase()]
    }

    const formatValue = (val) => {
        if (val === null || val === undefined) return '—'
        if (metricType === 'ecp') return `₹${val}`
        if (metricType === 'discount') return `${val}%`
        return val.toFixed(2)
    }

    const activeMetricLabel = METRIC_OPTIONS.find(m => m.key === metricType)?.label || metricType

    return (
        <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 border border-slate-200 mt-8">
            {/* Header Area */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-6">
                    <h2 className="text-xl font-bold text-[#1E293B]">
                        Brand → SKU Day-Level <span className="text-blue-600">{activeMetricLabel}</span>
                    </h2>

                    {/* Day Range Selector (Pill Style) */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl">
                        {[7, 14, 30].map(days => (
                            <button
                                key={days}
                                onClick={() => setDayRange(days)}
                                className={cn(
                                    'px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all',
                                    dayRange === days
                                        ? 'bg-white text-[#1E293B] shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600'
                                )}
                            >
                                {days}D
                            </button>
                        ))}
                    </div>

                    {/* Metric Selector (Pill Style) */}
                    <div className="flex items-center gap-1 p-1 bg-blue-50/50 rounded-xl border border-blue-100">
                        {METRIC_OPTIONS.map(metric => (
                            <button
                                key={metric.key}
                                onClick={() => setMetricType(metric.key)}
                                className={cn(
                                    'px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all',
                                    metricType === metric.key
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                        : 'text-blue-600 hover:bg-blue-100'
                                )}
                            >
                                {metric.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Premium Search Bar */}
                    <div className="relative group min-w-[240px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={14} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search Brand or SKU..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-9 pr-10 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-400 text-slate-700"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {expandedBrands.length > 0 && (
                        <button
                            onClick={closeAll}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all uppercase tracking-wider"
                        >
                            <X size={14} /> Close All ({expandedBrands.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50/30 text-slate-400">
                            <th className="text-left pl-8 py-5 text-[11px] font-bold uppercase tracking-widest w-80">
                                BRAND / SKU
                            </th>
                            <th className="text-center px-4 py-5 text-[11px] font-bold uppercase tracking-widest w-24">
                                ML
                            </th>
                            {dates.map(d => (
                                <th key={d.key} className="text-center px-3 py-5 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
                                    {d.shortLabel.toUpperCase()}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((brand) => {
                            const isExpanded = expandedBrands.includes(brand.brand)

                            return (
                                <React.Fragment key={brand.id}>
                                    {/* Brand Row */}
                                    <tr
                                        className={cn(
                                            'border-b border-slate-50 cursor-pointer transition-colors group',
                                            isExpanded ? 'bg-blue-50/20' : 'hover:bg-slate-50/50'
                                        )}
                                        onClick={() => toggleBrand(brand.brand)}
                                    >
                                        <td className="pl-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <motion.div
                                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500" />
                                                </motion.div>
                                                <span className="text-sm font-bold text-slate-800">{brand.brand}</span>
                                                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                                    {brand.skus.length} SKUs
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-5 text-sm text-slate-300 font-medium text-center">—</td>
                                        {dates.map(d => (
                                            <td key={d.key} className="px-3 py-5 text-sm text-slate-300 font-medium text-center">—</td>
                                        ))}
                                    </tr>

                                    {/* SKU Rows */}
                                    <AnimatePresence>
                                        {isExpanded && brand.skus.map((sku) => (
                                            <motion.tr
                                                key={sku.id}
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-white border-b border-slate-50"
                                            >
                                                <td className="pl-14 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-300 text-lg leading-none mt-[-4px]">└</span>
                                                        <span className="text-sm font-semibold text-slate-600 truncate max-w-[280px]" title={sku.name}>
                                                            {sku.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-[11px] font-bold text-slate-500 text-center uppercase whitespace-nowrap">
                                                    {sku.ml}
                                                </td>
                                                {dates.map(d => {
                                                    const dayData = sku.days[d.key]
                                                    const val = getMetricValue(dayData)
                                                    return (
                                                        <td key={d.key} className="px-3 py-3 text-sm text-center">
                                                            <span className={cn('tabular-nums', getDayWiseFontColor(val))}>
                                                                {formatValue(val)}
                                                            </span>
                                                        </td>
                                                    )
                                                })}
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default DateWiseDrilldownTable