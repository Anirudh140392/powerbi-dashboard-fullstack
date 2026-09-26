import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Popover,
  TextField,
  InputAdornment,
  Skeleton,
} from "@mui/material";
import {
  Store,
  Search,
  CheckCircle2,
  Circle,
  ChevronDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { fetchPrimarySalesAll, fetchPrimaryRetailerDailyTrend } from "../../../api/primarySalesService";

// Palette of vibrant, harmonious colors for line series & menu dots
const RETAILER_COLORS = [
  "#0284c7", // Sky Blue
  "#16a34a", // Emerald Green
  "#dc2626", // Red
  "#9333ea", // Purple
  "#ea580c", // Amber / Orange
  "#2563eb", // Royal Blue
  "#06b6d4", // Cyan
  "#ec4899", // Pink
];

const formatShortVal = (val, isMRP) => {
  if (val === null || val === undefined || isNaN(val)) return "0";
  const num = Number(val);
  const prefix = isMRP ? "₹" : "";
  if (num >= 10000000) return `${prefix}${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `${prefix}${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `${prefix}${(num / 1000).toFixed(2)} K`;
  return `${prefix}${num.toLocaleString("en-IN")}`;
};

// Clean white card tooltip matching the user's reference image
const CustomWhiteTooltip = ({ active, payload, label, isMRP }) => {
  if (active && payload && payload.length) {
    return (
      <Box
        sx={{
          backgroundColor: "#ffffff",
          color: "#0f172a",
          p: 1.8,
          borderRadius: "12px",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)",
          minWidth: 200,
          border: "1px solid #e2e8f0",
        }}
      >
        <Typography
          sx={{
            fontSize: "0.85rem",
            fontWeight: 800,
            color: "#1e293b",
            mb: 1.2,
            pb: 0.8,
            borderBottom: "1px solid #f1f5f9",
            fontFamily: "'Mulish', 'Roboto', sans-serif",
          }}
        >
          {label}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {payload.map((entry, index) => (
            <Box
              key={index}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: entry.color,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  noWrap
                  sx={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#64748b",
                    fontFamily: "'Mulish', 'Roboto', sans-serif",
                  }}
                >
                  {entry.name.toLowerCase()}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: "0.80rem",
                  fontWeight: 800,
                  color: "#0f172a",
                  fontFamily: "'Mulish', 'Roboto', sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                {formatShortVal(entry.value, isMRP)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }
  return null;
};

export default function RetailerWiseAnalysis({
  filters = {},
  metricType = "MRP",
  monthsHeaders = [],
  allMonthsHeaders = [],
  tableRows = [],
  loading: parentLoading = false,
}) {
  const [dailyRawData, setDailyRawData] = useState([]);
  const [availableRetailers, setAvailableRetailers] = useState([]);
  const [selectedRetailers, setSelectedRetailers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Popover state for Multi-Select Retailer Filter
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isMRP = metricType === "MRP";

  // Color mapping per retailer name
  const colorMap = useMemo(() => {
    const map = {};
    availableRetailers.forEach((name, idx) => {
      map[name] = RETAILER_COLORS[idx % RETAILER_COLORS.length];
    });
    return map;
  }, [availableRetailers]);

  // Fetch daily trend data per retailer
  useEffect(() => {
    const loadDailyTrendData = async () => {
      setLoading(true);
      try {
        const res = await fetchPrimaryRetailerDailyTrend({
          ...filters,
          metricType,
        });

        if (res && res.success && Array.isArray(res.data)) {
          setDailyRawData(res.data);

          // Get unique retailers sorted by total volume
          const totals = {};
          res.data.forEach((item) => {
            if (item.retailer) {
              totals[item.retailer] = (totals[item.retailer] || 0) + (item.value || 0);
            }
          });

          const sortedRetailers = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
          setAvailableRetailers(sortedRetailers);

          if (sortedRetailers.length > 0 && selectedRetailers.length === 0) {
            setSelectedRetailers(sortedRetailers.slice(0, 5));
          }
        }
      } catch (err) {
        console.error("Error loading daily retailer trend:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDailyTrendData();
  }, [filters, metricType]);

  // Handle Popover Open/Close
  const handleOpenFilter = (e) => setAnchorEl(e.currentTarget);
  const handleCloseFilter = () => {
    setAnchorEl(null);
    setSearchQuery("");
  };
  const isOpen = Boolean(anchorEl);

  const filteredRetailerOptions = useMemo(() => {
    if (!searchQuery.trim()) return availableRetailers;
    const q = searchQuery.toLowerCase();
    return availableRetailers.filter((r) => r.toLowerCase().includes(q));
  }, [availableRetailers, searchQuery]);

  const isAllSelected =
    availableRetailers.length > 0 &&
    selectedRetailers.length === availableRetailers.length;

  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedRetailers(availableRetailers.slice(0, 1));
    } else {
      setSelectedRetailers([...availableRetailers]);
    }
  };

  const handleToggleRetailer = (name) => {
    if (selectedRetailers.includes(name)) {
      if (selectedRetailers.length === 1) return;
      setSelectedRetailers(selectedRetailers.filter((r) => r !== name));
    } else {
      setSelectedRetailers([...selectedRetailers, name]);
    }
  };

  // Format chart series data (daily dates vs selected retailers)
  const chartData = useMemo(() => {
    if (!dailyRawData.length || !selectedRetailers.length) return [];

    const dateMap = new Map();
    dailyRawData.forEach((row) => {
      if (!dateMap.has(row.date)) {
        dateMap.set(row.date, { date: row.date, dateVal: row.dateVal });
      }
      const point = dateMap.get(row.date);
      if (selectedRetailers.includes(row.retailer)) {
        point[row.retailer] = row.value;
      }
    });

    const list = Array.from(dateMap.values());
    list.sort((a, b) => (a.dateVal > b.dateVal ? 1 : -1));

    // Ensure all points have entry for selected retailers
    return list.map((point) => {
      selectedRetailers.forEach((ret) => {
        if (point[ret] === undefined) {
          point[ret] = 0;
        }
      });
      return point;
    });
  }, [dailyRawData, selectedRetailers]);

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
        border: "1px solid rgba(37,99,235,0.10)",
        backgroundColor: "#ffffff",
        mb: 3,
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* HEADER & FILTER CONTROLS */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
            mb: 3,
            pb: 2,
            borderBottom: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                backgroundColor: "#2563eb",
                boxShadow: "0 3px 10px rgba(37,99,235,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Store size={18} color="#ffffff" />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: "1.05rem",
                  color: "#1e293b",
                  fontFamily: "'Mulish', 'Roboto', sans-serif",
                }}
              >
                Retailer Wise Analysis
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#64748b",
                  fontFamily: "'Mulish', 'Roboto', sans-serif",
                }}
              >
                Daily sales performance comparison across retailers
              </Typography>
            </Box>
          </Box>

          {/* MULTI-SELECT RETAILER FILTER BUTTON (Matching Image 2) */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Button
              onClick={handleOpenFilter}
              variant="outlined"
              endIcon={<ChevronDown size={16} />}
              sx={{
                height: 36,
                px: 2,
                borderRadius: "18px",
                borderColor: "#cbd5e1",
                color: "#1e293b",
                backgroundColor: "#f8fafc",
                fontSize: "0.82rem",
                fontWeight: 700,
                textTransform: "none",
                fontFamily: "'Mulish', 'Roboto', sans-serif",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                "&:hover": {
                  backgroundColor: "#ffffff",
                  borderColor: "#2563eb",
                  color: "#2563eb",
                },
              }}
            >
              {selectedRetailers.length === availableRetailers.length && availableRetailers.length > 0
                ? "All Retailers Selected"
                : `Retailers (${selectedRetailers.length})`}
            </Button>

            {/* POPOVER MENU MATCHING IMAGE 2 */}
            <Popover
              open={isOpen}
              anchorEl={anchorEl}
              onClose={handleCloseFilter}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              PaperProps={{
                sx: {
                  width: 260,
                  maxHeight: 360,
                  borderRadius: "16px",
                  p: 1.5,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  backgroundColor: "#ffffff",
                },
              }}
            >
              <TextField
                size="small"
                fullWidth
                placeholder="Search Retailers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={14} color="#94a3b8" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 1.2,
                  "& .MuiOutlinedInput-root": {
                    height: 34,
                    fontSize: "0.78rem",
                    borderRadius: "12px",
                    backgroundColor: "#f8fafc",
                    "& fieldset": { borderColor: "#e2e8f0" },
                    "&:hover fieldset": { borderColor: "#2563eb" },
                  },
                }}
              />

              <Box sx={{ overflowY: "auto", maxHeight: 270, pr: 0.5 }}>
                <Box
                  onClick={handleToggleAll}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 1,
                    px: 1.5,
                    borderRadius: "10px",
                    cursor: "pointer",
                    backgroundColor: isAllSelected ? "rgba(37,99,235,0.08)" : "transparent",
                    transition: "all 0.15s ease",
                    mb: 0.5,
                    "&:hover": {
                      backgroundColor: "rgba(37,99,235,0.08)",
                    },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: "#2563eb",
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: "0.84rem",
                        fontWeight: 800,
                        color: "#1e293b",
                        fontFamily: "'Mulish', 'Roboto', sans-serif",
                      }}
                    >
                      All
                    </Typography>
                  </Box>
                  {isAllSelected ? (
                    <CheckCircle2 size={18} color="#2563eb" />
                  ) : (
                    <Circle size={18} color="#cbd5e1" />
                  )}
                </Box>

                {filteredRetailerOptions.map((name) => {
                  const isSelected = selectedRetailers.includes(name);
                  const color = colorMap[name] || "#2563eb";
                  return (
                    <Box
                      key={name}
                      onClick={() => handleToggleRetailer(name)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 0.9,
                        px: 1.5,
                        borderRadius: "10px",
                        cursor: "pointer",
                        backgroundColor: isSelected ? "rgba(37,99,235,0.05)" : "transparent",
                        transition: "all 0.15s ease",
                        mb: 0.3,
                        "&:hover": {
                          backgroundColor: "rgba(37,99,235,0.06)",
                        },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: color,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          noWrap
                          sx={{
                            fontSize: "0.82rem",
                            fontWeight: isSelected ? 700 : 500,
                            color: "#1e293b",
                            fontFamily: "'Mulish', 'Roboto', sans-serif",
                          }}
                        >
                          {name}
                        </Typography>
                      </Box>
                      {isSelected ? (
                        <CheckCircle2 size={18} color="#2563eb" />
                      ) : (
                        <Circle size={18} color="#cbd5e1" />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Popover>
          </Box>
        </Box>

        {/* SMOOTH MULTI-POINT CURVED LINE CHART MATCHING REFERENCE IMAGE */}
        {loading || parentLoading ? (
          <Box sx={{ py: 6, display: "flex", flexDirection: "column", gap: 2 }}>
            <Skeleton variant="rounded" width="100%" height={300} sx={{ borderRadius: 3 }} />
          </Box>
        ) : chartData.length > 0 && selectedRetailers.length > 0 ? (
          <Box sx={{ width: "100%" }}>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                  dy={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                  tickFormatter={(val) => formatShortVal(val, isMRP)}
                />
                <RechartsTooltip
                  content={<CustomWhiteTooltip isMRP={isMRP} />}
                  cursor={{ stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                {selectedRetailers.map((retName) => {
                  const color = colorMap[retName] || "#2563eb";
                  return (
                    <Line
                      key={retName}
                      type="monotone"
                      dataKey={retName}
                      name={retName}
                      stroke={color}
                      strokeWidth={2.6}
                      dot={{ r: 3.5, fill: color, stroke: "#ffffff", strokeWidth: 1.5 }}
                      activeDot={{ r: 6, fill: color, stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>

            {/* BOTTOM LEGEND PILLS */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1.2,
                mt: 2,
                pt: 2,
                borderTop: "1px dashed #e2e8f0",
              }}
            >
              {selectedRetailers.map((retName) => {
                const color = colorMap[retName] || "#2563eb";
                return (
                  <Box
                    key={retName}
                    onClick={() => handleToggleRetailer(retName)}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.8,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: "16px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      "&:hover": {
                        backgroundColor: "#f1f5f9",
                        borderColor: color,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: color,
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        color: "#334155",
                        fontFamily: "'Mulish', 'Roboto', sans-serif",
                      }}
                    >
                      {retName.toLowerCase()}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8" }}>
              No retailer data available for the selected period
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
