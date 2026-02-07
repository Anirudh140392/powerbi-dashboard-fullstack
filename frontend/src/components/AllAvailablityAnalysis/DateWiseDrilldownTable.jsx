import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, X, Search, SlidersHorizontal } from 'lucide-react'
import { cn } from '../../lib/utils'
import { generateDateOptions } from '../../lib/pricingUtils'
import { KpiFilterPanel } from "@/components/KpiFilterPanel"
import { Badge } from "@/components/ui/badge"
import axiosInstance from "@/api/axiosInstance"

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
                },
                cities: [
                    {
                        id: 'c1-s1',
                        name: 'Mumbai',
                        days: {
                            '2026-02-06': { ecp: 148, discount: 4, rpi: 1.22 },
                            '2026-02-05': { ecp: 146, discount: 5, rpi: 1.2 },
                            '2026-02-04': { ecp: 144, discount: 6, rpi: 1.18 },
                            '2026-02-03': { ecp: 138, discount: 10, rpi: 1.12 },
                            '2026-02-02': { ecp: 147, discount: 4, rpi: 1.21 },
                            '2026-02-01': { ecp: 142, discount: 7, rpi: 1.16 },
                            '2026-01-31': { ecp: 143, discount: 6, rpi: 1.17 }
                        }
                    },
                    {
                        id: 'c2-s1',
                        name: 'Delhi',
                        days: {
                            '2026-02-06': { ecp: 142, discount: 6, rpi: 1.18 },
                            '2026-02-05': { ecp: 144, discount: 5, rpi: 1.2 },
                            '2026-02-04': { ecp: 146, discount: 4, rpi: 1.22 },
                            '2026-02-03': { ecp: 134, discount: 14, rpi: 1.08 },
                            '2026-02-02': { ecp: 143, discount: 6, rpi: 1.19 },
                            '2026-02-01': { ecp: 138, discount: 9, rpi: 1.14 },
                            '2026-01-31': { ecp: 141, discount: 6, rpi: 1.19 }
                        }
                    },
                    {
                        id: 'c3-s1',
                        name: 'Bangalore',
                        days: {
                            '2026-02-06': { ecp: 145, discount: 5, rpi: 1.2 },
                            '2026-02-05': { ecp: 145, discount: 5, rpi: 1.2 },
                            '2026-02-04': { ecp: 145, discount: 5, rpi: 1.2 },
                            '2026-02-03': { ecp: 136, discount: 12, rpi: 1.1 },
                            '2026-02-02': { ecp: 145, discount: 5, rpi: 1.2 },
                            '2026-02-01': { ecp: 140, discount: 8, rpi: 1.15 },
                            '2026-01-31': { ecp: 142, discount: 6, rpi: 1.18 }
                        }
                    }
                ]
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
                },
                cities: [
                    {
                        id: 'c1-s2',
                        name: 'Chennai',
                        days: {
                            '2026-02-06': { ecp: 102, discount: 8, rpi: 0.98 },
                            '2026-02-05': { ecp: 100, discount: 9, rpi: 0.96 },
                            '2026-02-04': { ecp: 99, discount: 10, rpi: 0.95 },
                            '2026-02-03': { ecp: 98, discount: 11, rpi: 0.94 },
                            '2026-02-02': { ecp: 100, discount: 9, rpi: 0.96 },
                            '2026-02-01': { ecp: 99, discount: 10, rpi: 0.95 },
                            '2026-01-31': { ecp: 96, discount: 11, rpi: 0.91 }
                        }
                    },
                    {
                        id: 'c2-s2',
                        name: 'Hyderabad',
                        days: {
                            '2026-02-06': { ecp: 96, discount: 12, rpi: 0.92 },
                            '2026-02-05': { ecp: 98, discount: 11, rpi: 0.94 },
                            '2026-02-04': { ecp: 99, discount: 10, rpi: 0.95 },
                            '2026-02-03': { ecp: 100, discount: 9, rpi: 0.96 },
                            '2026-02-02': { ecp: 98, discount: 11, rpi: 0.94 },
                            '2026-02-01': { ecp: 99, discount: 10, rpi: 0.95 },
                            '2026-01-31': { ecp: 94, discount: 13, rpi: 0.89 }
                        }
                    }
                ]
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
                },
                cities: [
                    {
                        id: 'c1-s3',
                        name: 'Kolkata',
                        days: {
                            '2026-02-06': { ecp: 112, discount: 14, rpi: 1.42 },
                            '2026-02-05': { ecp: 111, discount: 14, rpi: 1.41 },
                            '2026-02-04': { ecp: 110, discount: 15, rpi: 1.4 },
                            '2026-02-03': { ecp: 109, discount: 16, rpi: 1.38 },
                            '2026-02-02': { ecp: 111, discount: 14, rpi: 1.41 },
                            '2026-02-01': { ecp: 110, discount: 15, rpi: 1.4 },
                            '2026-01-31': { ecp: 106, discount: 16, rpi: 1.32 }
                        }
                    },
                    {
                        id: 'c2-s3',
                        name: 'Pune',
                        days: {
                            '2026-02-06': { ecp: 108, discount: 16, rpi: 1.38 },
                            '2026-02-05': { ecp: 109, discount: 16, rpi: 1.39 },
                            '2026-02-04': { ecp: 110, discount: 15, rpi: 1.4 },
                            '2026-02-03': { ecp: 111, discount: 14, rpi: 1.42 },
                            '2026-02-02': { ecp: 109, discount: 16, rpi: 1.39 },
                            '2026-02-01': { ecp: 110, discount: 15, rpi: 1.4 },
                            '2026-01-31': { ecp: 104, discount: 18, rpi: 1.28 }
                        }
                    }
                ]
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
                },
                cities: [
                    {
                        id: 'c1-s4',
                        name: 'Ahmedabad',
                        days: {
                            '2026-02-06': { ecp: 86, discount: 0, rpi: 1.11 },
                            '2026-02-05': { ecp: 85, discount: 0, rpi: 1.1 },
                            '2026-02-04': { ecp: 89, discount: 2, rpi: 1.06 },
                            '2026-02-03': { ecp: 86, discount: 0, rpi: 1.11 },
                            '2026-02-02': { ecp: 89, discount: 2, rpi: 1.06 },
                            '2026-02-01': { ecp: 86, discount: 0, rpi: 1.11 },
                            '2026-01-31': { ecp: 83, discount: 1, rpi: 1.09 }
                        }
                    }
                ]
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
                },
                cities: [
                    {
                        id: 'c1-s5',
                        name: 'Gurgaon',
                        days: {
                            '2026-02-06': { ecp: 202, discount: 4, rpi: 0.87 },
                            '2026-02-05': { ecp: 200, discount: 5, rpi: 0.86 },
                            '2026-02-04': { ecp: 198, discount: 6, rpi: 0.84 },
                            '2026-02-03': { ecp: 188, discount: 7, rpi: 0.82 },
                            '2026-02-02': { ecp: 201, discount: 4, rpi: 0.86 },
                            '2026-02-01': { ecp: 200, discount: 5, rpi: 0.86 },
                            '2026-01-31': { ecp: 212, discount: 2, rpi: 0.91 }
                        }
                    },
                    {
                        id: 'c2-s5',
                        name: 'Noida',
                        days: {
                            '2026-02-06': { ecp: 196, discount: 6, rpi: 0.83 },
                            '2026-02-05': { ecp: 198, discount: 5, rpi: 0.84 },
                            '2026-02-04': { ecp: 200, discount: 4, rpi: 0.86 },
                            '2026-02-03': { ecp: 182, discount: 9, rpi: 0.78 },
                            '2026-02-02': { ecp: 197, discount: 6, rpi: 0.84 },
                            '2026-02-01': { ecp: 198, discount: 5, rpi: 0.84 },
                            '2026-01-31': { ecp: 208, discount: 4, rpi: 0.89 }
                        }
                    }
                ]
            },
        ]
    },
]


