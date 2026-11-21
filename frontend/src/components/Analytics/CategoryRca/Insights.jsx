// import React, { useState } from "react";
// import {
//   Box,
//   Paper,
//   Avatar,
//   Typography,
//   Chip,
// } from "@mui/material";
// import { TrendingUp } from "@mui/icons-material";
// import ProductCard from "./ProductCard";

// export default function Insights({ products, onKnowMore }) {
//   const [activeTab, setActiveTab] = useState("drainers");

//   const tabs = [
//     { id: "drainers", label: "#Top Drainers", count: 5 },
//     { id: "gainers", label: "#Top Gainers", count: 5 },
//     { id: "availDrop", label: "#Availability Drop", count: 5 },
//     { id: "availGain", label: "#Availability Gain", count: 5 },
//   ];

//   return (
//     <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: "divider" }}>
//       <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
//         <Avatar
//           sx={{
//             width: 32,
//             height: 32,
//             bgcolor: "grey.100",
//             borderRadius: 1.5,
//           }}
//         >
//           <TrendingUp sx={{ fontSize: 20, color: "text.secondary" }} />
//         </Avatar>
//         <Typography variant="h6" fontWeight={600}>
//           Insights
//         </Typography>

//       </Box>

//       <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
//         {tabs.map((tab) => (
//           <Chip
//             key={tab.id}
//             label={
//               <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
//                 {tab.label}
//                 <Chip
//                   label={tab.count}
//                   size="small"
//                   sx={{
//                     height: 20,
//                     bgcolor:
//                       activeTab === tab.id
//                         ? "white"
//                         : "rgba(255, 255, 255, 0.3)",
//                     color: activeTab === tab.id ? "primary.main" : "inherit",
//                     "& .MuiChip-label": { px: 1, fontSize: "0.75rem" },
//                   }}
//                 />
//               </Box>
//             }
//             onClick={() => setActiveTab(tab.id)}
//             sx={{
//               bgcolor: activeTab === tab.id ? "primary.main" : "grey.100",
//               color: activeTab === tab.id ? "white" : "text.primary",
//               fontWeight: 500,
//               "&:hover": {
//                 bgcolor: activeTab === tab.id ? "primary.dark" : "grey.200",
//               },
//             }}
//           />
//         ))}
//       </Box>

//       <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 1 }}>
//         {products.map((product) => (
//           <ProductCard
//             key={product.id}
//             product={product}
//             onKnowMore={onKnowMore}
//           />
//         ))}
//       </Box>
//     </Paper>
//   );
// }






// components/KpiDrillDownTable.jsx

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  Box,
  Card,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tabs,
  Tab,
  Chip,
} from "@mui/material";
import { motion } from "framer-motion";
import { Plus, Minus, TrendingUp } from "lucide-react";
import EChartsWrapper from "../../EChartsWrapper";
import { TABS_META, KPI_HEADERS, kpiDrillDataByTab } from "./DataRcaCenter";

// --------- HELPERS ---------
const parsePercent = (v) =>
  typeof v === "string" && v.toString().includes("%")
    ? parseFloat(v.replace("%", ""))
    : Number(v || 0);

// A2c, Availability, SOS, Market Share are % in your table
const PERCENT_COL_INDICES = [4, 5, 6, 7];

// For trend chart we also treat Promo My Brand & Promo Compete as %
const PERCENT_TREND_INDICES = [4, 5, 6, 7, 8, 9];

const getHeatStyle = (val, index) => {
  if (!PERCENT_COL_INDICES.includes(index)) return {};
  const n = parsePercent(val);
  if (isNaN(n)) return {};
  if (n >= 95)
    return { backgroundColor: "rgba(22,163,74,0.12)", color: "#166534" };
  if (n >= 90)
    return { backgroundColor: "rgba(234,179,8,0.12)", color: "#854d0e" };
  return { backgroundColor: "rgba(239,68,68,0.12)", color: "#991b1b" };
};

const rowPercentAvg = (values) => {
  const nums = values
    .map((v, idx) =>
      PERCENT_COL_INDICES.includes(idx)
        ? parsePercent(v?.value ?? v)
        : NaN
    )
    .filter((x) => !isNaN(x));

  if (!nums.length) return "–";
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) + "%";
};

const getMaxDepth = (nodes, depth = 0) => {
  let max = depth;
  nodes.forEach((node) => {
    if (node.children?.length) {
      max = Math.max(max, getMaxDepth(node.children, depth + 1));
    }
  });
  return max;
};

