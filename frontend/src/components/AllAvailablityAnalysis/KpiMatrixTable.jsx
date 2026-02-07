import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, X, ArrowUpRight, ArrowDownRight, LineChart as LineChartIcon, SlidersHorizontal } from 'lucide-react'
import TrendsCompetitionDrawer from './TrendsCompetitionDrawer'
import { Badge } from "@/components/ui/badge"
import { KpiFilterPanel } from "@/components/KpiFilterPanel"
import axiosInstance from "@/api/axiosInstance"
import dayjs from "dayjs"
// The user has `c:\...\frontend\src\components\CityKpiTrendShowcase.jsx`.
// Let me double check the import path in CityKpiTrendShowcase.jsx from the previous `view_file`.
// It was: `import { KpiFilterPanel } from "./KpiFilterPanel";` inside `CityKpiTrendShowcase.jsx`.
// So `KpiFilterPanel.jsx` is likely in `frontend/src/components/`.
// KpiMatrixTable is in `frontend/src/components/AllAvailablityAnalysis/`.
// So import should be `../../components/KpiFilterPanel` or `@/components/KpiFilterPanel`.

function cn(...classes) { return classes.filter(Boolean).join(' ') }

// ========================================
// CONFIG - Replace with DB/API data
// ========================================
const reportTypes = [
    { key: 'platform', label: 'Platform', entities: ['BLINKIT', 'ZEPTO', 'INSTAMART', 'FLIPKART', 'AMAZON'] },
    { key: 'format', label: 'Format', entities: ['TOOTHPASTE', 'MOUTHWASH', 'TOOTHBRUSH', 'BODYWASH'] },
    { key: 'city', label: 'City', entities: ['Agra', 'Karnal', 'Faridabad', 'Bengaluru', 'Mumbai'] },
]

const drillDownOptions = [
    { key: 'region', label: 'Region', items: ['North Zone', 'South Zone', 'East Zone', 'West Zone'] },
    { key: 'competitors', label: 'Competitors', items: ['Amul', 'Mother Dairy', 'Havmor', 'Vadilal'] },
    { key: 'period', label: 'Period', items: ['Yesterday', 'Last Week', 'MTD', 'L3M'] },
]

const kpis = [
    { key: 'osa', label: 'OSA' },
    { key: 'doi', label: 'DOI' },
    { key: 'fillRate', label: 'FILLRATE' },
    { key: 'assortment', label: 'ASSORTMENT' },
    { key: 'psl', label: 'PSL' },
]

// ========================================
// SHARED COMPONENTS
// ========================================

