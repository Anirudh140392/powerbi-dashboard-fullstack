import React, { useState, useEffect, useMemo } from "react";
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Tooltip
} from "@mui/material";
import { motion } from "framer-motion";
import {
    TrendingUp,
    TrendingDown,
    SlidersHorizontal,
    LineChart as LineChartIcon,
    ArrowUpRight,
    ArrowDownRight,
    X
} from "lucide-react";
import PaginationFooter from '../CommonLayout/PaginationFooter';
import { fetchCategorySalesMatrix } from "../../api/salesService";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    YAxis,
    XAxis
} from "recharts";

import { FilterContext } from "../../utils/FilterContext";
import { RefreshCw, AlertCircle } from "lucide-react";
import { KpiFilterPanel } from '../KpiFilterPanel';

const fmt = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "0";
    if (val >= 10000000) return (val / 10000000).toFixed(1) + " Cr";
    if (val >= 100000) return (val / 100000).toFixed(1) + " L";
    if (val >= 1000) return (val / 1000).toFixed(1) + " K";
    return val.toFixed(1);
};

const ErrorWithRefresh = ({ onRetry, message }) => (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={12} px={3} sx={{ textAlign: 'center' }}>
        <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
            <AlertCircle size={32} color="#ef4444" />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#1e293b", mb: 1 }}>
            API Reference Error
        </Typography>
        <Typography variant="body2" sx={{ color: "#64748b", mb: 4, maxWidth: 300 }}>
            {message || "We encountered an issue while fetching the latest data for this segment."}
        </Typography>
        <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-slate-800 transition-all active:scale-95"
        >
            <RefreshCw size={16} />
            Try Refreshing
        </button>
    </Box>
);

const getMetricStyle = (label, val) => {
    // Return neutral styling - no colored backgrounds on values
    // Only the delta/% change will have colors
    return {
        bgcolor: "#f8fafc",
        color: "#334155",
        border: "1px solid #e2e8f0"
    };
};