const LEVEL_TITLES = {
  0: "Category",
  1: "Brand",
  2: "City",
  3: "SKU",
};

const rowsPerPage = 5;

// --------- TREND HELPERS (quarters) ---------
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

const getQuarterValues = (values, quarter) => {
  // mild synthetic trend factors
  const factorMap = { Q1: 1, Q2: 1.06, Q3: 0.97, Q4: 1.12 };
  const deltaMap = { Q1: 0, Q2: 0.3, Q3: -0.2, Q4: 0.6 };

  const factor = factorMap[quarter] ?? 1;
  const delta = deltaMap[quarter] ?? 0;

  return values.map((cell, idx) => {
    const raw = typeof cell === "object" ? cell.value : cell;

    if (raw == null || raw === "–") return raw;

    // Percent-style KPI
    if (PERCENT_TREND_INDICES.includes(idx)) {
      const base = parsePercent(raw);
      if (isNaN(base)) return raw;
      const qVal = base + delta;
      return `${qVal.toFixed(1)}%`;
    }

    // Numeric KPI
    const baseNum = Number(String(raw).replace(/,/g, ""));
    if (isNaN(baseNum)) return raw;
    const qVal = baseNum * factor;
    const isInt = Number.isInteger(baseNum);
    return isInt ? Math.round(qVal) : qVal.toFixed(1);
  });
};

// Build metric config dynamically from KPI_HEADERS
const metricKeyFromLabel = (label) =>
  label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

const METRICS = KPI_HEADERS.map((label, index) => ({
  key: metricKeyFromLabel(label),
  label,
  index,
  isPercent: PERCENT_TREND_INDICES.includes(index),
}));

