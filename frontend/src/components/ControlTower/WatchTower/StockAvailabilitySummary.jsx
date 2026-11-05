import React, { useState, useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Tooltip,
} from "@mui/material";
import { Send, Download, Filter } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
} from "recharts";

// Donut chart mock data & colors
const channelOsaData = [
  { name: "Apollo 247", value: 99.07, color: "#1e293b" },
  { name: "1MG", value: 97.47, color: "#c026d3" },
  { name: "Nykaa", value: 94.26, color: "#e11d48" },
  { name: "Amazon", value: 90.12, color: "#3b82f6" },
  { name: "Pharmeasy", value: 86.43, color: "#059669" },
  { name: "Myntra", value: 84.13, color: "#eab308" },
  { name: "Truemeds", value: 78.12, color: "#9333ea" },
  { name: "Flipkart", value: 50.27, color: "#2563eb" },
];

const lowestCategories = [
  { name: "Bathing Essentials", val: "0.00%" },
  { name: "Hair Regrowth Tr...", val: "0.00%" },
  { name: "Hair Serums", val: "0.00%" },
  { name: "Mass & Weight G...", val: "0.00%" },
  { name: "Soaps", val: "0.00%" },
];

const cityOsaData = [
  { city: "Delhi", val: 82.38, color: "#eab308" },
  { city: "Bangalore", val: 81.66, color: "#7e22ce" },
  { city: "Mumbai", val: 81.29, color: "#06b6d4" },
  { city: "Kolkata", val: 80.73, color: "#475569" },
];

const dateHeaders = [
  "17-10-25",
  "16-10-25",
  "15-10-25",
  "14-10-25",
  "13-10-25",
  "12-10-25",
  "11-10-25",
  "10-10-25",
  "09-10-25",
  "08-10-25",
  "07-10-25",
  "06-10-25",
  "05-10-25",
];