// Toggle Tabs for Report Type
const ToggleTabs = ({ tabs, activeTab, onChange }) => (
    <div className="inline-flex bg-slate-100 rounded-lg p-1">
        {tabs.map((tab) => (
            <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                className={cn(
                    'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer',
                    activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
            >
                {tab.label}
            </button>
        ))}
    </div>
)

// Drill-down Dimension Dropdown
const DrillDownDropdown = ({ options, value, onChange }) => {
    const [open, setOpen] = useState(false)
    const current = options.find(o => o.key === value)

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
                Drill-down: {current?.label || 'Select'}
                <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[160px]"
                    >
                        {options.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => { onChange(opt.key); setOpen(false); }}
                                className={cn(
                                    'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors cursor-pointer',
                                    value === opt.key ? 'text-blue-600 font-medium' : 'text-slate-700'
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ========================================
// MAIN TABLE COMPONENT
// ========================================
export default function KPIMatrixTable({ data }) {
    const [reportType, setReportType] = useState('platform')
    const [drillDimension, setDrillDimension] = useState('region')
    const [expandedRows, setExpandedRows] = useState([])

    // Drawer State
    const [openTrend, setOpenTrend] = useState(false);
    const [selectedColumn, setSelectedColumn] = useState(null);
    const [compMetaForDrawer, setCompMetaForDrawer] = useState(null);

    // ========================================
    // FILTER STATE
    // ========================================
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    // Tentative filters (while in modal)
    const [tentativeFilters, setTentativeFilters] = useState({
        platform: [],
        format: [],
        city: [],
        kpi: [],
        date: [],
        month: [],
        zone: [],
        pincode: [],
        metroFlag: []
    });

    // Applied filters (actual filtering)
    const [appliedFilters, setAppliedFilters] = useState({
        platform: [],
        format: [],
        city: [],
        kpi: [],
        date: [],
        month: [],
        zone: [],
        pincode: [],
        metroFlag: []
    });

    // Dynamic Options from API
    const [dynamicFilterData, setDynamicFilterData] = useState({
        platforms: [],
        formats: [],
        cities: [],
        months: [],
        dates: [],
        pincodes: [],
        zones: [],
        metroFlags: [],
        kpis: [], // We use our static 'kpis' constant, but structure expects this
        loading: true
    });

    // Mock keywords for the panel
    const mockKeywords = [
        { id: "kw_generic", label: "generic ice cream" },
    ];

    // ========================================
    // FILTER API LOGIC
    // ========================================

    // Helper to fetch a single filter type
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

            // Using availability analysis endpoint as we are in Availability section
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
                const [platforms, formats, cities, months, dates, pincodes, zones, metroFlags] = await Promise.all([
                    fetchFilterType('platforms'),
                    fetchFilterType('formats', tentativeFilters),
                    fetchFilterType('cities', tentativeFilters),
                    fetchFilterType('months', tentativeFilters),
                    fetchFilterType('dates', tentativeFilters),
                    fetchFilterType('pincodes', tentativeFilters),
                    fetchFilterType('zones'),
                    fetchFilterType('metroFlags')
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
                    kpis: [], // Local defined for now
                    loading: false
                });
            } catch (err) {
                console.error("Error loading filters", err);
                setDynamicFilterData(prev => ({ ...prev, loading: false }));
            }
        };
        fetchAll();
    }, []);

    // Cascading: Platform -> others
    useEffect(() => {
        const selectedPlatform = tentativeFilters.platform?.[0];
        if (!selectedPlatform || selectedPlatform === 'All') return;

        const refetch = async () => {
            const cascadeParams = {
                platform: selectedPlatform,
                format: tentativeFilters.format?.[0] || 'All',
                city: tentativeFilters.city?.[0] || 'All',
                metroFlag: tentativeFilters.metroFlag?.[0] || 'All'
            };
            const [formats, cities, months, pincodes] = await Promise.all([
                fetchFilterType('formats', cascadeParams),
                fetchFilterType('cities', cascadeParams),
                fetchFilterType('months', cascadeParams),
                fetchFilterType('pincodes', cascadeParams)
            ]);
            setDynamicFilterData(prev => ({ ...prev, formats, cities, months, pincodes }));
        };
        refetch();
    }, [tentativeFilters.platform]);

    // Cascading: Metro -> Cities
    useEffect(() => {
        const selectedMetro = tentativeFilters.metroFlag?.[0];
        if (!selectedMetro || selectedMetro === 'All') return;

        const refetch = async () => {
            const cascadeParams = {
                platform: tentativeFilters.platform?.[0] || 'All',
                metroFlag: selectedMetro
            };
            const cities = await fetchFilterType('cities', cascadeParams);
            setDynamicFilterData(prev => ({ ...prev, cities }));
        };
        refetch();
    }, [tentativeFilters.metroFlag]);

    // Cascading: City -> Pincodes
    useEffect(() => {
        const selectedCity = tentativeFilters.city?.[0];
        if (!selectedCity || selectedCity === 'All') return;

        const refetch = async () => {
            const cascadeParams = {
                platform: tentativeFilters.platform?.[0] || 'All',
                city: selectedCity
            };
            const pincodes = await fetchFilterType('pincodes', cascadeParams);
            setDynamicFilterData(prev => ({ ...prev, pincodes }));
        };
        refetch();
    }, [tentativeFilters.city]);

    // Cascading: Month -> Date
    useEffect(() => {
        const selectedMonth = tentativeFilters.month?.[0];
        if (!selectedMonth || selectedMonth === 'all') return;

        const refetch = async () => {
            const cascadeParams = {
                platform: tentativeFilters.platform?.[0] || 'All',
                city: tentativeFilters.city?.[0] || 'All',
                month: selectedMonth
            };
            const dates = await fetchFilterType('dates', cascadeParams);
            setDynamicFilterData(prev => ({ ...prev, dates }));
        };
        refetch();
    }, [tentativeFilters.month]);

    // Build Options
    const filterOptions = useMemo(() => {
        const toOptions = (arr) => arr.map(item => ({ id: item, label: item }));
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
            { id: "platform", label: "Platform", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.platforms)] },
            { id: "kpi", label: "KPI", options: kpis.map(k => ({ id: k.key, label: k.label })) },
            { id: "format", label: "Format", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.formats)] },
            { id: "city", label: "City", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.cities)] },
        ];
    }, [dynamicFilterData, kpis]);

    // Derived Logic for Entities based on Filters
    const baseEntities = reportTypes.find(r => r.key === reportType)?.entities || [];

    // Filter entities if specific filter for current report type is applied
    const filteredEntities = useMemo(() => {
        let result = baseEntities;

        // If sorting by platform and platform filter is active
        if (reportType === 'platform' && appliedFilters.platform?.length > 0 && !appliedFilters.platform.includes('all') && !appliedFilters.platform.includes('All')) {
            // Case insensitive match
            const selected = appliedFilters.platform.map(p => p.toLowerCase());
            result = result.filter(e => selected.includes(e.toLowerCase()));
        }
        else if (reportType === 'city' && appliedFilters.city?.length > 0 && !appliedFilters.city.includes('all') && !appliedFilters.city.includes('All')) {
            const selected = appliedFilters.city.map(c => c.toLowerCase());
            result = result.filter(e => selected.includes(e.toLowerCase()));
        }
        else if (reportType === 'format' && appliedFilters.format?.length > 0 && !appliedFilters.format.includes('all') && !appliedFilters.format.includes('All')) {
            const selected = appliedFilters.format.map(f => f.toLowerCase());
            result = result.filter(e => selected.includes(e.toLowerCase()));
        }

        return result;
    }, [baseEntities, reportType, appliedFilters]);

    const entities = filteredEntities; // Override original entities

    // Filter drill-down options: Hide "Region" when "City" tab is active
    const availableDrillOptions = drillDownOptions.filter(opt => {
        if (reportType === 'city' && opt.key === 'region') return false
        return true
    })

    const drillItems = availableDrillOptions.find(d => d.key === drillDimension)?.items || []

    const handleReportTypeChange = (newType) => {
        setReportType(newType)
        setExpandedRows([])

        // If switching to city and current drill is region, switch to first available (e.g., Competitors)
        if (newType === 'city' && drillDimension === 'region') {
            const nextBest = drillDownOptions.find(o => o.key !== 'region')?.key
            setDrillDimension(nextBest || '')
        }
    }

    // Toggle row expansion
    const toggleRow = (kpiKey) => {
        setExpandedRows(prev =>
            prev.includes(kpiKey)
                ? prev.filter(k => k !== kpiKey)
                : [...prev, kpiKey]
        )
    }

    // Close all expanded rows
    const closeAll = () => setExpandedRows([])

    // Generate cell data - REPLACE with actual data from props/API
    const getCellData = (entityIdx, kpiIdx) => {
        const base = 60 + entityIdx * 5 + kpiIdx * 3
        const value = Math.min(99, Math.max(10, base + (Math.random() - 0.5) * 30))
        const delta = Math.round((Math.random() - 0.4) * 8)
        return { value: Math.round(value), delta }
    }

    // Get drill-down data - REPLACE with actual data from props/API
    const getDrillData = (entity, kpi, drillItem) => {
        return { value: Math.round(60 + Math.random() * 30), delta: Math.round((Math.random() - 0.4) * 5) }
    }

    // Build competition metadata for trends drawer
    const buildCompMeta = (columnName) => {
        // Find entities for current report type
        const reportTitle = reportTypes.find(r => r.key === reportType)?.label || 'Platform';

        return {
            context: { level: "Table", audience: reportTitle },
            periodToggle: { primary: "MTD", compare: "Previous" },
            columns: entities.map(e => ({ id: e, label: e, type: "metric" })),
            brands: kpis.map((kpi, kIdx) => {
                const row = { brand: kpi.label };
                entities.forEach((entity, eIdx) => {
                    const cell = getCellData(eIdx, kIdx);
                    row[entity] = { value: cell.value, delta: cell.delta };
                });
                return row;
            })
        };
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-1 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 pt-2">
                    <ToggleTabs
                        tabs={reportTypes}
                        activeTab={reportType}
                        onChange={handleReportTypeChange}
                    />

                    <div className="flex items-center gap-3">
                        {/* Filter Button */}
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

                        <DrillDownDropdown
                            options={availableDrillOptions}
                            value={drillDimension}
                            onChange={setDrillDimension}
                        />
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-base font-semibold text-slate-900">
                                {reportTypes.find(r => r.key === reportType)?.label} KPI Matrix
                            </h3>
                            {/* Badges */}
                            <div className="flex items-center gap-2 text-xs">
                                <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    <span className="ml-1.5 text-slate-700 text-[10px]">Healthy</span>
                                </Badge>
                                <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-2 py-0.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                    <span className="ml-1.5 text-slate-700 text-[10px]">Watch</span>
                                </Badge>
                                <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-2 py-0.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                    <span className="ml-1.5 text-slate-700 text-[10px]">Action</span>
                                </Badge>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Click any cell to expand entire row
                        </p>
                    </div>
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

            {/* Table */}
            <div className="p-4">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase w-32">KPI</th>
                            {entities.map(e => (
                                <th key={e} className="text-center py-3 px-2 min-w-[120px]">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{e}</span>
                                        <span
                                            className="cursor-pointer text-slate-400 hover:text-blue-600 transition-colors trend-icon"
                                            // className="cursor-pointer text-slate-400 hover:text-blue-600 transition-colors"
                                            onClick={() => {
                                                setSelectedColumn(e);
                                                setCompMetaForDrawer(buildCompMeta(e));
                                                setOpenTrend(true);
                                            }}
                                        >
                                            <LineChartIcon size={14} strokeWidth={2.5} />
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {kpis.map((kpi, kIdx) => {
                            const isRowExpanded = expandedRows.includes(kpi.key)
                            return (
                                <>
                                    {/* Data Row */}
                                    <tr
                                        key={kpi.key}
                                        className={cn(
                                            'border-b border-slate-50 cursor-pointer transition-colors',
                                            isRowExpanded && 'bg-blue-50/30'
                                        )}
                                    >
                                        <td
                                            className="py-3 px-4 text-sm font-medium text-slate-700"
                                            onClick={() => toggleRow(kpi.key)}
                                        >
                                            {kpi.label}
                                        </td>
                                        {entities.map((entity, eIdx) => {
                                            const cell = getCellData(eIdx, kIdx)
                                            return (
                                                <td
                                                    key={entity}
                                                    className="text-center py-3 px-2"
                                                    onClick={() => toggleRow(kpi.key)}
                                                >
                                                    <motion.div
                                                        className={cn(
                                                            'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50',
                                                            isRowExpanded && 'border-blue-300 bg-blue-50'
                                                        )}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                    >
                                                        <span className="text-sm font-semibold text-slate-800">{cell.value}%</span>
                                                        <span className={cn(
                                                            'text-xs font-medium flex items-center gap-0.5',
                                                            cell.delta >= 0 ? 'text-emerald-600' : 'text-rose-500'
                                                        )}>
                                                            {cell.delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                            {Math.abs(cell.delta)}%
                                                        </span>
                                                    </motion.div>
                                                </td>
                                            )
                                        })}
                                    </tr>

                                    {/* Drill-Down Row (Expanded) */}
                                    <AnimatePresence>
                                        {isRowExpanded && (
                                            <motion.tr
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                            >
                                                <td colSpan={entities.length + 1} className="bg-slate-50/80 p-4">
                                                    {/* Drill-down Header */}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-sm font-semibold text-slate-700">
                                                            {kpi.label} → {drillDownOptions.find(d => d.key === drillDimension)?.label} Breakdown
                                                        </span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleRow(kpi.key); }}
                                                            className="p-1 hover:bg-slate-200 rounded"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>

                                                    {/* Drill-down Cards (All entities) */}
                                                    <div className="grid grid-cols-5 gap-3">
                                                        {entities.map((entity) => (
                                                            <div key={entity} className="bg-white rounded-lg p-3 border border-slate-100">
                                                                <div className="text-xs font-medium text-slate-700 mb-2">{entity}</div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {drillItems.map(item => {
                                                                        const drillData = getDrillData(entity, kpi.key, item)
                                                                        return (
                                                                            <div key={item} className="text-xs">
                                                                                <span className="text-slate-400">{item.split(' ')[0]}</span>
                                                                                <span className="ml-1 font-medium text-slate-700">{drillData.value}%</span>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        )}
                                    </AnimatePresence>
                                </>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <TrendsCompetitionDrawer
                open={openTrend}
                onClose={() => setOpenTrend(false)}
                compMeta={compMetaForDrawer}
                selectedColumn={selectedColumn}
                dynamicKey="availability"
            />
        </div>
    )
}