export default function Insights() {
  const [activeTabKey, setActiveTabKey] = useState("gainers");
  const [expanded, setExpanded] = useState({});
  const [page, setPage] = useState(0);


  // Trend drawer state
  const [trendState, setTrendState] = useState(null); // { node, path }
  const [chartType, setChartType] = useState("line"); // 'line' | 'area' | 'bar'
  const [selectedMetrics, setSelectedMetrics] = useState(() =>
    METRICS.filter((m) =>
      ["offtakes", "spend", "roas", "availability", "sos"].includes(m.key)
    ).map((m) => m.key)
  );

  const activeData = kpiDrillDataByTab[activeTabKey];
  const maxDepth = useMemo(
    () => getMaxDepth(activeData.rows),
    [activeData.rows]
  );
  const totalHierarchyCols = maxDepth + 1;
  const filteredRows = activeData.rows;

  const getDeepNodes = (nodes, exp, path = [], res = []) => {
    nodes.forEach((node) => {
      const k = [...path, node.label].join(">");
      if (node.children?.length && exp[k]) {
        getDeepNodes(node.children, exp, [...path, node.label], res);
      } else {
        res.push(node);
      }
    });
    return res;
  };

  const deepRows = getDeepNodes(filteredRows, expanded);

  const totals = KPI_HEADERS.map((_, idx) => {
    const vals = deepRows.map((r) => r.values[idx]);
    const nums = vals
      .map((v) => parseFloat(String(v?.value ?? v).replace("%", "")))
      .filter((x) => !isNaN(x));

    if (!nums.length) return "–";
    const isPercent = PERCENT_COL_INDICES.includes(idx);

    if (isPercent) {
      return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) + "%";
    }
    return nums.reduce((a, b) => a + b, 0).toLocaleString();
  });

  const expandAll = () => {
    const newState = {};
    const walk = (nodes, path = []) => {
      nodes.forEach((node) => {
        const key = [...path, node.label].join(">");
        if (node.children?.length) {
          newState[key] = true;
          walk(node.children, [...path, node.label]);
        }
      });
    };
    walk(filteredRows);
    setExpanded(newState);
  };

  const collapseAll = () => setExpanded({});

  // ---------- TREND DATA BUILD ----------

  const buildTrendData = (node) => {
    if (!node || !node.values) return [];
    return QUARTERS.map((q) => {
      const vals = getQuarterValues(node.values, q);
      const row = { quarter: q };

      METRICS.forEach((m) => {
        const cell = vals[m.index];
        const raw = cell?.value ?? cell;
        if (raw == null || raw === "–") {
          row[m.key] = null;
        } else {
          const num = m.isPercent
            ? parsePercent(raw)
            : Number(String(raw).replace(/,/g, ""));
          row[m.key] = isNaN(num) ? null : num;
        }
      });

      return row;
    });
  };

  const trendData = trendState ? buildTrendData(trendState.node) : [];
  const trendTitle = trendState ? trendState.path.join(" → ") : "";

  const toggleMetric = (key) => {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const getTrendOption = () => {
    if (!trendState || !trendData.length) return {};

    const typeMap = {
      line: "line",
      bar: "bar",
      area: "line",
    };

    const valueMetrics = METRICS.filter(
      (m) => !m.isPercent && selectedMetrics.includes(m.key)
    );
    const percentMetrics = METRICS.filter(
      (m) => m.isPercent && selectedMetrics.includes(m.key)
    );

    const series = [];

    valueMetrics.forEach((m) => {
      series.push({
        name: m.label,
        type: typeMap[chartType],
        yAxisIndex: 0,
        smooth: true,
        data: trendData.map((d) => d[m.key]),
        areaStyle: chartType === "area" ? { opacity: 0.12 } : undefined,
      });
    });

    percentMetrics.forEach((m) => {
      series.push({
        name: m.label,
        type: typeMap[chartType],
        yAxisIndex: 1,
        smooth: true,
        data: trendData.map((d) => d[m.key]),
        areaStyle: chartType === "area" ? { opacity: 0.12 } : undefined,
      });
    });

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
      },
      legend: {
        top: 0,
        textStyle: { color: "#0f172a", fontSize: 11 },
      },
      grid: {
        left: 40,
        right: 50,
        top: 40,
        bottom: 50,
      },
      xAxis: {
        type: "category",
        data: trendData.map((d) => d.quarter),
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { color: "#64748b", fontSize: 11 },
      },
      yAxis: [
        {
          type: "value",
          name: "Value",
          axisLine: { lineStyle: { color: "#cbd5e1" } },
          splitLine: { lineStyle: { color: "#e5e7eb" } },
          axisLabel: { color: "#64748b", fontSize: 11 },
        },
        {
          type: "value",
          name: "%",
          axisLine: { lineStyle: { color: "#cbd5e1" } },
          splitLine: { show: false },
          axisLabel: {
            color: "#64748b",
            fontSize: 11,
            formatter: (v) => `${v}%`,
          },
        },
      ],
      dataZoom: [
        {
          type: "inside",
          start: 0,
          end: 100,
        },
        {
          type: "slider",
          start: 0,
          end: 100,
          bottom: 10,
          height: 18,
          borderColor: "#e5e7eb",
          handleStyle: { color: "#6366F1" },
          textStyle: { color: "#64748b" },
        },
      ],
      series,
    };
  };

  // 🔥 RENDER ROW WITH TREND BUTTON 🔥
  const renderRow = (node, level = 0, path = []) => {
    const fullPath = [...path, node.label];
    const key = fullPath.join(">");
    const isOpen = expanded[key];
    const children = node.children || [];
    const hasChildren = !!children.length;

    const avg = rowPercentAvg(node.values);
    const rowBg = level === 0 ? "#f8fafc" : "#fff";

    return (
      <React.Fragment key={key}>
        <TableRow
          component={motion.tr}
          layout
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          sx={{ backgroundColor: rowBg }}
        >
          {/* HIERARCHY COLUMNS */}
          {Array.from({ length: totalHierarchyCols }).map((_, col) => {
            const sticky =
              col === 0
                ? {
                  position: "sticky",
                  left: 0,
                  zIndex: 10,
                  backgroundColor: rowBg,
                  minWidth: 180,
                  borderRight: "1px solid #e5e7eb",
                }
                : {};

            if (col === level) {
              return (
                <TableCell key={col} sx={sticky}>
                  <Box display="flex" alignItems="center" gap={1.2}>
                    {hasChildren ? (
                      <IconButton
                        size="small"
                        onClick={() =>
                          setExpanded((p) => ({ ...p, [key]: !p[key] }))
                        }
                        sx={{
                          border: "1px solid #e5e7eb",
                          width: 26,
                          height: 26,
                          borderRadius: 1,
                        }}
                      >
                        {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                      </IconButton>
                    ) : (
                      <Box sx={{ width: 26 }} />
                    )}

                    <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                      {node.label}
                    </Typography>
                  </Box>
                </TableCell>
              );
            }

            return <TableCell key={col} sx={sticky}></TableCell>;
          })}

          {/* KPI CELLS */}
          {node.values.map((cell, i) => {
            const v = typeof cell === "object" ? cell.value : cell;
            const trend = typeof cell === "object" ? cell.trend : null;

            const heat = getHeatStyle(v, i);
            const isPercentDisplay = PERCENT_COL_INDICES.includes(i);

            const TrendIcon =
              trend === "up" ? (
                <span style={{ color: "#16a34a", marginLeft: 4 }}>▲</span>
              ) : trend === "down" ? (
                <span style={{ color: "#dc2626", marginLeft: 4 }}>▼</span>
              ) : trend === "flat" ? (
                <span style={{ color: "#6b7280", marginLeft: 4 }}>▬</span>
              ) : null;

            const displayValue =
              typeof v === "number" && !isPercentDisplay
                ? v.toLocaleString()
                : v ?? "–";

            return (
              <TableCell key={i} align="right">
                <Box
                  sx={{
                    px: 1,
                    py: 0.3,
                    borderRadius: 1,
                    fontSize: 11,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 0.5,
                    backgroundColor:
                      Object.keys(heat).length > 0
                        ? heat.backgroundColor
                        : "#f3f4f6",
                    color: heat.color || "#111827",
                  }}
                >
                  {displayValue}
                  {TrendIcon}
                </Box>
              </TableCell>
            );
          })}

          {/* AVG CELL */}
          <TableCell align="right">
            {avg !== "–" ? (
              <Box
                sx={{
                  px: 1,
                  py: 0.3,
                  borderRadius: 999,
                  fontSize: 11,
                  backgroundColor: "rgba(148,163,184,0.15)",
                }}
              >
                Avg {avg}
              </Box>
            ) : (
              "–"
            )}
          </TableCell>

          {/* TREND BUTTON CELL */}
          <TableCell align="right">
            <IconButton
              size="small"
              onClick={() =>
                setTrendState({
                  node,
                  path: fullPath,
                })
              }
              sx={{
                borderRadius: 2,
                border: "1px solid #e5e7eb",
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(56,189,248,0.08))",
              }}
            >
              <TrendingUp size={16} />
            </IconButton>
          </TableCell>
        </TableRow>

        {isOpen &&
          children.map((child) => renderRow(child, level + 1, fullPath))}
      </React.Fragment>
    );
  };

  const handleTabChange = (_e, newKey) => {
    setActiveTabKey(newKey);
    setExpanded({});
    setPage(0);
  };

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);

  return (
    <>
      <Card
        sx={{
          p: 3,
          borderRadius: 3,
          border: "1px solid #e5e7eb",
          boxShadow: "0 18px 45px rgba(15,23,42,0.12)",
          background:
            "radial-gradient(circle at top left, #eef2ff 0, transparent 50%), white",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {/* TABS */}
        <Tabs
          value={activeTabKey}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: "1px solid #e5e7eb",
            "& .MuiTab-root": {
              textTransform: "none",
              fontSize: 12,
            },
          }}
        >
          {TABS_META.map((t) => (
            <Tab key={t.key} label={t.label} value={t.key} />
          ))}
        </Tabs>

        {/* HEADER */}
        <Box
          mb={1}
          mt={0.5}
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box>
            <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>
              CATEGORY → BRAND → CITY → SKU
            </Typography>
            <Typography
              sx={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}
            >
              {activeData.title}
            </Typography>
            {activeData.subtitle && (
              <Typography sx={{ fontSize: 12, color: "#6b7280", mt: 0.2 }}>
                {activeData.subtitle}
              </Typography>
            )}
          </Box>

          <Box
            display="flex"
            flexDirection="column"
            gap={1}
            alignItems="flex-end"
          >
            <Box display="flex" gap={1}>
              <Button
                onClick={expandAll}
                sx={{
                  fontSize: 11,
                  textTransform: "none",
                  borderRadius: 999,
                  px: 1.8,
                  py: 0.4,
                  backgroundColor: "#e0f2fe",
                  color: "#0369a1",
                  border: "1px solid #bae6fd",
                }}
              >
                Expand All
              </Button>
              <Button
                onClick={collapseAll}
                sx={{
                  fontSize: 11,
                  textTransform: "none",
                  borderRadius: 999,
                  px: 1.8,
                  py: 0.4,
                  backgroundColor: "#fee2e2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                }}
              >
                Collapse All
              </Button>
            </Box>
          </Box>
        </Box>

        {/* TABLE */}
        <TableContainer
          component={Paper}
          sx={{ maxHeight: 520, borderRadius: 2 }}
        >
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {Array.from({ length: totalHierarchyCols }).map((_, i) => (
                  <TableCell
                    key={i}
                    sx={
                      i === 0
                        ? {
                          position: "sticky",
                          left: 0,
                          background: "#f9fafb",
                          zIndex: 10,
                          minWidth: 180,
                        }
                        : {}
                    }
                  >
                    {LEVEL_TITLES[i] || `Level ${i + 1}`}
                  </TableCell>
                ))}

                {KPI_HEADERS.map((h) => (
                  <TableCell key={h} align="right">
                    {h}
                  </TableCell>
                ))}

                <TableCell align="right">Row Avg (Key KPIs)</TableCell>
                <TableCell align="right">Trend</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredRows
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => renderRow(row, 0, []))}

              {/* TOTAL ROW */}
              {/* <TableRow sx={{ background: "#f8fafc" }}>
                <TableCell
                  colSpan={totalHierarchyCols}
                  sx={{ fontWeight: 700 }}
                >
                  TOTAL
                </TableCell>

                {totals.map((v, i) => (
                  <TableCell key={i} align="right" sx={{ fontWeight: 700 }}>
                    {v}
                  </TableCell>
                ))}

                <TableCell />
                <TableCell />
              </TableRow> */}
            </TableBody>
          </Table>
        </TableContainer>

        {/* PAGINATION */}
        <Box
          sx={{
            mt: 1.5,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Button
            size="small"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>
          <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
            Page {page + 1} of {totalPages}
          </Typography>
          <Button
            size="small"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </Box>
      </Card>

      {/* TREND DRAWER */}
      {trendState && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "50vw",
            maxWidth: "50vw",
            minWidth: 480,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            backdropFilter: "blur(2px)",
          }}
        >
          <Box
            component={motion.div}
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            sx={{
              pointerEvents: "auto",
              width: "94%",
              maxHeight: "92vh",
              borderRadius: 3,
              p: 3,
              background: "white",
              boxShadow: "0 18px 55px rgba(0,0,0,0.15)",
              border: "1px solid #e5e7eb",
              color: "#0f172a",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                mb: 1,
              }}
            >
              <Box>
                <Typography
                  sx={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: "#64748b",
                  }}
                >
                  Trend Studio
                </Typography>

                <Typography sx={{ fontSize: 18, fontWeight: 600, mt: 0.4 }}>
                  {trendTitle}
                </Typography>

                <Typography sx={{ fontSize: 12, color: "#94a3b8", mt: 0.5 }}>
                  Visualise all KPIs (KPI_HEADERS) across synthetic quarters.
                </Typography>
              </Box>

              <IconButton
                size="small"
                onClick={() => setTrendState(null)}
                sx={{
                  color: "#475569",
                  borderRadius: 999,
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                }}
              >
                ✕
              </IconButton>
            </Box>

            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Box sx={{ display: "flex", gap: 0.5 }}>
                {[
                  { key: "line", label: "Line" },
                  { key: "area", label: "Area" },
                  { key: "bar", label: "Bar" },
                ].map((c) => (
                  <Button
                    key={c.key}
                    size="small"
                    onClick={() => setChartType(c.key)}
                    sx={{
                      textTransform: "none",
                      fontSize: 11,
                      borderRadius: 999,
                      px: 1.4,
                      py: 0.3,
                      border: "1px solid #e2e8f0",
                      backgroundColor:
                        chartType === c.key ? "#eef2ff" : "white",
                      color: chartType === c.key ? "#4f46e5" : "#475569",
                    }}
                  >
                    {c.label}
                  </Button>
                ))}
              </Box>

              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 0.6,
                  justifyContent: "flex-end",
                }}
              >
                {METRICS.map((m) => {
                  const active = selectedMetrics.includes(m.key);
                  return (
                    <Chip
                      key={m.key}
                      label={m.label}
                      size="small"
                      onClick={() => toggleMetric(m.key)}
                      sx={{
                        fontSize: 11,
                        height: 24,
                        borderRadius: 999,
                        bgcolor: active
                          ? "rgba(99,102,241,0.15)"
                          : "#f3f4f6",
                        color: active ? "#4f46e5" : "#475569",
                        border: active
                          ? "1px solid #6366F1"
                          : "1px solid #e5e7eb",
                        "&:hover": {
                          bgcolor: active
                            ? "rgba(99,102,241,0.24)"
                            : "#e2e8f0",
                        },
                      }}
                    />
                  );
                })}
              </Box>
            </Box>

            <Box
              sx={{
                flex: 1,
                mt: 0.5,
                borderRadius: 2,
                border: "1px solid #e5e7eb",
                background: "#fafafa",
                overflow: "hidden",
              }}
            >
              <Box sx={{ mt: 1, height: 320 }}>
                <EChartsWrapper
                  option={getTrendOption()}
                  style={{ height: "100%", width: "100%" }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </>
  );
}
