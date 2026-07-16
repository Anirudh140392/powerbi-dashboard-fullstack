import React, { useMemo, useState, useEffect } from "react";
import { SlidersHorizontal, X, ChevronRight, ChevronDown, Calendar, Layers, Clock } from "lucide-react";
import { KpiFilterPanel } from "../KpiFilterPanel";

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function statusStyles(status) {
    if (status === "Healthy") return { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", rowAccent: "border-l-4 border-emerald-200" };
    if (status === "Watch") return { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800 ring-amber-200", rowAccent: "border-l-4 border-amber-200" };
    return { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 ring-rose-200", rowAccent: "border-l-4 border-rose-200" };
}

function cellTone(v) {
    if (v >= 85) return "bg-emerald-50 text-emerald-800";
    if (v >= 70) return "bg-amber-50 text-amber-800";
    return "bg-rose-50 text-rose-800";
}

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function fmtDate(ds) {
    const d = new Date(ds);
    return `${String(d.getDate()).padStart(2, '0')}-${MONTHS_SHORT[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}
function monthKey(ds) {
    const d = new Date(ds);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(ds) {
    const d = new Date(ds);
    return `${MONTHS_SHORT[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

function avgOf(values, indices) {
    if (!indices?.length) return null;
    // Filter out null/undefined (no data) but KEEP 0 (legitimate zero OSA)
    const vals = indices.map(i => values?.[i]).filter(v => v !== null && v !== undefined);
    if (!vals.length) return null;
    return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
}

/** Build month groups from sorted date strings */
function buildMonthGroups(dates) {
    if (!dates?.length) return [];
    const groups = [];
    let current = null;
    dates.forEach((ds, idx) => {
        const mk = monthKey(ds);
        if (!current || current.key !== mk) {
            current = { key: mk, label: monthLabel(ds), indices: [], dates: [] };
            groups.push(current);
        }
        current.indices.push(idx);
        current.dates.push(ds);
    });
    return groups;
}

export default function OsaDetailTableLight({ 
    apiData, 
    loading, 
    mslFilter, 
    onMslChange,
    resellerFilter,
    onResellerChange
}) {
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState("avgSelected");
    const [sortDir, setSortDir] = useState("desc");
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [expandedMonths, setExpandedMonths] = useState(new Set()); // which months are drilled-down
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState({});
    const [tempMslFilter, setTempMslFilter] = useState(mslFilter || '0');
    const [searchSkuTerm, setSearchSkuTerm] = useState("");
    const [resellerOptions, setResellerOptions] = useState([]);

    const isDrlClient = useMemo(() => {
        try {
            const u = JSON.parse(sessionStorage.getItem('user'));
            return u?.dbName?.toLowerCase() === 'drl';
        } catch {
            return false;
        }
    }, []);

    const filtersDepKey = JSON.stringify([
        advancedFilters.platform,
        advancedFilters.brand,
        advancedFilters.format,
        advancedFilters.city
    ]);

    useEffect(() => {
        if (!isDrlClient) return;
        
        const fetchResellerOptions = async () => {
            try {
                const token = sessionStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                
                const queryParams = new URLSearchParams();
                queryParams.append('filterType', 'resellerNames');
                
                if (advancedFilters.platform?.length) {
                    advancedFilters.platform.forEach(p => queryParams.append('platform', p));
                }
                if (advancedFilters.brand?.length) {
                    advancedFilters.brand.forEach(b => queryParams.append('brand', b));
                }
                if (advancedFilters.format?.length) {
                    advancedFilters.format.forEach(c => queryParams.append('category', c));
                }
                if (advancedFilters.city?.length) {
                    advancedFilters.city.forEach(ct => queryParams.append('city', ct));
                }

                const res = await fetch(`/api/availability-analysis/filter-options?${queryParams.toString()}`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.options) {
                        setResellerOptions(data.options);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch reseller options:", err);
            }
        };
        fetchResellerOptions();
    }, [isDrlClient, filtersDepKey]);

    useEffect(() => {
        if (resellerFilter) {
            setAdvancedFilters(prev => ({
                ...prev,
                resellerName: resellerFilter
            }));
        }
    }, [resellerFilter]);

    useEffect(() => {
        setTempMslFilter(mslFilter || '0');
    }, [mslFilter]);

    const toggleRow = (sku) => setExpandedRows(p => { const n = new Set(p); n.has(sku) ? n.delete(sku) : n.add(sku); return n; });
    const toggleMonth = (mk) => setExpandedMonths(p => { const n = new Set(p); n.has(mk) ? n.delete(mk) : n.add(mk); return n; });

    const handleSectionChange = (id, vals) => {
        if (id === 'msl') {
            const selectedMsl = vals?.length > 0 ? vals[vals.length - 1] : '0';
            setTempMslFilter(selectedMsl);
            return;
        }
        setAdvancedFilters(p => ({ ...p, [id]: vals }));
    };
    const handleApplyFilters = () => {
        setPage(1);
        setShowFilterPanel(false);
        if (onMslChange) {
            onMslChange(tempMslFilter);
        }
        if (onResellerChange) {
            onResellerChange(advancedFilters.resellerName || []);
        }
    };

    const dates = useMemo(() => apiData?.osaDates || [], [apiData]);
    const monthGroups = useMemo(() => buildMonthGroups(dates), [dates]);

    // Month drill-downs are closed by default (expandedMonths is initialized as an empty Set)

    // Build flat column list based on expansion state
    const columns = useMemo(() => {
        const cols = [];
        monthGroups.forEach(mg => {
            if (expandedMonths.has(mg.key)) {
                // Expanded: show each day
                mg.indices.forEach((idx, i) => {
                    cols.push({ type: 'day', label: fmtDate(mg.dates[i]), indices: [idx], monthKey: mg.key });
                });
            } else {
                // Collapsed: show single month aggregate
                cols.push({ type: 'month', label: mg.label, indices: mg.indices, monthKey: mg.key });
            }
        });
        return cols;
    }, [monthGroups, expandedMonths]);

    const filterOptions = useMemo(() => {
        if (!apiData?.osaDetail) return [];
        const mk = arr => arr.map(p => ({ id: p, label: p }));
        const opts = [
            { id: "msl", label: "MSL", options: [
                { id: "0", label: "All SKUs" },
                { id: "1", label: "Top SKUs" }
            ] },
            { id: "platform", label: "Platform", options: mk([...new Set(apiData.osaDetail.map(r => r.platform).filter(Boolean))]) },
            { id: "brand", label: "Brand", options: mk([...new Set(apiData.osaDetail.map(r => r.brand).filter(Boolean))]) },
            { id: "productName", label: "Product Name", options: mk([...new Set(apiData.osaDetail.map(r => r.name).filter(Boolean))]) },
            { id: "format", label: "Category", options: mk([...new Set(apiData.osaDetail.map(r => r.format).filter(Boolean))]) },
            { id: "city", label: "City", options: mk([...new Set(apiData.osaDetail.flatMap(r => r.cities?.map(c => c.name) || []).filter(Boolean))]) },
        ];
        if (isDrlClient && resellerOptions.length > 0) {
            opts.push({ id: "resellerName", label: "Reseller", options: mk(resellerOptions) });
        }
        return opts;
    }, [apiData, isDrlClient, resellerOptions]);

    const baseRows = useMemo(() => {
        if (!apiData?.osaDetail?.length) return [];
        return apiData.osaDetail.map(row => ({
            name: row.name || row.productName || "Unknown Product",
            sku: row.sku || "N/A", brand: row.brand, platform: row.platform, format: row.format,
            imageUrl: row.imageUrl,
            values: row.values || [], avg7: row.avg7 || 0, avg31: row.avg31 || 0,
            avgSelected: row.avgSelected || row.avg31 || 0, status: row.status || "Healthy", cities: row.cities || []
        }));
    }, [apiData]);

    const filtered = useMemo(() => {
        let res = baseRows;

        if (searchSkuTerm.trim()) {
            const q = searchSkuTerm.toLowerCase().trim();
            res = res.filter(r => 
                r.name.toLowerCase().includes(q) || 
                r.sku.toLowerCase().includes(q)
            );
        }

        Object.entries(advancedFilters).forEach(([key, values]) => {
            if (!values?.length) return;
            if (key === 'platform') res = res.filter(r => values.includes(r.platform));
            else if (key === 'brand') res = res.filter(r => values.includes(r.brand));
            else if (key === 'productName') res = res.filter(r => values.includes(r.name));
            else if (key === 'format') res = res.filter(r => values.includes(r.format));
            else if (key === 'city') {
                res = res.filter(r => r.cities?.some(c => values.includes(c.name)));
                res = res.map(r => ({ ...r, cities: r.cities.filter(c => values.includes(c.name)) }));
            }
        });
        return res;
    }, [baseRows, advancedFilters, searchSkuTerm]);

    const sorted = useMemo(() => {
        const mul = sortDir === "asc" ? 1 : -1;
        const isCol = typeof sortKey === "string" && sortKey.startsWith("col_");
        const ci = isCol ? parseInt(sortKey.split("_")[1], 10) : null;
        return [...filtered].sort((a, b) => {
            const va = ci !== null ? avgOf(a.values, columns[ci]?.indices) : a[sortKey];
            const vb = ci !== null ? avgOf(b.values, columns[ci]?.indices) : b[sortKey];
            return typeof va === "string" ? String(va).localeCompare(String(vb)) * mul : (va - vb) * mul;
        });
    }, [filtered, sortKey, sortDir, columns]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
    const safePage = clamp(page, 1, totalPages);
    const pageRows = useMemo(() => sorted.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage), [sorted, safePage, rowsPerPage]);
    useEffect(() => { if (page !== safePage) setPage(safePage); }, [safePage]);

    const headerSort = (key) => {
        setPage(1);
        setSortKey(p => { if (p === key) { setSortDir(d => d === "asc" ? "desc" : "asc"); return p; } setSortDir("desc"); return key; });
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading OSA Detail...</div>;

    // Count visible columns per month for colSpan
    const monthColSpans = useMemo(() => {
        const spans = {};
        monthGroups.forEach(mg => {
            spans[mg.key] = expandedMonths.has(mg.key) ? mg.indices.length : 1;
        });
        return spans;
    }, [monthGroups, expandedMonths]);

    return (
        <div className="rounded-3xl flex-col bg-slate-50 relative">
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-auto p-0">
                    <div className="rounded-3xl border bg-white p-4 shadow">
                        {/* Header */}
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                                    <Layers className="h-5 w-5 text-slate-500" strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="text-base font-semibold text-slate-900">OSA % Detail View</div>
                                    <div className="text-xs text-slate-500 font-normal">Click month headers to expand/collapse daily drill-down</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="Search product / SKU..."
                                    value={searchSkuTerm}
                                    onChange={(e) => {
                                        setSearchSkuTerm(e.target.value);
                                        setPage(1);
                                    }}
                                    className="h-8 w-60 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                />
                                <button onClick={() => setShowFilterPanel(true)} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 h-8 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                                    <SlidersHorizontal className="h-3.5 w-3.5" /><span>Filters</span>
                                </button>
                                <div className="flex items-center gap-2 ml-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-100"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Healthy</span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700 border border-amber-100"><span className="h-2 w-2 rounded-full bg-amber-500" /> Watch</span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-700 border border-rose-100"><span className="h-2 w-2 rounded-full bg-rose-500" /> Action</span>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                            <div className="overflow-auto">
                                <table className="min-w-[1200px] w-full border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-10">
                                        {/* Row 1: Month group headers */}
                                        <tr>
                                            <th className="sticky left-0 z-20 bg-slate-100 py-2.5 pl-4 pr-4 border-b border-slate-200" style={{ minWidth: 280 }} rowSpan={2}>
                                                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-800">Product / SKU</div>
                                            </th>
                                            <th className="bg-slate-100 py-2.5 px-3 border-b border-slate-200 text-center" rowSpan={2}>
                                                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-800">OSA</div>
                                            </th>
                                            <th className="bg-slate-100 py-2.5 px-3 border-b border-slate-200 text-center" rowSpan={2}>
                                                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-800">STATUS</div>
                                            </th>
                                            {monthGroups.map(mg => (
                                                <th key={mg.key}
                                                    colSpan={monthColSpans[mg.key]}
                                                    className="bg-slate-100 py-2.5 px-3 text-center border-b border-slate-200 border-l border-slate-200 cursor-pointer select-none hover:bg-slate-200/60 transition-colors"
                                                    onClick={() => toggleMonth(mg.key)}
                                                >
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <Clock className="h-3 w-3 text-slate-400" />
                                                        <span className="text-[11px] font-bold text-slate-700 tracking-wide">{mg.label}</span>
                                                        {expandedMonths.has(mg.key)
                                                            ? <ChevronDown className="h-3 w-3 text-slate-400" />
                                                            : <ChevronRight className="h-3 w-3 text-slate-400" />
                                                        }
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                        {/* Row 2: Day-level columns (only for expanded months) */}
                                        <tr>
                                            {columns.map((col, ci) => (
                                                col.type === 'day' ? (
                                                    <th key={ci}
                                                        className="bg-slate-50 py-2 px-1.5 text-center border-b border-slate-200 border-l border-slate-100 cursor-pointer select-none whitespace-nowrap"
                                                        onClick={() => headerSort(`col_${ci}`)}
                                                    >
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Calendar className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" />
                                                            <span className="text-[9px] font-semibold text-slate-600">{col.label}</span>
                                                        </div>
                                                    </th>
                                                ) : (
                                                    /* Collapsed month — no sub-header needed, but we need a placeholder */
                                                    <th key={ci} className="bg-slate-50 py-2 px-2 text-center border-b border-slate-200 border-l border-slate-100 cursor-pointer select-none" onClick={() => headerSort(`col_${ci}`)}>
                                                        <div className="text-[9px] font-semibold text-slate-500">AVG</div>
                                                    </th>
                                                )
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageRows.map(r => {
                                            const st = statusStyles(r.status);
                                            return (
                                                <React.Fragment key={r.sku}>
                                                    <tr className={"group " + st.rowAccent}>
                                                        <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-slate-100" style={{ minWidth: 280 }}>
                                                            <div className="flex items-start gap-2 pt-1">
                                                                <button onClick={() => toggleRow(r.sku)} className="mt-0.5 p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-slate-600">
                                                                    {expandedRows.has(r.sku) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                </button>
                                                                
                                                                {r.imageUrl && (
                                                                    <div className="shrink-0 pt-0.5">
                                                                        <img 
                                                                            src={r.imageUrl} 
                                                                            alt={r.name} 
                                                                            className="w-8 h-8 object-contain rounded bg-white shadow-sm border border-slate-100"
                                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                                        />
                                                                    </div>
                                                                )}

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-bold text-slate-900 leading-4 text-xs">{r.name}</div>
                                                                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight mt-1">{r.platform}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 border-b border-slate-100 text-[11px] text-slate-900 text-center font-semibold">{r.avgSelected === null || r.avgSelected === undefined || r.avgSelected === '-' ? 'N/A' : `${r.avgSelected}%`}</td>
                                                        <td className="px-3 py-2 border-b border-slate-100">
                                                            <span className={"inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 " + st.chip}>
                                                                <span className={"h-1.5 w-1.5 rounded-full " + st.dot} />{r.status}
                                                            </span>
                                                        </td>
                                                        {columns.map((col, ci) => {
                                                            const v = avgOf(r.values, col.indices);
                                                            return (
                                                                <td key={ci} className="px-1.5 py-2 border-b border-slate-100 text-center" title={`${r.name} • ${col.label}: ${v === null ? 'N/A' : `${v}%`}`}>
                                                                    <span className={"inline-flex min-w-[36px] justify-center rounded-md px-1 py-0.5 text-[10px] font-semibold " + (v === null || v === undefined ? "bg-slate-50 text-slate-400" : cellTone(v))}>
                                                                        {v === null || v === undefined ? 'N/A' : `${v}%`}
                                                                    </span>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                    {/* Drill-down: location rows */}
                                                    {expandedRows.has(r.sku) && (r.cities || []).map(city => (
                                                        <tr key={`${r.sku}-${city.name}`} className="bg-slate-50/50">
                                                            <td className="sticky left-0 z-10 bg-slate-50/50 px-3 py-1.5 border-b border-slate-100 pl-10" style={{ minWidth: 280 }}>
                                                                <div className="text-[11px] font-medium text-slate-600">{city.name}</div>
                                                            </td>
                                                            <td className="px-3 py-1.5 border-b border-slate-100 text-[10px] text-slate-500 text-center">{city.avgSelected ?? city.avg31}%</td>
                                                            <td className="px-3 py-1.5 border-b border-slate-100 text-center"><span className="text-[10px] text-slate-400">—</span></td>
                                                            {columns.map((col, ci) => {
                                                                    const v = avgOf(city.values, col.indices);
                                                                    return (
                                                                        <td key={ci} className="px-1.5 py-1.5 border-b border-slate-100 text-center">
                                                                            <span className="text-[10px] text-slate-500 font-medium">{v === null || v === undefined ? 'N/A' : `${v}%`}</span>
                                                                        </td>
                                                                    );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                        {pageRows.length === 0 && (
                                            <tr><td colSpan={3 + columns.length} className="px-4 py-8 text-center text-[11px] text-slate-500">No rows found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {/* Pagination */}
                            <div className="mt-3 flex items-center justify-between text-[11px] px-4 py-3 border-t border-slate-200">
                                <div className="flex items-center gap-2">
                                    <button disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-40 bg-white hover:bg-slate-50 text-slate-700">Prev</button>
                                    <span className="text-slate-600">Page <b className="text-slate-900">{safePage}</b> / {totalPages}</span>
                                    <button disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-40 bg-white hover:bg-slate-50 text-slate-700">Next</button>
                                </div>
                                <div className="text-slate-600">
                                    Rows/page
                                    <select value={rowsPerPage} onChange={e => { setPage(1); setRowsPerPage(+e.target.value); }} className="ml-1 rounded-full border border-slate-200 px-2 py-1 bg-white outline-none text-slate-700">
                                        <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Filter Modal */}
                    {showFilterPanel && (
                        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pb-12 pt-12 md:pt-40 md:pl-40 backdrop-blur-sm overflow-y-auto">
                            <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col" style={{ maxHeight: "85vh" }}>
                                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                                    <div><h2 className="text-lg font-semibold text-slate-900">Advanced Filters</h2><p className="text-sm text-slate-500">Configure data visibility</p></div>
                                    <button onClick={() => setShowFilterPanel(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                                </div>
                                <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-4 pb-4">
                                    <KpiFilterPanel sectionConfig={filterOptions} sectionValues={{ ...advancedFilters, msl: tempMslFilter ? [tempMslFilter] : ['0'] }} onSectionChange={handleSectionChange} />
                                </div>
                                <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                                    <button onClick={() => setShowFilterPanel(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                                    <button onClick={handleApplyFilters} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm">Apply Filters</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
