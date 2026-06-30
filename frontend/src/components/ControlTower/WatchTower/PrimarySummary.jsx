import React, { useState, useEffect } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import { Download, Check, AlertCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts";

// Helper to format values for display
const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return "-";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(val);
};

const formatShortValue = (val, isMRP) => {
  if (val === null || val === undefined || isNaN(val)) return "-";
  const prefix = isMRP ? "₹" : "";
  if (val >= 10000000) {
    return `${prefix}${(val / 10000000).toFixed(2)}Cr`;
  }
  if (val >= 100000) {
    return `${prefix}${(val / 100000).toFixed(2)}L`;
  }
  if (val >= 1000) {
    return `${prefix}${(val / 1000).toFixed(2)}K`;
  }
  return `${prefix}${val}`;
};

export default function PrimarySummary() {
  const [metricType, setMetricType] = useState("Units"); // "Units" | "MRP"
  const [loading, setLoading] = useState(false);

  // Filter States
  const [filters, setFilters] = useState({
    brandName: "All",
    retailerName: "All",
    product: "All",
    division: "All",
    zone: "All",
    xAxis: "Retailer Name",
  });

  // Simulated state change to add premium feel
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 400000 / 1000000); // 400ms loading simulation
    return () => clearTimeout(timer);
  };

  const handleMetricChange = (event, newMetric) => {
    if (newMetric !== null) {
      setMetricType(newMetric);
      setLoading(true);
      const timer = setTimeout(() => {
        setLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  };

  // Mock Dropdown Options
  const filterOptions = {
    brandName: ["All", "Dettol", "Lysol", "Harpic", "Vanish", "Strepsils"],
    retailerName: [
      "All",
      "Amazon Retail",
      "Counfreedise Retail",
      "Ean Enterprises",
      "Hasmukh Agency",
      "Katalysst Cpg",
      "Nykaa E-Retail",
      "Rk Worldinfocom",
    ],
    product: [
      "All",
      "Dettol Handwash 200ml",
      "Lysol Cleaner 1L",
      "Harpic Liquid 750ml",
      "Vanish Powder 400g",
    ],
    division: ["All", "Health Care", "Home Care", "Personal Care"],
    zone: ["All", "North", "South", "East", "West"],
    xAxis: ["Retailer Name", "Brand Name", "Product", "Division", "Zone"],
  };

  // Chart data based on Metric Type & filters
  const getMomChartData = () => {
    const isMRP = metricType === "MRP";
    const multiplier = isMRP ? 85000 : 850;

    return [
      { month: "Dec-23", value: Math.round(75.99 * multiplier) },
      { month: "Jan-24", value: Math.round(19.19 * multiplier) },
      { month: "Feb-24", value: Math.round(27.81 * multiplier) },
      { month: "Mar-24", value: Math.round(73.4 * multiplier) },
      { month: "Apr-24", value: Math.round(1050 * multiplier) },
      { month: "May-24", value: Math.round(1150 * multiplier) },
      { month: "Jun-24", value: Math.round(850 * multiplier) },
      { month: "Jul-24", value: Math.round(920 * multiplier) },
      { month: "Aug-24", value: Math.round(1100 * multiplier) },
      { month: "Sep-24", value: Math.round(1250 * multiplier) },
      { month: "Oct-24", value: Math.round(1080 * multiplier) },
      { month: "Nov-24", value: Math.round(1180 * multiplier) },
      { month: "Dec-24", value: Math.round(1320 * multiplier) },
      { month: "Jan-25", value: Math.round(950 * multiplier) },
      { month: "Feb-25", value: Math.round(1020 * multiplier) },
      { month: "Mar-25", value: Math.round(1120 * multiplier) },
      { month: "Apr-25", value: Math.round(1280 * multiplier) },
      { month: "May-25", value: Math.round(1350 * multiplier) },
      { month: "Jun-25", value: Math.round(1420 * multiplier) },
      { month: "Jul-25", value: Math.round(1380 * multiplier) },
      { month: "Aug-25", value: Math.round(1450 * multiplier) },
    ];
  };

  const getQuarterChartData = () => {
    const isMRP = metricType === "MRP";
    const multiplier = isMRP ? 85000 : 850;

    return [
      { quarter: "Q3 2022", value: Math.round(19.19 * multiplier) },
      { quarter: "Q4 2022", value: Math.round(1680 * multiplier) },
      { quarter: "Q1 2023", value: Math.round(2610 * multiplier) },
      { quarter: "Q2 2023", value: Math.round(4100 * multiplier) },
      { quarter: "Q3 2023", value: Math.round(5120 * multiplier) },
      { quarter: "Q4 2023", value: Math.round(6850 * multiplier) },
      { quarter: "Q1 2024", value: Math.round(8200 * multiplier) },
      { quarter: "Q2 2024", value: Math.round(9500 * multiplier) },
      { quarter: "Q3 2024", value: Math.round(10800 * multiplier) },
      { quarter: "Q4 2024", value: Math.round(12100 * multiplier) },
      { quarter: "Q1 2025", value: Math.round(11500 * multiplier) },
    ];
  };

  // Table columns & rows based on X-Axis choice
  const monthsHeaders = [
    "DEC-22",
    "JAN-23",
    "FEB-23",
    "MAR-23",
    "APR-23",
    "MAY-23",
    "JUN-23",
    "JUL-23",
    "AUG-23",
    "SEP-23",
    "OCT-23",
    "NOV-23",
    "DEC-23",
  ];

  const getTableRows = () => {
    const isMRP = metricType === "MRP";
    const valMultiplier = isMRP ? 1 : 0.01;

    let items = [];
    if (filters.xAxis === "Retailer Name") {
      items = [
        "Amazon Retail India Pvt Limited",
        "Counfreedise Retail Services L",
        "Ean Enterprises",
        "Hasmukh Agency",
        "Katalysst Cpg Consultants Llp",
        "Nykaa E-Retail Limited",
        "Rk Worldinfocom Private Limited",
      ];
    } else if (filters.xAxis === "Brand Name") {
      items = ["Dettol", "Lysol", "Harpic", "Vanish", "Strepsils"];
    } else if (filters.xAxis === "Product") {
      items = [
        "Dettol Handwash 200ml",
        "Lysol Cleaner 1L",
        "Harpic Liquid 750ml",
        "Vanish Powder 400g",
      ];
    } else if (filters.xAxis === "Division") {
      items = ["Health Care", "Home Care", "Personal Care"];
    } else {
      items = ["North", "South", "East", "West"];
    }

    // Generate random but deterministic seed values matching the screenshot aesthetics
    return items.map((name, idx) => {
      const rowData = { name };
      monthsHeaders.forEach((month, mIdx) => {
        // Deterministic mock values
        const base = (idx + 1) * 350000 + (mIdx + 1) * 85000;
        const seed = Math.sin(idx * 7 + mIdx * 13);
        const finalVal = Math.round((base + seed * 150000) * valMultiplier);

        // Add some empty values to look real
        if ((idx + mIdx) % 7 === 5 && idx > 0) {
          rowData[month] = null;
        } else {
          rowData[month] = finalVal;
        }
      });
      return rowData;
    });
  };

  const handleDownload = () => {
    const rows = getTableRows();
    const headers = [filters.xAxis, ...monthsHeaders];
    let csvContent = headers.join(",") + "\n";

    rows.forEach((row) => {
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

  const momData = getMomChartData();
  const quarterData = getQuarterChartData();
  const tableRows = getTableRows();

  return (
    <Box sx={{ mt: 4, width: "100%" }}>
      {/* SECTION HEADER */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e2e8f0",
          pb: 1.5,
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {/* Thick blue bar marker */}
          <Box
            sx={{
              width: 5,
              height: 24,
              backgroundColor: "#2563eb",
              borderRadius: 1,
            }}
          />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              color: "#1e293b",
              letterSpacing: "0.05em",
              fontFamily: "Roboto, sans-serif",
            }}
          >
            PRIMARY SUMMARY
          </Typography>
        </Box>

        {/* Toggle Button Group for Units & MRP + Download */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <ToggleButtonGroup
            value={metricType}
            exclusive
            onChange={handleMetricChange}
            size="small"
            sx={{
              backgroundColor: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              border: "none",
              "& .MuiToggleButtonGroup-grouped": {
                border: "none",
                borderRadius: "6px !important",
                px: 2.5,
                py: 0.6,
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.8rem",
                color: "#64748b",
                "&.Mui-selected": {
                  backgroundColor: "#2563eb",
                  color: "#fff",
                  boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
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

          <Tooltip title="Download CSV Data" arrow>
            <IconButton
              onClick={handleDownload}
              sx={{
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                backgroundColor: "#fff",
                color: "#ea580c",
                width: 34,
                height: 34,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                "&:hover": {
                  backgroundColor: "#fff7ed",
                  borderColor: "#f97316",
                },
              }}
            >
              <Download size={17} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* FILTER ROW */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
          border: "1px solid #f1f5f9",
          mb: 3,
          backgroundColor: "#fff",
        }}
      >
        <CardContent sx={{ p: "16px !important" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, 1fr)",
                sm: "repeat(3, 1fr)",
                md: "repeat(6, 1fr)",
              },
              gap: 2,
            }}
          >
            {Object.keys(filterOptions).map((key) => {
              const label = key
                .replace(/([A-Z])/g, " $1")
                .trim()
                .toUpperCase();
              return (
                <Box key={key} sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
                  <Typography
                    sx={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {label}
                  </Typography>
                  <Select
                    size="small"
                    value={filters[key]}
                    onChange={(e) => handleFilterChange(key, e.target.value)}
                    sx={{
                      height: 36,
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      color: "#334155",
                      backgroundColor: "#f8fafc",
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
                    {filterOptions[key].map((opt) => (
                      <MenuItem key={opt} value={opt} sx={{ fontSize: "0.8rem" }}>
                        {opt}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* CHARTS ROW */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 3,
          mb: 3,
        }}
      >
        {/* Left: PRIMARY MOM Chart */}
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            border: "1px solid #f1f5f9",
            backgroundColor: "#fff",
            position: "relative",
          }}
        >
          {loading && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(255,255,255,0.7)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 10,
                borderRadius: 3,
              }}
            >
              <CircularProgress size={30} sx={{ color: "#2563eb" }} />
            </Box>
          )}
          <CardContent sx={{ p: 3.5 }}>
            <Typography
              sx={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#475569",
                mb: 3,
                letterSpacing: "0.03em",
              }}
            >
              PRIMARY MOM
            </Typography>

            <Box sx={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={momData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val) => formatShortValue(val, metricType === "MRP")}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip
                    formatter={(val) => [
                      formatShortValue(val, metricType === "MRP"),
                      metricType,
                    ]}
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      borderRadius: "6px",
                      color: "#fff",
                      border: "none",
                      fontSize: "0.75rem",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="#a78bfa" // premium violet/purple
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Right: QUARTER WISE PRIMARY DATA */}
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            border: "1px solid #f1f5f9",
            backgroundColor: "#fff",
            position: "relative",
          }}
        >
          {loading && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(255,255,255,0.7)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 10,
                borderRadius: 3,
              }}
            >
              <CircularProgress size={30} sx={{ color: "#2563eb" }} />
            </Box>
          )}
          <CardContent sx={{ p: 3.5 }}>
            <Typography
              sx={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#475569",
                mb: 3,
                letterSpacing: "0.03em",
              }}
            >
              QUARTER WISE PRIMARY DATA
            </Typography>

            <Box sx={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={quarterData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val) => formatShortValue(val, metricType === "MRP")}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip
                    formatter={(val) => [
                      formatShortValue(val, metricType === "MRP"),
                      metricType,
                    ]}
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      borderRadius: "6px",
                      color: "#fff",
                      border: "none",
                      fontSize: "0.75rem",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="#3b82f6" // premium indigo/blue
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* BOTTOM TABLE */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          border: "1px solid #f1f5f9",
          backgroundColor: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {loading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(255,255,255,0.7)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 10,
            }}
          >
            <CircularProgress size={30} sx={{ color: "#2563eb" }} />
          </Box>
        )}
        <CardContent sx={{ p: 0 }}>
          {/* Table Header Area */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 3.5,
              py: 2.5,
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            {/* Green bullet dot */}
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#10b981",
              }}
            />
            <Typography
              sx={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#475569",
                letterSpacing: "0.03em",
              }}
            >
              BRAND WISE PRIMARY
            </Typography>
          </Box>

          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              borderRadius: 0,
              backgroundColor: "transparent",
              maxHeight: 450,
              "&::-webkit-scrollbar": {
                width: "6px",
                height: "6px",
              },
              "&::-webkit-scrollbar-track": {
                background: "rgba(0,0,0,0.02)",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "rgba(0,0,0,0.1)",
                borderRadius: "10px",
              },
              "&::-webkit-scrollbar-thumb:hover": {
                background: "rgba(0,0,0,0.2)",
              },
            }}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      backgroundColor: "#f8fafc",
                      color: "#475569",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      py: 1.5,
                      borderBottom: "1px solid #e2e8f0",
                      minWidth: 200,
                    }}
                  >
                    {filters.xAxis.toUpperCase()}
                  </TableCell>
                  {monthsHeaders.map((month) => (
                    <TableCell
                      key={month}
                      align="right"
                      sx={{
                        backgroundColor: "#f8fafc",
                        color: "#475569",
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        py: 1.5,
                        borderBottom: "1px solid #e2e8f0",
                        minWidth: 100,
                      }}
                    >
                      {month}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((row, idx) => (
                  <TableRow
                    key={idx}
                    sx={{
                      "&:hover": {
                        backgroundColor: "#f8fafc",
                      },
                    }}
                  >
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        color: "#334155",
                        py: 1.5,
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      {row.name}
                    </TableCell>
                    {monthsHeaders.map((month) => (
                      <TableCell
                        key={month}
                        align="right"
                        sx={{
                          fontSize: "0.75rem",
                          color: row[month] === null ? "#94a3b8" : "#334155",
                          fontWeight: row[month] === null ? 400 : 500,
                          py: 1.5,
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        {row[month] === null
                          ? "-"
                          : formatCurrency(row[month])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
