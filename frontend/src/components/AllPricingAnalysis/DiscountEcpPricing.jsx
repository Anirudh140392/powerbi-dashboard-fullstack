import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, X, SlidersHorizontal, Search } from 'lucide-react'
import { CircularProgress } from '@mui/material'
import { cn } from '../../lib/utils'
import { KpiFilterPanel } from "@/components/KpiFilterPanel"
import axiosInstance from "@/api/axiosInstance"

const DiscountEcpPricing = ({
    filters,
    selectedBrand,
    globalPlatform,
    selectedLocation,
    timeStart,
    timeEnd
}) => {
    const [apiData, setApiData] = useState([])
    const [brandDataMap, setBrandDataMap] = useState({}) // category -> brands array
    const [loading, setLoading] = useState(false)
    const [brandLoading, setBrandLoading] = useState({}) // category -> loading boolean
    const [metricType, setMetricType] = useState('ecp') // 'ecp', 'discount', 'rpi'
    const [expandedRows, setExpandedRows] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [platforms, setPlatforms] = useState(['Blinkit', 'Instamart', 'Zepto']) // Default, updated from API

    // ========================================
    // DATA FETCHING
    // ========================================

    const fetchCategories = async () => {
        setLoading(true)
        try {
            const params = {
                startDate: timeStart?.format('YYYY-MM-DD'),
                endDate: timeEnd?.format('YYYY-MM-DD'),
                metricType: metricType
            }

            // Sync with global filters
            if (globalPlatform && globalPlatform !== 'All') params.platform = globalPlatform;
            const brandFilter = selectedBrand || filters?.brand;
            if (brandFilter && brandFilter !== 'All') params.brand = brandFilter;
            if (selectedLocation && selectedLocation !== 'All') params.city = selectedLocation;
            if (filters?.format && filters.format !== 'All') params.format = filters.format;

            console.log("[DiscountEcpPricing] Fetching categories with params:", params);
            const res = await axiosInstance.get('/pricing-analysis/discount-by-category', { params })
            if (res.data?.success) {
                setApiData(res.data.data || [])
                if (res.data.platforms?.length > 0) {
                    setPlatforms(res.data.platforms)
                }
            }
        } catch (err) {
            console.error("Error fetching categories", err)
        } finally {
            setLoading(false)
        }
    }

    const fetchBrands = async (category) => {
        if (brandDataMap[category]) return // Already have it

        setBrandLoading(prev => ({ ...prev, [category]: true }))
        try {
            const params = {
                category,
                startDate: timeStart?.format('YYYY-MM-DD'),
                endDate: timeEnd?.format('YYYY-MM-DD'),
                metricType: metricType
            }

            // Sync with global filters
            if (globalPlatform && globalPlatform !== 'All') params.platform = globalPlatform;
            const brandFilter = selectedBrand || filters?.brand;
            if (brandFilter && brandFilter !== 'All') params.brand = brandFilter;
            if (selectedLocation && selectedLocation !== 'All') params.city = selectedLocation;
            if (filters?.format && filters.format !== 'All') params.format = filters.format;

            const res = await axiosInstance.get('/pricing-analysis/discount-by-brand', { params })
            if (res.data?.success) {
                setBrandDataMap(prev => ({ ...prev, [category]: res.data.data || [] }))
            }
        } catch (err) {
            console.error("Error fetching brands", err)
        } finally {
            setBrandLoading(prev => ({ ...prev, [category]: false }))
        }
    }

    // Load categories on change
    useEffect(() => {
        fetchCategories()
        // Reset brand data when filters or metric changes significantly
        setBrandDataMap({})
        setExpandedRows([])
    }, [metricType, timeStart, timeEnd, globalPlatform, selectedBrand, selectedLocation, filters?.format])

    // ========================================
    // FILTER STATE & LOGIC
    // ========================================
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    // Local filters (separate from global props for internal fine-tuning if needed)
    const [tentativeFilters, setTentativeFilters] = useState({});
    const [appliedFilters, setAppliedFilters] = useState({});
    const [dynamicFilterData, setDynamicFilterData] = useState({
        platforms: [],
        formats: [],
        cities: [],
        months: [],
        dates: [],
        brands: [],
        loading: true
    });

    const fetchFilterType = async (filterType) => {
        try {
            const apiBase = '/availability-analysis/filter-options';
            const res = await axiosInstance.get(`${apiBase}?filterType=${filterType}`);
            return res.data?.options || [];
        } catch (error) {
            console.error(`Error fetching ${filterType}:`, error);
            return [];
        }
    };

    useEffect(() => {
        const fetchAll = async () => {
            const [p, f, c, m, b] = await Promise.all([
                fetchFilterType('platforms'),
                fetchFilterType('formats'),
                fetchFilterType('cities'),
                fetchFilterType('months'),
                fetchFilterType('brands')
            ]);
            setDynamicFilterData({
                platforms: p,
                formats: f,
                cities: c,
                months: m,
                brands: b,
                loading: false
            });
        };
        fetchAll();
    }, []);

    const filterOptions = useMemo(() => {
        const toOptions = (arr) => (arr || []).map(item => ({ id: item, label: item }));
        return [
            { id: "brand", label: "Brand", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.brands)] },
            { id: "platform", label: "Platform", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.platforms)] },
            { id: "format", label: "Category", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.formats)] },
            { id: "city", label: "City", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.cities)] },
        ];
    }, [dynamicFilterData]);

    const METRIC_OPTIONS = [
        { key: 'ecp', label: 'ECP', suffix: '₹' },
        { key: 'discount', label: 'Discount', suffix: '%' },
        { key: 'rpi', label: 'RPI', suffix: '' },
    ]

    const toggleRow = (category) => {
        if (!expandedRows.includes(category)) {
            fetchBrands(category)
        }
        setExpandedRows(prev =>
            prev.includes(category)
                ? prev.filter(r => r !== category)
                : [...prev, category]
        )
    }

    const closeAll = () => setExpandedRows([])

    const filteredData = useMemo(() => {
        let currentData = apiData
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            currentData = currentData.filter(item =>
                item.category.toLowerCase().includes(q)
            )
        }
        return currentData
    }, [apiData, searchQuery])

    const formatValue = (val) => {
        if (val === null || val === undefined || val === 0) return '—'
        if (metricType === 'rpi') return val.toFixed(2)
        if (metricType === 'discount') return `${val}%`
        return `₹${val.toLocaleString()}`
    }

    const getMetricFontColor = (val) => {
        if (val === null || val === undefined || val === 0) return 'text-slate-300'
        if (metricType === 'discount') {
            if (val <= 5) return 'text-emerald-600 font-semibold'
            if (val <= 10) return 'text-emerald-500'
            if (val <= 15) return 'text-amber-500'
            return 'text-rose-500'
        }
        if (metricType === 'rpi') {
            if (val >= 1.2) return 'text-emerald-600 font-semibold'
            if (val >= 0.9) return 'text-slate-600'
            return 'text-rose-500'
        }
        return 'text-slate-700 font-medium'
    }

    const MetricCell = ({ item, platform }) => {
        const val = item[platform]
        return (
            <td className="px-3 py-2 text-center">
                <span className={cn('text-sm tabular-nums', getMetricFontColor(val))}>
                    {formatValue(val)}
                </span>
            </td>
        )
    }

    const activeMetric = METRIC_OPTIONS.find(m => m.key === metricType)

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.03)] ring-1 ring-slate-200/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">{activeMetric.label} by Category / Brand</span>
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
                    <div className="relative group min-w-[240px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={14} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search Category..."
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

                    <button
                        onClick={() => setShowFilterPanel(true)}
                        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>Filters</span>
                    </button>

                    {expandedRows.length > 0 && (
                        <button
                            onClick={closeAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                        >
                            <X size={12} /> Close All ({expandedRows.length})
                        </button>
                    )}
                </div>
            </div>

            {showFilterPanel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 transition-all backdrop-blur-sm">
                    <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Component Filters</h2>
                                <p className="text-sm text-slate-500">Local refinements for this segment</p>
                            </div>
                            <button onClick={() => setShowFilterPanel(false)} className="rounded-full p-2 hover:bg-slate-100 transition">
                                <X className="h-5 w-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 bg-slate-50/30 overflow-y-auto max-h-[60vh]">
                            <KpiFilterPanel
                                sectionConfig={filterOptions}
                                keywords={[]}
                                sectionValues={tentativeFilters}
                                onSectionChange={(id, val) => setTentativeFilters(prev => ({ ...prev, [id]: val }))}
                            />
                        </div>
                        <div className="flex justify-between border-t border-slate-100 bg-white px-6 py-4">
                            <button
                                onClick={() => setTentativeFilters({})}
                                className="px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg"
                            >
                                Reset
                            </button>
                            <div className="flex gap-3">
                                <button onClick={() => setShowFilterPanel(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
                                <button
                                    onClick={() => {
                                        setAppliedFilters(tentativeFilters);
                                        setShowFilterPanel(false);
                                    }}
                                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-md"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto relative min-h-[200px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <CircularProgress size={30} thickness={4} sx={{ color: '#3b82f6' }} />
                    </div>
                )}
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                            <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[350px]">Category / Brand</th>
                            <th className="text-center px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-20">ML</th>
                            {platforms.map(p => (
                                <th key={p} className="text-center px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{p}</th>
                            ))}
                            <th className="text-center px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100/50">Overall</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredData.length === 0 && !loading ? (
                            <tr>
                                <td colSpan={platforms.length + 3} className="py-12 text-center text-slate-400 text-sm italic">
                                    No data found for the selected filters.
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((item) => {
                                const isExpanded = expandedRows.includes(item.category)
                                const brands = brandDataMap[item.category] || []
                                const isBrandLoading = brandLoading[item.category]

                                return (
                                    <React.Fragment key={item.category}>
                                        <tr
                                            className={cn(
                                                'group cursor-pointer transition-colors',
                                                isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50/80'
                                            )}
                                            onClick={() => toggleRow(item.category)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <motion.div
                                                        animate={{ rotate: isExpanded ? 90 : 0 }}
                                                        className="p-1 rounded-md bg-white border border-slate-200 shadow-sm"
                                                    >
                                                        <ChevronRight size={14} className="text-slate-500" />
                                                    </motion.div>
                                                    <span className="text-sm font-bold text-slate-800 tracking-tight">{item.category}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center text-slate-300">—</td>
                                            {platforms.map(p => (
                                                <MetricCell key={p} item={item} platform={p} />
                                            ))}
                                            <MetricCell item={item} platform="total" />
                                        </tr>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.tr
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                >
                                                    <td colSpan={platforms.length + 3} className="p-0 border-none">
                                                        <div className="bg-slate-50/80 border-y border-slate-200/50 shadow-inner px-2">
                                                            {isBrandLoading ? (
                                                                <div className="py-8 flex flex-col items-center gap-3">
                                                                    <CircularProgress size={20} thickness={5} sx={{ color: '#94a3b8' }} />
                                                                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Loading Brands...</span>
                                                                </div>
                                                            ) : (
                                                                <table className="w-full">
                                                                    <tbody className="divide-y divide-white/50">
                                                                        {brands.length === 0 ? (
                                                                            <tr><td className="py-6 text-center text-xs text-slate-400 font-medium">No brand data available</td></tr>
                                                                        ) : (
                                                                            brands.map((brand) => (
                                                                                <tr key={brand.brand} className="hover:bg-blue-50/40 transition-colors group/brand">
                                                                                    <td className="px-6 py-2.5 pl-14 w-[350px]">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="text-[10px] text-slate-300 font-bold">└</span>
                                                                                            <span className="text-xs text-slate-600 font-semibold group-hover/brand:text-blue-600 transition-colors">{brand.brand}</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-center">
                                                                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded tracking-tighter uppercase whitespace-nowrap">ClickHouse</span>
                                                                                    </td>
                                                                                    {platforms.map(p => (
                                                                                        <MetricCell key={p} item={brand} platform={p} />
                                                                                    ))}
                                                                                    <MetricCell item={brand} platform="total" />
                                                                                </tr>
                                                                            ))
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            )}
                                        </AnimatePresence>
                                    </React.Fragment>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Live API Sync</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-slate-400 italic">Showing {filteredData.length} unique categories across {platforms.length} platforms</span>
                </div>
            </div>
        </div>
    )
}

export default DiscountEcpPricing