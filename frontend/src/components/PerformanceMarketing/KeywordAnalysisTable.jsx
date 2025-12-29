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
  InputAdornment,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ChevronUp, ChevronDown, LineChart, Search, SlidersHorizontal, X } from "lucide-react";
import { KpiFilterPanel } from "../KpiFilterPanel";
import PaginationFooter from "../CommonLayout/PaginationFooter";

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
      keyword: "Branded",
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
          keyword: "Magnum",
          category: "Cakes & Desserts",
          months: MONTHS.map((m, idx) => ({
            month: m,
            impressions: 10 + idx * 3,
            conversion: `${2 + (idx % 4)}%`,
            spend: 4 + idx,
            cpm: 360 + idx * 9,
            roas: 1 + (idx % 3),
          })),
        },
      ],
    },

    {
      keyword: "Browse",
      category: "Cones & Sticks",
      months: MONTHS.map((m, idx) => ({
        month: m,
        impressions: 10 + idx * 3,
        conversion: `${1 + (idx % 4)}%`,
        spend: 4 + idx,
        cpm: 330 + idx * 8,
        roas: 1 + (idx % 5),
      })),
      children: [
        {
          keyword: "Core Tub",
          category: "Cakes & Desserts",
          months: MONTHS.map((m, idx) => ({
            month: m,
            impressions: 14 + idx,
            conversion: `${1 + (idx % 2)}%`,
            spend: 6 + idx,
            cpm: 350 + idx * 12,
            roas: 1 + (idx % 3),
          })),
        },
      ]
    },

    {
      keyword: "Competition",
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

    {
      keyword: "Generic",
      category: "Family Packs",
      months: MONTHS.map((m, idx) => ({
        month: m,
        impressions: 12 + idx * 2,
        conversion: `${1 + (idx % 2)}%`,
        spend: 5 + idx,
        cpm: 320 + idx * 8,
        roas: 1 + (idx % 3),
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

const getExpandedDepth = (expandedKeys) => {
  if (!expandedKeys) return 0;
  let max = 0;
  Object.keys(expandedKeys).forEach((key) => {
    if (expandedKeys[key]) {
      const depth = key.split("-child-").length; // approximated depth based on path structure
      if (depth > max) max = depth;
    }
  });
  return max;
};

// ---------- main component ----------
export default function KeywordAnalysisTable() {
  const [expandedNodes, setExpandedNodes] = useState({});
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

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    brands: [],
    categories: [],
    cities: [],
    keywords: [],
    skus: [],
    platforms: [],
    kpiRules: null,
    weekendFlag: [],
    months: [],
  });

  const filterOptions = useMemo(() => {
    const opts = {
      keywords: new Map(),
      categories: new Map(),
      months: new Map(),
    };

    const traverse = (nodes) => {
      nodes.forEach((node) => {
        opts.keywords.set(node.keyword, { id: node.keyword, label: node.keyword, value: 0 });
        if (node.category) {
          opts.categories.set(node.category, { id: node.category, label: node.category, value: 0 });
        }
        if (node.months) {
          node.months.forEach(m => {
            opts.months.set(m.month, { id: m.month, label: m.month, value: 0 });
          });
        }
        if (node.children) traverse(node.children);
      });
    };

    traverse(momKeywordData.keywords);

    return {
      keywords: Array.from(opts.keywords.values()),
      categories: Array.from(opts.categories.values()),
      months: Array.from(opts.months.values()),
      kpiFields: [
        { id: "impressions", label: "Impressions", type: "number" },
        { id: "conversion", label: "Conversion", type: "number" },
        { id: "spend", label: "Spend", type: "number" },
        { id: "cpm", label: "CPM", type: "number" },
        { id: "roas", label: "ROAS", type: "number" },
      ],
    };
  }, []);

  const processedKeywords = useMemo(() => {
    const searchTrim = search.trim();
    const minNum = Number(minImpressions) || 0;

    let tree = momKeywordData.keywords.map((k) => buildAggTree(k, monthFilter));

    tree = tree.map((n) => filterTree(n, searchTrim, minNum, categoryFilter, activeFilters, monthFilter)).filter(Boolean);

    const { key, direction } = sortConfig;
    const dir = direction === "asc" ? 1 : -1;

    tree.sort((a, b) => (a.agg[key] - b.agg[key]) * dir);

    return tree;
  }, [search, monthFilter, minImpressions, sortConfig, categoryFilter, activeFilters]);

  useEffect(() => {
    setPage(1);
  }, [search, monthFilter, minImpressions, sortConfig, categoryFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return processedKeywords.slice(start, start + rowsPerPage);
  }, [processedKeywords, page]);


  const maxDepth = getMaxDepth(processedKeywords, 0);

  // Calculate depth from expanded keys
  const getDepthFromKey = (key) => {
    // key format: "root-0" or "root-0-child-1" etc. 
    // root is 0. 
    // -child- adds 1 level.
    return key.split("-child-").length - 1;
  }

  const checkAncestorsExpanded = (key, expandedMap) => {
    // recursive check
    if (!key.includes("-child-")) return true;
    const lastIndex = key.lastIndexOf("-child-");
    const parentKey = key.substring(0, lastIndex);
    if (!expandedMap[parentKey]) return false;
    return checkAncestorsExpanded(parentKey, expandedMap);
  };

  let expandedDepth = 0;
  Object.keys(expandedNodes).forEach(k => {
    if (expandedNodes[k]) {
      // Check visibility
      if (checkAncestorsExpanded(k, expandedNodes)) {
        const d = getDepthFromKey(k);
        if (d > expandedDepth) expandedDepth = d;
        if (d + 1 > expandedDepth) expandedDepth = d + 1;
      }
    }
  });

  const visibleHierarchyCols = Math.max(
    1,
    Math.min(expandedDepth + 1, maxDepth + 1)
  );

  const LEVEL_TITLES = ["Keyword", "Sub-keyword", "Category"];

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
    const isOpen = expandedNodes[key];
    const heat = getHeatColor(node.agg.conversion);

    const hasChildren = node.children && node.children.length > 0;

    const rowBg = "#fff";

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
          {Array.from({ length: visibleHierarchyCols }).map((_, col) => {
            const sticky = col === 0 ? {
              position: "sticky",
              left: 0,
              zIndex: 10,
              backgroundColor: rowBg,
              minWidth: 150,
              borderRight: "1px solid transparent",
            } : {};

            if (col === level) {
              return (
                <TableCell key={col} sx={{ ...sticky, p: 1 }}>
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1.2}
                    onClick={() => setExpandedNodes((p) => ({ ...p, [key]: !p[key] }))}
                    sx={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <IconButton
                      size="small"
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
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                      {node.keyword}
                    </Typography>
                  </Box>
                </TableCell>
              );
            }
            return (
              <TableCell key={col} sx={sticky}>
                {/* placeholder */}
              </TableCell>
            );
          })}


          <TableCell align="center" sx={{ fontSize: 11 }}>
            {monthFilter === "All" ? "All Months" : monthFilter}
          </TableCell>

          <TableCell align="center">{node.agg.impressions}</TableCell>

          <TableCell align="center">
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
          <TableCell align="center" sx={{ fontSize: 11 }}>{node.agg.spend}</TableCell>
          <TableCell align="center" sx={{ fontSize: 11 }}>{node.agg.cpm.toFixed(0)}</TableCell>
          <TableCell align="center" sx={{ fontSize: 11 }}>{node.agg.roas.toFixed(1)}</TableCell>
        </TableRow>

        {isOpen &&
          node.children?.map((c) =>
            renderNode(c, level + 1, `${key}-child-${c.keyword}`)
          )}
      </React.Fragment>
    );
  };

  return (
    <Card sx={{ p: 3, borderRadius: 3 }}>
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

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-6 pb-6">
              <KpiFilterPanel
                sectionConfig={[
                  { id: "categories", label: "Category" },
                  { id: "keywords", label: "Keyword" },
                  { id: "platforms", label: "Month" },
                  { id: "kpiRules", label: "KPI Rules" },
                ]}
                keywords={filterOptions.keywords}
                categories={filterOptions.categories}
                platforms={filterOptions.months}
                brands={[]}
                skus={[]}
                cities={[]}
                kpiFields={filterOptions.kpiFields}
                onKeywordChange={(ids) => setActiveFilters(p => ({ ...p, keywords: ids }))}
                onCategoryChange={(ids) => setActiveFilters(p => ({ ...p, categories: ids }))}
                onPlatformChange={(ids) => setActiveFilters(p => ({ ...p, months: ids }))}
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

      {/* HEADER & CONTROLS */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
            {momKeywordData.title}
          </Typography>
          <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>
            Keyword → Sub-keyword → Category
          </Typography>
        </Box>

        <Box display="flex" gap={2} alignItems="center">
          <Button
            onClick={() => setFilterPanelOpen(true)}
            startIcon={<SlidersHorizontal size={14} />}
            sx={{
              height: 40,
              fontSize: 12,
              textTransform: "none",
              borderRadius: 999,
              px: 2,
              backgroundColor: "#f1f5f9",
              color: "#334155",
              border: "1px solid #e2e8f0",
              "&:hover": { backgroundColor: "#e2e8f0" }
            }}
          >
            Filters
          </Button>

          <TextField
            size="small"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Search size={18} color="#64748b" />
                </InputAdornment>
              ),
            }}
            sx={{
              minWidth: 240,
              "& .MuiOutlinedInput-root": {
                borderRadius: 999,
                backgroundColor: "#f1f5f9",
                paddingRight: 1.5,
                "& fieldset": { borderColor: "#e2e8f0" },
                "&:hover fieldset": { borderColor: "#cbd5e1" },
                "&.Mui-focused fieldset": { borderColor: "#94a3b8" },
              },
              "& .MuiOutlinedInput-input": {
                fontSize: 14,
                color: "#334155",
                py: 1,
              },
            }}
          />
        </Box>
      </Box>

      {/* TABLE */}
      <TableContainer
        component={Paper}
        sx={{ mt: 2, maxHeight: 520, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 2, boxShadow: 'none' }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ borderTop: "1px solid #e5e7eb" }}>
              {Array.from({ length: visibleHierarchyCols }).map((_, i) => (
                <TableCell
                  key={i}
                  sx={i === 0
                    ? { position: "sticky", left: 0, background: "white", zIndex: 10, minWidth: 150, verticalAlign: "bottom", pb: 1.5, borderLeft: i > 0 ? "1px solid #f1f5f9" : "none", color: "#334155", fontWeight: 600 }
                    : { background: "white", verticalAlign: "bottom", borderLeft: "1px solid #f1f5f9", pb: 1.5, color: "#334155" }
                  }
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.6 }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#334155" }}>
                      {LEVEL_TITLES[i] || `Level ${i + 1}`}
                    </Typography>
                  </Box>
                </TableCell>
              ))}

              <TableCell align="center" sx={{ backgroundColor: 'white', fontSize: 12, fontWeight: 600, color: "#475569" }}>Month</TableCell>
              <TableCell align="center" sx={{ backgroundColor: 'white', fontSize: 12, fontWeight: 600, color: "#475569" }}>
                {renderSortLabel("Impressions", "impressions")}
              </TableCell>
              <TableCell align="center" sx={{ backgroundColor: 'white', fontSize: 12, fontWeight: 600, color: "#475569" }}>
                {renderSortLabel("Conversion", "conversion")}
              </TableCell>
              <TableCell align="center" sx={{ backgroundColor: 'white', fontSize: 12, fontWeight: 600, color: "#475569" }}>
                {renderSortLabel("Spend", "spend")}
              </TableCell>
              <TableCell align="center" sx={{ backgroundColor: 'white', fontSize: 12, fontWeight: 600, color: "#475569" }}>
                {renderSortLabel("CPM", "cpm")}
              </TableCell>
              <TableCell align="center" sx={{ backgroundColor: 'white', fontSize: 12, fontWeight: 600, color: "#475569" }}>
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

      {/* PAGINATION FOOTER */}
      <div className="border-t border-slate-100">
        <PaginationFooter
          isVisible={true}
          currentPage={page}
          totalPages={Math.ceil(processedKeywords.length / rowsPerPage)}
          onPageChange={setPage}
          pageSize={rowsPerPage}
          onPageSizeChange={(newPageSize) => {
            setRowsPerPage(newPageSize);
            setPage(1);
          }}
        />
      </div>
    </Card>
  );
}
