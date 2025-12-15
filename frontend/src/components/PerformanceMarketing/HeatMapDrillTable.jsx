// HeatMapDrillTable.jsx
import React, { useState, useRef, useEffect } from "react";
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
  Chip,
} from "@mui/material";
 
import { motion } from "framer-motion";
import { Plus, Minus, TrendingUp, LineChartIcon } from "lucide-react";
import EChartsWrapper from "../EChartsWrapper";
 
import performanceData from "../../utils/PerformanceMarketingData";
import TrendsCompetitionDrawer from "../AllAvailablityAnalysis/TrendsCompetitionDrawer";
import PerformanceTrendDatas from "./PerformanceTrendDatas";
 
// ----------------- HELPERS -----------------
const parsePercent = (v) =>
  typeof v === "string" ? parseFloat(v.replace("%", "")) : Number(v || 0);
 
const rowConvAvg = (values) => {
  const convIndices = [3, 4, 5];
  const nums = convIndices
    .map((i) => parsePercent(values[i]))
    .filter((x) => !isNaN(x));
 
  if (!nums.length) return "–";
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) + "%";
};
 
const getHeatStyle = (val) => {
  const n = parsePercent(val);
  if (isNaN(n)) return {};
 
  if (n >= 3)
    return { backgroundColor: "rgba(22,163,74,0.12)", color: "#166534" };
  if (n >= 2)
    return { backgroundColor: "rgba(234,179,8,0.12)", color: "#854d0e" };
  return { backgroundColor: "rgba(239,68,68,0.12)", color: "#991b1b" };
};
 
const getQuarterValues = (base, quarter) => {
  if (quarter === "Q1") return base;
 
  const factor = { Q2: 1.1, Q3: 0.95, Q4: 1.15 }[quarter] || 1;
  const delta = { Q2: 0.2, Q3: -0.1, Q4: 0.3 }[quarter] || 0;
 
  return base.map((v, idx) => {
    if (idx >= 3) {
      const n = parsePercent(v);
      return isNaN(n) ? "–" : (n + delta).toFixed(1) + "%";
    }
    const num = Number(v);
    if (isNaN(num)) return "–";
    const adj = num * factor;
    return String(v).includes(".") ? adj.toFixed(1) : Math.round(adj);
  });
};
 
// ---------------- KEYWORD INJECTION ----------------
const KEYWORDS = [
  "Sandwich, Cakes & Others",
  "ice cream cake",
  "ice cream",
  "Gourmet",
  "cassata ice cream",
  "cas",
  "Ice Cream & Frozen Dessert",
];
 
// -------------- MAX DEPTH -----------------
const getMaxDepth = (nodes, depth = 0) => {
  let max = depth;
  nodes.forEach((node) => {
    if (node.children?.length) {
      max = Math.max(max, getMaxDepth(node.children, depth + 1));
    }
  });
  return max;
};
 
// ------------ METRICS CONFIG (for trend) -------------
const METRICS = [
  { key: "spend", label: "Spend", index: 0, isPercent: false },
  { key: "m1Spend", label: "M-1 Spend", index: 1, isPercent: false },
  { key: "m2Spend", label: "M-2 Spend", index: 2, isPercent: false },
  { key: "conv", label: "Conversion", index: 3, isPercent: true },
  { key: "m1Conv", label: "M-1 Conv", index: 4, isPercent: true },
  { key: "m2Conv", label: "M-2 Conv", index: 5, isPercent: true },
  { key: "cpm", label: "CPM", index: 6, isPercent: false },
  { key: "roas", label: "ROAS", index: 7, isPercent: false },
];
 
// ---------------- expanded depth detector -----------------
// Returns the maximum number of segments (levels) among expanded keys.
// Example:
//  - no expanded keys -> 0
//  - expanded["Magnum"] === true -> returns 1
//  - expanded["Magnum>North"] === true -> returns 2
const getExpandedDepth = (expandedKeys) => {
  if (!expandedKeys) return 0;
  let max = 0;
  Object.keys(expandedKeys).forEach((key) => {
    if (expandedKeys[key]) {
      const depth = key.split(">").length; // "Magnum" -> 1, "Magnum>North" -> 2
      if (depth > max) max = depth;
    }
  });
  return max;
};
 
