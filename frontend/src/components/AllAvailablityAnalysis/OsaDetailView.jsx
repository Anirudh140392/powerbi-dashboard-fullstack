import React, { useMemo, useState, useEffect, useCallback } from "react";
import { SlidersHorizontal, X, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { KpiFilterPanel } from "../KpiFilterPanel";

// Single-file React component (JSX)
// Light theme, paginated (default 5 rows/page), sortable columns.
// Now connected to backend API: /api/availability-analysis/osa-detail-by-category

function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
}

function statusStyles(status) {
    if (status === "Healthy")
        return {
            dot: "bg-emerald-500",
            chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
            rowAccent: "border-l-4 border-emerald-200",
        };
    if (status === "Watch")
        return {
            dot: "bg-amber-500",
            chip: "bg-amber-50 text-amber-800 ring-amber-200",
            rowAccent: "border-l-4 border-amber-200",
        };
    return {
        dot: "bg-rose-500",
        chip: "bg-rose-50 text-rose-700 ring-rose-200",
        rowAccent: "border-l-4 border-rose-200",
    };
}

function cellTone(v) {
    if (v >= 95) return "bg-emerald-50 text-emerald-800";
    if (v >= 85) return "bg-amber-50 text-amber-800";
    return "bg-rose-50 text-rose-700";
}

function SortIcon({ dir }) {
    return (
        <span className="inline-flex items-center ml-1 text-slate-400">
            {dir === "asc" ? "↑" : dir === "desc" ? "↓" : ""}
        </span>
    );
}

