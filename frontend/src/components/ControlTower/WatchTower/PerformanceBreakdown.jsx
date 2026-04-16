import React, { useState, useEffect, useRef, useCallback, useContext, createContext, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, ChevronDown, ChevronRight, Download, LayoutGrid, Sparkles, Calendar, Info, Filter, X, Check, Target, FolderTree, Plus } from "lucide-react";
import ErrorRetryOverlay from "../../CommonLayout/ErrorRetryOverlay";
import { FilterContext } from "../../../utils/FilterContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const AUTH_TOKEN_KEY = "token";

const ThemeContext = createContext({ darkMode: false });
const FiltersContext = createContext({ filters: { platform: [] } });
const useTheme = () => useContext(ThemeContext);
const useFilters = () => useContext(FiltersContext);

export function PerformanceBreakdownProvider({ darkMode = false, filters = { platform: [] }, children }) {
    return (
        <ThemeContext.Provider value={{ darkMode }}>
            <FiltersContext.Provider value={{ filters }}>{children}</FiltersContext.Provider>
        </ThemeContext.Provider>
    );
}

function getAuthToken() { return typeof window === "undefined" ? null : sessionStorage.getItem(AUTH_TOKEN_KEY); }
function buildUrl(endpoint) {
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) return endpoint;
    const base = API_BASE_URL ? API_BASE_URL : "";
    let path = endpoint.startsWith("/api") ? endpoint : `/api${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
    return `${base}${path}`;
}
function handleUnauthorized() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem("user");
    window.location.hash = "#/login";
}
async function authFetch(endpoint, options = {}) {
    const { skipContentType, skipAuth, ...fetchOptions } = options;
    const url = buildUrl(endpoint);
    const token = getAuthToken();
    const headers = { ...(!skipContentType && { "Content-Type": "application/json" }), ...(!skipAuth && token && { Authorization: `Bearer ${token}` }), ...(fetchOptions.headers || {}) };
    try {
        const response = await fetch(url, { ...fetchOptions, headers });
        if (response.status === 401 && !skipAuth) { handleUnauthorized(); return { success: false, error: "Session expired.", status: 401 }; }
        let data;
        if (response.headers.get("content-type")?.includes("application/json")) data = await response.json();
        return { success: response.ok, data, status: response.status, error: !response.ok ? `HTTP ${response.status}` : undefined };
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return { success: false, error: "Request aborted", status: 0 };
        return { success: false, error: error instanceof Error ? error.message : "Network error", status: 0 };
    }
}
async function authGet(endpoint, options) { return authFetch(endpoint, { ...options, method: "GET" }); }

function getPresetDateRange(key) {
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (key) {
        case "last_week": { const e = new Date(today); e.setDate(e.getDate() - 1); const s = new Date(e); s.setDate(s.getDate() - 6); return { start: s, end: e }; }
        case "last_month": { const e = new Date(today.getFullYear(), today.getMonth(), 0); return { start: new Date(e.getFullYear(), e.getMonth(), 1), end: e }; }
        case "mtd": { const s = new Date(today.getFullYear(), today.getMonth(), 1); const e = new Date(today); e.setDate(e.getDate() - 1); return { start: s, end: e }; }
        case "last_3_months": { const e = new Date(today); e.setDate(e.getDate() - 1); const s = new Date(e); s.setMonth(s.getMonth() - 3); return { start: s, end: e }; }
        case "ytd": { const s = new Date(today.getFullYear(), 0, 1); const e = new Date(today); e.setDate(e.getDate() - 1); return { start: s, end: e }; }
        default: return null;
    }
}
function formatDateRangeShort(range) {
    const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sm = m[range.start.getMonth()], em = m[range.end.getMonth()];
    return range.start.getMonth() === range.end.getMonth() ? `${sm} ${range.start.getDate()}-${range.end.getDate()}` : `${sm} ${range.start.getDate()} - ${em} ${range.end.getDate()}`;
}

const GROUP_DIMENSIONS = [
    { value: "category", label: "Category", icon: "📂" },
    { value: "brand", label: "Brand", icon: "🏷️" },
];
const PRESET_PERIODS = [
    { key: "last_week", label: "Last Week", type: "preset" },
    { key: "last_month", label: "Last Month", type: "preset" },
    { key: "mtd", label: "MTD", type: "preset" },
    { key: "last_3_months", label: "Last 3M", type: "preset" },
    { key: "ytd", label: "YTD", type: "preset" },
];
// For now only show Campaign Type slicer — hide Category, Subcategory and Intent Type
const SLICERS = [
    { key: "campaignTypes", label: "Campaign Type", icon: Target, dimension: "campaign_type" },
];
const PAGE_SIZES = [5, 10, 20, 50];

// MultiSlicerBar
function MultiSlicerBar({ onFiltersChange, className = "" }) {
    const { darkMode } = useTheme();
    const { filters: globalFilters } = useFilters();
    // Only campaignTypes is active for now
    const [filters, setFilters] = useState({ campaignTypes: [] });
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterOptions, setFilterOptions] = useState({ campaignTypes: [] });
    const [loadingOptions, setLoadingOptions] = useState(null);

    const fetchOptions = useCallback(async (dimension) => {
        setLoadingOptions(dimension);
        try {
            const accountId = sessionStorage.getItem("selectedAccountId") || "";
            const companyId = globalFilters.companyId || sessionStorage.getItem("selectedCompanyId") || sessionStorage.getItem("company_id") || "";
            const params = new URLSearchParams();
            if (accountId) params.set("platform_account_id", accountId);
            if (companyId) params.set("company_id", companyId);
            if (globalFilters.platform.length > 0 && !globalFilters.platform.includes("all")) params.set("platform_uuid", globalFilters.platform[0]);
            params.set("dimension", dimension);
            const res = await authGet(`/api/aggregated-view/filter-options?${params.toString()}`);
            if (res.success && res.data?.success) {
                const keyMap = { category: "categories", subcategory: "subcategories", campaign_type: "campaignTypes", intent_type: "intentTypes" };
                const fk = keyMap[dimension];
                if (fk) setFilterOptions((prev) => ({ ...prev, [fk]: res.data.options || [] }));
            }
        } catch (e) { console.error(`Failed to fetch ${dimension} options:`, e); }
        setLoadingOptions(null);
    }, [globalFilters.companyId, globalFilters.platform]);

    useEffect(() => { SLICERS.forEach((s) => fetchOptions(s.dimension)); }, [fetchOptions]);
    useEffect(() => { onFiltersChange(filters); }, [filters, onFiltersChange]);

    const toggleSelection = (filterKey, value) => {
        setFilters((prev) => {
            const current = prev[filterKey];
            return { ...prev, [filterKey]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] };
        });
    };
    const clearAllFilters = () => setFilters({ campaignTypes: [] });
    const activeFilterCount = (filters.campaignTypes || []).length;

    const btnBase = `flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${darkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"}`;
    const btnActive = darkMode ? "bg-violet-500/20 border-violet-500/50 text-violet-400" : "bg-violet-50 border-violet-300 text-violet-700";

    return (
        <div className={className}>
            <div className={`p-3 rounded-xl border ${darkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50/50 border-slate-200"}`}>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className={`p-2 rounded-lg ${darkMode ? "bg-slate-700/50" : "bg-white shadow-sm"}`}>
                        <Filter className={`w-4 h-4 ${darkMode ? "text-slate-400" : "text-slate-500"}`} />
                    </div>
                    {SLICERS.map((slicer) => {
                        const Icon = slicer.icon;
                        const selected = filters[slicer.key] || [];
                        const options = filterOptions[slicer.key] || [];
                        return (
                            <div key={slicer.key} className="relative">
                                <button onClick={() => setActiveDropdown(activeDropdown === slicer.key ? null : slicer.key)} className={`${btnBase} ${selected.length > 0 ? btnActive : ""}`}>
                                    <Icon className="w-4 h-4" />
                                    <span>{selected.length > 0 ? `${slicer.label} (${selected.length})` : slicer.label}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === slicer.key ? "rotate-180" : ""}`} />
                                </button>
                                <AnimatePresence>
                                    {activeDropdown === slicer.key && (
                                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`absolute top-full left-0 mt-2 min-w-[180px] max-w-[280px] max-h-[300px] overflow-y-auto rounded-xl border shadow-xl z-50 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
                                            <div className="p-2">
                                                {loadingOptions === slicer.dimension ? (<div className={`p-4 text-center animate-pulse ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Loading...</div>
                                                ) : options.length === 0 ? (<div className={`p-4 text-center text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>No options available</div>
                                                ) : (options.map((opt) => (
                                                    <button key={opt.value} onClick={() => toggleSelection(slicer.key, opt.value)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${selected.includes(opt.value) ? (darkMode ? "bg-violet-500/20 text-violet-400" : "bg-violet-50 text-violet-700") : (darkMode ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-50 text-slate-700")}`}>
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected.includes(opt.value) ? "bg-violet-500 border-violet-500" : darkMode ? "border-slate-600" : "border-slate-300"}`}>
                                                            {selected.includes(opt.value) && <Check className="w-3 h-3 text-white" />}
                                                        </div>
                                                        <span className="flex-1 truncate">{opt.label}</span>
                                                        {opt.count !== undefined && opt.count > 0 && (<span className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>{opt.count.toLocaleString()}</span>)}
                                                    </button>
                                                )))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                    {activeFilterCount > 0 && (
                        <>
                            <div className={`w-px h-6 ${darkMode ? "bg-slate-700" : "bg-slate-200"}`} />
                            <button onClick={clearAllFilters} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50"}`}>
                                <X className="w-4 h-4" /> Clear ({activeFilterCount})
                            </button>
                        </>
                    )}
                </div>
                {activeFilterCount > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className={`flex flex-wrap gap-2 mt-3 pt-3 border-t ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                        {(filters.campaignTypes || []).map((value) => (
                            <span key={`campaignTypes-${value}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-700"}`}>
                                {value}
                                <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => toggleSelection('campaignTypes', value)} />
                            </span>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    );
}

// PeriodComparisonPanel
function PeriodComparisonPanel({ selectedPeriods, onPeriodsChange, isOpen, onToggle }) {
    const { darkMode } = useTheme();
    const panelRef = useRef(null);
    const [showCustomForm, setShowCustomForm] = useState(false);
    const [customLabel, setCustomLabel] = useState("");
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");

    const { maxDate } = useContext(FilterContext);
    const maxDateStr = useMemo(() => maxDate?.format('YYYY-MM-DD'), [maxDate]);

    useEffect(() => {
        const handleClickOutside = (e) => { if (panelRef.current && !panelRef.current.contains(e.target) && isOpen) onToggle(); };
        if (isOpen) { const t = setTimeout(() => document.addEventListener("mousedown", handleClickOutside), 100); return () => { clearTimeout(t); document.removeEventListener("mousedown", handleClickOutside); }; }
    }, [isOpen, onToggle]);

    const togglePreset = (preset) => {
        const exists = selectedPeriods.find((p) => p.key === preset.key);
        onPeriodsChange(exists ? selectedPeriods.filter((p) => p.key !== preset.key) : [...selectedPeriods, preset]);
    };
    const addCustomPeriod = () => {
        if (!customLabel || !customStartDate || !customEndDate) return;
        onPeriodsChange([...selectedPeriods, { key: `custom_${Date.now()}`, label: customLabel, type: "custom", startDate: customStartDate, endDate: customEndDate }]);
        setCustomLabel(""); setCustomStartDate(""); setCustomEndDate(""); setShowCustomForm(false);
    };
    const removePeriod = (key) => onPeriodsChange(selectedPeriods.filter((p) => p.key !== key));
    const isPresetSelected = (key) => selectedPeriods.some((p) => p.key === key);

    const chipBase = "px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer border";
    const chipSel = darkMode ? "bg-violet-500/30 border-violet-500/50 text-violet-300" : "bg-violet-100 border-violet-300 text-violet-700";
    const chipUn = darkMode ? "bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200";

    return (
        <div className="relative" ref={panelRef}>
            <button onClick={onToggle} className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border transition-all ${isOpen ? (darkMode ? "bg-violet-500/20 border-violet-500/50 text-violet-400" : "bg-violet-50 border-violet-200 text-violet-700") : (darkMode ? "bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100")}`}>
                <Calendar className="w-4 h-4" />
                <span className="text-xs sm:text-sm font-medium">Compare Periods{selectedPeriods.length > 0 && ` (${selectedPeriods.length})`}</span>
                <ChevronDown className={`w-3.5 sm:w-4 h-3.5 sm:h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`fixed inset-x-3 bottom-3 sm:absolute sm:inset-auto sm:right-0 sm:bottom-auto sm:mt-2 w-auto sm:w-[90vw] sm:max-w-[400px] rounded-xl border shadow-2xl z-50 max-h-[80vh] overflow-y-auto ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
                        <div className="p-3 sm:p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className={`text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Select Comparison Periods</h4>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{selectedPeriods.length} selected</span>
                                    <button onClick={onToggle} className={`p-1 rounded-md transition-colors ${darkMode ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}><X className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {PRESET_PERIODS.map((preset) => {
                                    const dr = getPresetDateRange(preset.key);
                                    const dl = dr ? formatDateRangeShort(dr) : "";
                                    return (<button key={preset.key} onClick={() => togglePreset(preset)} className={`${chipBase} ${isPresetSelected(preset.key) ? chipSel : chipUn}`}>
                                        {isPresetSelected(preset.key) && <Check className="w-3 h-3 inline mr-1" />}
                                        <span>{preset.label}</span>
                                        {dl && <span className={`ml-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>({dl})</span>}
                                    </button>);
                                })}
                            </div>
                            <div className={`border-t my-4 ${darkMode ? "border-slate-700" : "border-slate-200"}`} />
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className={`text-xs font-medium uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Custom Periods</span>
                                    <button onClick={() => setShowCustomForm(!showCustomForm)} className={`flex items-center gap-1 text-xs font-medium ${darkMode ? "text-violet-400 hover:text-violet-300" : "text-violet-600 hover:text-violet-700"}`}><Plus className="w-3 h-3" /> Add Custom</button>
                                </div>
                                <div className="space-y-2 mb-3">
                                    {selectedPeriods.filter((p) => p.type === "custom").map((period) => (
                                        <div key={period.key} className={`flex items-center justify-between px-2 sm:px-3 py-2 rounded-lg ${darkMode ? "bg-slate-700/50" : "bg-slate-50"}`}>
                                            <div className="min-w-0 flex-1">
                                                <span className={`text-xs sm:text-sm font-medium ${darkMode ? "text-white" : "text-slate-900"}`}>{period.label}</span>
                                                <span className={`text-[10px] sm:text-xs ml-1 sm:ml-2 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{period.startDate} → {period.endDate}</span>
                                            </div>
                                            <button onClick={() => removePeriod(period.key)} className="text-red-500 hover:text-red-600 p-1"><X className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                    {selectedPeriods.filter((p) => p.type === "custom").length === 0 && !showCustomForm && (<p className={`text-xs italic ${darkMode ? "text-slate-500" : "text-slate-400"}`}>No custom periods added</p>)}
                                </div>
                                <AnimatePresence>
                                    {showCustomForm && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={`p-3 rounded-lg border ${darkMode ? "bg-slate-700/30 border-slate-600" : "bg-slate-50 border-slate-200"}`}>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className={`text-xs font-medium ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Period Name</label>
                                                    <input type="text" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g., Diwali Sale" className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm ${darkMode ? "bg-slate-800 border-slate-600 text-white placeholder-slate-500" : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"}`} />
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                                    <div className="flex-1">
                                                        <label className={`text-[10px] sm:text-xs font-medium ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Start Date</label>
                                                        <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} max={maxDateStr} className={`w-full mt-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border text-xs sm:text-sm ${darkMode ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-slate-200 text-slate-900"}`} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className={`text-[10px] sm:text-xs font-medium ${darkMode ? "text-slate-400" : "text-slate-600"}`}>End Date</label>
                                                        <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} max={maxDateStr} className={`w-full mt-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border text-xs sm:text-sm ${darkMode ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-slate-200 text-slate-900"}`} />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setShowCustomForm(false)} className={`px-3 py-1.5 rounded-lg text-sm ${darkMode ? "text-slate-400 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}>Cancel</button>
                                                    <button onClick={addCustomPeriod} disabled={!customLabel || !customStartDate || !customEndDate} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed">Add Period</button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className={`border-t mt-4 pt-4 flex justify-end ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                                <button onClick={onToggle} className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 transition-colors">Apply</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Demo data
function isDemoMode() { return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1"; }
function getKwalityWallsSample(groupBy) {
    const mkRow = (tag, imp, clk, spends, orders, sales, spendShare) => ({ tag, impressions: imp, clicks: clk, ctr: clk > 0 && imp > 0 ? (clk / imp) * 100 : 0, spend_percent_share: spendShare, spends, cpc: clk > 0 ? spends / clk : 0, orders, cvr: clk > 0 ? (orders / clk) * 100 : 0, sales });
    let data = [];
    if (groupBy === "category") { data = [mkRow("Ice Creams", 8923000, 108120, 3112000, 24110, 13645000, 50.8), mkRow("Frozen Desserts", 5214000, 61340, 1675000, 13280, 7423000, 27.4), mkRow("Kulfi", 4319000, 44860, 1335450, 10820, 5731000, 21.8)]; }
    else if (groupBy === "brand") { data = [mkRow("Kwality Wall's", 10432000, 132800, 3724000, 29240, 16456000, 60.8), mkRow("Cornetto", 4121000, 50320, 1319000, 10450, 6084000, 21.5), mkRow("Magnum", 2734000, 31200, 1070450, 8520, 4159000, 17.7)]; }
    else if (groupBy === "sku") { data = [mkRow("Cornetto Chocolate Cone 120 ml", 3821000, 46820, 1218000, 9640, 5542000, 19.9), mkRow("Magnum Classic 80 ml", 2434000, 27800, 972000, 7610, 3745000, 15.9), mkRow("Kwality Wall's Feast Chocolate Bar 65 ml", 2215000, 25140, 861000, 6840, 3129000, 14.1), mkRow("Kwality Wall's Paddle Pop 70 ml", 1762000, 19400, 612450, 5340, 2484000, 10.0), mkRow("Kwality Wall's Cassatta Slice 100 ml", 1629000, 17160, 545000, 4860, 2158000, 8.9)]; }
    else { data = [mkRow("Ice Creams", 8923000, 108120, 3112000, 24110, 13645000, 50.8), mkRow("Frozen Desserts", 5214000, 61340, 1675000, 13280, 7423000, 27.4), mkRow("Kulfi", 4319000, 44860, 1335450, 10820, 5731000, 21.8)]; }
    const totals = data.reduce((acc, r) => { acc.impressions += r.impressions; acc.clicks += r.clicks; acc.spends += r.spends; acc.orders += r.orders; acc.sales += r.sales; return acc; }, { impressions: 0, clicks: 0, ctr: 0, spend_percent_share: 100, spends: 0, cpc: 0, orders: 0, cvr: 0, sales: 0 });
    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    totals.cpc = totals.clicks > 0 ? totals.spends / totals.clicks : 0;
    totals.cvr = totals.clicks > 0 ? (totals.orders / totals.clicks) * 100 : 0;
    const scale = (rows, factor) => rows.map((r) => ({ tag: r.tag, impressions: Math.max(0, Math.round(r.impressions * factor)), clicks: Math.max(0, Math.round(r.clicks * factor)), spends: Math.max(0, Math.round(r.spends * factor)), sales: Math.max(0, Math.round(r.sales * factor)), orders: Math.max(0, Math.round(r.orders * factor)), ctr: r.ctr, cpc: r.cpc, cvr: r.cvr }));
    return { data, totals, untagged: { count: 0, percent: 0 }, period_comparison: { last_week: scale(data, 0.22), mtd: scale(data, 0.65), last_3_months: scale(data, 1.0) } };
}

function formatPercent(value) { if (value === null || value === undefined || isNaN(value)) return "—"; return `${value.toFixed(2)}%`; }

// Main Component
export function AggregatedViewTable() {
    const { darkMode } = useTheme();
    const { filters } = useFilters();
    const { channels } = useContext(FilterContext);
    const [groupBy, setGroupBy] = useState("category");
    const [localChannel, setLocalChannel] = useState("All");
    const [showDropdown, setShowDropdown] = useState(false);
    const [data, setData] = useState([]);
    const [totals, setTotals] = useState(null);
    const [untagged, setUntagged] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [comparePeriods, setComparePeriods] = useState(false);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [periodComparison, setPeriodComparison] = useState(null);
    const [isPeriodPanelOpen, setIsPeriodPanelOpen] = useState(false);
    const [selectedPeriods, setSelectedPeriods] = useState([
        { key: "last_week", label: "Last Week", type: "preset" },
        { key: "mtd", label: "MTD", type: "preset" },
        { key: "last_3_months", label: "Last 3M", type: "preset" },
    ]);
    const fetchIdRef = useRef(0);
    // slicerFilters removed — filter panel hidden

    useEffect(() => { if (selectedPeriods.length > 0 && !comparePeriods) setComparePeriods(true); else if (selectedPeriods.length === 0 && comparePeriods) setComparePeriods(false); }, [selectedPeriods.length]);

    const currentDimension = GROUP_DIMENSIONS.find((d) => d.value === groupBy) || GROUP_DIMENSIONS[0];
    const totalPages = Math.ceil(data.length / pageSize);
    const paginatedData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    useEffect(() => { if (!comparePeriods) setExpandedRows(new Set()); }, [comparePeriods]);
    const handlePageSizeChange = (newSize) => { setPageSize(newSize); setCurrentPage(1); };
    const toggleRowExpand = (tag) => { const n = new Set(expandedRows); n.has(tag) ? n.delete(tag) : n.add(tag); setExpandedRows(n); };

    const [apiError, setApiError] = useState(null);

    const fetchData = useCallback(async () => {
        const currentFetchId = ++fetchIdRef.current;
        setLoading(true);
        setApiError(null);
        try {
            const accountId = sessionStorage.getItem("selectedAccountId") || "";
            const companyId = sessionStorage.getItem("selectedCompanyId") || sessionStorage.getItem("company_id") || filters.companyId || "";
            const params = new URLSearchParams();
            if (accountId) params.set("platform_account_id", accountId);
            if (companyId) params.set("company_id", companyId);
            if (filters.platform?.length > 0 && !filters.platform.includes("all") && !filters.platform.includes("All")) {
                params.set("platform_uuid", filters.platform.join(","));
            }
            
            // Ensure we handle "Overall" correctly by explicitly managing the channel param.
            // If localChannel is "All", we delete any global channel filter to show total values.
            if (localChannel && localChannel !== "All") {
                params.set("channel", localChannel);
            } else {
                params.delete("channel");
            }
            
            if (filters.category?.length > 0 && !filters.category.includes("All")) params.set("category", filters.category.join(","));
            if (filters.brand && filters.brand !== "All") params.set("brand", Array.isArray(filters.brand) ? filters.brand.join(",") : filters.brand);
            if (filters.location?.length > 0 && !filters.location.includes("All")) params.set("location", filters.location.join(","));

            // Pass the global context dates if they exist
            if (filters.dateStart) params.set("startDate", filters.dateStart);
            if (filters.dateEnd) params.set("endDate", filters.dateEnd);

            params.set("group_by", groupBy);
            // Pass selected period keys so backend can compute comparison data
            if (selectedPeriods.length > 0) {
                const periodParams = selectedPeriods.map(p => {
                    if (p.type === 'custom' && p.startDate && p.endDate) {
                        return `${p.key}:${p.startDate}:${p.endDate}`;
                    }
                    return p.key;
                });
                params.set("compare_periods", periodParams.join(","));
            }
            const res = await authGet(`/api/watchtower/performance-breakdown?${params.toString()}`);

            // Race condition check
            if (currentFetchId !== fetchIdRef.current) return;

            const result = res.data;
            if (res.success && result?.success && result.data?.length > 0) {
                setData(result.data);

                // Dynamically calculate totals strictly based on the fetched row data
                const calcTotals = result.data.reduce((acc, row) => {
                    acc.impressions += (parseFloat(row.impressions) || 0);
                    acc.clicks += (parseFloat(row.clicks) || 0);
                    acc.spends += (parseFloat(row.spends) || 0);
                    acc.orders += (parseFloat(row.orders) || 0);
                    acc.sales += (parseFloat(row.sales) || 0);
                    return acc;
                }, { impressions: 0, clicks: 0, spends: 0, orders: 0, sales: 0 });

                calcTotals.ctr = calcTotals.impressions > 0 ? (calcTotals.clicks / calcTotals.impressions) * 100 : 0;
                calcTotals.cpc = calcTotals.clicks > 0 ? (calcTotals.spends / calcTotals.clicks) : 0;
                calcTotals.cvr = calcTotals.clicks > 0 ? (calcTotals.orders / calcTotals.clicks) * 100 : 0;

                setTotals(calcTotals);
                setUntagged(result.untagged || null);
                setPeriodComparison(result.period_comparison || null);
            } else {
                // No data returned — show empty state gracefully instead of erroring
                setData([]);
                setTotals(null);
                setUntagged(null);
                setPeriodComparison(null);
            }
        } catch (e) {
            if (currentFetchId === fetchIdRef.current) {
                console.error("Failed to fetch performance breakdown:", e);
                setApiError(e.message || "Failed to load Performance Breakdown data");
            }
        } finally {
            if (currentFetchId === fetchIdRef.current) {
                setLoading(false);
            }
        }
    }, [groupBy, filters, selectedPeriods, localChannel]);
    // DO NOT ADD fetchOptions or objects to dependencies that change on render

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatNumber = (num) => { if (num === null || num === undefined) return "—"; if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`; if (num >= 100000) return `${(num / 100000).toFixed(2)} Lac`; if (num >= 1000) return `${(num / 1000).toFixed(1)} K`; return num.toLocaleString("en-IN"); };
    const formatCurrency = (num) => (num === null || num === undefined ? "—" : `₹${formatNumber(num)}`);
    const getPeriodData = (tag, periodKey) => { if (!periodComparison || !periodComparison[periodKey]) return null; return periodComparison[periodKey].find((d) => d.tag === tag) || null; };
    const thCls = (dm) => `px-2 py-3 text-right text-xs font-semibold uppercase tracking-wider ${dm ? "text-slate-400" : "text-slate-500"}`;

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border overflow-hidden ${darkMode ? "bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 border-slate-700" : "bg-white border-slate-200 shadow-xl shadow-slate-200/50"}`}>
            {/* MultiSlicerBar removed per request — filters hidden */}
            {/* Header */}
            <div className={`px-3 py-3 sm:p-5 border-b ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${darkMode ? "bg-gradient-to-br from-violet-500/20 to-purple-500/20" : "bg-gradient-to-br from-violet-50 to-purple-50"}`}>
                            <Layers className={`w-5 h-5 ${darkMode ? "text-violet-400" : "text-violet-600"}`} />
                        </div>
                        <div>
                            <h3 className={`text-base sm:text-lg font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Performance Breakdown</h3>
                            <p className={`text-xs sm:text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Analyze by dimensions</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {/* Channel Dropdown */}
                        <div className="relative flex items-center">
                            <select
                                value={localChannel || 'All'}
                                onChange={(e) => setLocalChannel(e.target.value)}
                                className={`appearance-none border py-1.5 pl-3 pr-8 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-xs shadow-sm cursor-pointer transition-all ${darkMode ? "bg-slate-700/50 border-slate-600 text-blue-400 hover:bg-slate-700" : "bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100/50"}`}
                                style={{ fontFamily: 'Roboto, sans-serif' }}
                            >
                                <option value="All">All Channels</option>
                                {channels?.filter(c => c !== 'All').map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={14} />
                        </div>

                        <PeriodComparisonPanel selectedPeriods={selectedPeriods} onPeriodsChange={setSelectedPeriods} isOpen={isPeriodPanelOpen} onToggle={() => setIsPeriodPanelOpen(!isPeriodPanelOpen)} />
                        {untagged && untagged.percent > 0 && (<div className={`px-3 py-1.5 rounded-full text-xs font-medium ${darkMode ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-700"}`}>{untagged.percent.toFixed(1)}% untagged</div>)}
                        <div className="relative">
                            <button onClick={() => setShowDropdown(!showDropdown)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${darkMode ? "bg-slate-700/50 border-slate-600 hover:bg-slate-700 text-white" : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-900"}`}>
                                <span className="text-lg">{currentDimension.icon}</span>
                                <span className="text-sm font-medium">{currentDimension.label}</span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
                            </button>
                            <AnimatePresence>
                                {showDropdown && (
                                    <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} className={`absolute right-0 mt-2 w-[80vw] max-w-[14rem] rounded-xl border shadow-xl z-50 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
                                        <div className="p-2">
                                            {GROUP_DIMENSIONS.map((dim) => (
                                                <button key={dim.value} onClick={() => { setGroupBy(dim.value); setShowDropdown(false); setCurrentPage(1); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${groupBy === dim.value ? (darkMode ? "bg-violet-500/20 text-violet-400" : "bg-violet-50 text-violet-700") : (darkMode ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-50 text-slate-700")}`}>
                                                    <span className="text-lg">{dim.icon}</span>
                                                    <span className="text-sm font-medium">{dim.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <button onClick={() => {
                            // CSV Download
                            const headers = [currentDimension.label, "Impressions", "Clicks", "CTR", "% Spends", "Spends", "CPC", "Orders", "CVR", "Ad Sales"];
                            const csvRows = [headers.join(",")];
                            data.forEach(row => {
                                csvRows.push([
                                    `"${row.tag || ''}"`, row.impressions, row.clicks, `${(row.ctr || 0).toFixed(2)}%`,
                                    `${(row.spend_percent_share || 0).toFixed(1)}%`, row.spends, (row.cpc || 0).toFixed(2),
                                    row.orders, `${(row.cvr || 0).toFixed(2)}%`, row.sales
                                ].join(","));
                            });
                            const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = `performance_breakdown_${groupBy}_${new Date().toISOString().split('T')[0]}.csv`;
                            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                        }} className={`p-2 rounded-lg border transition-colors ${darkMode ? "border-slate-700 hover:bg-slate-700 text-slate-400" : "border-slate-200 hover:bg-slate-50 text-slate-500"}`}><Download className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
            {/* Table */}
            <div className="w-full overflow-x-auto">
                <table className="w-full table-fixed" style={{ minWidth: '900px' }}>
                    <colgroup><col className="w-[22%]" /><col className="w-[10%]" /><col className="w-[9%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[11%]" /><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[8%]" /><col className="w-[6%]" /></colgroup>
                    <thead>
                        <tr className={darkMode ? "bg-slate-800/50" : "bg-slate-50/50"}>
                            <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{currentDimension.label}</th>
                            {["Impressions", "Clicks", "CTR", "% Spends", "Spends", "CPC", "Orders", "CVR", "Ad Sales"].map((h) => (<th key={h} className={thCls(darkMode)}>{h}</th>))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {totals && (
                            <tr className={darkMode ? "bg-gradient-to-r from-violet-500/10 to-purple-500/10" : "bg-gradient-to-r from-violet-50/50 to-purple-50/50"}>
                                <td className={`px-4 py-3 font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}><div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" />Total</div></td>
                                <td className={`px-2 py-3 text-right text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{formatNumber(totals.impressions)}</td>
                                <td className={`px-2 py-3 text-right text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{formatNumber(totals.clicks)}</td>
                                <td className={`px-2 py-3 text-right text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{formatPercent(totals.ctr)}</td>
                                <td className="px-2 py-3 text-right text-sm text-slate-400">—</td>
                                <td className={`px-2 py-3 text-right text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{formatCurrency(totals.spends)}</td>
                                <td className={`px-2 py-3 text-right text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{formatCurrency(totals.cpc)}</td>
                                <td className={`px-2 py-3 text-right text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{formatNumber(totals.orders)}</td>
                                <td className={`px-2 py-3 text-right text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{formatPercent(totals.cvr)}</td>
                                <td className={`px-2 py-3 text-right text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{formatCurrency(totals.sales)}</td>
                            </tr>
                        )}
                        {loading ? (
                            [...Array(5)].map((_, i) => (<tr key={i}><td colSpan={10} className="px-4 py-3"><div className={`h-8 rounded-lg animate-pulse ${darkMode ? "bg-slate-700" : "bg-slate-100"}`} /></td></tr>))
                        ) : apiError ? (
                            <tr><td colSpan={10}><ErrorRetryOverlay onRetry={fetchData} message={apiError} /></td></tr>
                        ) : data.length === 0 ? (
                            <tr><td colSpan={10} className="px-4 py-12 text-center"><LayoutGrid className={`w-12 h-12 mx-auto mb-3 ${darkMode ? "text-slate-600" : "text-slate-300"}`} /><p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>No data available</p></td></tr>
                        ) : (
                            paginatedData.map((row, idx) => (
                                <React.Fragment key={row.tag || idx}>
                                    <motion.tr initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }} className={`transition-colors cursor-pointer ${darkMode ? "hover:bg-slate-700/30" : "hover:bg-slate-50"}`} onClick={() => comparePeriods && toggleRowExpand(row.tag)}>
                                        <td className={`px-4 py-3 ${darkMode ? "text-white" : "text-slate-900"}`}>
                                            <div className="flex items-center gap-2">
                                                {comparePeriods && (<motion.div animate={{ rotate: expandedRows.has(row.tag) ? 90 : 0 }} className="flex-shrink-0"><ChevronRight className="w-4 h-4 text-slate-400" /></motion.div>)}
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${idx === 0 ? "bg-emerald-500" : idx === 1 ? "bg-blue-500" : idx === 2 ? "bg-violet-500" : "bg-slate-400"}`} />
                                                <span className="font-medium text-sm truncate" title={row.tag}>{row.tag}</span>
                                            </div>
                                        </td>
                                        {[formatNumber(row.impressions), formatNumber(row.clicks), formatPercent(row.ctr), `${row.spend_percent_share.toFixed(1)}%`, formatCurrency(row.spends), formatCurrency(row.cpc), formatNumber(row.orders), formatPercent(row.cvr), formatCurrency(row.sales)].map((val, ci) => (
                                            <td key={ci} className={`px-2 py-3 text-right text-sm ${ci === 3 ? (darkMode ? "text-slate-400" : "text-slate-500") : (darkMode ? "text-slate-200" : "text-slate-700")}`}>{val}</td>
                                        ))}
                                    </motion.tr>
                                    <AnimatePresence>
                                        {comparePeriods && expandedRows.has(row.tag) && selectedPeriods.length > 0 && selectedPeriods.map((period) => {
                                            const pd = getPeriodData(row.tag, period.key);
                                            return (
                                                <motion.tr key={`${row.tag}-${period.key}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={darkMode ? "bg-slate-900/50" : "bg-slate-50/50"}>
                                                    <td className={`px-4 py-2 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                                                        <div className="flex items-center gap-2 pl-6">
                                                            <Calendar className="w-3 h-3" /><span className="text-sm">{period.label}</span>
                                                            {period.type === "preset" && (() => { const r = getPresetDateRange(period.key); return r ? (<div className="relative group"><Info className={`w-3 h-3 cursor-help ${darkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`} /><div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none ${darkMode ? "bg-slate-700 text-white" : "bg-slate-900 text-white"}`}>{formatDateRangeShort(r)}</div></div>) : null; })()}
                                                        </div>
                                                    </td>
                                                    {[pd ? formatNumber(pd.impressions) : "—", pd ? formatNumber(pd.clicks) : "—", pd?.ctr ? formatPercent(pd.ctr) : "—", "—", pd ? formatCurrency(pd.spends) : "—", pd?.cpc ? formatCurrency(pd.cpc) : "—", pd ? formatNumber(pd.orders) : "—", pd?.cvr ? formatPercent(pd.cvr) : "—"].map((v, i) => (
                                                        <td key={i} className={`px-2 py-2 text-right text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{v}</td>
                                                    ))}
                                                    <td className={`px-2 py-2 text-right text-sm ${darkMode ? "text-emerald-400" : "text-emerald-600"}`}>{pd ? formatCurrency(pd.sales) : "—"}</td>
                                                </motion.tr>
                                            );
                                        })}
                                    </AnimatePresence>
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {/* Pagination */}
            {data.length > 0 && (
                <div className={`px-3 py-3 sm:px-5 sm:py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                        <span className={`text-xs sm:text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, data.length)} of {data.length}</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Rows:</span>
                            <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))} className={`px-2 py-1 rounded-lg border text-sm ${darkMode ? "bg-slate-700 border-slate-600 text-white" : "bg-white border-slate-200 text-slate-700"}`}>
                                {PAGE_SIZES.map((s) => (<option key={s} value={s}>{s}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
                        {["First", "Prev", "Next", "Last"].map((label) => {
                            const isFirst = label === "First" || label === "Prev";
                            const disabled = isFirst ? currentPage === 1 : currentPage >= totalPages;
                            const onClick = label === "First" ? () => setCurrentPage(1) : label === "Prev" ? () => setCurrentPage((p) => Math.max(1, p - 1)) : label === "Next" ? () => setCurrentPage((p) => Math.min(totalPages, p + 1)) : () => setCurrentPage(totalPages);
                            return (<button key={label} onClick={onClick} disabled={disabled} className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${darkMode ? "bg-slate-700 hover:bg-slate-600 text-white disabled:hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:hover:bg-slate-100"}`}>{label}</button>);
                        })}
                        <span className={`px-3 py-1.5 text-sm font-medium ${darkMode ? "text-white" : "text-slate-700"}`}>{currentPage} / {totalPages || 1}</span>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

export default AggregatedViewTable;
