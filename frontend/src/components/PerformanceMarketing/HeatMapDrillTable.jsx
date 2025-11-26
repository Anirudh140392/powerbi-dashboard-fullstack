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
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

import performanceData from "../../utils/PerformanceMarketingData";

// ---------------- HELPER FUNCTIONS ----------------
const parsePercent = (val) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val.replace("%", ""));
  return NaN;
};
const rowConvAvg = (values) => {
  const target = [3, 4, 5];
  const nums = target.map((i) => parsePercent(values[i])).filter((x) => !isNaN(x));
  if (!nums.length) return "";
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return avg.toFixed(1) + "%";
};
const getHeatStyle = (val) => {
  const n = parsePercent(val);
  if (isNaN(n)) return {};
  if (n >= 3) return { backgroundColor: "#d1fae5", color: "#065f46" };
  if (n >= 2) return { backgroundColor: "#fffbeb", color: "#92400e" };
  return { backgroundColor: "#ffe4e6", color: "#9f1239" };
};

// ---------------- MAIN COMPONENT ----------------
export default function HeatMapDrillTable() {
  const { heatmapData } = performanceData;

  const [expanded, setExpanded] = useState({});
  const [openFilter, setOpenFilter] = useState(false);
  const [formatFilter, setFormatFilter] = useState("All");

  const toggle = (k) => {
    setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const expandAll = () => {
    const all = {};
    const walk = (arr) => {
      arr.forEach((node) => {
        if (node.children?.length) {
          all[node.label] = true;
          walk(node.children);
        }
      });
    };
    walk(heatmapData.rows);
    setExpanded(all);
  };

  const collapseAll = () => setExpanded({});

  // ---------------- FILTERING ----------------
  const filteredRows =
    formatFilter === "All"
      ? heatmapData.rows
      : heatmapData.rows.filter((row) => row.label === formatFilter);

  // ---------------- RENDER RECURSIVE ROW ----------------
  const renderRow = (node, level = 0, path = []) => {
    const key = [...path, node.label].join(">");
    const isOpen = expanded[node.label];
    const hasChildren = node.children?.length > 0;
    const avg = rowConvAvg(node.values);

    return (
      <React.Fragment key={key}>
        <TableRow
          component={motion.tr}
          layout
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          sx={{
            backgroundColor: level === 0 ? "#f8fafc" : "white"
          }}
        >
          <TableCell
            sx={{
              position: "sticky",
              left: 0,
              zIndex: 10,
              backgroundColor: level === 0 ? "#f8fafc" : "white",
              borderRight: "1px solid #e2e8f0",
              fontWeight: level === 0 ? 700 : level === 1 ? 600 : 500,
              whiteSpace: "nowrap"
            }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              {hasChildren ? (
                <Button
                  onClick={() => toggle(node.label)}
                  variant="outlined"
                  size="small"
                  sx={{
                    minWidth: 26,
                    width: 26,
                    height: 26,
                    p: 0,
                    borderRadius: 1
                  }}
                >
                  {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                </Button>
              ) : (
                <Box sx={{ width: 26, height: 26 }} />
              )}

              <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>
                {"↳".repeat(level)}
              </Typography>

              <Typography sx={{ fontSize: 13 }}>{node.label}</Typography>
            </Box>
          </TableCell>

          {node.values.map((v, i) => {
            const heat = i >= 3 ? getHeatStyle(v) : {};
            return (
              <TableCell key={i} align="right">
                <Box
                  component={motion.div}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  sx={{
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    display: "inline-flex",
                    minWidth: 70,
                    justifyContent: "flex-end",
                    fontSize: 11,
                    fontWeight: 600,
                    ...heat
                  }}
                >
                  {v}
                </Box>
              </TableCell>
            );
          })}

          <TableCell align="right" sx={{ fontSize: 11, color: "#64748b" }}>
            {avg ? "avg " + avg : ""}
          </TableCell>
        </TableRow>

        <AnimatePresence>
          {isOpen &&
            hasChildren &&
            node.children.map((child) =>
              renderRow(child, level + 1, [...path, node.label])
            )}
        </AnimatePresence>
      </React.Fragment>
    );
  };

  return (
    <>
      {/* FLOATING FILTER BUTTON */}
      <Box
        sx={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 2000
        }}
      >
        <Button
          variant="contained"
          onClick={() => setOpenFilter(true)}
          sx={{
            borderRadius: "50%",
            width: 64,
            height: 64,
            backgroundColor: "#6366F1",
            color: "white",
            boxShadow: "0 12px 28px rgba(99,102,241,0.35)",
            "&:hover": { backgroundColor: "#4F46E5" }
          }}
        >
          Filter
        </Button>
      </Box>

      {/* MAIN CARD */}
      <Card sx={{ p: 3, borderRadius: 3, border: "1px solid #e2e8f0" }}>
        {/* HEADER */}
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Box>
            <Typography
              sx={{
                fontSize: 11,
                color: "#94a3b8",
                letterSpacing: "0.15em"
              }}
            >
              FORMAT HIERARCHY HEATMAP
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#475569" }}>
              {heatmapData.title} · {heatmapData.duration}
            </Typography>
          </Box>

          <Box display="flex" gap={1}>
            <Button variant="outlined" size="small" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outlined" size="small" onClick={collapseAll}>
              Collapse All
            </Button>
          </Box>
        </Box>

        {/* TABLE */}
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f1f5f9" }}>
                <TableCell
                  sx={{
                    position: "sticky",
                    left: 0,
                    zIndex: 20,
                    backgroundColor: "#f1f5f9",
                    fontWeight: 600
                  }}
                >
                  {heatmapData.headers[0]}
                </TableCell>

                {heatmapData.headers.slice(1).map((h) => (
                  <TableCell key={h} align="right" sx={{ fontWeight: 600 }}>
                    {h}
                  </TableCell>
                ))}

                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Row Avg (Conv)
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              <AnimatePresence initial={false}>
                {filteredRows.map((row) => renderRow(row, 0, []))}

                <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                  <TableCell
                    sx={{
                      position: "sticky",
                      left: 0,
                      zIndex: 20,
                      backgroundColor: "#f8fafc",
                      fontWeight: 700
                    }}
                  >
                    {heatmapData.total[0]}
                  </TableCell>

                  {heatmapData.total.slice(1).map((v, i) => (
                    <TableCell key={i} align="right" sx={{ fontWeight: 700 }}>
                      {v}
                    </TableCell>
                  ))}
                </TableRow>
              </AnimatePresence>
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* WOW FILTER POPUP */}
      <AnimatePresence>
        {openFilter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: "fixed",
              inset: 0,
              backdropFilter: "blur(12px)",
              background: "rgba(0,0,0,0.35)",
              zIndex: 3000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            onClick={() => setOpenFilter(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.6, y: 40 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                transition: {
                  type: "spring",
                  stiffness: 150,
                  damping: 15
                }
              }}
              exit={{
                opacity: 0,
                scale: 0.6,
                y: 40,
                transition: { duration: 0.2 }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 380,
                background: "rgba(255,255,255,0.85)",
                borderRadius: 20,
                padding: 28,
                border: "1px solid rgba(255,255,255,0.4)",
                boxShadow: "0 28px 80px rgba(0,0,0,0.25)",
                backdropFilter: "blur(20px)"
              }}
            >
              <Typography fontWeight={700} sx={{ fontSize: 20, mb: 2 }}>
                Filters
              </Typography>

              {/* FORMAT FILTER */}
              <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                <InputLabel>Format</InputLabel>
                <Select
                  value={formatFilter}
                  label="Format"
                  onChange={(e) => setFormatFilter(e.target.value)}
                >
                  <MenuItem value="All">All Formats</MenuItem>
                  {heatmapData.rows.map((f) => (
                    <MenuItem key={f.label} value={f.label}>
                      {f.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="contained"
                fullWidth
                sx={{
                  py: 1.1,
                  backgroundColor: "#6366F1",
                  borderRadius: 2,
                  "&:hover": { backgroundColor: "#4F46E5" }
                }}
                onClick={() => setOpenFilter(false)}
              >
                Apply Filters
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
