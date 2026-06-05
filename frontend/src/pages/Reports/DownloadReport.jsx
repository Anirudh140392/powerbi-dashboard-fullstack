import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Paper, Grid, Typography, Button, Autocomplete, TextField,
  CircularProgress, Snackbar, Alert, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Chip,
} from "@mui/material";
import {
  CloudDownload as CloudDownloadIcon,
  Refresh as RefreshIcon,
  HelpOutline as HelpOutlineIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import { fetchPdpReportFilters, downloadPdpReport, previewPdpReport } from "../../api/reportsService";
import { saveAs } from "file-saver";
import dayjs from "dayjs";

const PREVIEW_COLUMNS = [
  "Platform Name", "Location", "Pincode", "Portfolio", "Brand Name",
  "Brand Category", "SKU Name", "Web Pid", "OSA Remark",
  "Price RP", "Price SP", "Price Variation", "Date", "Year",
];

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
    platforms: [], locations: [], pincodes: [], brands: [],
    categories: [], skus: [], webPids: [], dates: [],
  });

  const [loadingFilters, setLoadingFilters] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Preview state
  const [previewRows, setPreviewRows] = useState([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const buildParams = useCallback(() => {
    const params = {};
    if (selectedPlatforms.length > 0) params.platforms = selectedPlatforms.join(",");
    if (selectedLocations.length > 0) params.locations = selectedLocations.join(",");
    if (selectedPincodes.length > 0) params.pincodes = selectedPincodes.join(",");
    if (selectedBrands.length > 0) params.brands = selectedBrands.join(",");
    if (selectedCategories.length > 0) params.categories = selectedCategories.join(",");
    if (selectedSkus.length > 0) params.skus = selectedSkus.join(",");
    if (selectedWebPids.length > 0) params.webPids = selectedWebPids.join(",");
    if (startDate) params.startDate = startDate.format("YYYY-MM-DD");
    if (endDate) params.endDate = endDate.format("YYYY-MM-DD");
    return params;
  }, [selectedPlatforms, selectedLocations, selectedPincodes, selectedBrands, selectedCategories, selectedSkus, selectedWebPids, startDate, endDate]);

  // Load filter options
  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const p = {};
      if (selectedPlatforms.length > 0) p.platform = selectedPlatforms.join(",");
      if (selectedLocations.length > 0) p.location = selectedLocations.join(",");
      if (selectedPincodes.length > 0) p.pincode = selectedPincodes.join(",");
      if (selectedBrands.length > 0) p.brand = selectedBrands.join(",");
      if (selectedCategories.length > 0) p.brandCategory = selectedCategories.join(",");
      if (selectedSkus.length > 0) p.sku = selectedSkus.join(",");
      if (selectedWebPids.length > 0) p.webPid = selectedWebPids.join(",");
      if (startDate) p.startDate = startDate.format("YYYY-MM-DD");
      if (endDate) p.endDate = endDate.format("YYYY-MM-DD");
      const data = await fetchPdpReportFilters(p);
      setFilterOptions({
        platforms: data.platforms || [], locations: data.locations || [],
        pincodes: data.pincodes || [], brands: data.brands || [],
        categories: data.categories || [], skus: data.skus || [],
        webPids: data.webPids || [], dates: data.dates || [],
      });
    } catch (err) {
      console.error("[DownloadReport] Error loading filters:", err);
      setErrorMessage("Failed to load filter options. Please try again.");
      setShowError(true);
    } finally {
      setLoadingFilters(false);
    }
  }, [selectedPlatforms, selectedLocations, selectedPincodes, selectedBrands, selectedCategories, selectedSkus, selectedWebPids, startDate, endDate]);

  useEffect(() => {
    loadFilters();
  }, [selectedPlatforms, selectedLocations, selectedPincodes, selectedBrands, selectedCategories, selectedSkus, selectedWebPids, startDate, endDate]);

  const handleReset = () => {
    setSelectedPlatforms([]); setSelectedLocations([]); setSelectedPincodes([]);
    setSelectedBrands([]); setSelectedCategories([]); setSelectedSkus([]);
    setSelectedWebPids([]); setStartDate(null); setEndDate(null);
    setShowPreview(false); setPreviewRows([]); setPreviewTotal(0); setPreviewPage(0);
  };

  // Fetch preview page
  const fetchPreview = useCallback(async (page = 0) => {
    setPreviewLoading(true);
    try {
      const params = { ...buildParams(), page: page + 1, limit: 500 };
      const data = await previewPdpReport(params);
      setPreviewRows(data.rows || []);
      setPreviewTotal(data.totalCount || 0);
      setPreviewPage(page);
      setShowPreview(true);
    } catch (err) {
      console.error("[DownloadReport] Preview failed:", err);
      setErrorMessage("Failed to load preview data.");
      setShowError(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [buildParams]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await downloadPdpReport(buildParams());
      const fileName = `PDP_Report_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
      saveAs(blob, fileName);
      setShowSuccess(true);
      // Load first page of preview after download
      fetchPreview(0);
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

  const acSx = { "& .MuiOutlinedInput-root": { borderRadius: "12px", backgroundColor: "#ffffff" } };
  const dpSx = { "& .MuiOutlinedInput-root": { borderRadius: "12px", backgroundColor: "#ffffff" } };

  return (
    <CommonContainer title="Download Report" hideFilters={true}>
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Paper
          elevation={0}
          sx={{
            p: 4, borderRadius: "20px",
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
              <IconButton sx={{ color: "#94a3b8" }}><HelpOutlineIcon /></IconButton>
            </Tooltip>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete multiple options={filterOptions.platforms} value={selectedPlatforms}
                onChange={(e, v) => setSelectedPlatforms(v)} limitTags={1}
                renderInput={(p) => <TextField {...p} label="Platform Name" placeholder="All Platforms" variant="outlined" InputLabelProps={{ shrink: true }} />}
                sx={acSx} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete multiple options={filterOptions.locations} value={selectedLocations}
                onChange={(e, v) => setSelectedLocations(v)} limitTags={1}
                renderInput={(p) => <TextField {...p} label="Location" placeholder="All Locations" variant="outlined" InputLabelProps={{ shrink: true }} />}
                sx={acSx} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete multiple options={filterOptions.pincodes.map(String)} value={selectedPincodes}
                onChange={(e, v) => setSelectedPincodes(v)} limitTags={1}
                renderInput={(p) => <TextField {...p} label="Pincode" placeholder="All Pincodes" variant="outlined" InputLabelProps={{ shrink: true }} />}
                sx={acSx} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete multiple options={filterOptions.brands} value={selectedBrands}
                onChange={(e, v) => setSelectedBrands(v)} limitTags={1}
                renderInput={(p) => <TextField {...p} label="Brand Name" placeholder="All Brands" variant="outlined" InputLabelProps={{ shrink: true }} />}
                sx={acSx} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete multiple options={filterOptions.categories} value={selectedCategories}
                onChange={(e, v) => setSelectedCategories(v)} limitTags={1}
                renderInput={(p) => <TextField {...p} label="Brand Category" placeholder="All Categories" variant="outlined" InputLabelProps={{ shrink: true }} />}
                sx={acSx} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete multiple options={filterOptions.skus} value={selectedSkus}
                onChange={(e, v) => setSelectedSkus(v)} limitTags={1}
                renderInput={(p) => <TextField {...p} label="SKU Name" placeholder="All SKUs" variant="outlined" InputLabelProps={{ shrink: true }} />}
                sx={acSx} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete multiple options={filterOptions.webPids} value={selectedWebPids}
                onChange={(e, v) => setSelectedWebPids(v)} limitTags={1}
                renderInput={(p) => <TextField {...p} label="Web Pid" placeholder="All Web Pids" variant="outlined" InputLabelProps={{ shrink: true }} />}
                sx={acSx} />
            </Grid>
            <Grid item xs={12} sm={12} md={6}>
              <Box sx={{ display: "flex", gap: 2, width: "100%" }}>
                <DatePicker label="Start Date" value={startDate} onChange={(v) => setStartDate(v)}
                  minDate={minDbDate} maxDate={maxDbDate}
                  slotProps={{ textField: { fullWidth: true, variant: "outlined", InputLabelProps: { shrink: true }, sx: dpSx }, field: { clearable: true } }} />
                <DatePicker label="End Date" value={endDate} onChange={(v) => setEndDate(v)}
                  minDate={startDate || minDbDate} maxDate={maxDbDate}
                  slotProps={{ textField: { fullWidth: true, variant: "outlined", InputLabelProps: { shrink: true }, sx: dpSx }, field: { clearable: true } }} />
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 2, mt: 4, pt: 3, borderTop: "1px solid rgba(226, 232, 240, 0.6)" }}>
            {loadingFilters && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: "auto" }}>
                <CircularProgress size={16} sx={{ color: "#2563eb" }} />
                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500 }}>Updating filter options...</Typography>
              </Box>
            )}
            <Button variant="outlined" onClick={handleReset} startIcon={<RefreshIcon />}
              sx={{ textTransform: "none", borderRadius: "12px", borderColor: "#cbd5e1", color: "#64748b", fontWeight: 650, px: 3, py: 1.2,
                "&:hover": { borderColor: "#94a3b8", backgroundColor: "#f8fafc" } }}>
              Reset Filters
            </Button>
            <Button variant="contained" onClick={handleDownload} disabled={isDownloading}
              startIcon={isDownloading ? <CircularProgress size={18} color="inherit" /> : <CloudDownloadIcon />}
              sx={{ textTransform: "none", borderRadius: "12px", background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "white", fontWeight: 700, px: 4, py: 1.2, boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
                "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37, 99, 235, 0.35)" } }}>
              {isDownloading ? "Downloading..." : "Download Report"}
            </Button>
          </Box>
        </Paper>

        {/* ── Data Preview Table ── */}
        {showPreview && (
          <Paper
            elevation={0}
            sx={{
              mt: 3, borderRadius: "20px",
              background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)",
              border: "1px solid rgba(226,232,240,0.8)",
              boxShadow: "0 10px 30px -10px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            <Box sx={{ px: 4, pt: 3, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <VisibilityIcon sx={{ color: "#2563eb", fontSize: 22 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#1e293b", fontFamily: "'Inter', sans-serif", fontSize: "1.05rem" }}>
                  Report Preview
                </Typography>
                <Chip
                  label={`${previewTotal.toLocaleString()} total rows`}
                  size="small"
                  sx={{ ml: 1, backgroundColor: "#eff6ff", color: "#2563eb", fontWeight: 600, fontSize: "0.75rem" }}
                />
              </Box>
              {previewLoading && <CircularProgress size={20} sx={{ color: "#2563eb" }} />}
            </Box>

            <TableContainer sx={{ maxHeight: 520, px: 2 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, backgroundColor: "#f8fafc", color: "#475569", fontSize: "0.75rem", letterSpacing: "0.04em", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", py: 1.5 }}>
                      #
                    </TableCell>
                    {PREVIEW_COLUMNS.map((col) => (
                      <TableCell key={col} sx={{ fontWeight: 700, backgroundColor: "#f8fafc", color: "#475569", fontSize: "0.75rem", letterSpacing: "0.04em", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", py: 1.5 }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.length === 0 && !previewLoading ? (
                    <TableRow>
                      <TableCell colSpan={PREVIEW_COLUMNS.length + 1} align="center" sx={{ py: 6, color: "#94a3b8" }}>
                        No data available for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    previewRows.map((row, idx) => (
                      <TableRow key={idx} hover sx={{ "&:nth-of-type(even)": { backgroundColor: "#fafbfc" }, "&:hover": { backgroundColor: "#f0f4ff" } }}>
                        <TableCell sx={{ color: "#94a3b8", fontSize: "0.78rem", py: 1 }}>
                          {previewPage * 500 + idx + 1}
                        </TableCell>
                        {PREVIEW_COLUMNS.map((col) => (
                          <TableCell key={col} sx={{ fontSize: "0.8rem", color: "#334155", py: 1, whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {row[col] !== undefined && row[col] !== null && row[col] !== "" ? String(row[col]) : "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={previewTotal}
              page={previewPage}
              onPageChange={(e, newPage) => fetchPreview(newPage)}
              rowsPerPage={500}
              rowsPerPageOptions={[500]}
              sx={{
                borderTop: "1px solid #e2e8f0",
                "& .MuiTablePagination-toolbar": { px: 3 },
                "& .MuiTablePagination-displayedRows": { fontWeight: 600, color: "#475569", fontSize: "0.82rem" },
              }}
            />
          </Paper>
        )}
      </Box>

      <Snackbar open={showSuccess} autoHideDuration={4000} onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert onClose={() => setShowSuccess(false)} severity="success" sx={{ width: "100%", borderRadius: "10px" }}>
          Report generated and downloaded successfully!
        </Alert>
      </Snackbar>

      <Snackbar open={showError} autoHideDuration={5000} onClose={() => setShowError(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert onClose={() => setShowError(false)} severity="error" sx={{ width: "100%", borderRadius: "10px" }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </CommonContainer>
  );
}
