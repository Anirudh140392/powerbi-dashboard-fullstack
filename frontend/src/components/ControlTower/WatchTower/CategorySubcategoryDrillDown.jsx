import React, { useState, useMemo, useEffect } from "react";
import { fetchPrimaryTopProducts } from "../../../api/primarySalesService";
import {
  Box,
  Card,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  Button,
} from "@mui/material";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Store,
  MapPin,
  Grid,
  Tag,
  Package,
} from "lucide-react";

const capitalizeWords = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const formatShortValue = (val, isMRP) => {
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


// Build hierarchy sequence based on the top-level xAxis
const getSequence = (xAxis) => {
  const norm = (xAxis || "").toLowerCase();
  if (norm.includes("brand")) {
    return [
      { targetLevel: "product", label: "Product", parentKey: "brandName" },
    ];
  }
  if (norm.includes("division")) {
    return [
      { targetLevel: "brand", label: "Brand", parentKey: "divisionName" },
      { targetLevel: "product", label: "Product", parentKey: "brandName" },
    ];
  }
  if (norm.includes("zone")) {
    return [
      { targetLevel: "division", label: "Division", parentKey: "zoneName" },
      { targetLevel: "brand", label: "Brand", parentKey: "divisionName" },
      { targetLevel: "product", label: "Product", parentKey: "brandName" },
    ];
  }
  if (norm.includes("product")) {
    return []; // product is already the leaf
  }
  // Default: Retailer Name → Product directly
  return [
    { targetLevel: "product", label: "Product", parentKey: "retailerName" },
  ];
};

// Recursive Nested DrillDown Component for Retailer -> Zone -> Division -> Brand -> Product
function NestedDrillDownItem({
  item,
  levelIndex,
  parents = {},
  filters = {},
  currentXAxis = "Retailer Name",
  metricType = "MRP",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState([]);
  const [fetched, setFetched] = useState(false);

  const sequence = getSequence(currentXAxis);

  const isLeaf = levelIndex >= sequence.length;
  const currentConfig = !isLeaf ? sequence[levelIndex] : null;

  const handleToggle = async () => {
    if (isLeaf) return;
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    if (!fetched) {
      setLoading(true);
      try {
        const itemRawName = item.rawName || item.name;
        const updatedParents = {
          ...parents,
          [currentConfig.parentKey]: itemRawName,
        };

        const res = await fetchPrimaryTopProducts({
          ...filters,
          xAxis: currentXAxis,
          metricType,
          targetLevel: currentConfig.targetLevel,
          retailerName: updatedParents.retailerName || "",
          zoneName: updatedParents.zoneName || "",
          divisionName: updatedParents.divisionName || "",
          brandName: updatedParents.brandName || "",
        });

        if (res && res.success) {
          setChildren(res.data || []);
        } else {
          setChildren([]);
        }
      } catch (err) {
        console.error("Error fetching nested drilldown level:", err);
        setChildren([]);
      } finally {
        setLoading(false);
        setFetched(true);
      }
    }
  };

  const nextParents = currentConfig
    ? { ...parents, [currentConfig.parentKey]: item.rawName || item.name }
    : parents;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8, width: "100%" }}>
      <Box
        onClick={!isLeaf ? handleToggle : undefined}
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          py: 1.1,
          px: 2.2,
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          border: "1px solid #f1f5f9",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          cursor: !isLeaf ? "pointer" : "default",
          transition: "all 0.15s ease",
          "&:hover": !isLeaf
            ? {
                backgroundColor: "#f8fafc",
                borderColor: "#e2e8f0",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              }
            : {},
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, minWidth: 0 }}>
          {!isLeaf ? (
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                backgroundColor: isOpen ? "#dbeafe" : "#eff6ff",
                color: isOpen ? "#2563eb" : "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
            >
              <ChevronDown
                size={14}
                style={{
                  transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </Box>
          ) : (
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#3b82f6",
                flexShrink: 0,
                ml: 1,
              }}
            />
          )}

          <Typography
            noWrap
            sx={{
              fontSize: "0.83rem",
              fontWeight: 700,
              color: "#334155",
              fontFamily: "'Mulish', 'Roboto', sans-serif",
            }}
          >
            {item.name}
          </Typography>

          {!isLeaf && currentConfig && (
            <Typography
              sx={{
                fontSize: "0.64rem",
                fontWeight: 800,
                color: "#2563eb",
                backgroundColor: "#eff6ff",
                px: 1,
                py: 0.2,
                borderRadius: "10px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              {currentConfig.label}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0, ml: 2 }}>
          <Typography
            sx={{
              fontSize: "0.86rem",
              fontWeight: 800,
              color: "#0f172a",
              fontFamily: "'Mulish', 'Roboto', sans-serif",
            }}
          >
            {formatShortValue(item.val, true)}
          </Typography>
          {item.unitsVal !== undefined && item.unitsVal > 0 && (
            <Typography
              sx={{
                fontSize: "0.76rem",
                fontWeight: 600,
                color: "#64748b",
                fontFamily: "'Mulish', 'Roboto', sans-serif",
              }}
            >
              • {formatShortValue(item.unitsVal, false)} Units
            </Typography>
          )}
        </Box>
      </Box>

      {/* Nested Children Level */}
      {isOpen && (
        <Box
          sx={{
            pl: 2.5,
            borderLeft: "2px solid #e2e8f0",
            ml: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 0.8,
            my: 0.5,
          }}
        >
          {loading ? (
            <Typography
              sx={{
                fontSize: "0.78rem",
                color: "#64748b",
                py: 0.8,
                px: 1,
                fontFamily: "'Mulish', 'Roboto', sans-serif",
              }}
            >
              Loading {currentConfig?.label || "sub-items"}...
            </Typography>
          ) : children.length > 0 ? (
            children.map((child, cIdx) => (
              <NestedDrillDownItem
                key={cIdx}
                item={child}
                levelIndex={levelIndex + 1}
                parents={nextParents}
                filters={filters}
                currentXAxis={currentXAxis}
                metricType={metricType}
              />
            ))
          ) : null}
        </Box>
      )}
    </Box>
  );
}

export default function CategorySubcategoryDrillDown({
  tableRows = [],
  monthsHeaders = [],
  metricType = "MRP",
  loading = false,
  currentXAxis = "Retailer Name",
  onXAxisChange = () => {},
  filters = {},
}) {
  const [expandedIds, setExpandedIds] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const searchPlaceholder = useMemo(() => {
    const norm = (currentXAxis || "Retailer").toLowerCase();
    if (norm.includes("retailer")) return "Search Retailer...";
    if (norm.includes("zone")) return "Search Zone...";
    if (norm.includes("division")) return "Search Division...";
    if (norm.includes("brand")) return "Search Brand...";
    if (norm.includes("product")) return "Search Product...";
    return `Search ${currentXAxis}...`;
  }, [currentXAxis]);

  const dynamicData = useMemo(() => {
    if (tableRows && tableRows.length > 0 && monthsHeaders && monthsHeaders.length > 0) {
      const latestMonth = monthsHeaders[monthsHeaders.length - 1];
      const prevMonth = monthsHeaders.length > 1 ? monthsHeaders[monthsHeaders.length - 2] : null;

      let grandTotalSales = 0;
      let grandTotalUnits = 0;
      let grandTotalLatestSales = 0;
      let grandTotalPrevSales = 0;
      let grandTotalLatestUnits = 0;
      let grandTotalPrevUnits = 0;

      const rows = tableRows.map((r, idx) => {
        // Calculate total sales across all selected months
        const salesVal = r.sales_total !== undefined && r.sales_total !== null
          ? Number(r.sales_total)
          : monthsHeaders.reduce((acc, m) => acc + (Number(r[m + "_sales"] !== undefined ? r[m + "_sales"] : r[m]) || 0), 0);

        // Calculate total units across all selected months
        const unitsVal = r.units_total !== undefined && r.units_total !== null
          ? Number(r.units_total)
          : monthsHeaders.reduce((acc, m) => acc + (Number(r[m + "_units"]) || 0), 0);

        // Get latest and previous month values for MRP (sales)
        const latestSalesVal = Number(r[latestMonth + "_sales"] !== undefined ? r[latestMonth + "_sales"] : r[latestMonth]) || 0;
        const prevSalesVal = prevMonth ? (Number(r[prevMonth + "_sales"] !== undefined ? r[prevMonth + "_sales"] : r[prevMonth]) || 0) : 0;

        // Get latest and previous month values for Units
        const latestUnitsVal = Number(r[latestMonth + "_units"]) || 0;
        const prevUnitsVal = prevMonth ? (Number(r[prevMonth + "_units"]) || 0) : 0;

        // Calculate growth percentage based on metric type
        let salesChangePct = 0;
        if (prevSalesVal > 0) {
          salesChangePct = ((latestSalesVal - prevSalesVal) / prevSalesVal) * 100;
        } else if (latestSalesVal > 0 && prevMonth) {
          salesChangePct = 100.0;
        } else if (latestSalesVal === 0 && prevSalesVal > 0) {
          salesChangePct = -100.0;
        }

        let unitsChangePct = 0;
        if (prevUnitsVal > 0) {
          unitsChangePct = ((latestUnitsVal - prevUnitsVal) / prevUnitsVal) * 100;
        } else if (latestUnitsVal > 0 && prevMonth) {
          unitsChangePct = 100.0;
        } else if (latestUnitsVal === 0 && prevUnitsVal > 0) {
          unitsChangePct = -100.0;
        }

        // Aggregate for grand totals
        grandTotalSales += salesVal;
        grandTotalUnits += unitsVal;
        grandTotalLatestSales += latestSalesVal;
        grandTotalPrevSales += prevSalesVal;
        grandTotalLatestUnits += latestUnitsVal;
        grandTotalPrevUnits += prevUnitsVal;

        const currentDimensionName = currentXAxis || "Retailer";
        const periodText = monthsHeaders.length === 1 ? "1 Month Period" : `${monthsHeaders.length} Month Periods`;

        return {
          id: `row-${idx}`,
          name: capitalizeWords(r.name),
          rawName: r.rawName || r.name,
          subtitle: `${currentDimensionName} • Active in ${periodText}`,
          sales: {
            val: formatShortValue(salesVal, true),
            chg: `${salesChangePct >= 0 ? "↑" : "↓"} ${Math.abs(salesChangePct).toFixed(1)}%`,
            pos: salesChangePct >= 0,
          },
          units: {
            val: `${formatShortValue(unitsVal, false)} Units`,
            chg: `${unitsChangePct >= 0 ? "↑" : "↓"} ${Math.abs(unitsChangePct).toFixed(1)}%`,
            pos: unitsChangePct >= 0,
          },
        };
      });

      // Calculate grand total growth
      let grandSalesChangePct = 0;
      if (grandTotalPrevSales > 0) {
        grandSalesChangePct = ((grandTotalLatestSales - grandTotalPrevSales) / grandTotalPrevSales) * 100;
      } else if (grandTotalLatestSales > 0) {
        grandSalesChangePct = 100.0;
      }

      let grandUnitsChangePct = 0;
      if (grandTotalPrevUnits > 0) {
        grandUnitsChangePct = ((grandTotalLatestUnits - grandTotalPrevUnits) / grandTotalPrevUnits) * 100;
      } else if (grandTotalLatestUnits > 0) {
        grandUnitsChangePct = 100.0;
      }

      const allRow = {
        id: "all",
        isAll: true,
        name: `All ${currentXAxis || "Retailers"}`,
        subtitle: "Overall Platform Summary",
        sales: { 
          val: formatShortValue(grandTotalSales, true), 
          chg: `${grandSalesChangePct >= 0 ? "↑" : "↓"} ${Math.abs(grandSalesChangePct).toFixed(1)}%`,
          pos: grandSalesChangePct >= 0 
        },
        units: { 
          val: `${formatShortValue(grandTotalUnits, false)} Units`, 
          chg: `${grandUnitsChangePct >= 0 ? "↑" : "↓"} ${Math.abs(grandUnitsChangePct).toFixed(1)}%`,
          pos: grandUnitsChangePct >= 0 
        },
      };

      return [allRow, ...rows];
    }

    return [];
  }, [tableRows, monthsHeaders, metricType, currentXAxis]);

  const toggleExpand = async (id, entityName, rawName) => {
    if (expandedIds[id]?.isOpen) {
      setExpandedIds((prev) => ({ ...prev, [id]: { ...prev[id], isOpen: false } }));
      return;
    }
    
    setExpandedIds((prev) => ({ ...prev, [id]: { isOpen: true, loading: true, products: [] } }));
    try {
      const parentName = rawName || entityName;
      const sequence = getSequence(currentXAxis);
      const topConfig = sequence[0] || { targetLevel: "product", parentKey: "retailerName" };

      const res = await fetchPrimaryTopProducts({
        ...filters,
        xAxis: currentXAxis,
        metricType,
        entityName: parentName,
        targetLevel: topConfig.targetLevel,
        [topConfig.parentKey]: parentName,
      });
      if (res && res.success) {
        setExpandedIds((prev) => ({ ...prev, [id]: { isOpen: true, loading: false, products: res.data } }));
      } else {
        setExpandedIds((prev) => ({ ...prev, [id]: { isOpen: true, loading: false, products: [] } }));
      }
    } catch (err) {
      console.error("Error fetching top products:", err);
      setExpandedIds((prev) => ({ ...prev, [id]: { isOpen: true, loading: false, products: [] } }));
    }
  };

  const allRow = dynamicData.filter((r) => r.isAll);
  const filteredRows = dynamicData
    .filter((ret) => !ret.isAll)
    .filter((ret) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return ret.name.toLowerCase().includes(q);
    });
  const visibleRows = showAll ? filteredRows : filteredRows.slice(0, 5);
  const dataToRender = [...allRow, ...visibleRows];
  const totalCount = filteredRows.length;

  const renderMetricCell = (cell, key) => (
    <TableCell key={key} align="center" sx={{ py: 1.8, px: 2, width: "25%" }}>
      {cell ? (
        <Box
          sx={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#ffffff",
            border: `1px solid ${cell.pos ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.30)"}`,
            borderRadius: "20px",
            px: 2.5,
            py: 0.95,
            minWidth: 120,
            boxShadow: cell.pos
              ? "0 3px 12px rgba(16,185,129,0.08), 0 1px 3px rgba(0,0,0,0.02)"
              : "0 3px 12px rgba(239,68,68,0.08), 0 1px 3px rgba(0,0,0,0.02)",
            transition: "all 0.15s ease-in-out",
            "&:hover": {
              boxShadow: cell.pos
                ? "0 6px 18px rgba(16,185,129,0.15)"
                : "0 6px 18px rgba(239,68,68,0.15)",
              transform: "translateY(-2px)",
            },
          }}
        >
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: "0.92rem",
              color: "#0f172a",
              lineHeight: 1.2,
              fontFamily: "'Mulish', 'Roboto', sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {cell.val}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.74rem",
              fontWeight: 700,
              color: cell.pos ? "#10b981" : "#ef4444",
              lineHeight: 1.2,
              fontFamily: "'Mulish', 'Roboto', sans-serif",
              mt: 0.3,
            }}
          >
            {cell.chg}
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            px: 2.5,
            py: 0.95,
            minWidth: 120,
          }}
        >
          <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem" }}>-</Typography>
        </Box>
      )}
    </TableCell>
  );

  return (
    <Box sx={{ mt: 4, width: "100%" }}>
      <Card
        sx={{
          borderRadius: 3,
          border: "1px solid rgba(37,99,235,0.10)",
          boxShadow: "0 4px 24px rgba(37,99,235,0.06), 0 1px 4px rgba(0,0,0,0.04)",
          backgroundColor: "#fff",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: 2.5,
            py: 1.5,
            borderBottom: "1px solid rgba(37,99,235,0.08)",
            flexWrap: "wrap",
            gap: 1.5,
            rowGap: 1.2,
            width: "100%",
            boxSizing: "border-box",
            background: "linear-gradient(135deg, rgba(37,99,235,0.03) 0%, rgba(255,255,255,1) 60%)",
          }}
        >
          {/* TITLE (LEFT) */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexShrink: 0 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: "10px",
                backgroundColor: "#2563eb",
                boxShadow: "0 3px 8px rgba(37,99,235,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Store size={17} color="#fff" />
            </Box>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "#1e293b",
                letterSpacing: "0.01em",
                fontFamily: "'Mulish', 'Roboto', sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              Sales Overview
            </Typography>
          </Box>

          {/* HORIZONTAL PILL TABS BAR FOR DIMENSIONS (CENTERED) */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flex: 1,
              px: 1,
              minWidth: { xs: "100%", md: "auto" },
            }}
          >
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                backgroundColor: "#f1f5f9",
                borderRadius: "18px",
                p: 0.35,
                gap: 0.3,
                border: "1px solid #e2e8f0",
                maxWidth: "100%",
                overflowX: "auto",
              }}
            >
              {[
                { value: "Retailer Name", label: "Retailer", icon: Store },
                { value: "Zone", label: "Zone", icon: MapPin },
                { value: "Division", label: "Division", icon: Grid },
                { value: "Brand Name", label: "Brand", icon: Tag },
                { value: "Product", label: "Product", icon: Package },
              ].map((tab) => {
                const IconComp = tab.icon;
                const isActive = (currentXAxis || "Retailer Name") === tab.value;
                return (
                  <Button
                    key={tab.value}
                    onClick={() => onXAxisChange(tab.value)}
                    startIcon={<IconComp size={13} color={isActive ? "#2563eb" : "#64748b"} />}
                    sx={{
                      height: 30,
                      px: 1.4,
                      borderRadius: "14px",
                      fontSize: "0.74rem",
                      fontWeight: isActive ? 800 : 600,
                      textTransform: "none",
                      color: isActive ? "#2563eb" : "#64748b",
                      backgroundColor: isActive ? "#ffffff" : "transparent",
                      boxShadow: isActive ? "0 2px 6px rgba(37,99,235,0.12)" : "none",
                      border: isActive ? "1px solid rgba(37,99,235,0.2)" : "1px solid transparent",
                      transition: "all 0.15s ease",
                      fontFamily: "'Mulish', 'Roboto', sans-serif",
                      whiteSpace: "nowrap",
                      minWidth: "auto",
                      "&:hover": {
                        backgroundColor: isActive ? "#ffffff" : "rgba(255,255,255,0.6)",
                        color: isActive ? "#2563eb" : "#1e293b",
                      },
                    }}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </Box>
          </Box>

          {/* SEARCH INPUT (RIGHT) */}
          <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <TextField
              size="small"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} color="#94a3b8" />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: { xs: "100%", sm: 230 },
                backgroundColor: "#f8fafc",
                borderRadius: "20px",
                "& .MuiOutlinedInput-root": {
                  height: 36,
                  fontSize: "0.78rem",
                  fontFamily: "'Mulish', 'Roboto', sans-serif",
                  borderRadius: "20px",
                  "& fieldset": { borderColor: "rgba(0,0,0,0.08)", borderRadius: "20px" },
                  "&:hover fieldset": { borderColor: "rgba(37,99,235,0.3)" },
                  "&.Mui-focused fieldset": { borderColor: "#2563eb", boxShadow: "0 0 0 3px rgba(37,99,235,0.12)" },
                },
              }}
            />
          </Box>
        </Box>

        <TableContainer sx={{ overflowX: "auto" }}>
          <Table sx={{ minWidth: 900, width: "100%" }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: "rgba(37,99,235,0.02)" }}>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.72rem",
                    color: "#475569",
                    letterSpacing: "0.06em",
                    py: 1.8,
                    pl: 3.5,
                    minWidth: 350,
                    width: "50%",
                    borderBottom: "1px solid rgba(37,99,235,0.08)",
                    fontFamily: "'Mulish', 'Roboto', sans-serif",
                  }}
                >
                  {(currentXAxis || "Retailer Name").toUpperCase()}
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.72rem",
                    color: "#475569",
                    letterSpacing: "0.06em",
                    py: 1.8,
                    px: 2,
                    minWidth: 150,
                    width: "25%",
                    borderBottom: "1px solid rgba(37,99,235,0.08)",
                    fontFamily: "'Mulish', 'Roboto', sans-serif",
                  }}
                >
                  TOTAL SALES
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.72rem",
                    color: "#475569",
                    letterSpacing: "0.06em",
                    py: 1.8,
                    px: 2,
                    minWidth: 150,
                    width: "25%",
                    borderBottom: "1px solid rgba(37,99,235,0.08)",
                    fontFamily: "'Mulish', 'Roboto', sans-serif",
                  }}
                >
                  UNITS SOLD
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx} sx={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <TableCell sx={{ py: 2, pl: 3.5, width: "50%" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Skeleton variant="circular" width={28} height={28} />
                        <Box sx={{ width: "70%" }}>
                          <Skeleton variant="text" width="60%" height={20} />
                          <Skeleton variant="text" width="40%" height={14} />
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ py: 2, width: "25%" }}>
                      <Skeleton variant="rounded" width={120} height={44} sx={{ borderRadius: "20px", margin: "0 auto" }} />
                    </TableCell>
                    <TableCell align="center" sx={{ py: 2, width: "25%" }}>
                      <Skeleton variant="rounded" width={120} height={44} sx={{ borderRadius: "20px", margin: "0 auto" }} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <>
                  {dataToRender.map((row) => {
                    const expState = expandedIds[row.id] || {};
                    const isExpanded = expState.isOpen;

                    return (
                      <React.Fragment key={row.id}>
                        <TableRow
                          sx={{
                            backgroundColor: row.isAll ? "rgba(248,250,252,0.8)" : "#fff",
                            "&:hover": { backgroundColor: "rgba(37,99,235,0.02)" },
                            transition: "background 0.15s ease",
                            borderBottom: "1px solid rgba(0,0,0,0.05)",
                          }}
                        >
                          <TableCell sx={{ py: 1.8, pl: 3.5, minWidth: 350, width: "50%" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                              {row.isAll && (
                                <Box
                                  sx={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: "8px",
                                    backgroundColor: "#f1f5f9",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Store size={16} color="#475569" />
                                </Box>
                              )}

                              <Box>
                                <Typography
                                  sx={{
                                    fontWeight: row.isAll ? 800 : 700,
                                    fontSize: "0.86rem",
                                    color: "#1e293b",
                                    fontFamily: "'Mulish', 'Roboto', sans-serif",
                                  }}
                                >
                                  {row.name}
                                </Typography>
                                {row.subtitle && (
                                  <Typography
                                    sx={{
                                      fontSize: "0.68rem",
                                      color: "#64748b",
                                      fontWeight: 500,
                                      fontFamily: "'Mulish', 'Roboto', sans-serif",
                                    }}
                                  >
                                    {row.subtitle}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>

                          {renderMetricCell(row.sales, "s")}
                          {renderMetricCell(row.units, "u")}
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {(() => {
          const totalRows = totalCount;
          if (totalRows <= 5) return null;
          return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
              <Button
                size="small"
                onClick={() => setShowAll((prev) => !prev)}
                startIcon={<ChevronDown size={15} style={{ transform: showAll ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />}
                sx={{
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  color: "#2563eb",
                  textTransform: "none",
                  borderRadius: "20px",
                  px: 3,
                  py: 0.7,
                  backgroundColor: "rgba(37,99,235,0.05)",
                  border: "1px solid rgba(37,99,235,0.15)",
                  fontFamily: "'Mulish', 'Roboto', sans-serif",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    backgroundColor: "rgba(37,99,235,0.12)",
                    borderColor: "rgba(37,99,235,0.35)",
                    boxShadow: "0 2px 8px rgba(37,99,235,0.12)",
                  },
                }}
              >
                {showAll ? "Show Less" : `Show More (${totalRows - 5} more)`}
              </Button>
            </Box>
          );
        })()}
      </Card>
    </Box>
  );
}
