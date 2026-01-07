// HeatMapDrillTable.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
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
  Select,
  MenuItem,
} from "@mui/material";

import { motion } from "framer-motion";
import { Plus, Minus, TrendingUp, LineChart, SlidersHorizontal, X } from "lucide-react";
import EChartsWrapper from "../EChartsWrapper";

import performanceData from "../../utils/PerformanceMarketingData";
import TrendsCompetitionDrawer from "../AllAvailablityAnalysis/TrendsCompetitionDrawer";
import PerformanceTrendDatas from "./PerformanceTrendDatas";
import { KpiFilterPanel } from "../KpiFilterPanel";
import PaginationFooter from "../CommonLayout/PaginationFooter";

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

// ----------------- RULE EVALUATOR -----------------
const evaluateRule = (rowValues, rule) => {
  if (!rule.children || rule.children.length === 0) return true;

  if (rule.logicalOp) {
    // Group
    const results = rule.children.map((child) => evaluateRule(rowValues, child));
    return rule.logicalOp === "AND"
      ? results.every((r) => r)
      : results.some((r) => r);
  }

  // Condition
  const { fieldId, operator, value, valueTo } = rule;
  const metric = METRICS.find((m) => m.key === fieldId);
  if (!metric) return true;

  // Get value from row (handle "3%" strings)
  // rowValues matches the order of header columns (after label)
  // METRICS indices are 0..7
  // rowValues has 6-8 items? 
  // collectedData.headers: "Format...", "Spend", "M-1 Spend"...
  // Spend is idx 0 in values.
  // METRICS: spend index 0.
  // matches.

  const rawVal = rowValues[metric.index];
  let val = rawVal;
  if (typeof rawVal === "string" && rawVal.includes("%")) {
    val = parseFloat(rawVal.replace("%", ""));
  } else {
    val = Number(rawVal); // "203.2" -> 203.2
  }

  if (isNaN(val)) return false;

  const numVal = Number(value);
  const numTo = Number(valueTo);

  switch (operator) {
    case ">": return val > numVal;
    case ">=": return val >= numVal;
    case "<": return val < numVal;
    case "<=": return val <= numVal;
    case "=": return val === numVal;
    case "!=": return val !== numVal;
    case "between": return val >= numVal && val <= numTo;
    default: return true;
  }
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

  const LEVEL_TITLES = ["Keyword Type", "Keyword", "Region"];
  const openHeaderTrend = (levelIndex) => {
    setShowTrends(true);
  };
  const [expanded, setExpanded] = useState({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState("Q4");
  const [page, setPage] = useState(1);
  // ---------- FILTERS STATE ----------
  const [activeFilters, setActiveFilters] = useState({
    brands: [],     // Formats
    categories: [], // Regions
    cities: [],
    keywords: [],
    skus: [],
    platforms: [],
    kpiRules: null,
    weekendFlag: [],
  });

  // ---------- DATA EXTRACTION FOR FILTERS ----------
  const filterOptions = useMemo(() => {
    const opts = {
      brands: new Map(),
      categories: new Map(),
      cities: new Map(),
      keywords: new Map(),
    };

    const traverse = (nodes, level = 0) => {
      nodes.forEach((node) => {
        const item = { id: node.label, label: node.label, value: 0 };

        if (level === 0) opts.brands.set(node.label, item);
        else if (level === 1) opts.categories.set(node.label, item);
        else if (level === 2) opts.cities.set(node.label, item);
        else if (node.isKeyword || level === 3) opts.keywords.set(node.label, item);

        if (node.children) traverse(node.children, level + 1);
      });
    };

    if (collectedData?.rows) {
      traverse(collectedData.rows);
    }

    return {
      brands: Array.from(opts.brands.values()),
      categories: Array.from(opts.categories.values()),
      cities: Array.from(opts.cities.values()),
      keywords: Array.from(opts.keywords.values()),
      kpiFields: METRICS.map((m) => ({ id: m.key, label: m.label, type: "number" })),
    };
  }, [collectedData]);

  // ---------- FILTERING LOGIC ----------
  const filteredDataRows = useMemo(() => {
    if (!collectedData?.rows) return [];

    const { brands, categories, cities, keywords, kpiRules } = activeFilters;
    const hasBrandFilter = brands.length > 0;
    const hasRegionFilter = categories.length > 0;
    const hasCityFilter = cities.length > 0;
    const hasKwFilter = keywords.length > 0;
    const hasKpiRules = kpiRules && kpiRules.children && kpiRules.children.length > 0;

    const filterRecursive = (nodes, level) => {
      const res = [];
      for (const node of nodes) {
        let keep = true;

        // Weekend flag filter (if configured)
        const wf = activeFilters.weekendFlag || [];
        // If user selected one of Weekend/Weekday (but not both), apply filter when node has weekendFlag
        if (wf.length === 1 && node.weekendFlag) {
          if (!wf.includes(node.weekendFlag)) keep = false;
        }

        // 1. Check Level Filters
        if (level === 0 && hasBrandFilter && !brands.includes(node.label)) keep = false;
        else if (level === 1 && hasRegionFilter && !categories.includes(node.label)) keep = false;
        else if (level === 2 && hasCityFilter && !cities.includes(node.label)) keep = false;
        else if ((level === 3 || node.isKeyword) && hasKwFilter && !keywords.includes(node.label)) keep = false;

        // 2. Check KPI Rules (on this node's values)
        if (keep && hasKpiRules && node.values) {
          const qValues = getQuarterValues(node.values, selectedQuarter);
          if (!evaluateRule(qValues, kpiRules)) keep = false;
        }

        // 3. Recurse
        let children = [];
        if (node.children) {
          children = filterRecursive(node.children, level + 1);
        }

        // 4. Final Decision
        if (keep) {
          // If node had children originally, it must have children now (unless it's a leaf node type that got filtered).
          // But wait, if I filter "City: Mumbai", then "Magnum" (Format) will have only "Mumbai" child.
          // If "Magnum" has NO children left after filtering, should I show "Magnum"?
          // Typically in drill-down, NO.
          // Exception: If I am at the deepest level (Keyword), I just return myself.
          // If I have children property but it's empty now, I should be removed?
          // collectedData has children for all except keywords.
          if (node.children && node.children.length > 0) {
            if (children.length > 0) {
              res.push({ ...node, children });
            }
            // Else: all children filtered out -> remove parent
          } else {
            // Leaf node (Keyword)
            res.push(node);
          }
        }
      }
      return res;
    };

    return filterRecursive(collectedData.rows, 0);
  }, [collectedData, activeFilters, selectedQuarter]);

  const [trendState, setTrendState] = useState(null); // { node, path }
  const [showTrends, setShowTrends] = useState(false);
  const [chartType, setChartType] = useState("line"); // 'line' | 'area' | 'bar'
  const [selectedMetrics, setSelectedMetrics] = useState([
    "spend",
    "conv",
    "roas",
  ]);

  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Force reset expanded state on mount to ensure columns are hidden
  useEffect(() => {
    setExpanded({});
  }, []);

  // visibleHierarchyCols is dynamic based strictly on expansion
  const expandedDepth = getExpandedDepth(expanded);
  // If nothing expanded (depth 0), show 1 column. 
  // If depth 1 expanded (e.g. Magnum), show 2 columns (Type + Keyword).
  // If depth 2 expanded (e.g. Magnum > Keyword), show 3 columns.
  const visibleHierarchyCols = expandedDepth + 1;

  const filteredRows = filteredDataRows;

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

    // Use filtered children directly. Do not inject synthetic keywords.
    const children = node.children || [];
    const hasChildren = children.length > 0;

    const qVals = getQuarterValues(node.values, selectedQuarter);
    const avg = rowConvAvg(qVals);

    const rowBg = "#fff";

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
                  borderRight: "1px solid transparent",
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
                          width: 20,
                          height: 20,
                          borderRadius: 2,
                          backgroundColor: 'white',
                          '&:hover': { backgroundColor: '#f8fafc' }
                        }}
                      >
                        {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                      </IconButton>
                    ) : (
                      <Box sx={{ width: 26 }} />
                    )}

                    <Typography sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {level === 2 ? "Pan India" : node.label}
                    </Typography>
                  </Box>
                </TableCell>
              );
            }

            return (
              <TableCell key={col} sx={sticky}>
                {/* placeholder for collapsed hierarchy */}
              </TableCell>
            );
          })}

          {qVals.map((v, i) => {
            const heat = i >= 3 ? getHeatStyle(v) : {};
            return (
              <TableCell key={i} align="center" sx={{ minWidth: 100, width: 100 }}>
                <Box
                  sx={{
                    px: 1,
                    py: 0.3,
                    borderRadius: 1,
                    fontSize: 11,
                    display: "inline-flex",
                    justifyContent: "center",
                    backgroundColor: i >= 3 ? heat.backgroundColor : "transparent",
                    color: i >= 3 ? heat.color : "#475569",
                  }}
                >
                  {v || "–"}
                </Box>
              </TableCell>
            );
          })}

          <TableCell align="center">
            {avg !== "–" ? (
              <Box
                sx={{
                  px: 1,
                  py: 0.3,
                  borderRadius: 999,
                  fontSize: 11,
                  backgroundColor: "transparent",
                  border: "1px solid #f1f5f9",
                  color: "#64748b"
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
          <TrendingUp size={16} />
            </IconButton>
          </TableCell> */}
        </TableRow>

        {isOpen &&
          (level === 1
            ? renderRow({ ...node, label: "Pan India", children: [] }, level + 1, fullPath)
            : children.map((child) => renderRow(child, level + 1, fullPath))
          )}
      </React.Fragment>
    );
  };

  // ----------------- UI -----------------
  return (
    <>
      {/* ------------------ KPI FILTER MODAL ------------------ */}
      {filterPanelOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-900/40 px-4 pb-4 pt-24 transition-all backdrop-blur-sm">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Advanced Filters</h2>
                <p className="text-sm text-slate-500">Configure data visibility and rules</p>
              </div>
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-6 pb-6">
              <KpiFilterPanel
                sectionConfig={[
                  { id: "brands", label: "Format" },
                  { id: "weekendFlag", label: "Weekend Flag" },
                  { id: "categories", label: "Region" },
                  { id: "cities", label: "City" },
                  { id: "keywords", label: "Keyword" },
                  { id: "kpiRules", label: "KPI Rules" },
                ]}
                keywords={filterOptions.keywords}
                brands={filterOptions.brands}
                categories={filterOptions.categories}
                skus={[]}
                cities={filterOptions.cities}
                platforms={[]}
                kpiFields={filterOptions.kpiFields}
                onKeywordChange={(ids) => setActiveFilters(p => ({ ...p, keywords: ids }))}
                onBrandChange={(ids) => setActiveFilters(p => ({ ...p, brands: ids }))}
                onCategoryChange={(ids) => setActiveFilters(p => ({ ...p, categories: ids }))}
                onWeekendChange={(vals) => setActiveFilters(p => ({ ...p, weekendFlag: vals || [] }))}
                onCityChange={(ids) => setActiveFilters(p => ({ ...p, cities: ids }))}
                onRulesChange={(tree) => setActiveFilters(p => ({ ...p, kpiRules: tree }))}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      <Card
        sx={{
          p: 3,
          borderRadius: 3,
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
          background: "white",
        }}
      >
        {/* HEADER */}
        <Box mb={2} display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography
                sx={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}
              >
                {collectedData?.title}
              </Typography>

              {/* QUICK CATEGORY FILTER REMOVED */}
            </Box>

            <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>
              {selectedInsight === "All Campaign Summary"
                ? "Keyword Type → Keyword → Region"
                : "AD Property → GROUP → KEYWORD"}
            </Typography>
          </Box>

          <Box
            display="flex"
            flexDirection="column"
            alignItems="flex-end"
            gap={1}
          >
            {/* BUTTON ROW */}
            <Box display="flex" gap={1} alignItems="center">
              {/* FILTERS BUTTON */}
              <Button
                onClick={() => setFilterPanelOpen(true)}
                startIcon={<SlidersHorizontal size={14} />}
                sx={{
                  fontSize: 12,
                  textTransform: "none",
                  borderRadius: 999,
                  px: 1.6,
                  backgroundColor: "#f1f5f9",
                  color: "#334155",
                  border: "1px solid #e2e8f0",
                  "&:hover": { backgroundColor: "#e2e8f0" },
                }}
              >
                Filters
              </Button>

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
                        selectedQuarter === q ? "#0f172a" : "transparent",
                      color: selectedQuarter === q ? "white" : "#6b7280",
                    }}
                  >
                    {q}
                  </Button>
                ))}
              </Box>
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
                  backgroundColor: "#f1f5f9",
                  color: "#334155",
                  border: "1px solid #e2e8f0",
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
        < TableContainer
          component={Paper}
          sx={{ maxHeight: 520, borderRadius: 2, boxShadow: 'none', border: '1px solid #e2e8f0' }
          }
        >
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ borderTop: "1px solid #e5e7eb" }}>
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
                    key={LEVEL_TITLES[i]}
                    sx={
                      i === 0
                        ? {
                          position: "sticky",
                          left: 0,
                          background: "white",
                          zIndex: 10,
                          minWidth: 150,
                          verticalAlign: "bottom",
                          pb: 1.5,
                          borderLeft: i > 0 ? "1px solid #f1f5f9" : "none",
                          color: "#334155",
                          fontWeight: 600,
                        }
                        : { background: "white", verticalAlign: "bottom", borderLeft: "1px solid #f1f5f9", pb: 1.5, color: "#334155" }
                    }
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.6,
                      }}
                    >
                      {/* Header title */}
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#334155" }}>
                        {LEVEL_TITLES[i]}
                      </Typography>
                    </Box>
                  </TableCell>
                ))}


                {collectedData?.headers.slice(1).map((col, ci) => (
                  <TableCell key={col} align="center" sx={{
                    background: "white",
                    verticalAlign: "bottom",
                    pb: 1.5,
                    borderLeft: "1px solid #f1f5f9",
                    minWidth: 100,
                    width: 100
                  }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.6,
                      }}
                    >
                      {/* Column Title */}
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#334155", whiteSpace: "nowrap" }}>
                        {col} ({selectedQuarter})
                      </Typography>
                    </Box>
                  </TableCell>
                ))}

                <TableCell align="center" sx={{ fontSize: 12, fontWeight: 550, background: "white" }}>Row Avg</TableCell>
                {/* <TableCell align="right">Trend</TableCell> */}
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredRows
                .slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage)
                .map((row) => renderRow(row, 0, []))}


            </TableBody>
          </Table>
        </TableContainer >

        {/* PAGINATION FOOTER */}
        <div className="border-t border-slate-100">
          <PaginationFooter
            isVisible={true}
            currentPage={page}
            totalPages={Math.ceil(filteredRows.length / rowsPerPage)}
            onPageChange={setPage}
            pageSize={rowsPerPage}
            onPageSizeChange={(newPageSize) => {
              setRowsPerPage(newPageSize);
              setPage(1);
            }}
          />
        </div>
      </Card >

      {/* TREND DRAWER */}
      {
        trendState && (
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
        )
      }
      <PerformanceTrendDatas
        open={showTrends}
        onClose={() => setShowTrends(false)}
        selectedColumn="Blinkit"
        dynamicKey="Performance_marketing"
      />
    </>
  );
}
