import React, { useState, useEffect, useContext, useMemo } from "react";
import dayjs from "dayjs";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Chip,
  Checkbox,
  ListItemText,
  Button,
  Skeleton,
  TextField,
  InputAdornment,
  ListSubheader,
} from "@mui/material";
import { Download, Check, AlertCircle, TrendingUp, Target, Award, ShoppingCart, ShoppingBag, Layers, Eye, Clock, Percent, Info, RotateCcw, BarChart2, Package, CheckCircle2, Circle, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { fetchPrimarySalesAll, fetchPrimaryFilterOptions, fetchPrimaryLatestDate } from "../../../api/primarySalesService";
import DateRangeComparePicker from "../../CommonLayout/DateRangeComparePicker";
import { FilterContext } from "../../../utils/FilterContext";
import CategorySubcategoryDrillDown from "./CategorySubcategoryDrillDown";
import { GainersAndDrainers } from "./PrimaryPlanVsAchieved";
import RetailerWiseAnalysis from "./RetailerWiseAnalysis";

// Helper to format values for display
const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return "-";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(val);
};

const formatShortValue = (val, isMRP) => {
  if (val === null || val === undefined || isNaN(val)) return isMRP ? "₹0" : "0";
  const num = Number(val);
  if (num === 0) return isMRP ? "₹0" : "0";
  const prefix = isMRP ? "₹" : "";
  const absNum = Math.abs(num);
  if (absNum >= 10000000) {
    return `${prefix}${(num / 10000000).toFixed(2)}Cr`;
  }
  if (absNum >= 100000) {
    return `${prefix}${(num / 100000).toFixed(2)}L`;
  }
  if (absNum >= 1000) {
    return `${prefix}${(num / 1000).toFixed(2)}K`;
  }
  return `${prefix}${num.toLocaleString("en-IN")}`;
};

const ITEM_DOT_COLORS = [
  "#2563eb",
  "#10b981",
  "#8b5cf6",
  "#0ea5e9",
  "#f43f5e",
  "#f59e0b",
  "#6366f1",
  "#14b8a6",
];

// Searchable Multi-Select Filter Component for Primary Summary
function SearchableDropdownFilter({ label, filterKey, currentVal, options = ["All"], onChange }) {
  const [searchTerm, setSearchTerm] = useState("");

  const currentSelected = Array.isArray(currentVal)
    ? currentVal
    : currentVal === "All" || !currentVal
    ? ["All"]
    : [currentVal];

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const lower = searchTerm.toLowerCase();
    return options.filter((opt) => opt === "All" || opt.toLowerCase().includes(lower));
  }, [options, searchTerm]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
      <Typography
        sx={{
          fontSize: "0.68rem",
          fontWeight: 700,
          color: "#64748b",
          letterSpacing: "0.05em",
          fontFamily: "'Mulish', 'Roboto', sans-serif",
        }}
      >
        {label}
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
              "& .MuiList-root": {
                p: 0,
              },
            },
          },
        }}
        sx={{
          height: 36,
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "#334155",
          backgroundColor: "#ffffff",
          borderRadius: "6px",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#e2e8f0",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#cbd5e1",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#2563eb",
          },
        }}
      >
        {/* Sticky Search Field at top of Menu */}
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

