import React, { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, TrendingUp, LineChartIcon, RefreshCw, AlertTriangle } from "lucide-react";
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

    // Helper to merge global and segment-level filters
    const getCombinedFilters = () => {
        const combined = { ...globalFilters };

        if (globalFilters.location) {
            combined.cities = globalFilters.location;
        }
        if (globalFilters.category) {
            combined.formats = globalFilters.category;
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

                // Only force ownBrandsOnly if no specific brand is selected
                if (!params.has('brand') || params.get('brand') === 'All') {
                    params.append('ownBrandsOnly', 'true');
                }

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
    }, [reportType, globalFilters, retryCount]);

    const handleRetry = () => setRetryCount(prev => prev + 1);

    // ========================================
    // CHART/DRAWER STATE
    // ========================================
    // Use API columns if available, otherwise empty array
    const entities = apiData?.columns?.filter(c => c !== 'KPI') || [];


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
                </div>

                <div className="mt-3 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900">
                            {reportTypes.find((r) => r.key === reportType)?.label} KPI Matrix
                        </h3>
                    </div>
                </div>
            </div>


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
                            {kpis.map((kpi, kIdx) => {
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