import React, { useState, useContext, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import {
  Box,
  Card,
  CardContent,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Popover,
  InputAdornment,
  TextField,
  Skeleton,
  Chip,
  Select,
  MenuItem,
} from "@mui/material";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Tooltip as ChartTooltip,
  ReferenceLine,
} from "recharts";
import DateRangeComparePicker from "../../CommonLayout/DateRangeComparePicker";
import { FilterContext } from "../../../utils/FilterContext";
import {
  TrendingUp,
  Award,
  Building2,
  Search,
  CheckCircle2,
  Circle,
  ChevronDown,
  BarChart2,
  Layers,
} from "lucide-react";
import {
  fetchSecondaryFilterOptions,
  fetchSecondaryLatestDate,
  fetchSecondarySellerWise,
  fetchSecondaryQuarterWise,
  fetchSecondaryTopBrands,
  fetchSecondarySalesTimeline,
} from "../../../api/secondarySalesService";

// ── Colour palette ────────────────────────────────────────────────────────────
const SELLER_COLORS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
  "#14b8a6", "#f97316",
];

const BRAND_RANK_COLORS = [
  { bg: "linear-gradient(135deg,#6366f1,#4f46e5)", text: "#fff" },
  { bg: "linear-gradient(135deg,#3b82f6,#2563eb)", text: "#fff" },
  { bg: "linear-gradient(135deg,#06b6d4,#0891b2)", text: "#fff" },
  { bg: "linear-gradient(135deg,#10b981,#059669)", text: "#fff" },
  { bg: "linear-gradient(135deg,#f59e0b,#d97706)", text: "#fff" },
];

const MENU_DOT_COLORS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
];

// ── Helper: format raw rupee value → readable label ──────────────────────────
const fmtVal = (val) => {
  const v = parseFloat(val) || 0;
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}CR`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};

const fmtAxis = (v) => {
  const n = parseFloat(v) || 0;
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)}CR`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
};

// ── Multi-select filter popover ───────────────────────────────────────────────
function MultiSelectFilterPopover({ label, options = [], selected = [], onChange }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [search, setSearch] = useState("");

  const isOpen = Boolean(anchorEl);
  const open = (e) => setAnchorEl(e.currentTarget);
  const close = () => { setAnchorEl(null); setSearch(""); };

  const isAll = !selected || selected.length === 0 ||
    (options.length > 0 && selected.length === options.length);

  const toggle = (item) => {
    let next = Array.isArray(selected) ? [...selected] : [];
    if (next.includes(item)) next = next.filter((i) => i !== item);
    else next.push(item);
    if (options.length > 0 && next.length === options.length) next = [];
    onChange(next);
  };

  const filtered = React.useMemo(() => {
    if (!search.trim()) return options;
    return options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const btnText = React.useMemo(() => {
    if (!selected || selected.length === 0 ||
      (options.length > 0 && selected.length === options.length)) return "All";
    if (selected.length === 1) return selected[0];
    return `${selected.length} selected`;
  }, [selected, options]);

  const hasSelection = selected && selected.length > 0 &&
    !(options.length > 0 && selected.length === options.length);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, flex: "1 1 0px", minWidth: 80 }}>
      <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </Typography>
      <Button
        onClick={open}
        variant="outlined"
        endIcon={<ChevronDown size={12} color="#64748b" />}
        sx={{
          height: 36, width: "100%", px: 1.2, justifyContent: "space-between",
          fontSize: "0.75rem", fontWeight: 600,
          color: hasSelection ? "#6366f1" : "#334155",
          backgroundColor: hasSelection ? "#eef2ff" : "#ffffff",
          borderRadius: "8px",
          borderColor: hasSelection ? "#a5b4fc" : "#e2e8f0",
          textTransform: "none",
          transition: "all 0.15s ease",
          "&:hover": { backgroundColor: "#f0f4ff", borderColor: "#6366f1", color: "#6366f1" },
        }}
      >
        <Typography noWrap sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
          {btnText}
        </Typography>
      </Button>

      <Popover
        open={isOpen} anchorEl={anchorEl} onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            width: 240, maxHeight: 320, borderRadius: "14px", p: 1.2,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)",
            border: "1px solid rgba(99,102,241,0.12)",
          },
        }}
      >
        <TextField
          size="small" fullWidth placeholder={`Search ${label}...`}
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={13} color="#94a3b8" /></InputAdornment> }}
          sx={{
            mb: 1,
            "& .MuiOutlinedInput-root": {
              height: 32, fontSize: "0.75rem", borderRadius: "10px", backgroundColor: "#f8fafc",
              "& fieldset": { borderColor: "#e2e8f0" },
              "&:hover fieldset, &.Mui-focused fieldset": { borderColor: "#6366f1" },
            },
          }}
        />
        <Box sx={{ overflowY: "auto", maxHeight: 230 }}>
          {/* All option */}
          <Box onClick={() => onChange([])} sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            py: 0.7, px: 1, borderRadius: "8px", cursor: "pointer", mb: 0.3,
            backgroundColor: isAll ? "#eef2ff" : "transparent",
            "&:hover": { backgroundColor: "#f0f4ff" }, transition: "background 0.15s",
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#6366f1" }} />
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e293b" }}>All</Typography>
            </Box>
            {isAll ? <CheckCircle2 size={15} color="#6366f1" /> : <Circle size={15} color="#cbd5e1" />}
          </Box>

          {filtered.map((item, idx) => {
            const isSel = selected.includes(item);
            return (
              <Box key={item} onClick={() => toggle(item)} sx={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                py: 0.7, px: 1, borderRadius: "8px", cursor: "pointer", mb: 0.3,
                backgroundColor: isSel ? "#eef2ff" : "transparent",
                "&:hover": { backgroundColor: "#f0f4ff" }, transition: "background 0.15s",
              }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: MENU_DOT_COLORS[idx % MENU_DOT_COLORS.length] }} />
                  <Typography noWrap sx={{ fontSize: "0.78rem", fontWeight: 500, color: "#334155" }}>{item}</Typography>
                </Box>
                {isSel ? <CheckCircle2 size={15} color="#6366f1" /> : <Circle size={15} color="#cbd5e1" />}
              </Box>
            );
          })}
        </Box>
      </Popover>
    </Box>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
