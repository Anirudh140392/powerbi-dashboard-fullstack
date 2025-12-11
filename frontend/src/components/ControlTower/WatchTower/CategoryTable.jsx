import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Card,
  Typography,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  TextField,
  Button,
} from "@mui/material";
import TableChartIcon from "@mui/icons-material/TableChart";
import { Download } from "lucide-react";
import axiosInstance from "../../../api/axiosInstance";

export default function CategoryTable({
  categories,
  activeTab = "",
  selectedMetric: externalSelectedMetric,
  onMetricChange,
  loading = false
}) {
  const platforms = Object.keys(categories[0] || {}).filter((k) => k !== "name");
  const [searchTerm, setSearchTerm] = useState("");
  const [metricsFromDB, setMetricsFromDB] = useState([]);
  const [selectedMetricKey, setSelectedMetricKey] = useState(externalSelectedMetric || "");

  // Fetch metrics from database
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await axiosInstance.get("/watchtower/metrics");
        if (response.data && response.data.length > 0) {
          setMetricsFromDB(response.data);
          // Set first metric as default
          setSelectedMetricKey(response.data[0]);
        }
      } catch (error) {
        console.error("Error fetching metrics from database:", error);
      }
    };
    fetchMetrics();
  }, []);

  // Fallback to data-derived metrics if DB metrics not loaded
  const allMetricKeys = useMemo(() => {
    const set = new Set();
    categories.forEach((cat) => {
      platforms.forEach((p) => {
        Object.keys(cat[p] || {})
          .filter((k) => !k.endsWith("_change"))
          .forEach((k) => set.add(k));
      });
    });
    return Array.from(set);
  }, [categories, platforms]);

  // Use DB metrics if available, otherwise use data-derived metrics
  const availableMetrics = metricsFromDB.length > 0 ? metricsFromDB : allMetricKeys;

  // Sync external metric prop changes
  useEffect(() => {
    if (externalSelectedMetric && externalSelectedMetric !== selectedMetricKey) {
      setSelectedMetricKey(externalSelectedMetric);
    }
  }, [externalSelectedMetric]);

  // Set default metric if not set
  useEffect(() => {
    if (!selectedMetricKey && availableMetrics.length > 0) {
      const firstMetric = availableMetrics[0];
      setSelectedMetricKey(firstMetric);
      // Notify parent of initial metric
      onMetricChange && onMetricChange(firstMetric);
    }
  }, [availableMetrics, selectedMetricKey]);

  const metricOptions = availableMetrics.map((key) => ({
    label: key.replace(/_/g, " ").toUpperCase(),
    key,
  }));

  const selectedMetric = metricOptions.find(m => m.key === selectedMetricKey) || metricOptions[0];
  const theme = useTheme();

  /* --------------------- FILTER --------------------- */
  const filteredCategories = useMemo(() => {
    return categories.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, categories]);

  /* -------------------- PAGINATION -------------------- */
  const rowsPerPage = 5;
  const [page, setPage] = useState(0);

  const paginatedRows = useMemo(() => {
    return filteredCategories.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredCategories, page]);

  const totalPages = Math.ceil(filteredCategories.length / rowsPerPage);

  /* --------------------- CSV DOWNLOAD --------------------- */
  const handleDownload = () => {
    let csv = [];
    csv.push(["Category/SKU", ...platforms.map((p) => p.toUpperCase())].join(","));
    csv.push(["", selectedMetric.label]);

    filteredCategories.forEach((cat) => {
      const row = [cat.name];
      platforms.forEach((p) => {
        const main = cat[p][selectedMetric.key] || "-";
        const change = cat[p][selectedMetric.key + "_change"] || "-";
        row.push(`${main} (${change})`);
      });
      csv.push(row.join(","));
    });

    const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `table_export_${selectedMetric.key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderChange = (value) => {
    if (!value) return "-";
    const positive = value.startsWith("+");
    return (
      <span
        style={{
          color: positive ? theme.palette.success.main : theme.palette.error.main,
        }}
      >
        {value}
      </span>
    );
  };

  return (
    <Box>
      <Card
        sx={{
          p: 3,
          borderRadius: 3,
          boxShadow: 2,
          background: theme.palette.background.paper,
        }}
      >
        {/* HEADER */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background:
                  theme.palette.mode === "dark"
                    ? theme.palette.background.default
                    : "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TableChartIcon sx={{ color: theme.palette.primary.main }} />
            </Box>

            <Typography fontSize="1.25rem" fontWeight={700}>
              {activeTab}
            </Typography>
          </Box>

          {/* RIGHT CONTROLS */}
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Typography variant="body2" sx={{ color: "#6b7280", fontWeight: 600 }}>
              Metrics:
            </Typography>

            <Select
              size="small"
              value={selectedMetricKey || ""}
              sx={{ minWidth: 120 }}
              onChange={(e) => {
                setSelectedMetricKey(e.target.value);
                onMetricChange && onMetricChange(e.target.value);
              }}
            >
              {metricOptions.map((opt) => (
                <MenuItem key={opt.key} value={opt.key}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>

            {/* SEARCH */}
            <TextField
              size="small"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0); // reset page on search
              }}
              sx={{ width: 200 }}
            />

            {/* DOWNLOAD BUTTON */}
            <Button
              variant="outlined"
              size="small"
              onClick={handleDownload}
              sx={{ minWidth: "auto", p: 1 }}
            >
              <Download size={18} />
            </Button>
          </Box>
        </Box>

        {/* LOADING INDICATOR */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Loading SKU data...
            </Typography>
          </Box>
        )}

        {/* TABLE */}
        {!loading && (
          <TableContainer
            component={Paper}
            sx={{ background: theme.palette.background.paper }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      background:
                        theme.palette.mode === "dark"
                          ? theme.palette.background.default
                          : "#f9fafb",
                      fontWeight: 700,
                      position: "sticky",
                      left: 0,
                      zIndex: 10,
                    }}
                  >
                    {activeTab === "Split by Category" ? "Category" : "SKU"}
                  </TableCell>

                  {platforms.map((p) => (
                    <TableCell
                      align="center"
                      key={p}
                      sx={{
                        background:
                          theme.palette.mode === "dark"
                            ? theme.palette.background.default
                            : "#f9fafb",
                        fontWeight: 700,
                      }}
                    >
                      {p.toUpperCase()}
                    </TableCell>
                  ))}
                </TableRow>

                <TableRow>
                  <TableCell
                    sx={{
                      background: "#f9fafb",
                      position: "sticky",
                      left: 0,
                      zIndex: 9,
                    }}
                  ></TableCell>

                  <TableCell
                    align="center"
                    colSpan={platforms.length}
                    sx={{
                      background:
                        theme.palette.mode === "dark"
                          ? theme.palette.background.default
                          : "#f9fafb",
                      color: theme.palette.text.primary,
                      fontWeight: 900,
                      fontSize: "0.9rem",
                    }}
                  >
                    {selectedMetric.label}
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {paginatedRows.map((cat, i) => (
                  <TableRow key={i} hover>
                    <TableCell
                      sx={{
                        position: "sticky",
                        left: 0,
                        background: theme.palette.background.paper,
                        fontWeight: 700,
                      }}
                    >
                      {cat.name}
                    </TableCell>

                    {platforms.map((p) => {
                      const platformData = cat[p] || {};

                      // Handle both API format (with "value" and "change" fields) 
                      // and mock data format (direct metric fields)
                      let main, change;

                      if (platformData.value !== undefined) {
                        // API format
                        main = platformData.value;
                        change = platformData.change;
                      } else {
                        // Mock data format
                        main = platformData[selectedMetric.key];
                        change = platformData[selectedMetric.key + "_change"];
                      }

                      return (
                        <TableCell key={p + i} align="center">
                          <Box
                            display="flex"
                            flexDirection="column"
                            alignItems="center"
                          >
                            <Typography fontWeight={600}>{main || '-'}</Typography>
                            <Typography fontSize="0.75rem">
                              {renderChange(change)}
                            </Typography>
                          </Box>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* PAGINATION */}
        {!loading && (
          <Box
            display="flex"
            justifyContent="flex-end"
            alignItems="center"
            mt={2}
            gap={2}
          >
            <Button
              variant="outlined"
              size="small"
              disabled={page === 0}
              onClick={() => setPage((prev) => prev - 1)}
            >
              Prev
            </Button>

            <Typography fontWeight={600}>
              Page {page + 1} of {totalPages}
            </Typography>

            <Button
              variant="outlined"
              size="small"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </Box>
        )}
      </Card>
    </Box>
  );
}
