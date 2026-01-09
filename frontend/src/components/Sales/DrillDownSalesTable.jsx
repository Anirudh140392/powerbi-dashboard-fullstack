import React, { useState, useMemo } from "react";
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Button,
    CircularProgress,
    LinearProgress
} from "@mui/material";
import { motion } from "framer-motion";
import { Plus, Minus, SlidersHorizontal, X } from "lucide-react";
import { KpiFilterPanel } from '../KpiFilterPanel'
import PaginationFooter from '../CommonLayout/PaginationFooter'
import { fetchSalesDrilldown } from "../../api/salesService";

/* -------------------------------------------------------------------------- */
/*                               RENDER HELPERS                               */
/* -------------------------------------------------------------------------- */
const fmt = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "0.0";
    return val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
};

const getMetricStyle = (label, val) => {
    if (val === undefined || val === null) return {};
    let status = 'action';

    // Simple logic for thresholds
    if (label.includes('DRR')) {
        if (val > 100) status = 'healthy';
        else if (val > 50) status = 'watch';
    } else {
        if (val > 5000) status = 'healthy';
        else if (val > 1000) status = 'watch';
    }

    const styles = {
        healthy: { bgcolor: "rgba(16, 185, 129, 0.12)", color: "#064e3b" },
        watch: { bgcolor: "rgba(245, 158, 11, 0.12)", color: "#92400e" },
        action: { bgcolor: "rgba(239, 68, 68, 0.12)", color: "#991b1b" }
    };
    return styles[status] || {};
};

// ---------------- COLUMN CONFIG ----------------
// Hierarchy Columns
const HIERARCHY_LEVELS = ["Platform", "Region", "City", "Category"];

// Metric Columns
const METRIC_HEADERS = [
    { label: "MTD SALES", align: "right" },
    { label: "PREV MONTH MTD", align: "right" },
    { label: "CURRENT DRR", align: "center" }, // Center for badge
    { label: "YTD SALES", align: "right" },
    { label: "LAST YEAR SALES", align: "right" },
    { label: "PROJECTED SALES", align: "right" },
];

