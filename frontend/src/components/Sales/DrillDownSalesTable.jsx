import React, { useState, useMemo } from "react";
import {
    Box,
    Card,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Button
} from "@mui/material";
import { motion } from "framer-motion";
import { Plus, Minus, LineChartIcon } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                MOCK DATA                                   */
/* -------------------------------------------------------------------------- */

const generateMetrics = (baseMtd) => ({
    mtdSales: baseMtd,
    prevMtd: baseMtd * (0.8 + Math.random() * 0.4),
    drr: baseMtd / 30, // rough daily rate
    ytdSales: baseMtd * (10 + Math.random() * 3),
    lastYear: baseMtd * (0.9 + Math.random() * 0.3) * 12,
    projected: baseMtd * (1.0 + Math.random() * 0.1),
});

// Helper to add keywords to a city
const withKeywords = (cityNode) => {
    const keywords = [
        "Sandwich, Cakes & Others",
        "ice cream cake",
        "ice cream",
        "Gourmet",
    ];
    return {
        ...cityNode,
        children: keywords.map((k, i) => ({
            id: `${cityNode.id}-kw-${i}`,
            name: k,
            type: "keyword", // Level 3 (0-indexed: Platform, Region, City, Keyword)
            ...generateMetrics(cityNode.mtdSales / keywords.length)
        }))
    };
};

const DATA_HIERARCHY = [
    {
        id: "flipkart",
        name: "Flipkart",
        type: "platform",
        ...generateMetrics(8981.9),
        children: [
            {
                id: "fl-north1",
                name: "North 1",
                type: "region",
                ...generateMetrics(3000),
                children: [
                    withKeywords({ id: "fl-n1-delhi", name: "Delhi", type: "city", ...generateMetrics(1500) }),
                    withKeywords({ id: "fl-n1-gurgaon", name: "Gurgaon", type: "city", ...generateMetrics(800) }),
                    withKeywords({ id: "fl-n1-noida", name: "Noida", type: "city", ...generateMetrics(700) }),
                ],
            },
            {
                id: "fl-north2",
                name: "North 2",
                type: "region",
                ...generateMetrics(2500),
                children: [
                    withKeywords({ id: "fl-n2-lucknow", name: "Lucknow", type: "city", ...generateMetrics(1200) }),
                    withKeywords({ id: "fl-n2-jaipur", name: "Jaipur", type: "city", ...generateMetrics(1300) }),
                ]
            },
            {
                id: "fl-south",
                name: "South",
                type: "region",
                ...generateMetrics(4000),
                children: [
                    withKeywords({ id: "fl-s-bangalore", name: "Bangalore", type: "city", ...generateMetrics(2000) }),
                    withKeywords({ id: "fl-s-hyderabad", name: "Hyderabad", type: "city", ...generateMetrics(1200) }),
                    withKeywords({ id: "fl-s-chennai", name: "Chennai", type: "city", ...generateMetrics(800) }),
                ]
            },
            {
                id: "fl-west",
                name: "West",
                type: "region",
                ...generateMetrics(3500),
                children: [
                    withKeywords({ id: "fl-w-mumbai", name: "Mumbai", type: "city", ...generateMetrics(2000) }),
                    withKeywords({ id: "fl-w-pune", name: "Pune", type: "city", ...generateMetrics(800) }),
                    withKeywords({ id: "fl-w-ahmedabad", name: "Ahmedabad", type: "city", ...generateMetrics(700) }),
                ]
            },
            {
                id: "fl-east",
                name: "East",
                type: "region",
                ...generateMetrics(1500),
                children: [
                    withKeywords({ id: "fl-e-kolkata", name: "Kolkata", type: "city", ...generateMetrics(1000) }),
                    withKeywords({ id: "fl-e-patna", name: "Patna", type: "city", ...generateMetrics(500) }),
                ]
            }
        ],
    },
    {
        id: "amazon",
        name: "Amazon",
        type: "platform",
        ...generateMetrics(7500.5),
        children: [
            {
                id: "amz-metro",
                name: "Metros",
                type: "region",
                ...generateMetrics(5000),
                children: [
                    withKeywords({ id: "amz-dl", name: "Delhi", type: "city", ...generateMetrics(2000) }),
                    withKeywords({ id: "amz-bom", name: "Mumbai", type: "city", ...generateMetrics(1800) }),
                    withKeywords({ id: "amz-blr", name: "Bangalore", type: "city", ...generateMetrics(1200) }),
                ]
            },
            {
                id: "amz-t2",
                name: "Tier 2",
                type: "region",
                ...generateMetrics(2500),
                children: [
                    withKeywords({ id: "amz-lko", name: "Lucknow", type: "city", ...generateMetrics(800) }),
                    withKeywords({ id: "amz-ind", name: "Indore", type: "city", ...generateMetrics(700) }),
                    withKeywords({ id: "amz-kop", name: "Kanpur", type: "city", ...generateMetrics(1000) }),
                ]
            }
        ]
    },
    {
        id: "zepto",
        name: "Zepto",
        type: "platform",
        ...generateMetrics(546.6),
        children: [
            {
                id: "zp-mumbai",
                name: "Mumbai Region",
                type: "region",
                ...generateMetrics(300),
                children: [
                    withKeywords({ id: "zp-mum-all", name: "Mumbai", type: "city", ...generateMetrics(300) }),
                ],
            },
            {
                id: "zp-bangalore",
                name: "Bangalore Region",
                type: "region",
                ...generateMetrics(246.6),
                children: [
                    withKeywords({ id: "zp-blr-all", name: "Bangalore", type: "city", ...generateMetrics(246.6) }),
                ],
            },
        ],
    },
    {
        id: "blinkit",
        name: "Blinkit",
        type: "platform",
        ...generateMetrics(360.3),
        children: [
            {
                id: "bk-ncr",
                name: "NCR",
                type: "region",
                ...generateMetrics(360),
                children: [
                    withKeywords({ id: "bk-delhi", name: "Delhi", type: "city", ...generateMetrics(200) }),
                    withKeywords({ id: "bk-ggn", name: "Gurgaon", type: "city", ...generateMetrics(100) }),
                    withKeywords({ id: "bk-noida", name: "Noida", type: "city", ...generateMetrics(60) }),
                ]
            }
        ]
    },
    {
        id: "instamart",
        name: "Instamart",
        type: "platform",
        ...generateMetrics(244.1),
        children: [
            {
                id: "im-south",
                name: "South",
                type: "region",
                ...generateMetrics(200),
                children: [
                    withKeywords({ id: "im-blr", name: "Bangalore", type: "city", ...generateMetrics(150) }),
                    withKeywords({ id: "im-hyd", name: "Hyderabad", type: "city", ...generateMetrics(50) }),
                ]
            }
        ]
    },
    {
        id: "bigbasket",
        name: "Bigbasket",
        type: "platform",
        ...generateMetrics(83.9),
        children: [
            {
                id: "bb-tier1",
                name: "Tier 1",
                type: "region",
                ...generateMetrics(83.9),
                children: [
                    withKeywords({ id: "bb-mum", name: "Mumbai", type: "city", ...generateMetrics(40) }),
                    withKeywords({ id: "bb-dl", name: "Delhi", type: "city", ...generateMetrics(43.9) }),
                ]
            }
        ]
    },
    {
        id: "virtualstore",
        name: "Virtual Store",
        type: "platform",
        ...generateMetrics(36.8),
        children: []
    }
];