// ========================================
// MAIN COMPONENT
// ========================================

function DateWiseDrilldownTable() {
    const [expandedBrands, setExpandedBrands] = useState(['Colgate'])
    const [expandedSkus, setExpandedSkus] = useState([]) // Track which SKUs are expanded
    const [dayRange, setDayRange] = useState(7)
    const [metricType, setMetricType] = useState('ecp') // 'ecp', 'discount', 'rpi'
    const [searchQuery, setSearchQuery] = useState('')

    // ========================================
    // FILTER STATE
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

    // ========================================
    // FILTER API LOGIC
    // ========================================
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
                    fetchFilterType('brands') // Try fetching brands
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

    // Helper for options
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

    // Data Filtering logic
    const dates = useMemo(() => generateDateOptions(dayRange), [dayRange])

    const filteredData = useMemo(() => {
        let currentData = BRAND_SKU_DAY_DATA;

        // 1. Filter by Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            currentData = currentData.map(brand => {
                const matchesBrand = brand.brand.toLowerCase().includes(q);
                const matchedSkus = brand.skus.filter(sku => sku.name.toLowerCase().includes(q));
                if (matchesBrand) return brand;
                if (matchedSkus.length > 0) return { ...brand, skus: matchedSkus };
                return null;
            }).filter(Boolean);
        }

        // 2. Filter by Applied Filters (Brand)
        // If we have selected brands in filters, only show those brands
        if (appliedFilters.brand?.length > 0 && !appliedFilters.brand.includes('all') && !appliedFilters.brand.includes('All')) {
            const selectedBrands = appliedFilters.brand.map(b => b.toLowerCase());
            currentData = currentData.filter(b => selectedBrands.includes(b.brand.toLowerCase()));
        }

        // Note: For Platform/City/Format, we would filter here if the data supported it.
        // Currently data is Brand-level. We'll leave it as just Brand filter for now.

        return currentData;
    }, [searchQuery, appliedFilters, BRAND_SKU_DAY_DATA])

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

    const toggleSku = (skuId, e) => {
        e.stopPropagation()
        setExpandedSkus(prev =>
            prev.includes(skuId)
                ? prev.filter(s => s !== skuId)
                : [...prev, skuId]
        )
    }

    const closeAll = () => {
        setExpandedBrands([])
        setExpandedSkus([])
    }

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
                        Brand → SKU → City Day-Level
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
                    {/* <div className="flex items-center gap-1 p-1 bg-blue-50/50 rounded-xl border border-blue-100">
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
                    </div> */}
                </div>

                <div className="flex items-center gap-4">
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

                        <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
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
            )}


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
                                        {isExpanded && brand.skus.map((sku) => {
                                            const isSkuExpanded = expandedSkus.includes(sku.id)
                                            const hasCities = sku.cities && sku.cities.length > 0
                                            return (
                                                <React.Fragment key={sku.id}>
                                                    <motion.tr
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className={cn(
                                                            'border-b border-slate-50 cursor-pointer transition-colors',
                                                            isSkuExpanded ? 'bg-indigo-50/30' : 'bg-white hover:bg-slate-50/50'
                                                        )}
                                                        onClick={(e) => hasCities && toggleSku(sku.id, e)}
                                                    >
                                                        <td className="pl-14 py-3">
                                                            <div className="flex items-center gap-2">
                                                                {hasCities ? (
                                                                    <motion.div
                                                                        animate={{ rotate: isSkuExpanded ? 90 : 0 }}
                                                                        transition={{ duration: 0.2 }}
                                                                    >
                                                                        <ChevronRight size={14} className="text-slate-400" />
                                                                    </motion.div>
                                                                ) : (
                                                                    <span className="text-slate-300 text-lg leading-none mt-[-4px]">└</span>
                                                                )}
                                                                <span className="text-sm font-semibold text-slate-600 truncate max-w-[260px]" title={sku.name}>
                                                                    {sku.name}
                                                                </span>
                                                                {hasCities && (
                                                                    <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                                                                        {sku.cities.length} Cities
                                                                    </span>
                                                                )}
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

                                                    {/* City Rows */}
                                                    <AnimatePresence>
                                                        {isSkuExpanded && hasCities && sku.cities.map((city) => (
                                                            <motion.tr
                                                                key={city.id}
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                                className="bg-indigo-50/10 border-b border-slate-50/50"
                                                            >
                                                                <td className="pl-20 py-2.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-indigo-300 text-base leading-none">└</span>
                                                                        <span className="text-xs font-medium text-slate-800">
                                                                            {city.name}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2.5 text-[10px] text-slate-400 text-center">—</td>
                                                                {dates.map(d => {
                                                                    const dayData = city.days[d.key]
                                                                    const val = getMetricValue(dayData)
                                                                    return (
                                                                        <td key={d.key} className="px-3 py-2.5 text-xs text-center">
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
                                    </AnimatePresence>
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div >
    )
}

export default DateWiseDrilldownTable