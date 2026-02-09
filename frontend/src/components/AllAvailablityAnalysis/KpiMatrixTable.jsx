import React, { useState, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, X, SlidersHorizontal, TrendingUp, LineChartIcon } from "lucide-react";
import { KpiFilterPanel } from "@/components/KpiFilterPanel";
import { Badge } from "@/components/ui/badge";
import TrendsCompetitionDrawer from "./TrendsCompetitionDrawer";

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
    { key: "doi", label: "DOI" },
    { key: "fillRate", label: "FILLRATE" },
    { key: "assortment", label: "ASSORTMENT" },
    { key: "psl", label: "PSL" },
];

// ✅ Only OSA can drill down when competitors is selected, otherwise all KPIs can drill
const DRILLDOWN_ENABLED_KPIS = new Set(["osa"]);

// ========================================
// FILTER OPTIONS CONFIG
// ========================================
const filterOptions = [
    {
        id: 'platform',
        label: 'Platform',
        options: [
            { id: 'Blinkit', label: 'Blinkit' },
            { id: 'Instamart', label: 'Instamart' },
            { id: 'Zepto', label: 'Zepto' },
            { id: 'Flipkart', label: 'Flipkart' },
            { id: 'Amazon', label: 'Amazon' },
        ]
    },
    {
        id: 'city',
        label: 'City',
        options: [
            { id: 'Delhi', label: 'Delhi' },
            { id: 'Mumbai', label: 'Mumbai' },
            { id: 'Bangalore', label: 'Bangalore' },
            { id: 'Chennai', label: 'Chennai' },
            { id: 'Hyderabad', label: 'Hyderabad' },
        ]
    },
    {
        id: 'format',
        label: 'Format',
        options: [
            { id: 'CASSATA', label: 'CASSATA' },
            { id: 'CORE TUB', label: 'CORE TUB' },
            { id: 'CORNETTO', label: 'CORNETTO' },
            { id: 'MAGNUM', label: 'MAGNUM' },
            { id: 'PREMIUM TUB', label: 'PREMIUM TUB' },
        ]
    },
];

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

// ========================================
// MAIN TABLE COMPONENT
// UX: single expand icon column (left) instead of clickable cells
// ========================================
export default function KPIMatrixTable({ data }) {
    const [reportType, setReportType] = useState("platform");
    const [drillDimension, setDrillDimension] = useState("region");
    const [expandedRows, setExpandedRows] = useState([]);

    // ========================================
    // FILTER STATE
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

    // ========================================
    // CHART/DRAWER STATE
    // ========================================
    const [showTrendsDrawer, setShowTrendsDrawer] = useState(false);
    const [selectedCellForTrend, setSelectedCellForTrend] = useState({ entity: null, kpi: null });

    const entities = reportTypes.find((r) => r.key === reportType)?.entities || [];
    const drillItems = drillDownOptions.find((d) => d.key === drillDimension)?.items || [];
    const drillLabel = drillDownOptions.find((d) => d.key === drillDimension)?.label;

    // Drill-down enabled logic: only OSA for competitors, all KPIs for other options
    const isDrillEnabled = (kpiKey) => {
        if (drillDimension === 'competitors') {
            return DRILLDOWN_ENABLED_KPIS.has(kpiKey);
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

    // Demo cell data (replace with API)
    const getCellData = (entityIdx, kpiIdx) => {
        const base = 60 + entityIdx * 5 + kpiIdx * 3;
        const value = Math.min(99, Math.max(10, base + (Math.random() - 0.5) * 30));
        const delta = Math.round((Math.random() - 0.4) * 8);
        return { value: Math.round(value), delta };
    };

    // Demo drill data (replace with API)
    const getDrillData = (entity, kpi, drillItem) => {
        return { value: Math.round(60 + Math.random() * 30), delta: Math.round((Math.random() - 0.4) * 5) };
    };

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
                                const drillEnabled = isDrillEnabled(kpi.key);
                                const isRowExpanded = expandedRows.includes(kpi.key);

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
                                                    <span>{kpi.label}</span>
                                                    {drillEnabled && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] border border-blue-100">
                                                            Drill
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Values */}
                                            {entities.map((entity, eIdx) => {
                                                const cell = getCellData(eIdx, kIdx);
                                                return (
                                                    <td key={entity} className="text-center py-3 px-2">
                                                        <motion.div
                                                            className={cn(
                                                                "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-transparent",
                                                                // subtle hover for readability only (not clickable)
                                                                "hover:bg-slate-50 hover:border-slate-200"
                                                            )}
                                                            whileHover={{ scale: 1.01 }}
                                                        >
                                                            <span className="text-sm font-semibold text-slate-800">{cell.value}%</span>
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
                                                                        {drillItems.map((item) => {
                                                                            const drillData = getDrillData(entity, kpi.key, item);
                                                                            return (
                                                                                <div key={item} className="text-xs">
                                                                                    <span className="text-slate-400">{item.split(" ")[0]}</span>
                                                                                    <span className="ml-1 font-medium text-slate-700">{drillData.value}%</span>
                                                                                </div>
                                                                            );
                                                                        })}
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