const stockTableRows = [
  {
    category: "Amazon Pharmacy",
    values: {
      "17-10-25": "90.00%",
      "16-10-25": "",
      "15-10-25": "91.67%",
      "14-10-25": "91.49%",
      "13-10-25": "90.91%",
      "12-10-25": "90.91%",
      "11-10-25": "100.00%",
      "10-10-25": "100.00%",
      "09-10-25": "100.00%",
      "08-10-25": "100.00%",
      "07-10-25": "100.00%",
      "06-10-25": "100.00%",
      "05-10-25": "100.00%",
    },
  },
  {
    category: "Baby Care",
    values: {
      "17-10-25": "100.00%",
      "16-10-25": "",
      "15-10-25": "100.00%",
      "14-10-25": "100.00%",
      "13-10-25": "100.00%",
      "12-10-25": "100.00%",
      "11-10-25": "100.00%",
      "10-10-25": "100.00%",
      "09-10-25": "100.00%",
      "08-10-25": "100.00%",
      "07-10-25": "100.00%",
      "06-10-25": "100.00%",
      "05-10-25": "100.00%",
    },
  },
  {
    category: "Baby Creams & Ointments",
    values: {
      "17-10-25": "100.00%",
      "16-10-25": "",
      "15-10-25": "100.00%",
      "14-10-25": "100.00%",
      "13-10-25": "100.00%",
      "12-10-25": "100.00%",
      "11-10-25": "100.00%",
      "10-10-25": "100.00%",
      "09-10-25": "",
      "08-10-25": "",
      "07-10-25": "",
      "06-10-25": "",
      "05-10-25": "",
    },
  },
  {
    category: "Babycaresupply",
    values: {
      "17-10-25": "100.00%",
      "16-10-25": "100.00%",
      "15-10-25": "88.89%",
      "14-10-25": "88.89%",
      "13-10-25": "88.89%",
      "12-10-25": "100.00%",
      "11-10-25": "100.00%",
      "10-10-25": "100.00%",
      "09-10-25": "100.00%",
      "08-10-25": "100.00%",
      "07-10-25": "100.00%",
      "06-10-25": "100.00%",
      "05-10-25": "100.00%",
    },
  },
  {
    category: "Bathing Essentials",
    values: {
      "17-10-25": "",
      "16-10-25": "",
      "15-10-25": "",
      "14-10-25": "",
      "13-10-25": "",
      "12-10-25": "0.00%",
      "11-10-25": "0.00%",
      "10-10-25": "0.00%",
      "09-10-25": "",
      "08-10-25": "",
      "07-10-25": "",
      "06-10-25": "",
      "05-10-25": "",
    },
  },
  {
    category: "Body Care",
    values: {
      "17-10-25": "85.71%",
      "16-10-25": "",
      "15-10-25": "85.71%",
      "14-10-25": "78.57%",
      "13-10-25": "85.71%",
      "12-10-25": "85.71%",
      "11-10-25": "85.71%",
      "10-10-25": "85.71%",
      "09-10-25": "",
      "08-10-25": "",
      "07-10-25": "",
      "06-10-25": "",
      "05-10-25": "",
    },
  },
  {
    category: "Body Creams",
    values: {
      "17-10-25": "100.00%",
      "16-10-25": "",
      "15-10-25": "100.00%",
      "14-10-25": "100.00%",
      "13-10-25": "100.00%",
      "12-10-25": "100.00%",
      "11-10-25": "100.00%",
      "10-10-25": "100.00%",
      "09-10-25": "100.00%",
      "08-10-25": "100.00%",
      "07-10-25": "100.00%",
      "06-10-25": "100.00%",
      "05-10-25": "100.00%",
    },
  },
  {
    category: "Body Lotions",
    values: {
      "17-10-25": "100.00%",
      "16-10-25": "",
      "15-10-25": "96.85%",
      "14-10-25": "96.85%",
      "13-10-25": "100.00%",
      "12-10-25": "100.00%",
      "11-10-25": "100.00%",
      "10-10-25": "100.00%",
      "09-10-25": "100.00%",
      "08-10-25": "100.00%",
      "07-10-25": "100.00%",
      "06-10-25": "100.00%",
      "05-10-25": "100.00%",
    },
  },
  {
    category: "Body Lotions & Moisturizers",
    values: {
      "17-10-25": "100.00%",
      "16-10-25": "100.00%",
      "15-10-25": "100.00%",
      "14-10-25": "100.00%",
      "13-10-25": "100.00%",
      "12-10-25": "100.00%",
      "11-10-25": "100.00%",
      "10-10-25": "100.00%",
      "09-10-25": "100.00%",
      "08-10-25": "100.00%",
      "07-10-25": "100.00%",
      "06-10-25": "100.00%",
      "05-10-25": "100.00%",
    },
  },
  {
    category: "Combos @ Nykaa",
    values: {
      "17-10-25": "100.00%",
      "16-10-25": "100.00%",
      "15-10-25": "100.00%",
      "14-10-25": "100.00%",
      "13-10-25": "100.00%",
      "12-10-25": "100.00%",
      "11-10-25": "100.00%",
      "10-10-25": "100.00%",
      "09-10-25": "100.00%",
      "08-10-25": "100.00%",
      "07-10-25": "100.00%",
      "06-10-25": "100.00%",
      "05-10-25": "100.00%",
    },
  },
  {
    category: "Dental Care",
    values: {
      "17-10-25": "",
      "16-10-25": "",
      "15-10-25": "",
      "14-10-25": "",
      "13-10-25": "",
      "12-10-25": "",
      "11-10-25": "",
      "10-10-25": "",
      "09-10-25": "0.00%",
      "08-10-25": "0.00%",
      "07-10-25": "0.00%",
      "06-10-25": "0.00%",
      "05-10-25": "0.00%",
    },
  },
];

