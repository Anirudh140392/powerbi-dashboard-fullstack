import React, { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, X, SlidersHorizontal, TrendingUp, LineChartIcon, RefreshCw, AlertTriangle } from "lucide-react";
import { KpiFilterPanel } from "@/components/KpiFilterPanel";
import { Badge } from "@/components/ui/badge";
import TrendsCompetitionDrawer from "./TrendsCompetitionDrawer";
import { PlatformKpiMatrixSkeleton } from "./AvailabilitySkeletons";

function cn(...classes) {
    return classes.filter(Boolean).join(" ");
}

// ========================================
// CONFIG - Replace with DB/API data
// ========================================
const reportTypes = [
    {
        key: "platform",
        label: "Platform",
        entities: ["Blinkit", "Instamart", "Zepto", "Flipkart", "Amazon"],
    },
    {
        key: "format",
        label: "Format",
        entities: ["CASSATA", "CORE TUB", "CORNETTO", "MAGNUM", "PREMIUM TUB"],
    },
    {
        key: "city",
        label: "City",
        entities: ["AJMER", "AMRITSAR", "BATHINDA", "BHOPAL", "CHANDIGARH"],
    },
];

const drillDownOptions = [
    { key: "region", label: "Region", items: ["North Zone", "South Zone", "East Zone", "West Zone"] },
    { key: "period", label: "Period", items: ["Yesterday", "Last Week", "MTD", "L3M"] },
    { key: "competitors", label: "Competitors", items: ["Amul", "Mother Dairy", "Havmor", "Vadilal"] },
];

const kpis = [
    { key: "osa", label: "OSA" },
    { key: "fillRate", label: "FILLRATE" },
    { key: "assortment", label: "ASSORTMENT" },
    { key: "psl", label: "PSL" },
];

// ✅ Only OSA can drill down when competitors is selected, otherwise all KPIs can drill
const DRILLDOWN_ENABLED_KPIS = new Set(["osa"]);

// Filter options are fetched dynamically from the backend API

// ========================================
// SHARED COMPONENTS
// ========================================

const ToggleTabs = ({ tabs, activeTab, onChange }) => (
    <div className="inline-flex bg-slate-100 rounded-lg p-1">
        {tabs.map((tab) => (
            <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                    activeTab === tab.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
            >
                {tab.label}
            </button>
        ))}
    </div>
);

