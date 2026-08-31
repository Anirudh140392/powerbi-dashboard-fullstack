import React, { useMemo, useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { SlidersHorizontal, X, ChevronRight, ChevronDown, ExternalLink, PieChart } from "lucide-react";
import { KpiFilterPanel } from "../KpiFilterPanel";
import dayjs from "dayjs";

// Single-file React component (JSX)
// Light theme, paginated (default 5 rows/page), sortable columns.
// Standalone copy for On-Shelf Availability page.

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

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
    if (v >= 85) return "bg-emerald-50";
    if (v >= 70) return "bg-amber-50";
    return "bg-rose-50";
}

function SortIcon({ dir }) {
    return (
        <span className="inline-flex items-center ml-1 text-slate-400">
            {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
        </span>
    );
}

export default function StandaloneOsaDetailView({ apiData, loading }) {
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState("avgSelected");
    const [sortDir, setSortDir] = useState("desc");
    const visibleDays = 31;
    const [expandedRows, setExpandedRows] = useState(new Set());

    // Check if DRL client
    const isDrlClient = useMemo(() => {
        try {
            const u = JSON.parse(sessionStorage.getItem('user'));
            const db = u?.dbName?.toLowerCase();
            return db === 'drl';
        } catch {
            return false;
        }
    }, []);

    const toggleRow = (sku) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(sku)) {
                next.delete(sku);
            } else {
                next.add(sku);
            }
            return next;
        });
    };

    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState({});

    const handleSectionChange = (sectionId, values) => {
        setAdvancedFilters(prev => ({
            ...prev,
            [sectionId]: values
        }));
    };

    const handleApplyFilters = () => {
        setPage(1);
        setShowFilterPanel(false);
    };

    const filterOptions = useMemo(() => {
        if (!apiData?.osaDetail) return [];

        const mk = arr => arr.map(p => ({ id: p, label: p }));

        const getMatchingRowsExcluding = (targetKey) => {
            let res = apiData.osaDetail;

            Object.entries(advancedFilters).forEach(([key, values]) => {
                if (key === targetKey || !values?.length) return;
                if (key === 'platform') {
                    res = res.filter(r => values.includes(r.platform));
                } else if (key === 'brand') {
                    res = res.filter(r => values.includes(r.brand));
                } else if (key === 'productName') {
                    res = res.filter(r => values.includes(r.name || r.productName));
                } else if (key === 'format') {
                    res = res.filter(r => values.includes(r.format));
                } else if (key === 'grammage') {
                    res = res.filter(r => values.includes(r.grammage || r.weight));
                } else if (key === 'city') {
                    res = res.filter(r => r.cities?.some(c => values.includes(c.name || c)));
                }
            });
            return res;
        };

        const platformRows = getMatchingRowsExcluding('platform');
        const brandRows = getMatchingRowsExcluding('brand');
        const productNameRows = getMatchingRowsExcluding('productName');
        const formatRows = getMatchingRowsExcluding('format');
        const grammageRows = getMatchingRowsExcluding('grammage');
        const cityRows = getMatchingRowsExcluding('city');

        // Build product name options - include SAP code for DRL client only
        let productOptions;
        if (isDrlClient) {
            productOptions = [...new Set(productNameRows.map(r => {
                const name = r.name || r.productName;
                const sapCode = r.sap_code;
                return JSON.stringify({ name, sapCode });
            }))]
                .map(json => JSON.parse(json))
                .filter(p => p.name)
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map(p => ({
                    id: p.name,
                    // Include SAP code in the label so it's searchable in the filter panel
                    label: p.sapCode ? `${p.name} (SAP: ${p.sapCode})` : p.name
                }));
        } else {
            productOptions = mk([...new Set(productNameRows.map(r => r.name || r.productName).filter(Boolean))].sort());
        }

        return [
            { id: "platform", label: "Platform", options: mk([...new Set(platformRows.map(r => r.platform).filter(Boolean))].sort()) },
            { id: "brand", label: "Brand", options: mk([...new Set(brandRows.map(r => r.brand).filter(Boolean))].sort()) },
            { id: "productName", label: "Product Name", options: productOptions },
            { id: "format", label: "Category", options: mk([...new Set(formatRows.map(r => r.format).filter(Boolean))].sort()) },
            { id: "grammage", label: "Grammage", options: mk([...new Set(grammageRows.map(r => r.grammage || r.weight).filter(Boolean))].sort()) },
            { id: "city", label: "City", options: mk([...new Set(cityRows.flatMap(r => r.cities?.map(c => c.name || c) || []).filter(Boolean))].sort()) },
        ];
    }, [apiData, advancedFilters, isDrlClient]);

    const baseRows = useMemo(() => {
        if (!apiData?.osaDetail || apiData.osaDetail.length === 0) return [];
        const hasShareInApi = apiData.osaDetail.some(r => r.offtakeShare !== undefined && r.offtakeShare !== null);
        let totalSalesAcc = 0;
        if (!hasShareInApi) {
            totalSalesAcc = apiData.osaDetail.reduce((acc, r) => acc + (parseFloat(r.sales || r.totalSales || r.offtake || 0) || 0), 0);
        }

        return apiData.osaDetail.map(row => {
            const values = row.values || [];
            let offtakeShare = row.offtakeShare;
            if ((offtakeShare === undefined || offtakeShare === null) && totalSalesAcc > 0) {
                const s = parseFloat(row.sales || row.totalSales || row.offtake || 0) || 0;
                offtakeShare = parseFloat(((s / totalSalesAcc) * 100).toFixed(2));
            }
            return {
                name: row.name || row.productName || "Unknown Product",
                sku: row.sku || "N/A",
                web_pid: row.web_pid || row.webPid || row.sku || null,
                brand: row.brand,
                platform: row.platform,
                format: row.format,
                grammage: row.grammage || row.weight || "",
                offtakeShare: offtakeShare,
                values: values,
                avg7: row.avg7 || 0,
                avg31: row.avg31 || 0,
                status: row.status || "Healthy",
                page_url: row.page_url || null,
                cities: row.cities || [],
                sap_code: row.sap_code || null
            };
        });
    }, [apiData]);


    const filtered = useMemo(() => {
        let res = baseRows;

        // Apply Advanced Filters
        Object.keys(advancedFilters).forEach(key => {
            const values = advancedFilters[key];
            if (values && values.length > 0) {
                if (key === 'platform') {
                    res = res.filter(r => values.includes(r.platform));
                } else if (key === 'brand') {
                    res = res.filter(r => values.includes(r.brand));
                } else if (key === 'productName') {
                    res = res.filter(r => values.includes(r.name));
                } else if (key === 'format') {
                    res = res.filter(r => values.includes(r.format));
                } else if (key === 'grammage') {
                    res = res.filter(r => values.includes(r.grammage || r.weight));
                } else if (key === 'city') {
                    // Filter down to rows containing any of the selected cities
                    res = res.filter(r => r.cities?.some(c => values.includes(c.name)));
                    // AND filter the nested cities array to ONLY include the selected cities
                    res = res.map(r => ({
                        ...r,
                        cities: r.cities.filter(c => values.includes(c.name))
                    }));
                }
            }
        });

        return res;
    }, [baseRows, advancedFilters, apiData]);

    const sorted = useMemo(() => {
        const dirMul = sortDir === "asc" ? 1 : -1;

        const isDayKey = typeof sortKey === "string" && sortKey.startsWith("day_");
        const dayIndex = isDayKey ? parseInt(sortKey.replace("day_", ""), 10) : null;

        const getVal = (r) => {
            if (dayIndex != null) {
                const idx = clamp(dayIndex, 0, r.values.length - 1);
                return r.values[idx];
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

    const dayCols = useMemo(() => {
        if (apiData?.osaDates && apiData.osaDates.length > 0) {
            return apiData.osaDates;
        }
        return Array.from({ length: 31 }, (_, i) => `DAY ${i + 1}`);
    }, [apiData]);

    return (
        <div className="rounded-3xl flex-col bg-slate-50 relative">
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-auto p-0 pr-0">
                    <div className="rounded-3xl border bg-white p-4 shadow">
                        {/* Title + Legend */}
                        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-bold text-slate-900">
                            <div className="flex flex-col gap-0.5">
                                <div className="text-base font-semibold text-slate-900">
                                    OSA % Detail View
                                </div>
                                <div className="text-xs text-slate-500 font-normal">
                                    Selected Period • Actual OSA • Sortable
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Filter Button */}
                                <button
                                    onClick={() => setShowFilterPanel(true)}
                                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow transition-all"
                                >
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    <span>Filters</span>
                                </button>

                                {/* Status Legend - Moved from body */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Healthy
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700 border border-amber-100">
                                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Watch
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-700 border border-rose-100">
                                        <span className="h-2 w-2 rounded-full bg-rose-500" /> Action
                                    </span>
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
                                                className="sticky left-0 z-20 bg-slate-100 py-3 pl-4 pr-4 text-left text-[11px] font-bold uppercase tracking-widest text-slate-900 border-b border-slate-200 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)]"
                                                style={{ minWidth: 280 }}
                                            >
                                                <div className="flex items-center h-full text-emerald-800">PRODUCT / PLATFORM</div>
                                            </th>

                                            <th
                                                className="border-b border-r border-slate-100 last:border-r-0 bg-slate-100 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900 cursor-pointer select-none"
                                                onClick={() => headerSort("avgSelected")}
                                            >
                                                <div className="flex items-center justify-center gap-1 h-full">
                                                    OSA <SortIcon dir={sortKey === "avgSelected" || sortKey === "avg31" ? sortDir : undefined} />
                                                </div>
                                            </th>

                                            <th className="border-b border-r border-slate-100 last:border-r-0 bg-slate-100 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900">
                                                <div className="flex items-center justify-center h-full">STATUS</div>
                                            </th>

                                            {dayCols.map((col, idx) => (
                                                <th
                                                    key={col}
                                                    className="border-b border-r border-slate-100 last:border-r-0 bg-slate-100 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900 whitespace-nowrap cursor-pointer select-none"
                                                    onClick={() => headerSort(`day_${idx}`)}
                                                >
                                                    <div className="flex items-center justify-center gap-1 h-full">
                                                        {/^\d{4}-\d{2}-\d{2}$/.test(col) ? dayjs(col).format('DD MMM') : col}
                                                        <SortIcon dir={sortKey === `day_${idx}` ? sortDir : undefined} />
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {pageRows.map((r) => {
                                            const st = statusStyles(r.status);
                                            const avgND = r.avgSelected !== undefined
                                                ? r.avgSelected
                                                : (visibleDays === 31
                                                    ? r.avg31
                                                    : (r.values.filter(v => v !== null).length > 0
                                                        ? Math.round(r.values.slice(-visibleDays).filter(v => v !== null).reduce((a, b) => a + b, 0) / r.values.slice(-visibleDays).filter(v => v !== null).length)
                                                        : null));

                                            return (
                                                <React.Fragment key={r.sku}>
                                                    <tr className={"group " + st.rowAccent}>
                                                        <td
                                                            className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-slate-100"
                                                            style={{ minWidth: 280 }}
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
                                                                <div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="font-bold text-slate-900 leading-5 text-xs">{r.name}</div>
                                                                        {r.page_url && (
                                                                            <a
                                                                                href={r.page_url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="flex-shrink-0 p-0.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                                                                title="Open product page"
                                                                            >
                                                                                <ExternalLink className="h-3 w-3" />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">{r.platform}</div>
                                                                        {r.offtakeShare !== undefined && r.offtakeShare !== null && (
                                                                            <div className="flex items-center gap-1 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/50 text-sky-600 font-bold" style={{ fontSize: '9px' }} title="Offtake Share">
                                                                                <PieChart size={10} className="text-sky-500" />
                                                                                {r.offtakeShare}% Share
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>



                                                        <td className="px-3 py-2 border-b border-slate-100 text-[11px] text-slate-900 text-center">
                                                            {avgND !== null ? `${avgND}%` : 'N/A'}
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

                                                        {dayCols.map((col, idx) => {
                                                            const v = r.values[idx];
                                                            const displayHeader = /^\d{4}-\d{2}-\d{2}$/.test(col)
                                                                ? dayjs(col).format('DD MMM')
                                                                : col;
                                                            return (
                                                                <td
                                                                    key={col}
                                                                    className="px-2 py-2 border-b border-slate-100 text-center"
                                                                    title={`${r.name} • ${displayHeader}: ${v !== null && v !== undefined ? `${v}%` : 'N/A'}`}
                                                                >
                                                                    <span
                                                                        className={
                                                                            "inline-flex min-w-[36px] justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 " +
                                                                            cellTone(v)
                                                                        }
                                                                    >
                                                                        {v !== null && v !== undefined ? `${v}%` : 'N/A'}
                                                                    </span>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                    {expandedRows.has(r.sku) &&
                                                        (r.cities || []).map((cityData) => {
                                                            const cityAvgND = cityData.avgSelected !== undefined
                                                                ? cityData.avgSelected
                                                                : (visibleDays === 31
                                                                    ? cityData.avg31
                                                                    : (cityData.values.filter(v => v !== null).length > 0
                                                                        ? Math.round(cityData.values.slice(-visibleDays).filter(v => v !== null).reduce((a, b) => a + b, 0) / cityData.values.slice(-visibleDays).filter(v => v !== null).length)
                                                                        : null));

                                                            return (
                                                                <tr key={`${r.sku}-${cityData.name}`} className="bg-slate-50/50">
                                                                    <td
                                                                        className="sticky left-0 z-10 bg-slate-50/50 px-3 py-1.5 border-b border-slate-100 pl-10"
                                                                        style={{ minWidth: 280 }}
                                                                    >
                                                                        <div className="text-[11px] font-medium text-slate-600">
                                                                            {cityData.name}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-1.5 border-b border-slate-100 text-[10px] text-slate-500 text-center">
                                                                        {cityAvgND !== null ? `${cityAvgND}%` : 'N/A'}
                                                                    </td>
                                                                    <td className="px-3 py-1.5 border-b border-slate-100 text-center">
                                                                        <span className="text-[10px] text-slate-400">-</span>
                                                                    </td>
                                                                    {dayCols.map((col, idx) => {
                                                                        const v = cityData.values[idx];
                                                                        return (
                                                                            <td
                                                                                key={col}
                                                                                className="px-2 py-1.5 border-b border-slate-100 text-center"
                                                                            >
                                                                                <span className="text-[10px] text-slate-500 font-medium">
                                                                                    {v !== null && v !== undefined ? `${v}%` : 'N/A'}
                                                                                </span>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            );
                                                        })}
                                                </React.Fragment>
                                            );
                                        })}

                                        {pageRows.length === 0 && (
                                            <tr>
                                                <td colSpan={3 + dayCols.length} className="px-4 py-8 text-center text-[11px] text-slate-500">
                                                    No rows found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination - Performance Marketing Style */}
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
                        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pb-12 pt-12 md:pt-40 md:pl-40 transition-all backdrop-blur-sm shadow-2xl overflow-y-auto">
                            <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 mt-0 mb-auto" style={{ maxHeight: "85vh" }}>
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
                                <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-4 pb-4">
                                    <KpiFilterPanel
                                        sectionConfig={filterOptions}
                                        sectionValues={advancedFilters}
                                        onSectionChange={handleSectionChange}
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
                                        onClick={handleApplyFilters}
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