// -------------- COMPONENT -----------------
export default function DrillDownSalesTable({ startDate, endDate, brand }) {
    const [hierarchyData, setHierarchyData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(new Set());
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ platform: [], region: [], city: [], keyword: [] });
    const [popupFilters, setPopupFilters] = useState({ platform: [], region: [], city: [], keyword: [] });
    const [fetchingChildrenId, setFetchingChildrenId] = useState(null);

    React.useEffect(() => {
        const loadPlatforms = async () => {
            setLoading(true);
            try {
                const data = await fetchSalesDrilldown({ level: 'platform', startDate, endDate, brand });
                const formatted = data.map(item => ({
                    id: item.name.toLowerCase(),
                    name: item.name,
                    type: "platform",
                    mtdSales: item.mtdSales,
                    prevMtd: item.prevMonthMtd,
                    drr: item.currentDrr,
                    ytdSales: item.ytdSales,
                    lastYear: item.lastYearSales,
                    projected: item.projectedSales,
                    children: []
                }));
                setHierarchyData(formatted);
            } catch (error) {
                console.error("Failed to fetch platforms:", error);
            } finally {
                setLoading(false);
            }
        };
        loadPlatforms();
    }, [startDate, endDate, brand]);

    const toggleExpand = async (key, row) => {
        const isCurrentlyExpanded = expanded.has(key);

        if (!isCurrentlyExpanded) {
            // If expanding, check if children are already loaded
            if (row.children && row.children.length === 0 && row.type !== 'category') {
                setLoading(true);
                setFetchingChildrenId(row.id);
                try {
                    let levelToFetch = '';
                    let params = {};

                    if (row.type === 'platform') {
                        levelToFetch = 'region';
                        params = { level: 'region', platform: row.name, startDate, endDate, brand };
                    } else if (row.type === 'region') {
                        levelToFetch = 'city';
                        const platformName = row.path[0];
                        params = { level: 'city', platform: platformName, region: row.name, startDate, endDate, brand };
                    } else if (row.type === 'city') {
                        levelToFetch = 'category';
                        const platformName = row.path[0];
                        const regionName = row.path[1];
                        params = { level: 'category', platform: platformName, region: regionName, location: row.name, startDate, endDate, brand };
                    }

                    if (levelToFetch) {
                        const data = await fetchSalesDrilldown(params);
                        const children = data.map(item => ({
                            id: `${row.id}-${item.name.toLowerCase()}`,
                            name: item.name,
                            type: levelToFetch,
                            mtdSales: item.mtdSales,
                            prevMtd: item.prevMonthMtd,
                            drr: item.currentDrr,
                            ytdSales: item.ytdSales,
                            lastYear: item.lastYearSales,
                            projected: item.projectedSales,
                            children: []
                        }));

                        // Update hierarchyData deep
                        setHierarchyData(prev => {
                            const newData = JSON.parse(JSON.stringify(prev));
                            const updateNode = (nodes) => {
                                for (let node of nodes) {
                                    if (node.id === row.id) {
                                        node.children = children;
                                        return true;
                                    }
                                    if (node.children && updateNode(node.children)) return true;
                                }
                                return false;
                            };
                            updateNode(newData);
                            return newData;
                        });
                    }
                } catch (error) {
                    console.error("Failed to fetch children:", error);
                } finally {
                    setLoading(false);
                    setFetchingChildrenId(null);
                }
            }
        }

        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Filter and Flatten Logic (adapted to hierarchyData state)
    const flattenedRows = useMemo(() => {
        const rows = [];
        const walk = (node, depth, parentPaths) => {
            const currentPath = {
                platform: depth === 0 ? node.name : parentPaths.platform,
                region: depth === 1 ? node.name : parentPaths.region,
                city: depth === 2 ? node.name : parentPaths.city,
                category: depth === 3 ? node.name : parentPaths.category,
            };

            const passesFilter =
                (filters.platform.length === 0 || depth < 0 || filters.platform.includes(currentPath.platform)) &&
                (filters.region.length === 0 || depth < 1 || filters.region.includes(currentPath.region)) &&
                (filters.city.length === 0 || depth < 2 || filters.city.includes(currentPath.city));

            if (!passesFilter) return;

            const fullIdPath = [...(parentPaths.fullIdPath || []), node.id];
            const nodePathNames = [...(parentPaths.nodePathNames || []), node.name];
            const key = fullIdPath.join(">");
            const isOpen = expanded.has(key);
            const children = node.children || [];
            // For lazy loading, we show expansion icon if it's not a category (or final level)
            const hasChildren = node.type !== 'category';

            rows.push({
                ...node,
                key,
                level: depth,
                path: nodePathNames, // Pass names for context if needed
                hasChildren
            });

            if (isOpen && children.length > 0) {
                children.forEach(child => walk(child, depth + 1, { ...currentPath, fullIdPath, nodePathNames }));
            }
        };

        hierarchyData.forEach(p => walk(p, 0, { platform: 'All', region: 'All', city: 'All', category: 'All', fullIdPath: [], nodePathNames: [] }));
        return rows;
    }, [filters, expanded, hierarchyData]);

    const totalPages = Math.max(1, Math.ceil(flattenedRows.length / rowsPerPage));
    const safePage = Math.max(1, Math.min(page, totalPages));

    const pageRows = useMemo(() => {
        const start = (safePage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        return flattenedRows.slice(start, end);
    }, [flattenedRows, safePage, rowsPerPage]);

    const expandAll = () => {
        const all = new Set();
        const traverse = (nodes, path = []) => {
            nodes.forEach(n => {
                const fullPath = [...path, n.id];
                const key = fullPath.join(">");
                if (n.children && n.children.length > 0) {
                    all.add(key);
                    traverse(n.children, fullPath);
                }
            });
        };
        traverse(hierarchyData);
        setExpanded(all);
    };

    const collapseAll = () => setExpanded(new Set());

    // Filter options based on loaded hierarchyData
    const filterOptionsData = useMemo(() => {
        const platforms = new Set(["All"]);
        const regions = new Set(["All"]);
        const cities = new Set(["All"]);

        const traverse = (nodes) => {
            nodes.forEach(n => {
                if (n.type === 'platform') platforms.add(n.name);
                if (n.type === 'region') regions.add(n.name);
                if (n.type === 'city') cities.add(n.name);
                if (n.children) traverse(n.children);
            });
        };
        traverse(hierarchyData);

        return {
            platforms: Array.from(platforms).map(v => ({ id: v, label: v })),
            regions: Array.from(regions).map(v => ({ id: v, label: v })),
            cities: Array.from(cities).map(v => ({ id: v, label: v })),
            keywords: [{ id: "All", label: "All" }],
        };
    }, [hierarchyData]);

    const sectionConfig = [
        { id: "platforms", label: "Platforms" },
        { id: "regions", label: "Regions" },
        { id: "cities", label: "Cities" },
    ];

    const maxVisibleDepth = useMemo(() => {
        let maxDepth = 0;
        expanded.forEach(key => {
            const depth = key.split('>').length;
            if (depth > maxDepth) maxDepth = depth;
        });
        return Math.min(maxDepth, HIERARCHY_LEVELS.length - 1);
    }, [expanded]);

    const visibleHierarchyCols = HIERARCHY_LEVELS.slice(0, maxVisibleDepth + 1);

    const renderRow = (row) => {
        const { key, level, name, hasChildren, mtdSales, prevMtd, drr, ytdSales, lastYear, projected } = row;
        const isOpen = expanded.has(key);
        const isPlatform = level === 0;
        const rowBg = "#fff";

        return (
            <TableRow
                key={key}
                component={motion.tr}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                sx={{
                    backgroundColor: rowBg,
                    "&:hover": { backgroundColor: "#f8fafc" },
                    borderBottom: "1px solid #f1f5f9"
                }}
            >
                {visibleHierarchyCols.map((colName, colIndex) => {
                    const isCurrentLevel = colIndex === level;
                    const isFirstCol = colIndex === 0;
                    const stickyStyle = isFirstCol ? {
                        position: "sticky", left: 0, zIndex: 10, backgroundColor: rowBg, minWidth: 150, borderRight: "1px solid #f1f5f9"
                    } : {};

                    if (isCurrentLevel) {
                        return (
                            <TableCell key={colIndex} sx={{ ...stickyStyle, py: 1.5 }}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Box sx={{ width: 20, display: "flex", justifyContent: "center" }}>
                                        {fetchingChildrenId === row.id ? (
                                            <CircularProgress size={12} sx={{ color: "#64748b" }} />
                                        ) : hasChildren ? (
                                            <IconButton
                                                size="small"
                                                onClick={() => toggleExpand(key, row)}
                                                sx={{
                                                    width: 20, height: 20,
                                                    borderRadius: 1,
                                                    border: "1px solid #e2e8f0",
                                                    color: "#64748b",
                                                    bgcolor: isOpen ? "#f1f5f9" : "transparent"
                                                }}
                                            >
                                                {isOpen ? <Minus size={12} /> : <Plus size={12} />}
                                            </IconButton>
                                        ) : (
                                            <Box sx={{ width: 20 }} />
                                        )}
                                    </Box>
                                    <Typography sx={{ fontSize: 13, fontWeight: isPlatform ? 700 : 500, color: "#1e293b" }}>
                                        {name}
                                    </Typography>
                                </Box>
                            </TableCell>
                        );
                    } else {
                        return (
                            <TableCell key={colIndex} sx={{ ...stickyStyle, color: "#cbd5e1" }}>
                                –
                            </TableCell>
                        );
                    }
                })}

                <TableCell align="right">
                    <Box display="inline-flex" alignItems="center" justifyContent="center"
                        sx={{ ...getMetricStyle('MTD Sales', mtdSales), borderRadius: 1, px: 1, py: 0.5, minWidth: 50 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                            {fmt(mtdSales)}
                        </Typography>
                    </Box>
                </TableCell>

                <TableCell align="right">
                    <Box display="inline-flex" alignItems="center" justifyContent="center"
                        sx={{ ...getMetricStyle('Prev Month', prevMtd), borderRadius: 1, px: 1, py: 0.5, minWidth: 50 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                            {fmt(prevMtd)}
                        </Typography>
                    </Box>
                </TableCell>

                <TableCell align="center">
                    <Box
                        display="inline-flex"
                        alignItems="center"
                        justifyContent="center"
                        sx={{
                            ...getMetricStyle('DRR', drr),
                            borderRadius: 1,
                            px: 1,
                            py: 0.5,
                            minWidth: 50
                        }}
                    >
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                            {fmt(drr)}
                        </Typography>
                    </Box>
                </TableCell>

                <TableCell align="right">
                    <Box display="inline-flex" alignItems="center" justifyContent="center"
                        sx={{ ...getMetricStyle('YTD Sales', ytdSales), borderRadius: 1, px: 1, py: 0.5, minWidth: 50 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                            {fmt(ytdSales)}
                        </Typography>
                    </Box>
                </TableCell>

                <TableCell align="right">
                    <Box display="inline-flex" alignItems="center" justifyContent="center"
                        sx={{ ...getMetricStyle('Last Year', lastYear), borderRadius: 1, px: 1, py: 0.5, minWidth: 50 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                            {fmt(lastYear)}
                        </Typography>
                    </Box>
                </TableCell>

                <TableCell align="right">
                    <Box display="inline-flex" alignItems="center" justifyContent="center"
                        sx={{ ...getMetricStyle('Projected', projected), borderRadius: 1, px: 1, py: 0.5, minWidth: 50 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                            {fmt(projected)}
                        </Typography>
                    </Box>
                </TableCell>
            </TableRow>
        );
    };

    return (
        <div className="flex w-full flex-col rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-4 pb-2">
                <div>
                    <h1 className="text-lg font-semibold text-slate-900">Sales at a glance</h1>
                    <p className="text-sm text-slate-500">Hierarchical drilldown with daily and cumulative sales metrics.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-6 w-px bg-slate-200"></div>
                    <button
                        onClick={() => setShowFilterPanel(true)}
                        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>Filters</span>
                    </button>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Healthy
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50/50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                            Watch
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50/50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                            Action
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <div className="flex items-center justify-between mb-3 px-2">
                    <div className="text-[11px] text-slate-500 font-medium uppercase tracking-tight">
                        Platform → Region → City → Category
                    </div>
                    <Box display="flex" gap={1}>
                        <Button
                            onClick={expandAll}
                            size="small"
                            sx={{
                                textTransform: "none", fontSize: 10, fontWeight: 700,
                                bgcolor: "#f0f9ff", color: "#0369a1", borderRadius: "20px", px: 2, py: 0.2,
                                '&:hover': { bgcolor: '#e0f2fe' }
                            }}
                        >
                            Expand All
                        </Button>
                        <Button
                            onClick={collapseAll}
                            size="small"
                            sx={{
                                textTransform: "none", fontSize: 10, fontWeight: 700,
                                bgcolor: "#fef2f2", color: "#b91c1c", borderRadius: "20px", px: 2, py: 0.2,
                                '&:hover': { bgcolor: '#fee2e2' }
                            }}
                        >
                            Collapse All
                        </Button>
                    </Box>
                </div>

                {loading && (
                    <LinearProgress
                        sx={{
                            height: 2,
                            bgcolor: 'rgba(16, 185, 129, 0.1)',
                            '& .MuiLinearProgress-bar': { bgcolor: '#10b981' }
                        }}
                    />
                )}

                <TableContainer sx={{ maxHeight: 600, border: 'none' }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                {visibleHierarchyCols.map((label, i) => (
                                    <TableCell
                                        key={i}
                                        sx={{
                                            py: 1.5, fontSize: 12, fontWeight: 700,
                                            color: "#475569", bgcolor: "#f8fafc", borderBottom: "1px solid #f1f5f9",
                                            ...(i === 0 ? { position: "sticky", left: 0, zIndex: 20 } : {})
                                        }}
                                    >
                                        {label}
                                    </TableCell>
                                ))}
                                {METRIC_HEADERS.map((h, i) => (
                                    <TableCell
                                        key={i + visibleHierarchyCols.length}
                                        align={h.align}
                                        sx={{
                                            py: 1.5, fontSize: 12, fontWeight: 700,
                                            color: "#475569", bgcolor: "#f8fafc", borderBottom: "1px solid #f1f5f9"
                                        }}
                                    >
                                        {h.label}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading && pageRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={visibleHierarchyCols.length + METRIC_HEADERS.length} align="center" sx={{ py: 10 }}>
                                        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                                            <CircularProgress size={40} sx={{ color: "#10b981" }} />
                                            <Typography sx={{ color: "#64748b", fontSize: 14, fontWeight: 500 }}>
                                                Loading data...
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : pageRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={visibleHierarchyCols.length + METRIC_HEADERS.length} align="center" sx={{ py: 10 }}>
                                        <Typography sx={{ color: "#64748b", fontSize: 14, fontWeight: 500 }}>
                                            No data found.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pageRows.map(row => renderRow(row))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <PaginationFooter
                    isVisible={true}
                    currentPage={safePage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    pageSize={rowsPerPage}
                    onPageSizeChange={setRowsPerPage}
                />
            </div>
            {showFilterPanel && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pb-4 pt-52 transition-all backdrop-blur-sm">
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
                                sectionConfig={sectionConfig}
                                platforms={filterOptionsData.platforms}
                                regions={filterOptionsData.regions}
                                cities={filterOptionsData.cities}
                                keywords={filterOptionsData.keywords}
                                onPlatformChange={(vals) => setPopupFilters(prev => ({ ...prev, platform: vals.filter(v => v !== 'All') }))}
                                onRegionChange={(vals) => setPopupFilters(prev => ({ ...prev, region: vals.filter(v => v !== 'All') }))}
                                onCityChange={(vals) => setPopupFilters(prev => ({ ...prev, city: vals.filter(v => v !== 'All') }))}
                                onKeywordChange={(vals) => setPopupFilters(prev => ({ ...prev, keyword: vals.filter(v => v !== 'All') }))}
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
            )}
        </div>
    );
}