export default function PrimarySummary() {
  const {
    timeStart,
    setTimeStart,
    timeEnd,
    setTimeEnd,
    compareStart,
    setCompareStart,
    compareEnd,
    setCompareEnd,
    maxDate,
    minDate,
    setUserSetDate,
    setComparisonLabel,
  } = useContext(FilterContext);

  const [metricType, setMetricType] = useState("Units"); // "Units" | "MRP"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Dynamic filter options state
  const [filterOptions, setFilterOptions] = useState({
    brandName: ["All"],
    retailerName: ["All"],
    product: ["All"],
    division: ["All"],
    zone: ["All"],
    xAxis: ["Retailer Name", "Brand Name", "Product", "Division", "Zone"],
  });

  // Filter States
  const [filters, setFilters] = useState({
    brandName: "All",
    retailerName: "All",
    product: "All",
    division: "All",
    zone: "All",
    location: "All",
    channel: "All",
    platform: "All",
    xAxis: "Retailer Name",
  });

  // Data states
  const [momData, setMomData] = useState([]);
  const [quarterData, setQuarterData] = useState([]);
  const [tableRows, setTableRows] = useState([]);
  const [monthsHeaders, setMonthsHeaders] = useState([]);
  const [allMonthsHeaders, setAllMonthsHeaders] = useState([]);
  const [kpisData, setKpisData] = useState(null);
  const [showAllQuarters, setShowAllQuarters] = useState(false);
  const [tableViewMode, setTableViewMode] = useState("chart"); // kept for compatibility, chart only



  // On mount, fetch latest available billing date from ClickHouse rb_primary_olap table
  useEffect(() => {
    const initMaxDate = async () => {
      try {
        const res = await fetchPrimaryLatestDate();
        if (res && res.success && res.maxDate) {
          const maxD = dayjs(res.maxDate);
          if (res.minDate) {
            setMinDate(dayjs(res.minDate));
          }
          if (res.maxDate) {
            setMaxDate(dayjs(res.maxDate));
          }
          if (!timeStart || (dayjs.isDayjs(timeStart) && timeStart.isAfter(maxD))) {
            setTimeStart(dayjs(res.defaultStartDate));
            setTimeEnd(dayjs(res.defaultEndDate));
          }
        }
      } catch (err) {
        console.warn("Error fetching primary latest date:", err);
      }
    };
    initMaxDate();
  }, []);

  // Fetch primary sales data and update filter options dynamically
  useEffect(() => {
    const loadDataAndFilters = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          brandName: filters.brandName,
          retailerName: filters.retailerName,
          product: filters.product,
          division: filters.division,
          zone: filters.zone,
          location: filters.location,
          channel: filters.channel,
          platform: filters.platform,
          xAxis: filters.xAxis,
          metricType: metricType,
          startDate: timeStart ? timeStart.format("YYYY-MM-DD") : undefined,
          endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : undefined,
        };

        const [dataRes, filterRes] = await Promise.all([
          fetchPrimarySalesAll(params),
          fetchPrimaryFilterOptions(params),
        ]);

        if (dataRes.success && dataRes.data) {
          setMomData(dataRes.data.mom || []);
          setQuarterData(dataRes.data.quarterly || []);
          setTableRows(dataRes.data.pivotTable?.data || []);
          setMonthsHeaders(dataRes.data.pivotTable?.months || []);
          setAllMonthsHeaders(dataRes.data.pivotTable?.allMonths || dataRes.data.pivotTable?.months || []);
          setKpisData(dataRes.data.kpis || null);
        } else {
          setError("Failed to load primary sales data");
        }

        if (filterRes.success && filterRes.data) {
          const newBrandOptions = ["All", ...filterRes.data.brandName];
          const newRetailerOptions = ["All", ...filterRes.data.retailerName];
          const newProductOptions = ["All", ...filterRes.data.product];
          const newDivisionOptions = ["All", ...filterRes.data.division];
          const newZoneOptions = ["All", ...filterRes.data.zone];

          setFilters((prev) => {
            const updated = { ...prev };
            let changed = false;

            const validateFilter = (key, availableOptions) => {
              const val = prev[key];
              if (!val || val === "All") return;

              if (Array.isArray(val)) {
                const validVals = val.filter((v) => availableOptions.includes(v));
                if (validVals.length === 0) {
                  updated[key] = "All";
                  changed = true;
                } else if (validVals.length !== val.length) {
                  updated[key] = validVals.length === 1 ? validVals[0] : validVals;
                  changed = true;
                }
              } else {
                if (!availableOptions.includes(val)) {
                  updated[key] = "All";
                  changed = true;
                }
              }
            };

            validateFilter("brandName", newBrandOptions);
            validateFilter("retailerName", newRetailerOptions);
            validateFilter("product", newProductOptions);
            validateFilter("division", newDivisionOptions);
            validateFilter("zone", newZoneOptions);

            return changed ? updated : prev;
          });

          setFilterOptions({
            brandName: newBrandOptions,
            retailerName: newRetailerOptions,
            product: newProductOptions,
            division: newDivisionOptions,
            zone: newZoneOptions,
            xAxis: ["Retailer Name", "Brand Name", "Product", "Division", "Zone"],
          });
        }
      } catch (err) {
        console.error("Error loading sales data/filters:", err);
        setError("Error loading data from server");
      } finally {
        setLoading(false);
      }
    };

    loadDataAndFilters();
  }, [
    filters.brandName,
    filters.retailerName,
    filters.product,
    filters.division,
    filters.zone,
    filters.location,
    filters.channel,
    filters.platform,
    filters.xAxis,
    metricType,
    timeStart,
    timeEnd,
  ]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = async () => {
    setFilters({
      brandName: "All",
      retailerName: "All",
      product: "All",
      division: "All",
      zone: "All",
      location: "All",
      channel: "All",
      platform: "All",
      xAxis: "Retailer Name",
    });
    // Reset date range to latest billing date defaults
    try {
      const res = await fetchPrimaryLatestDate();
      if (res && res.success && res.maxDate) {
        setTimeStart(dayjs(res.defaultStartDate));
        setTimeEnd(dayjs(res.defaultEndDate));
        setCompareStart(null);
        setCompareEnd(null);
        setUserSetDate(false);
      }
    } catch (e) {
      console.warn("Reset date error:", e);
    }
  };

  const handleMetricChange = (event, newMetric) => {
    if (newMetric !== null) {
      setMetricType(newMetric);
    }
  };

  const handleDownload = () => {
    const headers = [filters.xAxis, ...monthsHeaders];
    let csvContent = headers.join(",") + "\n";

    tableRows.forEach((row) => {
      const line = [
        `"${row.name}"`,
        ...monthsHeaders.map((m) => (row[m] === null ? "-" : row[m])),
      ];
      csvContent += line.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `primary_summary_${filters.xAxis.toLowerCase().replace(" ", "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic computation for KPI Cards from ClickHouse data
  const dynamicKpis = useMemo(() => {
    let salesVal = 0;
    let unitsVal = 0;
    let salesGrowthStr = "+0.00%";
    let unitsGrowthStr = "+0.00%";

    if (kpisData) {
      salesVal = Number(kpisData.totalSales) || 0;
      unitsVal = Number(kpisData.totalUnits) || 0;
      if (kpisData.salesGrowth !== undefined && kpisData.salesGrowth !== null) {
        salesGrowthStr = `${kpisData.salesGrowth >= 0 ? "+" : ""}${kpisData.salesGrowth}%`;
      }
      if (kpisData.unitsGrowth !== undefined && kpisData.unitsGrowth !== null) {
        unitsGrowthStr = `${kpisData.unitsGrowth >= 0 ? "+" : ""}${kpisData.unitsGrowth}%`;
      }
    }

    if (salesVal === 0 && unitsVal === 0) {
      if (momData && momData.length > 0) {
        const total = momData.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
        if (metricType === "MRP") salesVal = total;
        else unitsVal = total;
      } else if (tableRows && tableRows.length > 0 && monthsHeaders && monthsHeaders.length > 0) {
        const total = tableRows.reduce((acc, r) => {
          const rSum = monthsHeaders.reduce((mAcc, m) => mAcc + (Number(r[m]) || 0), 0);
          return acc + rSum;
        }, 0);
        if (metricType === "MRP") salesVal = total;
        else unitsVal = total;
      }
    }

    return [
      {
        icon: <ShoppingBag size={18} />,
        iconBg: "#2563eb",
        label: "Total Sales",
        value: formatShortValue(salesVal, true),
        growth: salesGrowthStr,
        positive: !salesGrowthStr.includes("-"),
      },
      {
        icon: <ShoppingCart size={18} />,
        iconBg: "#10b981",
        label: "Total Units Sold",
        value: `${formatShortValue(unitsVal, false)} Units`,
        growth: unitsGrowthStr,
        positive: !unitsGrowthStr.includes("-"),
      },
    ];
  }, [kpisData, momData, tableRows, monthsHeaders, metricType]);

  // Dynamic MoM Chart Data from ClickHouse — revenue only, no fabricated target
  const displayMomData = useMemo(() => {
    if (momData && momData.length > 0) {
      return momData.map((r) => {
        const achievement = Number(r.value || 0);
        return {
          month: r.month,
          achievement: metricType === "MRP" ? parseFloat((achievement / 10000000).toFixed(2)) : achievement,
          rawValue: achievement,
        };
      });
    }
    return [
      { month: "Apr 26", achievement: 2.10, rawValue: 21000000 },
      { month: "May 26", achievement: 1.87, rawValue: 18700000 },
      { month: "Jun 26", achievement: 1.89, rawValue: 18900000 },
      { month: "Jul 26", achievement: 2.35, rawValue: 23500000 },
      { month: "Aug 26", achievement: 2.42, rawValue: 24200000 },
      { month: "Sep 26", achievement: 2.28, rawValue: 22800000 },
    ];
  }, [momData, metricType]);

  // Dynamic MoM Summary Badges from ClickHouse — revenue only
  const momBadges = useMemo(() => {
    if (displayMomData && displayMomData.length > 0) {
      const sortedByVal = [...displayMomData].sort((a, b) => (b.rawValue || b.achievement) - (a.rawValue || a.achievement));
      const peak = sortedByVal[0];
      const totalVal = displayMomData.reduce((sum, d) => sum + (Number(d.rawValue || d.achievement) || 0), 0);
      const avgRunRate = totalVal / displayMomData.length;

      let growthStr = "+0.0% MoM";
      if (displayMomData.length >= 2) {
        const latest = Number(displayMomData[displayMomData.length - 1].rawValue || displayMomData[displayMomData.length - 1].achievement);
        const prev = Number(displayMomData[displayMomData.length - 2].rawValue || displayMomData[displayMomData.length - 2].achievement);
        if (prev > 0) {
          const diff = ((latest - prev) / prev) * 100;
          growthStr = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}% MoM`;
        }
      }

      return {
        peakMonth: peak ? `${peak.month} (${formatShortValue(peak.rawValue || peak.achievement, metricType === "MRP")})` : "-",
        runRate: `${formatShortValue(avgRunRate, metricType === "MRP")} / Mo`,
        growth: growthStr,
      };
    }

    return {
      peakMonth: "-",
      runRate: "0 / Mo",
      growth: "+0.0% MoM",
    };
  }, [displayMomData, metricType]);

  // Dynamic Quarterly Sales Data from ClickHouse (with Show More toggle)
  const displayQuarterItems = useMemo(() => {
    if (quarterData && quarterData.length > 0) {
      // Filter out quarters with zero or no value
      const nonZero = quarterData.filter((q) => Number(q.value || 0) > 0);
      if (nonZero.length === 0) return { items: [], totalCount: 0, hasMore: false };

      const allSorted = [...nonZero].sort((a, b) => (b.value || 0) - (a.value || 0));
      const totalVal = allSorted.reduce((sum, q) => sum + (Number(q.value) || 0), 0);
      const itemsToDisplay = showAllQuarters ? allSorted : allSorted.slice(0, 5);

      return {
        items: itemsToDisplay.map((q, idx) => {
          const valNum = Number(q.value || 0);
          const isTop = idx === 0;
          const pct = totalVal > 0 ? ((valNum / totalVal) * 100).toFixed(1) + "%" : "0%";
          const formattedVal = formatShortValue(valNum, metricType === "MRP");

          const prevVal = allSorted[idx + 1] ? Number(allSorted[idx + 1].value || 0) : null;
          let qoqStr = "+0.0% QoQ";
          if (prevVal && prevVal > 0) {
            const diff = ((valNum - prevVal) / prevVal) * 100;
            qoqStr = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}% QoQ`;
          }

          return {
            rank: `#${idx + 1}`,
            quarter: q.quarter,
            qoq: qoqStr,
            pct: pct,
            val: formattedVal,
            isTop: isTop,
          };
        }),
        totalCount: allSorted.length,
        hasMore: allSorted.length > 5,
      };
    }

    return {
      items: [],
      totalCount: 0,
      hasMore: false,
    };
  }, [quarterData, metricType, showAllQuarters]);

  const totalQuarterValueStr = useMemo(() => {
    if (quarterData && quarterData.length > 0) {
      const totalVal = quarterData.reduce((sum, q) => sum + (Number(q.value) || 0), 0);
      return `${formatShortValue(totalVal, metricType === "MRP")} Total`;
    }
    return "0 Total";
  }, [quarterData, metricType]);

  return (
    <Box sx={{ mt: 0, width: "100%", display: "flex", flexDirection: "column", gap: 3.5 }}>
      {/* ========================================================================= */}
      {/* COMPONENT 1: SALES OVERVIEW & PERFORMANCE (TOP BORDERED COMPONENT)       */}
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
        <CardContent sx={{ p: 3 }}>
          {/* FILTER ROW AT TOP OF COMPONENT 1 */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(1, 1fr)",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(8, 1fr)",
              },
              gap: 2,
              alignItems: "flex-end",
              mb: 3,
              p: 2,
              borderRadius: 3,
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            {["brandName", "retailerName", "product", "division", "zone"].map((key) => {
              const label = key
                .replace(/([A-Z])/g, " $1")
                .trim()
                .toUpperCase();

              return (
                <SearchableDropdownFilter
                  key={key}
                  label={label}
                  filterKey={key}
                  currentVal={filters[key]}
                  options={filterOptions[key] || ["All"]}
                  onChange={(val) => handleFilterChange(key, val)}
                />
              );
            })}

            {/* TIME PERIOD */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.05em",
                  fontFamily: "'Mulish', 'Roboto', sans-serif",
                }}
              >
                TIME PERIOD
              </Typography>
              <DateRangeComparePicker
                timeStart={timeStart}
                timeEnd={timeEnd}
                compareStart={compareStart}
                compareEnd={compareEnd}
                maxDate={maxDate}
                minDate={minDate}
                onApply={(start, end, cStart, cEnd, compareOn, label) => {
                  setTimeStart(start);
                  setTimeEnd(end);
                  setUserSetDate(true);

                  let formattedLabel = "VS PREV. PERIOD";
                  if (label) {
                    const up = label.toUpperCase();
                    if (up === "TODAY") formattedLabel = "VS YESTERDAY";
                    else if (up === "YESTERDAY") formattedLabel = "VS DAY BEFORE";
                    else if (up === "THIS MONTH") formattedLabel = "VS PREV. MONTH";
                    else if (up.includes("LAST")) formattedLabel = up.replace("LAST", "VS PREV.");
                    else formattedLabel = `VS ${up}`;
                  }
                  setComparisonLabel(formattedLabel);

                  if (compareOn) {
                    setCompareStart(cStart);
                    setCompareEnd(cEnd);
                  } else {
                    setCompareStart(null);
                    setCompareEnd(null);
                  }
                }}
              />
            </Box>

            {/* RESET FILTERS BUTTON */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.05em",
                  fontFamily: "'Mulish', 'Roboto', sans-serif",
                  visibility: "hidden", // keeps alignment with other filter labels
                }}
              >
                RESET
              </Typography>
              <Button
                onClick={handleResetFilters}
                variant="outlined"
                startIcon={<RotateCcw size={14} />}
                sx={{
                  height: 36,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  fontFamily: "'Mulish', 'Roboto', sans-serif",
                  color: "#ef4444",
                  borderColor: "rgba(239,68,68,0.35)",
                  borderRadius: "6px",
                  textTransform: "none",
                  whiteSpace: "nowrap",
                  backgroundColor: "rgba(239,68,68,0.04)",
                  "&:hover": {
                    backgroundColor: "rgba(239,68,68,0.1)",
                    borderColor: "#ef4444",
                  },
                  transition: "all 0.15s ease",
                }}
              >
                Reset Filters
              </Button>
            </Box>
          </Box>

          {/* Top Metric Toggle & Action Controls Row */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
              mb: 2.5,
              px: 0.5,
            }}
          >
            {/* Left side: Section Title & Subtitle */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <Box sx={{ width: 4, height: 20, backgroundColor: "#2563eb", borderRadius: 1 }} />
              <Box>
                <Typography
                  sx={{
                    fontSize: "0.92rem",
                    fontWeight: 800,
                    color: "#1e293b",
                    letterSpacing: "0.02em",
                    fontFamily: "'Mulish', 'Roboto', sans-serif",
                  }}
                >
                  Primary Sales Overview
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "#64748b",
                    fontFamily: "'Mulish', 'Roboto', sans-serif",
                  }}
                >
                  Viewing metrics in {metricType === "MRP" ? "MRP (₹ Value)" : "Quantity Units"}
                </Typography>
              </Box>
            </Box>

            {/* Right side: Units / MRP Toggle & Export Button */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <ToggleButtonGroup
                value={metricType}
                exclusive
                onChange={handleMetricChange}
                size="small"
                sx={{
                  backgroundColor: "#f1f5f9",
                  padding: "3px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  "& .MuiToggleButtonGroup-grouped": {
                    border: "none",
                    borderRadius: "8px !important",
                    px: 2.2,
                    py: 0.5,
                    textTransform: "none",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    color: "#64748b",
                    fontFamily: "'Mulish', 'Roboto', sans-serif",
                    transition: "all 0.15s ease",
                    "&.Mui-selected": {
                      backgroundColor: "#2563eb",
                      color: "#fff",
                      boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
                      "&:hover": {
                        backgroundColor: "#1d4ed8",
                      },
                    },
                  },
                }}
              >
                <ToggleButton value="Units">Units</ToggleButton>
                <ToggleButton value="MRP">MRP</ToggleButton>
              </ToggleButtonGroup>

              <Button
                variant="outlined"
                size="small"
                onClick={handleDownload}
                startIcon={<Download size={15} />}
                sx={{
                  height: 36,
                  borderRadius: "10px",
                  px: 2,
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "none",
                  borderColor: "#cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  fontFamily: "'Mulish', 'Roboto', sans-serif",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    backgroundColor: "#f8fafc",
                    borderColor: "#2563eb",
                    color: "#2563eb",
                  },
                }}
              >
                Export CSV
              </Button>
            </Box>
          </Box>

          {/* KPI SUMMARY ROW */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 2.5,
              mb: 3,
            }}
          >
            {loading ? (
              <>
                <Skeleton variant="rounded" height={110} sx={{ borderRadius: "16px" }} />
                <Skeleton variant="rounded" height={110} sx={{ borderRadius: "16px" }} />
              </>
            ) : (
              dynamicKpis.map((kpi, i) => (
                <Card
                  key={i}
                  sx={{
                    borderRadius: "16px",
                    border: "1px solid rgba(226, 232, 240, 0.8)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    backgroundColor: "#ffffff",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      boxShadow: "0 8px 24px rgba(37,99,235,0.08)",
                      transform: "translateY(-2px)",
                      borderColor: "rgba(37,99,235,0.3)",
                    },
                  }}
                >
                  <CardContent sx={{ p: "18px 20px !important" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "12px",
                          backgroundColor: kpi.iconBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          boxShadow: `0 4px 12px ${kpi.iconBg}33`,
                          flexShrink: 0,
                        }}
                      >
                        {kpi.icon}
                      </Box>
                      <Chip
                        label={`${kpi.positive ? "↗" : "↘"} ${kpi.growth}`}
                        size="small"
                        sx={{
                          backgroundColor: kpi.positive ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                          color: kpi.positive ? "#10b981" : "#ef4444",
                          fontWeight: 800,
                          fontSize: "0.72rem",
                          border: `1px solid ${kpi.positive ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                          borderRadius: "20px",
                          height: 24,
                          "& .MuiChip-label": { px: 1.2 },
                        }}
                      />
                    </Box>

                    <Typography
                      sx={{
                        fontSize: "1.65rem",
                        fontWeight: 650,
                        color: "#0f172a",
                        lineHeight: 1.2,
                        mb: 0.5,
                        fontFamily: "'Mulish', 'Roboto', sans-serif",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {kpi.value}
                    </Typography>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                      <Typography
                        sx={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#64748b",
                          fontFamily: "'Mulish', 'Roboto', sans-serif",
                        }}
                      >
                        {kpi.label}
                      </Typography>
                      <Tooltip title="Calculated dynamically from primary sales records" arrow>
                        <Box sx={{ display: "inline-flex", cursor: "pointer" }}>
                          <Info size={12} color="#94a3b8" />
                        </Box>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>

          {/* PERFORMANCE ROW: MoM REVENUE TREND (LEFT) & NORMAL Quarterly Sales CHART (RIGHT) */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 3,
            }}
          >
            {/* Left Card: PRIMARY MOM REVENUE & TARGET TREND */}
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                border: "1px solid rgba(0,0,0,0.06)",
                backgroundColor: "#fff",
                position: "relative",
              }}
            >
              {loading ? (
                <Box sx={{ p: 3 }}>
                  <Skeleton variant="text" width={240} height={28} sx={{ mb: 2 }} />
                  <Skeleton variant="rounded" width="100%" height={240} sx={{ borderRadius: "12px", mb: 2 }} />
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
                    <Skeleton variant="rounded" height={50} sx={{ borderRadius: 2 }} />
                    <Skeleton variant="rounded" height={50} sx={{ borderRadius: 2 }} />
                    <Skeleton variant="rounded" height={50} sx={{ borderRadius: 2 }} />
                  </Box>
                </Box>
              ) : (
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
                        Primary Month on Month Revenue
                      </Typography>
                    </Box>
                  </Box>

                  {/* Smooth Curved Area Chart */}
                  <Box sx={{ width: "100%", height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={displayMomData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="primaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={(v) => metricType === 'MRP' ? `${v}Cr` : formatShortValue(v, false)} />
                        <ChartTooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <Box
                                  sx={{
                                    backgroundColor: "#1e293b",
                                    color: "#fff",
                                    p: 1.5,
                                    borderRadius: 2,
                                    boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                                  }}
                                >
                                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, mb: 0.5, color: "#94a3b8" }}>
                                    {label}
                                  </Typography>
                                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#ffffff" }}>
                                    {metricType === 'MRP' ? `Revenue: ${formatShortValue(data.rawValue, true)}` : `Volume: ${formatShortValue(data.rawValue, false)} Units`}
                                  </Typography>
                                </Box>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area type="monotone" dataKey="achievement" name="Revenue" stroke="#2563eb" strokeWidth={3} fill="url(#primaryAreaGrad)" dot={{ r: 4, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>

                  {/* Bottom Summary Badges */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 1.5,
                      mt: 1.5,
                      pt: 1.5,
                      borderTop: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <Box
                      sx={{
                        textAlign: "center",
                        p: 1,
                        backgroundColor: "rgba(37,99,235,0.04)",
                        borderRadius: 2,
                        border: "1px solid rgba(37,99,235,0.12)",
                      }}
                    >
                      <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, color: "#2563eb", letterSpacing: "0.05em" }}>
                        PEAK MONTH
                      </Typography>
                      <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: "#1e293b", mt: 0.2 }}>
                        {momBadges.peakMonth}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        textAlign: "center",
                        p: 1,
                        backgroundColor: "rgba(37,99,235,0.04)",
                        borderRadius: 2,
                        border: "1px solid rgba(37,99,235,0.12)",
                      }}
                    >
                      <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, color: "#2563eb", letterSpacing: "0.05em" }}>
                        RUN RATE
                      </Typography>
                      <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: "#1e293b", mt: 0.2 }}>
                        {momBadges.runRate}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              )}
            </Card>

            {/* Right Card: Quarterly Sales (RANKED CAPSULE LIST COMPONENT) */}
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                border: "1px solid rgba(0,0,0,0.06)",
                backgroundColor: "#fff",
                position: "relative",
              }}
            >
              {loading ? (
                <Box sx={{ p: 3 }}>
                  <Skeleton variant="text" width={200} height={28} sx={{ mb: 2 }} />
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2, mt: 1.5 }}>
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <Skeleton key={idx} variant="rounded" width="100%" height={44} sx={{ borderRadius: "12px" }} />
                    ))}
                  </Box>
                </Box>
              ) : (
                <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                    <Box sx={{ width: 4, height: 18, backgroundColor: "#2563eb", borderRadius: 1 }} />
                    <Typography
                      sx={{
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        color: "#1e293b",
                        letterSpacing: "0.05em",
                        fontFamily: "'Mulish', 'Roboto', sans-serif",
                      }}
                    >
                      QUARTERLY SALES
                    </Typography>
                  </Box>
                  <Chip
                    label={totalQuarterValueStr}
                    size="small"
                    sx={{
                      backgroundColor: "#e0f2fe",
                      color: "#0284c7",
                      fontWeight: 800,
                      fontSize: "0.72rem",
                      borderRadius: "20px",
                      border: "1px solid #bae6fd",
                      "& .MuiChip-label": { px: 1.2 },
                    }}
                  />
                </Box>

                {/* Ranked Capsule List Component */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2, mt: 1.5 }}>
                  {displayQuarterItems.items.length === 0 ? (
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        py: 5,
                        gap: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          backgroundColor: "#f1f5f9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <BarChart2 size={22} color="#94a3b8" />
                      </Box>
                      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                        No quarterly data for selected filters
                      </Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: "#cbd5e1", fontFamily: "'Mulish', 'Roboto', sans-serif" }}>
                        Try adjusting your filters or date range
                      </Typography>
                    </Box>
                  ) : (
                    (displayQuarterItems.items || []).map((item) => (
                    <Box
                      key={item.quarter}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 1.2,
                        px: 1.8,
                        borderRadius: "12px",
                        backgroundColor: item.isTop ? "rgba(236, 253, 245, 0.4)" : "#f8fafc",
                        border: item.isTop ? "1.5px solid #a7f3d0" : "1px solid #f1f5f9",
                        transition: "all 0.2s ease",
                        "&:hover": {
                          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                          transform: "translateY(-1px)",
                        },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            backgroundColor: item.isTop ? "#10b981" : "#dbeafe",
                            color: item.isTop ? "#ffffff" : "#2563eb",
                            fontWeight: 800,
                            fontSize: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {item.rank}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: "0.85rem",
                            fontWeight: 800,
                            color: "#0f172a",
                            fontFamily: "'Mulish', 'Roboto', sans-serif",
                          }}
                        >
                          {item.quarter}
                        </Typography>
                        <Chip
                          label={item.qoq}
                          size="small"
                          sx={{
                            backgroundColor: "#e0e7ff",
                            color: "#4338ca",
                            fontWeight: 800,
                            fontSize: "0.68rem",
                            height: 22,
                            "& .MuiChip-label": { px: 1 },
                          }}
                        />
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
                        <Typography
                          sx={{
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: "#94a3b8",
                            fontFamily: "'Mulish', 'Roboto', sans-serif",
                          }}
                        >
                          {item.pct}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: "0.9rem",
                            fontWeight: 800,
                            color: "#0f172a",
                            fontFamily: "'Mulish', 'Roboto', sans-serif",
                            minWidth: 70,
                            textAlign: "right",
                          }}
                        >
                          {item.val}
                        </Typography>
                      </Box>
                    </Box>
                  ))
                  )}

                  {/* Show More / Show Less Toggle Button */}
                  {displayQuarterItems.hasMore && (
                    <Button
                      size="small"
                      onClick={() => setShowAllQuarters((prev) => !prev)}
                      startIcon={showAllQuarters ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      sx={{
                        alignSelf: "center",
                        mt: 1,
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: "#2563eb",
                        textTransform: "none",
                        borderRadius: "20px",
                        px: 2.5,
                        py: 0.6,
                        backgroundColor: "rgba(37,99,235,0.06)",
                        border: "1px solid rgba(37,99,235,0.15)",
                        transition: "all 0.2s ease",
                        "&:hover": {
                          backgroundColor: "rgba(37,99,235,0.12)",
                          boxShadow: "0 2px 6px rgba(37,99,235,0.12)",
                        },
                      }}
                    >
                      {showAllQuarters ? "Show Less" : `Show More (${displayQuarterItems.totalCount - 5} More)`}
                    </Button>
                  )}
                </Box>
              </CardContent>
              )}
            </Card>
          </Box>

          {/* RETAILER WISE ANALYSIS */}
          <Box sx={{ mt: 3.5 }}>
            <RetailerWiseAnalysis
              filters={{
                ...filters,
                startDate: timeStart ? timeStart.format("YYYY-MM-DD") : undefined,
                endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : undefined,
              }}
              metricType={metricType}
              monthsHeaders={monthsHeaders}
              allMonthsHeaders={allMonthsHeaders}
              tableRows={tableRows}
              loading={loading}
            />
          </Box>

          {/* SALES OVERVIEW */}
          <Box sx={{ mt: 3.5 }}>
            <CategorySubcategoryDrillDown
              tableRows={tableRows}
              monthsHeaders={monthsHeaders}
              metricType={metricType}
              loading={loading}
              currentXAxis={filters.xAxis}
              onXAxisChange={(newXAxis) => handleFilterChange("xAxis", newXAxis)}
              filters={{
                ...filters,
                startDate: timeStart ? timeStart.format("YYYY-MM-DD") : undefined,
                endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : undefined,
              }}
            />
          </Box>

          {/* GAINERS & DRAINERS */}
          <Box sx={{ mt: 3.5 }}>
            <GainersAndDrainers
              tableRows={tableRows}
              monthsHeaders={monthsHeaders}
              allMonthsHeaders={allMonthsHeaders}
              metricType={metricType}
              loading={loading}
              currentXAxis={filters.xAxis}
              filters={{
                ...filters,
                startDate: timeStart ? timeStart.format("YYYY-MM-DD") : undefined,
                endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : undefined,
              }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
