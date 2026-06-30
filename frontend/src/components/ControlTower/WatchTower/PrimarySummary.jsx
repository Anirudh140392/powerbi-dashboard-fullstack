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
import { fetchPrimarySalesAll, fetchPrimaryFilterOptions } from "../../../api/primarySalesService";

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

  // Fetch filter options on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await fetchPrimaryFilterOptions();
        if (res.success && res.data) {
          setFilterOptions({
            brandName: ["All", ...res.data.brandName],
            retailerName: ["All", ...res.data.retailerName],
            product: ["All", ...res.data.product],
            division: ["All", ...res.data.division],
            zone: ["All", ...res.data.zone],
            xAxis: ["Retailer Name", "Brand Name", "Product", "Division", "Zone"],
          });
        }
      } catch (err) {
        console.error("Error loading filter options:", err);
      }
    };
    loadFilters();
  }, []);

  // Fetch primary sales data on filters, metricType, and xAxis changes
  useEffect(() => {
    const loadData = async () => {
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
        };
        const res = await fetchPrimarySalesAll(params);
        if (res.success && res.data) {
          setMomData(res.data.mom || []);
          setQuarterData(res.data.quarterly || []);
          setTableRows(res.data.pivotTable?.data || []);
          setMonthsHeaders(res.data.pivotTable?.months || []);
        } else {
          setError("Failed to load primary sales data");
        }
      } catch (err) {
        console.error("Error loading sales data:", err);
        setError("Error loading sales data from server");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [filters, metricType]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