// ---------------- COLUMN CONFIG ----------------
// Hierarchy Columns
const HIERARCHY_LEVELS = ["Platform", "Region", "City", "Keyword"];

// Metric Columns
const METRIC_HEADERS = [
    { label: "MTD SALES", align: "right" },
    { label: "PREV MONTH MTD", align: "right" },
    { label: "CURRENT DRR", align: "center" }, // Center for badge
    { label: "YTD SALES", align: "right" },
    { label: "LAST YEAR SALES", align: "right" },
    { label: "PROJECTED SALES", align: "right" },
];

// Helper to format numbers
const fmt = (n) => n?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || "0";

// -------------- COMPONENT -----------------
export default function DrillDownSalesTable() {
    const [expanded, setExpanded] = useState({}); // Default expanded for demo
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [page, setPage] = useState(1);

    const totalPages = Math.max(1, Math.ceil(DATA_HIERARCHY.length / rowsPerPage));
    const safePage = Math.max(1, Math.min(page, totalPages));

    const pageRows = useMemo(() => {
        const start = (safePage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        return DATA_HIERARCHY.slice(start, end);
    }, [safePage, rowsPerPage]);


    const expandAll = () => {
        const all = {};
        const traverse = (nodes, path = []) => {
            nodes.forEach(n => {
                const key = [...path, n.id].join(">");
                if (n.children && n.children.length > 0) {
                    all[key] = true;
                    traverse(n.children, [...path, n.id]);
                }
            });
        };
        traverse(DATA_HIERARCHY);
        setExpanded(all);
    };

    const collapseAll = () => setExpanded({});

    // Dynamic Column Visibility Logic
    // Compute the max depth currently visible based on expansion
    const maxVisibleDepth = useMemo(() => {
        let maxDepth = 0; // Default: Only Platform visible

        Object.keys(expanded).forEach(key => {
            if (expanded[key]) {
                // If key is "flipkart" (depth 0 expanded), we show depth 1 (Region)
                // If "flipkart>north1" (depth 1 expanded), we show depth 2 (City)
                const depth = key.split('>').length;
                if (depth > maxDepth) {
                    maxDepth = depth;
                }
            }
        });

        // Cap at Max Hierarchy Level
        return Math.min(maxDepth, HIERARCHY_LEVELS.length - 1);
    }, [expanded]);

    const visibleHierarchyCols = HIERARCHY_LEVELS.slice(0, maxVisibleDepth + 1);

    // Helper/Recursive renderer matching HeatMapDrillTable style
    const renderRow = (node, level = 0, path = []) => {
        const fullPath = [...path, node.id];
        const key = fullPath.join(">");
        const isOpen = expanded[key];
        const children = node.children || [];
        const hasChildren = children.length > 0;

        // Determine row background
        // Level 0 (Platform) gets slight gray, Level 3 (Keyword) gets white etc.
        // Mimicking the reference image style
        const isPlatform = level === 0;
        const rowBg = isPlatform ? "#fff" : "#fff";

        return (
            <React.Fragment key={key}>
                <TableRow
                    component={motion.tr}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    sx={{
                        backgroundColor: rowBg,
                        "&:hover": { backgroundColor: "#f8fafc" },
                        borderBottom: "1px solid #f1f5f9"
                    }}
                >
                    {/* HIERARCHY COLUMNS */}
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
                                        {/* Expand Button box */}
                                        <Box sx={{ width: 20, display: "flex", justifyContent: "center" }}>
                                            {hasChildren ? (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
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
                                            {node.name}
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

                    {/* METRIC COLUMNS */}
                    {/* MTD SALES */}
                    <TableCell align="right">
                        <Typography sx={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                            {fmt(node.mtdSales)}
                        </Typography>
                    </TableCell>

                    {/* PREV MTD */}
                    <TableCell align="right">
                        <Typography sx={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>
                            {fmt(node.prevMtd)}
                        </Typography>
                    </TableCell>

                    {/* CURRENT DRR (Badge) */}
                    <TableCell align="center">
                        <Box
                            display="inline-flex"
                            alignItems="center"
                            justifyContent="center"
                            sx={{
                                bgcolor: "rgba(13, 148, 136, 0.1)", // Teal background tint
                                color: "#0f766e",
                                borderRadius: 1,
                                px: 1,
                                py: 0.5,
                                minWidth: 50
                            }}
                        >
                            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                                {fmt(node.drr)}
                            </Typography>
                        </Box>
                    </TableCell>

                    {/* YTD SALES */}
                    <TableCell align="right">
                        <Typography sx={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                            {fmt(node.ytdSales)}
                        </Typography>
                    </TableCell>

                    {/* LAST YEAR */}
                    <TableCell align="right">
                        <Typography sx={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>
                            {fmt(node.lastYear)}
                        </Typography>
                    </TableCell>

                    {/* PROJECTED */}
                    <TableCell align="right">
                        <Typography sx={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                            {fmt(node.projected)}
                        </Typography>
                    </TableCell>

                </TableRow>

                {/* RECURSION */}
                {isOpen && children.map(child => renderRow(child, level + 1, fullPath))}
            </React.Fragment>
        );
    };

    return (
        <Card
            sx={{
                borderRadius: 3,
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                bgcolor: "white",
                p: 2
            }}
        >
            {/* HEADER CONTROLS */}
            <Box display="flex" justifyContent="flex-end" mb={2} gap={1}>
                <Button onClick={expandAll} size="small" sx={{ textTransform: "none", fontSize: 12, bgcolor: "#e0f2fe", color: "#0284c7" }}>Expand All</Button>
                <Button onClick={collapseAll} size="small" sx={{ textTransform: "none", fontSize: 12, bgcolor: "#fee2e2", color: "#dc2626" }}>Collapse All</Button>
            </Box>

            <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            {visibleHierarchyCols.map((label, i) => (
                                <TableCell
                                    key={i}
                                    sx={{
                                        py: 2,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "#64748b",
                                        bgcolor: "#f8fafc",
                                        borderBottom: "1px solid #e2e8f0",
                                        ...(i === 0 ? { position: "sticky", left: 0, zIndex: 20 } : {})
                                    }}
                                >
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        {label}
                                        {/* {i > 0 && <LineChartIcon className="w-3 h-3 text-slate-400" />} */}
                                    </Box>
                                </TableCell>
                            ))}
                            {METRIC_HEADERS.map((h, i) => (
                                <TableCell
                                    key={i + visibleHierarchyCols.length}
                                    align={h.align}
                                    sx={{
                                        py: 2,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "#64748b",
                                        bgcolor: "#f8fafc",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}
                                >
                                    <Box display="flex" alignItems="center" justifyContent={h.align === "left" ? "flex-start" : h.align === "right" ? "flex-end" : "center"} gap={0.5}>
                                        {h.label}
                                        {/* <LineChartIcon className="w-3 h-3 text-slate-400" /> */}
                                    </Box>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {pageRows.map(row => renderRow(row))}
                    </TableBody>
                </Table>
            </TableContainer>

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

        </Card>
    );
}
