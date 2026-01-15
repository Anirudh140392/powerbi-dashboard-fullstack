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

// Helper function to truncate long SKU names to 5-6 words
function truncateName(name, maxWords = 6) {
    if (!name) return '';
    const words = name.split(/\s+/);
    if (words.length <= maxWords) return name;
    return words.slice(0, maxWords).join(' ') + '...';
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

// Floating loader component for OSA Detail View
const FloatingLoader = ({ loading = false, label = "Loading..." }) => {
    if (!loading) return null;

    return (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-20 flex items-center justify-center rounded-2xl transition-opacity duration-200">
            <div className="flex items-center gap-3 bg-white/90 px-5 py-3 rounded-full shadow-lg border border-slate-200">
                <div className="relative">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-slate-700"></div>
                </div>
                <span className="text-sm font-medium text-slate-600">{label}</span>
            </div>
        </div>
    );
};

export default function OsaDetailTableLight({ filters = {}, initialLoading = false }) {
    const [query, setQuery] = useState("");
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [page, setPage] = useState(1);

    const [sortKey, setSortKey] = useState("avg7");
    const [sortDir, setSortDir] = useState("desc");



    const [visibleDays, setVisibleDays] = useState(31); // 7/14/31 toggle

    const [statusFilter, setStatusFilter] = useState([]);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filterRules, setFilterRules] = useState(null);

    // State for dynamic filter options from API
    const [platformOptions, setPlatformOptions] = useState([]);
    const [cityOptions, setCityOptions] = useState([]);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [monthOptions, setMonthOptions] = useState([]);
    const [dateOptions, setDateOptions] = useState([]);

    // State for selected filter values (for cascading)
    const [selectedPlatform, setSelectedPlatform] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);

    // State for dynamic category OSA data from API
    const [categoryData, setCategoryData] = useState([]);
    // Combine parent initialLoading with internal isLoading for unified loading state
    const [isLoading, setIsLoading] = useState(true);
    const [apiDates, setApiDates] = useState([]);

    // State to persist filter selections across filter panel open/close
    const [filterSelections, setFilterSelections] = useState({});

    // State to track the applied filters (set when Apply button is clicked)
    const [appliedFilters, setAppliedFilters] = useState({});

    // Fetch category OSA data from API - Uses global filters from props + local advanced filters
    useEffect(() => {
        const fetchCategoryOsaData = async () => {
            try {
                setIsLoading(true);
                const params = new URLSearchParams({});

                // ✅ Use GLOBAL Platform filter from props (top dropdown)
                const globalPlatform = filters.platform || selectedPlatform;
                if (globalPlatform && globalPlatform !== 'All') {
                    params.append('platform', globalPlatform);
                }

                // ✅ Use GLOBAL Brand filter from props (top dropdown)
                if (filters.brand && filters.brand !== 'All') {
                    params.append('brand', filters.brand);
                }

                // ✅ Use GLOBAL Location filter from props (top dropdown)
                if (filters.location && filters.location !== 'All') {
                    params.append('location', filters.location);
                }

                // ✅ Use GLOBAL Date Range from props (date picker)
                if (filters.startDate) {
                    params.append('startDate', filters.startDate);
                }
                if (filters.endDate) {
                    params.append('endDate', filters.endDate);
                }

                // Local advanced filter overrides (from Filters panel)
                // Date filter - pass selected dates (overrides global date range if set)
                if (appliedFilters.date && appliedFilters.date.length > 0) {
                    params.append('dates', appliedFilters.date.join(','));
                }

                // Month filter
                if (appliedFilters.month && appliedFilters.month.length > 0) {
                    params.append('months', appliedFilters.month.join(','));
                }

                // City filter
                if (appliedFilters.city && appliedFilters.city.length > 0) {
                    params.append('cities', appliedFilters.city.join(','));
                }

                // Category filter
                if (appliedFilters.category && appliedFilters.category.length > 0) {
                    params.append('categories', appliedFilters.category.join(','));
                }

                // KPI filter
                if (appliedFilters.kpi && appliedFilters.kpi.length > 0) {
                    params.append('kpis', appliedFilters.kpi.join(','));
                }

                const url = `/api/availability-analysis/osa-detail-by-category?${params}`;
                console.log('[OsaDetailView] REQUEST:', url);

                const res = await fetch(url);
                const data = await res.json();

                console.log('[OsaDetailView] RESPONSE:', JSON.stringify(data, null, 2));

                if (data.categories && data.categories.length > 0) {
                    // Transform API data to match expected format
                    const transformedData = data.categories.map(cat => ({
                        name: cat.name,
                        sku: cat.sku,
                        values: cat.values,
                        avg7: cat.values.length >= 7
                            ? Math.round(cat.values.slice(-7).reduce((a, b) => a + b, 0) / 7)
                            : cat.avg31,
                        avg31: cat.avg31,
                        status: cat.status
                    }));
                    setCategoryData(transformedData);
                    if (data.dates) {
                        setApiDates(data.dates);
                        // Update visible days based on actual date range returned
                        setVisibleDays(Math.min(data.dates.length, 31));
                    }
                } else {
                    // No data - clear state
                    setCategoryData([]);
                    setApiDates([]);
                }
                console.log('[OsaDetailView] Loaded', data.categories?.length, 'categories');
            } catch (error) {
                console.error('Error fetching category OSA data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCategoryOsaData();
    }, [filters.platform, filters.brand, filters.location, filters.startDate, filters.endDate, selectedPlatform, appliedFilters]);

    // Fetch filter options from API
    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                // Fetch platforms (no cascading dependency)
                const platformRes = await fetch('/api/availability-analysis/filter-options?filterType=platforms');
                const platformData = await platformRes.json();
                if (platformData.options) {
                    setPlatformOptions(platformData.options.map(p => ({ id: p.toLowerCase().replace(/\s+/g, '_'), label: p })));
                }

                // Fetch months
                const monthRes = await fetch('/api/availability-analysis/filter-options?filterType=months');
                const monthData = await monthRes.json();
                if (monthData.options) {
                    setMonthOptions(monthData.options.map(m => ({ id: m, label: m })));
                }

                // Fetch dates
                const dateRes = await fetch('/api/availability-analysis/filter-options?filterType=dates');
                const dateData = await dateRes.json();
                if (dateData.options) {
                    setDateOptions(dateData.options.map(d => ({ id: d, label: d })));
                }
            } catch (error) {
                console.error('Error fetching filter options:', error);
            }
        };

        fetchFilterOptions();
    }, []);

    // Fetch category options when platform changes
    useEffect(() => {
        const fetchCategoryOptions = async () => {
            try {
                const params = new URLSearchParams({ filterType: 'categories' });
                if (selectedPlatform) params.append('platform', selectedPlatform);

                const res = await fetch(`/api/availability-analysis/filter-options?${params}`);
                const data = await res.json();
                if (data.options) {
                    setCategoryOptions(data.options.map(c => ({ id: c.toLowerCase().replace(/\s+/g, '_'), label: c })));
                }
            } catch (error) {
                console.error('Error fetching category options:', error);
            }
        };

        fetchCategoryOptions();
    }, [selectedPlatform]);

    // Fetch city options when platform or category changes
    useEffect(() => {
        const fetchCityOptions = async () => {
            try {
                const params = new URLSearchParams({ filterType: 'cities' });
                if (selectedPlatform) params.append('platform', selectedPlatform);
                if (selectedCategory) params.append('category', selectedCategory);

                const res = await fetch(`/api/availability-analysis/filter-options?${params}`);
                const data = await res.json();
                if (data.options) {
                    setCityOptions(data.options.map(c => ({ id: c.toLowerCase().replace(/\s+/g, '_'), label: c })));
                }
            } catch (error) {
                console.error('Error fetching city options:', error);
            }
        };

        fetchCityOptions();
    }, [selectedPlatform, selectedCategory]);

    // Build filter options from loaded data
    const filterOptions = useMemo(() => {
        return [
            { id: "date", label: "Date", options: dateOptions.length > 0 ? dateOptions : [] },
            { id: "month", label: "Month", options: monthOptions.length > 0 ? [{ id: "all", label: "All" }, ...monthOptions] : [{ id: "all", label: "All" }] },
            { id: "platform", label: "Platform", options: platformOptions.length > 0 ? platformOptions : [] },
            { id: "city", label: "City", options: cityOptions.length > 0 ? cityOptions : [] },
            { id: "category", label: "Category", options: categoryOptions.length > 0 ? categoryOptions : [] },
            { id: "kpi", label: "KPI", options: [{ id: "osa", label: "OSA" }, { id: "fillrate", label: "Fill Rate" }, { id: "doi", label: "DOI" }, { id: "assortment", label: "Assortment" }, { id: "psl", label: "PSL" }] },
        ];
    }, [platformOptions, cityOptions, categoryOptions, monthOptions, dateOptions]);

    // Use API data if available, otherwise fall back to sample data
    const dataSource = categoryData.length > 0 ? categoryData : SAMPLE_ROWS;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q && statusFilter.length === 0) return dataSource;

        let res = dataSource;
        if (q) {
            res = res.filter(
                (r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
            );
        }
        if (statusFilter.length > 0) {
            res = res.filter((r) => statusFilter.includes(r.status));
        }
        return res;
    }, [query, statusFilter, dataSource]);

    const sorted = useMemo(() => {
        const dirMul = sortDir === "asc" ? 1 : -1;

        const isDayKey = typeof sortKey === "string" && sortKey.startsWith("day_");
        const dayIndex = isDayKey ? parseInt(sortKey.replace("day_", ""), 10) : null;

        const getVal = (r) => {
            if (dayIndex != null) {
                const idx = clamp(dayIndex - 1, 0, r.values.length - 1);
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

    // Use API dates if available, otherwise fallback to indexed days
    // Dynamic: Only shows columns for the selected date range (not always 31 days)
    const dayCols = useMemo(() => {
        if (apiDates && apiDates.length > 0) {
            // Use ALL dates from API - no slicing (dynamic based on selected date range)
            return apiDates.map((date, idx) => ({
                idx: idx + 1,
                date: date,
                label: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
            }));
        }
        // Fallback to indexed days when no API response yet
        return DAYS.slice(0, visibleDays).map(d => ({
            idx: d,
            date: null,
            label: `DAY ${d}`
        }));
    }, [apiDates, visibleDays]);

    return (
        <div className="rounded-3xl flex-col bg-slate-50 relative">
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-auto p-0 pr-0">
                    <div className="rounded-3xl border bg-white p-2 sm:p-4 shadow relative">
                        {/* Title + Legend */}
                        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between font-bold text-slate-900 gap-4 sm:gap-0">
                            <div className="flex flex-col gap-0.5">
                                <div className="text-base font-semibold text-slate-900">
                                    OSA % Detail View
                                </div>
                                <div className="text-xs text-slate-500 font-normal">
                                    {filters.endDate
                                        ? `${new Date(filters.endDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} • Full Month View`
                                        : `Current Month`
                                    } • Sortable • Paginated
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                {/* Filter Button */}
                                <button
                                    onClick={() => setShowFilterPanel(true)}
                                    className="flex-shrink-0 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow transition-all"
                                >
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    <span>Filters</span>
                                </button>

                                {/* Status Legend - Scrollable on mobile */}
                                <div className="flex items-center gap-2 ml-0 sm:ml-2 overflow-x-auto pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full sm:w-auto">
                                    <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Healthy
                                    </span>
                                    <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700 border border-amber-100">
                                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Watch
                                    </span>
                                    <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-700 border border-rose-100">
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
                                                className="sticky left-0 z-20 bg-slate-50 py-3 pl-4 pr-4 text-left text-[11px] font-bold uppercase tracking-widest text-slate-900 border-b border-slate-200 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)] min-w-[140px] sm:min-w-[280px]"
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
                                                className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900"
                                                onClick={() => headerSort("avg31")}
                                            >
                                                <div className="flex items-center justify-center gap-1 h-full">
                                                    AVG <SortIcon dir={sortKey === "avg31" ? sortDir : undefined} />
                                                </div>
                                            </th>

                                            <th className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900">
                                                <div className="flex items-center justify-center h-full">STATUS</div>
                                            </th>

                                            {dayCols.map((d) => (
                                                <th
                                                    key={d.idx}
                                                    className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900 whitespace-nowrap cursor-pointer select-none"
                                                    onClick={() => headerSort(`day_${d.idx}`)}
                                                >
                                                    <div className="flex items-center justify-center gap-1 h-full">
                                                        {d.label}
                                                        <SortIcon dir={sortKey === `day_${d.idx}` ? sortDir : undefined} />
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
                                                        className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-slate-100 min-w-[140px] sm:min-w-[280px] max-w-[140px] sm:max-w-[280px]"
                                                        title={r.name} // Show full name on hover
                                                    >
                                                        <div className="font-bold text-slate-900 leading-tight text-xs line-clamp-2">
                                                            {r.name}
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
                                                        const v = r.values[d.idx - 1];
                                                        return (
                                                            <td
                                                                key={d.idx}
                                                                className="px-2 py-2 border-b border-slate-100 text-center"
                                                                title={`${r.name} • ${d.label}: ${v}%`}
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
                            <div className="mt-3 flex flex-col sm:flex-row items-center justify-between text-[11px] px-4 py-3 border-t border-slate-200 gap-3 sm:gap-0">
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
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

                                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
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
                                {/* Panel Content */}
                                <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-0 pb-6">
                                    <KpiFilterPanel
                                        sectionConfig={filterOptions}
                                        sectionValues={filterSelections}
                                        onSectionChange={(sectionId, values) => {
                                            console.log("Filter changed:", sectionId, values);

                                            // Persist the selection to state
                                            setFilterSelections(prev => ({
                                                ...prev,
                                                [sectionId]: values
                                            }));

                                            // Handle cascading filters - Platform selection affects Category and City
                                            if (sectionId === 'platform' && values?.length > 0) {
                                                // Get the label of the first selected platform
                                                const selectedOption = platformOptions.find(p => values.includes(p.id));
                                                setSelectedPlatform(selectedOption?.label || null);
                                                // Reset dependent filters
                                                setSelectedCategory(null);
                                                // Clear dependent filter selections
                                                setFilterSelections(prev => ({
                                                    ...prev,
                                                    [sectionId]: values,
                                                    category: [],
                                                    city: []
                                                }));
                                            } else if (sectionId === 'platform' && (!values || values.length === 0)) {
                                                setSelectedPlatform(null);
                                                setSelectedCategory(null);
                                            }

                                            // Handle Category selection - affects City
                                            if (sectionId === 'category' && values?.length > 0) {
                                                const selectedOption = categoryOptions.find(c => values.includes(c.id));
                                                setSelectedCategory(selectedOption?.label || null);
                                                // Clear city selection when category changes
                                                setFilterSelections(prev => ({
                                                    ...prev,
                                                    [sectionId]: values,
                                                    city: []
                                                }));
                                            } else if (sectionId === 'category' && (!values || values.length === 0)) {
                                                setSelectedCategory(null);
                                            }

                                            // Handle KPI filter changes
                                            if (sectionId === 'kpi') {
                                                console.log("Selected KPIs:", values);
                                            }
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
                                            // Copy current selections to applied filters to trigger API call
                                            setAppliedFilters({ ...filterSelections });
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
