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
import { X, Filter, Download, Layers, RefreshCw } from "lucide-react";
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
  { id: "promo", altId: "promoMyBrand", label: "Promo-My %", format: "percent" },
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

  // Download Excel export
  const handleDownload = () => {
    if (!data.matrix || data.matrix.length === 0) return;

    const rows = [];
    data.matrix.forEach((row) => {
      const rowData = matrixLevel === "sku" ? { SKU: row.item, Brand: row.brand } : { Brand: row.item || row.brand };
      data.platforms.forEach((pf) => {
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

  const platforms = data.platforms || [];
  const matrix = data.matrix || [];

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
                    style={{
                      position: "sticky",
                      left: 0,
                      top: 0,
                      zIndex: 3,
                      backgroundColor: "#0F172A",
                      color: "#F8FAFC",
                      padding: "12px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      fontSize: "14px",
                      borderBottom: "2px solid #334155",
                      borderRight: "2px solid #334155",
                      minWidth: matrixLevel === "sku" ? "240px" : "160px",
                    }}
                  >
                    {matrixLevel === "sku" ? "SKU / Product" : "Brand"}
                  </th>
                  {platforms.map((pf) => (
                    <th
                      key={pf.key}
                      colSpan={activeKpiColumns.length}
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        backgroundColor: "#1E293B",
                        color: "#38BDF8",
                        padding: "10px 12px",
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: "14px",
                        letterSpacing: "0.03em",
                        borderBottom: "1px solid #334155",
                        borderRight: "2px solid #334155",
                      }}
                    >
                      {pf.label}
                    </th>
                  ))}
                </tr>

                {/* Header Row 2: KPI Columns under each platform */}
                <tr>
                  {platforms.map((pf) =>
                    activeKpiColumns.map((kpi, idx) => (
                      <th
                        key={`${pf.key}-${kpi.id}`}
                        style={{
                          position: "sticky",
                          top: 38,
                          zIndex: 2,
                          backgroundColor: "#334155",
                          color: "#94A3B8",
                          padding: "8px 10px",
                          textAlign: "right",
                          fontWeight: 600,
                          fontSize: "12px",
                          borderBottom: "2px solid #475569",
                          borderRight: idx === activeKpiColumns.length - 1 ? "2px solid #475569" : "1px solid #475569",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {kpi.label}
                      </th>
                    ))
                  )}
                </tr>
              </thead>

              <tbody>
                {matrix.map((row, rIdx) => {
                  const isEven = rIdx % 2 === 0;
                  const rowBg = isEven ? "#FFFFFF" : "#F8FAFC";
                  const displayItem = row.item || row.brand;

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
                          backgroundColor: rowBg,
                          padding: "10px 16px",
                          fontWeight: matrixLevel === "sku" ? 500 : 700,
                          color: "#0F172A",
                          borderBottom: "1px solid #E2E8F0",
                          borderRight: "2px solid #CBD5E1",
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
                                color: val !== null && val !== undefined ? "#1E293B" : "#94A3B8",
                                fontWeight: 400,
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
