import React, { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, X, SlidersHorizontal, TrendingUp, LineChartIcon, RefreshCw, AlertTriangle } from "lucide-react";
import { KpiFilterPanel } from "@/components/KpiFilterPanel";
import { Badge } from "@/components/ui/badge";
import { PlatformKpiMatrixSkeleton } from "../AllAvailablityAnalysis/AvailabilitySkeletons";
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

const kpis = [
    { key: "osa", label: "OSA" },
    { key: "marketShare", label: "Market Share%" }
];

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
export default function StandaloneOsaKpiMatrix({ filters: globalFilters, loading: parentLoading }) {
    const [reportType, setReportType] = useState("platform");
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
        platform: [],
        format: [],
        city: [],
        brand: [],
        month: [],
        metroFlag: [],
    });

    const [appliedFilters, setAppliedFilters] = useState({
        platform: [],
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
                    { id: 'platform', apiType: 'platforms', label: 'Platform' },
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
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                // Map local reportType to viewMode expected by backend
                const viewMode = reportType.charAt(0).toUpperCase() + reportType.slice(1);
                params.append('viewMode', viewMode);

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

                const res = await fetch(`/api/availability-analysis/standalone-kpi-matrix?${params.toString()}`, {
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
            }
        };

        fetchData();
    }, [reportType, globalFilters, appliedFilters, retryCount]);

    const handleRetry = () => setRetryCount(prev => prev + 1);

    // ========================================
    // CHART/DRAWER STATE
    // ========================================
    // Use API columns if available, otherwise empty array
    const entities = apiData?.columns?.filter(c => c !== 'KPI') || [];

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
        if (!apiData?.rows) return { value: "N/A", delta: 0, isNA: true };
        const row = apiData.rows.find(r => r.kpi.toLowerCase() === kpiLabel.toLowerCase());
        if (!row || row[entity] === undefined || row[entity] === null) return { value: "N/A", delta: 0, isNA: true };
        return {
            value: row[entity],
            delta: row.trend && row.trend[entity] !== undefined ? row.trend[entity] : 0,
            isNA: false
        };
    };

    if (isLoading && !apiData) {
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
                    </div>
                </div>

                <div className="mt-3 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900">
                            {reportTypes.find((r) => r.key === reportType)?.label} KPI Matrix
                        </h3>
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
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase w-40">KPI</th>

                                {entities.map((e) => (
                                    <th key={e} className="text-center py-3 px-2 min-w-[110px]">
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="text-xs font-semibold text-slate-500 uppercase">{e}</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {kpis.filter(kpi => {
                                if (!appliedFilters.kpi || appliedFilters.kpi.length === 0) return true;
                                // Case-insensitive match between kpi.label and appliedFilters.kpi array
                                return appliedFilters.kpi.some(selectedKpi =>
                                    selectedKpi.toLowerCase() === kpi.label.toLowerCase()
                                );
                            }).map((kpi, kIdx) => {
                                return (
                                    <Fragment key={kpi.key}>
                                        {/* Data Row */}
                                        <tr className="border-b border-slate-50 transition-colors">
                                            {/* KPI Label */}
                                            <td className="py-3 px-4 text-sm font-medium text-slate-700 select-none">
                                                <div className="flex items-center gap-2">
                                                    <span>{kpi.label}</span>
                                                </div>
                                            </td>

                                            {/* Values */}
                                            {entities.map((entity) => {
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
                                                            <span className="text-sm font-semibold text-slate-800">
                                                                {cell.isNA 
                                                                    ? "N/A" 
                                                                    : kpi.key === 'psl' 
                                                                        ? `₹${formatNumber(cell.value)}` 
                                                                        : `${cell.value}${['doi', 'assortment'].includes(kpi.key) ? '' : '%'}`}
                                                            </span>
                                                            {!cell.isNA && (
                                                                <span
                                                                    className={cn(
                                                                        "text-xs font-medium",
                                                                        cell.delta >= 0 ? "text-emerald-600" : "text-rose-500"
                                                                    )}
                                                                >
                                                                    {cell.delta >= 0 ? "↑" : "↓"}
                                                                    {kpi.key === 'psl' ? formatNumber(Math.abs(cell.delta)) : Math.abs(cell.delta)}
                                                                </span>
                                                            )}
                                                        </motion.div>
                                                    </td>
                                                );
                                            })}
                                        </tr>

                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}