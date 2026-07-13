import React, { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, X, SlidersHorizontal, TrendingUp, LineChartIcon, RefreshCw, AlertTriangle, LayoutGrid, Star } from "lucide-react";
import { KpiFilterPanel } from "@/components/KpiFilterPanel";
import { Badge } from "@/components/ui/badge";
import TrendsCompetitionDrawer from "./TrendsCompetitionDrawer";
import { PlatformKpiMatrixSkeleton } from "./AvailabilitySkeletons";
import { formatNumber } from "../../utils/formatters";

function cn(...classes) {
    return classes.filter(Boolean).join(" ");
}

// ========================================
// CONFIG - Replace with DB/API data
// ========================================
const reportTypes = [
    { key: "platform", label: "Platform" },
    { key: "format", label: "Category" },
    { key: "city", label: "City" },
];

const drillDownOptions = [
    { key: "region", label: "Region" },
    { key: "period", label: "Period" },
    { key: "competitors", label: "Competitors" },
];

const kpis = [
    { key: "osa", label: "OSA" },
    { key: "doi", label: "DOI" },
    { key: "psl", label: "PSL" },
];

// ✅ Only OSA can drill down when competitors is selected, otherwise all KPIs can drill
const DRILLDOWN_ENABLED_KPIS = new Set(["osa", "psl"]);

// Filter options are fetched dynamically from the backend API

// ========================================
// SHARED COMPONENTS
// ========================================

