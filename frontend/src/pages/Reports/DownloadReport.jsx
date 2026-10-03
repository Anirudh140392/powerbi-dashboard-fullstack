import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Paper, Grid, Typography, Button, Autocomplete, TextField,
  CircularProgress, Snackbar, Alert, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Chip, ToggleButtonGroup, ToggleButton
} from "@mui/material";
import {
  CloudDownload as CloudDownloadIcon,
  Refresh as RefreshIcon,
  HelpOutline as HelpOutlineIcon,
  Visibility as VisibilityIcon,
  FilterAlt as FilterAltIcon,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import {
  fetchPdpReportFilters, downloadPdpReport, previewPdpReport,
  fetchPromoViolationFilters, downloadPromoViolationReport, previewPromoViolationReport
} from "../../api/reportsService";
import { useAuth } from "../../utils/AuthContext";
import { saveAs } from "file-saver";
import dayjs from "dayjs";

const PREVIEW_COLUMNS = [
  "Platform Name", "Location", "Pincode", "Portfolio", "Brand Name",
  "Brand Category", "SKU Name", "Web Pid", "OSA Remark",
  "Price RP", "Price SP", "Price Variation", "Date", "Year",
];

export default function DownloadReport() {
  const { user } = useAuth();
  const activeDb = user?.database || sessionStorage.getItem("activeWorkspaceDb") || "";
  const isEmamiDb = activeDb.toLowerCase().includes("emami") || true;

  const [activeTab, setActiveTab] = useState("raw_data");

  // ── RAW DATA TAB STATE ──
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
    categories: [], skus: [], webPids: [], dates: [], platformMaxDates: {},
  });

  const [loadingFilters, setLoadingFilters] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [previewRows, setPreviewRows] = useState([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // ── PROMO VIOLATION TAB STATE ──
  const [promoSelectedKams, setPromoSelectedKams] = useState([]);
  const [promoSelectedAsms, setPromoSelectedAsms] = useState([]);
  const [promoSelectedPlatforms, setPromoSelectedPlatforms] = useState([]);
  const [promoSelectedSkus, setPromoSelectedSkus] = useState([]);
  const [promoStartDate, setPromoStartDate] = useState(null);
  const [promoEndDate, setPromoEndDate] = useState(null);

  const [promoFilterOptions, setPromoFilterOptions] = useState({
    kams: [], asms: [], platforms: [], skus: [], minDate: null, maxDate: null
  });
  const [loadingPromoFilters, setLoadingPromoFilters] = useState(false);

  const [promoRows, setPromoRows] = useState([]);
  const [promoLocationsList, setPromoLocationsList] = useState([]);
  const [promoTotal, setPromoTotal] = useState(0);
  const [promoPage, setPromoPage] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [showPromoPreview, setShowPromoPreview] = useState(false);
  const [isDownloadingPromo, setIsDownloadingPromo] = useState(false);
  const [promoKamName, setPromoKamName] = useState("Girish");

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

  const buildPromoParams = useCallback(() => {
    const params = {};
    if (promoSelectedKams.length > 0) params.kam = promoSelectedKams.join(",");
    if (promoSelectedAsms.length > 0) params.asm = promoSelectedAsms.join(",");
    if (promoSelectedPlatforms.length > 0) params.platform = promoSelectedPlatforms.join(",");
    if (promoSelectedSkus.length > 0) params.sku = promoSelectedSkus.join(",");
    if (promoStartDate) params.startDate = promoStartDate.format("YYYY-MM-DD");
    if (promoEndDate) params.endDate = promoEndDate.format("YYYY-MM-DD");
    return params;
  }, [promoSelectedKams, promoSelectedAsms, promoSelectedPlatforms, promoSelectedSkus, promoStartDate, promoEndDate]);

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
      const data = await fetchPdpReportFilters(p);
      setFilterOptions({
        platforms: data.platforms || [], locations: data.locations || [],
        pincodes: data.pincodes || [], brands: data.brands || [],
        categories: data.categories || [], skus: data.skus || [],
        webPids: data.webPids || [], dates: data.dates || [],
        platformMaxDates: data.platformMaxDates || {},
      });
    } catch (err) {
      console.error("[DownloadReport] Error loading filters:", err);
      setErrorMessage("Failed to load filter options.");
      setShowError(true);
    } finally {
      setLoadingFilters(false);
    }
  }, [selectedPlatforms, selectedLocations, selectedPincodes, selectedBrands, selectedCategories, selectedSkus, selectedWebPids]);

  const loadPromoFilters = useCallback(async () => {
    setLoadingPromoFilters(true);
    try {
      const p = { ...buildPromoParams() };
      delete p.startDate;
      delete p.endDate;
      console.log("[DownloadReport] loadPromoFilters called with params:", p);
      const data = await fetchPromoViolationFilters(p);
      console.log("[DownloadReport] API returned minDate:", data.minDate, "maxDate:", data.maxDate);
      setPromoFilterOptions({
        kams: data.kams || [],
        asms: data.asms || [],
        platforms: data.platforms || [],
        skus: data.skus || [],
        minDate: data.minDate || null,
        maxDate: data.maxDate || null,
      });
    } catch (err) {
      console.error("[DownloadReport] Error loading promo filters:", err);
    } finally {
      setLoadingPromoFilters(false);
    }
  }, [buildPromoParams]);


  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    loadPromoFilters();
  }, [loadPromoFilters]);

  const handleReset = () => {
    setSelectedPlatforms([]); setSelectedLocations([]); setSelectedPincodes([]);
    setSelectedBrands([]); setSelectedCategories([]); setSelectedSkus([]);
    setSelectedWebPids([]); setStartDate(null); setEndDate(null);
    setShowPreview(false); setPreviewRows([]); setPreviewTotal(0); setPreviewPage(0);
  };

  const handleResetPromo = () => {
    setPromoSelectedKams([]); setPromoSelectedAsms([]);
    setPromoSelectedPlatforms([]); setPromoSelectedSkus([]);
    setPromoStartDate(null); setPromoEndDate(null);
    setShowPromoPreview(false); setPromoRows([]); setPromoTotal(0); setPromoPage(0);
  };

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

  const fetchPromoPreview = useCallback(async (page = 0) => {
    setPromoLoading(true);
    try {
      const params = { ...buildPromoParams(), page: page + 1, limit: 500 };
      const data = await previewPromoViolationReport(params);
      setPromoRows(data.rows || []);
      setPromoLocationsList(data.locationsList || []);
      setPromoTotal(data.totalCount || 0);
      setPromoPage(page);
      setPromoKamName(data.kamName || (promoSelectedKams.length > 0 ? promoSelectedKams[0] : "All KAMs"));
      setShowPromoPreview(true);
    } catch (err) {
      console.error("[DownloadReport] Promo preview failed:", err);
      setErrorMessage("Failed to load Promo Violation preview data.");
      setShowError(true);
    } finally {
      setPromoLoading(false);
    }
  }, [buildPromoParams, promoSelectedKams]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await downloadPdpReport(buildParams());
      const fileName = `PDP_Report_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
      saveAs(blob, fileName);
      setShowSuccess(true);
      fetchPreview(0);
    } catch (err) {
      console.error("[DownloadReport] Download failed:", err);
      setErrorMessage(err.status === 204 ? "No data found matching the selected filters." : "Failed to generate report.");
      setShowError(true);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPromo = async () => {
    setIsDownloadingPromo(true);
    try {
      const blob = await downloadPromoViolationReport(buildPromoParams());
      const fileName = `Promo_Violation_Report_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
      saveAs(blob, fileName);
      setShowSuccess(true);
      fetchPromoPreview(0);
    } catch (err) {
      console.error("[DownloadReport] Download promo failed:", err);
      setErrorMessage(err.status === 204 ? "No promo violation data found." : "Failed to generate Promo Violation report.");
      setShowError(true);
    } finally {
      setIsDownloadingPromo(false);
    }
  };

  const availableDates = filterOptions.dates || [];
  const minDbDate = availableDates.length > 0 ? dayjs(availableDates[availableDates.length - 1]) : dayjs('2024-01-01');
  const maxDbDate = availableDates.length > 0 ? dayjs(availableDates[0]) : dayjs();

  const promoMinDbDate = promoFilterOptions.minDate ? dayjs(promoFilterOptions.minDate) : dayjs('2024-01-01');
  const promoMaxDbDate = promoFilterOptions.maxDate ? dayjs(promoFilterOptions.maxDate) : dayjs();

  const acSx = { "& .MuiOutlinedInput-root": { borderRadius: "12px", backgroundColor: "#ffffff" } };
  const dpSx = { "& .MuiOutlinedInput-root": { borderRadius: "12px", backgroundColor: "#ffffff" } };

  return (
    <CommonContainer title="Download Report" hideFilters={true}>
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        
        {/* ── TOGGLE CONTROL (RAW DATA vs PROMO VIOLATION) ── */}
        <Box sx={{ mb: 3, display: "flex", justifyContent: "flex-start" }}>
          <ToggleButtonGroup
            value={activeTab}
            exclusive
            onChange={(e, val) => val && setActiveTab(val)}
            sx={{
              backgroundColor: "#ffffff",
              p: 0.6,
              borderRadius: "16px",
              border: "1px solid #cbd5e1",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
              "& .MuiToggleButton-root": {
                border: "none",
                borderRadius: "12px",
                px: 3.5,
                py: 1,
                fontWeight: 700,
                textTransform: "none",
                fontSize: "0.92rem",
                color: "#64748b",
                fontFamily: "'Inter', sans-serif",
                "&.Mui-selected": {
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "#ffffff",
                  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)"
                }
              }
            }}
          >
            <ToggleButton value="raw_data">Raw Data</ToggleButton>
            <ToggleButton value="promo_violation">Promo Violation</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* ── TAB 1: RAW DATA MODE ── */}
        {activeTab === "raw_data" && (
          <>
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

              {/* Data Freshness Banner */}
              {filterOptions.platformMaxDates && Object.keys(filterOptions.platformMaxDates).length > 0 && (
                <Box
                  sx={{
                    mb: 4, p: 2, borderRadius: "14px",
                    background: "rgba(241, 245, 249, 0.6)",
                    border: "1px solid rgba(226, 232, 240, 0.8)",
                    display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", mr: 1, fontFamily: "'Inter', sans-serif" }}>
                    DATA FRESHNESS:
                  </Typography>
                  {Object.entries(filterOptions.platformMaxDates).map(([plat, maxD]) => (
                    <Chip
                      key={plat}
                      label={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, fontFamily: "'Inter', sans-serif" }}>
                          <span style={{ textTransform: "capitalize", fontWeight: 700 }}>{plat}:</span>
                          <span style={{ color: "#2563eb", fontWeight: 600 }}>{dayjs(maxD).format("DD MMM YYYY")}</span>
                        </Box>
                      }
                      size="small"
                      sx={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        color: "#334155",
                        fontSize: "0.75rem",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        "& .MuiChip-label": { px: 1 }
                      }}
                    />
                  ))}
                </Box>
              )}

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
                      minDate={minDbDate || undefined}
                      maxDate={endDate || maxDbDate || undefined}
                      slotProps={{ textField: { fullWidth: true, variant: "outlined", InputLabelProps: { shrink: true }, sx: dpSx }, field: { clearable: true } }} />
                    <DatePicker label="End Date" value={endDate} onChange={(v) => setEndDate(v)}
                      minDate={startDate || minDbDate || undefined}
                      maxDate={maxDbDate || undefined}
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
                  sx={{
                    textTransform: "none", borderRadius: "12px", borderColor: "#cbd5e1", color: "#64748b", fontWeight: 650, px: 3, py: 1.2,
                    "&:hover": { borderColor: "#94a3b8", backgroundColor: "#f8fafc" }
                  }}>
                  Reset Filters
                </Button>
                <Button variant="contained" onClick={() => fetchPreview(0)} disabled={previewLoading}
                  startIcon={previewLoading ? <CircularProgress size={18} color="inherit" /> : <FilterAltIcon />}
                  sx={{
                    textTransform: "none", borderRadius: "12px", background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "white", fontWeight: 700, px: 4, py: 1.2, boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
                    "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37, 99, 235, 0.35)" }
                  }}>
                  {previewLoading ? "Applying..." : "Apply"}
                </Button>
                <Button variant="contained" onClick={handleDownload} disabled={isDownloading}
                  startIcon={isDownloading ? <CircularProgress size={18} color="inherit" /> : <CloudDownloadIcon />}
                  sx={{
                    textTransform: "none", borderRadius: "12px", background: "linear-gradient(135deg, #334155 0%, #1e293b 100%)",
                    color: "white", fontWeight: 700, px: 4, py: 1.2, boxShadow: "0 4px 14px rgba(51, 65, 85, 0.25)",
                    "&:hover": { background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", boxShadow: "0 6px 20px rgba(51, 65, 85, 0.35)" }
                  }}>
                  {isDownloading ? "Downloading..." : "Download Report"}
                </Button>
              </Box>
            </Paper>

            {/* Data Preview Table */}
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
                        <TableCell sx={{ fontWeight: 700, backgroundColor: "#f8fafc", color: "#475569", fontSize: "0.75rem", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", py: 1.5 }}>
                          #
                        </TableCell>
                        {PREVIEW_COLUMNS.map((col) => (
                          <TableCell key={col} sx={{ fontWeight: 700, backgroundColor: "#f8fafc", color: "#475569", fontSize: "0.75rem", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", py: 1.5 }}>
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
          </>
        )}

        {/* ── TAB 2: PROMO VIOLATION MODE ── */}
        {activeTab === "promo_violation" && (
          <>
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
                    Export Promo Violation Report
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5, fontFamily: "'Inter', sans-serif" }}>
                    Calculate promo violations by joining KAM master with PDP dataset. Breached SKUs occur when Discount Operated &gt; Guardrail.
                  </Typography>
                </Box>
                <Tooltip title="Promo Violation Report Help">
                  <IconButton sx={{ color: "#94a3b8" }}><HelpOutlineIcon /></IconButton>
                </Tooltip>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={promoFilterOptions.kams} value={promoSelectedKams}
                    onChange={(e, v) => setPromoSelectedKams(v)} limitTags={1}
                    renderInput={(p) => <TextField {...p} label="KAM Name" placeholder="All KAMs" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={promoFilterOptions.platforms} value={promoSelectedPlatforms}
                    onChange={(e, v) => setPromoSelectedPlatforms(v)} limitTags={1}
                    renderInput={(p) => <TextField {...p} label="Platform Name" placeholder="All Platforms" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={promoFilterOptions.skus} value={promoSelectedSkus}
                    onChange={(e, v) => setPromoSelectedSkus(v)} limitTags={1}
                    renderInput={(p) => <TextField {...p} label="SKU Name" placeholder="All SKUs" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={promoFilterOptions.asms} value={promoSelectedAsms}
                    onChange={(e, v) => setPromoSelectedAsms(v)} limitTags={1}
                    renderInput={(p) => <TextField {...p} label="ASM Name" placeholder="All ASMs" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={12} md={6}>
                  <Box sx={{ display: "flex", gap: 2, width: "100%" }}>
                    <DatePicker label="Start Date" value={promoStartDate} onChange={(v) => setPromoStartDate(v)}
                      minDate={promoMinDbDate || undefined}
                      maxDate={promoEndDate || promoMaxDbDate || undefined}
                      slotProps={{ textField: { fullWidth: true, variant: "outlined", InputLabelProps: { shrink: true }, sx: dpSx }, field: { clearable: true } }} />
                    <DatePicker label="End Date" value={promoEndDate} onChange={(v) => setPromoEndDate(v)}
                      minDate={promoStartDate || promoMinDbDate || undefined}
                      maxDate={promoMaxDbDate || undefined}
                      slotProps={{ textField: { fullWidth: true, variant: "outlined", InputLabelProps: { shrink: true }, sx: dpSx }, field: { clearable: true } }} />
                  </Box>
                </Grid>
              </Grid>

              <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 2, mt: 4, pt: 3, borderTop: "1px solid rgba(226, 232, 240, 0.6)" }}>
                {loadingPromoFilters && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: "auto" }}>
                    <CircularProgress size={16} sx={{ color: "#2563eb" }} />
                    <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500 }}>Loading KAM options...</Typography>
                  </Box>
                )}
                <Button variant="outlined" onClick={handleResetPromo} startIcon={<RefreshIcon />}
                  sx={{
                    textTransform: "none", borderRadius: "12px", borderColor: "#cbd5e1", color: "#64748b", fontWeight: 650, px: 3, py: 1.2,
                    "&:hover": { borderColor: "#94a3b8", backgroundColor: "#f8fafc" }
                  }}>
                  Reset Filters
                </Button>
                <Button variant="contained" onClick={() => fetchPromoPreview(0)} disabled={promoLoading}
                  startIcon={promoLoading ? <CircularProgress size={18} color="inherit" /> : <FilterAltIcon />}
                  sx={{
                    textTransform: "none", borderRadius: "12px", background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "white", fontWeight: 700, px: 4, py: 1.2, boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
                    "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37, 99, 235, 0.35)" }
                  }}>
                  {promoLoading ? "Applying..." : "Apply"}
                </Button>
                <Button variant="contained" onClick={handleDownloadPromo} disabled={isDownloadingPromo}
                  startIcon={isDownloadingPromo ? <CircularProgress size={18} color="inherit" /> : <CloudDownloadIcon />}
                  sx={{
                    textTransform: "none", borderRadius: "12px", background: "linear-gradient(135deg, #334155 0%, #1e293b 100%)",
                    color: "white", fontWeight: 700, px: 4, py: 1.2, boxShadow: "0 4px 14px rgba(51, 65, 85, 0.25)",
                    "&:hover": { background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", boxShadow: "0 6px 20px rgba(51, 65, 85, 0.35)" }
                  }}>
                  {isDownloadingPromo ? "Downloading..." : "Download Report"}
                </Button>
              </Box>
            </Paper>

            {/* Promo Violation Preview Table with Normalized Colors */}
            {showPromoPreview && (
              <Paper
                elevation={0}
                sx={{
                  mt: 3, borderRadius: "16px",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.04)",
                  overflow: "hidden",
                }}
              >
                <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Chip
                      label={`Price Violation @ ${promoKamName}`}
                      sx={{
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        fontFamily: "'Inter', sans-serif",
                        borderRadius: "8px",
                        border: "1px solid #fde68a"
                      }}
                    />
                    <Chip
                      label={`${promoTotal} Breached Items`}
                      size="small"
                      sx={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", fontWeight: 700, fontSize: "0.75rem" }}
                    />
                  </Box>
                  {promoLoading && <CircularProgress size={20} sx={{ color: "#2563eb" }} />}
                </Box>

                <TableContainer sx={{ maxHeight: 600 }}>
                  <Table stickyHeader size="small" sx={{ borderCollapse: "separate", borderSpacing: 0 }}>
                    <TableHead>
                      {/* Top Header Row (Group headers) */}
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          align="center"
                          sx={{
                            backgroundColor: "#fef9c3",
                            color: "#854d0e",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            borderBottom: "1px solid #e2e8f0",
                            borderRight: "1px solid #e2e8f0",
                            py: 1.2
                          }}
                        >
                          Price Violation @ {promoKamName}
                        </TableCell>
                        <TableCell
                          colSpan={2}
                          align="center"
                          sx={{
                            backgroundColor: "#fff7ed",
                            color: "#9a3412",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            borderBottom: "1px solid #e2e8f0",
                            borderRight: "1px solid #e2e8f0",
                            py: 1.2
                          }}
                        >
                          Crawler Data
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{
                            backgroundColor: "#eff6ff",
                            color: "#1e40af",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            borderBottom: "1px solid #e2e8f0",
                            borderRight: "1px solid #e2e8f0",
                            py: 1.2
                          }}
                        >
                          Guardrail
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{
                            backgroundColor: "#eff6ff",
                            color: "#1e40af",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            borderBottom: "1px solid #e2e8f0",
                            borderRight: "1px solid #e2e8f0",
                            py: 1.2
                          }}
                        >
                          Discount Operated
                        </TableCell>
                        {promoLocationsList.map((loc) => (
                          <TableCell
                            key={`city-header-${loc}`}
                            colSpan={2}
                            align="center"
                            sx={{
                              backgroundColor: "#f0fdf4",
                              color: "#166534",
                              fontWeight: 700,
                              fontSize: "0.82rem",
                              borderBottom: "1px solid #e2e8f0",
                              borderRight: "1px solid #e2e8f0",
                              py: 1.2,
                              textTransform: "capitalize"
                            }}
                          >
                            {loc}
                          </TableCell>
                        ))}
                      </TableRow>

                      {/* Sub Header Row */}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, backgroundColor: "#f8fafc", color: "#475569", fontSize: "0.75rem", borderBottom: "2px solid #cbd5e1", borderRight: "1px solid #e2e8f0", whiteSpace: "nowrap", py: 1 }}>
                          platform_name
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, backgroundColor: "#f8fafc", color: "#475569", fontSize: "0.75rem", borderBottom: "2px solid #cbd5e1", borderRight: "1px solid #e2e8f0", whiteSpace: "nowrap", py: 1 }}>
                          Sku- Final
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, backgroundColor: "#fff7ed", color: "#9a3412", fontSize: "0.75rem", borderBottom: "2px solid #cbd5e1", borderRight: "1px solid #e2e8f0", whiteSpace: "nowrap", py: 1 }}>
                          MRP
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, backgroundColor: "#fff7ed", color: "#9a3412", fontSize: "0.75rem", borderBottom: "2px solid #cbd5e1", borderRight: "1px solid #e2e8f0", whiteSpace: "nowrap", py: 1 }}>
                          SP
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, backgroundColor: "#eff6ff", color: "#1e40af", fontSize: "0.75rem", borderBottom: "2px solid #cbd5e1", borderRight: "1px solid #e2e8f0", whiteSpace: "nowrap", py: 1 }}>
                          Guardrail
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, backgroundColor: "#eff6ff", color: "#1e40af", fontSize: "0.75rem", borderBottom: "2px solid #cbd5e1", borderRight: "1px solid #e2e8f0", whiteSpace: "nowrap", py: 1 }}>
                          Discount Operated
                        </TableCell>

                        {/* City Sub-headers */}
                        {promoLocationsList.map((loc) => (
                          <React.Fragment key={`subheaders-${loc}`}>
                            <TableCell align="center" sx={{ fontWeight: 700, backgroundColor: "#f0fdf4", color: "#166534", fontSize: "0.75rem", borderBottom: "2px solid #cbd5e1", borderRight: "1px solid #e2e8f0", whiteSpace: "nowrap", py: 1 }}>
                              Count of PIN Code
                            </TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700, backgroundColor: "#f0fdf4", color: "#166534", fontSize: "0.75rem", borderBottom: "2px solid #cbd5e1", borderRight: "1px solid #e2e8f0", whiteSpace: "nowrap", py: 1 }}>
                              Pincodes
                            </TableCell>
                          </React.Fragment>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {promoRows.length === 0 && !promoLoading ? (
                        <TableRow>
                          <TableCell colSpan={6 + 2 * promoLocationsList.length} align="center" sx={{ py: 6, color: "#94a3b8" }}>
                            No promo violation breaches found for selected filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        promoRows.map((row, idx) => (
                          <TableRow key={idx} hover sx={{ "&:nth-of-type(even)": { backgroundColor: "#fafbfc" }, "&:hover": { backgroundColor: "#f1f5f9" } }}>
                            <TableCell sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e293b", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", py: 1, textTransform: "lowercase" }}>
                              {row.platform_name}
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#0f172a", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", py: 1, textTransform: "uppercase" }}>
                              {row.sku_name}
                            </TableCell>

                            <TableCell align="center" sx={{ fontSize: "0.78rem", color: "#334155", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", py: 1 }}>
                              {row.mrp}
                            </TableCell>
                            <TableCell align="center" sx={{ fontSize: "0.78rem", color: "#334155", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", py: 1 }}>
                              {row.sp}
                            </TableCell>
                            <TableCell align="center" sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", py: 1 }}>
                              {row.guardrail}%
                            </TableCell>
                            <TableCell align="center" sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#c2410c", backgroundColor: "#fff7ed", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", py: 1 }}>
                              {row.discountOperated}%
                            </TableCell>

                            {/* City Sub-values */}
                            {promoLocationsList.map((loc) => (
                              <React.Fragment key={`city-vals-${loc}`}>
                                <TableCell align="center" sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e293b", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", py: 1 }}>
                                  {row.pincodeCounts?.[loc] !== "" ? row.pincodeCounts[loc] : ""}
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.76rem", color: "#475569", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", py: 1, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {row.pincodeStrings?.[loc] || ""}
                                </TableCell>
                              </React.Fragment>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component="div"
                  count={promoTotal}
                  page={promoPage}
                  onPageChange={(e, newPage) => fetchPromoPreview(newPage)}
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
          </>
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
