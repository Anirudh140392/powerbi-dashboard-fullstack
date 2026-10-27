import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Skeleton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Paper,
  ToggleButtonGroup,
  ToggleButton
} from "@mui/material";
import { X, Filter, Download, Layers, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import axiosInstance from "../../../api/axiosInstance";

export const DEFAULT_KPI_COLUMNS = [
  { id: "osa", altId: "availability", label: "OSA", format: "percent" },
  { id: "wtOsa", altId: "wt_osa", label: "Wt OSA", format: "percent" },
];

export const VISIBILITY_KPI_COLUMNS = [
  { id: "overall_sos", altId: "sos", label: "Overall SOS", format: "percent" },
  { id: "sponsored_sos", altId: "adSos", label: "Sponsored SOS", format: "percent" },
  { id: "organic_sos", altId: "organicSos", label: "Organic SOS", format: "percent" },
];

export const PRICING_KPI_COLUMNS = [
  { id: "discount", altId: "promo", label: "Discount %", format: "percent" },
  { id: "pricePerUnit", altId: "price", label: "Price per Unit", format: "currency" },
  { id: "asp", altId: "price", label: "Average Selling Price", format: "currency" },
];

export const ALL_KPI_COLUMNS = [
  { id: "osa", altId: "availability", label: "OSA", format: "percent" },
  { id: "sos", label: "SOS", format: "percent" },
  { id: "price", altId: "asp", label: "Price", format: "currency" },
  { id: "promo", altId: "promoMyBrand", label: "Discount %", format: "percent" },
  { id: "marketShare", altId: "marketSales", label: "Mkt Share", format: "percent" },
];

const DEFAULT_FILTERS = {};

export default function CrossPlatformMatrixModal({ open, onClose, initialFilters = DEFAULT_FILTERS, initialLevel = "brand", kpiColumns = DEFAULT_KPI_COLUMNS }) {
  const activeKpiColumns = kpiColumns || DEFAULT_KPI_COLUMNS;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ platforms: [], matrix: [] });
  const [showFilters, setShowFilters] = useState(false);
  const [matrixLevel, setMatrixLevel] = useState(initialLevel || "brand");

  // Filter state
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);

  // Available options
  const [filterOptions, setFilterOptions] = useState({
    platforms: ["Blinkit", "Instamart", "Zepto"],
    brands: [],
    categories: [],
    locations: []
  });

  // Date Range state (1M, 3M, 6M, Custom)
  const [dateRange, setDateRange] = useState(() => {
    if (initialFilters?.startDate && initialFilters?.endDate) return "Custom";
    if (initialFilters?.months === 3) return "3M";
    if (initialFilters?.months === 6) return "6M";
    return "1M";
  });
  const [customStartDate, setCustomStartDate] = useState(
    initialFilters?.startDate || dayjs().subtract(1, "month").format("YYYY-MM-DD")
  );
  const [customEndDate, setCustomEndDate] = useState(
    initialFilters?.endDate || dayjs().format("YYYY-MM-DD")
  );

  const filterStartDate = initialFilters?.startDate;
  const filterEndDate = initialFilters?.endDate;
  const filterMonths = initialFilters?.months;

  useEffect(() => {
    if (open) {
      setMatrixLevel(initialLevel || "brand");
      if (filterStartDate && filterEndDate) {
        setDateRange("Custom");
        setCustomStartDate(filterStartDate);
        setCustomEndDate(filterEndDate);
      } else if (filterMonths) {
        setDateRange(filterMonths === 3 ? "3M" : filterMonths === 6 ? "6M" : "1M");
      }
    }
  }, [open, initialLevel, filterStartDate, filterEndDate, filterMonths]);

  // Fetch filter options when modal opens
  useEffect(() => {
    if (!open) return;
    
    Promise.all([
      axiosInstance.get("/watchtower/competition-filter-options"),
      axiosInstance.get("/watchtower/pdp-platforms")
    ])
      .then(([compRes, platRes]) => {
        const optData = compRes.data || {};
        const platList = Array.isArray(platRes.data) && platRes.data.length > 0 
          ? platRes.data 
          : ["Blinkit", "Instamart", "Zepto"];

        setFilterOptions({
          platforms: platList,
          brands: optData.brands || [],
          categories: optData.categories || [],
          locations: (optData.locations || []).filter(l => l !== "All India")
        });
      })
      .catch((err) => {
        console.error("[CrossPlatformMatrixModal] Error loading filter options:", err);
      });
  }, [open]);

  // Fetch Matrix Data
  const fetchMatrix = useCallback(async () => {
    if (!open) return;
    setLoading(true);

    try {
      const params = {
        level: matrixLevel
      };
      if (selectedPlatforms.length > 0) params["platform[]"] = selectedPlatforms;
      if (selectedBrands.length > 0) params["brand[]"] = selectedBrands;
      if (selectedCategories.length > 0) params["category[]"] = selectedCategories;
      if (selectedLocations.length > 0) params["location[]"] = selectedLocations;

      if (dateRange === "Custom") {
        if (customStartDate && customEndDate) {
          params.startDate = customStartDate;
          params.endDate = customEndDate;
        }
      } else {
        const m = dateRange === "3M" ? 3 : dateRange === "6M" ? 6 : 1;
        params.months = m;
      }

      const res = await axiosInstance.get("/watchtower/cross-platform-brand-matrix", { params });
      setData(res.data || { platforms: [], matrix: [] });
    } catch (err) {
      console.error("[CrossPlatformMatrixModal] Error fetching matrix:", err);
      setData({ platforms: [], matrix: [] });
    } finally {
      setLoading(false);
    }
  }, [open, matrixLevel, selectedPlatforms, selectedBrands, selectedCategories, selectedLocations, dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const handleResetFilters = () => {
    setSelectedPlatforms([]);
    setSelectedBrands([]);
    setSelectedCategories([]);
    setSelectedLocations([]);
  };

  // Formatters
  const formatVal = (val, type) => {
    if (val === null || val === undefined || isNaN(val)) return "-";
    const num = Number(val);
    if (num === 0) return "0";

    if (type === "currency") {
      if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
      if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
      if (num >= 1000) return `₹${(num / 1000).toFixed(1)} K`;
      return `₹${num.toFixed(0)}`;
    }
    if (type === "percent") {
      return `${num.toFixed(1)}%`;
    }
    if (type === "decimal") {
      return `${num.toFixed(2)}x`;
    }
    return num.toLocaleString("en-IN");
  };

  const platforms = data.platforms || [];
  const rawMatrix = data.matrix || [];

  // Sort state: platformKey (e.g. "blinkit"), kpiId (e.g. "osa"), direction ("desc" | "asc" | null)
  const [sortConfig, setSortConfig] = useState({ platformKey: null, kpiId: null, direction: null });

  // Reset sort when modal opens or matrixLevel toggles
  useEffect(() => {
    setSortConfig({ platformKey: null, kpiId: null, direction: null });
  }, [open, matrixLevel]);

  // Handler for column header clicks
  const handleSort = (platformKey, kpiId) => {
    setSortConfig((prev) => {
      // If clicking same column, cycle:
      // For 'item' (Brand/SKU name): asc -> desc -> default (null)
      // For KPI columns: desc -> asc -> default (null)
      if (prev.platformKey === platformKey && prev.kpiId === kpiId) {
        if (kpiId === "item") {
          if (prev.direction === "asc") return { platformKey, kpiId, direction: "desc" };
          return { platformKey: null, kpiId: null, direction: null };
        } else {
          if (prev.direction === "desc") return { platformKey, kpiId, direction: "asc" };
          return { platformKey: null, kpiId: null, direction: null };
        }
      }

      // New column clicked
      return {
        platformKey,
        kpiId,
        direction: kpiId === "item" ? "asc" : "desc",
      };
    });
  };

  // Helper to safely extract numeric value for sorting
  const getCellNumericValue = (row, platformKey, kpi) => {
    if (!row || !row.platforms || !platformKey || !kpi) return null;
    const pfData = row.platforms[platformKey] || {};
    let val = (pfData[kpi.id] !== undefined && pfData[kpi.id] !== null)
      ? pfData[kpi.id]
      : (kpi.altId ? pfData[kpi.altId] : undefined);

    if (val === null || val === undefined || val === "" || val === "-") return null;
    if (typeof val === "string") {
      val = val.replace(/[₹,%\s]/g, "");
    }
    const num = Number(val);
    return isNaN(num) ? null : num;
  };

  // Helper to check if a row has any valid data value across platforms and active KPI columns
  const getRowDataScore = (row) => {
    if (!row || !row.platforms) return { hasData: false, score: 0 };
    let hasData = false;
    let score = 0;

    platforms.forEach((pf) => {
      const pfData = row.platforms?.[pf.key] || {};
      activeKpiColumns.forEach((kpi) => {
        const val = (pfData[kpi.id] !== undefined && pfData[kpi.id] !== null)
          ? pfData[kpi.id]
          : (kpi.altId ? pfData[kpi.altId] : undefined);

        if (val !== null && val !== undefined && val !== "" && !isNaN(val)) {
          const num = Number(val);
          if (num > 0) {
            hasData = true;
            score += num;
          }
        }
      });
    });

    return { hasData, score };
  };

  const matrix = React.useMemo(() => {
    if (!rawMatrix.length) return [];

    // If an active column sort is selected
    if (sortConfig.kpiId !== null) {
      const { platformKey, kpiId, direction } = sortConfig;

      return [...rawMatrix].sort((a, b) => {
        if (kpiId === "item") {
          const strA = String(a.item || a.brand || "").toLowerCase();
          const strB = String(b.item || b.brand || "").toLowerCase();
          const cmp = strA.localeCompare(strB);
          return direction === "asc" ? cmp : -cmp;
        }

        const targetKpi = activeKpiColumns.find((c) => c.id === kpiId || c.altId === kpiId) || { id: kpiId };
        const valA = getCellNumericValue(a, platformKey, targetKpi);
        const valB = getCellNumericValue(b, platformKey, targetKpi);

        // Keep null/missing values at the bottom regardless of sort direction
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;

        if (valA !== valB) {
          return direction === "asc" ? valA - valB : valB - valA;
        }
        return String(a.item || a.brand || "").localeCompare(String(b.item || b.brand || ""));
      });
    }

    // Default sorting (by data score, then name)
    return [...rawMatrix].sort((a, b) => {
      const scoreA = getRowDataScore(a);
      const scoreB = getRowDataScore(b);

      if (scoreA.hasData !== scoreB.hasData) {
        return scoreA.hasData ? -1 : 1;
      }
      if (scoreB.score !== scoreA.score) {
        return scoreB.score - scoreA.score;
      }
      return String(a.item || a.brand || "").localeCompare(String(b.item || b.brand || ""));
    });
  }, [rawMatrix, platforms, activeKpiColumns, sortConfig]);

  // Label for active sort pill
  const activeSortLabel = React.useMemo(() => {
    if (!sortConfig.kpiId) return null;
    if (sortConfig.kpiId === "item") {
      return `${matrixLevel === "sku" ? "SKU Name" : "Brand Name"} (${sortConfig.direction === "asc" ? "A-Z" : "Z-A"})`;
    }
    const pf = platforms.find((p) => p.key === sortConfig.platformKey);
    const kpi = activeKpiColumns.find((c) => c.id === sortConfig.kpiId || c.altId === sortConfig.kpiId);
    return `${pf?.label || sortConfig.platformKey} - ${kpi?.label || sortConfig.kpiId} (${sortConfig.direction === "desc" ? "High to Low" : "Low to High"})`;
  }, [sortConfig, platforms, activeKpiColumns, matrixLevel]);

  // Download Excel export using arranged/sorted matrix
  const handleDownload = () => {
    if (!matrix || matrix.length === 0) return;

    const rows = [];
    matrix.forEach((row) => {
      const rowData = matrixLevel === "sku" ? { SKU: row.item, Brand: row.brand } : { Brand: row.item || row.brand };
      platforms.forEach((pf) => {
        const pfData = row.platforms?.[pf.key] || {};
        activeKpiColumns.forEach((kpi) => {
          const rawVal = (pfData[kpi.id] !== undefined && pfData[kpi.id] !== null) 
            ? pfData[kpi.id] 
            : (kpi.altId ? pfData[kpi.altId] : undefined);
          rowData[`${pf.label} - ${kpi.label}`] = rawVal !== undefined && rawVal !== null ? rawVal : "-";
        });
      });
      rows.push(rowData);
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Cross_Platform_${matrixLevel.toUpperCase()}`);
    const fileName = `Cross_Platform_${matrixLevel.toUpperCase()}_Matrix_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* ── Dialog Header ── */}
      <DialogTitle
        sx={{
          m: 0,
          p: 2.5,
          backgroundColor: "#0F172A",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box
            sx={{
              p: 1,
              borderRadius: "10px",
              backgroundColor: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Layers size={22} color="#38BDF8" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: "#F8FAFC", lineHeight: 1.2 }}>
              Cross Platform {matrixLevel === "sku" ? "SKU" : "Brand"} Matrix
            </Typography>
          </Box>

          {/* Level Switcher: Brand vs SKUs */}
          <ToggleButtonGroup
            value={matrixLevel}
            exclusive
            onChange={(e, newLevel) => {
              if (newLevel) setMatrixLevel(newLevel);
            }}
            size="small"
            sx={{
              ml: 2,
              backgroundColor: "rgba(255,255,255,0.08)",
              p: 0.5,
              borderRadius: "10px",
              "& .MuiToggleButton-root": {
                color: "#94A3B8",
                border: "none",
                borderRadius: "8px",
                px: 2,
                py: 0.4,
                fontSize: 13,
                fontWeight: 600,
                textTransform: "none",
                "&.Mui-selected": {
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  "&:hover": {
                    backgroundColor: "#1D4ED8",
                  },
                },
              },
            }}
          >
            <ToggleButton value="brand">Brand</ToggleButton>
            <ToggleButton value="sku">SKUs</ToggleButton>
          </ToggleButtonGroup>

          {/* Date Range Selector: 1M, 3M, 6M, Custom */}
          <ToggleButtonGroup
            value={dateRange}
            exclusive
            onChange={(e, newRange) => {
              if (newRange) setDateRange(newRange);
            }}
            size="small"
            sx={{
              ml: 1,
              backgroundColor: "rgba(255,255,255,0.08)",
              p: 0.5,
              borderRadius: "10px",
              "& .MuiToggleButton-root": {
                color: "#94A3B8",
                border: "none",
                borderRadius: "8px",
                px: 1.5,
                py: 0.4,
                fontSize: 12,
                fontWeight: 600,
                textTransform: "none",
                "&.Mui-selected": {
                  backgroundColor: "#0EA5E9",
                  color: "#FFFFFF",
                  "&:hover": {
                    backgroundColor: "#0284C7",
                  },
                },
              },
            }}
          >
            <ToggleButton value="1M">1M</ToggleButton>
            <ToggleButton value="3M">3M</ToggleButton>
            <ToggleButton value="6M">6M</ToggleButton>
            <ToggleButton value="Custom">Custom</ToggleButton>
          </ToggleButtonGroup>

          {/* Custom Date Inputs when Custom is selected */}
          {dateRange === "Custom" && (
            <Box display="flex" alignItems="center" gap={1} ml={0.5}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  backgroundColor: "#1E293B",
                  color: "#F8FAFC",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  fontSize: "12px",
                  fontWeight: 500,
                  outline: "none",
                  colorScheme: "dark"
                }}
              />
              <Typography variant="caption" sx={{ color: "#94A3B8" }}>to</Typography>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  backgroundColor: "#1E293B",
                  color: "#F8FAFC",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  fontSize: "12px",
                  fontWeight: 500,
                  outline: "none",
                  colorScheme: "dark"
                }}
              />
            </Box>
          )}
        </Box>

        <Box display="flex" alignItems="center" gap={1.5}>
          {/* Active Sort Indicator Chip */}
          {activeSortLabel && (
            <Box
              onClick={() => setSortConfig({ platformKey: null, kpiId: null, direction: null })}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.5,
                py: 0.5,
                borderRadius: "8px",
                backgroundColor: "rgba(56, 189, 248, 0.12)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                color: "#38BDF8",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                "&:hover": {
                  backgroundColor: "rgba(56, 189, 248, 0.22)",
                  borderColor: "rgba(56, 189, 248, 0.6)",
                },
              }}
              title="Click to reset column sorting"
            >
              {sortConfig.direction === "asc" ? <ArrowUp size={13} strokeWidth={2.5} /> : <ArrowDown size={13} strokeWidth={2.5} />}
              <span>Sorted: {activeSortLabel}</span>
              <X size={13} strokeWidth={2.5} style={{ opacity: 0.7, marginLeft: 2 }} />
            </Box>
          )}

          {/* Filter Toggle Button */}
          <Button
            variant={showFilters ? "contained" : "outlined"}
            size="small"
            startIcon={<Filter size={16} />}
            onClick={() => setShowFilters(!showFilters)}
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 600,
              color: showFilters ? "#fff" : "#94A3B8",
              borderColor: "rgba(255,255,255,0.2)",
              backgroundColor: showFilters ? "#2563EB" : "transparent",
              "&:hover": {
                backgroundColor: showFilters ? "#1D4ED8" : "rgba(255,255,255,0.08)",
                borderColor: "rgba(255,255,255,0.4)",
              },
            }}
          >
            Filter {(selectedPlatforms.length + selectedBrands.length + selectedCategories.length + selectedLocations.length) > 0 ? `(${selectedPlatforms.length + selectedBrands.length + selectedCategories.length + selectedLocations.length})` : ""}
          </Button>

          {/* Download Button */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<Download size={16} />}
            onClick={handleDownload}
            disabled={matrix.length === 0}
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 600,
              color: "#38BDF8",
              borderColor: "rgba(56, 189, 248, 0.4)",
              "&:hover": {
                backgroundColor: "rgba(56, 189, 248, 0.1)",
                borderColor: "#38BDF8",
              },
            }}
          >
            Export Excel
          </Button>

          {/* Close Button */}
          <IconButton onClick={onClose} size="small" sx={{ color: "#94A3B8", "&:hover": { color: "#fff" } }}>
            <X size={20} />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* ── Collapsible Filters Bar ── */}
      {showFilters && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            backgroundColor: "#1E293B",
            borderBottom: "1px solid #334155",
            borderRadius: 0,
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
            <Typography variant="subtitle2" sx={{ color: "#CBD5E1", fontWeight: 600 }}>
              Filter Cross Platform View ({matrixLevel.toUpperCase()})
            </Typography>
            <Button
              size="small"
              startIcon={<RefreshCw size={14} />}
              onClick={handleResetFilters}
              sx={{ color: "#94A3B8", textTransform: "none", fontSize: "12px" }}
            >
              Reset Filters
            </Button>
          </Box>

          <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" }} gap={2}>
            {/* 1. Platform Filter */}
            <FormControl size="small" fullWidth sx={{ backgroundColor: "#0F172A", borderRadius: "8px" }}>
              <InputLabel sx={{ color: "#94A3B8", fontSize: "13px" }}>Platform</InputLabel>
              <Select
                multiple
                value={selectedPlatforms}
                onChange={(e) => setSelectedPlatforms(e.target.value)}
                label="Platform"
                renderValue={(selected) =>
                  selected.length === 0 ? "All Platforms" : selected.join(", ")
                }
                sx={{ color: "#F8FAFC", ".MuiSvgIcon-root": { color: "#94A3B8" } }}
              >
                {filterOptions.platforms.map((p) => (
                  <MenuItem key={p} value={p}>
                    <Checkbox checked={selectedPlatforms.indexOf(p) > -1} size="small" />
                    <ListItemText primary={p} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* 2. Brand Filter */}
            <FormControl size="small" fullWidth sx={{ backgroundColor: "#0F172A", borderRadius: "8px" }}>
              <InputLabel sx={{ color: "#94A3B8", fontSize: "13px" }}>Brand</InputLabel>
              <Select
                multiple
                value={selectedBrands}
                onChange={(e) => setSelectedBrands(e.target.value)}
                label="Brand"
                renderValue={(selected) =>
                  selected.length === 0 ? "All Brands" : `${selected.length} selected`
                }
                sx={{ color: "#F8FAFC", ".MuiSvgIcon-root": { color: "#94A3B8" } }}
              >
                {filterOptions.brands.map((b) => (
                  <MenuItem key={b} value={b}>
                    <Checkbox checked={selectedBrands.indexOf(b) > -1} size="small" />
                    <ListItemText primary={b} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* 3. Category Filter */}
            <FormControl size="small" fullWidth sx={{ backgroundColor: "#0F172A", borderRadius: "8px" }}>
              <InputLabel sx={{ color: "#94A3B8", fontSize: "13px" }}>Category</InputLabel>
              <Select
                multiple
                value={selectedCategories}
                onChange={(e) => setSelectedCategories(e.target.value)}
                label="Category"
                renderValue={(selected) =>
                  selected.length === 0 ? "All Categories" : `${selected.length} selected`
                }
                sx={{ color: "#F8FAFC", ".MuiSvgIcon-root": { color: "#94A3B8" } }}
              >
                {filterOptions.categories.map((c) => (
                  <MenuItem key={c} value={c}>
                    <Checkbox checked={selectedCategories.indexOf(c) > -1} size="small" />
                    <ListItemText primary={c} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* 4. Location Filter */}
            <FormControl size="small" fullWidth sx={{ backgroundColor: "#0F172A", borderRadius: "8px" }}>
              <InputLabel sx={{ color: "#94A3B8", fontSize: "13px" }}>Location</InputLabel>
              <Select
                multiple
                value={selectedLocations}
                onChange={(e) => setSelectedLocations(e.target.value)}
                label="Location"
                renderValue={(selected) =>
                  selected.length === 0 ? "All Locations" : `${selected.length} selected`
                }
                sx={{ color: "#F8FAFC", ".MuiSvgIcon-root": { color: "#94A3B8" } }}
              >
                {filterOptions.locations.map((loc) => (
                  <MenuItem key={loc} value={loc}>
                    <Checkbox checked={selectedLocations.indexOf(loc) > -1} size="small" />
                    <ListItemText primary={loc} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Paper>
      )}

      {/* ── Dialog Content (Matrix Table) ── */}
      <DialogContent sx={{ p: 0, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#F8FAFC" }}>
        {loading ? (
          <Box p={4}>
            <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: "8px" }} />
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: "8px" }} />
          </Box>
        ) : matrix.length === 0 ? (
          <Box p={6} textAlign="center">
            <Typography variant="body1" color="text.secondary" fontWeight={500}>
              No matrix data found for the selected filters.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ flex: 1, overflow: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                fontSize: "13px",
              }}
            >
              <thead>
                {/* Header Row 1: Brand/SKU + Platform Names */}
                <tr>
                  <th
                    rowSpan={2}
                    onClick={() => handleSort(null, "item")}
                    style={{
                      position: "sticky",
                      left: 0,
                      top: 0,
                      zIndex: 3,
                      backgroundColor: sortConfig.kpiId === "item" ? "#1E293B" : "#0F172A",
                      color: sortConfig.kpiId === "item" ? "#38BDF8" : "#F8FAFC",
                      padding: "12px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      fontSize: "14px",
                      borderBottom: "2px solid #334155",
                      borderRight: "2px solid #334155",
                      minWidth: matrixLevel === "sku" ? "240px" : "160px",
                      cursor: "pointer",
                      userSelect: "none",
                      transition: "background-color 0.15s, color 0.15s",
                    }}
                    title={`Click to sort by ${matrixLevel === "sku" ? "SKU" : "Brand"} name (${sortConfig.kpiId === "item" ? (sortConfig.direction === "asc" ? "Ascending - click for Descending" : "Descending - click to reset") : "click to sort"})`}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <span>{matrixLevel === "sku" ? "SKU / Product" : "Brand"}</span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          color: sortConfig.kpiId === "item" ? "#38BDF8" : "#64748B",
                        }}
                      >
                        {sortConfig.kpiId === "item" ? (
                          sortConfig.direction === "asc" ? (
                            <ArrowUp size={14} strokeWidth={2.5} />
                          ) : (
                            <ArrowDown size={14} strokeWidth={2.5} />
                          )
                        ) : (
                          <ArrowUpDown size={13} strokeWidth={1.8} style={{ opacity: 0.5 }} />
                        )}
                      </span>
                    </div>
                  </th>
                  {platforms.map((pf) => {
                    const isPlatformActive = sortConfig.platformKey === pf.key;
                    return (
                      <th
                        key={pf.key}
                        colSpan={activeKpiColumns.length}
                        style={{
                          position: "sticky",
                          top: 0,
                          zIndex: 2,
                          backgroundColor: isPlatformActive ? "#0B192C" : "#1E293B",
                          color: "#38BDF8",
                          padding: "10px 12px",
                          textAlign: "center",
                          fontWeight: 700,
                          fontSize: "14px",
                          letterSpacing: "0.03em",
                          borderBottom: isPlatformActive ? "2px solid #38BDF8" : "1px solid #334155",
                          borderRight: "2px solid #334155",
                          transition: "background-color 0.15s, border-bottom 0.15s",
                        }}
                      >
                        {pf.label}
                      </th>
                    );
                  })}
                </tr>

                {/* Header Row 2: KPI Columns under each platform */}
                <tr>
                  {platforms.map((pf) =>
                    activeKpiColumns.map((kpi, idx) => {
                      const isSorted = sortConfig.platformKey === pf.key && sortConfig.kpiId === kpi.id;
                      return (
                        <th
                          key={`${pf.key}-${kpi.id}`}
                          onClick={() => handleSort(pf.key, kpi.id)}
                          onMouseEnter={(e) => {
                            if (!isSorted) {
                              e.currentTarget.style.backgroundColor = "#475569";
                              e.currentTarget.style.color = "#F8FAFC";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSorted) {
                              e.currentTarget.style.backgroundColor = "#334155";
                              e.currentTarget.style.color = "#94A3B8";
                            }
                          }}
                          style={{
                            position: "sticky",
                            top: 38,
                            zIndex: 2,
                            backgroundColor: isSorted ? "#0F172A" : "#334155",
                            color: isSorted ? "#38BDF8" : "#94A3B8",
                            padding: "8px 10px",
                            textAlign: "right",
                            fontWeight: isSorted ? 700 : 600,
                            fontSize: "12px",
                            borderBottom: isSorted ? "3px solid #38BDF8" : "2px solid #475569",
                            borderRight: idx === activeKpiColumns.length - 1 ? "2px solid #475569" : "1px solid #475569",
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                            userSelect: "none",
                            transition: "background-color 0.15s, color 0.15s, border-bottom 0.15s",
                          }}
                          title={`Click to sort by ${pf.label} ${kpi.label} (${isSorted ? (sortConfig.direction === "desc" ? "Descending - click for Ascending" : "Ascending - click to reset") : "click to sort"})`}
                        >
                          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: "5px" }}>
                            <span>{kpi.label}</span>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                color: isSorted ? "#38BDF8" : "#94A3B8",
                              }}
                            >
                              {isSorted ? (
                                sortConfig.direction === "asc" ? (
                                  <ArrowUp size={13} strokeWidth={2.5} />
                                ) : (
                                  <ArrowDown size={13} strokeWidth={2.5} />
                                )
                              ) : (
                                <ArrowUpDown size={12} strokeWidth={1.8} style={{ opacity: 0.5 }} />
                              )}
                            </span>
                          </div>
                        </th>
                      );
                    })
                  )}
                </tr>
              </thead>

              <tbody>
                {matrix.map((row, rIdx) => {
                  const isEven = rIdx % 2 === 0;
                  const rowBg = isEven ? "#FFFFFF" : "#F8FAFC";
                  const displayItem = row.item || row.brand;
                  const isItemSorted = sortConfig.kpiId === "item";

                  return (
                    <tr
                      key={displayItem}
                      style={{
                        backgroundColor: rowBg,
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F1F5F9")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = rowBg)}
                    >
                      {/* Sticky Brand / SKU Name Cell */}
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          backgroundColor: isItemSorted ? (isEven ? "#F0F9FF" : "#E0F2FE") : rowBg,
                          padding: "10px 16px",
                          fontWeight: matrixLevel === "sku" ? (isItemSorted ? 600 : 500) : 700,
                          color: isItemSorted ? "#0369A1" : "#0F172A",
                          borderBottom: "1px solid #E2E8F0",
                          borderRight: "2px solid #CBD5E1",
                          borderLeft: isItemSorted ? "3px solid #0EA5E9" : undefined,
                          whiteSpace: "nowrap",
                          maxWidth: matrixLevel === "sku" ? "320px" : "200px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={displayItem}
                      >
                        {displayItem}
                      </td>

                      {/* KPI Data Cells per Platform */}
                      {platforms.map((pf) => {
                        const pfData = row.platforms?.[pf.key] || {};

                        return activeKpiColumns.map((kpi, idx) => {
                          const isSorted = sortConfig.platformKey === pf.key && sortConfig.kpiId === kpi.id;
                          const val = (pfData[kpi.id] !== undefined && pfData[kpi.id] !== null) 
                            ? pfData[kpi.id] 
                            : (kpi.altId ? pfData[kpi.altId] : undefined);
                          const formatted = formatVal(val, kpi.format);

                          return (
                            <td
                              key={`${displayItem}-${pf.key}-${kpi.id}`}
                              style={{
                                padding: "10px 12px",
                                textAlign: "right",
                                color: val !== null && val !== undefined ? (isSorted ? "#0369A1" : "#1E293B") : "#94A3B8",
                                fontWeight: isSorted ? 600 : 400,
                                backgroundColor: isSorted ? "rgba(14, 165, 233, 0.08)" : undefined,
                                borderBottom: "1px solid #E2E8F0",
                                borderRight: idx === activeKpiColumns.length - 1 ? "2px solid #CBD5E1" : "1px solid #F1F5F9",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatted}
                            </td>
                          );
                        });
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
