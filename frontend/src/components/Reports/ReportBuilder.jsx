import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Snackbar,
  Alert,
  Grid,
  Divider,
  CircularProgress,
  Card,
  Tooltip,
  Fade,
  Collapse,
} from "@mui/material";
import {
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Email as EmailIcon,
  Delete as DeleteIcon,
  AddCircle as AddCircleIcon,
  Close as CloseIcon,
  FilterList as FilterListIcon,
  CalendarMonth as CalendarIcon,
  Category as CategoryIcon,
  Assessment as AssessmentIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Store as StoreIcon,
  Place as PlaceIcon,
  Tune as TuneIcon,
  Speed as SpeedIcon,
  Visibility as VisibilityIcon,
  Inventory as InventoryIcon,
  Discount as DiscountIcon,
  Star as StarIcon,
  BarChart as BarChartIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  TrendingUp as TrendingUpIcon,
  ShowChart as ShowChartIcon,
  ContentPaste as ContentPasteIcon,
  PieChart as PieChartIcon,
  AccountTree as AccountTreeIcon,
  Dashboard as DashboardIcon,
  Campaign as CampaignIcon,
} from "@mui/icons-material";
import { HelpOutline as HelpIcon } from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs from "dayjs";
import { useHelp } from "../../utils/HelpContext";
import { useAuth } from "../../utils/AuthContext";

