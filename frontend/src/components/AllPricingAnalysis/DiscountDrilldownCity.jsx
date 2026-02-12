import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, X, SlidersHorizontal, Search } from 'lucide-react'
import { cn } from '../../lib/utils'
import { KpiFilterPanel } from "@/components/KpiFilterPanel"
import axiosInstance from "@/api/axiosInstance"

const PLATFORMS = [
    { key: 'blinkit', label: 'Blinkit', bg: 'bg-yellow-100', text: 'text-yellow-700' },
    { key: 'instamart', label: 'Instamart', bg: 'bg-orange-100', text: 'text-orange-700' },
    { key: 'zepto', label: 'Zepto', bg: 'bg-purple-100', text: 'text-purple-700' },
]

const DiscountDrilldownCity = ({ data = [], loading = false }) => {
    const [expandedCities, setExpandedCities] = useState([])
    const [metricType, setMetricType] = useState('ecp') // 'ecp', 'discount', 'rpi'
    const [searchQuery, setSearchQuery] = useState('')

    // Derived platforms from data
    const dynamicPlatforms = useMemo(() => {
        const platformSet = new Set();
        data.forEach(city => {
            if (city.totals) {
                Object.keys(city.totals).forEach(p => {
                    if (p !== 'total') platformSet.add(p);
                });
            }
        });

        // If data is empty or no platforms found, use defaults as fallback
        if (platformSet.size === 0) {
            return [
                { key: 'blinkit', label: 'Blinkit' },
                { key: 'instamart', label: 'Instamart' },
                { key: 'zepto', label: 'Zepto' },
            ];
        }

        return Array.from(platformSet).map(key => ({
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1)
        }));
    }, [data]);

    // ========================================
    // FILTER STATE & LOGIC
    // ========================================
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    // Applied filters (simulated for now, can be connected to global context)
    const [appliedFilters, setAppliedFilters] = useState({
        platform: [],
        format: [],
        city: [],
        brand: [],
    });

    const METRIC_OPTIONS = [
        { key: 'ecp', label: 'ECP', suffix: '₹' },
        { key: 'discount', label: 'Discount', suffix: '%' },
        { key: 'rpi', label: 'RPI', suffix: '' },
    ]

    const toggleCity = (city) => {
        setExpandedCities(prev =>
            prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
        )
    }

    const closeAll = () => setExpandedCities([])

    const filteredData = useMemo(() => {
        if (!searchQuery) return data
        const q = searchQuery.toLowerCase()
        return data.filter(item =>
            item.city.toLowerCase().includes(q) ||
            item.brands.some(b => b.name.toLowerCase().includes(q))
        )
    }, [data, searchQuery])

    const getMetricValue = (platformData) => {
        if (!platformData) return null
        return platformData[metricType]
    }

    const formatValue = (val) => {
        if (val === null || val === undefined) return null
        if (metricType === 'rpi') return Number(val).toFixed(2)
        if (metricType === 'discount') return `${val}%`
        return `₹${val}`
    }

    const getMetricFontColor = (val) => {
        if (val === null || val === undefined) return 'text-slate-400'
        if (metricType === 'discount') {
            if (val <= 5) return 'text-emerald-600 font-semibold'
            if (val <= 15) return 'text-amber-500'
            return 'text-rose-500 font-semibold'
        }
        if (metricType === 'rpi') {
            if (val >= 1.2) return 'text-emerald-600 font-semibold'
            if (val >= 0.9) return 'text-slate-600'
            return 'text-rose-500 font-semibold'
        }
        return 'text-slate-600'
    }

    const MetricCell = ({ platformData }) => {
        const val = getMetricValue(platformData)
        if (val === null || val === undefined) {
            return <td className="px-3 py-2 text-center text-slate-300 text-sm">—</td>
        }
        return (
            <td className="px-3 py-2 text-center">
                <span className={cn('text-sm tabular-nums font-medium', getMetricFontColor(val))}>
                    {formatValue(val)}
                </span>
            </td>
        )
    }

    if (loading && data.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center min-h-[300px] mt-6">
                <div className="w-10 h-10 rounded-full border-4 border-blue-50 border-t-blue-500 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Loading city insights...</p>
            </div>
        )
    }

    const activeMetric = METRIC_OPTIONS.find(m => m.key === metricType)

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.03)] ring-1 ring-slate-200/50 mt-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">City → Brand {activeMetric.label} Drilldown</span>
                    <div className="flex items-center gap-1 p-0.5 bg-blue-50 rounded-lg border border-blue-200">
                        {METRIC_OPTIONS.map(metric => (
                            <button
                                key={metric.key}
                                onClick={() => setMetricType(metric.key)}
                                className={cn(
                                    'px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all',
                                    metricType === metric.key
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-blue-600 hover:bg-blue-100'
                                )}
                            >
                                {metric.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={14} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search City..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-9 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        />
                    </div>
                    {expandedCities.length > 0 && (
                        <button
                            onClick={closeAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                        >
                            <X size={12} /> Close All
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-900">
                            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider w-72">City / Brand</th>
                            <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider w-24">ML</th>
                            {dynamicPlatforms.map(p => (
                                <th key={p.key} className="text-center px-3 py-3 text-xs font-bold uppercase tracking-wider">{p.label}</th>
                            ))}
                            <th className="text-center px-3 py-3 text-xs font-bold uppercase tracking-wider">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((item) => {
                            const isExpanded = expandedCities.includes(item.city)
                            return (
                                <React.Fragment key={item.city}>
                                    <tr
                                        className={cn('border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50', isExpanded && 'bg-blue-50/30')}
                                        onClick={() => toggleCity(item.city)}
                                    >
                                        <td className="px-4 py-3 font-semibold text-slate-800 text-sm">
                                            <div className="flex items-center gap-2">
                                                <ChevronRight size={16} className={cn('text-slate-400 transition-transform', isExpanded && 'rotate-90')} />
                                                {item.city}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-400">—</td>
                                        {dynamicPlatforms.map(p => (
                                            <MetricCell key={p.key} platformData={item.totals?.[p.key]} />
                                        ))}
                                        <MetricCell platformData={item.totals?.total} />
                                    </tr>
                                    <AnimatePresence>
                                        {isExpanded && item.brands.map((brand) => (
                                            <motion.tr
                                                key={`${item.city}-${brand.name}`}
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="bg-slate-50/50 border-b border-slate-50"
                                            >
                                                <td className="px-4 py-2 pl-10 text-sm text-slate-600">
                                                    <span className="text-xs text-slate-300 mr-2">└</span>
                                                    {brand.name}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <span className="text-[10px] font-medium text-slate-500 bg-white border border-slate-100 px-1.5 py-0.5 rounded">{brand.ml}</span>
                                                </td>
                                                {dynamicPlatforms.map(p => (
                                                    <MetricCell key={p.key} platformData={brand[p.key]} />
                                                ))}
                                                <MetricCell platformData={brand.total} />
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

export default DiscountDrilldownCity