const DrillDownDropdown = ({ value, onChange, reportType }) => {
    const [open, setOpen] = useState(false);

    // Filter out 'region' when 'city' tab is selected
    const filteredOptions = reportType === 'city'
        ? drillDownOptions.filter(opt => opt.key !== 'region')
        : drillDownOptions;

    const current = filteredOptions.find((o) => o.key === value) || filteredOptions[0];

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
                Drill-down: {current?.label}
                <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[160px]"
                    >
                        {filteredOptions.map((opt) => (
                            <button
                                key={opt.key}
                                onClick={() => {
                                    onChange(opt.key);
                                    setOpen(false);
                                }}
                                className={cn(
                                    "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors",
                                    value === opt.key ? "text-blue-600 font-medium" : "text-slate-700"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Error State Component - Shows when API fails with refresh button
// ---------------------------------------------------------------------------
const ErrorWithRefresh = ({ segmentName, errorMessage, onRetry, isRetrying = false }) => {
    return (
        <div className="rounded-[2rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/50 p-12 flex flex-col items-center justify-center min-h-[450px] gap-6 text-center">
            <div className="h-20 w-20 rounded-3xl bg-rose-50 flex items-center justify-center mb-2 animate-pulse">
                <AlertTriangle size={40} className="text-rose-500" strokeWidth={1.5} />
            </div>

            <div className="max-w-md">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Internal Fetch Error</h3>
                <p className="text-slate-500 text-base leading-relaxed mb-8">
                    We encountered an issue while loading the <span className="font-semibold text-slate-700">{segmentName}</span>.
                    <br />
                    <span className="text-sm font-mono bg-slate-50 px-2 py-1 rounded-md mt-2 inline-block">
                        Error code: {errorMessage || "HTTP_UNKNOWN_ERROR"}
                    </span>
                </p>

                <button
                    onClick={onRetry}
                    disabled={isRetrying}
                    className={`inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl text-base font-bold transition-all transform active:scale-95
                        ${isRetrying
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)]'
                        }`}
                >
                    <RefreshCw size={20} className={isRetrying ? "animate-spin" : ""} />
                    {isRetrying ? "Establishing Connection..." : "Refresh Matrix Data"}
                </button>
            </div>

            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase mt-4">
                Systems fully operational. Try refreshing to restore data.
            </p>
        </div>
    );
};

// ========================================
// MAIN TABLE COMPONENT
// UX: single expand icon column (left) instead of clickable cells
// ========================================
export default function KPIMatrixTable({ filters: globalFilters, loading: parentLoading }) {
    const [reportType, setReportType] = useState("platform");
    const [drillDimension, setDrillDimension] = useState("region");
    const [expandedRows, setExpandedRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [apiData, setApiData] = useState(null);

    // Track retry count to trigger re-fetch
    const [retryCount, setRetryCount] = useState(0);

    // Use parent loading if provided, otherwise fallback to local state
    const isLoading = parentLoading !== undefined ? parentLoading : loading;


    // Dynamic filter options fetched from backend (lazy-loaded when panel opens)
    const [filterOptions, setFilterOptions] = useState([
        { id: 'platform', label: 'Platform', options: [] },
        { id: 'city', label: 'City', options: [] },
        { id: 'format', label: 'Format', options: [] },
    ]);
    const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false);

    // ========================================
    // FILTER STATE (must be declared before useEffects that reference them)
    // ========================================
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    const [tentativeFilters, setTentativeFilters] = useState({
        platform: [],
        city: [],
        format: [],
    });

    const [appliedFilters, setAppliedFilters] = useState({
        platform: [],
        city: [],
        format: [],
    });

    const appliedCount = Object.values(appliedFilters).flat().length;

    // Fetch filter options only when panel is first opened
    useEffect(() => {
        if (!showFilterPanel || filterOptionsLoaded) return;
        const fetchFilterOptions = async () => {
            try {
                const filterTypes = [
                    { id: 'platform', apiType: 'platforms', label: 'Platform' },
                    { id: 'city', apiType: 'cities', label: 'City' },
                    { id: 'format', apiType: 'formats', label: 'Format' },
                ];
                const results = await Promise.all(
                    filterTypes.map(async (ft) => {
                        const res = await fetch(`/api/availability-analysis/filter-options?filterType=${ft.apiType}`);
                        if (!res.ok) return { id: ft.id, label: ft.label, options: [] };
                        const data = await res.json();
                        const opts = (data.options || []).map(v => ({ id: v, label: v }));
                        return { id: ft.id, label: ft.label, options: opts };
                    })
                );
                setFilterOptions(results);
                setFilterOptionsLoaded(true);
            } catch (err) {
                console.error('Error fetching filter options:', err);
            }
        };
        fetchFilterOptions();
    }, [showFilterPanel, filterOptionsLoaded]);

    // ========================================
    // DATA FETCHING
    // ========================================
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                // Map local reportType to viewMode expected by backend
                const viewMode = reportType.charAt(0).toUpperCase() + reportType.slice(1);
                params.append('viewMode', viewMode);
                params.append('drillDimension', drillDimension);

                // Only request breakdown data when rows are expanded
                if (expandedRows.length > 0) {
                    params.append('includeBreakdown', 'true');
                }

                // Add global filters
                if (globalFilters) {
                    Object.entries(globalFilters).forEach(([key, value]) => {
                        if (value && value !== 'All') {
                            if (Array.isArray(value)) value.forEach(v => params.append(key, v));
                            else params.append(key, value);
                        }
                    });
                }

                // Add segment-level applied filters
                if (appliedFilters.platform?.length > 0) {
                    appliedFilters.platform.forEach(v => params.append('platform', v));
                }
                if (appliedFilters.city?.length > 0) {
                    appliedFilters.city.forEach(v => params.append('cities', v));
                }
                if (appliedFilters.format?.length > 0) {
                    appliedFilters.format.forEach(v => params.append('categories', v));
                }

                const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?${params.toString()}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const result = await res.json();
                setApiData(result);
            } catch (err) {
                console.error("Error fetching matrix data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [reportType, drillDimension, globalFilters, appliedFilters, expandedRows.length, retryCount]);

    const handleRetry = () => setRetryCount(prev => prev + 1);

    // ========================================
    // CHART/DRAWER STATE
    // ========================================
    const [showTrendsDrawer, setShowTrendsDrawer] = useState(false);
    const [selectedCellForTrend, setSelectedCellForTrend] = useState({ entity: null, kpi: null });

    // Use API columns if available, otherwise fallback to config
    const entities = apiData?.columns?.filter(c => c !== 'KPI') || reportTypes.find((r) => r.key === reportType)?.entities || [];
    const drillItems = drillDownOptions.find((d) => d.key === drillDimension)?.items || [];
    const drillLabel = drillDownOptions.find((d) => d.key === drillDimension)?.label;

    // Drill-down enabled logic: only OSA for competitors, all KPIs for other options
    const isDrillEnabled = (kpiKey) => {
        if (drillDimension === 'competitors') {
            return DRILLDOWN_ENABLED_KPIS.has(kpiKey.toLowerCase());
        }
        return true; // All KPIs can drill for region/period
    };

    const toggleRow = (kpiKey) => {
        if (!isDrillEnabled(kpiKey)) return;
        setExpandedRows((prev) =>
            prev.includes(kpiKey) ? prev.filter((k) => k !== kpiKey) : [...prev, kpiKey]
        );
    };

    const closeAll = () => {
        setExpandedRows([]);
        // Assuming setExpandedBrands and setExpandedSkus are defined elsewhere or not needed here.
        // If they are part of the state, they should be declared.
        // For now, I'll keep the original closeAll behavior for expandedRows.
    };

    const resetFilters = () => {
        setTentativeFilters({
            platform: [],
            city: [],
            format: [],
        });
    };

    // Use API data for cells
    const getCellData = (entity, kpiLabel) => {
        if (!apiData?.rows) return { value: 0, delta: 0 };
        const row = apiData.rows.find(r => r.kpi.toLowerCase() === kpiLabel.toLowerCase());
        if (!row) return { value: 0, delta: 0 };
        return {
            value: row[entity] || 0,
            delta: row.trend && row.trend[entity] !== undefined ? row.trend[entity] : 0
        };
    };

    // Use API data for drill breakdown
    const getDrillData = (entity, kpiLabel, drillItem) => {
        if (!apiData?.rows) return { value: 0, delta: 0 };
        const row = apiData.rows.find(r => r.kpi.toLowerCase() === kpiLabel.toLowerCase());
        if (!row || !row.breakdown || !row.breakdown[entity]) return { value: 0, delta: 0 };

        // Match drillItem (e.g. "North Zone" vs "North Zone")
        const val = row.breakdown[entity][drillItem];
        return { value: val !== undefined ? val : 0, delta: 0 };
    };

    if (isLoading) {
        return <PlatformKpiMatrixSkeleton />;
    }

    if (error) {
        return <ErrorWithRefresh segmentName="Platform KPI Matrix" errorMessage={error} onRetry={handleRetry} isRetrying={loading} />;
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <ToggleTabs
                        tabs={reportTypes}
                        activeTab={reportType}
                        onChange={(t) => {
                            setReportType(t);
                            setExpandedRows([]);
                        }}
                    />
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilterPanel(true)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            <SlidersHorizontal size={14} />
                            Filters
                            {appliedCount > 0 && (
                                <Badge className="ml-1 bg-emerald-100 text-emerald-700 border-emerald-200">
                                    {appliedCount}
                                </Badge>
                            )}
                        </button>
                        <DrillDownDropdown value={drillDimension} onChange={setDrillDimension} reportType={reportType} />
                    </div>
                </div>

                <div className="mt-3 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900">
                            {reportTypes.find((r) => r.key === reportType)?.label} KPI Matrix
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Use the left arrow to expand drill-down (available only for OSA)
                        </p>
                        {drillDimension === "competitors" && (
                            <p className="text-xs text-slate-400 mt-1">Note: Competitor breakdown is enabled only for OSA</p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
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

            {/* Table */}
            <div className="p-4">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px]">
                        <thead>
                            <tr className="border-b border-slate-100">
                                {/* Expand Icon Column */}
                                <th className="py-3 px-2 w-12" />

                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase w-40">KPI</th>

                                {entities.map((e) => (
                                    <th key={e} className="text-center py-3 px-2 min-w-[110px]">
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="text-xs font-semibold text-slate-500 uppercase">{e}</span>
                                            <button
                                                onClick={() => {
                                                    setSelectedCellForTrend({ entity: e, kpi: null });
                                                    setShowTrendsDrawer(true);
                                                }}
                                                className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors trend-icon"
                                                title={`View ${e} trends`}
                                            >
                                                <LineChartIcon size={15} />
                                            </button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {kpis.map((kpi, kIdx) => {
                                const isComingSoon = kpi.key === 'fillRate';
                                const drillEnabled = isComingSoon ? false : isDrillEnabled(kpi.key);
                                const isRowExpanded = isComingSoon ? false : expandedRows.includes(kpi.key);

                                return (
                                    <Fragment key={kpi.key}>
                                        {/* Data Row */}
                                        <tr
                                            className={cn(
                                                "border-b border-slate-50 transition-colors",
                                                isRowExpanded && drillEnabled && "bg-blue-50/30"
                                            )}
                                        >
                                            {/* Expand Button Cell */}
                                            <td className="py-2 px-2 align-middle">
                                                <button
                                                    type="button"
                                                    onClick={drillEnabled ? () => toggleRow(kpi.key) : undefined}
                                                    disabled={!drillEnabled}
                                                    aria-label={drillEnabled ? `Expand ${kpi.label} row` : `${kpi.label} drill-down not available`}
                                                    title={drillEnabled ? "Expand row" : "Drill-down not available"}
                                                    className={cn(
                                                        "h-8 w-8 inline-flex items-center justify-center rounded-md border transition-colors",
                                                        drillEnabled
                                                            ? "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100"
                                                            : "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                                                    )}
                                                >
                                                    <ChevronRight
                                                        size={16}
                                                        className={cn("transition-transform", drillEnabled && isRowExpanded && "rotate-90")}
                                                    />
                                                </button>
                                            </td>

                                            {/* KPI Label */}
                                            <td className="py-3 px-4 text-sm font-medium text-slate-700 select-none">
                                                <div className="flex items-center gap-2">
                                                    <span className={isComingSoon ? 'text-slate-400' : ''}>{kpi.label}</span>
                                                    {isComingSoon && (
                                                        <motion.span
                                                            initial={{ opacity: 0.8 }}
                                                            animate={{ opacity: [0.8, 1, 0.8] }}
                                                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm uppercase tracking-widest ring-1 ring-inset ring-white/20"
                                                        >
                                                            Coming Soon
                                                        </motion.span>
                                                    )}
                                                    {!isComingSoon && drillEnabled && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] border border-blue-100">
                                                            Drill
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Values */}
                                            {entities.map((entity) => {
                                                if (isComingSoon) {
                                                    return (
                                                        <td key={entity} className="text-center py-3 px-2">
                                                            <div className="flex justify-center">
                                                                <motion.div
                                                                    className="inline-flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50/50 border border-slate-100/50 min-w-[60px] cursor-default overflow-hidden relative"
                                                                    whileHover={{ scale: 1.02, backgroundColor: "rgba(248, 250, 252, 0.8)" }}
                                                                >
                                                                    <div className="text-[10px] font-bold text-slate-300 tracking-tighter">—</div>
                                                                    <motion.div
                                                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full"
                                                                        animate={{ translateX: ["100%", "-100%"] }}
                                                                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                                    />
                                                                </motion.div>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                const cell = getCellData(entity, kpi.label);
                                                const isPercentage = kpi.label !== 'Assortment';

                                                return (
                                                    <td key={entity} className="text-center py-3 px-2">
                                                        <motion.div
                                                            className={cn(
                                                                "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-transparent",
                                                                // subtle hover for readability only (not clickable)
                                                                "hover:bg-slate-50 hover:border-slate-200",
                                                                loading && "opacity-50 pointer-events-none"
                                                            )}
                                                            whileHover={{ scale: 1.01 }}
                                                        >
                                                            <span className="text-sm font-semibold text-slate-800">{cell.value}{['doi', 'assortment', 'psl'].includes(kpi.key) ? '' : '%'}</span>
                                                            <span
                                                                className={cn(
                                                                    "text-xs font-medium",
                                                                    cell.delta >= 0 ? "text-emerald-600" : "text-rose-500"
                                                                )}
                                                            >
                                                                {cell.delta >= 0 ? "↑" : "↓"}
                                                                {Math.abs(cell.delta)}
                                                            </span>
                                                        </motion.div>
                                                    </td>
                                                );
                                            })}
                                        </tr>

                                        {/* Drill Row */}
                                        <AnimatePresence>
                                            {drillEnabled && isRowExpanded && (
                                                <motion.tr
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                >
                                                    <td colSpan={entities.length + 2} className="bg-slate-50/80 p-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-sm font-semibold text-slate-700">
                                                                {kpi.label} → {drillLabel} Breakdown
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleRow(kpi.key)}
                                                                className="p-1 hover:bg-slate-200 rounded"
                                                                aria-label="Close drilldown"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                                            {entities.map((entity) => (
                                                                <div key={entity} className="bg-white rounded-lg p-3 border border-slate-100">
                                                                    <div className="text-xs font-medium text-slate-700 mb-2">{entity}</div>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        {(() => {
                                                                            const row = apiData?.rows?.find(r => r.kpi.toLowerCase() === kpi.key.toLowerCase());
                                                                            const breakdownData = row?.breakdown?.[entity];
                                                                            const keys = breakdownData ? Object.keys(breakdownData) : drillItems;

                                                                            return keys.map((item) => {
                                                                                const drillData = getDrillData(entity, kpi.key, item);
                                                                                return (
                                                                                    <div key={item} className="text-xs">
                                                                                        <span className="text-slate-400" title={item}>
                                                                                            {item.includes('Zone') ? item.split(' ')[0] : (item.length > 8 ? item.substring(0, 8) + '..' : item)}
                                                                                        </span>
                                                                                        <span className="ml-1 font-medium text-slate-700">{drillData.value}{['doi', 'assortment', 'psl'].includes(kpi.key) ? '' : '%'}</span>
                                                                                    </div>
                                                                                );
                                                                            });
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            )}
                                        </AnimatePresence>
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Trends Chart Drawer */}
            <TrendsCompetitionDrawer
                dynamicKey="availability"
                open={showTrendsDrawer}
                onClose={() => setShowTrendsDrawer(false)}
                selectedColumn={selectedCellForTrend.entity}
                selectedLevel={reportType}
                filters={appliedFilters}
            />
        </div>
    );
}