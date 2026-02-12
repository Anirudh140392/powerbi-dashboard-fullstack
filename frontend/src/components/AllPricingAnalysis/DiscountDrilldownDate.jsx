import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X, SlidersHorizontal, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { generateDateOptions } from '../../lib/pricingUtils';
import { KpiFilterPanel } from "@/components/KpiFilterPanel"
import axiosInstance from "@/api/axiosInstance"

export const DiscountDrilldownDate = ({
    filters,
    selectedBrand,
    globalPlatform,
    selectedLocation,
    timeStart,
    timeEnd
}) => {
    const [expandedBrands, setExpandedBrands] = useState([])
    const [dayRange, setDayRange] = useState(7)
    const [metricType, setMetricType] = useState('ecp') // 'ecp', 'discount', 'rpi'
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [gridData, setGridData] = useState([])

    // Generate dates based on range
    const dates = useMemo(() => generateDateOptions(dayRange), [dayRange])

    // Fetch real data from API
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                if (!dates || dates.length === 0) return

                const params = {
                    startDate: dates[dates.length - 1].key,
                    endDate: dates[0].key
                }

                // Sync with global filters
                if (globalPlatform && globalPlatform !== 'All') {
                    params.platform = globalPlatform;
                }

                const brandFilter = selectedBrand || filters?.brand;
                if (brandFilter && brandFilter !== 'All') {
                    params.brand = brandFilter;
                }

                if (selectedLocation && selectedLocation !== 'All') {
                    params.city = selectedLocation;
                }

                if (filters?.format && filters.format !== 'All') {
                    params.format = filters.format;
                }

                console.log("[DiscountDrilldownDate] Fetching with params:", params);
                const response = await axiosInstance.get('/pricing-analysis/one-view-price-grid', { params })

                if (response.data?.success && response.data?.data) {
                    // Transform flat data into nested Brand -> SKU -> Date structure
                    const brandMap = {}
                    response.data.data.forEach(item => {
                        const brand = item.brand
                        const sku = item.product
                        const date = item.rawDate.split('T')[0]

                        if (!brandMap[brand]) brandMap[brand] = { brand: brand, skus: {} }
                        if (!brandMap[brand].skus[sku]) brandMap[brand].skus[sku] = { name: sku, ml: item.ml, days: {} }

                        brandMap[brand].skus[sku].days[date] = {
                            ecp: item.ecp,
                            discount: item.discount,
                            rpi: item.rpi
                        }
                    })

                    const transformed = Object.values(brandMap).map(b => ({
                        ...b,
                        skus: Object.values(b.skus)
                    }))
                    setGridData(transformed)
                }
            } catch (error) {
                console.error("Error fetching day-level grid:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [dayRange, metricType, dates, filters, selectedBrand, globalPlatform, selectedLocation])

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

    const toggleBrand = (brand) => {
        setExpandedBrands(prev =>
            prev.includes(brand)
                ? prev.filter(b => b !== brand)
                : [...prev, brand]
        )
    }

    const closeAll = () => setExpandedBrands([])

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
        let currentData = gridData

        // 1. Filter by Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            currentData = currentData.filter(item =>
                item.brand.toLowerCase().includes(q) ||
                item.skus.some(s => s.name.toLowerCase().includes(q))
            )
        }

        // 2. Filter by Applied Filters (Brand)
        if (appliedFilters.brand?.length > 0 && !appliedFilters.brand.includes('all') && !appliedFilters.brand.includes('All')) {
            const selectedBrands = appliedFilters.brand.map(b => b.toLowerCase());
            currentData = currentData.filter(item => selectedBrands.includes(item.brand.toLowerCase()));
        }

        return currentData
    }, [gridData, searchQuery, appliedFilters])

    const getMetricValue = (dayData) => {
        if (!dayData) return null
        return dayData[metricType]
    }

    const formatValue = (val) => {
        if (val === null || val === undefined) return '—'
        const metric = METRIC_OPTIONS.find(m => m.key === metricType)
        if (metricType === 'rpi') return val.toFixed(2)
        if (metricType === 'discount') return `${val}%`
        return `₹${val}`
    }

    // New helper function that was missing
    const getDayWiseFontColor = (val) => {
        if (val === null || val === undefined) return 'text-slate-300'

        if (metricType === 'discount') {
            if (val >= 20) return 'text-emerald-600 font-bold'
            if (val >= 10) return 'text-emerald-500'
            if (val >= 5) return 'text-amber-500'
            return 'text-slate-600'
        }

        if (metricType === 'rpi') {
            if (val >= 1.2) return 'text-emerald-600'
            if (val >= 0.9) return 'text-slate-600'
            return 'text-rose-500'
        }

        return 'text-slate-600'
    }


    const activeMetric = METRIC_OPTIONS.find(m => m.key === metricType)

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.03)] ring-1 ring-slate-200/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">Brand → SKU Day-Level {activeMetric.label}</span>
                    {/* Day Range Selector */}
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                        {[7, 14, 30].map(days => (
                            <button
                                key={days}
                                onClick={() => setDayRange(days)}
                                className={cn(
                                    'px-2 py-1 text-[10px] font-medium rounded-md transition-all',
                                    dayRange === days
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                {days}D
                            </button>
                        ))}
                    </div>
                    {/* Metric Selector Dropdown */}
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

                    {expandedBrands.length > 0 && (
                        <button
                            onClick={closeAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                        >
                            <X size={12} /> Close All ({expandedBrands.length})
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

            {/* Premium Table Content */}
            <div className="relative overflow-x-auto">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 rounded-full border-2 border-blue-100 border-t-blue-500 animate-spin" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Updating Grid...</span>
                        </div>
                    </div>
                )}
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-900">
                            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider w-80">
                                Brand / SKU
                            </th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                ML
                            </th>
                            {dates.map(d => (
                                <th key={d.key} className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider">
                                    {d.shortLabel}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((brand, bIdx) => {
                            const isExpanded = expandedBrands.includes(brand.brand)

                            return (
                                <React.Fragment key={brand.brand}>
                                    {/* Brand Row */}
                                    <tr
                                        className={cn(
                                            'border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50',
                                            isExpanded && 'bg-blue-50/30'
                                        )}
                                        onClick={() => toggleBrand(brand.brand)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <motion.span
                                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <ChevronRight size={16} className="text-slate-400" />
                                                </motion.span>
                                                <span className="text-sm font-semibold text-slate-800">{brand.brand}</span>
                                                <span className="text-xs text-slate-400">({brand.skus.length} SKUs)</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-400 text-center">—</td>
                                        {dates.map(d => (
                                            <td key={d.key} className="px-3 py-3 text-sm text-slate-400 text-center">—</td>
                                        ))}
                                    </tr>

                                    {/* SKU Rows */}
                                    <AnimatePresence>
                                        {isExpanded && brand.skus.map((sku, sIdx) => (
                                            <motion.tr
                                                key={`${brand.brand}-${sku.name}`}
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-slate-50/50 border-b border-slate-50"
                                            >
                                                <td className="px-4 py-2 pl-10">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400">└</span>
                                                        <span className="text-sm text-slate-700 truncate max-w-[280px]" title={sku.name}>
                                                            {sku.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-sm text-slate-600 text-center">{sku.ml}</td>
                                                {dates.map(d => {
                                                    const dayData = sku.days[d.key]
                                                    const val = getMetricValue(dayData)
                                                    return (
                                                        <td key={d.key} className="px-3 py-2 text-sm text-center">
                                                            <span className={cn('tabular-nums font-medium', getDayWiseFontColor(val))}>
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
};