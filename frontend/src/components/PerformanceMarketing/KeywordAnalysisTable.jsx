import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Card,
  Typography,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Button,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ChevronUp, ChevronDown } from "lucide-react";

// --------- CONSTANTS ----------
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// --------- CATEGORIES ----------
const CATEGORIES = ["All", "Cones & Sticks", "Cakes & Desserts", "Premium", "Family Packs"];

// --------- SAMPLE N-LEVEL DATA ----------
const momKeywordData = {
  title: "Keyword Analysis",
  keywords: [
    {
      keyword: "Sandwich, Cakes & Others",
      category: "Cakes & Desserts",
      months: MONTHS.map((m, idx) => ({
        month: m,
        impressions: 20 + idx * 2,
        conversion: `${2 + (idx % 3)}%`,
        spend: 8 + idx,
        cpm: 380 + idx * 10,
        roas: 1 + (idx % 4),
      })),
      children: [
        {
          keyword: "Cakes",
          category: "Cakes & Desserts",
          months: MONTHS.map((m, idx) => ({
            month: m,
            impressions: 10 + idx * 3,
            conversion: `${2 + (idx % 4)}%`,
            spend: 4 + idx,
            cpm: 360 + idx * 9,
            roas: 1 + (idx % 3),
          })),
          children: [
            {
              keyword: "Birthday Cakes",
              category: "Cakes & Desserts",
              months: MONTHS.map((m, idx) => ({
                month: m,
                impressions: 6 + idx * 2,
                conversion: `${1 + (idx % 3)}%`,
                spend: 3 + idx,
                cpm: 340 + idx * 7,
                roas: 1 + (idx % 4),
              })),
            },
          ],
        },
      ],
    },

    {
      keyword: "ice cream cake",
      category: "Cakes & Desserts",
      months: MONTHS.map((m, idx) => ({
        month: m,
        impressions: 14 + idx,
        conversion: `${1 + (idx % 2)}%`,
        spend: 6 + idx,
        cpm: 350 + idx * 12,
        roas: 1 + (idx % 3),
      })),
      children: [
        {
          keyword: "Premium Ice Cream Cakes",
          category: "Premium",
          months: MONTHS.map((m, idx) => ({
            month: m,
            impressions: 9 + idx * 2,
            conversion: `${2 + (idx % 3)}%`,
            spend: 5 + idx,
            cpm: 370 + idx * 10,
            roas: 1 + (idx % 4),
          })),
        },
      ],
    },

    {
      keyword: "ice cream",
      category: "Cones & Sticks",
      months: MONTHS.map((m, idx) => ({
        month: m,
        impressions: 10 + idx * 3,
        conversion: `${1 + (idx % 4)}%`,
        spend: 4 + idx,
        cpm: 330 + idx * 8,
        roas: 1 + (idx % 5),
      })),
    },

    {
      keyword: "Gourmet",
      category: "Premium",
      months: MONTHS.map((m, idx) => ({
        month: m,
        impressions: 8 + idx * 2,
        conversion: `${1 + (idx % 3)}%`,
        spend: 3 + idx,
        cpm: 310 + idx * 9,
        roas: 1 + (idx % 4),
      })),
    },
  ],
};

// ---------- helpers ----------
const parsePercent = (v) =>
  typeof v === "string" ? parseFloat(v.replace("%", "")) : Number(v || 0);

const aggregateForMonthFilter = (keywordObj, monthFilter) => {
  const sourceMonths = Array.isArray(keywordObj.months)
    ? keywordObj.months
    : [];

  const months =
    monthFilter === "All"
      ? sourceMonths
      : sourceMonths.filter((m) => m.month === monthFilter);

  if (!months.length) {
    return {
      impressions: 0,
      conversion: 0,
      spend: 0,
      cpm: 0,
      roas: 0,
    };
  }

  const sum = months.reduce(
    (acc, m) => {
      acc.impressions += m.impressions || 0;
      acc.conversion += parsePercent(m.conversion);
      acc.spend += m.spend || 0;
      acc.cpm += m.cpm || 0;
      acc.roas += m.roas || 0;
      return acc;
    },
    { impressions: 0, conversion: 0, spend: 0, cpm: 0, roas: 0 }
  );

  const count = months.length;

  return {
    impressions: sum.impressions,
    conversion: sum.conversion / count,
    spend: sum.spend,
    cpm: sum.cpm / count,
    roas: sum.roas / count,
  };
};

const getHeatColor = (conv) => {
  if (conv >= 4) return { bg: "rgba(22,163,74,0.12)", color: "#166534" };
  if (conv >= 2) return { bg: "rgba(234,179,8,0.12)", color: "#854d0e" };
  return { bg: "rgba(239,68,68,0.12)", color: "#991b1b" };
};

const buildAggTree = (node, monthFilter) => {
  const agg = aggregateForMonthFilter(node, monthFilter);
  const children = node.children
    ? node.children.map((c) => buildAggTree(c, monthFilter))
    : [];
  return { ...node, agg, children };
};