// ----------------- COMPONENT -----------------
export default function HeatMapDrillTable({ selectedInsight }) {
  const {
    heatmapData,
    heatmapDataSecond,
    heatmapDataThird,
    heatmapDataFourth,
    heatmapDataFifth,
  } = performanceData;
 
  const collectedData =
    selectedInsight === "All Campaign Summary"
      ? heatmapData
      : selectedInsight === "Q1 - Performing Well"
      ? heatmapDataSecond
      : selectedInsight === "Q2 - Need Attention"
      ? heatmapDataThird
      : selectedInsight === "Q3 - Experiment"
      ? heatmapDataFourth
      : selectedInsight === "Q4 - Opportunity"
      ? heatmapDataFifth
      : heatmapData;
 
  const LEVEL_TITLES =
    selectedInsight === "All Campaign Summary"
      ? {
          0: "Format",
          1: "Region",
          2: "City",
          3: "Keyword",
        }
      : {
          0: "AD Property",
          1: "Group",
          2: "Keyword",
        };
        const openHeaderTrend = (levelIndex) => {
  setShowTrends(true);
};
  const [expanded, setExpanded] = useState({});
  const [formatFilter] = useState("All");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [page, setPage] = useState(0);
 
  const [trendState, setTrendState] = useState(null); // { node, path }
  const [showTrends, setShowTrends] = useState(false);
  const [chartType, setChartType] = useState("line"); // 'line' | 'area' | 'bar'
  const [selectedMetrics, setSelectedMetrics] = useState([
    "spend",
    "conv",
    "roas",
  ]);
 
  const rowsPerPage = 5;
 
  // Max hierarchy depth (data-driven)
  const maxDepth = getMaxDepth(collectedData?.rows, 0);
  // totalHierarchyCols used previously = maxDepth + 2; but for Option 2 we hide header+body columns
  // visibleHierarchyCols is dynamic: Format only when nothing expanded, else increases with expansion
  const expandedDepth = getExpandedDepth(expanded); // 0 -> nothing expanded, 1 -> top-level expanded, etc.
  const visibleHierarchyCols = Math.max(
    1,
    Math.min(expandedDepth + 1, maxDepth + 1)
  ); // min 1 (Format), max maxDepth+1
 
  const filteredRows =
    formatFilter === "All"
      ? collectedData?.rows
      : collectedData?.rows.filter((r) => r.label === formatFilter);
 
  // ---------------- TOTALS -----------------
  const getDeepNodes = (nodes, exp, path = [], res = []) => {
    nodes.forEach((node) => {
      const k = [...path, node.label].join(">");
 
      if (node.children?.length && exp[k]) {
        getDeepNodes(node.children, exp, [...path, node.label], res);
      } else {
        if (!node.isKeyword) res.push(node);
      }
    });
    return res;
  };
 
  const deepRows = getDeepNodes(filteredRows, expanded);
 
  const drillTotals = collectedData?.headers.slice(1).map((_, idx) => {
    const vals = deepRows.map(
      (r) => getQuarterValues(r.values, selectedQuarter)[idx]
    );
 
    const nums = vals
      .map((v) => parseFloat(String(v).replace("%", "")))
      .filter((x) => !isNaN(x));
 
    if (!nums.length) return "–";
    const isPercent = idx >= 3;
 
    return isPercent
      ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) + "%"
      : nums.reduce((a, b) => a + b, 0).toLocaleString();
  });
 
  // --------- Expand / Collapse all ----------
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
 
  const collapseAll = () => {
    setExpanded({});
  };
 
  // --------- Trend data builder (Q1–Q4 for this node) ----------
  const buildTrendData = (node) => {
    if (!node || !node.values) return [];
    const quarters = ["Q1", "Q2", "Q3", "Q4"];
 
    return quarters.map((q) => {
      const vals = getQuarterValues(node.values, q);
      const row = { quarter: q };
 
      METRICS.forEach((m) => {
        const raw = vals[m.index];
        if (raw === undefined || raw === "–") {
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
    if (!trendState) return {};
 
    const valueMetrics = METRICS.filter(
      (m) => !m.isPercent && selectedMetrics.includes(m.key)
    );
    const percentMetrics = METRICS.filter(
      (m) => m.isPercent && selectedMetrics.includes(m.key)
    );
 
    const series = [];
 
    const typeMap = {
      line: "line",
      bar: "bar",
      area: "line",
    };
 
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
        textStyle: { color: "#e5e7eb", fontSize: 11 },
      },
      toolbox: {
        feature: {
          saveAsImage: {},
          dataZoom: {},
          restore: {},
        },
        iconStyle: { borderColor: "#9ca3af" },
        right: 10,
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
        axisLine: { lineStyle: { color: "#6b7280" } },
        axisLabel: { color: "#9ca3af", fontSize: 11 },
      },
      yAxis: [
        {
          type: "value",
          name: "Value",
          axisLine: { lineStyle: { color: "#6b7280" } },
          splitLine: { lineStyle: { color: "#1f2937" } },
          axisLabel: { color: "#9ca3af", fontSize: 11 },
        },
        {
          type: "value",
          name: "%",
          axisLine: { lineStyle: { color: "#6b7280" } },
          splitLine: { show: false },
          axisLabel: {
            color: "#9ca3af",
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
          borderColor: "#111827",
          handleStyle: { color: "#6366F1" },
          textStyle: { color: "#9ca3af" },
        },
      ],
      series,
    };
  };
 
  // ---------------- RENDER ROW -----------------
  const renderRow = (node, level = 0, path = []) => {
    const fullPath = [...path, node.label];
    const key = fullPath.join(">");
    const isOpen = expanded[key];
 
    const realChildren = node.children || [];
    const keywordChildren =
      !realChildren.length && !node.isKeyword
        ? KEYWORDS.map((k) => ({
            label: k,
            values: node.values,
            children: [],
            isKeyword: true,
          }))
        : [];
 
    const children = [...realChildren, ...keywordChildren];
    const hasChildren = children.length > 0;
 
    const qVals = getQuarterValues(node.values, selectedQuarter);
    const avg = rowConvAvg(qVals);
 
    const rowBg = node.isKeyword ? "#fff" : level === 0 ? "#f8fafc" : "#fff";
 
    return (
      <React.Fragment key={key}>
        <TableRow
          component={motion.tr}
          layout
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          sx={{ backgroundColor: rowBg }}
        >
          {Array.from({ length: visibleHierarchyCols }).map((_, col) => {
            const sticky =
              col === 0
                ? {
                    position: "sticky",
                    left: 0,
                    zIndex: 10,
                    backgroundColor: rowBg,
                    minWidth: 150,
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
 
            return (
              <TableCell key={col} sx={sticky}>
                –{/* placeholder for collapsed hierarchy */}
              </TableCell>
            );
          })}
 
          {qVals.map((v, i) => {
            const heat = i >= 3 ? getHeatStyle(v) : {};
            return (
              <TableCell key={i} align="right">
                <Box
                  sx={{
                    px: 1,
                    py: 0.3,
                    borderRadius: 1,
                    fontSize: 11,
                    display: "inline-flex",
                    justifyContent: "flex-end",
                    backgroundColor: i >= 3 ? heat.backgroundColor : "#f3f4f6",
                    color: i >= 3 ? heat.color : "#111",
                  }}
                >
                  {v || "–"}
                </Box>
              </TableCell>
            );
          })}
 
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
                avg {avg}
              </Box>
            ) : (
              "–"
            )}
          </TableCell>
 
          {/* <TableCell align="right">
            <IconButton
              size="small"
              onClick={() =>
                setTrendState({
                  node,
                  path: fullPath,
                })
              }
            >
              <TrendingUp size={16} />
            </IconButton>
            </TableCell> */}
          {/* <TableCell align="right">
            <IconButton
              size="small"
              onClick={() => setShowTrends(true)}
              sx={{
                borderRadius: 2,
                border: "1px solid #e5e7eb",
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(56,189,248,0.08))",
              }}
            >
              <TrendingUp size={16} />
            </IconButton>
          </TableCell> */}
        </TableRow>
 
        {isOpen &&
          children.map((child) => renderRow(child, level + 1, fullPath))}
      </React.Fragment>
    );
  };
 
  // ----------------- UI -----------------
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
        }}
      >
        {/* HEADER */}
        <Box mb={2} display="flex" justifyContent="space-between">
          <Box>
            <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>
              {selectedInsight === "All Campaign Summary"
                ? "FORMAT → REGION → CITY → KEYWORD"
                : "AD Property → GROUP → KEYWORD"}
            </Typography>
 
            <Typography
              sx={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}
            >
              {collectedData?.title}
            </Typography>
          </Box>
 
          <Box
            display="flex"
            flexDirection="column"
            alignItems="flex-end"
            gap={1}
          >
            {/* QUARTERS */}
            <Box display="flex" gap={1}>
              {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                <Button
                  key={q}
                  onClick={() => setSelectedQuarter(q)}
                  sx={{
                    fontSize: 12,
                    textTransform: "none",
                    borderRadius: 999,
                    px: 1.6,
                    backgroundColor:
                      selectedQuarter === q ? "#6366F1" : "transparent",
                    color: selectedQuarter === q ? "white" : "#6b7280",
                  }}
                >
                  {q}
                </Button>
              ))}
            </Box>
 
            {/* EXPAND / COLLAPSE ALL */}
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
                {/* {Array.from({ length: visibleHierarchyCols }).map((_, i) => (
                  <TableCell
                    key={i}
                    sx={
                      i === 0
                        ? {
                            position: "sticky",
                            left: 0,
                            background: "#f9fafb",
                            zIndex: 10,
                            minWidth: 150,
                          }
                        : {}
                    }
                  >
                    {LEVEL_TITLES[i] || `Keyword ${i - 2 + 2}`}
                  </TableCell>
                ))} */}
{Array.from({ length: visibleHierarchyCols }).map((_, i) => (
  <TableCell
    key={i}
    sx={
      i === 0
        ? {
            position: "sticky",
            left: 0,
            background: "#f9fafb",
            zIndex: 10,
            minWidth: 150,
          }
        : {}
    }
  >
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
      }}
    >
      {/* Header title */}
      <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
        {LEVEL_TITLES[i]}
      </Typography>

      {/* ✅ Trend icon ONLY for Region / City / Keyword */}
      {i > 0 && (
        <IconButton
          size="small"
          onClick={() => openHeaderTrend(i)}
          sx={{ p: 0.25 }}
        >
          <LineChartIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
    </Box>
  </TableCell>
))}

 
                {collectedData?.headers.slice(1).map((col) => (
                  <TableCell key={col} align="right">
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 0.6,
                      }}
                    >
                      {/* Column Title */}
                      <Typography sx={{ fontSize: 10, fontWeight: 600 }}>
                        {col} ({selectedQuarter})
                      </Typography>
 
                      {/* Trend Icon */}
                      <IconButton
                        onClick={() => setShowTrends(true)}
                        sx={{
                          p: 0.25,
                        }}
                      >
                        <LineChartIcon
                          sx={{
                            fontSize: 5,
                          }}
                        />
                      </IconButton>
                    </Box>
                  </TableCell>
                ))}
 
                <TableCell align="right" sx={{ fontSize: 12, fontWeight: 550 }}>Row Avg</TableCell>
                {/* <TableCell align="right">Trend</TableCell> */}
              </TableRow>
            </TableHead>
 
            <TableBody>
              {filteredRows
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => renderRow(row, 0, []))}
 
              {/* TOTAL ROW */}
              <TableRow sx={{ background: "#f8fafc" }}>
                <TableCell
                  colSpan={visibleHierarchyCols}
                  sx={{ fontWeight: 700 }}
                >
                  TOTAL ({selectedQuarter})
                </TableCell>
 
                {drillTotals.map((v, i) => (
                  <TableCell key={i} align="right" sx={{ fontWeight: 700 }}>
                    {v || "–"}
                  </TableCell>
                ))}
 
                <TableCell>–</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
 
        {/* SIMPLE PAGINATION */}
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
            Page {page + 1} of {Math.ceil(filteredRows.length / rowsPerPage)}
          </Typography>
          <Button
            size="small"
            disabled={page >= Math.ceil(filteredRows.length / rowsPerPage) - 1}
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
                  Visualise Spend, Conversion, ROAS across quarters.
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
                        bgcolor: active ? "rgba(99,102,241,0.15)" : "#f3f4f6",
                        color: active ? "#4f46e5" : "#475569",
                        border: active
                          ? "1px solid #6366F1"
                          : "1px solid #e5e7eb",
                        "&:hover": {
                          bgcolor: active ? "rgba(99,102,241,0.24)" : "#e2e8f0",
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
              <PerformanceTrendDatas
          open={showTrends}
          onClose={() => setShowTrends(false)}
          selectedColumn="Blinkit"
          dynamicKey="Performance_marketing"
        />
    </>
  );
}
 
 