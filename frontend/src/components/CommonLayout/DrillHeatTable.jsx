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
  Chip,
} from "@mui/material";

import { motion } from "framer-motion";
import { Plus, Minus, TrendingUp } from "lucide-react";
import ReactECharts from "echarts-for-react";

//
// --------------------------------------------------
// REUSABLE DRILL HEATMAP TABLE
// --------------------------------------------------
//

export default function DrillHeatTable({
  data,                      // ← hierarchical rows
  columns,                   // ← column definitions [{ key, label, isPercent }]
  computeQuarterValues,      // ← function(values, quarter)
  computeRowAvg,             // ← function(values)
  getHeatStyle,              // ← coloring logic
  title = "Drill Table",
  levels = ["Level 1", "Level 2", "Level 3"], // dynamic level headers
  rowsPerPage = 5,
  enableTrend = true,
}) {
  // ------------------ state ------------------
  const [expanded, setExpanded] = useState({});
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [page, setPage] = useState(0);

  const [trendState, setTrendState] = useState(null);
  const [chartType, setChartType] = useState("line");
  const [selectedMetrics, setSelectedMetrics] = useState(
    columns.map((c) => c.key)
  );

  // ----------------- max depth -----------------
  const getMaxDepth = (nodes, depth = 0) =>
    nodes.reduce(
      (max, n) =>
        Math.max(
          max,
          n.children?.length
            ? getMaxDepth(n.children, depth + 1)
            : depth
        ),
      depth
    );

  const maxDepth = getMaxDepth(data);
  const totalHierarchyCols = maxDepth + 1;

  // ---------------- expand / collapse all ----------------
  const expandAll = () => {
    const s = {};
    const walk = (nodes, path = []) => {
      nodes.forEach((n) => {
        const k = [...path, n.label].join(">");
        if (n.children?.length) {
          s[k] = true;
          walk(n.children, [...path, n.label]);
        }
      });
    };

    walk(data);
    setExpanded(s);
  };

  const collapseAll = () => setExpanded({});

  // ---------------- build trend dataset ----------------
  const buildTrendData = (node) => {
    if (!node?.values) return [];

    const quarters = ["Q1", "Q2", "Q3", "Q4"];

    return quarters.map((q) => {
      const qvals = computeQuarterValues(node.values, q);
      const row = { quarter: q };

      columns.forEach((c, idx) => {
        const raw = qvals[idx];
        if (raw == null) {
          row[c.key] = null;
        } else {
          row[c.key] = c.isPercent
            ? parseFloat(String(raw).replace("%", ""))
            : Number(String(raw).replace(/,/g, ""));
        }
      });

      return row;
    });
  };

  const trendData = trendState ? buildTrendData(trendState.node) : [];
  const trendTitle = trendState ? trendState.path.join(" → ") : "";

  const getTrendOption = () => ({
    tooltip: { trigger: "axis" },
    legend: { top: 0 },
    grid: { left: 40, right: 40, bottom: 40 },
    xAxis: {
      type: "category",
      data: trendData.map((d) => d.quarter),
    },
    yAxis: [{ type: "value" }],
    series: selectedMetrics.map((m) => ({
      name: m,
      type: chartType,
      smooth: true,
      data: trendData.map((d) => d[m]),
      areaStyle: chartType === "area" ? { opacity: 0.15 } : undefined,
    })),
  });

  // ---------------- render one row ----------------
  const renderRow = (node, level = 0, path = []) => {
    const fullPath = [...path, node.label];
    const key = fullPath.join(">");

    const isOpen = expanded[key];
    const hasChildren = node.children?.length > 0;

    const qvals = computeQuarterValues(node.values, selectedQuarter);
    const avg = computeRowAvg(qvals);

    return (
      <React.Fragment key={key}>
        <TableRow
          component={motion.tr}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {Array.from({ length: totalHierarchyCols }).map((_, idx) => {
            if (idx === level) {
              return (
                <TableCell key={idx}>
                  <Box display="flex" alignItems="center" gap={1.2}>
                    {hasChildren ? (
                      <IconButton
                        size="small"
                        onClick={() =>
                          setExpanded((p) => ({ ...p, [key]: !p[key] }))
                        }
                      >
                        {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                      </IconButton>
                    ) : (
                      <Box width={26} />
                    )}

                    {node.label}
                  </Box>
                </TableCell>
              );
            }
            return <TableCell key={idx}>–</TableCell>;
          })}

          {qvals.map((v, i) => {
            const style =
              columns[i].isPercent && v ? getHeatStyle(v) : {};

            return (
              <TableCell key={i} align="right">
                <Box
                  sx={{
                    px: 1,
                    py: 0.4,
                    borderRadius: 1,
                    backgroundColor: style.bg || "#f3f4f6",
                    color: style.color || "#111",
                    display: "inline-block",
                  }}
                >
                  {v ?? "–"}
                </Box>
              </TableCell>
            );
          })}

          {/* Row Avg */}
          <TableCell align="right">{avg}</TableCell>

          {/* Trend */}
          {enableTrend && (
            <TableCell align="right">
              <IconButton
                size="small"
                onClick={() =>
                  setTrendState({ node, path: fullPath })
                }
              >
                <TrendingUp size={16} />
              </IconButton>
            </TableCell>
          )}
        </TableRow>

        {isOpen &&
          node.children?.map((ch) =>
            renderRow(ch, level + 1, fullPath)
          )}
      </React.Fragment>
    );
  };

  // =============== UI Rendering ================
  return (
    <>
      <Card sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between">
          <Box>
            <Typography sx={{ fontSize: 11, color: "gray" }}>
              Drill Table
            </Typography>

            <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
              {title}
            </Typography>
          </Box>

          {/* Quarter Selector */}
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

        {/* Expand / Collapse */}
        <Box my={1} display="flex" gap={1}>
          <Button size="small" onClick={expandAll}>
            Expand All
          </Button>
          <Button size="small" onClick={collapseAll}>
            Collapse All
          </Button>
        </Box>

        {/* Table */}
        <TableContainer component={Paper} sx={{ maxHeight: 460 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {Array.from({ length: totalHierarchyCols }).map(
                  (_, i) => (
                    <TableCell key={i}>
                      {levels[i] ?? `Level ${i + 1}`}
                    </TableCell>
                  )
                )}

                {columns.map((col) => (
                  <TableCell align="right" key={col.key}>
                    {col.label} ({selectedQuarter})
                  </TableCell>
                ))}

                <TableCell align="right">Avg</TableCell>

                {enableTrend && <TableCell align="right">Trend</TableCell>}
              </TableRow>
            </TableHead>

            <TableBody>
              {data
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => renderRow(row))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box mt={2} textAlign="right">
          <Button
            size="small"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Prev
          </Button>
          <Button
            size="small"
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </Box>
      </Card>

      {/* Trend Drawer */}
      {trendState && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "45vw",
            background: "white",
            p: 2,
            zIndex: 2000,
          }}
        >
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
            {trendTitle}
          </Typography>

          <ReactECharts
            option={getTrendOption()}
            style={{ height: 300, marginTop: 20 }}
          />

          <Button
            onClick={() => setTrendState(null)}
            sx={{ mt: 2 }}
            fullWidth
          >
            Close
          </Button>
        </Box>
      )}
    </>
  );
}
