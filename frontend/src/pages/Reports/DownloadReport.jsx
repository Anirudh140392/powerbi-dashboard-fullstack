import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Grid,
  Typography,
  Button,
  Autocomplete,
  TextField,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  CloudDownload as CloudDownloadIcon,
  Refresh as RefreshIcon,
  HelpOutline as HelpOutlineIcon,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import { fetchPdpReportFilters, downloadPdpReport } from "../../api/reportsService";
import { saveAs } from "file-saver";
import dayjs from "dayjs";

export default function DownloadReport() {
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedPincodes, setSelectedPincodes] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSkus, setSelectedSkus] = useState([]);
  const [selectedWebPids, setSelectedWebPids] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const [filterOptions, setFilterOptions] = useState({
    platforms: [],
    locations: [],
    pincodes: [],
    brands: [],
    categories: [],
    skus: [],
    webPids: [],
    dates: [],
  });

  const [loadingFilters, setLoadingFilters] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load all filter options on mount or filter change
  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const params = {};
      if (selectedPlatforms.length > 0) params.platform = selectedPlatforms.join(",");
      if (selectedLocations.length > 0) params.location = selectedLocations.join(",");
      if (selectedPincodes.length > 0) params.pincode = selectedPincodes.join(",");
      if (selectedBrands.length > 0) params.brand = selectedBrands.join(",");
      if (selectedCategories.length > 0) params.brandCategory = selectedCategories.join(",");
      if (selectedSkus.length > 0) params.sku = selectedSkus.join(",");
      if (selectedWebPids.length > 0) params.webPid = selectedWebPids.join(",");
      if (startDate) params.startDate = startDate.format("YYYY-MM-DD");
      if (endDate) params.endDate = endDate.format("YYYY-MM-DD");

      const data = await fetchPdpReportFilters(params);
      setFilterOptions({
        platforms: data.platforms || [],
        locations: data.locations || [],
        pincodes: data.pincodes || [],
        brands: data.brands || [],
        categories: data.categories || [],
        skus: data.skus || [],
        webPids: data.webPids || [],
        dates: data.dates || [],
      });
    } catch (err) {
      console.error("[DownloadReport] Error loading filters:", err);
      setErrorMessage("Failed to load filter options. Please try again.");
      setShowError(true);
    } finally {
      setLoadingFilters(false);
    }
  }, [
    selectedPlatforms,
    selectedLocations,
    selectedPincodes,
    selectedBrands,
    selectedCategories,
    selectedSkus,
    selectedWebPids,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    loadFilters();
  }, [
    selectedPlatforms,
    selectedLocations,
    selectedPincodes,
    selectedBrands,
    selectedCategories,
    selectedSkus,
    selectedWebPids,
    startDate,
    endDate,
  ]);

  const handleReset = () => {
    setSelectedPlatforms([]);
    setSelectedLocations([]);
    setSelectedPincodes([]);
    setSelectedBrands([]);
    setSelectedCategories([]);
    setSelectedSkus([]);
    setSelectedWebPids([]);
    setStartDate(null);
    setEndDate(null);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const params = {
        platforms: selectedPlatforms.length > 0 ? selectedPlatforms.join(",") : undefined,
        locations: selectedLocations.length > 0 ? selectedLocations.join(",") : undefined,
        pincodes: selectedPincodes.length > 0 ? selectedPincodes.join(",") : undefined,
        brands: selectedBrands.length > 0 ? selectedBrands.join(",") : undefined,
        categories: selectedCategories.length > 0 ? selectedCategories.join(",") : undefined,
        skus: selectedSkus.length > 0 ? selectedSkus.join(",") : undefined,
        webPids: selectedWebPids.length > 0 ? selectedWebPids.join(",") : undefined,
        startDate: startDate ? startDate.format("YYYY-MM-DD") : undefined,
        endDate: endDate ? endDate.format("YYYY-MM-DD") : undefined,
      };

      const blob = await downloadPdpReport(params);
      const fileName = `PDP_Report_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
      saveAs(blob, fileName);

      setShowSuccess(true);
    } catch (err) {
      console.error("[DownloadReport] Download failed:", err);
      if (err.status === 204) {
        setErrorMessage("No data found matching the selected filters.");
      } else {
        setErrorMessage("Failed to generate report. Please try again later.");
      }
      setShowError(true);
    } finally {
      setIsDownloading(false);
    }
  };

  const availableDates = filterOptions.dates || [];
  const minDbDate = availableDates.length > 0 ? dayjs(availableDates[availableDates.length - 1]) : null;
  const maxDbDate = availableDates.length > 0 ? dayjs(availableDates[0]) : null;

  return (
    <CommonContainer title="Download Report" hideFilters={true}>
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: "20px",
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.8) 100%)",
            border: "1px solid rgba(226, 232, 240, 0.8)",
            boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.04)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", fontFamily: "'Inter', sans-serif" }}>
                Export Raw PDP Weekly Data
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5, fontFamily: "'Inter', sans-serif" }}>
                Select filter options below to generate a customized Excel export. Leaving dropdowns empty will include all values.
              </Typography>
            </Box>
            <Tooltip title="Help information">
              <IconButton sx={{ color: "#94a3b8" }}>
                <HelpOutlineIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <Grid container spacing={3}>
            {/* Platform Dropdown */}
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                multiple
                options={filterOptions.platforms}
                value={selectedPlatforms}
                onChange={(event, newValue) => setSelectedPlatforms(newValue)}
                limitTags={1}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Platform Name"
                    placeholder="All Platforms"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#ffffff",
                  },
                }}
              />
            </Grid>

            {/* Location Dropdown */}
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                multiple
                options={filterOptions.locations}
                value={selectedLocations}
                onChange={(event, newValue) => setSelectedLocations(newValue)}
                limitTags={1}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Location"
                    placeholder="All Locations"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#ffffff",
                  },
                }}
              />
            </Grid>

            {/* Pincode Dropdown */}
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                multiple
                options={filterOptions.pincodes.map(String)}
                value={selectedPincodes}
                onChange={(event, newValue) => setSelectedPincodes(newValue)}
                limitTags={1}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Pincode"
                    placeholder="All Pincodes"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#ffffff",
                  },
                }}
              />
            </Grid>

            {/* Brand Dropdown */}
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                multiple
                options={filterOptions.brands}
                value={selectedBrands}
                onChange={(event, newValue) => setSelectedBrands(newValue)}
                limitTags={1}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Brand Name"
                    placeholder="All Brands"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#ffffff",
                  },
                }}
              />
            </Grid>

            {/* Brand Category Dropdown */}
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                multiple
                options={filterOptions.categories}
                value={selectedCategories}
                onChange={(event, newValue) => setSelectedCategories(newValue)}
                limitTags={1}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Brand Category"
                    placeholder="All Categories"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#ffffff",
                  },
                }}
              />
            </Grid>

            {/* SKU Name Dropdown */}
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                multiple
                options={filterOptions.skus}
                value={selectedSkus}
                onChange={(event, newValue) => setSelectedSkus(newValue)}
                limitTags={1}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="SKU Name"
                    placeholder="All SKUs"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#ffffff",
                  },
                }}
              />
            </Grid>

            {/* Web Pid Dropdown */}
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                multiple
                options={filterOptions.webPids}
                value={selectedWebPids}
                onChange={(event, newValue) => setSelectedWebPids(newValue)}
                limitTags={1}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Web Pid"
                    placeholder="All Web Pids"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#ffffff",
                  },
                }}
              />
            </Grid>

            {/* Date Range Picker */}
            <Grid item xs={12} sm={12} md={6}>
              <Box sx={{ display: "flex", gap: 2, width: "100%" }}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={(v) => setStartDate(v)}
                  minDate={minDbDate}
                  maxDate={maxDbDate}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      variant: "outlined",
                      InputLabelProps: { shrink: true },
                      sx: {
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "12px",
                          backgroundColor: "#ffffff",
                        },
                      },
                    },
                    field: { clearable: true },
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(v) => setEndDate(v)}
                  minDate={startDate || minDbDate}
                  maxDate={maxDbDate}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      variant: "outlined",
                      InputLabelProps: { shrink: true },
                      sx: {
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "12px",
                          backgroundColor: "#ffffff",
                        },
                      },
                    },
                    field: { clearable: true },
                  }}
                />
              </Box>
            </Grid>
          </Grid>

          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 2,
              mt: 4,
              pt: 3,
              borderTop: "1px solid rgba(226, 232, 240, 0.6)",
            }}
          >
            {loadingFilters && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: "auto" }}>
                <CircularProgress size={16} sx={{ color: "#2563eb" }} />
                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500 }}>
                  Updating filter options...
                </Typography>
              </Box>
            )}

            <Button
              variant="outlined"
              onClick={handleReset}
              startIcon={<RefreshIcon />}
              sx={{
                textTransform: "none",
                borderRadius: "12px",
                borderColor: "#cbd5e1",
                color: "#64748b",
                fontWeight: 650,
                px: 3,
                py: 1.2,
                "&:hover": {
                  borderColor: "#94a3b8",
                  backgroundColor: "#f8fafc",
                },
              }}
            >
              Reset Filters
            </Button>

            <Button
              variant="contained"
              onClick={handleDownload}
              disabled={isDownloading}
              startIcon={isDownloading ? <CircularProgress size={18} color="inherit" /> : <CloudDownloadIcon />}
              sx={{
                textTransform: "none",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "white",
                fontWeight: 700,
                px: 4,
                py: 1.2,
                boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
                "&:hover": {
                  background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
                  boxShadow: "0 6px 20px rgba(37, 99, 235, 0.35)",
                },
              }}
            >
              {isDownloading ? "Downloading..." : "Download Report"}
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={4000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setShowSuccess(false)} severity="success" sx={{ width: "100%", borderRadius: "10px" }}>
          Report generated and downloaded successfully!
        </Alert>
      </Snackbar>

      {/* Error Snackbar */}
      <Snackbar
        open={showError}
        autoHideDuration={5000}
        onClose={() => setShowError(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setShowError(false)} severity="error" sx={{ width: "100%", borderRadius: "10px" }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </CommonContainer>
  );
}