const TrendSparkline = ({ data = [] }) => {
    if (!data || data.length === 0) return <Typography variant="caption">No trend data</Typography>;

    return (
        <Box sx={{ width: "100%", height: 60, mt: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                    />
                    <YAxis hide domain={['auto', 'auto']} />
                    <XAxis hide dataKey="date" />
                </AreaChart>
            </ResponsiveContainer>
        </Box>
    );
};

const MetricCell = ({ data, label, categoryName }) => {
    const { value, delta, trend } = data || { value: 0, delta: 0, trend: [] };
    const metricStyle = getMetricStyle(label, value);
    const isPositive = delta >= 0;
    const [isOpen, setIsOpen] = useState(false);

    const deltaStyle = isPositive
        ? { bgcolor: "#f0fdf4", color: "#10b981", border: "1px solid #dcfce7" }
        : { bgcolor: "#fef2f2", color: "#ef4444", border: "1px solid #fee2e2" };

    return (
        <TableCell align="right" sx={{ py: 1.5, borderBottom: "1px solid #f1f5f9" }}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Box
                        display="inline-flex"
                        alignItems="center"
                        gap={1}
                        onMouseEnter={() => setIsOpen(true)}
                        onMouseLeave={() => setIsOpen(false)}
                        sx={{ cursor: "pointer", transition: "transform 0.1s", "&:hover": { transform: "translateY(-1px)" } }}
                    >
                        {/* Main Value Badge */}
                        <Box
                            sx={{
                                ...metricStyle,
                                px: 1.5,
                                py: 0.75,
                                borderRadius: "10px",
                                minWidth: "65px",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                            }}
                        >
                            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                                {fmt(value)}
                            </Typography>
                        </Box>

                        {/* Delta Badge */}
                        <Box
                            sx={{
                                ...deltaStyle,
                                display: "flex",
                                alignItems: "center",
                                gap: 0.25,
                                px: 1,
                                py: 0.5,
                                borderRadius: "10px",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                            }}
                        >
                            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                                {isPositive ? "+" : ""}{delta.toFixed(1)}
                            </Typography>
                        </Box>
                    </Box>
                </PopoverTrigger>
                <PopoverContent
                    onMouseEnter={() => setIsOpen(true)}
                    onMouseLeave={() => setIsOpen(false)}
                    className="w-64 p-3 bg-white border border-slate-100 shadow-xl rounded-xl z-[9999]"
                >
                    <Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#1e293b" }}>
                                {categoryName} — {label}
                            </Typography>
                            <Box sx={{ color: isPositive ? "#10b981" : "#ef4444", display: "flex", alignItems: "center" }}>
                                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            </Box>
                        </Box>
                        <Typography sx={{ fontSize: 10, color: "#64748b", mb: 1 }}>
                            Daily trend (MTD)
                        </Typography>
                        <TrendSparkline data={trend} />
                    </Box>
                </PopoverContent>
            </Popover>
        </TableCell>
    );
};

export default function ByCategoryKpiMatrix({ startDate, endDate, compareStartDate, compareEndDate, platform, brand, location, onTrendClick }) {
    const { refreshFilters } = React.useContext(FilterContext);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState(null);
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(3);
    const [search, setSearch] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filters, setFilters] = useState({ date: [], month: [], platform: [], kpi: [], format: [], zone: [], city: [], categories: [], kpis: [] });
    const [popupFilters, setPopupFilters] = useState({ date: [], month: [], platform: [], kpi: [], format: [], zone: [], city: [], categories: [], kpis: [] });

    const loadData = async () => {
        setLoading(true);
        setApiError(null);
        try {
            const results = await fetchCategorySalesMatrix({
                startDate, endDate, compareStartDate, compareEndDate,
                platform, brand, location
            });
            setData(results);
        } catch (error) {
            console.error("Failed to fetch Category Matrix:", error);
            setApiError(error.message || "Failed to fetch category matrix data");
        } finally {
            setLoading(false);
        }
    };

    const retryMatrix = async () => {
        refreshFilters();
        await loadData();
    };

    useEffect(() => {
        loadData();
    }, [startDate, endDate, compareStartDate, compareEndDate, platform, brand, location]);

    const filteredData = useMemo(() => {
        let result = data;

        // Apply search filter
        if (search) {
            result = result.filter(item => item.category.toLowerCase().includes(search.toLowerCase()));
        }

        // Apply category filter
        if (filters.categories && filters.categories.length > 0) {
            result = result.filter(item => filters.categories.includes(item.category));
        }

        return result;
    }, [data, search, filters.categories]);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, page, rowsPerPage]);

    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

    // KPI mapping for filtering
    const kpiMapping = {
        'MTD Sales': { header: 'MTD SALES', dataKey: 'mtd', label: 'MTD SALES' },
        'Prev Month MTD': { header: 'PREV MONTH MTD', dataKey: 'prevMtd', label: 'PREV MONTH MTD' },
        'Current DRR': { header: 'CURRENT DRR', dataKey: 'drr', label: 'CURRENT DRR' },
        'YTD Sales': { header: 'YTD SALES', dataKey: 'ytd', label: 'YTD SALES' },
        'Last Year Sales': { header: 'LAST YEAR SALES', dataKey: 'lastYear', label: 'LAST YEAR SALES' },
        'Projected Sales': { header: 'PROJECTED SALES', dataKey: 'projected', label: 'PROJECTED SALES' }
    };

    // Determine which KPIs to display
    const activeKpis = useMemo(() => {
        if (!filters.kpis || filters.kpis.length === 0) {
            // Show all KPIs by default
            return Object.keys(kpiMapping);
        }
        return filters.kpis;
    }, [filters.kpis]);

    // Calculate active filter count
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.categories && filters.categories.length > 0) count += filters.categories.length;
        if (filters.kpis && filters.kpis.length > 0) count += filters.kpis.length;
        return count;
    }, [filters.categories, filters.kpis]);

    // Filter options for the Advanced Filters panel
    const filterOptionsData = useMemo(() => {
        const categories = [];
        const kpis = [];

        // Extract unique categories from data (no "All" prefix)
        const uniqueCategories = new Set();
        data.forEach(item => {
            if (item.category) {
                uniqueCategories.add(item.category);
            }
        });
        uniqueCategories.forEach(cat => categories.push({ id: cat, label: cat }));

        // Add KPI options (no "All" prefix)
        ['MTD Sales', 'Prev Month MTD', 'Current DRR', 'YTD Sales', 'Last Year Sales', 'Projected Sales'].forEach(k =>
            kpis.push({ id: k, label: k })
        );

        return { kpis, categories };
    }, [data]);

    const sectionConfig = useMemo(() => [
        { id: "kpis", label: "KPI", options: filterOptionsData.kpis },
        { id: "categories", label: "Category", options: filterOptionsData.categories },
    ], [filterOptionsData]);

    return (
        <Box sx={{ width: "100%", bgcolor: "white", borderRadius: "16px", border: "1px solid #f1f5f9", overflow: "hidden", p: 3, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <Box display="flex" flexDirection={{ xs: "column", md: "row" }} alignItems={{ xs: "start", md: "center" }} justifyContent="space-between" mb={4} gap={3}>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: "#1e293b", fontSize: "1.2rem", letterSpacing: "-0.02em" }}>
                        By Category KPI Matrix
                    </Typography>
                    <Typography sx={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>
                        Hover on any value to see trend sparkline. Click header icon for detailed trends.
                    </Typography>
                </Box>

                <Box display="flex" flexDirection={{ xs: "column-reverse", sm: "row" }} gap={2} alignItems={{ xs: "start", sm: "center" }} width={{ xs: "100%", md: "auto" }}>
                    <Box display="flex" alignItems="center" gap={1}>
                        {showSearch && (
                            <motion.input
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 170, opacity: 1 }}
                                type="text"
                                placeholder="Search category..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{
                                    padding: "8px 12px",
                                    fontSize: "12px",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "20px",
                                    outline: "none",
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                                }}
                            />
                        )}
                        <button
                            onClick={() => setShowFilterPanel(true)}
                            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all active:scale-95 whitespace-nowrap relative"
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            <span>Filters</span>
                            {activeFilterCount > 0 && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: -6,
                                        right: -6,
                                        bgcolor: '#10b981',
                                        color: 'white',
                                        fontSize: 10,
                                        fontWeight: 800,
                                        borderRadius: '50%',
                                        width: 18,
                                        height: 18,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    {activeFilterCount}
                                </Box>
                            )}
                        </button>
                    </Box>

                    <Box sx={{ width: "1.5px", height: "24px", bgcolor: "#f1f5f9", display: { xs: "none", sm: "block" } }} />

                    <Box display="flex" gap={2} flexWrap="wrap">
                        <Box display="flex" alignItems="center" gap={1} sx={{ bgcolor: "#f0fdf4", px: 2, py: 0.75, borderRadius: "20px", border: "1px solid #dcfce7" }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#10b981" }} />
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#166534" }}>Healthy</Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1} sx={{ bgcolor: "#fffbeb", px: 2, py: 0.75, borderRadius: "20px", border: "1px solid #fef3c7" }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#f59e0b" }} />
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#92400e" }}>Watch</Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1} sx={{ bgcolor: "#fef2f2", px: 2, py: 0.75, borderRadius: "20px", border: "1px solid #fee2e2" }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#ef4444" }} />
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#991b1b" }}>Action</Typography>
                        </Box>
                    </Box>
                </Box>
            </Box>

            {apiError ? (
                <ErrorWithRefresh onRetry={retryMatrix} message={apiError} />
            ) : (
                <>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: "#f8fafc" }}>
                                    <TableCell sx={{ py: 3, fontWeight: 800, color: "#475569", fontSize: 12 }}>CATEGORY</TableCell>
                                    {activeKpis.map((kpiName) => {
                                        const kpi = kpiMapping[kpiName];
                                        return (
                                            <TableCell key={kpi.header} align="right" sx={{ py: 2, fontWeight: 800, color: "#475569", fontSize: 12 }}>
                                                <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.75}>
                                                    {kpi.header}
                                                    <Box
                                                        className="trend-icon"
                                                        onClick={() => onTrendClick && onTrendClick(kpi.header)}
                                                        sx={{
                                                            p: 0.5,
                                                            borderRadius: "6px",
                                                            bgcolor: "#eef2ff",
                                                            color: "#6366f1",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            cursor: "pointer",
                                                            transition: "all 0.2s ease"
                                                        }}
                                                    >
                                                        <LineChartIcon size={12} />
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                                            <CircularProgress size={35} sx={{ color: "#6366f1" }} />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                                            <Typography sx={{ color: "#64748b", fontSize: 14, fontWeight: 500 }}>No categories found matching your search.</Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((row, idx) => (
                                        <TableRow
                                            key={row.category}
                                            component={motion.tr}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            sx={{
                                                "&:hover": { bgcolor: "#f8fafc" },
                                                transition: "background-color 0.2s"
                                            }}
                                        >
                                            <TableCell sx={{ py: 2.5, borderBottom: "1px solid #f1f5f9" }}>
                                                <Typography sx={{ fontWeight: 800, color: "#1e293b", fontSize: 13, letterSpacing: "0.02em" }}>
                                                    {row.category.toUpperCase()}
                                                </Typography>
                                            </TableCell>
                                            {activeKpis.map((kpiName) => {
                                                const kpi = kpiMapping[kpiName];
                                                return (
                                                    <MetricCell
                                                        key={kpi.dataKey}
                                                        data={row.metrics[kpi.dataKey]}
                                                        label={kpi.label}
                                                        categoryName={row.category}
                                                    />
                                                );
                                            })}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Box mt={3} px={1}>
                        <PaginationFooter
                            isVisible={true}
                            currentPage={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            pageSize={rowsPerPage}
                            onPageSizeChange={setRowsPerPage}
                            pageSizeOptions={[3, 5, 10, 20]}
                        />
                    </Box>
                </>
            )}

            {/* Advanced Filters Modal */}
            {showFilterPanel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 transition-all backdrop-blur-sm">
                    <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                        <div className="flex-1 overflow-y-auto bg-slate-50/30 px-6 pt-6 pb-6">
                            <KpiFilterPanel
                                sectionConfig={sectionConfig}
                                sectionValues={popupFilters}
                                onSectionChange={(sectionId, values) => {
                                    console.log("Filter changed:", sectionId, values);
                                    setPopupFilters(prev => ({
                                        ...prev,
                                        [sectionId]: values || []
                                    }));
                                }}
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4">
                            <button
                                onClick={() => {
                                    setPopupFilters({ date: [], month: [], platform: [], kpi: [], format: [], zone: [], city: [], categories: [], kpis: [] });
                                    setFilters({ date: [], month: [], platform: [], kpi: [], format: [], zone: [], city: [], categories: [], kpis: [] });
                                    setPage(1);
                                }}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Clear All
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
                                        setFilters(popupFilters);
                                        setPage(1);
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
        </Box>
    );
}
