import React, { useMemo, useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { SlidersHorizontal, X } from "lucide-react";
import { KpiFilterPanel } from "../KpiFilterPanel";

// Single-file React component (JSX)
// Light theme, paginated (default 5 rows/page), sortable columns.
// Removed the “# < 70” column as requested.

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
}

function seededRandom(seed) {
    let t = seed % 2147483647;
    if (t <= 0) t += 2147483646;
    return function () {
        t = (t * 16807) % 2147483647;
        return (t - 1) / 2147483646;
    };
}

function makeRow(seed, name, sku, base) {
    const rnd = seededRandom(seed);
    const values = DAYS.map((d) => {
        const drift = (rnd() - 0.5) * 6;
        const weekdayWave = Math.sin(d / 2.8) * 2;
        const v = clamp(Math.round(base + drift + weekdayWave), 55, 96);
        return v;
    });

    const avg7 = Math.round(values.slice(-7).reduce((a, b) => a + b, 0) / 7);
    const avg31 = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

    const status = avg7 >= 85 ? "Healthy" : avg7 >= 70 ? "Watch" : "Action";

    return { name, sku, values, avg7, avg31, status };
}

const SAMPLE_ROWS = [
    makeRow(85045, "KW CORNETTO - DOUBLE CHOC...", "85045", 80),
    makeRow(85047, "KW CORNETTO - BUTTERSCOTCH", "85047", 84),
    makeRow(85123, "KW Cassatta", "85123", 72),
    makeRow(85336, "KW PP Strawberry", "85336", 71),
    makeRow(85338, "KW Magnum Chocolate Truffle", "85338", 74),
    makeRow(85339, "KW Magnum Almond 90 ml", "85339", 81),
    makeRow(85350, "KW CDO - FRUIT & NUT", "85350", 72),
    makeRow(85411, "KW Magnum Brownie 90ml", "85411", 78),
    makeRow(85437, "COR DISC OREO 120ML", "85437", 83),
    makeRow(85438, "KW Sandwich Chocolate n Vanilla...", "85438", 77),
    makeRow(85555, "KW Oreo Tub 2x700ml", "85555", 89),
    makeRow(85570, "KW AAMRAS 70ml", "85570", 86),
];

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
        </span>
    );
}