export default function StockAvailabilitySummary() {
  const [filters, setFilters] = useState({
    platform: "All",
    seller: "All",
    brand: "All",
    city: "All",
    category: "All",
    product: "All",
    startDate: "2025-10-01",
    endDate: "2025-10-17",
    year: "All",
    month: "All",
    xAxis: "All",
  });

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Box sx={{ mt: 4, width: "100%" }}>
      {/* TOP FILTERS ROW */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          border: "1px solid #f1f5f9",
          mb: 3,
          backgroundColor: "#fff",
        }}
      >
        <CardContent sx={{ p: "12px 16px !important" }}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "nowrap",
              gap: 1,
              alignItems: "flex-end",
              overflowX: "auto",
              pb: 0.5,
              width: "100%",
              "&::-webkit-scrollbar": { height: 4 },
              "&::-webkit-scrollbar-thumb": { backgroundColor: "#cbd5e1", borderRadius: 2 }
            }}
          >
            {[
              { key: "platform", label: "PLATFORM:" },
              { key: "seller", label: "SELLER:" },
              { key: "brand", label: "BRAND:" },
              { key: "city", label: "CITY:" },
              { key: "category", label: "CATEGORY:" },
              { key: "product", label: "PRODUCT:" },
            ].map((f) => (
              <Box key={f.key} sx={{ display: "flex", flexDirection: "column", gap: 0.5, flex: "1 1 0px", minWidth: 80 }}>
                <Typography
                  sx={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    color: "#94a3b8",
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap"
                  }}
                >
                  {f.label}
                </Typography>
                <Select
                  size="small"
                  value={filters[f.key]}
                  onChange={(e) => handleFilterChange(f.key, e.target.value)}
                  sx={{
                    height: 32,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "#334155",
                    backgroundColor: "#f8fafc",
                    borderRadius: "6px",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e2e8f0" },
                  }}
                >
                  <MenuItem value="All" sx={{ fontSize: "0.75rem" }}>
                    All
                  </MenuItem>
                </Select>
              </Box>
            ))}

            {/* DATE RANGE */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, flex: "1.8 1 0px", minWidth: 170 }}>
              <Typography
                sx={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  color: "#94a3b8",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap"
                }}
              >
                DATE:
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                <TextField
                  type="date"
                  size="small"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  sx={{
                    flex: 1,
                    "& .MuiInputBase-root": { height: 32, fontSize: "0.65rem", px: 0.5 },
                    backgroundColor: "#f8fafc",
                    borderRadius: "6px",
                  }}
                />
                <TextField
                  type="date"
                  size="small"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  sx={{
                    flex: 1,
                    "& .MuiInputBase-root": { height: 32, fontSize: "0.65rem", px: 0.5 },
                    backgroundColor: "#f8fafc",
                    borderRadius: "6px",
                  }}
                />
              </Box>
            </Box>

            {/* YEAR, MONTH, X-AXIS */}
            {[
              { key: "year", label: "YEAR:" },
              { key: "month", label: "MONTH:" },
              { key: "xAxis", label: "X-AXIS:" },
            ].map((f) => (
              <Box key={f.key} sx={{ display: "flex", flexDirection: "column", gap: 0.5, flex: "1 1 0px", minWidth: 80 }}>
                <Typography
                  sx={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    color: "#94a3b8",
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap"
                  }}
                >
                  {f.label}
                </Typography>
                <Select
                  size="small"
                  value={filters[f.key]}
                  onChange={(e) => handleFilterChange(f.key, e.target.value)}
                  sx={{
                    height: 32,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "#334155",
                    backgroundColor: "#f8fafc",
                    borderRadius: "6px",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e2e8f0" },
                  }}
                >
                  <MenuItem value="All" sx={{ fontSize: "0.75rem" }}>
                    All
                  </MenuItem>
                </Select>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* TOP 3 CHARTS ROW */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 3,
          mb: 3,
        }}
      >
        {/* CARD 1: CHANNEL WISE OSA% */}
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            border: "1px solid #f1f5f9",
            backgroundColor: "#fff",
            position: "relative",
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#1e293b", letterSpacing: "0.03em" }}>
                CHANNEL WISE OSA%
              </Typography>
              <IconButton size="small" sx={{ color: "#64748b" }}>
                <Send size={15} />
              </IconButton>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", position: "relative", height: 200 }}>
              {/* Donut Chart */}
              <Box sx={{ width: "55%", height: "100%", position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelOsaData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={68}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {channelOsaData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center text */}
                <Box
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                  }}
                >
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: "#1e293b" }}>
                    81.53%
                  </Typography>
                </Box>
              </Box>

              {/* Legend List */}
              <Box sx={{ width: "45%", pl: 1, overflowY: "auto", maxHeight: 180 }}>
                {channelOsaData.map((item) => (
                  <Box key={item.name} sx={{ display: "flex", alignItems: "center", gap: 0.8, mb: 0.5 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: item.color,
                        flexShrink: 0,
                      }}
                    />
                    <Typography sx={{ fontSize: "0.68rem", fontWeight: 600, color: "#475569" }}>
                      {item.name}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* CARD 2: TOP 5 CATEGORY WITH LOWEST STOCK AVAILABILITY% */}
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            border: "1px solid #f1f5f9",
            backgroundColor: "#fff",
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#1e293b", letterSpacing: "0.03em" }}>
                TOP 5 CATEGORY WITH LOWEST STOCK AVAILABILITY%
              </Typography>
              <IconButton size="small" sx={{ color: "#64748b" }}>
                <Send size={15} />
              </IconButton>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              {lowestCategories.map((item) => (
                <Box
                  key={item.name}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                    {item.name}
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#1e293b" }}>
                    {item.val}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* CARD 3: CITY WISE STOCK AVAILABILITY% */}
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            border: "1px solid #f1f5f9",
            backgroundColor: "#fff",
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#1e293b", letterSpacing: "0.03em" }}>
                CITY WISE STOCK AVAILABILITY%
              </Typography>
              <IconButton size="small" sx={{ color: "#64748b" }}>
                <Send size={15} />
              </IconButton>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.8, pt: 1 }}>
              {cityOsaData.map((item) => (
                <Box key={item.city} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography
                    sx={{
                      width: 75,
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "#475569",
                      textAlign: "right",
                    }}
                  >
                    {item.city}
                  </Typography>

                  <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        height: 22,
                        width: `${item.val}%`,
                        backgroundColor: item.color,
                        borderRadius: "2px",
                        transition: "width 0.5s ease",
                      }}
                    />
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#1e293b" }}>
                      {item.val}%
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* BOTTOM TABLE: STOCK AVAILABILITY BY DATE */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          border: "1px solid #f1f5f9",
          backgroundColor: "#fff",
          overflow: "hidden",
        }}
      >
        <CardContent sx={{ p: 0 }}>
          <Box
            sx={{
              px: 3,
              py: 2,
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.85rem",
                fontWeight: 800,
                color: "#1e293b",
                letterSpacing: "0.04em",
              }}
            >
              STOCK AVAILABILITY BY DATE
            </Typography>
          </Box>

          <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 450 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      backgroundColor: "#fff",
                      color: "#c026d3", // Magenta/purple title
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      py: 1.5,
                      px: 2.5,
                      borderBottom: "1px solid #e2e8f0",
                      minWidth: 220,
                    }}
                  >
                    Category Name
                  </TableCell>
                  {dateHeaders.map((date) => (
                    <TableCell
                      key={date}
                      align="center"
                      sx={{
                        backgroundColor: "#fff",
                        color: "#c026d3", // Magenta/purple date headers
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        py: 1.5,
                        px: 1.5,
                        borderBottom: "1px solid #e2e8f0",
                        minWidth: 90,
                      }}
                    >
                      {date}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {stockTableRows.map((row, idx) => (
                  <TableRow
                    key={idx}
                    sx={{
                      "&:hover": { backgroundColor: "#f8fafc" },
                    }}
                  >
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        color: "#0f172a",
                        py: 1.2,
                        px: 2.5,
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      {row.category}
                    </TableCell>
                    {dateHeaders.map((date) => {
                      const val = row.values[date];
                      return (
                        <TableCell
                          key={date}
                          align="center"
                          sx={{
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            color: "#1e293b",
                            py: 1.2,
                            px: 1.5,
                            borderBottom: "1px solid #f1f5f9",
                          }}
                        >
                          {val || ""}
                        </TableCell>
                      );
                    })}
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
