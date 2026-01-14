import React, { useState, useMemo, useEffect, useRef } from "react";
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
  Skeleton,
} from "@mui/material";
import TableChartIcon from "@mui/icons-material/TableChart";
import { Download } from "lucide-react";
import axiosInstance from "../../../api/axiosInstance";
import { FilterContext } from "../../../utils/FilterContext";

export default function CategoryTable({ categories, activeTab = "", filters = {} }) {
  const { platforms: availablePlatforms } = React.useContext(FilterContext);
  const [dynamicPlatforms, setDynamicPlatforms] = useState([]);

  // Fetch platforms dynamically from backend
  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await axiosInstance.get('/watchtower/platforms');
        if (response.data && response.data.length > 0) {
          // Always include 'all' in the platform list (backend calculates this)
          const platformsWithAll = ['all', ...response.data.map(p => p.toLowerCase())];
          // Remove duplicates
          const uniquePlatforms = [...new Set(platformsWithAll)];
          setDynamicPlatforms(uniquePlatforms);
        }
      } catch (error) {
        console.error('Error fetching platforms for SKU table:', error);
        // Fallback to extracting from categories if API fails
        if (categories && categories.length > 0) {
          const extractedPlatforms = Object.keys(categories[0]).filter(
            (k) => k !== "name" && k !== "category"
          );
          setDynamicPlatforms(extractedPlatforms);
        }
      }
    };
    fetchPlatforms();
  }, [categories]);

  // Sort platforms intelligently: All first, then selected platform, then alphabetical
  const platforms = useMemo(() => {
    const platformList = dynamicPlatforms.length > 0
      ? dynamicPlatforms
      : (categories && categories.length > 0
        ? Object.keys(categories[0]).filter((k) => k !== "name" && k !== "category")
        : (availablePlatforms || []).map(p => p.toLowerCase()));

    const selectedPlatform = filters.platform?.toLowerCase();

    return [...platformList].sort((a, b) => {
      const aLower = typeof a === 'string' ? a.toLowerCase() : a;
      const bLower = typeof b === 'string' ? b.toLowerCase() : b;

      // "All" always first
      if (aLower === 'all') return -1;
      if (bLower === 'all') return 1;

      // Selected platform second (after "All")
      if (selectedPlatform && selectedPlatform !== 'all') {
        if (aLower === selectedPlatform) return -1;
        if (bLower === selectedPlatform) return 1;
      }

      // Rest alphabetically
      return aLower.localeCompare(bLower);
    });
  }, [dynamicPlatforms, categories, availablePlatforms, filters.platform]);
  const [searchTerm, setSearchTerm] = useState("");
  const [metricOptions, setMetricOptions] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [skuData, setSkuData] = useState([]);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  // Fetch metrics from key_metrics table on component mount
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await axiosInstance.get('/watchtower/metrics');
        if (response.data && response.data.length > 0) {
          const formattedMetrics = response.data.map(metric => {
            // Create a readable label from the key
            let label = metric.key;

            // If the key has underscores or is all lowercase, format it nicely
            if (label.includes('_') || label === label.toLowerCase()) {
              // Replace underscores with spaces and title case each word
              label = label
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            }

            return {
              key: metric.key,
              label: label
            };
          });
          setMetricOptions(formattedMetrics);
          setSelectedMetric(formattedMetrics[0]);
        }
      } catch (error) {
        console.error('Error fetching metrics:', error);
        // Fallback to extracting from data if API fails
        const set = new Set();
        categories.forEach((cat) => {
          platforms.forEach((p) => {
            Object.keys(cat[p] || {})
              .filter((k) => !k.endsWith("_change") && k !== "value")
              .forEach((k) => set.add(k));
          });
        });
        const fallbackMetrics = Array.from(set).map((key) => {
          // Create readable label
          let label = key;
          if (label.includes('_') || label === label.toLowerCase()) {
            label = label
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
          }

          return { key, label };
        });
        setMetricOptions(fallbackMetrics);
        if (fallbackMetrics.length > 0) {
          setSelectedMetric(fallbackMetrics[0]);
        }
      }
    };

    fetchMetrics();
  }, []);

  // Ref to track last fetched params and prevent duplicate API calls
  const lastFetchedRef = useRef(null);

  // Fetch SKU data when metric changes
  useEffect(() => {
    if (!selectedMetric) return;

    // Create a stable key for current fetch params
    const fetchKey = JSON.stringify({
      metric: selectedMetric?.key,
      platform: filters.platform,
      brand: filters.brand,
      location: filters.location,
      startDate: filters.startDate,
      endDate: filters.endDate
    });

    // Skip if we already fetched with these same params
    if (lastFetchedRef.current === fetchKey) {
      return;
    }

    // Mark these params as being fetched
    lastFetchedRef.current = fetchKey;

    const fetchSkuData = async () => {
      setLoading(true);
      try {
        console.log('🔍 Fetching SKU data with filters:', {
          metric: selectedMetric?.key || 'none',
          platform: filters.platform || 'All',
          brand: filters.brand || 'All',
          location: filters.location || 'All',
          dateRange: filters.startDate && filters.endDate
            ? `${filters.startDate} to ${filters.endDate}`
            : 'No date filter'
        });

        // Convert metric key to lowercase to match backend response format
        const metricKeyLower = selectedMetric.key.toLowerCase();

        const response = await axiosInstance.get('/watchtower/sku-metrics', {
          params: {
            metric: metricKeyLower,
            platform: filters.platform,
            brand: filters.brand,
            location: filters.location,
            dateFrom: filters.startDate,
            dateTo: filters.endDate,
          }
        });
        setSkuData(response.data || []);
      } catch (error) {
        console.error('Error fetching SKU data:', error);
        setSkuData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSkuData();
  }, [selectedMetric, filters.platform, filters.brand, filters.location, filters.startDate, filters.endDate]);


  /* --------------------- FILTER --------------------- */
  // Use SKU data if available, otherwise fall back to categories prop
  const dataToDisplay = skuData.length > 0 ? skuData : categories;

  const filteredCategories = useMemo(() => {
    return dataToDisplay.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, dataToDisplay]);


  /* -------------------- PAGINATION -------------------- */
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [page, setPage] = useState(0);

  const paginatedRows = useMemo(() => {
    return filteredCategories.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredCategories, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredCategories.length / rowsPerPage);

  /* --------------------- CSV DOWNLOAD --------------------- */
  const capitalize = (s) => {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const handleDownloadCSV = () => {
    if (!selectedMetric) return;

    // Convert metric key to lowercase to match backend response format
    const metricKeyLower = selectedMetric.key.toLowerCase();

    const csvRows = [];
    const headers = ["SKU", ...platforms.map((p) => capitalize(p))];
    csvRows.push(headers.join(","));

    filteredCategories.forEach((cat) => {
      const row = [cat.name];
      platforms.forEach((p) => {
        // Safely access nested properties with fallbacks
        const platformData = cat[p] || {};
        const main = platformData[metricKeyLower] || "-";
        const change = platformData[metricKeyLower + "_change"] || "-";
        row.push(`${main} (${change})`);
      });
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
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

            <Typography fontSize="1.2rem" fontWeight={700} fontFamily="Roboto, sans-serif">
              {activeTab}
            </Typography>
          </Box>

          {/* RIGHT CONTROLS */}
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            {/* Metrics Name Label */}
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.85rem", color: "text.secondary" }}>
              Metrics:
            </Typography>

            {/* Metrics Dropdown */}
            <Select
              size="small"
              value={selectedMetric?.key || ''}
              onChange={(e) =>
                setSelectedMetric(
                  metricOptions.find((m) => m.key === e.target.value)
                )
              }
              sx={{
                minWidth: 150,
                height: 36,
                fontSize: "0.85rem",
                background: "#f3f4f6",
              }}
              disabled={!selectedMetric || metricOptions.length === 0 || loading}
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
              onClick={handleDownloadCSV}
              sx={{ minWidth: "auto", p: 1 }}
            >
              <Download size={18} />
            </Button>
          </Box>
        </Box>

        {/* TABLE */}
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
                    position: "sticky",
                    left: 0,
                    zIndex: 10,
                    textAlign: "center",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    lineHeight: 1.4,
                    fontFamily: "Roboto, sans-serif",
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
                      fontSize: "0.95rem",
                      fontFamily: "Roboto, sans-serif",
                    }}
                  >
                    <Typography fontWeight={700} fontSize="0.95rem" fontFamily="Roboto, sans-serif">
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Typography>
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
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    fontFamily: "Roboto, sans-serif",
                  }}
                >
                  {selectedMetric ? (selectedMetric.label.toLowerCase().charAt(0).toUpperCase() + selectedMetric.label.toLowerCase().slice(1)) : 'Loading...'}
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                // Skeleton loading rows
                [1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell
                      sx={{
                        position: "sticky",
                        left: 0,
                        background: theme.palette.background.paper,
                        textAlign: "center",
                      }}
                    >
                      <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                        <Skeleton variant="rounded" width={60} height={18} animation="wave" sx={{ borderRadius: 2 }} />
                        <Skeleton variant="text" width={120} height={22} animation="wave" sx={{ borderRadius: 1 }} />
                      </Box>
                    </TableCell>
                    {platforms.map((p, j) => (
                      <TableCell key={p + j} align="center">
                        <Box display="flex" flexDirection="column" alignItems="center">
                          <Skeleton variant="text" width={60} height={22} animation="wave" sx={{ borderRadius: 1 }} />
                          <Skeleton variant="text" width={40} height={16} animation="wave" sx={{ borderRadius: 1 }} />
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                paginatedRows.map((cat, i) => (
                  <TableRow key={i} hover>
                    <TableCell
                      sx={{
                        position: "sticky",
                        left: 0,
                        background: theme.palette.background.paper,
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        lineHeight: 1.4,
                        fontFamily: "Roboto, sans-serif",
                        textAlign: "center",
                      }}
                    >
                      <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                        {cat.category && (
                          <Typography
                            fontSize="0.7rem"
                            fontWeight={500}
                            fontFamily="Roboto, sans-serif"
                            sx={{
                              color: theme.palette.text.secondary,
                              backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.default : "#f1f5f9",
                              px: 1.5,
                              py: 0.3,
                              borderRadius: "12px",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px"
                            }}
                          >
                            {cat.category}
                          </Typography>
                        )}
                        <Typography fontWeight={700} fontSize="0.95rem" fontFamily="Roboto, sans-serif">{cat.name}</Typography>
                      </Box>
                    </TableCell>
                    {platforms.map((p) => {
                      if (!selectedMetric) return null;

                      // Convert metric key to lowercase to match backend response format
                      const metricKeyLower = selectedMetric.key.toLowerCase();

                      // Safely access nested properties with fallbacks
                      const platformData = cat[p] || {};
                      const main = platformData[metricKeyLower] || "-";
                      const change = platformData[metricKeyLower + "_change"] || "-";

                      return (
                        <TableCell key={p + i} align="center">
                          <Box
                            display="flex"
                            flexDirection="column"
                            alignItems="center"
                          >
                            <Typography
                              fontSize="0.95rem"
                              fontWeight={700}
                              fontFamily="Roboto, sans-serif"
                            >
                              {main}
                            </Typography>
                            <Typography fontSize="0.75rem" fontWeight={400} fontFamily="Roboto, sans-serif">
                              {renderChange(change)}
                            </Typography>
                          </Box>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* PAGINATION */}
        <div className="mt-3 flex items-center justify-between text-[11px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-full border px-3 py-1 disabled:opacity-40"
            >
              Prev
            </button>

            <span>
              Page <b>{page + 1}</b> / {totalPages}
            </span>

            <button
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div>
              Rows/page
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(0); // Reset to first page when changing rows per page
                }}
                className="ml-1 rounded-full border px-2 py-1"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </div>
          </div>
        </div>
      </Card>
    </Box>
  );
}