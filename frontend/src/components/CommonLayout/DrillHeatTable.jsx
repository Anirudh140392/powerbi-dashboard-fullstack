import React, { useState } from "react";
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
} from "@mui/material";

import { motion } from "framer-motion";
import { Plus, Minus, TrendingUp } from "lucide-react";
import ReactECharts from "echarts-for-react";

export default function DrillHeatTable({
  data,
  columns,
  computeQuarterValues,
  getHeatStyle,
  title = "Drill Table",
  levels = ["Platform", "Zone", "City", "Product", "ID"],
  rowsPerPage = 5,
  enableTrend = true,
}) {
  // ============================================================
  // STATE
  // ============================================================
  const [expanded, setExpanded] = useState({});
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [page, setPage] = useState(0);

  const [trendState, setTrendState] = useState(null);
  const [chartType, setChartType] = useState("line");
  const [selectedMetrics, setSelectedMetrics] = useState(
    columns.map((c) => c.key)
  );

  // ============================================================
  // DYNAMIC LEVEL VISIBILITY (auto shrink hierarchy columns)
  // ============================================================
  const computeVisibleLevels = (nodes, visible = []) => {
    visible[0] = true; // root level always visible

    const walk = (node, lvl, path = []) => {
      const key = [...path, node.label].join(">");

      if (expanded[key]) visible[lvl + 1] = true;

      node.children?.forEach((ch) =>
        walk(ch, lvl + 1, [...path, node.label])
      );
    };

    nodes.forEach((n) => walk(n, 0));
    return visible.map((v, i) => (v ? levels[i] : null));
  };

  const visibleLevels = computeVisibleLevels(data);

  // ============================================================
  // Expand / Collapse All
  // ============================================================
  const expandAll = () => {
    const map = {};
    const walk = (node, path = []) => {
      const key = [...path, node.label].join(">");
      if (node.children?.length) {
        map[key] = true;
        node.children.forEach((c) => walk(c, [...path, node.label]));
      }
    };
    data.forEach((row) => walk(row));
    setExpanded(map);
  };

  const collapseAll = () => setExpanded({});

  // ============================================================
  // TREND DATA
  // ============================================================
  const buildTrendData = (node) => {
    return ["Q1", "Q2", "Q3", "Q4"].map((q) => {
      const vals = computeQuarterValues(node.values, q);
      const row = { quarter: q };

      columns.forEach((c) => {
        row[c.key] = vals[c.key] ?? null;
      });

      return row;
    });
  };

  const trendData = trendState ? buildTrendData(trendState.node) : [];
  const trendTitle = trendState ? trendState.path.join(" → ") : "";

  const getTrendOption = () => ({
    tooltip: { trigger: "axis" },
    legend: { top: 10, data: selectedMetrics },
    color: ["#4f46e5", "#22c55e", "#ef4444", "#eab308", "#06b6d4"],
    xAxis: {
      type: "category",
      data: trendData.map((d) => d.quarter),
    },
    yAxis: [{ type: "value" }],
    series: selectedMetrics.map((m) => ({
      name: m,
      type: chartType === "area" ? "line" : chartType,
      smooth: true,
      data: trendData.map((d) => d[m]),
      areaStyle: chartType === "area" ? { opacity: 0.25 } : undefined,
      lineStyle: { width: 3 },
      symbolSize: 8,
    })),
  });

  // ============================================================
  // RENDER ROW (Recursive)
  // ============================================================
  const renderRow = (node, level = 0, path = []) => {
    const fullPath = [...path, node.label];
    const key = fullPath.join(">");

    const isOpen = expanded[key] ?? false;
    const hasChildren = node.children?.length > 0;
    const vals = computeQuarterValues(node.values, selectedQuarter);

    return (
      <React.Fragment key={key}>
        <TableRow
          component={motion.tr}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* HIERARCHY COLUMNS */}
          {visibleLevels.map((lvl, idx) => {
            if (lvl == null) return <TableCell key={idx}></TableCell>;

            const isThisLevel = idx === level;

            return (
              <TableCell
                key={idx}
                sx={{
                  width: 150,
                  background: "#fff",
                  borderBottom: "1px solid #eee",
                }}
              >
                {isThisLevel && (
                  <Box display="flex" alignItems="center" gap={1}>
                    {hasChildren ? (
                      <IconButton
                        size="small"
                        onClick={() =>
                          setExpanded((p) => ({ ...p, [key]: !isOpen }))
                        }
                      >
                        {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                      </IconButton>
                    ) : (
                      <Box width={26} />
                    )}

                    {node.label}
                  </Box>
                )}
              </TableCell>
            );
          })}

          {/* DATA CELLS */}
          {columns.map((col) => {
            const v = vals[col.key] ?? "-";
            const heat = v !== "-" ? getHeatStyle(v) : {};

            return (
              <TableCell key={col.key} align="right">
                {v !== "-" ? (
                  <Box
                    sx={{
                      px: 1,
                      py: 0.4,
                      borderRadius: 1,
                      background: heat.bg || "#f3f4f6",
                      color: heat.color || "#222",
                      display: "inline-block",
                    }}
                  >
                    {v}
                  </Box>
                ) : (
                  "-"
                )}
              </TableCell>
            );
          })}

          {/* TREND BUTTON */}
          {enableTrend && (
            <TableCell align="right">
              {node.values && Object.keys(node.values).length > 0 && (
                <IconButton
                  size="small"
                  onClick={() => setTrendState({ node, path: fullPath })}
                >
                  <TrendingUp size={16} />
                </IconButton>
              )}
            </TableCell>
          )}
        </TableRow>

        {/* CHILD NODES */}
        {isOpen &&
          node.children?.map((child) =>
            renderRow(child, level + 1, fullPath)
          )}
      </React.Fragment>
    );
  };

  // ============================================================
  // RENDER UI
  // ============================================================
  return (
    <>
      <Card sx={{ p: 3 }}>
        {/* HEADER */}
        <Box display="flex" justifyContent="space-between">
          <Box>
            <Typography sx={{ fontSize: 11, color: "gray" }}>Drill Table</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
              {title}
            </Typography>
          </Box>

          {/* QUARTER SELECTOR */}
          <Box>
            {["Q1", "Q2", "Q3", "Q4"].map((q) => (
              <Button
                key={q}
                size="small"
                onClick={() => setSelectedQuarter(q)}
                sx={{
                  mx: 0.3,
                  background: selectedQuarter === q ? "#6366F1" : "#e5e7eb",
                  color: selectedQuarter === q ? "white" : "black",
                }}
              >
                {q}
              </Button>
            ))}
          </Box>
        </Box>

        {/* EXPAND / COLLAPSE */}
        <Box my={1} display="flex" gap={1}>
          <Button size="small" onClick={expandAll}>Expand All</Button>
          <Button size="small" onClick={collapseAll}>Collapse All</Button>
        </Box>

        {/* TABLE */}
        <TableContainer component={Paper} sx={{ maxHeight: 460 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {visibleLevels.map((lvl, i) => (
                  <TableCell key={i}>{lvl ?? ""}</TableCell>
                ))}

                {columns.map((col) => (
                  <TableCell key={col.key} align="right">
                    {col.label} ({selectedQuarter})
                  </TableCell>
                ))}

                {enableTrend && <TableCell align="right">Trend</TableCell>}
              </TableRow>
            </TableHead>

            <TableBody>
              {data
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((root) => renderRow(root))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* PAGINATION */}
        <Box mt={2} textAlign="right">
          <Button
            size="small"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Prev
          </Button>
          <Button size="small" onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </Box>
      </Card>

      {/* ============================================================
           TREND POWER DRAWER
      ============================================================ */}
{trendState && (
  <Box
    sx={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.45)",
      backdropFilter: "blur(4px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 4000,
      p: 2
    }}
  >
    <Box
      component={motion.div}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      sx={{
        width: "70vw",
        maxWidth: "900px",
        background: "white",
        borderRadius: 3,
        p: 3,
        boxShadow: "0px 10px 40px rgba(0,0,0,0.25)"
      }}
    >
      {/* HEADER */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
          Trend – {trendTitle}
        </Typography>

        <Button variant="outlined" onClick={() => setTrendState(null)}>
          Close
        </Button>
      </Box>

      {/* CHART TYPE SELECTOR */}
      <Box mt={2} display="flex" gap={1}>
        {["line", "bar", "area"].map((t) => (
          <Button
            key={t}
            size="small"
            variant={chartType === t ? "contained" : "outlined"}
            onClick={() => setChartType(t)}
          >
            {t.toUpperCase()}
          </Button>
        ))}
      </Box>

      {/* METRIC SELECTOR */}
      <Box mt={3}>
        <Typography sx={{ fontSize: 14, mb: 1 }}>Select Metrics</Typography>

        <Box display="flex" flexWrap="wrap" gap={1}>
          {columns.map((c) => (
            <Button
              key={c.key}
              size="small"
              variant={selectedMetrics.includes(c.key) ? "contained" : "outlined"}
              onClick={() =>
                setSelectedMetrics((prev) =>
                  prev.includes(c.key)
                    ? prev.filter((x) => x !== c.key)
                    : [...prev, c.key]
                )
              }
            >
              {c.label}
            </Button>
          ))}
        </Box>
      </Box>

      {/* CHART */}
      <ReactECharts
        option={getTrendOption()}
        style={{ height: 400, marginTop: 20 }}
      />
    </Box>
  </Box>
)}

    </>
  );
}