export default function OsaDetailTableLight() {
    const [query, setQuery] = useState("");
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [page, setPage] = useState(1);

    const [sortKey, setSortKey] = useState("avg7");
    const [sortDir, setSortDir] = useState("desc");



    const [visibleDays, setVisibleDays] = useState(31); // 7/14/31 toggle

    const [statusFilter, setStatusFilter] = useState([]);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filterRules, setFilterRules] = useState(null);

    const filterOptions = useMemo(() => {
        return [
            { id: "date", label: "Date", options: [] }, // Date range picker would be custom
            { id: "month", label: "Month", options: [{ id: "all", label: "All" }, { id: "jan", label: "January" }, { id: "feb", label: "February" }] },
            { id: "platform", label: "Platform", options: [{ id: "blinkit", label: "Blinkit" }, { id: "zepto", label: "Zepto" }] },
            { id: "productName", label: "Product Name", options: [{ id: "p1", label: "Cornetto Double Chocolate" }, { id: "p2", label: "Magnum Truffle" }] },
            { id: "format", label: "Format", options: [{ id: "cone", label: "Cone" }, { id: "cup", label: "Cup" }, { id: "stick", label: "Stick" }] },
            { id: "zone", label: "Zone", options: [{ id: "north", label: "North" }, { id: "south", label: "South" }] },
            { id: "city", label: "City", options: [{ id: "delhi", label: "Delhi" }, { id: "mumbai", label: "Mumbai" }] },
            { id: "pincode", label: "Pincode", options: [{ id: "110001", label: "110001" }, { id: "400001", label: "400001" }] },
            { id: "metroFlag", label: "Metro Flag", options: [{ id: "metro", label: "Metro" }, { id: "non-metro", label: "Non-Metro" }] },
            { id: "classification", label: "Classification", options: [{ id: "gnow", label: "GNOW" }] },
        ];
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q && statusFilter.length === 0) return SAMPLE_ROWS;

        let res = SAMPLE_ROWS;
        if (q) {
            res = res.filter(
                (r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
            );
        }
        if (statusFilter.length > 0) {
            res = res.filter((r) => statusFilter.includes(r.status));
        }
        return res;
    }, [query, statusFilter]);

    const sorted = useMemo(() => {
        const dirMul = sortDir === "asc" ? 1 : -1;

        const isDayKey = typeof sortKey === "string" && sortKey.startsWith("day_");
        const dayIndex = isDayKey ? parseInt(sortKey.replace("day_", ""), 10) : null;

        const getVal = (r) => {
            if (dayIndex != null) {
                const idx = clamp(dayIndex - 1, 0, 30);
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

    const dayCols = DAYS.slice(0, visibleDays);

    return (
        <div className="rounded-3xl flex-col bg-slate-50 relative">
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-auto p-0 pr-0">
                    <div className="rounded-3xl border bg-white p-4 shadow">
                        {/* Title + Legend */}
                        <div className="mb-4 flex items-center justify-between font-bold text-slate-900">
                            <div className="flex flex-col">
                                <div className="text-lg">OSA % Detail View</div>
                                <div className="text-[11px] text-slate-500 font-normal">
                                    Last {visibleDays} Days • Sortable • Paginated
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

                                {/* Status Legend - Moved from body */}
                                <div className="flex items-center gap-2 ml-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-100">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Healthy
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 border border-amber-100">
                                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Watch
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 border border-rose-100">
                                        <span className="h-2 w-2 rounded-full bg-rose-500" /> Action
                                    </span>
                                </div>
                            </div>
                        </div>



                        {/* Controls */}
                        {/* Table */}
                        <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                            <div className="overflow-auto">
                                <table className="min-w-[1200px] w-full border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-10 bg-white">
                                        <tr>
                                            {/* Sticky first column header */}
                                            <th
                                                className="sticky left-0 z-20 bg-[#f8fafc] text-left px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 border-b border-slate-200"
                                                style={{ minWidth: 280 }}
                                            >
                                                <div className="flex items-center h-full">PRODUCT / SKU</div>
                                            </th>

                                            {/* <th
                                                className="px-3 py-2 text-left text-[11px] font-semibold tracking-wider text-slate-500 border-b border-slate-200 cursor-pointer select-none"
                                                onClick={() => headerSort("avg7")}
                                            >
                                                7D AVG <SortIcon dir={sortKey === "avg7" ? sortDir : undefined} />
                                            </th> */}

                                            <th
                                                className="px-3 py-2 text-center text-[11px] font-semibold tracking-wider text-slate-500 border-b border-slate-200 cursor-pointer select-none"
                                                onClick={() => headerSort("avg31")}
                                            >
                                                <div className="flex items-center justify-center gap-1 h-full">
                                                    AVG <SortIcon dir={sortKey === "avg31" ? sortDir : undefined} />
                                                </div>
                                            </th>

                                            <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wider text-slate-500 border-b border-slate-200">
                                                <div className="flex items-center h-full">STATUS</div>
                                            </th>

                                            {dayCols.map((d) => (
                                                <th
                                                    key={d}
                                                    className="px-2 py-2 text-center text-[10px] font-semibold tracking-wider text-slate-500 border-b border-slate-200 cursor-pointer select-none whitespace-nowrap"
                                                    onClick={() => headerSort(`day_${d}`)}
                                                >
                                                    <div className="flex items-center justify-center gap-1 h-full">
                                                        DAY {d}
                                                        <SortIcon dir={sortKey === `day_${d}` ? sortDir : undefined} />
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {pageRows.map((r) => {
                                            const st = statusStyles(r.status);
                                            const avgND =
                                                visibleDays === 31
                                                    ? r.avg31
                                                    : Math.round(r.values.slice(-visibleDays).reduce((a, b) => a + b, 0) / visibleDays);

                                            return (
                                                <tr key={r.sku} className={"group " + st.rowAccent}>
                                                    <td
                                                        className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-slate-100"
                                                        style={{ minWidth: 280 }}
                                                    >
                                                        <div>
                                                            <div className="font-medium text-slate-900 leading-5 text-[11px]">{r.name}</div>
                                                            <div className="text-[10px] text-slate-500 mt-0.5">{r.sku}</div>
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

                                                    {dayCols.map((d) => {
                                                        const v = r.values[d - 1];
                                                        return (
                                                            <td
                                                                key={d}
                                                                className="px-2 py-2 border-b border-slate-100 text-center"
                                                                title={`${r.name} • Day ${d}: ${v}%`}
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
                                            );
                                        })}

                                        {pageRows.length === 0 && (
                                            <tr>
                                                <td colSpan={4 + dayCols.length} className="px-4 py-8 text-center text-[11px] text-slate-500">
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

                                    <button
                                        onClick={() => setShowFilterPanel(true)}
                                        className="rounded-full bg-slate-900 px-4 py-1.5 text-white hover:bg-slate-800 transition-colors shadow-sm font-medium"
                                    >
                                        Filters
                                    </button>
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
                                <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-10 pb-6">
                                    <KpiFilterPanel
                                        sectionConfig={filterOptions}
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
                                        onClick={() => setShowFilterPanel(false)}
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