const ShimmerCard = ({ height = 160 }) => (
  <Skeleton variant="rounded" width="100%" height={height} animation="wave"
    sx={{ borderRadius: 2, bgcolor: "#f1f5f9" }} />
);

// ── Custom tooltip ────────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, labelKey = "label" }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <Box sx={{
      background: "linear-gradient(135deg,#1e293b,#0f172a)",
      color: "#fff", px: 1.5, py: 1, borderRadius: "10px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      fontSize: "0.72rem", fontWeight: 700, minWidth: 100,
    }}>
      <Typography sx={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>
        {d[labelKey] || d.quarter || d.month}
      </Typography>
      <Typography sx={{ fontSize: "0.80rem", color: "#f1f5f9", fontWeight: 800, mt: 0.2 }}>
        {payload[0].value !== undefined ? fmtVal(payload[0].value) : d.label}
      </Typography>
    </Box>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function SecondarySummaryOverview() {
  const filterCtx = useContext(FilterContext) || {};
  const {
    timeStart, setTimeStart, timeEnd, setTimeEnd,
    compareStart, setCompareStart, compareEnd, setCompareEnd,
    maxDate, minDate, setMinDate, setMaxDate,
    setUserSetDate, setComparisonLabel,
    activeGranularity, setActiveGranularity,
  } = filterCtx;

  useEffect(() => {
    fetchSecondaryLatestDate().then((res) => {
      if (res?.success) {
        if (res.minDate) setMinDate(dayjs(res.minDate));
        if (res.maxDate) setMaxDate(dayjs(res.maxDate));
      }
    }).catch(() => {});
  }, []);

  const [salesMetric, setSalesMetric] = useState("MRP");
  const [filterOptions, setFilterOptions] = useState({
    seller: [], platformName: [], brand: [], subBrand: [],
    sku: [], sapCode: [], fiscalYear: [], quarter: [],
  });
  const [filters, setFilters] = useState({
    seller: [], platformName: [], brand: [], subBrand: [],
    sku: [], sapCode: [], fiscalYear: [], quarter: [],
  });

  const applyGranularity = (granularity) => {
    setActiveGranularity(granularity);
  };

  // Chart data
  const [sellerData, setSellerData] = useState(null);
  const [quarterData, setQuarterData] = useState(null);
  const [brandsData, setBrandsData] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [loadingCharts, setLoadingCharts] = useState(false);

  const buildParams = useCallback((metric = salesMetric) => ({
    seller: filters.seller,
    platformName: filters.platformName,
    brand: filters.brand,
    subBrand: filters.subBrand,
    sku: filters.sku,
    sapCode: filters.sapCode,
    fiscalYear: filters.fiscalYear,
    quarter: filters.quarter,
    startDate: timeStart ? timeStart.format("YYYY-MM-DD") : undefined,
    endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : undefined,
    metricType: metric,
    granularity: activeGranularity || "monthly",
  }), [filters, timeStart, timeEnd, salesMetric, activeGranularity]);

  // Fetch cascading filter options
  useEffect(() => {
    fetchSecondaryFilterOptions(buildParams()).then((res) => {
      if (res?.success && res.data) setFilterOptions(res.data);
    }).catch(() => {});
  }, [filters, timeStart, timeEnd]);

  // Fetch all chart data
  useEffect(() => {
    setLoadingCharts(true);
    const params = buildParams(salesMetric);
    Promise.all([
      fetchSecondarySellerWise(params),
      fetchSecondaryQuarterWise(params),
      fetchSecondaryTopBrands(params),
      fetchSecondarySalesTimeline(params),
    ]).then(([s, q, b, t]) => {
      if (s?.success) setSellerData(s.data);
      if (q?.success) setQuarterData(q.data);
      if (b?.success) setBrandsData(b.data);
      if (t?.success) setTimelineData(t.data);
    }).catch(() => {}).finally(() => setLoadingCharts(false));
  }, [filters, timeStart, timeEnd, salesMetric, activeGranularity]);

  const setFilter = (key, val) => setFilters((p) => ({ ...p, [key]: val }));

  const FILTERS = [
    { key: "seller", label: "Seller" },
    { key: "platformName", label: "Platform" },
    { key: "brand", label: "Brand" },
    { key: "subBrand", label: "Sub Brand" },
    { key: "sku", label: "SKU" },
    { key: "sapCode", label: "SAP Code" },
    { key: "fiscalYear", label: "Fiscal Year" },
    { key: "quarter", label: "Quarter" },
  ];

  const activeFilterCount = Object.values(filters).filter((v) => v.length > 0).length;

  return (
    <Box sx={{ width: "100%", pt: 1 }}>

      {/* ── FILTER BAR ─────────────────────────────────────────────────── */}
      <Card sx={{
        borderRadius: "16px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        border: "1px solid #f1f5f9",
        mb: 2.5,
        background: "#fff",
        overflow: "visible",
      }}>
        <CardContent sx={{ p: "14px 20px !important" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.2 }}>
            <Layers size={14} color="#6366f1" />
            <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Filters
            </Typography>
            {activeFilterCount > 0 && (
              <Chip label={`${activeFilterCount} active`} size="small" sx={{
                height: 18, fontSize: "0.60rem", fontWeight: 700,
                backgroundColor: "#eef2ff", color: "#6366f1", border: "1px solid #a5b4fc",
                "& .MuiChip-label": { px: 1 },
              }} />
            )}
            {activeFilterCount > 0 && (
              <Button size="small" onClick={() => setFilters({ seller: [], platformName: [], brand: [], subBrand: [], sku: [], sapCode: [], fiscalYear: [], quarter: [] })}
                sx={{ fontSize: "0.60rem", fontWeight: 700, color: "#ef4444", textTransform: "none", minWidth: 0, p: "0 4px", ml: "auto" }}>
                Clear all
              </Button>
            )}
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "flex-end", width: "100%" }}>
            {FILTERS.map((f) => (
              <MultiSelectFilterPopover
                key={f.key} label={f.label}
                options={filterOptions[f.key] || []}
                selected={filters[f.key] || []}
                onChange={(v) => setFilter(f.key, v)}
              />
            ))}

            {/* VIEW BY SELECT DROPDOWN */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, flex: "1 1 0px", minWidth: 80 }}>
              <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                VIEW BY
              </Typography>
              <Select
                size="small"
                value={activeGranularity || "monthly"}
                onChange={(e) => applyGranularity(e.target.value)}
                sx={{
                  height: 36,
                  width: "100%",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#6366f1",
                  backgroundColor: "#eef2ff",
                  borderRadius: "8px",
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#a5b4fc" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#6366f1" },
                  "& .MuiSelect-select": { py: "4px", px: "10px" },
                }}
              >
                <MenuItem value="daily" sx={{ fontSize: "0.75rem", fontWeight: 600 }}>Daily</MenuItem>
                <MenuItem value="weekly" sx={{ fontSize: "0.75rem", fontWeight: 600 }}>Weekly</MenuItem>
                <MenuItem value="monthly" sx={{ fontSize: "0.75rem", fontWeight: 600 }}>Monthly</MenuItem>
              </Select>
            </Box>

            {/* TIME PERIOD */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, flex: "1.8 1 0px", minWidth: 180 }}>
              <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                TIME PERIOD
              </Typography>
              <DateRangeComparePicker
                timeStart={timeStart} timeEnd={timeEnd}
                compareStart={compareStart} compareEnd={compareEnd}
                maxDate={maxDate} minDate={minDate}
                onApply={(start, end, cStart, cEnd, compareOn, label) => {
                  setTimeStart(start); setTimeEnd(end); setUserSetDate(true);
                  let lbl = "VS PREV. PERIOD";
                  if (label) {
                    const up = label.toUpperCase();
                    if (up === "TODAY") lbl = "VS YESTERDAY";
                    else if (up === "YESTERDAY") lbl = "VS DAY BEFORE";
                    else if (up === "THIS MONTH") lbl = "VS PREV. MONTH";
                    else if (up.includes("LAST")) lbl = up.replace("LAST", "VS PREV.");
                    else lbl = `VS ${up}`;
                  }
                  setComparisonLabel(lbl);
                  if (compareOn) { setCompareStart(cStart); setCompareEnd(cEnd); }
                  else { setCompareStart(null); setCompareEnd(null); }
                }}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ── TOP 3 CARDS ────────────────────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "1fr 1fr" }, gap: 2.5, mb: 2.5 }}>

        {/* ── CARD 1: SELLER WISE (NO PIE CHART - TABLE STYLE) ── */}
        <Card sx={{ borderRadius: 2.5, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#fff", overflow: "hidden" }}>
          {/* Clean header */}
          <Box sx={{ px: 2.5, py: 1.8, backgroundColor: "#f8fafc", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Building2 size={18} color="#64748b" />
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 800, color: "#1e293b", letterSpacing: "0.02em" }}>
                  SELLER WISE SALES
                </Typography>
              </Box>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", backgroundColor: "#fff", px: 1.5, py: 0.5, borderRadius: 1.5, border: "1px solid rgba(0,0,0,0.06)" }}>
                {loadingCharts ? "—" : sellerData ? `${sellerData.total} Total` : "—"}
              </Typography>
            </Box>
          </Box>

          <CardContent sx={{ p: 2.5 }}>
            {loadingCharts ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} variant="rounded" height={48} sx={{ borderRadius: 2 }} />)}
              </Box>
            ) : sellerData?.items?.length > 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
                {/* Column Headers */}
                <Box sx={{ display: "flex", justifyContent: "space-between", px: 1.5, py: 0.8, backgroundColor: "#f8fafc", borderRadius: 1.5 }}>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                    SELLER NAME
                  </Typography>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                    SALES
                  </Typography>
                </Box>

                {/* Seller List */}
                {sellerData.items.slice(0, 5).map((item, i) => {
                  const pct = sellerData.totalRaw > 0 ? ((item.value / sellerData.totalRaw) * 100).toFixed(1) : 0;
                  return (
                    <Box 
                      key={item.name}
                      sx={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        px: 1.5, py: 1.2, borderRadius: 2,
                        border: "1px solid rgba(0,0,0,0.04)",
                        backgroundColor: i === 0 ? "#f8fafc" : "#fff",
                        transition: "all 0.2s",
                        "&:hover": { 
                          backgroundColor: "#f8fafc",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                        },
                      }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flex: 1, minWidth: 0 }}>
                        <Box sx={{ 
                          width: 24, 
                          height: 24, 
                          borderRadius: 1.5, 
                          backgroundColor: i === 0 ? "#1e293b" : "#f1f5f9",
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: i === 0 ? "#fff" : "#64748b" }}>
                            {i + 1}
                          </Typography>
                        </Box>
                        <Typography noWrap sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155" }}>
                          {item.name}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexShrink: 0 }}>
                        <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600, backgroundColor: "#f8fafc", px: 1, py: 0.3, borderRadius: 1 }}>
                          {pct}%
                        </Typography>
                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#1e293b" }}>
                          {item.label}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240 }}>
                <Typography sx={{ fontSize: "0.8rem", color: "#94a3b8" }}>No data</Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* ── CARD 2: TOP 5 BRANDS (MOVED FROM CARD 3) ── */}
        <Card sx={{ borderRadius: 2.5, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#fff", overflow: "hidden" }}>
          <Box sx={{ px: 2.5, py: 1.8, backgroundColor: "#f8fafc", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Award size={18} color="#64748b" />
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 800, color: "#1e293b", letterSpacing: "0.02em" }}>
                  TOP 5 BRANDS
                </Typography>
              </Box>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", backgroundColor: "#fff", px: 1.5, py: 0.5, borderRadius: 1.5, border: "1px solid rgba(0,0,0,0.06)" }}>
                {loadingCharts ? "—" : brandsData ? `${brandsData.total} Total` : "—"}
              </Typography>
            </Box>
          </Box>

          <CardContent sx={{ p: 2.5 }}>
            {loadingCharts ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} variant="rounded" height={48} sx={{ borderRadius: 2 }} />)}
              </Box>
            ) : brandsData?.items?.length > 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
                {/* Column Headers */}
                <Box sx={{ display: "flex", justifyContent: "space-between", px: 1.5, py: 0.8, backgroundColor: "#f8fafc", borderRadius: 1.5 }}>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                    BRAND NAME
                  </Typography>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                    SALES
                  </Typography>
                </Box>

                {brandsData.items.map((item, idx) => (
                  <Box 
                    key={item.name}
                    sx={{
                      display: "flex", alignItems: "center", gap: 1.2,
                      px: 1.5, py: 1.2, borderRadius: 2,
                      border: "1px solid rgba(0,0,0,0.04)",
                      backgroundColor: idx === 0 ? "#f8fafc" : "#fff",
                      transition: "all 0.2s",
                      "&:hover": { 
                        backgroundColor: "#f8fafc",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                      },
                    }}>
                    {/* Rank badge */}
                    <Box sx={{
                      width: 24, height: 24, borderRadius: 1.5, flexShrink: 0,
                      backgroundColor: idx === 0 ? "#1e293b" : "#f1f5f9",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: idx === 0 ? "#fff" : "#64748b" }}>
                        {item.rank}
                      </Typography>
                    </Box>

                    {/* Name + bar */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.4 }}>
                        <Typography noWrap sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155" }}>
                          {item.name}
                        </Typography>
                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#1e293b", ml: 1, whiteSpace: "nowrap" }}>
                          {item.label}
                        </Typography>
                      </Box>
                      {/* Progress bar */}
                      <Box sx={{ width: "100%", height: 6, borderRadius: 1, backgroundColor: "#f1f5f9", overflow: "hidden" }}>
                        <Box sx={{
                          width: item.pct, height: "100%", borderRadius: 1,
                          backgroundColor: idx === 0 ? "#1e293b" : "#cbd5e1",
                          transition: "width 0.6s ease",
                        }} />
                      </Box>
                    </Box>

                    {/* Share tag */}
                    <Box sx={{
                      px: 1, py: 0.3, borderRadius: 1, flexShrink: 0,
                      backgroundColor: "#f8fafc",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}>
                      <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>
                        {item.pct}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240 }}>
                <Typography sx={{ fontSize: "0.8rem", color: "#94a3b8" }}>No data</Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* ── BOTTOM: SALES TIMELINE ─────────────────────────────────────── */}
      <Card sx={{ borderRadius: 2.5, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#fff", overflow: "hidden" }}>
        <Box sx={{
          px: 3, py: 1.8, display: "flex", justifyContent: "space-between", alignItems: "center",
          backgroundColor: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)"
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <BarChart2 size={18} color="#1e293b" />
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 800, color: "#1e293b", letterSpacing: "0.02em" }}>
              {salesMetric === "MRP" ? "MRP SALES TREND" : "UNIT SALES TREND"}
            </Typography>
          </Box>
          <ToggleButtonGroup
            value={salesMetric} exclusive
            onChange={(_, val) => val && setSalesMetric(val)}
            size="small"
            sx={{
              background: "#f8fafc", borderRadius: 1.5, p: "3px", border: "1px solid rgba(0,0,0,0.06)",
              "& .MuiToggleButtonGroup-grouped": {
                border: "none !important", borderRadius: "6px !important",
                px: 2, py: 0.5, textTransform: "none",
                fontWeight: 700, fontSize: "0.74rem", color: "#64748b",
                "&.Mui-selected": {
                  background: "#1e293b",
                  color: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                },
              },
            }}
          >
            <ToggleButton value="MRP">MRP Sales</ToggleButton>
            <ToggleButton value="Units">Units</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <CardContent sx={{ p: 3 }}>
          {loadingCharts ? <ShimmerCard height={340} /> :
            timelineData?.length > 0 ? (
              <Box sx={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {salesMetric === "MRP" ? (
                    <AreaChart data={timelineData} margin={{ top: 30, right: 20, left: 10, bottom: 50 }}>
                      <defs>
                        <linearGradient id="mrpGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month"
                        tick={{ fontSize: 7.5, fill: "#64748b", fontWeight: 600 }}
                        angle={-45} textAnchor="end" interval={0}
                        height={50} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <YAxis tickFormatter={fmtAxis}
                        tick={{ fontSize: 8.5, fill: "#94a3b8" }}
                        axisLine={false} tickLine={false} width={48} />
                      <ChartTooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <Box sx={{ background: "#1e293b", px: 1.5, py: 1.2, borderRadius: 2, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <Typography sx={{ fontSize: "0.68rem", color: "#cbd5e1", fontWeight: 700 }}>{label}</Typography>
                            <Typography sx={{ fontSize: "0.82rem", color: "#fff", fontWeight: 800 }}>MRP Sales: {d.label}</Typography>
                          </Box>
                        );
                      }} />
                      <Area type="monotone" dataKey="value"
                        stroke="#7c3aed" strokeWidth={2.5}
                        fill="url(#mrpGrad)" fillOpacity={1}
                        dot={false} activeDot={{ r: 4, fill: "#7c3aed", stroke: "#fff", strokeWidth: 2 }}
                        label={({ x, y, index }) => {
                          if (index % 4 !== 0) return null;
                          const lbl = timelineData[index]?.label;
                          if (!lbl) return null;
                          return <text x={x} y={y - 10} fill="#7c3aed" fontSize={7.5} fontWeight={800} textAnchor="middle">{lbl}</text>;
                        }} />
                    </AreaChart>
                  ) : (
                    <AreaChart data={timelineData} margin={{ top: 30, right: 20, left: 10, bottom: 50 }}>
                      <defs>
                        <linearGradient id="unitsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month"
                        tick={{ fontSize: 7.5, fill: "#64748b", fontWeight: 600 }}
                        angle={-45} textAnchor="end" interval={0}
                        height={50} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <YAxis tickFormatter={fmtAxis}
                        tick={{ fontSize: 8.5, fill: "#94a3b8" }}
                        axisLine={false} tickLine={false} width={48} />
                      <ChartTooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <Box sx={{ background: "#1e293b", px: 1.5, py: 1.2, borderRadius: 2, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <Typography sx={{ fontSize: "0.68rem", color: "#cbd5e1", fontWeight: 700 }}>{label}</Typography>
                            <Typography sx={{ fontSize: "0.82rem", color: "#fff", fontWeight: 800 }}>Units: {d.label}</Typography>
                          </Box>
                        );
                      }} />
                      <Area type="monotone" dataKey="value"
                        stroke="#7c3aed" strokeWidth={2.5}
                        fill="url(#unitsGrad)" fillOpacity={1}
                        dot={false} activeDot={{ r: 4, fill: "#7c3aed", stroke: "#fff", strokeWidth: 2 }}
                        label={({ x, y, index }) => {
                          if (index % 4 !== 0) return null;
                          const lbl = timelineData[index]?.label;
                          if (!lbl) return null;
                          return <text x={x} y={y - 10} fill="#7c3aed" fontSize={7.5} fontWeight={800} textAnchor="middle">{lbl}</text>;
                        }} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 340 }}>
                <Typography sx={{ fontSize: "0.9rem", color: "#94a3b8" }}>No data available</Typography>
              </Box>
            )}
        </CardContent>
      </Card>
    </Box>
  );
}