/* ─────────────────────────────────────────────────────────────
   PLATFORM VISUAL MAP  (colors & icons for known platforms)
───────────────────────────────────────────────────────────── */
const PLATFORM_META = {
  blinkit: { color: "#F59E0B", icon: "B" },
  zepto: { color: "#EC4899", icon: "Z" },
  instamart: { color: "#10B981", icon: "I" },
  "bb now": { color: "#3B82F6", icon: "B" },
  "fk minutes": { color: "#F97316", icon: "F" },
  amazon: { color: "#FF9900", icon: "A" },
  flipkart: { color: "#2874F0", icon: "F" },
  "jio mart": { color: "#0078AD", icon: "J" },
  myntra: { color: "#FF3E6C", icon: "M" },
  nykaa: { color: "#FC2779", icon: "N" },
  bigbasket: { color: "#84C225", icon: "B" },
  // fallback handled below
};
const DEFAULT_COLORS = ["#4F46E5", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#3B82F6", "#F97316", "#06B6D4"];
const getPlatformMeta = (name, index) => {
  const key = name.toLowerCase();
  if (PLATFORM_META[key]) return PLATFORM_META[key];
  return { color: DEFAULT_COLORS[index % DEFAULT_COLORS.length], icon: name.charAt(0).toUpperCase() };
};

/* ─────────────────────────────────────────────────────────────
   STATIC GRANULARITY & METRICS
───────────────────────────────────────────────────────────── */
const SKU_OPTS = ["Category", "Brand (Own)", "Brand (Own + Comp)", "SKU (Own)", "SKU (Own + Comp)"];
const GEO_OPTS = ["Pan India", "City (Expanded)"];
const TIME_OPTS = ["Daily", "Weekly", "Monthly"];

/* ── Platform → KPI Exclusions map ──
   By default, all KPIs are considered available across all platforms.
   Use this map to explicitly hide specific KPIs when a certain platform is selected.
*/
const PLATFORM_UNAVAILABLE_KPIS = {
  // Example: Amazon does not provide 'Listing %'
  "amazon": ["Listing %"]
  // Add more specific platform -> KPI exclusions here as needed
};


const PAGE_METRICS = [
  {
    key: "Business Overview", label: "Business Overview", icon: <DashboardIcon />, color: "#4F46E5",
    tags: ["Offtake", "Quantity Sold", "Orders", "Listing %", "Inorganic Sales", "ROAS", "Conversion Rate", "CPM", "CPC", "Buy Box %"],
    activeInSidebar: true
  },
  {
    key: "Sales Data", label: "Sales Data", icon: <TrendingUpIcon />, color: "#2563EB",
    tags: ["DRR"],
    activeInSidebar: true
  },
  {
    key: "Availability Analysis", label: "Availability Analysis", icon: <InventoryIcon />, color: "#10B981",
    tags: ["OSA %", "Buy Box %", "DOI", "PSL", "Assortment"],
    activeInSidebar: true
  },
  {
    key: "Visibility Analysis", label: "Visibility Analysis", icon: <VisibilityIcon />, color: "#8B5CF6",
    tags: ["Overall SOS %", "Sponsored SOS %", "Organic SOS %", "Ad Position", "Org Position"],
    activeInSidebar: true
  },
  {
    key: "Pricing Analysis", label: "Pricing Analysis", icon: <DiscountIcon />, color: "#F59E0B",
    tags: ["Selling Price", "MRP", "Discount %"],
    activeInSidebar: true, hideForDb: ['mamaearth']
  },
  {
    key: "Performance Marketing", label: "Performance Marketing", icon: <CampaignIcon />, color: "#EF4444",
    tags: ["Impressions", "Clicks", "Spend", "Inorganic Sales", "ROAS", "Conversion Rate", "CPM", "CPC", "AOV"],
    activeInSidebar: true, hideForDb: ['mamaearth', 'boat']
  },
  {
    key: "Inventory Analysis", label: "Inventory Analysis", icon: <StoreIcon />, color: "#06B6D4",
    tags: ["Current Inventory", "Days on Hand"],
    activeInSidebar: true, hideForDb: ['mamaearth', 'boat']
  },
  {
    key: "Content Analysis", label: "Content Analysis", icon: <ContentPasteIcon />, color: "#EC4899",
    tags: ["Overall Content Score", "Title Score", "Image Score", "Description Score", "Title Length", "Word Count"],
    activeInSidebar: true, showOnlyForDb: ['mars']
  },
  {
    key: "Market Share", label: "Market Share", icon: <PieChartIcon />, color: "#14B8A6",
    tags: ["Market Share %", "Category Size"],
    activeInSidebar: true, hideForDb: ['mars_petcare']
  },
  {
    key: "Category RCA", label: "Category RCA", icon: <AccountTreeIcon />, color: "#F97316",
    tags: [],
    activeInSidebar: true
  },
  {
    key: "Portfolio Analysis", label: "Portfolio Analysis", icon: <ShowChartIcon />, color: "#A855F7",
    tags: ["ASP"],
    activeInSidebar: true
  },
];

const STEPS = [
  { id: 0, label: "Platform", icon: <CategoryIcon /> },
  { id: 1, label: "Granularity", icon: <TuneIcon /> },
  { id: 2, label: "Metrics", icon: <SpeedIcon /> },
];

/* ─────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────── */
export default function ReportBuilder({
  selectedFilters,
  handleFilterChange,
  handleDownload: parentHandleDownload,
  isDownloading,
  showSuccess,
  setShowSuccess,
  showError,
  setShowError,
  errorMsg,
  platformOptions,
  getBrandOptions,
  getCategoryOptions,
  getSkuOptions,
  getLocationOptions,
  timePeriodOptions,
  reportTypeOptions = [],
  customDateRange,
  setCustomDateRange,
  scheduledReports = [],
  onScheduleAdd,
  onScheduleDelete,
  scheduleSuccess,
  setScheduleSuccess,
  builderOptions = {},
}) {
  const { toggleHelp } = useHelp();
  const { user } = useAuth();

  // ── Dynamic platform list from backend ──
  const dynamicPlatforms = useMemo(() => {
    const raw = builderOptions.platforms || [];
    return raw.map((name, i) => ({
      id: name,
      label: name,
      ...getPlatformMeta(name, i),
    }));
  }, [builderOptions.platforms]);

  // ── Dynamic filter dimension options from backend ──
  const FILTER_OPTS = useMemo(() => {
    const opts = ["Category", "Brand", "City", "Product"];
    if (builderOptions.subCategories?.length > 0) opts.push("Sub-Category");
    if (builderOptions.regions?.length > 0) opts.push("Region");
    return opts;
  }, [builderOptions]);

  // ── Local wizard state ──
  const [step, setStep] = useState(0);

  // Platform toggles — initialize all ON once dynamic list arrives
  const [platforms, setPlatforms] = useState({});
  useEffect(() => {
    if (dynamicPlatforms.length > 0 && Object.keys(platforms).length === 0) {
      const init = {};
      dynamicPlatforms.forEach(p => { init[p.id] = true; });
      setPlatforms(init);
    }
  }, [dynamicPlatforms]);

  const handleSelectAllPlatforms = () => {
    const next = {};
    dynamicPlatforms.forEach(p => { next[p.id] = true; });
    setPlatforms(next);
  };

  const handleClearPlatforms = () => {
    const next = {};
    dynamicPlatforms.forEach(p => { next[p.id] = false; });
    setPlatforms(next);
  };

  const [sku, setSku] = useState("Category");
  const [geo, setGeo] = useState("Pan India");
  const [time, setTime] = useState("Daily");
  const [filters, setFilters] = useState(["Category", "Brand", "City"]);
  const [showFilterOpts, setShowFilterOpts] = useState(false);
  const isDrl = user?.dbName?.toLowerCase() === 'drl';
  const [dataMode, setDataMode] = useState("aggregated"); // "aggregated" | "darkstore"

  // Sync date range bounds when switching dataMode to darkstore for DRL
  useEffect(() => {
    if (dataMode === 'darkstore' && builderOptions?.darkstoreDateRange) {
      setStartDate(dayjs(builderOptions.darkstoreDateRange.minDate));
      setEndDate(dayjs(builderOptions.darkstoreDateRange.maxDate));
    }
  }, [dataMode, builderOptions?.darkstoreDateRange]);

  // ── Filter PAGE_METRICS to only show available report types and allowed permissions ──
  const visibleMetrics = useMemo(() => {
    // Only include metrics/pages that are active in the left sidebar
    // We deep clone tags to allow dynamic filtering below without mutating original
    let metrics = PAGE_METRICS.filter(m => m.activeInSidebar).map(m => ({ ...m, tags: [...m.tags] }));

    if (reportTypeOptions && reportTypeOptions.length > 0) {
      metrics = metrics.filter(m => reportTypeOptions.includes(m.key));
    }

    const dbName = user?.dbName;

    metrics = metrics.filter(m => {
      // 1. Hide everything if user DB status is inactive
      if (user?.dbStatus === false) return false;

      // 2. DB specific exclusions matching database capability rules
      if (m.showOnlyForDb && !m.showOnlyForDb.includes(dbName)) return false;
      if (m.hideForDb && m.hideForDb.includes(dbName)) return false;

      // Note: KPI options in Scheduled Reports are available regardless of individual sidebar page visibility
      return true;
    });

    // 4. Hide specific KPIs if "SKU" level granularity is selected
    if (sku.includes("SKU")) {
      const KPIsToHide = ["Inorganic Sales", "Conversion Rate", "ROAS", "Orders", "CPC", "CPM"];
      metrics = metrics.map(m => ({
        ...m,
        tags: m.tags.filter(tag => !KPIsToHide.includes(tag))
      }));
    }

    return metrics.filter(m => m.tags.length > 0);
  }, [reportTypeOptions, user, sku]);

  const [metricOn, setMetricOn] = useState(
    Object.fromEntries(PAGE_METRICS.map(m => [m.key, true]))
  );
  const [tagOn, setTagOn] = useState(
    Object.fromEntries(PAGE_METRICS.flatMap(m => m.tags.map(t => [t, true])))
  );

  const platCount = Object.values(platforms).filter(Boolean).length;
  const allTags = useMemo(() => Array.from(new Set(visibleMetrics.flatMap(m => m.tags))), [visibleMetrics]);

  // ── Platform-aware KPI availability ──
  // Compute which KPIs are available based on selected platforms
  const availableKpis = useMemo(() => {
    const selectedPlatformNames = Object.entries(platforms).filter(([, on]) => on).map(([id]) => id.toLowerCase().trim());
    const availableTags = new Set(allTags); // Default to all configured tags

    if (selectedPlatformNames.length === 0) return availableTags;

    // Hide a KPI only if EVERY selected platform specifically excludes it
    allTags.forEach(tag => {
      // Find which of the selected platforms explicitly forbid this tag
      const excludingPlatforms = selectedPlatformNames.filter(p =>
        PLATFORM_UNAVAILABLE_KPIS[p] && PLATFORM_UNAVAILABLE_KPIS[p].includes(tag)
      );

      // If the tag is excluded by ALL currently selected platforms, hide it
      // (e.g., if only Amazon is selected, hide 'Listing %'. If Amazon and Blinkit, keep it since Blinkit has it).
      if (excludingPlatforms.length === selectedPlatformNames.length) {
        availableTags.delete(tag);
      }
    });

    return availableTags;
  }, [platforms, allTags]);

  const totalTags = allTags.length;
  const onTags = useMemo(() => allTags.filter(t => tagOn[t] && availableKpis.has(t)).length, [allTags, tagOn, availableKpis]);

  // ── Date range state ──
  const [startDate, setStartDate] = useState(customDateRange?.startDate || dayjs().subtract(30, 'day'));
  const [endDate, setEndDate] = useState(customDateRange?.endDate || dayjs());
  const daysDiff = endDate.diff(startDate, 'day');

  // Sync date range to parent
  useEffect(() => {
    if (setCustomDateRange) {
      setCustomDateRange({ startDate, endDate });
    }
  }, [startDate, endDate]);

  // ── Schedule modal state ──
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    email: "",
    frequency: "Daily",
    time: dayjs().hour(9).minute(0),
  });
  const [emailError, setEmailError] = useState("");

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleScheduleSave = () => {
    if (!scheduleForm.email) { setEmailError("Email is required"); return; }
    if (!validateEmail(scheduleForm.email)) { setEmailError("Please enter a valid email"); return; }
    onScheduleAdd({
      email: scheduleForm.email,
      frequency: scheduleForm.frequency,
      time: scheduleForm.time.format("hh:mm A"),
    });
    setScheduleForm({ email: "", frequency: "Daily", time: dayjs().hour(9).minute(0) });
    setEmailError("");
    setScheduleModalOpen(false);
  };

  const toggleFilter = (f) => {
    setFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  // ── Wire wizard state to parent and trigger download ──
  const handleDownload = () => {
    // 1. Pack Platform Filter
    const selectedPlatforms = Object.entries(platforms).filter(([, on]) => on).map(([id]) => id);
    let platformOverride = selectedPlatforms.join(',');
    handleFilterChange("platform", selectedPlatforms.length === 1 ? selectedPlatforms[0] : "All");

    // 2. Set time period based on date range
    handleFilterChange("timePeriod", "Custom Range");

    // 3. Set report type — Send custom Master Dump to trigger massive join backend query
    handleFilterChange("reportType", "Master Dump");

    // Pass latest values to parent directly to avoid React state timing bugs
    // Only send KPIs that are both selected AND available for the chosen platforms
    const activeTags = allTags.filter(t => tagOn[t] && availableKpis.has(t)).join(",");
    const activeDimensions = filters.join(",");
    const customDates = {
      start: dayjs(startDate).format("YYYY-MM-DD"),
      end: dayjs(endDate).format("YYYY-MM-DD")
    };

    parentHandleDownload({
      reportType: dataMode === "darkstore" ? "Darkstore Data" : "Master Dump",
      dataMode: dataMode,
      metrics: activeTags,
      dimensions: activeDimensions,
      platform: platformOverride,
      granularitySku: sku,
      granularityGeo: geo,
      granularityTime: time,
      overrideDates: customDates
    });
  };

  // ── Toast helper ──
  const SuccessToast = ({ open, message, onClose, color = "success" }) => (
    <Snackbar open={open} autoHideDuration={4000} onClose={onClose} anchorOrigin={{ vertical: "top", horizontal: "right" }} sx={{ zIndex: 2000 }}>
      <Alert severity={color} onClose={onClose} sx={{ width: "100%", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontWeight: 500 }}>
        {message}
      </Alert>
    </Snackbar>
  );

  // ── Loading state ──
  const isLoading = dynamicPlatforms.length === 0;

  /* ─────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────── */
  return (
    <Box sx={{ minHeight: "calc(100vh - 140px)", background: "#F8FAFC", borderRadius: "16px", p: { xs: 2, md: 3 }, fontFamily: "'Roboto', sans-serif" }}>
      <Box sx={{ maxWidth: "1400px", mx: "auto" }}>

        {/* ── HEADER ── */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 3, mb: 3 }}>
          <Box sx={{ p: 2, borderRadius: "16px", background: "linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)", color: "white", boxShadow: "0 8px 16px rgba(79,70,229,0.2)" }}>
            <AssessmentIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#1E293B", mb: 0.5 }}>
              Schedule Report
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748B" }}>
              Configure, download, and schedule automated reports for your business metrics.
            </Typography>
          </Box>
          <IconButton onClick={toggleHelp} size="small" sx={{ bgcolor: "rgba(37,99,235,0.05)", color: "#2563eb", "&:hover": { bgcolor: "rgba(37,99,235,0.1)" }, border: "1px solid rgba(37,99,235,0.1)", width: 32, height: 32 }}>
            <HelpIcon sx={{ fontSize: "1.2rem" }} />
          </IconButton>
        </Box>

        {/* ── Loading state ── */}
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <CircularProgress sx={{ color: "#4F46E5" }} />
            <Typography sx={{ ml: 2, color: "#64748B" }}>Loading options…</Typography>
          </Box>
        ) : (
          /* ══════════════════════════════════════════════════════
              REPORT BUILDER
          ══════════════════════════════════════════════════════ */
          <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>

            {/* ── STEP RAIL ── */}
            <Paper elevation={0} sx={{ width: 72, flexShrink: 0, border: "1px solid #E2E8F0", borderRadius: "16px", display: "flex", flexDirection: "column", alignItems: "center", py: 2.5, gap: 0.5, background: "white" }}>
              {STEPS.map((s, i) => (
                <React.Fragment key={s.id}>
                  <Box
                    onClick={() => setStep(s.id)}
                    sx={{
                      width: 48, height: 48, borderRadius: "12px", display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: "2px", cursor: "pointer",
                      border: "1.5px solid",
                      transition: "all 0.2s",
                      borderColor: step === s.id ? "#4F46E5" : step > s.id ? "#10B981" : "#E2E8F0",
                      background: step === s.id ? "#EEF2FF" : step > s.id ? "#F0FDF4" : "transparent",
                      color: step === s.id ? "#4F46E5" : step > s.id ? "#10B981" : "#94A3B8",
                      "&:hover": { borderColor: step === s.id ? "#4F46E5" : "#CBD5E1", background: step === s.id ? "#EEF2FF" : "#F8FAFC" },
                    }}
                  >
                    <Box sx={{ fontSize: 18, display: "flex" }}>
                      {step > s.id ? <CheckCircleOutlineIcon sx={{ fontSize: 18 }} /> : s.icon}
                    </Box>
                    <Typography sx={{ fontSize: "9px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>
                      {String(s.id + 1).padStart(2, "0")}
                    </Typography>
                  </Box>
                  {i < STEPS.length - 1 && (
                    <Box sx={{ width: "1.5px", height: 14, background: step > s.id ? "#10B981" : "#E2E8F0", borderRadius: 1 }} />
                  )}
                </React.Fragment>
              ))}
            </Paper>

            {/* ── MAIN CONTENT ── */}
            <Paper elevation={0} sx={{ flex: 1, border: "1px solid #E2E8F0", borderRadius: "16px", p: 3, minHeight: 420, background: "white" }}>

              {/* ── STEP 0: PLATFORM ── */}
              {step === 0 && (
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 1.5 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#1E293B", mb: 0.5 }}>Select Platforms</Typography>
                      <Typography variant="body2" sx={{ color: "#64748B" }}>Choose data sources to include in this report</Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        size="small"
                        onClick={handleSelectAllPlatforms}
                        sx={{
                          textTransform: "none",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#4F46E5",
                          borderRadius: "8px",
                          px: 1.8,
                          py: 0.5,
                          border: "1px solid rgba(79, 70, 229, 0.2)",
                          background: "#EEF2FF",
                          "&:hover": { background: "#E0E7FF" },
                        }}
                      >
                        Select All
                      </Button>
                      <Button
                        size="small"
                        onClick={handleClearPlatforms}
                        sx={{
                          textTransform: "none",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#64748B",
                          borderRadius: "8px",
                          px: 1.8,
                          py: 0.5,
                          border: "1px solid #E2E8F0",
                          background: "#F8FAFC",
                          "&:hover": { background: "#F1F5F9", borderColor: "#CBD5E1" },
                        }}
                      >
                        Clear
                      </Button>
                    </Box>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 1.5, mb: 3 }}>
                    {dynamicPlatforms.map(p => {
                      const isOn = platforms[p.id] || false;
                      return (
                        <Paper
                          key={p.id}
                          elevation={0}
                          onClick={() => setPlatforms(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                          sx={{
                            p: 2, borderRadius: "12px", cursor: "pointer", position: "relative",
                            border: "1.5px solid", transition: "all 0.2s",
                            borderColor: isOn ? p.color : "#E2E8F0",
                            background: isOn ? `${p.color}08` : "white",
                            "&:hover": { borderColor: isOn ? p.color : "#CBD5E1", transform: "translateY(-2px)", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" },
                          }}
                        >
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
                            <Box sx={{ width: 36, height: 36, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, background: `${p.color}15`, color: p.color }}>
                              {p.icon}
                            </Box>
                            <Typography sx={{ fontSize: 13, fontWeight: 600, color: isOn ? "#1E293B" : "#64748B" }}>{p.label}</Typography>
                          </Box>
                          <Box sx={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, border: isOn ? "none" : "1.5px solid #CBD5E1", background: isOn ? p.color : "transparent", color: isOn ? "#fff" : "transparent", transition: "all 0.2s" }}>
                            {isOn && "✓"}
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>


                  {/* Nav */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 2, borderTop: "1px solid #E2E8F0" }}>
                    <Typography sx={{ fontSize: 12, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
                      {platCount} platform{platCount !== 1 ? "s" : ""} selected
                    </Typography>
                    <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => setStep(1)} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", background: "#4F46E5", "&:hover": { background: "#4338CA" } }}>
                      Continue
                    </Button>
                  </Box>
                </Box>
              )}

              {/* ── STEP 1: GRANULARITY ── */}
              {step === 1 && (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#1E293B", mb: 0.5 }}>Set Granularity</Typography>
                  <Typography variant="body2" sx={{ color: "#64748B", mb: 3 }}>Define how data is grouped across SKU, geography, and time</Typography>

                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    {[
                      { label: "SKU Level", opts: SKU_OPTS, val: sku, set: setSku, color: "#4F46E5" },
                      { label: "Geography", opts: GEO_OPTS, val: geo, set: setGeo, color: "#10B981" },
                      { label: "Time", opts: TIME_OPTS, val: time, set: setTime, color: "#F59E0B" },
                    ].map(g => (
                      <Grid item xs={12} sm={4} key={g.label}>
                        <Typography component="div" sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#94A3B8", mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                          {g.label}
                          <Box sx={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
                        </Typography>
                        {g.opts.map(o => {
                          const isSel = g.val === o;
                          return (
                            <Box
                              key={o}
                              onClick={() => g.set(o)}
                              sx={{
                                display: "flex", alignItems: "center", gap: 1, p: "10px 14px", mb: 0.8,
                                borderRadius: "10px", cursor: "pointer", fontSize: 13, fontWeight: isSel ? 600 : 400,
                                border: "1.5px solid", transition: "all 0.15s",
                                borderColor: isSel ? g.color : "#E2E8F0",
                                background: isSel ? `${g.color}08` : "transparent",
                                color: isSel ? g.color : "#64748B",
                                "&:hover": { borderColor: isSel ? g.color : "#CBD5E1", background: isSel ? `${g.color}08` : "#F8FAFC" },
                              }}
                            >
                              <Box sx={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${isSel ? g.color : "#CBD5E1"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {isSel && <Box sx={{ width: 7, height: 7, borderRadius: "50%", background: g.color }} />}
                              </Box>
                              {o}
                            </Box>
                          );
                        })}
                      </Grid>
                    ))}
                  </Grid>

                  <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#94A3B8", mb: 1.5, mt: 1 }}>Date Range</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
                    <DatePicker
                      label="Start"
                      value={startDate}
                      onChange={(v) => v && setStartDate(v)}
                      slotProps={{ textField: { size: "small", sx: { width: 170, "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" } } } }}
                    />
                    <Typography sx={{ color: "#94A3B8", fontSize: 18 }}>→</Typography>
                    <DatePicker
                      label="End"
                      value={endDate}
                      onChange={(v) => v && setEndDate(v)}
                      minDate={startDate}
                      slotProps={{ textField: { size: "small", sx: { width: 170, "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" } } } }}
                    />
                    <Typography sx={{ fontSize: 12, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>{daysDiff} day{daysDiff !== 1 ? "s" : ""}</Typography>
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "space-between", pt: 2, borderTop: "1px solid #E2E8F0" }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => setStep(0)} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", color: "#64748B", borderColor: "#E2E8F0" }} variant="outlined">Back</Button>
                    <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => setStep(2)} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", background: "#4F46E5", "&:hover": { background: "#4338CA" } }}>Continue</Button>
                  </Box>
                </Box>
              )}

              {/* ── STEP 2: METRICS ── */}
              {step === 2 && (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#1E293B", mb: 0.5 }}>Choose Metrics</Typography>
                  <Typography variant="body2" sx={{ color: "#64748B", mb: 3 }}>Select the KPIs you want to include in your export</Typography>

                  {/* Data Source Toggle for DRL */}
                  {isDrl && (
                    <Box sx={{ mb: 3, p: 2, borderRadius: "14px", background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#1E293B", mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                        <StoreIcon sx={{ color: "#4F46E5", fontSize: 20 }} /> Data Source Option (DRL Only)
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                        <Button
                          variant={dataMode === "aggregated" ? "contained" : "outlined"}
                          onClick={() => setDataMode("aggregated")}
                          sx={{
                            textTransform: "none", fontWeight: 600, borderRadius: "10px", px: 2.5, py: 1,
                            background: dataMode === "aggregated" ? "linear-gradient(135deg, #4F46E5, #3730A3)" : "white",
                            color: dataMode === "aggregated" ? "white" : "#64748B",
                            borderColor: dataMode === "aggregated" ? "#4F46E5" : "#CBD5E1",
                            "&:hover": { background: dataMode === "aggregated" ? "linear-gradient(135deg, #4338CA, #312E81)" : "#F1F5F9" }
                          }}
                        >
                          Aggregated Data
                        </Button>
                        <Button
                          variant={dataMode === "darkstore" ? "contained" : "outlined"}
                          onClick={() => setDataMode("darkstore")}
                          sx={{
                            textTransform: "none", fontWeight: 600, borderRadius: "10px", px: 2.5, py: 1,
                            background: dataMode === "darkstore" ? "linear-gradient(135deg, #0EA5E9, #0284C7)" : "white",
                            color: dataMode === "darkstore" ? "white" : "#64748B",
                            borderColor: dataMode === "darkstore" ? "#0EA5E9" : "#CBD5E1",
                            "&:hover": { background: dataMode === "darkstore" ? "linear-gradient(135deg, #0284C7, #0369A1)" : "#F1F5F9" }
                          }}
                        >
                          Darkstore Data
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {dataMode === "darkstore" ? (
                    <Card elevation={0} sx={{ border: "1.5px solid #0EA5E9", borderRadius: "14px", overflow: "hidden", p: 3, background: "#F0F9FF" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                        <StoreIcon sx={{ color: "#0EA5E9", fontSize: 24 }} />
                        <Typography sx={{ fontWeight: 700, color: "#0369A1", fontSize: "1.05rem" }}>
                          Darkstore Raw Data Export (rb_pdp_week)
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: "#0284C7", mb: 2 }}>
                        This report will export raw darkstore records from <strong>rb_pdp_week</strong> including the following 12 columns:
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {[
                          "created_on", "platform", "brand", "category", "location",
                          "pincode", "pincode_area", "web_pid", "sku", "pdp_page_url", "osa", "osa_remark"
                        ].map((col) => (
                          <Chip key={col} label={col} size="small" sx={{ background: "#E0F2FE", color: "#0369A1", fontWeight: 600, borderRadius: "6px", fontFamily: "'JetBrains Mono', monospace" }} />
                        ))}
                      </Box>
                    </Card>
                  ) : (
                    <Card elevation={0} sx={{ border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
                      <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AssessmentIcon sx={{ color: '#4F46E5', fontSize: '1.2rem' }} />
                          <Typography sx={{ fontWeight: 600, color: '#1E293B', fontSize: '0.95rem' }}>Available Metrics</Typography>
                        </Box>
                        <Button
                          onClick={() => {
                            const availableTags = allTags.filter(t => availableKpis.has(t));
                            const allOn = availableTags.every(t => tagOn[t]);
                            const next = {};
                            availableTags.forEach(t => { next[t] = !allOn; });
                            setTagOn(prev => ({ ...prev, ...next }));
                          }}
                          sx={{ textTransform: "none", fontSize: 13, fontWeight: 700, px: 1.5, py: 0.5 }}
                        >
                          {allTags.filter(t => availableKpis.has(t)).every(t => tagOn[t]) ? "Deselect All" : "Select All"}
                        </Button>
                      </Box>
                      <Box sx={{ px: 2.5, py: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {allTags.map(tag => {
                          const isAvailable = availableKpis.has(tag);
                          const isOn = tagOn[tag] && isAvailable;
                          return (
                            <Chip
                              key={tag}
                              label={
                                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                  {tag}
                                  {!isAvailable && (
                                    <Box component="span" sx={{ ml: 0.3, px: 0.6, py: 0.1, borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em' }}>
                                      N/A
                                    </Box>
                                  )}
                                </Box>
                              }
                              onClick={isAvailable ? () => setTagOn(prev => ({ ...prev, [tag]: !prev[tag] })) : undefined}
                              sx={{
                                borderRadius: '8px',
                                fontWeight: 500,
                                cursor: isAvailable ? 'pointer' : 'not-allowed',
                                opacity: isAvailable ? 1 : 0.55,
                                border: isOn ? '1px solid #c7d2fe' : '1px solid #E2E8F0',
                                background: isOn ? '#EEF2FF' : isAvailable ? '#fff' : '#F8FAFC',
                                color: isOn ? '#4F46E5' : isAvailable ? '#64748B' : '#94A3B8',
                                '&:hover': {
                                  background: !isAvailable ? '#F8FAFC' : isOn ? '#E0E7FF' : '#F1F5F9'
                                }
                              }}
                            />
                          );
                        })}
                      </Box>
                    </Card>
                  )}

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 2, mt: 1, borderTop: "1px solid #E2E8F0" }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => setStep(1)} variant="outlined" sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", color: "#64748B", borderColor: "#E2E8F0" }}>Back</Button>
                    <Button
                      variant="contained"
                      startIcon={isDownloading ? null : <DownloadIcon />}
                      onClick={handleDownload}
                      disabled={isDownloading}
                      sx={{
                        textTransform: "none", fontWeight: 600, borderRadius: "10px", px: 3, py: 1.2,
                        background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                        "&:hover": { background: "linear-gradient(135deg, #4338CA, #6D28D9)", boxShadow: "0 6px 20px rgba(79,70,229,0.3)" },
                      }}
                    >
                      {isDownloading ? "Generating…" : "Download Report"}
                    </Button>
                  </Box>
                </Box>
              )}
            </Paper>

            {/* ── SUMMARY SIDEBAR ── */}
            <Paper elevation={0} sx={{ width: 220, flexShrink: 0, border: "1px solid #E2E8F0", borderRadius: "16px", p: 2.5, background: "white", alignSelf: "flex-start", position: "sticky", top: 100 }}>
              <Typography component="div" sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#94A3B8", mb: 2, display: "flex", alignItems: "center", gap: 0.8 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: "50%", background: "#4F46E5" }} />
                Summary
              </Typography>

              {/* Platforms */}
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 10, color: "#94A3B8", mb: 0.8, fontFamily: "'JetBrains Mono', monospace" }}>// platforms</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {dynamicPlatforms.filter(p => platforms[p.id]).length === 0
                    ? <Typography sx={{ fontSize: 12, color: "#CBD5E1" }}>None</Typography>
                    : dynamicPlatforms.filter(p => platforms[p.id]).map(p => (
                      <Chip key={p.id} label={p.label} size="small" sx={{ borderRadius: "100px", fontSize: 11, height: 24, border: `1px solid ${p.color}33`, background: `${p.color}08`, color: p.color, fontWeight: 500 }} />
                    ))
                  }
                </Box>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* Granularity */}
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 10, color: "#94A3B8", mb: 0.8, fontFamily: "'JetBrains Mono', monospace" }}>// granularity</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {[sku, geo, time].map(v => (
                    <Chip key={v} label={v} size="small" sx={{ borderRadius: "100px", fontSize: 11, height: 24, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B" }} />
                  ))}
                </Box>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* Date Range */}
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 10, color: "#94A3B8", mb: 0.8, fontFamily: "'JetBrains Mono', monospace" }}>// date range</Typography>
                <Chip label={`${startDate.format("DD MMM")}–${endDate.format("DD MMM")}`} size="small" sx={{ borderRadius: "100px", fontSize: 11, height: 24, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B" }} />
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* Metrics */}
              <Box>
                <Typography sx={{ fontSize: 10, color: "#94A3B8", mb: 0.8, fontFamily: "'JetBrains Mono', monospace" }}>// metrics</Typography>
                {visibleMetrics.map(m => (
                  <Box key={m.key} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.6 }}>
                    <Typography component="div" sx={{ fontSize: 11.5, color: metricOn[m.key] ? m.color : "#CBD5E1", display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box component="span" sx={{ display: "flex", fontSize: 14 }}>{m.icon}</Box> {m.label}
                    </Typography>
                    <Typography sx={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#94A3B8" }}>
                      {m.tags.filter(t => tagOn[t] && availableKpis.has(t)).length}/{m.tags.filter(t => availableKpis.has(t)).length}
                    </Typography>
                  </Box>
                ))}
                <Typography sx={{ mt: 1, fontSize: 11, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
                  {onTags}/{totalTags} total
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Schedule button in sidebar */}
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ScheduleIcon />}
                onClick={() => setScheduleModalOpen(true)}
                sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", borderColor: "#4F46E5", color: "#4F46E5", fontSize: 12.5, "&:hover": { borderColor: "#4338CA", background: "#EEF2FF" } }}
              >
                Schedule
              </Button>
            </Paper>
          </Box>
        )}

        {/* ── TOASTS ── */}
        <SuccessToast open={showSuccess} onClose={() => setShowSuccess(false)} message="Report downloaded successfully!" />
        <SuccessToast open={scheduleSuccess} onClose={() => setScheduleSuccess(false)} message="Schedule created successfully!" color="info" />
        <SuccessToast open={showError} onClose={() => setShowError(false)} message={errorMsg || "An error occurred"} color="error" />

        {/* ── SCHEDULE MODAL ── */}
        <Dialog open={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" } }}>
          <DialogTitle sx={{ p: 3, borderBottom: "1px solid #E2E8F0" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ p: 1, borderRadius: "8px", background: "#EEF2FF", color: "#4F46E5", display: "flex" }}>
                  <ScheduleIcon />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>New Schedule</Typography>
              </Box>
              <IconButton onClick={() => setScheduleModalOpen(false)} size="small"><CloseIcon /></IconButton>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 3, pt: 3 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box>
                <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600, mb: 0.5, display: "block" }}>Recipient Email</Typography>
                <TextField
                  type="email" fullWidth value={scheduleForm.email}
                  onChange={(e) => { setScheduleForm({ ...scheduleForm, email: e.target.value }); setEmailError(""); }}
                  error={Boolean(emailError)} helperText={emailError} placeholder="name@company.com"
                  InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: "#94A3B8" }} /></InputAdornment> }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
                />
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600, mb: 0.5 }}>Frequency</Typography>
                    <Select value={scheduleForm.frequency} onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })} sx={{ borderRadius: "8px" }}>
                      <MenuItem value="Daily">Daily</MenuItem>
                      <MenuItem value="Weekly">Weekly (Mon)</MenuItem>
                      <MenuItem value="Monthly">Monthly (1st)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600, mb: 0.5 }}>Delivery Time</Typography>
                    <TimePicker
                      value={scheduleForm.time}
                      onChange={(newTime) => setScheduleForm({ ...scheduleForm, time: newTime })}
                      slotProps={{ textField: { fullWidth: true, sx: { "& .MuiOutlinedInput-root": { borderRadius: "8px" } } } }}
                    />
                  </Box>
                </Grid>
              </Grid>
              <Paper elevation={0} sx={{ p: 2, background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: "8px" }}>
                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <CheckCircleIcon fontSize="small" sx={{ color: "#4F46E5", mt: 0.3 }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Summary</Typography>
                    <Typography variant="body2" sx={{ color: "#64748B", mt: 0.5 }}>
                      Send report to <strong>{scheduleForm.email || "..."}</strong>{" "}
                      <strong>{scheduleForm.frequency.toLowerCase()}</strong> at{" "}
                      <strong>{scheduleForm.time.format("hh:mm A")}</strong>.
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2, borderTop: "1px solid #E2E8F0" }}>
            <Button onClick={() => setScheduleModalOpen(false)} sx={{ color: "#64748B", fontWeight: 600 }}>Cancel</Button>
            <Button onClick={handleScheduleSave} variant="contained" disableElevation sx={{ background: "#4F46E5", fontWeight: 600, px: 3, "&:hover": { background: "#4338CA" } }}>
              Confirm Schedule
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