const filterTree = (node, search, minImp, categoryFilter) => {
  const matchesSearch =
    !search || node.keyword.toLowerCase().includes(search.toLowerCase());
  const matchesImp = !minImp || node.agg.impressions >= minImp;
  const matchesCategory = !categoryFilter || categoryFilter === "All" || node.category === categoryFilter;

  const filteredChildren = (node.children || [])
    .map((c) => filterTree(c, search, minImp, categoryFilter))
    .filter(Boolean);

  if (matchesSearch && matchesImp && matchesCategory)
    return { ...node, children: filteredChildren };
  if (filteredChildren.length) return { ...node, children: filteredChildren };
  return null;
};

// ---------- main component ----------
export default function KeywordAnalysisTable() {
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [minImpressions, setMinImpressions] = useState("");

  const [sortConfig, setSortConfig] = useState({
    key: "conversion",
    direction: "desc",
  });

  // pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const processedKeywords = useMemo(() => {
    const searchTrim = search.trim();
    const minNum = Number(minImpressions) || 0;

    let tree = momKeywordData.keywords.map((k) => buildAggTree(k, monthFilter));

    tree = tree.map((n) => filterTree(n, searchTrim, minNum, categoryFilter)).filter(Boolean);

    const { key, direction } = sortConfig;
    const dir = direction === "asc" ? 1 : -1;

    tree.sort((a, b) => (a.agg[key] - b.agg[key]) * dir);

    return tree;
  }, [search, monthFilter, minImpressions, sortConfig, categoryFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, monthFilter, minImpressions, sortConfig, categoryFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return processedKeywords.slice(start, start + rowsPerPage);
  }, [processedKeywords, page]);

  const renderSortLabel = (label, key) => {
    const active = sortConfig.key === key;
    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          cursor: "pointer",
        }}
        onClick={() =>
          setSortConfig((p) =>
            p.key === key
              ? { key, direction: p.direction === "asc" ? "desc" : "asc" }
              : { key, direction: "desc" }
          )
        }
      >
        {label}
        {active &&
          (sortConfig.direction === "asc" ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          ))}
      </Box>
    );
  };

  const renderNode = (node, level = 0, path = "") => {
    const key = path || node.keyword;
    const isOpen = expanded[key];
    const heat = getHeatColor(node.agg.conversion);

    const monthsToShow =
      monthFilter === "All"
        ? node.months
        : node.months.filter((m) => m.month === monthFilter);

    return (
      <React.Fragment key={key}>
        <TableRow
          component={motion.tr}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          sx={{
            "&:hover": { backgroundColor: "#f9fafb" },
            borderBottom: isOpen ? "none" : "1px solid #e5e7eb",
          }}
        >
          <TableCell>
            <IconButton
              size="small"
              onClick={() => setExpanded((p) => ({ ...p, [key]: !isOpen }))}
              sx={{ border: "1px solid #e5e7eb", width: 26, height: 26, borderRadius: 1, '&:hover': { backgroundColor: '#f8fafc' } }}
            >
              {isOpen ? <Minus size={14} /> : <Plus size={14} />}
            </IconButton>
          </TableCell>

          <TableCell>
            <Box sx={{ ml: level * 2 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
                {node.keyword}
              </Typography>
            </Box>
          </TableCell>

          <TableCell sx={{ fontSize: 11 }}>
            <Chip
              label={node.category}
              size="small"
              sx={{
                fontSize: 11,
                height: 22,
                backgroundColor: '#f1f5f9',
                color: '#475569'
              }}
            />
          </TableCell>

          <TableCell sx={{ fontSize: 11 }}>
            {monthFilter === "All" ? "All Months" : monthFilter}
          </TableCell>

          <TableCell align="right">{node.agg.impressions}</TableCell>

          <TableCell align="right">
            <Box
              sx={{
                px: 1,
                py: "2px",
                borderRadius: 1,
                background: heat.bg,
                color: heat.color,
                fontSize: 11,
                fontWeight: 600,
                display: "inline-flex",
              }}
            >
              {node.agg.conversion.toFixed(1)}%
            </Box>
          </TableCell>
          <TableCell align="right" sx={{ fontSize: 11 }}>{node.agg.spend}</TableCell>
          <TableCell align="right" sx={{ fontSize: 11 }}>{node.agg.clicks}</TableCell>
          <TableCell align="right" sx={{ fontSize: 11 }}>{node.agg.conversions}</TableCell>
          <TableCell align="right" sx={{ fontSize: 11 }}>{node.agg.revenue}</TableCell>
          <TableCell align="right" sx={{ fontSize: 11 }}>{node.agg.roas}</TableCell>
        </TableRow>

        {isOpen &&
          monthsToShow.map((m) => {
            const ch = getHeatColor(parsePercent(m.conversion));
            const rowKey = `${key}-${m.month}`;

            return (
              <TableRow
                key={rowKey}
                component={motion.tr}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                sx={{ background: "#fff" }}
              >
                <TableCell />
                <TableCell>
                  <Box sx={{ ml: (level + 1) * 2 }}>
                    <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
                      {/* Empty for monthly rows to avoid duplication */}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={node.category}
                    size="small"
                    sx={{
                      fontSize: 10,
                      height: 20,
                      backgroundColor: '#f8fafc',
                      color: '#64748b'
                    }}
                  />
                </TableCell>
                <TableCell>{m.month}</TableCell>
                <TableCell align="right">{m.impressions}</TableCell>
                <TableCell align="right">
                  <Box
                    sx={{
                      px: 1,
                      py: "2px",
                      borderRadius: 1,
                      background: ch.bg,
                      color: ch.color,
                      fontSize: 11,
                      fontWeight: 600,
                      display: "inline-flex",
                    }}
                  >
                    {m.conversion}
                  </Box>
                </TableCell>
                <TableCell align="right">{m.spend}</TableCell>
                <TableCell align="right">{m.cpm}</TableCell>
                <TableCell align="right">{m.roas}</TableCell>
              </TableRow>
            );
          })}

        {isOpen &&
          node.children?.map((c, i) =>
            renderNode(c, level + 1, `${key}-child-${i}`)
          )}
      </React.Fragment>
    );
  };

  return (
    <Card sx={{ p: 3, borderRadius: 3 }}>
      {/* HEADER */}
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {momKeywordData.title}
      </Typography>

      {/* CONTROLS */}
      <Box display="flex" gap={2} mt={2}>
        <TextField
          size="small"
          label="Search Keyword"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Month</InputLabel>
          <Select
            label="Month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <MenuItem value="All">All Months</MenuItem>
            {MONTHS.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Category</InputLabel>
          <Select
            label="Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* TABLE */}
      <TableContainer
        component={Paper}
        sx={{ mt: 2, maxHeight: 520, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 2, boxShadow: 'none' }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ borderTop: "1px solid #e5e7eb" }}>
              <TableCell sx={{ backgroundColor: 'white' }} />
              <TableCell sx={{ backgroundColor: 'white' }}>Keyword</TableCell>
              <TableCell sx={{ backgroundColor: 'white' }}>Category</TableCell>
              <TableCell sx={{ backgroundColor: 'white' }}>Month</TableCell>
              <TableCell align="right" sx={{ backgroundColor: 'white' }}>
                {renderSortLabel("Impressions", "impressions")}
              </TableCell>
              <TableCell align="right" sx={{ backgroundColor: 'white' }}>
                {renderSortLabel("Conversion", "conversion")}
              </TableCell>
              <TableCell align="right" sx={{ backgroundColor: 'white' }}>
                {renderSortLabel("Spend", "spend")}
              </TableCell>
              <TableCell align="right" sx={{ backgroundColor: 'white' }}>
                {renderSortLabel("CPM", "cpm")}
              </TableCell>
              <TableCell align="right" sx={{ backgroundColor: 'white' }}>
                {renderSortLabel("ROAS", "roas")}
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            <AnimatePresence>
              {paginated.map((n, i) =>
                renderNode(n, 0, `root-${(page - 1) * rowsPerPage + i}`)
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          mt: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Left: Prev | Page X / Y | Next */}
        <Box display="flex" alignItems="center" gap={1}>
          <Button
            size="small"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            sx={{
              minWidth: 'auto',
              borderRadius: 999,
              px: 2,
              py: 0.5,
              border: '1px solid #e2e8f0',
              color: '#64748b',
              textTransform: 'none',
              backgroundColor: 'white',
              '&:hover': { backgroundColor: '#f8fafc' },
              '&:disabled': { opacity: 0.5 }
            }}
          >
            Prev
          </Button>

          <Typography sx={{ fontSize: 12, color: "#334155", fontWeight: 500, mx: 1 }}>
            Page {page} / {Math.ceil(processedKeywords.length / rowsPerPage)}
          </Typography>

          <Button
            size="small"
            disabled={page >= Math.ceil(processedKeywords.length / rowsPerPage)}
            onClick={() => setPage((p) => p + 1)}
            sx={{
              minWidth: 'auto',
              borderRadius: 999,
              px: 2,
              py: 0.5,
              border: '1px solid #e2e8f0',
              color: '#64748b',
              textTransform: 'none',
              backgroundColor: 'white',
              '&:hover': { backgroundColor: '#f8fafc' },
              '&:disabled': { opacity: 0.5 }
            }}
          >
            Next
          </Button>
        </Box>

        {/* Right: Rows/page selector */}
        <Box display="flex" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: 12, color: "#64748b" }}>
            Rows/page
          </Typography>
          <Select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
            size="small"
            sx={{
              height: 32,
              fontSize: 12,
              borderRadius: 2,
              backgroundColor: 'white',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' }
            }}
          >
            {[5, 10, 20, 50].map((n) => (
              <MenuItem key={n} value={n} sx={{ fontSize: 12 }}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>
    </Card>
  );
}
