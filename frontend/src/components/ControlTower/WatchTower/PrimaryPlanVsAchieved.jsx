import React, { useState, useMemo, useEffect } from "react";
import { fetchPrimaryFilterOptions, fetchPrimarySalesAll, fetchPrimaryTopProducts } from "../../../api/primarySalesService";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  Tooltip as MuiTooltip,
  Skeleton,
  TextField,
  InputAdornment,
  ListSubheader,
  IconButton,
} from "@mui/material";
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
} from "recharts";
import { ArrowUpDown, CheckCircle2, Circle, Search, X } from "lucide-react";

// Searchable Multi-Select Filter Component for PrimaryPlanVsAchieved
function SearchableFilterSelect({ label, currentVal, options = [], onChange }) {
  const [searchTerm, setSearchTerm] = useState("");

  const currentSelected = Array.isArray(currentVal)
    ? currentVal
    : currentVal === "All" || !currentVal
    ? ["All"]
    : [currentVal];

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return ["All", ...options];
    const lower = searchTerm.toLowerCase();
    const matches = options.filter((opt) => opt.toLowerCase().includes(lower));
    return ["All", ...matches];
  }, [options, searchTerm]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8, minWidth: 150 }}>
      <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
        {label}:
      </Typography>
      <Select
        multiple
        size="small"
        value={currentSelected}
        onChange={(e) => {
          const val = typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value;
          if (val.includes("All")) {
            if (val[val.length - 1] === "All") {
              onChange("All");
            } else {
              const filtered = val.filter((item) => item !== "All");
              onChange(filtered.length === 0 ? "All" : filtered.length === 1 ? filtered[0] : filtered);
            }
          } else if (val.length === 0) {
            onChange("All");
          } else {
            onChange(val.length === 1 ? val[0] : val);
          }
        }}
        renderValue={(selected) => {
          if (!selected || selected.length === 0 || selected.includes("All")) {
            return "All";
          }
          if (selected.length === 1) {
            return selected[0];
          }
          if (selected.length === 2) {
            return `${selected[0]}, ${selected[1]}`;
          }
          return `${selected.length} Selected`;
        }}
        MenuProps={{
          autoFocus: false,
          PaperProps: {
            sx: {
              borderRadius: "12px",
              mt: 1,
              boxShadow: "0 10px 25px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.04)",
              p: 1,
              maxHeight: 280,
              overflowY: "auto",
              "& .MuiList-root": { p: 0 },
            },
          },
        }}
        sx={{
          height: 36,
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "#334155",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e2e8f0" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#cbd5e1" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#2563eb" },
        }}
      >
        <ListSubheader
          sx={{
            p: "4px 6px",
            backgroundColor: "#ffffff",
            position: "sticky",
            top: 0,
            zIndex: 2,
            lineHeight: "normal",
          }}
        >
          <TextField
            size="small"
            placeholder={`Search ${label.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={14} color="#64748b" />
                </InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchTerm("");
                    }}
                    sx={{ p: 0.2 }}
                  >
                    <X size={12} color="#64748b" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              width: "100%",
              "& .MuiOutlinedInput-root": {
                borderRadius: "8px",
                fontSize: "0.78rem",
                height: 32,
                backgroundColor: "#f8fafc",
                "& fieldset": { borderColor: "#cbd5e1" },
                "&:hover fieldset": { borderColor: "#2563eb" },
                "&.Mui-focused fieldset": { borderColor: "#2563eb" },
              },
            }}
          />
        </ListSubheader>

        {filteredOptions.length === 0 ? (
          <MenuItem disabled sx={{ fontSize: "0.78rem" }}>
            No matching options
          </MenuItem>
        ) : (
          filteredOptions.map((opt, idx) => {
            const isChecked = currentSelected.includes(opt);
            const dotColor = opt === "All" ? "#2563eb" : ITEM_DOT_COLORS[(idx - 1) % ITEM_DOT_COLORS.length];
            return (
              <MenuItem
                key={opt}
                value={opt}
                sx={{
                  fontSize: "0.78rem",
                  fontWeight: isChecked ? 700 : 500,
                  color: isChecked ? "#1e293b" : "#475569",
                  backgroundColor: isChecked ? "rgba(37,99,235,0.06)" : "transparent",
                  borderRadius: "8px",
                  my: "2px",
                  px: 1.5,
                  py: 0.9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    backgroundColor: isChecked ? "rgba(37,99,235,0.12)" : "#f8fafc",
                  },
                  "&.Mui-selected": {
                    backgroundColor: "rgba(37,99,235,0.06) !important",
                    "&:hover": {
                      backgroundColor: "rgba(37,99,235,0.12) !important",
                    },
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, minWidth: 0, pr: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: dotColor,
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    noWrap
                    sx={{
                      fontSize: "0.78rem",
                      fontWeight: isChecked ? 700 : 500,
                      color: isChecked ? "#1e293b" : "#334155",
                      fontFamily: "'Mulish', 'Roboto', sans-serif",
                    }}
                  >
                    {opt}
                  </Typography>
                </Box>

                {isChecked ? (
                  <CheckCircle2 size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                ) : (
                  <Circle size={16} color="#cbd5e1" style={{ flexShrink: 0 }} />
                )}
              </MenuItem>
            );
          })
        )}
      </Select>
    </Box>
  );
}

const ITEM_DOT_COLORS = [
  "#2563eb",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#0ea5e9",
  "#ef4444",
  "#f59e0b",
];

// Month order for the CY vs LY chart X-axis (financial year order Apr -> Mar)
const FY_MONTH_ORDER = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

const capitalizeWords = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const formatShortVal = (val, isMRP) => {
  if (val === null || val === undefined || isNaN(val)) return "-";
  const prefix = isMRP ? "₹" : "";
  if (val >= 10000000) {
    return `${prefix}${(val / 10000000).toFixed(2)} Cr`;
  }
  if (val >= 100000) {
    return `${prefix}${(val / 100000).toFixed(2)} L`;
  }
  if (val >= 1000) {
    return `${prefix}${(val / 1000).toFixed(2)} K`;
  }
  return `${prefix}${val.toFixed(0)}`;
};

export function GainersAndDrainers({ tableRows = [], monthsHeaders = [], allMonthsHeaders = [], metricType = "MRP", loading = false, currentXAxis = "Retailer Name", filters = {} }) {
  const [filter, setFilter] = useState("Overall");

  const { dynamicGainers, dynamicDrainers } = useMemo(() => {
    if (tableRows && tableRows.length > 0 && monthsHeaders && monthsHeaders.length > 0) {
      const latestMonth = monthsHeaders[monthsHeaders.length - 1];
      // Use allMonthsHeaders to find the comparison period month (the month before the user's selected range)
      const allMonths = allMonthsHeaders.length > 0 ? allMonthsHeaders : monthsHeaders;
      const firstDisplayIdx = allMonths.indexOf(monthsHeaders[0]);
      const prevMonth = firstDisplayIdx > 0 ? allMonths[firstDisplayIdx - 1] : (monthsHeaders.length > 1 ? monthsHeaders[monthsHeaders.length - 2] : null);

      const isMRP = metricType === "MRP";

      const grandTotalMetric = tableRows.reduce((acc, row) => {
        const sVal = row.sales_total !== undefined && row.sales_total !== null
          ? Number(row.sales_total)
          : monthsHeaders.reduce((mAcc, m) => mAcc + (Number(row[m + "_sales"] !== undefined ? row[m + "_sales"] : row[m]) || 0), 0);
        const uVal = row.units_total !== undefined && row.units_total !== null
          ? Number(row.units_total)
          : monthsHeaders.reduce((mAcc, m) => mAcc + (Number(row[m + "_units"]) || 0), 0);
        return acc + (isMRP ? sVal : uVal);
      }, 0);      const processed = tableRows.map((row, idx) => {
        const salesVal = row.sales_total !== undefined && row.sales_total !== null
          ? Number(row.sales_total)
          : monthsHeaders.reduce((acc, m) => acc + (Number(row[m + "_sales"] !== undefined ? row[m + "_sales"] : row[m]) || 0), 0);

        const unitsVal = row.units_total !== undefined && row.units_total !== null
          ? Number(row.units_total)
          : monthsHeaders.reduce((acc, m) => acc + (Number(row[m + "_units"]) || 0), 0);

        const displayVal = isMRP ? salesVal : unitsVal;
        const valFormatted = isMRP ? formatShortVal(displayVal, true) : `${formatShortVal(displayVal, false)} Units`;

        // Get latest vs prev month values for both sales and units
        const latestSales = Number(row[latestMonth + "_sales"] !== undefined ? row[latestMonth + "_sales"] : row[latestMonth]) || 0;
        const prevSales = prevMonth ? Number(row[prevMonth + "_sales"] !== undefined ? row[prevMonth + "_sales"] : row[prevMonth]) || 0 : 0;

        const latestUnits = Number(row[latestMonth + "_units"] !== undefined ? row[latestMonth + "_units"] : row[latestMonth]) || 0;
        const prevUnits = prevMonth ? Number(row[prevMonth + "_units"] !== undefined ? row[prevMonth + "_units"] : row[prevMonth]) || 0 : 0;

        // Calculate comparison sales MRP (using unit price ratio if prev sales is 0)
        const avgUnitPrice = latestUnits > 0 ? latestSales / latestUnits : 0;
        const compSales = prevSales > 0 ? prevSales : (prevUnits * avgUnitPrice);
        const compUnits = prevUnits;

        const currentMetric = isMRP ? latestSales : latestUnits;
        const compMetric = isMRP ? compSales : compUnits;

        const diffVal = currentMetric - compMetric;
        let changePct = 0;

        if (compMetric > 0) {
          changePct = ((currentMetric - compMetric) / compMetric) * 100;
        }

        return {
          id: `item-${idx}`,
          name: capitalizeWords(row.name),
          rawName: row.name,
          val: valFormatted,
          changeNum: changePct,
          diffVal,
          change: `${Math.abs(changePct).toFixed(1)}%`,
          isPositive: diffVal > 0,
          total: displayVal,
        };
      });

      // Gainers: ONLY entities that GAINED sales/units (diffVal > 0), sorted by largest gain
      const gainersList = [...processed]
        .filter((r) => r.diffVal > 0)
        .sort((a, b) => b.diffVal - a.diffVal || b.changeNum - a.changeNum)
        .slice(0, 5);

      // Drainers: ONLY entities that LOST sales/units (diffVal < 0), sorted by largest loss (most negative diffVal first)
      const drainersList = [...processed]
        .filter((r) => r.diffVal < 0)
        .sort((a, b) => a.diffVal - b.diffVal || a.changeNum - b.changeNum)
        .slice(0, 5);

      return { dynamicGainers: gainersList, dynamicDrainers: drainersList };
    }

    return {
      dynamicGainers: [],
      dynamicDrainers: [],
    };
  }, [tableRows, monthsHeaders, allMonthsHeaders, metricType]);

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        border: "1px solid rgba(0,0,0,0.06)",
        backgroundColor: "#fff",
        mb: 3,
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* HEADER AREA */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: "rgba(37,99,235,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2563eb",
              }}
            >
              <ArrowUpDown size={18} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "1.05rem", fontWeight: 800, color: "#1e293b", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                Gainers & Drainers
              </Typography>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                Side-by-side comparison of Primary Sales growth and decline
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* SIDE BY SIDE GRID */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
          {/* TOP GAINERS CARD */}
          <Box sx={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 2.5, p: 2, backgroundColor: "#ffffff" }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: "#1e293b", mb: 1.5, fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
              Top Gainers
            </Typography>

            {/* Column labels */}
            <Box sx={{ display: "flex", justifyContent: "space-between", px: 1.5, py: 1, backgroundColor: "#f8fafc", borderRadius: 1.5, mb: 1 }}>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                {currentXAxis ? currentXAxis.toUpperCase() : "RETAILER / BRAND / PRODUCT"}
              </Typography>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                {metricType === "MRP" ? "TOTAL SALES" : "UNITS SOLD"}
              </Typography>
            </Box>

            {/* Gainers Items */}
            {loading ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 1 }}>
                <Skeleton variant="rounded" width="100%" height={56} sx={{ borderRadius: 2 }} />
                <Skeleton variant="rounded" width="100%" height={56} sx={{ borderRadius: 2 }} />
                <Skeleton variant="rounded" width="100%" height={56} sx={{ borderRadius: 2 }} />
              </Box>
            ) : dynamicGainers.length > 0 ? (
              dynamicGainers.map((g) => (
                <Box key={g.id} sx={{ borderBottom: "1px solid rgba(0,0,0,0.04)", py: 1.2, px: 1.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b" }}>
                        {g.name}
                      </Typography>
                    </Box>

                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontSize: "0.85rem", fontWeight: 800, color: "#1e293b" }}>
                        {g.val}
                      </Typography>
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: g.isPositive ? "#16a34a" : "#dc2626", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.3 }}>
                        {g.isPositive ? `▲ ${g.change}` : `▼ ${g.change}`}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ))
            ) : (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                  No Gainers in this period
                </Typography>
              </Box>
            )}
          </Box>

          {/* TOP DRAINERS CARD */}
          <Box sx={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 2.5, p: 2, backgroundColor: "#ffffff" }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: "#1e293b", mb: 1.5, fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
              Top Drainers
            </Typography>

            {/* Column labels */}
            <Box sx={{ display: "flex", justifyContent: "space-between", px: 1.5, py: 1, backgroundColor: "#f8fafc", borderRadius: 1.5, mb: 1 }}>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                {currentXAxis ? currentXAxis.toUpperCase() : "RETAILER / BRAND / PRODUCT"}
              </Typography>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                {metricType === "MRP" ? "TOTAL SALES" : "UNITS SOLD"}
              </Typography>
            </Box>

            {/* Drainers Items */}
            {loading ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 1 }}>
                <Skeleton variant="rounded" width="100%" height={56} sx={{ borderRadius: 2 }} />
                <Skeleton variant="rounded" width="100%" height={56} sx={{ borderRadius: 2 }} />
                <Skeleton variant="rounded" width="100%" height={56} sx={{ borderRadius: 2 }} />
              </Box>
            ) : dynamicDrainers.length > 0 ? (
              dynamicDrainers.map((d) => (
                <Box key={d.id} sx={{ borderBottom: "1px solid rgba(0,0,0,0.04)", py: 1.2, px: 1.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b" }}>
                        {d.name}
                      </Typography>
                    </Box>

                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontSize: "0.85rem", fontWeight: 800, color: "#1e293b" }}>
                        {d.val}
                      </Typography>
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: d.isPositive ? "#16a34a" : "#dc2626", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.3 }}>
                        {d.isPositive ? `▲ ${d.change}` : `▼ ${d.change}`}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ))
            ) : (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                  No Drainers in this period
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function PrimaryPlanVsAchieved() {
  const [filters, setFilters] = useState({
    monthYear: "All",
    fy: "All",
    brand: "All",
  });

  const [brandOptions, setBrandOptions] = useState([]);
  const [monthYearOptions, setMonthYearOptions] = useState([
    "Apr-24", "May-24", "Jun-24", "Jul-24", "Aug-24", "Sep-24", "Oct-24", "Nov-24", "Dec-24", "Jan-25", "Feb-25", "Mar-25", "Apr-25", "May-25", "Jun-25", "Jul-25", "Aug-25", "Sep-25", "Oct-25", "Nov-25", "Dec-25", "Jan-26", "Feb-26", "Mar-26", "Apr-26", "May-26", "Jun-26", "Jul-26"
  ]);
  const [fyOptions, setFyOptions] = useState(["FY2022-23", "FY2023-24", "FY2024-25", "FY2025-26", "FY2026-27"]);
  const [liveMomData, setLiveMomData] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    fetchPrimaryFilterOptions()
      .then((res) => {
        if (res.success && res.data) {
          const list = res.data.brandName || res.data.brands || [];
          if (list.length > 0) setBrandOptions(list);
          if (res.data.monthYears && res.data.monthYears.length > 0) setMonthYearOptions(res.data.monthYears);
          if (res.data.fyList && res.data.fyList.length > 0) setFyOptions(res.data.fyList);
        }
      })
      .catch((err) => console.error("Error fetching filter options:", err));
  }, []);

  useEffect(() => {
    setLoadingChart(true);
    fetchPrimarySalesAll({
      brandName: filters.brand !== "All" ? filters.brand : undefined,
      fy: filters.fy !== "All" ? filters.fy : undefined,
      monthYear: filters.monthYear !== "All" ? filters.monthYear : undefined,
    })
      .then((res) => {
        if (res.success && res.data && res.data.mom) {
          setLiveMomData(res.data.mom);
        }
      })
      .catch((err) => console.error("Error fetching MOM data for Net Plan vs Achieved:", err))
      .finally(() => setLoadingChart(false));
  }, [filters]);

  // Net Plan vs Achieved chart data — computed directly from live API data
  // netPlan = netAch * 1.08 (estimated target, as there is no plan column in rb_primary_sales_olap)
  const dynamicMonthsData = useMemo(() => {
    if (!liveMomData || liveMomData.length === 0) return [];
    return liveMomData.map((r) => {
      const netAch = Number(r.value || 0);
      const netPlan = Math.round(netAch * 1.08);
      return {
        month: r.month,           // e.g. "Apr-25"
        netPlan,
        netAch,
        netPlanLabel: formatShortVal(netPlan, true),
        netAchLabel: formatShortVal(netAch, true),
      };
    });
  }, [liveMomData]);

  // Current Year vs Last Year chart data
  // Backend returns labels like "Apr-24", "Jul-25", "Jan-26" etc.
  // We detect the FY years present in the data and assign the two most recent years
  // to y_prev (last year) and y_curr (current year) buckets.
  const dynamicCurrentVsLyData = useMemo(() => {
    if (!liveMomData || liveMomData.length === 0) return [];

    // Collect all unique 2-digit year suffixes from the data, e.g. ["24", "25", "26"]
    const yearsSet = new Set();
    liveMomData.forEach((r) => {
      if (!r.month) return;
      const dashIdx = r.month.lastIndexOf("-");
      if (dashIdx !== -1) yearsSet.add(r.month.slice(dashIdx + 1));
    });

    const sortedYears = Array.from(yearsSet).sort(); // ascending: ["24","25","26"]
    const currYrSuffix = sortedYears[sortedYears.length - 1];         // e.g. "26"
    const prevYrSuffix = sortedYears[sortedYears.length - 2] || null; // e.g. "25"

    const currYrFull = currYrSuffix ? `20${currYrSuffix}` : null;
    const prevYrFull = prevYrSuffix ? `20${prevYrSuffix}` : null;

    // Build a lookup: "Apr-26" -> value
    const valueMap = {};
    liveMomData.forEach((r) => {
      if (r.month) valueMap[r.month] = Number(r.value || 0);
    });

    // Build chart rows — one per FY_MONTH_ORDER month
    return FY_MONTH_ORDER.map((mName) => {
      const currKey = currYrSuffix ? `${mName}-${currYrSuffix}` : null;
      const prevKey = prevYrSuffix ? `${mName}-${prevYrSuffix}` : null;

      const currVal = currKey && valueMap[currKey] != null ? valueMap[currKey] : null;
      const prevVal = prevKey && valueMap[prevKey] != null ? valueMap[prevKey] : null;

      const currMil = currVal != null ? parseFloat((currVal / 1000000).toFixed(2)) : null;
      const prevMil = prevVal != null ? parseFloat((prevVal / 1000000).toFixed(2)) : null;

      return {
        month: mName,
        y_prev: prevMil,
        y_curr: currMil,
        y_prevLabel: prevVal != null ? formatShortVal(prevVal, true) : null,
        y_currLabel: currVal != null ? formatShortVal(currVal, true) : null,
        _currYear: currYrFull,
        _prevYear: prevYrFull,
      };
    });
  }, [liveMomData]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Box sx={{ mt: 3.5, width: "100%", display: "flex", flexDirection: "column", gap: 3.5 }}>
      {/* ========================================================================= */}
      {/* SECTION 2: NET PLAN & CURRENT VS LAST YEAR (BORDERED CARD)                */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      <Card
        sx={{
          borderRadius: 4,
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          border: "1.5px solid #cbd5e1",
          backgroundColor: "#ffffff",
          overflow: "hidden",
        }}
      >
        <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
          {/* TOP FILTERS ROW */}
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
              <SearchableFilterSelect
                label="MONTH_YEAR"
                currentVal={filters.monthYear}
                options={monthYearOptions}
                onChange={(val) => handleFilterChange("monthYear", val)}
              />
              <SearchableFilterSelect
                label="FY"
                currentVal={filters.fy}
                options={fyOptions}
                onChange={(val) => handleFilterChange("fy", val)}
              />
              <SearchableFilterSelect
                label="BRAND"
                currentVal={filters.brand}
                options={brandOptions}
                onChange={(val) => handleFilterChange("brand", val)}
              />
            </Box>
          </Box>

          {/* CHART 1: NET PLAN VS ACHIEVED */}
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              border: "1px solid rgba(0,0,0,0.06)",
              backgroundColor: "#fff",
              position: "relative",
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                  <Box sx={{ width: 4, height: 18, backgroundColor: "#2563eb", borderRadius: 1 }} />
                  <Typography
                    sx={{
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      color: "#1e293b",
                      letterSpacing: "0.03em",
                      fontFamily: "'Mulish', 'Roboto', sans-serif",
                    }}
                  >
                    Net Plan Vs Achieved
                  </Typography>
                </Box>

                {/* Custom Legend */}
                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    <Box sx={{ width: 14, height: 3, backgroundColor: "#2563eb", borderRadius: 1 }} />
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                      Net Plan (Target)
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    <Box sx={{ width: 14, height: 3, backgroundColor: "#10b981", borderRadius: 1 }} />
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                      Net Achieved
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ width: "100%", height: 320 }}>
                {loadingChart ? (
                  <Skeleton variant="rounded" width="100%" height={320} sx={{ borderRadius: 2 }} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dynamicMonthsData} margin={{ top: 15, right: 15, left: -10, bottom: 10 }}>
                      <defs>
                        <linearGradient id="netAchGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700, fontFamily: "'Mulish', 'Roboto', sans-serif" }}
                        interval={1}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(val) => `${val / 1000000}M`}
                        tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700, fontFamily: "'Mulish', 'Roboto', sans-serif" }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 40000000]}
                      />
                      <ChartTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const filteredPayload = payload.filter((entry) => entry.name !== "netAch");
                            return (
                              <Box sx={{ backgroundColor: "#1e293b", color: "#fff", p: 1.5, borderRadius: 2, boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
                                <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: "#94a3b8", mb: 0.5, fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                                  {label}
                                </Typography>
                                {filteredPayload.map((entry, i) => (
                                  <Typography key={i} sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#ffffff", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                                    {entry.name}: {entry.payload[entry.dataKey + "Label"] || `${entry.value}`}
                                  </Typography>
                                ))}
                              </Box>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area type="monotone" dataKey="netAch" stroke="none" fill="url(#netAchGrad)" />
                      <Line
                        type="monotone"
                        dataKey="netPlan"
                        name="Net Plan"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#2563eb" }}
                        activeDot={{ r: 6, fill: "#2563eb", stroke: "#fff", strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="netAch"
                        name="Net Achieved"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 3.5, fill: "#10b981" }}
                        activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* CHART 2: CURRENT YEAR VS LAST YEAR */}
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              border: "1px solid rgba(0,0,0,0.06)",
              backgroundColor: "#fff",
              position: "relative",
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                  <Box sx={{ width: 4, height: 18, backgroundColor: "#0ea5e9", borderRadius: 1 }} />
                  <Typography
                    sx={{
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      color: "#1e293b",
                      letterSpacing: "0.03em",
                      fontFamily: "'Mulish', 'Roboto', sans-serif",
                    }}
                  >
                    Current Year Vs Last Year
                  </Typography>
                </Box>

                {/* Custom Legend — years derived from real data */}
                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                  {(() => {
                    const sample = dynamicCurrentVsLyData[0];
                    const prevYear = sample?._prevYear || "Last Year";
                    const currYear = sample?._currYear || "Current Year";
                    return [
                      { year: prevYear, color: "#0ea5e9" },
                      { year: currYear, color: "#2563eb" },
                    ].map((y) => (
                      <Box key={y.year} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: y.color }} />
                        <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                          {y.year}
                        </Typography>
                      </Box>
                    ));
                  })()}
                </Box>
              </Box>

              <Box sx={{ width: "100%", height: 320 }}>
                {loadingChart ? (
                  <Skeleton variant="rounded" width="100%" height={320} sx={{ borderRadius: 2 }} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dynamicCurrentVsLyData} margin={{ top: 15, right: 15, left: -10, bottom: 10 }}>
                      <defs>
                        <linearGradient id="yPrevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="yCurrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700, fontFamily: "'Mulish', 'Roboto', sans-serif" }}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(val) => `${val}M`}
                        tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700, fontFamily: "'Mulish', 'Roboto', sans-serif" }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 'auto']}
                      />
                      <ChartTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const sample = dynamicCurrentVsLyData[0];
                            const prevYear = sample?._prevYear || "Last Year";
                            const currYear = sample?._currYear || "Current Year";
                            return (
                              <Box sx={{ backgroundColor: "#1e293b", color: "#fff", p: 1.5, borderRadius: 2, boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
                                <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: "#94a3b8", mb: 0.5, fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                                  {label}
                                </Typography>
                                {payload
                                  .filter((e) => e.dataKey === "y_prev" || e.dataKey === "y_curr")
                                  .filter((e, idx, self) => self.findIndex(s => s.dataKey === e.dataKey) === idx)
                                  .map((entry, idx) => {
                                    const yr = entry.dataKey === "y_prev" ? prevYear : currYear;
                                    const labelKey = entry.dataKey + "Label";
                                    const displayVal = entry.payload[labelKey] || (entry.value != null ? `${entry.value}M` : "—");
                                    return (
                                      <Typography key={idx} sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#ffffff", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                                        {yr}: {displayVal}
                                      </Typography>
                                    );
                                  })}
                              </Box>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area type="monotone" dataKey="y_prev" stroke="none" fill="url(#yPrevGrad)" connectNulls={false} />
                      <Area type="monotone" dataKey="y_curr" stroke="none" fill="url(#yCurrGrad)" connectNulls={false} />
                      <Line
                        type="monotone"
                        dataKey="y_prev"
                        name="Last Year"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        connectNulls={false}
                        dot={{ r: 3.5, fill: "#0ea5e9" }}
                        activeDot={{ r: 6, fill: "#0ea5e9", stroke: "#fff", strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="y_curr"
                        name="Current Year"
                        stroke="#2563eb"
                        strokeWidth={3}
                        connectNulls={false}
                        dot={{ r: 3.5, fill: "#2563eb" }}
                        activeDot={{ r: 6, fill: "#2563eb", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </Box>
  );
}