export default function OsaDetailTableLight({ filters = {}, onFiltersChange, kpiFilterOptions }) {
    const [query, setQuery] = useState("");
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [page, setPage] = useState(1);

    const [sortKey, setSortKey] = useState("avg31");
    const [sortDir, setSortDir] = useState("desc");

    const [visibleDays, setVisibleDays] = useState(31);
    const [expandedRows, setExpandedRows] = useState(new Set());

    // ----- API data state -----
    const [apiRows, setApiRows] = useState([]);
    const [apiDates, setApiDates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // ----- City drill-down cache -----
    const [cityDataCache, setCityDataCache] = useState({});
    const [cityLoading, setCityLoading] = useState({});

    // ----- Fetch OSA detail data from backend -----
    useEffect(() => {
        const fetchOsaDetail = async () => {
            // If KPI filter is active and 'osa' is not selected, clear data and don't fetch
            if (filters.kpi && Array.isArray(filters.kpi) && filters.kpi.length > 0) {
                const requested = filters.kpi.map(k => k.toLowerCase());
                if (!requested.includes('osa')) {
                    setApiRows([]);
                    setApiDates([]);
                    return;
                }
            }

            setIsLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (filters.platform && filters.platform !== 'All') params.append('platform', filters.platform);
                if (filters.brand && filters.brand !== 'All') params.append('brand', filters.brand);
                if (filters.location && filters.location !== 'All') params.append('location', filters.location);
                if (filters.category && filters.category !== 'All') params.append('category', filters.category);
                if (filters.channel) params.append('channel', filters.channel);
                if (filters.startDate) params.append('startDate', filters.startDate);
                if (filters.endDate) params.append('endDate', filters.endDate);
                if (filters.kpi) params.append('kpis', Array.isArray(filters.kpi) ? filters.kpi.join(',') : filters.kpi);

                const res = await fetch(`/api/availability-analysis/osa-detail-by-category?${params.toString()}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                setApiRows(data.categories || []);
                setApiDates(data.dates || []);
                // Reset pagination and expand state on new data
                setPage(1);
                setExpandedRows(new Set());
                setCityDataCache({});
            } catch (err) {
                console.error('[OsaDetailView] API error:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchOsaDetail();
    }, [filters.platform, filters.brand, filters.location, filters.category, filters.channel, filters.startDate, filters.endDate, filters.kpi]);

    // ----- Fetch city drill-down data -----
    const fetchCityDrilldown = useCallback(async (sku) => {
        if (cityDataCache[sku]) return; // Already cached
        setCityLoading(prev => ({ ...prev, [sku]: true }));
        try {
            const params = new URLSearchParams();
            params.append('sku', sku);
            if (filters.platform && filters.platform !== 'All') params.append('platform', filters.platform);
            if (filters.brand && filters.brand !== 'All') params.append('brand', filters.brand);
            if (filters.channel) params.append('channel', filters.channel);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const res = await fetch(`/api/availability-analysis/osa-city-drilldown?${params.toString()}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            setCityDataCache(prev => ({ ...prev, [sku]: data.cities || [] }));
        } catch (err) {
            console.error(`[OsaDetailView] City drilldown error for ${sku}:`, err);
            setCityDataCache(prev => ({ ...prev, [sku]: [] }));
        } finally {
            setCityLoading(prev => ({ ...prev, [sku]: false }));
        }
    }, [filters, cityDataCache]);

    const toggleRow = (sku) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(sku)) {
                next.delete(sku);
            } else {
                next.add(sku);
                // Trigger city data fetch when expanding
                fetchCityDrilldown(sku);
            }
            return next;
        });
    };

    const [statusFilter, setStatusFilter] = useState([]);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [localFilters, setLocalFilters] = useState(filters);

    // Sync local filters when modal opens
    useEffect(() => {
        if (showFilterPanel) {
            setLocalFilters(filters);
        }
    }, [showFilterPanel, filters]);

    const filterOptions = useMemo(() => {
        // Build base options and filter out unnecessary ones (KPI, Zone)
        const base = kpiFilterOptions
            ? kpiFilterOptions.filter(f => f.id !== 'kpi' && f.id !== 'zones')
            : [
                { id: "platform", label: "Platform", options: [{ id: "blinkit", label: "Blinkit" }, { id: "zepto", label: "Zepto" }, { id: "instamart", label: "Instamart" }] },
                { id: "brand", label: "Brand", options: [] },
                { id: "category", label: "Category", options: [] },
                { id: "location", label: "Location", options: [] },
            ];

        // Add Table-specific filters (Status, SKU)
        return [
            ...base,
            {
                id: "status",
                label: "Status",
                options: [
                    { id: "Healthy", label: "Healthy" },
                    { id: "Watch", label: "Watch" },
                    { id: "Action", label: "Action" }
                ]
            },
            {
                id: "sku",
                label: "SKU / Product",
                options: apiRows.map(r => ({ id: r.sku, label: r.name }))
            }
        ];
    }, [kpiFilterOptions, apiRows]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        // Combine statusFilter (from legend) and localFilters.status (from Advanced Modal)
        const activeStatuses = [...statusFilter];
        if (filters.status && Array.isArray(filters.status)) {
            filters.status.forEach(s => { if (!activeStatuses.includes(s)) activeStatuses.push(s); });
        }

        // Advanced SKU filter
        const selectedSkus = filters.sku && Array.isArray(filters.sku) ? filters.sku : [];

        if (!q && activeStatuses.length === 0 && selectedSkus.length === 0) return apiRows;

        let res = apiRows;

        // Search filter
        if (q) {
            res = res.filter(
                (r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
            );
        }

        // Status filter
        if (activeStatuses.length > 0) {
            res = res.filter((r) => activeStatuses.includes(r.status));
        }

        // SKU filter
        if (selectedSkus.length > 0) {
            res = res.filter((r) => selectedSkus.includes(r.sku));
        }

        return res;
    }, [query, statusFilter, apiRows, filters.status, filters.sku]);

    const sorted = useMemo(() => {
        const dirMul = sortDir === "asc" ? 1 : -1;

        const isDayKey = typeof sortKey === "string" && sortKey.startsWith("day_");
        const dayIndex = isDayKey ? parseInt(sortKey.replace("day_", ""), 10) : null;

        const getVal = (r) => {
            if (dayIndex != null) {
                const idx = clamp(dayIndex, 0, (r.values?.length || 1) - 1);
                return r.values?.[idx] ?? 0;
            }
            return r[sortKey];
        };

        return [...filtered].sort((a, b) => {
            const va = getVal(a);
            const vb = getVal(b);

            if (typeof va === "string" || typeof vb === "string") {
                return String(va).localeCompare(String(vb)) * dirMul;
            }
            return (va - vb) * dirMul;
        });
    }, [filtered, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
    const safePage = clamp(page, 1, totalPages);

    const pageRows = useMemo(() => {
        const start = (safePage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        return sorted.slice(start, end);
    }, [sorted, safePage, rowsPerPage]);

    useEffect(() => {
        if (page !== safePage) setPage(safePage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [safePage]);

    const headerSort = (key) => {
        setPage(1);
        setSortKey((prev) => {
            if (prev === key) {
                setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                return prev;
            }
            setSortDir("desc");
            return key;
        });
    };

    // Use API dates for day columns or fallback
    const totalDays = apiDates.length || 31;
    const effectiveVisibleDays = Math.min(visibleDays, totalDays);
    const dayCols = Array.from({ length: effectiveVisibleDays }, (_, i) => i);

    // Format date for column header
    const formatDateHeader = (dateStr) => {
        if (!dateStr) return `D${dayCols.length}`;
        const d = new Date(dateStr);
        const day = d.getDate();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames[d.getMonth()];
        return `${day} ${month}`;
    };

    // ----- Skeleton / Loading / Error states -----
    if (isLoading && apiRows.length === 0) {
        return (
            <div className="rounded-3xl flex-col bg-slate-50 relative">
                <div className="flex flex-1 overflow-hidden">
                    <div className="flex-1 overflow-auto p-0 pr-0">
                        <div className="rounded-3xl border bg-white p-4 shadow">
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex flex-col gap-0.5">
                                    <div className="text-base font-semibold text-slate-900">OSA % Detail View</div>
                                    <div className="text-xs text-slate-500 font-normal">Loading data...</div>
                                </div>
                            </div>
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                                <span className="ml-3 text-sm text-slate-500">Fetching OSA detail data...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error && apiRows.length === 0) {
        return (
            <div className="rounded-3xl flex-col bg-slate-50 relative">
                <div className="flex flex-1 overflow-hidden">
                    <div className="flex-1 overflow-auto p-0 pr-0">
                        <div className="rounded-3xl border bg-white p-4 shadow">
                            <div className="mb-4 flex flex-col gap-0.5">
                                <div className="text-base font-semibold text-slate-900">OSA % Detail View</div>
                                <div className="text-xs text-rose-500 font-normal">Error loading data: {error}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-3xl flex-col bg-slate-50 relative">
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-auto p-0 pr-0">
                    <div className="rounded-3xl border bg-white p-4 shadow">
                        {/* Title + Legend */}
                        <div className="mb-4 flex items-center justify-between font-bold text-slate-900">
                            <div className="flex flex-col gap-0.5">
                                <div className="text-base font-semibold text-slate-900">
                                    OSA % Detail View
                                </div>
                                <div className="text-xs text-slate-500 font-normal">
                                    {apiDates.length > 0
                                        ? `${apiDates[0]} to ${apiDates[apiDates.length - 1]} • ${apiRows.length} SKUs`
                                        : `Last ${visibleDays} Days`} • Sortable • Paginated
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Filter Button */}
                                <button
                                    onClick={() => setShowFilterPanel(true)}
                                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow transition-all"
                                >
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    <span>Filters</span>
                                </button>

                                {/* Status Legend */}
                                <div className="flex items-center gap-2 ml-2">
                                    {[
                                        { label: "Healthy", color: "emerald", dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
                                        { label: "Watch", color: "amber", dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-100" },
                                        { label: "Action", color: "rose", dot: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100" }
                                    ].map((item) => {
                                        const isActive = statusFilter.includes(item.label);
                                        return (
                                            <button
                                                key={item.label}
                                                onClick={() => {
                                                    setStatusFilter(prev =>
                                                        prev.includes(item.label)
                                                            ? prev.filter(s => s !== item.label)
                                                            : [...prev, item.label]
                                                    );
                                                }}
                                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium border transition-all ${isActive
                                                    ? `${item.bg} ${item.text} ${item.border} ring-2 ring-offset-1 ring-${item.color}-500/20`
                                                    : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                                                    }`}
                                            >
                                                <span className={`h-2 w-2 rounded-full ${isActive ? item.dot : "bg-slate-300"}`} />
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                            <div className="overflow-auto">
                                <table className="min-w-[1200px] w-full border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-10 bg-white">
                                        <tr>
                                            {/* Sticky first column header */}
                                            <th
                                                className="sticky left-0 z-20 bg-slate-50 py-3 pl-4 pr-4 text-left text-[11px] font-bold uppercase tracking-widest text-slate-900 border-b border-slate-200 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)]"
                                                style={{ width: 280, minWidth: 280, maxWidth: 280 }}
                                            >
                                                <div className="flex items-center h-full">PRODUCT / SKU</div>
                                            </th>

                                            <th
                                                className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900 cursor-pointer select-none"
                                                onClick={() => headerSort("avg31")}
                                            >
                                                <div className="flex items-center justify-center gap-1 h-full">
                                                    AVG <SortIcon dir={sortKey === "avg31" ? sortDir : undefined} />
                                                </div>
                                            </th>

                                            <th className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900">
                                                <div className="flex items-center justify-center h-full">STATUS</div>
                                            </th>

                                            {dayCols.map((idx) => {
                                                const dateLabel = apiDates[idx] ? formatDateHeader(apiDates[idx]) : `D${idx + 1}`;
                                                return (
                                                    <th
                                                        key={idx}
                                                        className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900 whitespace-nowrap cursor-pointer select-none"
                                                        onClick={() => headerSort(`day_${idx}`)}
                                                    >
                                                        <div className="flex items-center justify-center gap-1 h-full">
                                                            {dateLabel}
                                                            <SortIcon dir={sortKey === `day_${idx}` ? sortDir : undefined} />
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {pageRows.map((r) => {
                                            const st = statusStyles(r.status);
                                            const avgND = r.avg31 ?? 0;

                                            return (
                                                <React.Fragment key={r.sku}>
                                                    <tr className={"group " + st.rowAccent}>
                                                        <td
                                                            className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-slate-100"
                                                            style={{ width: 280, minWidth: 280, maxWidth: 280 }}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => toggleRow(r.sku)}
                                                                    className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-slate-600"
                                                                >
                                                                    {expandedRows.has(r.sku) ? (
                                                                        <ChevronDown className="h-4 w-4" />
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4" />
                                                                    )}
                                                                </button>
                                                                <div className="flex flex-1 items-center gap-2 overflow-hidden min-w-0">
                                                                    <span
                                                                        className="text-[11px] font-bold text-slate-900 truncate whitespace-nowrap min-w-0"
                                                                        title={`${r.name} (${r.sku})`}
                                                                    >
                                                                        {r.name}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                                                        {r.sku}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="px-3 py-2 border-b border-slate-100 text-[11px] text-slate-900 text-center">
                                                            {avgND}%
                                                        </td>

                                                        <td className="px-3 py-2 border-b border-slate-100">
                                                            <span
                                                                className={
                                                                    "inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 " +
                                                                    st.chip
                                                                }
                                                            >
                                                                <span className={"h-1.5 w-1.5 rounded-full " + st.dot} />
                                                                {r.status}
                                                            </span>
                                                        </td>

                                                        {dayCols.map((idx) => {
                                                            const v = r.values?.[idx] ?? 0;
                                                            return (
                                                                <td
                                                                    key={idx}
                                                                    className="px-2 py-2 border-b border-slate-100 text-center"
                                                                    title={`${r.name} • ${apiDates[idx] || `Day ${idx + 1}`}: ${v}%`}
                                                                >
                                                                    <span
                                                                        className={
                                                                            "inline-flex min-w-[36px] justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 " +
                                                                            cellTone(v)
                                                                        }
                                                                    >
                                                                        {v}%
                                                                    </span>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>

                                                    {/* City drill-down rows */}
                                                    {expandedRows.has(r.sku) && (
                                                        cityLoading[r.sku] ? (
                                                            <tr className="bg-slate-50/50">
                                                                <td
                                                                    colSpan={3 + dayCols.length}
                                                                    className="px-3 py-3 border-b border-slate-100 text-center"
                                                                >
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                                                        <span className="text-[11px] text-slate-500">Loading city data...</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            (cityDataCache[r.sku] || []).map((city) => {
                                                                const cityAvgND = city.avg31 ?? 0;
                                                                return (
                                                                    <tr key={`${r.sku}-${city.name}`} className="bg-slate-50/50">
                                                                        <td
                                                                            className="sticky left-0 z-10 bg-slate-50/50 px-3 py-1.5 border-b border-slate-100 pl-10"
                                                                            style={{ width: 280, minWidth: 280, maxWidth: 280 }}
                                                                        >
                                                                            <div className="text-[11px] font-medium text-slate-600">
                                                                                {city.name}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-1.5 border-b border-slate-100 text-[10px] text-slate-500 text-center">
                                                                            {cityAvgND}%
                                                                        </td>
                                                                        <td className="px-3 py-1.5 border-b border-slate-100 text-center">
                                                                            <span className="text-[10px] text-slate-400">-</span>
                                                                        </td>
                                                                        {dayCols.map((idx) => {
                                                                            const v = city.values?.[idx] ?? 0;
                                                                            return (
                                                                                <td
                                                                                    key={idx}
                                                                                    className="px-2 py-1.5 border-b border-slate-100 text-center"
                                                                                >
                                                                                    <span className="text-[10px] text-slate-500 font-medium">
                                                                                        {v}%
                                                                                    </span>
                                                                                </td>
                                                                            );
                                                                        })}
                                                                    </tr>
                                                                );
                                                            })
                                                        )
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}

                                        {pageRows.length === 0 && (
                                            <tr>
                                                <td colSpan={3 + dayCols.length} className="px-4 py-8 text-center text-[11px] text-slate-500">
                                                    {isLoading ? 'Loading...' : 'No rows found.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="mt-3 flex items-center justify-between text-[11px] px-4 py-3 border-t border-slate-200">
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={safePage === 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-40 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                                    >
                                        Prev
                                    </button>

                                    <span className="text-slate-600">
                                        Page <b className="text-slate-900">{safePage}</b> / {totalPages}
                                    </span>

                                    <button
                                        disabled={safePage >= totalPages}
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-40 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="text-slate-600">
                                        Rows/page
                                        <select
                                            value={rowsPerPage}
                                            onChange={(e) => {
                                                setPage(1);
                                                setRowsPerPage(Number(e.target.value));
                                            }}
                                            className="ml-1 rounded-full border border-slate-200 px-2 py-1 bg-white outline-none focus:border-slate-400 text-slate-700"
                                        >
                                            <option value={5}>5</option>
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* ------------------ KPI FILTER MODAL ------------------ */}
                    {showFilterPanel && (
                        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pb-4 pt-52 pl-40 transition-all backdrop-blur-sm">
                            <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                {/* Modal Header */}
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

                                {/* Panel Content */}
                                <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-0 pb-6">
                                    <KpiFilterPanel
                                        sectionConfig={filterOptions}
                                        sectionValues={localFilters}
                                        onSectionChange={(sectionId, values) => {
                                            setLocalFilters(prev => ({ ...prev, [sectionId]: values }));
                                        }}
                                    />
                                </div>

                                {/* Modal Footer */}
                                <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                                    <button
                                        onClick={() => setShowFilterPanel(false)}
                                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (onFiltersChange) onFiltersChange(localFilters);
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
                </div>
            </div>
        </div>
    );
}
