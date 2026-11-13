import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Box, Paper, Grid, Typography, Button, Autocomplete, TextField,
  CircularProgress, Snackbar, Alert, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Chip, ToggleButtonGroup, ToggleButton, Checkbox
} from "@mui/material";
import {
  CloudDownload as CloudDownloadIcon,
  Refresh as RefreshIcon,
  HelpOutline as HelpOutlineIcon,
  Visibility as VisibilityIcon,
  FilterAlt as FilterAltIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  CheckBox as CheckBoxIcon,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import {
  fetchPdpReportFilters, downloadPdpReport, previewPdpReport,
  fetchPromoViolationFilters, downloadPromoViolationReport, previewPromoViolationReport,
  fetchPriceViolationFilters, downloadPriceViolationReport, previewPriceViolationReport
} from "../../api/reportsService";
import { useAuth } from "../../utils/AuthContext";
import { saveAs } from "file-saver";
import dayjs from "dayjs";

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

const renderCheckboxOption = (props, option, { selected }) => {
  const { key, ...optionProps } = props;
  return (
    <li key={key} {...optionProps}>
      <Checkbox
        icon={icon}
        checkedIcon={checkedIcon}
        style={{ marginRight: 8 }}
        checked={selected}
      />
      {option}
    </li>
  );
};

const PREVIEW_COLUMNS = [
  "Platform Name", "Location", "Pincode", "Portfolio", "Brand Name",
  "Brand Category", "SKU Name", "Web Pid", "OSA Remark",
  "Price RP", "Price SP", "Price Variation", "Date", "Year",
];

export default function DownloadReport() {
  const { user } = useAuth();
  const activeDb = (
    user?.database ||
    user?.dbName ||
    sessionStorage.getItem("activeWorkspaceDb") ||
    ""
  ).toLowerCase().trim();
  const isEmamiDb = activeDb.includes("emami");

  const [activeTab, setActiveTab] = useState("raw_data");

  // ── RAW DATA TAB STATE ──
  const [skuType, setSkuType] = useState("our"); // "our" (Platform Brand SKUs) | "competition" (Competition Brand SKUs)
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
  const initialPromoFiltersRef = useRef(null);

  const [promoRows, setPromoRows] = useState([]);
  const [promoLocationsList, setPromoLocationsList] = useState([]);
  const [promoTotal, setPromoTotal] = useState(0);
  const [promoPage, setPromoPage] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [showPromoPreview, setShowPromoPreview] = useState(false);
  const [isDownloadingPromo, setIsDownloadingPromo] = useState(false);
  const [promoKamName, setPromoKamName] = useState("Girish");

  // ── PRICE VIOLATION TAB STATE ──
  const [pvSelectedPlatforms, setPvSelectedPlatforms] = useState([]);
  const [pvSelectedLocations, setPvSelectedLocations] = useState([]);
  const [pvSelectedSkus, setPvSelectedSkus] = useState([]);
  const [pvSelectedWebPids, setPvSelectedWebPids] = useState([]);
  const [pvStartDate, setPvStartDate] = useState(null);
  const [pvEndDate, setPvEndDate] = useState(null);

  const [pvFilterOptions, setPvFilterOptions] = useState({
    platforms: [], locations: [], skus: [], webPids: [], minDate: null, maxDate: null
  });
  const [loadingPvFilters, setLoadingPvFilters] = useState(false);
  const initialPvFiltersRef = useRef(null);

  const [pvRows, setPvRows] = useState([]);
  const [pvTotal, setPvTotal] = useState(0);
  const [pvPage, setPvPage] = useState(0);
  const [pvLoading, setPvLoading] = useState(false);
  const [showPvPreview, setShowPvPreview] = useState(false);
  const [isDownloadingPv, setIsDownloadingPv] = useState(false);
  const [pvSummary, setPvSummary] = useState({ totalBreaches: 0, uniqueSkus: 0, uniquePlatforms: 0, maxViolation: 0 });

  const isQcUserMode = Number(user?.qc_user ?? user?.qcUser) === 1;
  const clientMaxAllowedDate = useMemo(() => {
    return isQcUserMode ? dayjs() : dayjs().subtract(1, 'day');
  }, [isQcUserMode]);

  const buildParams = useCallback(() => {
    const params = {};
    if (skuType) params.skuType = skuType;
    if (selectedPlatforms.length > 0) params.platforms = selectedPlatforms.join(",");
    if (selectedLocations.length > 0) params.locations = selectedLocations.join(",");
    if (selectedPincodes.length > 0) params.pincodes = selectedPincodes.join(",");
    if (selectedBrands.length > 0) params.brands = selectedBrands.join(",");
    if (selectedCategories.length > 0) params.categories = selectedCategories.join(",");
    if (selectedSkus.length > 0) params.skus = selectedSkus.join(",");
    if (selectedWebPids.length > 0) params.webPids = selectedWebPids.join(",");
    if (startDate) {
      const s = (!isQcUserMode && startDate.isAfter(clientMaxAllowedDate)) ? clientMaxAllowedDate : startDate;
      params.startDate = s.format("YYYY-MM-DD");
    }
    if (endDate) {
      const e = (!isQcUserMode && endDate.isAfter(clientMaxAllowedDate)) ? clientMaxAllowedDate : endDate;
      params.endDate = e.format("YYYY-MM-DD");
    }
    return params;
  }, [skuType, selectedPlatforms, selectedLocations, selectedPincodes, selectedBrands, selectedCategories, selectedSkus, selectedWebPids, startDate, endDate, isQcUserMode, clientMaxAllowedDate]);

  const buildPromoParams = useCallback(() => {
    const params = {};
    if (promoSelectedKams.length > 0) params.kam = promoSelectedKams.join(",");
    if (promoSelectedAsms.length > 0) params.asm = promoSelectedAsms.join(",");
    if (promoSelectedPlatforms.length > 0) params.platform = promoSelectedPlatforms.join(",");
    if (promoSelectedSkus.length > 0) params.sku = promoSelectedSkus.join(",");
    if (promoStartDate) {
      const s = (!isQcUserMode && promoStartDate.isAfter(clientMaxAllowedDate)) ? clientMaxAllowedDate : promoStartDate;
      params.startDate = s.format("YYYY-MM-DD");
    }
    if (promoEndDate) {
      const e = (!isQcUserMode && promoEndDate.isAfter(clientMaxAllowedDate)) ? clientMaxAllowedDate : promoEndDate;
      params.endDate = e.format("YYYY-MM-DD");
    }
    return params;
  }, [promoSelectedKams, promoSelectedAsms, promoSelectedPlatforms, promoSelectedSkus, promoStartDate, promoEndDate, isQcUserMode, clientMaxAllowedDate]);

  const buildPvParams = useCallback(() => {
    const params = {};
    if (pvSelectedPlatforms.length > 0) params.platform = pvSelectedPlatforms.join(",");
    if (pvSelectedLocations.length > 0) params.location = pvSelectedLocations.join(",");
    if (pvSelectedSkus.length > 0) params.sku = pvSelectedSkus.join(",");
    if (pvSelectedWebPids.length > 0) params.webPid = pvSelectedWebPids.join(",");
    if (pvStartDate) {
      const s = (!isQcUserMode && pvStartDate.isAfter(clientMaxAllowedDate)) ? clientMaxAllowedDate : pvStartDate;
      params.startDate = s.format("YYYY-MM-DD");
    }
    if (pvEndDate) {
      const e = (!isQcUserMode && pvEndDate.isAfter(clientMaxAllowedDate)) ? clientMaxAllowedDate : pvEndDate;
      params.endDate = e.format("YYYY-MM-DD");
    }
    return params;
  }, [pvSelectedPlatforms, pvSelectedLocations, pvSelectedSkus, pvSelectedWebPids, pvStartDate, pvEndDate, isQcUserMode, clientMaxAllowedDate]);

  const loadPvFilters = useCallback(async (customParams = null) => {
    setLoadingPvFilters(true);
    try {
      const p = customParams !== null ? { ...customParams } : {};
      if (customParams === null) {
        if (pvSelectedPlatforms.length > 0) p.platform = pvSelectedPlatforms.join(",");
        if (pvSelectedLocations.length > 0) p.location = pvSelectedLocations.join(",");
        if (pvSelectedSkus.length > 0) p.sku = pvSelectedSkus.join(",");
        if (pvSelectedWebPids.length > 0) p.webPid = pvSelectedWebPids.join(",");
      }
      const data = await fetchPriceViolationFilters(p);
      const newOptions = {
        platforms: data.platforms || [],
        locations: data.locations || [],
        skus: data.skus || [],
        webPids: data.webPids || [],
        minDate: data.minDate || null,
        maxDate: data.maxDate || null,
      };
      if (Object.keys(p).length === 0 && newOptions.platforms.length > 0) {
        initialPvFiltersRef.current = newOptions;
      }
      setPvFilterOptions(newOptions);
    } catch (err) {
      console.error("[DownloadReport] Error loading Price Violation filters:", err);
      if (initialPvFiltersRef.current) {
        setPvFilterOptions(initialPvFiltersRef.current);
      }
    } finally {
      setLoadingPvFilters(false);
    }
  }, [pvSelectedPlatforms, pvSelectedLocations, pvSelectedSkus, pvSelectedWebPids]);

  useEffect(() => {
    if (isEmamiDb && activeTab === "price_violation") {
      loadPvFilters();
    }
  }, [isEmamiDb, activeTab, loadPvFilters]);

  useEffect(() => {
    if (!isEmamiDb && activeTab !== "raw_data") {
      setActiveTab("raw_data");
    }
  }, [isEmamiDb, activeTab]);

  const handleResetPv = () => {
    setPvSelectedPlatforms([]);
    setPvSelectedLocations([]);
    setPvSelectedSkus([]);
    setPvSelectedWebPids([]);
    setPvStartDate(null);
    setPvEndDate(null);
    setShowPvPreview(false);
    setPvRows([]);
    setPvTotal(0);
    setPvPage(0);
    if (initialPvFiltersRef.current) {
      setPvFilterOptions(initialPvFiltersRef.current);
    }
    loadPvFilters({});
  };

  const fetchPvPreview = useCallback(async (page = 0) => {
    setPvLoading(true);
    try {
      const params = { ...buildPvParams(), page: page + 1, limit: 50 };
      const data = await previewPriceViolationReport(params);
      setPvRows(data.rows || []);
      setPvTotal(data.totalCount || 0);
      setPvPage(page);
      setPvSummary(data.summary || { totalBreaches: 0, uniqueSkus: 0, uniquePlatforms: 0, maxViolation: 0 });
      setShowPvPreview(true);
    } catch (err) {
      console.error("[DownloadReport] Price Violation preview failed:", err);
      const msg = err.response?.data?.error || err.message || "Failed to load Price Violation preview data.";
      setErrorMessage(msg);
      setShowError(true);
    } finally {
      setPvLoading(false);
    }
  }, [buildPvParams]);

  const handleDownloadPv = async () => {
    setIsDownloadingPv(true);
    try {
      const blob = await downloadPriceViolationReport(buildPvParams());
      const fileName = `Price_Violation_Report_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
      saveAs(blob, fileName);
      setShowSuccess(true);
      fetchPvPreview(0);
    } catch (err) {
      console.error("[DownloadReport] Download Price Violation failed:", err);
      const msg = err.status === 204
        ? "No price violations found."
        : (err.response?.data?.error || err.message || "Failed to generate Price Violation report.");
      setErrorMessage(msg);
      setShowError(true);
    } finally {
      setIsDownloadingPv(false);
    }
  };

  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const p = {};
      if (skuType) p.skuType = skuType;
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
  }, [skuType, selectedPlatforms, selectedLocations, selectedPincodes, selectedBrands, selectedCategories, selectedSkus, selectedWebPids]);

  const loadPromoFilters = useCallback(async (customParams = null) => {
    setLoadingPromoFilters(true);
    try {
      const p = customParams !== null ? { ...customParams } : {};
      if (customParams === null) {
        if (promoSelectedKams.length > 0) p.kam = promoSelectedKams.join(",");
        if (promoSelectedAsms.length > 0) p.asm = promoSelectedAsms.join(",");
        if (promoSelectedPlatforms.length > 0) p.platform = promoSelectedPlatforms.join(",");
        if (promoSelectedSkus.length > 0) p.sku = promoSelectedSkus.join(",");
      }
      console.log("[DownloadReport] loadPromoFilters called with params:", p);
      const data = await fetchPromoViolationFilters(p);
      console.log("[DownloadReport] API returned minDate:", data.minDate, "maxDate:", data.maxDate);
      const newOptions = {
        kams: data.kams || [],
        asms: data.asms || [],
        platforms: data.platforms || [],
        skus: data.skus || [],
        minDate: data.minDate || null,
        maxDate: data.maxDate || null,
      };
      if (Object.keys(p).length === 0 && newOptions.kams.length > 0) {
        initialPromoFiltersRef.current = newOptions;
      }
      setPromoFilterOptions(newOptions);
    } catch (err) {
      console.error("[DownloadReport] Error loading promo filters:", err);
      if (initialPromoFiltersRef.current) {
        setPromoFilterOptions(initialPromoFiltersRef.current);
      }
    } finally {
      setLoadingPromoFilters(false);
    }
  }, [promoSelectedKams, promoSelectedAsms, promoSelectedPlatforms, promoSelectedSkus]);

  useEffect(() => {
    if (activeTab === "raw_data") {
      loadFilters();
    }
  }, [activeTab, loadFilters]);

  useEffect(() => {
    if (isEmamiDb && activeTab === "promo_violation") {
      loadPromoFilters();
    }
  }, [isEmamiDb, activeTab, loadPromoFilters]);

  const handleReset = () => {
    setSkuType("our");
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
    if (initialPromoFiltersRef.current) {
      setPromoFilterOptions(initialPromoFiltersRef.current);
    }
    loadPromoFilters({});
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
      setErrorMessage("Failed to load Promo Compliance preview data.");
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
      const fileName = `Promo_Compliance_Report_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
      saveAs(blob, fileName);
      setShowSuccess(true);
      fetchPromoPreview(0);
    } catch (err) {
      console.error("[DownloadReport] Download promo failed:", err);
      setErrorMessage(err.status === 204 ? "No promo compliance data found." : "Failed to generate Promo Compliance report.");
      setShowError(true);
    } finally {
      setIsDownloadingPromo(false);
    }
  };

  const availableDates = filterOptions.dates || [];
  const minDbDate = useMemo(() => {
    return availableDates.length > 0 ? dayjs(availableDates[availableDates.length - 1]) : dayjs('2024-01-01');
  }, [availableDates]);

  const maxDbDate = useMemo(() => {
    const d = availableDates.length > 0 ? dayjs(availableDates[0]) : dayjs();
    return (!isQcUserMode && d.isAfter(clientMaxAllowedDate)) ? clientMaxAllowedDate : d;
  }, [availableDates, isQcUserMode, clientMaxAllowedDate]);

  const promoMinDbDate = useMemo(() => {
    return promoFilterOptions.minDate ? dayjs(promoFilterOptions.minDate) : dayjs('2024-01-01');
  }, [promoFilterOptions.minDate]);

  const promoMaxDbDate = useMemo(() => {
    const d = promoFilterOptions.maxDate ? dayjs(promoFilterOptions.maxDate) : dayjs();
    return (!isQcUserMode && d.isAfter(clientMaxAllowedDate)) ? clientMaxAllowedDate : d;
  }, [promoFilterOptions.maxDate, isQcUserMode, clientMaxAllowedDate]);

  const pvMinDbDate = useMemo(() => {
    return pvFilterOptions.minDate ? dayjs(pvFilterOptions.minDate) : dayjs('2024-01-01');
  }, [pvFilterOptions.minDate]);

  const pvMaxDbDate = useMemo(() => {
    const d = pvFilterOptions.maxDate ? dayjs(pvFilterOptions.maxDate) : dayjs();
    return (!isQcUserMode && d.isAfter(clientMaxAllowedDate)) ? clientMaxAllowedDate : d;
  }, [pvFilterOptions.maxDate, isQcUserMode, clientMaxAllowedDate]);

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
            <ToggleButton value="raw_data">Availability/OSA</ToggleButton>
            {isEmamiDb && <ToggleButton value="promo_violation">Promo Compliance</ToggleButton>}
            {isEmamiDb && <ToggleButton value="price_violation">Price Violation</ToggleButton>}
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
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", fontFamily: "'Inter', sans-serif" }}>
                    Export Availability/OSA Weekly Data
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5, fontFamily: "'Inter', sans-serif" }}>
                    Select filter options below to generate a customized Excel export. Leaving dropdowns empty will include all values.
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <ToggleButtonGroup
                    value={skuType}
                    exclusive
                    onChange={(e, val) => {
                      if (val && val !== skuType) {
                        setSkuType(val);
                        setSelectedBrands([]);
                        setSelectedCategories([]);
                        setSelectedSkus([]);
                        setSelectedWebPids([]);
                      }
                    }}
                    size="small"
                    sx={{
                      backgroundColor: "#f1f5f9",
                      p: 0.5,
                      borderRadius: "12px",
                      border: "1px solid #cbd5e1",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      "& .MuiToggleButton-root": {
                        border: "none",
                        borderRadius: "9px",
                        px: 2.8,
                        py: 0.7,
                        fontWeight: 700,
                        textTransform: "none",
                        fontSize: "0.88rem",
                        color: "#64748b",
                        fontFamily: "'Inter', sans-serif",
                        "&.Mui-selected": {
                          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                          color: "#ffffff",
                          boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)"
                        }
                      }
                    }}
                  >
                    <ToggleButton value="our">Our</ToggleButton>
                    <ToggleButton value="competition">Competition</ToggleButton>
                  </ToggleButtonGroup>

                  <Tooltip title="Help information">
                    <IconButton sx={{ color: "#94a3b8" }}><HelpOutlineIcon /></IconButton>
                  </Tooltip>
                </Box>
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
                    onChange={(e, v) => setSelectedPlatforms(v)} limitTags={1} disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => <TextField {...p} label="Platform Name" placeholder="All Platforms" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={filterOptions.locations} value={selectedLocations}
                    onChange={(e, v) => setSelectedLocations(v)} limitTags={1} disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => <TextField {...p} label="Location" placeholder="All Locations" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={filterOptions.pincodes.map(String)} value={selectedPincodes}
                    onChange={(e, v) => setSelectedPincodes(v)} limitTags={1} disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => <TextField {...p} label="Pincode" placeholder="All Pincodes" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={filterOptions.brands} value={selectedBrands}
                    onChange={(e, v) => setSelectedBrands(v)} limitTags={1} disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => <TextField {...p} label="Brand Name" placeholder="All Brands" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={filterOptions.categories} value={selectedCategories}
                    onChange={(e, v) => setSelectedCategories(v)} limitTags={1} disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => <TextField {...p} label="Brand Category" placeholder="All Categories" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={filterOptions.skus} value={selectedSkus}
                    onChange={(e, v) => setSelectedSkus(v)} limitTags={1} disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => <TextField {...p} label="SKU Name" placeholder="All SKUs" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={filterOptions.webPids} value={selectedWebPids}
                    onChange={(e, v) => setSelectedWebPids(v)} limitTags={1} disableCloseOnSelect
                    renderOption={renderCheckboxOption}
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
        {isEmamiDb && activeTab === "promo_violation" && (
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
                    Export Promo Compliance Report
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5, fontFamily: "'Inter', sans-serif" }}>
                    Calculate promo compliance by joining KAM master with PDP dataset. Breached SKUs occur when Discount Operated &gt; Guardrail.
                  </Typography>
                </Box>
                <Tooltip title="Promo Compliance Report Help">
                  <IconButton sx={{ color: "#94a3b8" }}><HelpOutlineIcon /></IconButton>
                </Tooltip>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={promoFilterOptions.kams} value={promoSelectedKams}
                    onChange={(e, v) => setPromoSelectedKams(v)} limitTags={1} disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => <TextField {...p} label="KAM Name" placeholder="All KAMs" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={promoFilterOptions.platforms} value={promoSelectedPlatforms}
                    onChange={(e, v) => setPromoSelectedPlatforms(v)} limitTags={1} disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => <TextField {...p} label="Platform Name" placeholder="All Platforms" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={promoFilterOptions.skus} value={promoSelectedSkus}
                    onChange={(e, v) => setPromoSelectedSkus(v)} limitTags={1} disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => <TextField {...p} label="SKU Name" placeholder="All SKUs" variant="outlined" InputLabelProps={{ shrink: true }} />}
                    sx={acSx} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete multiple options={promoFilterOptions.asms} value={promoSelectedAsms}
                    onChange={(e, v) => setPromoSelectedAsms(v)} limitTags={1} disableCloseOnSelect
                    renderOption={renderCheckboxOption}
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
                              Pincodes / Date
                            </TableCell>
                          </React.Fragment>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {promoRows.length === 0 && !promoLoading ? (
                        <TableRow>
                          <TableCell colSpan={6 + 2 * promoLocationsList.length} align="center" sx={{ py: 6, color: "#94a3b8" }}>
                            No promo compliance breaches found for selected filters.
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
                            {promoLocationsList.map((loc) => {
                              const pinStr = row.pincodeStrings?.[loc] || "";
                              const pinList = pinStr ? pinStr.split(", ").filter(Boolean) : [];
                              return (
                                <React.Fragment key={`city-vals-${loc}`}>
                                  <TableCell align="center" sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e293b", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", py: 1 }}>
                                    {row.pincodeCounts?.[loc] !== "" ? row.pincodeCounts[loc] : ""}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: "0.76rem", color: "#475569", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", py: 1, minWidth: 170 }}>
                                    {pinList.length === 0 ? (
                                      "—"
                                    ) : (
                                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, alignItems: "center", justifyContent: "center" }}>
                                        {pinList.map((item, pIdx) => (
                                          <Chip
                                            key={pIdx}
                                            label={item}
                                            size="small"
                                            sx={{
                                              fontSize: "0.73rem",
                                              height: "22px",
                                              backgroundColor: "#eff6ff",
                                              color: "#1d4ed8",
                                              fontWeight: 600,
                                              border: "1px solid #bfdbfe",
                                              borderRadius: "6px",
                                              whiteSpace: "nowrap",
                                              fontFamily: "'Inter', sans-serif",
                                              "& .MuiChip-label": { px: 1, py: 0.2 }
                                            }}
                                          />
                                        ))}
                                      </Box>
                                    )}
                                  </TableCell>
                                </React.Fragment>
                              );
                            })}
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

        {/* ── TAB 3: PRICE VIOLATION MODE ── */}
        {isEmamiDb && activeTab === "price_violation" && (
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
                    Export Price Violation Report
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5, fontFamily: "'Inter', sans-serif" }}>
                    Identifies SKU price violations where Current MRP (from PDP) exceeds Master MRP (from Emami Master DB).
                  </Typography>
                </Box>
                <Tooltip title="Price Violation Report Help">
                  <IconButton sx={{ color: "#94a3b8" }}><HelpOutlineIcon /></IconButton>
                </Tooltip>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    multiple
                    options={pvFilterOptions.platforms?.length > 0 ? pvFilterOptions.platforms : (initialPvFiltersRef.current?.platforms || [])}
                    value={pvSelectedPlatforms}
                    onChange={(e, v) => setPvSelectedPlatforms(v)}
                    limitTags={1}
                    disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => (
                      <TextField {...p} label="Platform Name" placeholder="All Platforms" variant="outlined" InputLabelProps={{ shrink: true }} />
                    )}
                    sx={acSx}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    multiple
                    options={pvFilterOptions.locations?.length > 0 ? pvFilterOptions.locations : (initialPvFiltersRef.current?.locations || [])}
                    value={pvSelectedLocations}
                    onChange={(e, v) => setPvSelectedLocations(v)}
                    limitTags={1}
                    disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => (
                      <TextField {...p} label="Location" placeholder="All Locations" variant="outlined" InputLabelProps={{ shrink: true }} />
                    )}
                    sx={acSx}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    multiple
                    options={pvFilterOptions.skus?.length > 0 ? pvFilterOptions.skus : (initialPvFiltersRef.current?.skus || [])}
                    value={pvSelectedSkus}
                    onChange={(e, v) => setPvSelectedSkus(v)}
                    limitTags={1}
                    disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => (
                      <TextField {...p} label="SKU Name" placeholder="All SKUs" variant="outlined" InputLabelProps={{ shrink: true }} />
                    )}
                    sx={acSx}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    multiple
                    options={pvFilterOptions.webPids?.length > 0 ? pvFilterOptions.webPids : (initialPvFiltersRef.current?.webPids || [])}
                    value={pvSelectedWebPids}
                    onChange={(e, v) => setPvSelectedWebPids(v)}
                    limitTags={1}
                    disableCloseOnSelect
                    renderOption={renderCheckboxOption}
                    renderInput={(p) => (
                      <TextField {...p} label="Web PID" placeholder="All Web PIDs" variant="outlined" InputLabelProps={{ shrink: true }} />
                    )}
                    sx={acSx}
                  />
                </Grid>
                <Grid item xs={12} sm={12} md={6}>
                  <Box sx={{ display: "flex", gap: 2, width: "100%" }}>
                    <DatePicker
                      label="Start Date"
                      value={pvStartDate}
                      onChange={(v) => setPvStartDate(v)}
                      minDate={pvMinDbDate || undefined}
                      maxDate={pvEndDate || pvMaxDbDate || undefined}
                      slotProps={{
                        textField: { fullWidth: true, variant: "outlined", InputLabelProps: { shrink: true }, sx: dpSx },
                        field: { clearable: true }
                      }}
                    />
                    <DatePicker
                      label="End Date"
                      value={pvEndDate}
                      onChange={(v) => setPvEndDate(v)}
                      minDate={pvStartDate || pvMinDbDate || undefined}
                      maxDate={pvMaxDbDate || undefined}
                      slotProps={{
                        textField: { fullWidth: true, variant: "outlined", InputLabelProps: { shrink: true }, sx: dpSx },
                        field: { clearable: true }
                      }}
                    />
                  </Box>
                </Grid>
              </Grid>

              <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 2, mt: 4, pt: 3, borderTop: "1px solid rgba(226, 232, 240, 0.6)" }}>
                {loadingPvFilters && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: "auto" }}>
                    <CircularProgress size={16} sx={{ color: "#2563eb" }} />
                    <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500 }}>Loading filter options...</Typography>
                  </Box>
                )}
                <Button
                  variant="outlined"
                  onClick={handleResetPv}
                  startIcon={<RefreshIcon />}
                  sx={{
                    textTransform: "none", borderRadius: "12px", borderColor: "#cbd5e1", color: "#64748b", fontWeight: 650, px: 3, py: 1.2,
                    "&:hover": { borderColor: "#94a3b8", backgroundColor: "#f8fafc" }
                  }}
                >
                  Reset Filters
                </Button>
                <Button
                  variant="contained"
                  onClick={() => fetchPvPreview(0)}
                  disabled={pvLoading}
                  startIcon={pvLoading ? <CircularProgress size={18} color="inherit" /> : <FilterAltIcon />}
                  sx={{
                    textTransform: "none", borderRadius: "12px", background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "white", fontWeight: 700, px: 4, py: 1.2, boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
                    "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37, 99, 235, 0.35)" }
                  }}
                >
                  {pvLoading ? "Applying..." : "Apply"}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleDownloadPv}
                  disabled={isDownloadingPv}
                  startIcon={isDownloadingPv ? <CircularProgress size={18} color="inherit" /> : <CloudDownloadIcon />}
                  sx={{
                    textTransform: "none", borderRadius: "12px", background: "linear-gradient(135deg, #334155 0%, #1e293b 100%)",
                    color: "white", fontWeight: 700, px: 4, py: 1.2, boxShadow: "0 4px 14px rgba(51, 65, 85, 0.25)",
                    "&:hover": { background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", boxShadow: "0 6px 20px rgba(51, 65, 85, 0.35)" }
                  }}
                >
                  {isDownloadingPv ? "Downloading..." : "Download Report"}
                </Button>
              </Box>
            </Paper>

            {/* Price Violation Preview Table */}
            {showPvPreview && (
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
                <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", flexWrap: "wrap", gap: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                    <Chip
                      label="Price Violation Report"
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
                      label={`${pvTotal} Breached Items`}
                      size="small"
                      sx={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", fontWeight: 700, fontSize: "0.75rem" }}
                    />
                    {pvSummary.uniqueSkus > 0 && (
                      <Chip
                        label={`Impacted SKUs: ${pvSummary.uniqueSkus}`}
                        size="small"
                        sx={{ backgroundColor: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", fontWeight: 650, fontSize: "0.75rem" }}
                      />
                    )}
                    {pvSummary.uniquePlatforms > 0 && (
                      <Chip
                        label={`Platforms: ${pvSummary.uniquePlatforms}`}
                        size="small"
                        sx={{ backgroundColor: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontWeight: 650, fontSize: "0.75rem" }}
                      />
                    )}
                    {pvSummary.maxViolation > 0 && (
                      <Chip
                        label={`Max Breach: +₹${pvSummary.maxViolation}`}
                        size="small"
                        sx={{ backgroundColor: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", fontWeight: 700, fontSize: "0.75rem" }}
                      />
                    )}
                  </Box>
                  {pvLoading && <CircularProgress size={20} sx={{ color: "#2563eb" }} />}
                </Box>

                <TableContainer sx={{ maxHeight: 600 }}>
                  <Table stickyHeader size="small" sx={{ borderCollapse: "separate", borderSpacing: 0 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: "0.8rem", borderBottom: "1px solid #e2e8f0", py: 1.2 }}>
                          SKU Name
                        </TableCell>
                        <TableCell sx={{ backgroundColor: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: "0.8rem", borderBottom: "1px solid #e2e8f0", py: 1.2 }}>
                          Web PID
                        </TableCell>
                        <TableCell sx={{ backgroundColor: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: "0.8rem", borderBottom: "1px solid #e2e8f0", py: 1.2 }}>
                          Platform
                        </TableCell>
                        <TableCell sx={{ backgroundColor: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: "0.8rem", borderBottom: "1px solid #e2e8f0", py: 1.2 }}>
                          Location
                        </TableCell>
                        <TableCell align="center" sx={{ backgroundColor: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: "0.8rem", borderBottom: "1px solid #e2e8f0", py: 1.2 }}>
                          Date
                        </TableCell>
                        <TableCell align="right" sx={{ backgroundColor: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: "0.8rem", borderBottom: "1px solid #e2e8f0", py: 1.2 }}>
                          MRP Master (₹)
                        </TableCell>
                        <TableCell align="right" sx={{ backgroundColor: "#fff1f2", color: "#be123c", fontWeight: 700, fontSize: "0.8rem", borderBottom: "1px solid #fecdd3", py: 1.2 }}>
                          Current MRP (₹)
                        </TableCell>
                        <TableCell align="right" sx={{ backgroundColor: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: "0.8rem", borderBottom: "1px solid #e2e8f0", py: 1.2 }}>
                          Selling Price (₹)
                        </TableCell>
                        <TableCell align="center" sx={{ backgroundColor: "#fef2f2", color: "#991b1b", fontWeight: 700, fontSize: "0.8rem", borderBottom: "1px solid #fecaca", py: 1.2 }}>
                          Violation (Diff)
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pvRows.length === 0 && !pvLoading ? (
                        <TableRow>
                          <TableCell colSpan={9} align="center" sx={{ py: 6, color: "#94a3b8" }}>
                            No price violations found for selected filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pvRows.map((row, idx) => (
                          <TableRow key={idx} hover sx={{ "&:nth-of-type(even)": { backgroundColor: "#fafbfc" }, "&:hover": { backgroundColor: "#f1f5f9" } }}>
                            <TableCell sx={{ fontSize: "0.78rem", fontWeight: 650, color: "#0f172a", borderBottom: "1px solid #f1f5f9", py: 1, textTransform: "uppercase" }}>
                              {row.sku}
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", fontFamily: "monospace", borderBottom: "1px solid #f1f5f9", py: 1 }}>
                              {row.web_pid}
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e293b", borderBottom: "1px solid #f1f5f9", py: 1, textTransform: "capitalize" }}>
                              {row.platform}
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.78rem", color: "#475569", borderBottom: "1px solid #f1f5f9", py: 1, textTransform: "capitalize" }}>
                              {row.location}
                            </TableCell>
                            <TableCell align="center" sx={{ fontSize: "0.78rem", color: "#64748b", borderBottom: "1px solid #f1f5f9", py: 1 }}>
                              {row.date}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155", borderBottom: "1px solid #f1f5f9", py: 1 }}>
                              ₹{Number(row.Mrp_master).toFixed(2)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#be123c", backgroundColor: "#fff1f2", borderBottom: "1px solid #ffe4e6", py: 1 }}>
                              ₹{Number(row.current_mrp).toFixed(2)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: "0.78rem", color: "#475569", borderBottom: "1px solid #f1f5f9", py: 1 }}>
                              ₹{Number(row.selling_price).toFixed(2)}
                            </TableCell>
                            <TableCell align="center" sx={{ borderBottom: "1px solid #f1f5f9", py: 1 }}>
                              <Chip
                                label={`+₹${Number(row.price_violation).toFixed(2)}`}
                                size="small"
                                sx={{
                                  backgroundColor: "#fee2e2",
                                  color: "#b91c1c",
                                  border: "1px solid #fecaca",
                                  fontWeight: 700,
                                  fontSize: "0.74rem",
                                  height: "22px"
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component="div"
                  count={pvTotal}
                  page={pvPage}
                  onPageChange={(e, newPage) => fetchPvPreview(newPage)}
                  rowsPerPage={50}
                  rowsPerPageOptions={[50]}
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
