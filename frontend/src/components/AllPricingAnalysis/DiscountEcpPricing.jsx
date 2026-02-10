import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, X, SlidersHorizontal, Search } from 'lucide-react'
import { cn } from '../../lib/utils'
import { KpiFilterPanel } from "@/components/KpiFilterPanel"
import axiosInstance from "@/api/axiosInstance"
import { generateDateOptions } from '../../lib/pricingUtils'

const DiscountEcpPricing = () => {
    const data = [
        {
            category: 'Oral Care',
            totals: {
                blinkit: { ecp: 150, discount: 5, rpi: 1.1 },
                instamart: { ecp: 155, discount: 2, rpi: 1.2 },
                zepto: { ecp: 148, discount: 8, rpi: 0.9 },
                total: { ecp: 151, discount: 5, rpi: 1.0 }
            },
            brands: [
                { name: 'Colgate', ml: '150g', blinkit: { ecp: 150, discount: 5, rpi: 1.1 }, instamart: { ecp: 155, discount: 2, rpi: 1.2 }, zepto: { ecp: 148, discount: 8, rpi: 0.9 }, total: { ecp: 151, discount: 5, rpi: 1.0 } },
                { name: 'Pepsodent', ml: '200g', blinkit: { ecp: 120, discount: 10, rpi: 0.9 }, instamart: { ecp: 125, discount: 5, rpi: 1.0 }, zepto: { ecp: 118, discount: 15, rpi: 0.8 }, total: { ecp: 120, discount: 10, rpi: 0.9 } },
                { name: 'Sensodyne', ml: '100g', blinkit: { ecp: 180, discount: 2, rpi: 1.3 }, instamart: { ecp: 185, discount: 0, rpi: 1.4 }, zepto: { ecp: 175, discount: 5, rpi: 1.2 }, total: { ecp: 180, discount: 2, rpi: 1.3 } },
                { name: 'Closeup', ml: '150g', blinkit: { ecp: 130, discount: 8, rpi: 1.0 }, instamart: { ecp: 135, discount: 3, rpi: 1.1 }, zepto: { ecp: 128, discount: 12, rpi: 0.85 }, total: { ecp: 130, discount: 8, rpi: 1.0 } },
            ]
        },
        {
            category: 'Hair Care',
            totals: {
                blinkit: { ecp: 350, discount: 10, rpi: 1.1 },
                instamart: { ecp: 360, discount: 5, rpi: 1.2 },
                zepto: { ecp: 340, discount: 15, rpi: 1.0 },
                total: { ecp: 350, discount: 10, rpi: 1.1 }
            },
            brands: [
                { name: 'Dove', ml: '400ml', blinkit: { ecp: 400, discount: 5, rpi: 1.3 }, instamart: { ecp: 410, discount: 2, rpi: 1.4 }, zepto: { ecp: 390, discount: 8, rpi: 1.2 }, total: { ecp: 400, discount: 5, rpi: 1.3 } },
                { name: 'Sunsilk', ml: '300ml', blinkit: { ecp: 280, discount: 15, rpi: 0.9 }, instamart: { ecp: 290, discount: 12, rpi: 1.0 }, zepto: { ecp: 270, discount: 20, rpi: 0.8 }, total: { ecp: 280, discount: 15, rpi: 0.9 } },
                { name: 'Tresemme', ml: '500ml', blinkit: { ecp: 450, discount: 2, rpi: 1.5 }, instamart: { ecp: 460, discount: 0, rpi: 1.6 }, zepto: { ecp: 440, discount: 5, rpi: 1.4 }, total: { ecp: 450, discount: 2, rpi: 1.5 } },
            ]
        },
        {
            category: 'Personal Care',
            totals: {
                blinkit: { ecp: 220, discount: 12, rpi: 1.0 },
                instamart: { ecp: 230, discount: 8, rpi: 1.1 },
                zepto: { ecp: 210, discount: 15, rpi: 0.9 },
                total: { ecp: 220, discount: 12, rpi: 1.0 }
            },
            brands: [
                { name: 'Nivea', ml: '250ml', blinkit: { ecp: 220, discount: 12, rpi: 1.0 }, instamart: { ecp: 230, discount: 8, rpi: 1.1 }, zepto: { ecp: 210, discount: 15, rpi: 0.9 }, total: { ecp: 220, discount: 12, rpi: 1.0 } },
                { name: 'Pears', ml: '125g', blinkit: { ecp: 150, discount: 18, rpi: 0.8 }, instamart: { ecp: 160, discount: 12, rpi: 0.9 }, zepto: { ecp: 145, discount: 22, rpi: 0.7 }, total: { ecp: 152, discount: 18, rpi: 0.8 } },
            ]
        },
    ]
    const PLATFORMS = [
        { key: 'blinkit', label: 'Blinkit', bg: 'bg-yellow-100', text: 'text-yellow-700' },
        { key: 'instamart', label: 'Instamart', bg: 'bg-orange-100', text: 'text-orange-700' },
        { key: 'zepto', label: 'Zepto', bg: 'bg-purple-100', text: 'text-purple-700' },
    ]

    const [expandedRows, setExpandedRows] = useState([])
    const [metricType, setMetricType] = useState('ecp') // 'ecp', 'discount', 'rpi'
    const [searchQuery, setSearchQuery] = useState('')

    // ========================================
    // FILTER STATE & LOGIC
    // ========================================
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    // Tentative filters
    const [tentativeFilters, setTentativeFilters] = useState({
        platform: [],
        format: [],
        city: [],
        brand: [],
        date: [],
        month: [],
        zone: [],
        pincode: [],
        metroFlag: []
    });

    // Applied filters
    const [appliedFilters, setAppliedFilters] = useState({
        platform: [],
        format: [],
        city: [],
        brand: [],
        date: [],
        month: [],
        zone: [],
        pincode: [],
        metroFlag: []
    });

    // Dynamic Options
    const [dynamicFilterData, setDynamicFilterData] = useState({
        platforms: [],
        formats: [],
        cities: [],
        months: [],
        dates: [],
        pincodes: [],
        zones: [],
        metroFlags: [],
        brands: [],
        loading: true
    });

    const mockKeywords = [{ id: "kw_generic", label: "generic" }];

    const fetchFilterType = async (filterType, cascadeParams = {}) => {
        try {
            const params = new URLSearchParams({
                filterType,
                platform: cascadeParams.platform || 'All',
                format: cascadeParams.format || 'All',
                city: cascadeParams.city || 'All',
                metroFlag: cascadeParams.metroFlag || 'All',
                months: cascadeParams.month || 'All'
            }).toString();
            const apiBase = '/availability-analysis/filter-options';
            const res = await axiosInstance.get(`${apiBase}?${params}`);
            return res.data?.options || [];
        } catch (error) {
            console.error(`Error fetching ${filterType}:`, error);
            return [];
        }
    };

    // Initial Load
    useEffect(() => {
        const fetchAll = async () => {
            setDynamicFilterData(prev => ({ ...prev, loading: true }));
            try {
                const [platforms, formats, cities, months, dates, pincodes, zones, metroFlags, brands] = await Promise.all([
                    fetchFilterType('platforms'),
                    fetchFilterType('formats', tentativeFilters),
                    fetchFilterType('cities', tentativeFilters),
                    fetchFilterType('months', tentativeFilters),
                    fetchFilterType('dates', tentativeFilters),
                    fetchFilterType('pincodes', tentativeFilters),
                    fetchFilterType('zones'),
                    fetchFilterType('metroFlags'),
                    fetchFilterType('brands')
                ]);

                setDynamicFilterData({
                    platforms,
                    formats,
                    cities,
                    months,
                    dates,
                    pincodes,
                    zones,
                    metroFlags,
                    brands,
                    loading: false
                });
            } catch (err) {
                console.error("Error loading filters", err);
                setDynamicFilterData(prev => ({ ...prev, loading: false }));
            }
        };
        fetchAll();
    }, []);

    // Filter Configuration
    const filterOptions = useMemo(() => {
        const toOptions = (arr) => (arr || []).map(item => ({ id: item, label: item }));
        const formatMonth = (str) => {
            if (!str) return str;
            const [y, m] = str.split('-');
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            return `${monthNames[parseInt(m, 10) - 1]} ${y}`;
        };
        const monthOptions = dynamicFilterData.months.map(m => ({ id: m, label: formatMonth(m) }));

        return [
            { id: "date", label: "Date", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.dates)] },
            { id: "month", label: "Month", options: [{ id: "all", label: "All" }, ...monthOptions] },
            { id: "brand", label: "Brand", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.brands)] },
            { id: "platform", label: "Platform", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.platforms)] },
            { id: "format", label: "Format", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.formats)] },
            { id: "city", label: "City", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.cities)] },
        ];
    }, [dynamicFilterData]);


    const METRIC_OPTIONS = [
        { key: 'ecp', label: 'ECP', suffix: '₹' },
        { key: 'discount', label: 'Discount', suffix: '%' },
        { key: 'rpi', label: 'RPI', suffix: '' },
    ]

    const toggleRow = (category) => {
        setExpandedRows(prev =>
            prev.includes(category)
                ? prev.filter(r => r !== category)
                : [...prev, category]
        )
    }

    const closeAll = () => setExpandedRows([])

    const resetFilters = () => {
        setTentativeFilters({
            platform: [],
            format: [],
            city: [],
            brand: [],
            date: [],
            month: [],
            zone: [],
            pincode: [],
            metroFlag: []
        });
    };

    const filteredData = useMemo(() => {
        let currentData = data

        // 1. Filter by Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            currentData = currentData.filter(item =>
                item.category.toLowerCase().includes(q) ||
                item.brands.some(b => b.name.toLowerCase().includes(q))
            )
        }

        // 2. Filter by Applied Filters (Brand)
        if (appliedFilters.brand?.length > 0 && !appliedFilters.brand.includes('all') && !appliedFilters.brand.includes('All')) {
            const selectedBrands = appliedFilters.brand.map(b => b.toLowerCase());
            currentData = currentData.filter(item => selectedBrands.includes(item.category.toLowerCase()));
        }

        return currentData
    }, [data, searchQuery, appliedFilters])

    const getMetricValue = (platformData) => {
        if (!platformData) return null
        return platformData[metricType]
    }

    const formatValue = (val) => {
        if (val === null || val === undefined) return null
        if (metricType === 'rpi') return val.toFixed(2)
        if (metricType === 'discount') return `${val}%`
        return `₹${val}`
    }

    // Get font color based on metric type and value
    const getMetricFontColor = (val) => {
        if (val === null || val === undefined) return 'text-slate-400'

        if (metricType === 'discount') {
            // Discount: lower is better (green), higher is worse (red)
            if (val <= 5) return 'text-emerald-600 font-semibold'
            if (val <= 10) return 'text-emerald-500'
            if (val <= 15) return 'text-amber-500'
            if (val <= 20) return 'text-orange-500'
            return 'text-rose-500 font-semibold'
        }

        if (metricType === 'rpi') {
            // RPI: higher is better (green = competitive), lower is worse (red = expensive)
            if (val >= 1.5) return 'text-emerald-600 font-semibold'
            if (val >= 1.2) return 'text-emerald-500'
            if (val >= 0.9) return 'text-slate-600'
            if (val >= 0.6) return 'text-orange-500'
            return 'text-rose-500 font-semibold'
        }

        // ECP: just use neutral colors with some variance
        if (val <= 50) return 'text-slate-700 font-medium'
        if (val <= 100) return 'text-slate-600'
        if (val <= 200) return 'text-slate-500'
        return 'text-slate-500'
    }

    const MetricCell = ({ platformData }) => {
        const val = getMetricValue(platformData)
        if (val === null || val === undefined) {
            return <td className="px-3 py-2 text-center text-slate-300 text-sm">—</td>
        }

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
                    {/* <span className="px-2 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded">
                        {filteredData.length} categories
                    </span> */}
                    {/* Metric Selector */}
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
                    {/* Premium Search Bar */}
                    <div className="relative group min-w-[240px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={14} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search Category or Brand..."
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

                    {/* Filters Button */}
                    <button
                        onClick={() => {
                            setTentativeFilters(appliedFilters);
                            setShowFilterPanel(true);
                        }}
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

            {/* Filter Modal */}
            {showFilterPanel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center md:items-start bg-slate-900/40 p-4 md:pt-52 md:pl-40 transition-all backdrop-blur-sm">
                    <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-auto max-h-[80vh] min-h-[50vh] sm:h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Advanced Filters</h2>
                                <p className="text-sm text-slate-500">Configure data visibility and rules</p>
                            </div>
                            <button
                                onClick={() => setShowFilterPanel(false)}
                                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-0 pb-6">
                            <KpiFilterPanel
                                sectionConfig={filterOptions}
                                keywords={mockKeywords}
                                sectionValues={tentativeFilters}
                                onSectionChange={(sectionId, values) => {
                                    setTentativeFilters(prev => ({
                                        ...prev,
                                        [sectionId]: values || []
                                    }));
                                }}
                            />
                        </div>

                        <div className="flex justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4">
                            <button
                                onClick={resetFilters}
                                className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                                Reset Filter
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowFilterPanel(false)}
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setAppliedFilters(tentativeFilters);
                                        setShowFilterPanel(false);
                                    }}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200"
                                >
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-900">
                            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider w-72">
                                Category / Brand
                            </th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider w-24">
                                ML
                            </th>
                            {PLATFORMS.map(p => (
                                <th key={p.key} className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-700">
                                    {p.label}
                                </th>
                            ))}
                            <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((item, idx) => {
                            const isExpanded = expandedRows.includes(item.category)

                            return (
                                <>
                                    {/* Category Row */}
                                    <tr
                                        key={item.category}
                                        className={cn(
                                            'border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50',
                                            isExpanded && 'bg-blue-50/30'
                                        )}
                                        onClick={() => toggleRow(item.category)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <motion.span
                                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <ChevronRight size={16} className="text-slate-400" />
                                                </motion.span>
                                                <span className="text-sm font-bold text-slate-800">{item.category}</span>
                                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {item.brands.length} Brands
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-400">—</td>
                                        <MetricCell platformData={item.totals?.blinkit} />
                                        <MetricCell platformData={item.totals?.instamart} />
                                        <MetricCell platformData={item.totals?.zepto} />
                                        <MetricCell platformData={item.totals?.total} />
                                    </tr>

                                    {/* Expanded Brand Rows */}
                                    <AnimatePresence>
                                        {isExpanded && item.brands.map((brand, bIdx) => (
                                            <motion.tr
                                                key={`${item.category}-${brand.name}`}
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-slate-50/50 border-b border-slate-50"
                                            >
                                                <td className="px-4 py-2 pl-10">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400">└</span>
                                                        <span className="text-sm text-slate-700">{brand.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {brand.ml}
                                                    </span>
                                                </td>
                                                <MetricCell platformData={brand.blinkit} />
                                                <MetricCell platformData={brand.instamart} />
                                                <MetricCell platformData={brand.zepto} />
                                                <MetricCell platformData={brand.total} />
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Values represent {metricType === 'discount' ? 'discount %' : metricType === 'ecp' ? 'effective consumer price' : 'relative price index'} across categories</span>
                    <span>{filteredData.length} categories</span>
                </div>
            </div>
        </div>
    )
}

export default DiscountEcpPricing