import React, { useMemo, useState, useEffect, useContext } from "react";
import { FilterContext } from "../../utils/FilterContext";
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
  CircularProgress,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ChevronUp, ChevronDown, LineChart, Search, SlidersHorizontal, X } from "lucide-react";
import { KpiFilterPanel } from "../KpiFilterPanel";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import axiosInstance from "../../api/axiosInstance";

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
// Static fallback removed, fetching from backend now.

// --------- SAMPLE N-LEVEL DATA ----------
// momKeywordData removed - using dynamic data from backend.


// ---------- helpers ----------
const parsePercent = (v) =>
  typeof v === "string" ? parseFloat(v.replace("%", "")) : Number(v || 0);

// Format numbers in Indian format (K, Lacs, Crores)
const formatIndianNumber = (num) => {
  if (num === null || num === undefined || num === "–" || num === "-") return "–";
  const val = typeof num === "string" ? parseFloat(num.replace(/,/g, "")) : Number(num);
  if (isNaN(val)) return "–";

  const absVal = Math.abs(val);
  if (absVal >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
  if (absVal >= 100000) return `${(val / 100000).toFixed(2)} L`;
  if (absVal >= 1000) return `${(val / 1000).toFixed(1)} K`;
  return val.toLocaleString('en-IN');
};

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

const filterTree = (node, search, minImp, categoryFilter, activeFilters) => {
  const matchesSearch =
    !search || node.keyword.toLowerCase().includes(search.toLowerCase());
  const matchesImp = !minImp || node.agg.impressions >= minImp;

  // existing single-select category filter
  const matchesCategorySelect = !categoryFilter || categoryFilter === "All" || node.category === categoryFilter;

  // new multi-select filters from modal
  const matchesMultiCategory =
    !activeFilters?.categories?.length ||
    activeFilters.categories.includes(node.category);

  const matchesMultiKeyword =
    !activeFilters?.keywords?.length ||
    activeFilters.keywords.includes(node.keyword);

  // Combine matches
  const isMatch = matchesSearch && matchesImp && matchesCategorySelect && matchesMultiCategory && matchesMultiKeyword;

  const filteredChildren = (node.children || [])
    .map((c) => filterTree(c, search, minImp, categoryFilter, activeFilters))
    .filter(Boolean);

  if (isMatch)
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
  const [backendCategories, setBackendCategories] = useState([]);
  const [apiData, setApiData] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const {
    pmSelectedPlatform,
    pmSelectedBrand,
    selectedZone,
    timeStart,
    timeEnd,
  } = useContext(FilterContext);

  useEffect(() => {
    const fetchKeywordData = async () => {
      setLoading(true);
      try {
        const response = await axiosInstance.get('/performance-marketing/keyword-analysis', {
          params: {
            platform: Array.isArray(pmSelectedPlatform) ? pmSelectedPlatform.join(',') : pmSelectedPlatform,
            brand: Array.isArray(pmSelectedBrand) ? pmSelectedBrand.join(',') : pmSelectedBrand,
            zone: Array.isArray(selectedZone) ? selectedZone.join(',') : selectedZone,
            startDate: timeStart?.format("YYYY-MM-DD"),
            endDate: timeEnd?.format("YYYY-MM-DD"),
            weekendFlag: activeFilters.weekendFlag
          }
        });
        console.log("🔍 [Frontend] Keyword Analysis API Data:", response.data);
        if (Array.isArray(response.data)) {
          setApiData(response.data);
        }
      } catch (error) {
        console.error('Error fetching keyword analysis:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchKeywordData();
  }, [pmSelectedPlatform, pmSelectedBrand, selectedZone, timeStart, timeEnd, activeFilters.weekendFlag]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axiosInstance.get('/performance-marketing/categories');
        if (Array.isArray(response.data)) {
          setBackendCategories(response.data);
        }
      } catch (error) {
        console.error('Error fetching PM categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const [sortConfig, setSortConfig] = useState({
    key: "conversion",
    direction: "desc",
  });

  // pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);



  const filterOptions = useMemo(() => {
    const opts = {
      keywords: new Map(),
      categories: new Map(),
      months: new Map(),
    };

    // Add backend categories first
    backendCategories.forEach(cat => {
      opts.categories.set(cat, { id: cat, label: cat, value: 0 });
    });

    const traverse = (nodes) => {
      nodes.forEach((node) => {
        opts.keywords.set(node.keyword, { id: node.keyword, label: node.keyword, value: 0 });
        if (node.months) {
          node.months.forEach(m => {
            opts.months.set(m.month, { id: m.month, label: m.month, value: 0 });
          });
        }
        if (node.children) traverse(node.children);
      });
    };

    traverse(apiData);

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
  }, [apiData, backendCategories]);

  const processedKeywords = useMemo(() => {
    const searchTrim = search.trim();
    const minNum = Number(minImpressions) || 0;

    let tree = apiData.map((k) => buildAggTree(k, monthFilter));

    tree = tree.map((n) => filterTree(n, searchTrim, minNum, categoryFilter, activeFilters, monthFilter)).filter(Boolean);

    const { key, direction } = sortConfig;
    const dir = direction === "asc" ? 1 : -1;

    tree.sort((a, b) => (a.agg[key] - b.agg[key]) * dir);

    return tree;
  }, [search, monthFilter, minImpressions, sortConfig, categoryFilter, activeFilters, apiData]);

  useEffect(() => {
    setPage(1);
  }, [search, monthFilter, minImpressions, sortConfig, categoryFilter, activeFilters, apiData]);

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

  const LEVEL_TITLES = ["Keyword", "Category", "Month"];

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
                    onClick={hasChildren ? () => setExpandedNodes((p) => ({ ...p, [key]: !p[key] })) : undefined}
                    sx={{ cursor: hasChildren ? "pointer" : "default", userSelect: "none" }}
                  >
                    {hasChildren && (
                      <IconButton
                        size="small"
                        sx={{
                          border: "1px solid #e5e7eb",
                          width: 20,
                          height: 20,
                          borderRadius: 2,
                          backgroundColor: "white",
                          cursor: "pointer",
                          "&:hover": { backgroundColor: "#f8fafc" },
                        }}
                      >
                        {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                      </IconButton>
                    )}
                    <Typography sx={{ fontSize: 13, fontWeight: hasChildren ? 700 : 500, color: "#1e293b" }}>
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


          <TableCell align="center" sx={{ fontSize: 11 }}>{formatIndianNumber(node.agg.impressions)}</TableCell>

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
          <TableCell align="center" sx={{ fontSize: 11 }}>{formatIndianNumber(node.agg.spend)}</TableCell>
          <TableCell align="center" sx={{ fontSize: 11 }}>{formatIndianNumber(node.agg.cpm)}</TableCell>
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
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-900/40 px-4 pb-4 pt-16 transition-all backdrop-blur-sm">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Advanced Filters</h2>
                <p className="text-sm text-slate-500">Configure data visibility and rules</p>
              </div>
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
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
                  { id: "weekendFlag", label: "Weekend Flag" },
                  { id: "kpiRules", label: "KPI Rules" },
                ]}
                onWeekendChange={(vals) => setActiveFilters(p => ({ ...p, weekendFlag: vals }))}
                sectionValues={{ ...activeFilters, platforms: activeFilters.months }} // Map 'months' to 'platforms' key
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
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER & CONTROLS */}
      <Box
        display="flex"
        flexDirection={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "flex-start" }}
        mb={2}
        gap={{ xs: 2, md: 0 }}
      >
        <Box width={{ xs: "100%", md: "auto" }}>
          <Box display="flex" flexDirection={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} gap={2}>
            <Typography sx={{ fontSize: { xs: 16, md: 18 }, fontWeight: 700, color: "#0f172a" }}>
              Keyword Analysis
            </Typography>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              displayEmpty
              variant="standard"
              disableUnderline
              sx={{
                fontSize: { xs: 11, md: 12 },
                borderRadius: 999,
                px: { xs: 1.2, md: 1.5 },
                height: { xs: 30, md: 32 },
                width: { xs: "100%", sm: "auto" },
                backgroundColor: "#f1f5f9",
                color: "#334155",
                border: "1px solid #e2e8f0",
                cursor: "pointer",
                "&:hover": { backgroundColor: "#e2e8f0" },
                "& .MuiSelect-select": {
                  paddingRight: "24px !important",
                  py: 0.5,
                  display: "flex",
                  alignItems: "center",
                },
                minWidth: { xs: "100%", sm: 120 },
              }}
              MenuProps={{
                PaperProps: {
                  sx: { borderRadius: 2, mt: 1 },
                },
              }}
            >
              <MenuItem value="All" sx={{ fontSize: 12, fontWeight: 500 }}>
                All Categories
              </MenuItem>
              {filterOptions.categories.map((c) => (
                <MenuItem key={c.label} value={c.label} sx={{ fontSize: 12 }}>
                  {c.label}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Typography sx={{ fontSize: { xs: 10, md: 11 }, color: "#94a3b8", mt: { xs: 0.5, md: 0 } }}>
            Keyword → Category → Month
          </Typography>
        </Box>

        <Box
          display="flex"
          flexDirection={{ xs: "column", sm: "row" }}
          gap={{ xs: 1.5, md: 2 }}
          alignItems={{ xs: "stretch", sm: "center" }}
          width={{ xs: "100%", md: "auto" }}
        >
          <Button
            onClick={() => setFilterPanelOpen(true)}
            startIcon={<SlidersHorizontal size={14} />}
            sx={{
              height: { xs: 36, md: 40 },
              fontSize: { xs: 11, md: 12 },
              textTransform: "none",
              borderRadius: 999,
              px: { xs: 1.5, md: 2 },
              backgroundColor: "#f1f5f9",
              color: "#334155",
              border: "1px solid #e2e8f0",
              cursor: "pointer",
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
              minWidth: { xs: "100%", md: 240 },
              "& .MuiOutlinedInput-root": {
                borderRadius: 999,
                backgroundColor: "#f1f5f9",
                paddingRight: 1.5,
                "& fieldset": { borderColor: "#e2e8f0" },
                "&:hover fieldset": { borderColor: "#cbd5e1" },
                "&.Mui-focused fieldset": { borderColor: "#94a3b8" },
              },
              "& .MuiOutlinedInput-input": {
                fontSize: { xs: 13, md: 14 },
                color: "#334155",
                py: { xs: 0.75, md: 1 },
              },
            }}
          />
        </Box>
      </Box>

      {/* TABLE */}
      <TableContainer
        component={Paper}
        sx={{
          mt: 2,
          maxHeight: 520,
          overflow: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: 2,
          boxShadow: 'none',
          overflowX: { xs: 'auto', md: 'auto' },
          WebkitOverflowScrolling: 'touch',
        }}
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={visibleHierarchyCols + 4} align="center" sx={{ py: 10 }}>
                  <CircularProgress size={40} sx={{ color: "#10b981" }} />
                  <Typography sx={{ mt: 2, color: "#64748b", fontSize: 14 }}>
                    Fetching keyword performance...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleHierarchyCols + 4} align="center" sx={{ py: 10 }}>
                  <Typography sx={{ color: "#64748b", fontSize: 14 }}>
                    No keyword data found for the selected filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence>
                {paginated.map((n, i) =>
                  renderNode(n, 0, `root-${(page - 1) * rowsPerPage + i}`)
                )}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </TableContainer >

      {/* PAGINATION FOOTER */}
      < div className="border-t border-slate-100" >
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
      </div >
    </Card >
  );
}
