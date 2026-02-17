import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, X, SlidersHorizontal, Search } from 'lucide-react'
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

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)



    // ========================================
    // FILTER STATE & LOGIC
    // ========================================
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [tentativeFilters, setTentativeFilters] = useState({});
    const [appliedFilters, setAppliedFilters] = useState({});
    const [dynamicFilterData, setDynamicFilterData] = useState({
        platforms: [],
        formats: [],
        cities: [],
        months: [],
        brands: [],
        loading: true
    });

    // Helper: Fetch filter options
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
            { id: "platform", label: "Platform", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.platforms)] },
            { id: "brand", label: "Brand", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.brands)] },
            { id: "city", label: "City", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.cities)] },
        ];
    }, [dynamicFilterData]);

    // Derived platforms from data, possibly filtered
    const visiblePlatforms = useMemo(() => {
        // First get all available platforms from data
        let available = [];
        const platformSet = new Set();
        data.forEach(city => {
            if (city.totals) {
                Object.keys(city.totals).forEach(p => {
                    if (p !== 'total') platformSet.add(p);
                });
            }
        });

        if (platformSet.size === 0) {
            available = [
                { key: 'blinkit', label: 'Blinkit' },
                { key: 'instamart', label: 'Instamart' },
                { key: 'zepto', label: 'Zepto' },
            ];
        } else {
            available = Array.from(platformSet).map(key => ({
                key,
                label: key.charAt(0).toUpperCase() + key.slice(1)
            }));
        }

        // Apply Platform Filter
        if (appliedFilters?.platform?.length > 0 && !appliedFilters.platform.includes('all')) {
            // Filter available platforms to only those selected (case-insensitive check)
            const selected = appliedFilters.platform.map(p => p.toLowerCase());
            return available.filter(p => selected.includes(p.key.toLowerCase()));
        }

        return available;
    }, [data, appliedFilters]);



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
        let res = data;

        // 1. Search Query
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            res = res.filter(item =>
                item.city.toLowerCase().includes(q) ||
                item.brands.some(b => b.name.toLowerCase().includes(q))
            );
        }

        // 2. City Filter
        if (appliedFilters?.city?.length > 0 && !appliedFilters.city.includes('all')) {
            const selectedCities = appliedFilters.city.map(c => c.toLowerCase());
            res = res.filter(item => selectedCities.includes(item.city.toLowerCase()));
        }

        // 3. Brand Filter
        if (appliedFilters?.brand?.length > 0 && !appliedFilters.brand.includes('all')) {
            const selectedBrands = appliedFilters.brand.map(b => b.toLowerCase());

            // Filter top-level cities: Keep city if it has at least one of the selected brands
            res = res.filter(item =>
                item.brands.some(b => selectedBrands.includes(b.name.toLowerCase()))
            );

            // Clone and filter the nested brands array so we only show the relevant brands
            res = res.map(item => ({
                ...item,
                brands: item.brands.filter(b => selectedBrands.includes(b.name.toLowerCase()))
            }));
        }

        return res;
    }, [data, searchQuery, appliedFilters]);

    // Reset to page 1 when search or data changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, data])

    // Pagination Logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage)
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredData.slice(start, start + itemsPerPage)
    }, [filteredData, currentPage, itemsPerPage])

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

                    <button
                        onClick={() => setShowFilterPanel(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-all"
                    >
                        <SlidersHorizontal size={14} /> Filters
                    </button>

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
                            <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider w-24">Grammage</th>
                            {visiblePlatforms.map(p => (
                                <th key={p.key} className="text-center px-3 py-3 text-xs font-bold uppercase tracking-wider">{p.label}</th>
                            ))}
                            <th className="text-center px-3 py-3 text-xs font-bold uppercase tracking-wider">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((item) => {
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
                                        {visiblePlatforms.map(p => (
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
                                                {visiblePlatforms.map(p => (
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

            {/* Pagination Controls */}
            {totalPages > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <span>Show</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value))
                                setCurrentPage(1)
                            }}
                            className="bg-white border border-slate-200 text-slate-700 text-xs rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            {[5, 10, 15, 20].map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                        <span>entries</span>
                        <span className="ml-2">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
                        >
                            <ChevronsLeft size={16} className="text-slate-500" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
                        >
                            <ChevronLeft size={16} className="text-slate-500" />
                        </button>

                        <span className="text-xs font-semibold text-slate-600 px-2">
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
                        >
                            <ChevronRight size={16} className="text-slate-500" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
                        >
                            <ChevronsRight size={16} className="text-slate-500" />
                        </button>
                    </div>
                </div>
            )}

            {/* Filter Modal */}
            {showFilterPanel && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/40 p-4 pt-36 transition-all backdrop-blur-sm">
                    <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Drilldown Filters</h2>
                                <p className="text-sm text-slate-500">Filter cities and brands</p>
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
        </div>
    )
}

export default DiscountDrilldownCity