const ToggleTabs = ({ tabs, activeTab, onChange }) => (
    <div className="inline-flex bg-slate-100/80 rounded-lg p-0.5 gap-0.5">
        {tabs.map((tab) => (
            <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                className={cn(
                    "px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200",
                    activeTab === tab.key ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
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
    const [breakdownLoading, setBreakdownLoading] = useState(false);
    const [error, setError] = useState(null);
    const [apiData, setApiData] = useState(null);

    // Track retry count to trigger re-fetch
    const [retryCount, setRetryCount] = useState(0);

    const currencySymbol = React.useMemo(() => {
        try {
            const u = JSON.parse(sessionStorage.getItem('user'));
            return u?.dbName?.toLowerCase().includes('hayatna') ? 'AED ' : '₹';
        } catch {
            return '₹';
        }
    }, []);

    // Use parent loading if provided, otherwise fallback to local state
    const isLoading = parentLoading !== undefined ? parentLoading : loading;


    // Dynamic filter options fetched from backend (lazy-loaded when panel opens)
    const [filterOptions, setFilterOptions] = useState([
        { id: 'format', label: 'Category', options: [] },
        { id: 'city', label: 'City', options: [] },
        { id: 'brand', label: 'Brand', options: [] },
        { id: 'month', label: 'Month', options: [] },
        { id: 'metroFlag', label: 'Metro Flag', options: [] },
    ]);
    const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false);

    // ========================================
    // FILTER STATE (must be declared before useEffects that reference them)
    // ========================================
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    const [tentativeFilters, setTentativeFilters] = useState({
        format: [],
        city: [],
        brand: [],
        month: [],
        metroFlag: [],
    });

    const [appliedFilters, setAppliedFilters] = useState({
        format: [],
        city: [],
        brand: [],
        month: [],
        metroFlag: [],
    });

    const appliedCount = Object.values(appliedFilters).flat().length;

    // Fetch filter options only when panel is first opened
    useEffect(() => {
        if (!showFilterPanel || filterOptionsLoaded) return;
        const fetchFilterOptions = async () => {
            try {
                const filterTypes = [
                    { id: 'format', apiType: 'formats', label: 'Category' },
                    { id: 'city', apiType: 'cities', label: 'City' },
                    { id: 'brand', apiType: 'brands', label: 'Brand' },
                    { id: 'month', apiType: 'months', label: 'Month' },
                    { id: 'metroFlag', apiType: 'metroFlags', label: 'Metro Flag' },
                ];

                // Build query params from global filters to narrow down options
                const filterQueryParams = new URLSearchParams();
                if (globalFilters) {
                    Object.entries(globalFilters).forEach(([key, value]) => {
                        if (value && value !== 'All') {
                            if (Array.isArray(value)) value.forEach(v => filterQueryParams.append(key, v));
                            else filterQueryParams.append(key, value);
                        }
                    });
                }

                const results = await Promise.all(
                    filterTypes.map(async (ft) => {
                        const qp = new URLSearchParams(filterQueryParams);
                        qp.set('filterType', ft.apiType);
                        if (ft.apiType === 'brands') {
                            qp.set('ownBrandsOnly', 'true');
                        }
                        const res = await fetch(`/api/availability-analysis/filter-options?${qp.toString()}`, {
                            headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                        });
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
    }, [showFilterPanel, filterOptionsLoaded, globalFilters]);

    // Helper to merge global and segment-level filters
    const getCombinedFilters = () => {
        const combined = { ...globalFilters };

        // Segment-level overrides
        // If segment-level filters are applied, they should OVERRIDE global ones.
        // We also remove the global keys (location, category) to prevent additive filtering
        // in backend services that might handle both keys.

        if (appliedFilters.platform?.length > 0) {
            combined.platform = appliedFilters.platform;
        }

        if (appliedFilters.city?.length > 0) {
            combined.cities = appliedFilters.city;
            // Remove global location to ensure cities override it
            delete combined.location;
        } else if (globalFilters.location) {
            // Fallback to global location mapped to 'cities' for consistency
            combined.cities = globalFilters.location;
        }

        if (appliedFilters.format?.length > 0) {
            combined.formats = appliedFilters.format;
            delete combined.category;
        } else if (globalFilters.category) {
            combined.formats = globalFilters.category;
        }

        if (appliedFilters.brand?.length > 0) {
            combined.brand = appliedFilters.brand;
        }

        if (appliedFilters.month?.length > 0) {
            combined.months = appliedFilters.month;
        }

        if (appliedFilters.metroFlag?.length > 0) {
            combined.metroFlags = appliedFilters.metroFlag;
        }

        return combined;
    };

    // ========================================
    // DATA FETCHING
    // ========================================
    useEffect(() => {
        const fetchData = async () => {
            // If we already have data and are just fetching breakdown, use breakdownLoading
            const isBreakdownRefetch = apiData && expandedRows.length > 0;
            if (isBreakdownRefetch) {
                setBreakdownLoading(true);
            } else {
                setLoading(true);
            }
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

                // Add combined filters
                const combined = getCombinedFilters();
                Object.entries(combined).forEach(([key, value]) => {
                    if (value && value !== 'All') {
                        if (Array.isArray(value)) {
                            if (value.length > 0) value.forEach(v => params.append(key, v));
                        } else {
                            params.append(key, value);
                        }
                    }
                });

                // Force ownBrandsOnly to match Watch Tower KPIs identically
                params.append('ownBrandsOnly', 'true');

                const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?${params.toString()}`, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const result = await res.json();
                setApiData(result);
            } catch (err) {
                console.error("Error fetching matrix data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
                setBreakdownLoading(false);
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

    // Use API columns if available, otherwise empty array
    const entities = apiData?.columns?.filter(c => c !== 'KPI') || [];
    const drillItems = apiData?.applicableDrillItems || [];
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
            format: [],
            city: [],
            brand: [],
            month: [],
            metroFlag: [],
        });
    };

    // Use API data for cells
    const getCellData = (entity, kpiLabel) => {
        if (!apiData?.rows) return { value: "N/A", delta: null, isNA: true };
        const row = apiData.rows.find(r => r.kpi.toLowerCase() === kpiLabel.toLowerCase());
        if (!row || row[entity] === undefined || row[entity] === null || row[entity] === "N/A" || row[entity] === "" || row[entity] === "-") {
            return { value: "N/A", delta: null, isNA: true };
        }
        return {
            value: row[entity],
            delta: row.trend && row.trend[entity] !== undefined && row.trend[entity] !== null ? row.trend[entity] : null,
            isNA: false
        };
    };

    // Use API data for drill breakdown
    const getDrillData = (entity, kpiLabel, drillItem) => {
        if (!apiData?.rows) return { value: "N/A", delta: null, isNA: true };
        const row = apiData.rows.find(r => r.kpi.toLowerCase() === kpiLabel.toLowerCase());
        if (!row || !row.breakdown || !row.breakdown[entity]) return { value: "N/A", delta: null, isNA: true };

        // Match drillItem (e.g. "North Zone" vs "North Zone")
        const val = row.breakdown[entity][drillItem];
        if (val === undefined || val === null || val === "N/A" || val === "" || val === "-") {
            return { value: "N/A", delta: null, isNA: true };
        }
        return { value: val, delta: null, isNA: false };
    };

    if (isLoading && !apiData) {
        return <PlatformKpiMatrixSkeleton />;
    }

    if (error) {
        return <ErrorWithRefresh segmentName="Platform KPI Matrix" errorMessage={error} onRetry={handleRetry} isRetrying={loading} />;
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <LayoutGrid size={18} className="text-indigo-500" />
                        </div>
                        <div className="flex items-center gap-2.5">
                            <ToggleTabs
                                tabs={reportTypes}
                                activeTab={reportType}
                                onChange={(t) => {
                                    setReportType(t);
                                    setExpandedRows([]);
                                }}
                            />
                            <span className="text-xs text-slate-400 font-medium">
                                ({entities.length} items)
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilterPanel(true)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 border border-slate-200/80 transition-colors"
                        >
                            <SlidersHorizontal size={14} />
                            Filters
                            {appliedCount > 0 && (
                                <Badge className="ml-1 bg-indigo-100 text-indigo-700 border-indigo-200">
                                    {appliedCount}
                                </Badge>
                            )}
                        </button>
                        <DrillDownDropdown value={drillDimension} onChange={setDrillDimension} reportType={reportType} />
                        {expandedRows.length > 0 && (
                            <button
                                onClick={closeAll}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg hover:bg-slate-100 border border-slate-200/80"
                            >
                                <X size={12} /> Collapse All
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Modal */}
            {showFilterPanel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center md:items-start bg-slate-900/40 p-4 md:pt-52 md:pl-40 transition-all backdrop-blur-sm">
                    <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-auto max-h-[85vh] min-h-[50vh] sm:h-[700px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
            <div className="px-2 pb-4">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                {/* Expand Icon Column */}
                                <th className="py-3 px-3 w-10" />

                                <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-40">
                                    {reportTypes.find((r) => r.key === reportType)?.label}
                                </th>

                                {entities.map((e) => (
                                    <th key={e} className="text-right py-3 px-4 min-w-[100px]">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{e}</span>
                                            <button
                                                onClick={() => {
                                                    setSelectedCellForTrend({ entity: e, kpi: null });
                                                    setShowTrendsDrawer(true);
                                                }}
                                                className="p-0.5 text-slate-300 hover:text-indigo-500 rounded transition-colors"
                                                title={`View ${e} trends`}
                                            >
                                                <LineChartIcon size={13} />
                                            </button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {/* Total Row */}
                            {apiData?.rows && (
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td className="py-3.5 px-3 align-middle">
                                        <Star size={14} className="text-indigo-400" fill="currentColor" />
                                    </td>
                                    <td className="py-3.5 px-4 text-sm font-bold text-slate-800">Total</td>
                                    {entities.map((entity) => {
                                        // Sum all KPI values for this entity as a "total" row
                                        const osaCell = getCellData(entity, 'OSA');
                                        return (
                                            <td key={entity} className="text-right py-3.5 px-4">
                                                <span className="text-sm font-bold text-slate-800">
                                                    {osaCell.value}%
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            )}

                            {kpis.filter(kpi => {
                                if (!appliedFilters.kpi || appliedFilters.kpi.length === 0) return true;
                                return appliedFilters.kpi.some(selectedKpi =>
                                    selectedKpi.toLowerCase() === kpi.label.toLowerCase()
                                );
                            }).map((kpi, kIdx) => {
                                const drillEnabled = isDrillEnabled(kpi.key);
                                const isRowExpanded = expandedRows.includes(kpi.key);

                                return (
                                    <Fragment key={kpi.key}>
                                        {/* Data Row */}
                                        <tr
                                            style={{ borderBottom: '1px solid #f1f5f9' }}
                                            className={cn(
                                                "transition-colors hover:bg-slate-50/50",
                                                isRowExpanded && drillEnabled && "bg-indigo-50/30"
                                            )}
                                        >
                                            {/* Expand Chevron */}
                                            <td className="py-3 px-3 align-middle">
                                                <button
                                                    type="button"
                                                    onClick={drillEnabled ? () => toggleRow(kpi.key) : undefined}
                                                    disabled={!drillEnabled}
                                                    aria-label={drillEnabled ? `Expand ${kpi.label} row` : `${kpi.label} drill-down not available`}
                                                    className={cn(
                                                        "transition-transform",
                                                        drillEnabled
                                                            ? "text-slate-400 hover:text-indigo-500 cursor-pointer"
                                                            : "text-slate-200 cursor-not-allowed"
                                                    )}
                                                    style={{ background: 'none', border: 'none', padding: 0 }}
                                                >
                                                    <ChevronRight
                                                        size={16}
                                                        className={cn("transition-transform duration-200", drillEnabled && isRowExpanded && "rotate-90")}
                                                    />
                                                </button>
                                            </td>

                                            {/* KPI Label */}
                                            <td className="py-3 px-4 text-sm font-semibold text-slate-700 select-none">
                                                <div className="flex items-center gap-2">
                                                    <span>{kpi.label}</span>
                                                    {drillEnabled && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-500 border border-indigo-100">
                                                            Drill
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Values */}
                                            {entities.map((entity) => {
                                                const cell = getCellData(entity, kpi.label);
                                                return (
                                                    <td key={entity} className="text-right py-3 px-4">
                                                        <div className={cn(
                                                            "inline-flex items-center gap-1.5 justify-end",
                                                            loading && "opacity-50"
                                                        )}>
                                                            <span className="text-sm font-semibold text-slate-700">
                                                                {cell.isNA
                                                                    ? 'N/A'
                                                                    : kpi.key === 'psl'
                                                                        ? `${currencySymbol}${formatNumber(cell.value)}`
                                                                        : `${cell.value}${['doi', 'assortment'].includes(kpi.key) ? '' : '%'}`}
                                                            </span>
                                                            {!cell.isNA && cell.delta !== null && cell.delta !== undefined && (
                                                                <span
                                                                    className={cn(
                                                                        "text-[11px] font-medium",
                                                                        cell.delta >= 0 ? "text-emerald-500" : "text-rose-500"
                                                                    )}
                                                                >
                                                                    {cell.delta >= 0 ? "↑" : "↓"}
                                                                    {kpi.key === 'psl' ? `${currencySymbol}${formatNumber(Math.abs(cell.delta))}` : Math.abs(cell.delta)}
                                                                </span>
                                                            )}
                                                        </div>
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
                                                    <td colSpan={entities.length + 2} className="bg-slate-50/60 p-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-sm font-semibold text-slate-600">
                                                                {kpi.label} → {drillLabel} Breakdown
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleRow(kpi.key)}
                                                                className="p-1 hover:bg-slate-200 rounded text-slate-400"
                                                                aria-label="Close drilldown"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                                            {entities.map((entity) => {
                                                                const row = apiData?.rows?.find(r => r.kpi.toLowerCase() === kpi.key.toLowerCase());
                                                                const breakdownData = row?.breakdown?.[entity];
                                                                const isBreakdownLoading2 = breakdownLoading || loading || !breakdownData;

                                                                return (
                                                                    <div key={entity} className="bg-white rounded-lg p-3 border border-slate-100">
                                                                        <div className="text-xs font-semibold text-slate-600 mb-2">{entity}</div>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            {isBreakdownLoading2 ? (
                                                                                [1, 2, 3, 4].map((i) => (
                                                                                    <div key={`skel-${i}`} className="flex items-center gap-1.5">
                                                                                        <div className="h-3 w-12 rounded bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse" />
                                                                                        <div className="h-3 w-8 rounded bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse" />
                                                                                    </div>
                                                                                ))
                                                                            ) : (
                                                                                Object.keys(breakdownData).map((item) => {
                                                                                    const drillData = getDrillData(entity, kpi.key, item);
                                                                                    return (
                                                                                        <div key={item} className="text-xs">
                                                                                            <span className="text-slate-400" title={item}>
                                                                                                {item.includes('Zone') ? item.split(' ')[0] : (item.length > 8 ? item.substring(0, 8) + '..' : item)}
                                                                                            </span>
                                                                                            <span className="ml-1 font-medium text-slate-700">
                                                                                                {drillData.isNA
                                                                                                    ? 'N/A'
                                                                                                    : kpi.key === 'psl'
                                                                                                        ? `${currencySymbol}${formatNumber(drillData.value)}`
                                                                                                        : `${drillData.value}${['doi', 'assortment'].includes(kpi.key) ? '' : '%'}`}
                                                                                            </span>
                                                                                        </div>
                                                                                    );
                                                                                })
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
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
                filters={getCombinedFilters()}
            />
        </div>
    );
}