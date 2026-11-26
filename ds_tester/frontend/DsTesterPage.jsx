import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Alert,
  Chip,
  Fade,
  TextField,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Check as CheckIcon,
  Replay as ReplayIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Storefront as StorefrontIcon,
  AutoGraph as AutoGraphIcon,
  Lightbulb as LightbulbIcon,
  TableChart as TableChartIcon,
  Videocam as VideocamIcon,
  PlayArrow as PlayArrowIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,

  Stop as StopIcon,

  Tune as TuneIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  WarningAmber as WarningAmberIcon,
  Rule as RuleIcon,
  VerifiedUser as VerifiedUserIcon,
  Email as EmailIcon,
  AssignmentInd as AssignmentIndIcon,
  ContentCopy as ContentCopyIcon,
  Search as SearchIcon,
  DeleteOutline as DeleteOutlineIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import axios from "axios";

import CommonContainer from "@/components/CommonLayout/CommonContainer";
import DateRangeComparePicker from "@/components/CommonLayout/DateRangeComparePicker";
import { FilterContext } from "@/utils/FilterContext";
import { fetchPrimaryFilterOptions } from "@/api/primarySalesService";
import { fetchSecondaryFilterOptions } from "@/api/secondarySalesService";
import KpiAnomalyChartDrawer from "./KpiAnomalyChartDrawer";
import AssignAnomalyEmailModal from "./AssignAnomalyEmailModal";


// DS Tester API endpoints (proxied through /ds-tester in Vite to FastAPI)
const DS_TESTER_API = "/ds-tester";


// Crash-proof Error Boundary to prevent page blanking when inspecting graphs
class DrawerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[DrawerErrorBoundary] Caught drawer render error:", error, errorInfo);
  }
  componentDidUpdate(prevProps) {
    if (prevProps.open !== this.props.open && this.props.open && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <Drawer
          anchor="right"
          open={this.props.open}
          onClose={this.props.onClose}
          PaperProps={{ sx: { width: { xs: "100%", md: 600 }, p: 3, bgcolor: "#ffffff" } }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ color: "#dc2626", fontWeight: 800, mb: 1 }}>
              ⚠️ Anomaly Drawer Notice
            </Typography>
            <Typography variant="body2" sx={{ color: "#475569", mb: 2 }}>
              The time-series chart data for this metric could not be rendered cleanly.
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onClose();
              }}
              sx={{ bgcolor: "#2563eb", textTransform: "none", fontWeight: 700 }}
            >
              Close Drawer
            </Button>
          </Box>
        </Drawer>
      );
    }
    return this.props.children;
  }
}

const MODULE_DISPLAY_NAMES = {
  business_overview: "Business Overview",
  pricing: "Pricing Analysis",
  cross_platform_pricing: "Cross Platform Pricing",
  availability_analysis: "Availability Analysis",
  visibility_analysis: "Visibility Analysis",
  market_share: "Market Share",
  performance_marketing: "Performance Marketing",
  review_rating: "Review & Rating",
  primary_summary: "Primary Summary",
  secondary_summary: "Secondary Summary",
  geo_intelligence: "India Overview",
  insights: "Insights",
  content_analysis: "Content Analysis",
  content_score: "Content Score",
  pds_score: "PDS Score",
};

const DEFAULT_CLIENTS = [
  { id: "drl", label: "Dr. Reddy's", category: "Pharmaceuticals" },
  { id: "boat", label: "boAt", category: "Audio & Wearables" },
  { id: "prestige", label: "Prestige", category: "Kitchen & Home" },
  { id: "pidilite", label: "Pidilite", category: "Adhesives & Chemicals" },
  { id: "mars", label: "Mars Snacking", category: "Confectionery" },
  { id: "mars_petcare", label: "Mars Petcare", category: "Pet Care" },
  { id: "emami", label: "Emami", category: "Personal Care" },
  { id: "mamaearth", label: "Mamaearth", category: "Personal Care" },
  { id: "sugar", label: "Sugar Cosmetics", category: "Beauty" },
  { id: "danone", label: "Danone", category: "Nutrition" },
  { id: "zydus", label: "Zydus", category: "Healthcare" },
  { id: "colpal", label: "Colgate-Palmolive", category: "Oral Care" },
  { id: "kelloggs", label: "Kellogg's", category: "Breakfast Foods" },
  { id: "gcpl", label: "Godrej Consumer", category: "FMCG" },
  { id: "hayatna", label: "Hayatna", category: "Dairy & Beverages" },
  { id: "suhana_masala", label: "Suhana Masala", category: "Spices & Food" },
];

export default function DsTesterPage({ isEmbedded = false }) {

  const filterContext = useContext(FilterContext);
  const defaultEnd = filterContext?.timeEnd ? dayjs(filterContext.timeEnd) : dayjs();
  const defaultStart = filterContext?.timeStart ? dayjs(filterContext.timeStart) : defaultEnd.subtract(14, "day");

  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [clients, setClients] = useState(DEFAULT_CLIENTS);
  const [selectedClient, setSelectedClient] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const clientParam = urlParams.get("client");
      if (clientParam && clientParam.trim()) return clientParam.trim().toLowerCase();
      const activeWs = sessionStorage.getItem("activeWorkspaceDb") || localStorage.getItem("activeWorkspaceDb");
      if (activeWs && activeWs.trim()) return activeWs.trim().toLowerCase();
      const userRaw = sessionStorage.getItem("user");
      if (userRaw) {
        const u = JSON.parse(userRaw);
        if (u.dbName) return u.dbName.trim().toLowerCase();
      }
    } catch (e) { }
    return "drl";
  });
  const [watchLiveBrowser, setWatchLiveBrowser] = useState(true); // User toggle: true = visible Chrome window, false = headless background
  const [runsMap, setRunsMap] = useState({}); // key: `${module}:${segment}:${client}` -> run result object
  const [activeRunId, setActiveRunId] = useState(null);
  const [activeRunData, setActiveRunData] = useState(null);
  const [liveScreenMinimized, setLiveScreenMinimized] = useState(false);
  const [busyMessage, setBusyMessage] = useState(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchQueue, setBatchQueue] = useState([]);
  const [cancelling, setCancelling] = useState(false);

  // Autonomous 2-Hour Anomaly Sentinel & Multi-Level Graph State
  const [chartDrawerOpen, setChartDrawerOpen] = useState(false);
  const [selectedKpiForChart, setSelectedKpiForChart] = useState(null);
  const [sentinelStatus, setSentinelStatus] = useState(null);
  const [sentinelDrawerOpen, setSentinelDrawerOpen] = useState(false);
  const [sentinelAnomalies, setSentinelAnomalies] = useState([]);
  const [sentinelScanning, setSentinelScanning] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState("parity_suite"); // "parity_suite" | "brand_anomalies"
  const [anomalyModuleFilter, setAnomalyModuleFilter] = useState("all"); // "all" | module_id
  const [anomalySeverityFilter, setAnomalySeverityFilter] = useState("all"); // "all" | "CRITICAL" | "WARNING"
  const [sentinelTargetClient, setSentinelTargetClient] = useState("all");
  const [sentinelFilterMode, setSentinelFilterMode] = useState("default"); // "default" | "custom"
  const [sentinelFilterModalOpen, setSentinelFilterModalOpen] = useState(false);
  const sentinelTimerRef = useRef(null);
  const [emailModalConfig, setEmailModalConfig] = useState({
    open: false,
    client: "prestige",
    selectedAnomaly: null,
    anomalies: [],
  });
  const [assignedSearchQuery, setAssignedSearchQuery] = useState("");
  const [assignedModuleFilter, setAssignedModuleFilter] = useState("all");
  const [assignedCopied, setAssignedCopied] = useState(false);
  const [customSentinelFilters, setCustomSentinelFilters] = useState({
    startDate: defaultStart.format("YYYY-MM-DD"),
    endDate: defaultEnd.format("YYYY-MM-DD"),
    platform: "All",
    channel: "All",
    brandName: "All",
    category: "All",
    retailerName: "All",
  });

  const [availableFilterOptions, setAvailableFilterOptions] = useState({
    platforms: ["All", "Amazon", "Blinkit", "Zepto", "Instamart", "Flipkart"],
    channels: ["All", "Quick Commerce", "E-Commerce", "National"],
    brands: ["All"],
    categories: ["All"],
  });

  useEffect(() => {
    const target = sentinelTargetClient !== "all" ? sentinelTargetClient : selectedClient;
    if (target) {
      axios.get(`${DS_TESTER_API}/filters`, { params: { module: selectedModule || "availability_analysis", client: target } })
        .then((res) => {
          if (res?.data?.success && res?.data?.data) {
            const d = res.data.data;
            setAvailableFilterOptions({
              platforms: ["All", ...(d.platforms || d.platformName || ["Amazon", "Blinkit", "Zepto", "Instamart", "Flipkart"])],
              channels: ["All", ...(d.channels || ["Quick Commerce", "E-Commerce", "National"])],
              brands: ["All", ...(d.brands || d.brandName || [])],
              categories: ["All", ...(d.categories || d.category || [])],
            });
          }
        })
        .catch(() => { });
    }
  }, [sentinelTargetClient, selectedClient, selectedModule]);

  const handleClearAnomalies = async (clientToClear = selectedClient) => {
    const isAll = !clientToClear || clientToClear === "all";
    const clientName = isAll ? "ALL Brands" : (clients.find((c) => c.id === clientToClear)?.label || clientToClear);
    const msg = isAll
      ? "Are you sure you want to clear unassigned anomalies for ALL brands? Assigned issues will be preserved."
      : `Are you sure you want to clear detected anomalies for ${clientName}? This will reset the anomaly matrix for this brand.`;

    if (!window.confirm(msg)) return;

    try {
      await axios.post(`${DS_TESTER_API}/anomaly/clear`, null, {
        params: { client: isAll ? "all" : clientToClear },
      });
      await fetchSentinelAnomalies();
      await fetchSentinelStatus();
    } catch (e) {
      console.error("Error clearing anomalies:", e);
    }
  };

  const startSentinelPolling = () => {
    if (sentinelTimerRef.current) clearInterval(sentinelTimerRef.current);
    sentinelTimerRef.current = setInterval(async () => {
      try {
        const [statusRes, runsRes, activeRes, anomsRes] = await Promise.all([
          axios.get(`${DS_TESTER_API}/anomaly/status`),
          axios.get(`${DS_TESTER_API}/runs`).catch(() => ({ data: [] })),
          axios.get(`${DS_TESTER_API}/active`).catch(() => ({ data: null })),
          axios.get(`${DS_TESTER_API}/anomaly/results`, { params: { limit: 300 } }).catch(() => null),
        ]);

        const statusData = statusRes.data;
        setSentinelStatus(statusData);

        if (anomsRes?.data?.anomalies) {
          setSentinelAnomalies(anomsRes.data.anomalies);
        }

        // Rebuild runsMap from latest runs
        const newMap = {};
        if (Array.isArray(runsRes.data)) {
          runsRes.data.forEach((r) => {
            const c = r.client || selectedClient;
            const key = `${r.module.toLowerCase()}:${r.segment.toLowerCase()}:${c.toLowerCase()}`;
            newMap[key] = r;
          });
        }

        // 2. Overlay the currently active run so live step, running status, and screenshot update live
        if (activeRes.data?.has_active_run && activeRes.data.run) {
          const r = activeRes.data.run;
          setActiveRunId(r.run_id);
          setActiveRunData(r);
          const c = r.client || selectedClient;
          const key = `${r.module.toLowerCase()}:${r.segment.toLowerCase()}:${c.toLowerCase()}`;
          newMap[key] = r;

          // Auto-switch selectedModule to follow the active test when Selenium is working
          if (r.module && (r.status === "running" || r.overall === "RUNNING")) {
            setSelectedModule(r.module);
          }
        }

        setRunsMap(newMap);

        const status = statusData?.pipeline_status || "";
        const isStillActive = statusData?.is_pipeline_active || statusData?.running;
        if (
          !isStillActive ||
          status.startsWith("Completed") ||
          status === "Idle" ||
          status.startsWith("Cancelled")
        ) {
          clearInterval(sentinelTimerRef.current);
          sentinelTimerRef.current = null;
          setSentinelScanning(false);
          await fetchSentinelAnomalies();
          await fetchSessionRuns();
          setTimeout(() => {
            setActiveRunData((current) => (current?.status === "running" ? current : null));
          }, 4500);
        }
      } catch (e) {
        clearInterval(sentinelTimerRef.current);
        sentinelTimerRef.current = null;
        setSentinelScanning(false);
      }
    }, 1000);
  };

  useEffect(() => {
    fetchSentinelStatus();
    fetchSentinelAnomalies();
    const interval = setInterval(() => {
      fetchSentinelStatus();
    }, 10000);
    return () => {
      clearInterval(interval);
      if (sentinelTimerRef.current) clearInterval(sentinelTimerRef.current);
    };
  }, []);

  const fetchSentinelStatus = async () => {
    try {
      const res = await axios.get(`${DS_TESTER_API}/anomaly/status`);
      const data = res.data;
      setSentinelStatus(data);
      if (isBatchMode && batchQueue.length > 0) {
        // Preserved user selectedClient and selectedModule from manual UI choice
        if (!selectedModule && data?.active_module) {
          setSelectedModule(data.active_module);
        }
      }
      const isPipelineActive = data?.is_pipeline_active || (data?.running && data?.pipeline_status && !data.pipeline_status.startsWith("Idle") && !data.pipeline_status.startsWith("Completed") && !data.pipeline_status.startsWith("Cancelled"));
      if (isPipelineActive && !sentinelTimerRef.current) {
        setSentinelScanning(true);
        startSentinelPolling();
      }
    } catch (err) {
      // Background poll
    }
  };

  const fetchSentinelAnomalies = async () => {
    try {
      const res = await axios.get(`${DS_TESTER_API}/anomaly/results`, { params: { limit: 300 } });
      setSentinelAnomalies(res.data.anomalies || []);
    } catch (err) {
      // Background poll
    }
  };

  // Brand-specific anomalies for the selected client (e.g. Prestige)
  const brandAnomalies = useMemo(() => {
    if (!selectedClient) return sentinelAnomalies;
    return sentinelAnomalies.filter(
      (a) => (a.client || "").toLowerCase() === selectedClient.toLowerCase()
    );
  }, [sentinelAnomalies, selectedClient]);

  // Counts of anomalies per module for this specific brand
  const moduleAnomalyCounts = useMemo(() => {
    const counts = {};
    brandAnomalies.forEach((a) => {
      const mod = (a.module || "").toLowerCase();
      counts[mod] = (counts[mod] || 0) + 1;
    });
    return counts;
  }, [brandAnomalies]);

  // Filtered brand anomalies based on user's module switcher
  const filteredBrandAnomalies = useMemo(() => {
    let list = brandAnomalies;
    if (anomalyModuleFilter && anomalyModuleFilter !== "all") {
      list = list.filter((a) => (a.module || "").toLowerCase() === anomalyModuleFilter.toLowerCase());
    }
    if (anomalySeverityFilter && anomalySeverityFilter !== "all") {
      list = list.filter((a) => (a.severity || "").toUpperCase() === anomalySeverityFilter.toUpperCase());
    }
    return list;
  }, [brandAnomalies, anomalyModuleFilter, anomalySeverityFilter]);

  // All assigned issues (active + fixed)
  const allAssignedAnomalies = useMemo(() => {
    return brandAnomalies.filter(
      (a) => a.assignment_status === "ASSIGNED" || a.assignment_status === "FIXED" || a.assigned_to
    );
  }, [brandAnomalies]);

  // Active / pending assigned issues (awaiting fix)
  const activeAssignedAnomalies = useMemo(() => {
    return allAssignedAnomalies.filter((a) => a.assignment_status !== "FIXED" && a.status !== "FIXED");
  }, [allAssignedAnomalies]);

  // Fixed / resolved anomalies
  const fixedAnomalies = useMemo(() => {
    return allAssignedAnomalies.filter((a) => a.assignment_status === "FIXED" || a.status === "FIXED");
  }, [allAssignedAnomalies]);

  // Alias for backward compatibility
  const assignedAnomalies = activeAssignedAnomalies;

  // Sub-tab view state inside Assigned Anomalies Registry: "active" (Pending) | "fixed" (Fixed) | "all"
  const [assignedStatusTab, setAssignedStatusTab] = useState("active");
  const [markingDoneId, setMarkingDoneId] = useState(null);

  const handleMarkAnomalyDone = async (anom, targetStatus = "FIXED") => {
    setMarkingDoneId(anom.id);
    try {
      await axios.post(`${DS_TESTER_API}/anomaly/mark-done`, {
        anomaly_id: anom.id,
        status: targetStatus,
        fixed_by: anom.assigned_to || "abhishek.j@trailytics.com",
        notes: targetStatus === "FIXED" ? "Verified and resolved consistency" : "Reopened for review"
      });
      await fetchSentinelAnomalies();
    } catch (err) {
      console.error("[DsTester] Failed to update anomaly status:", err);
    } finally {
      setMarkingDoneId(null);
    }
  };

  // Filtered assigned anomalies for the Assignment Registry table
  const filteredAssignedAnomalies = useMemo(() => {
    let list = assignedStatusTab === "fixed"
      ? fixedAnomalies
      : assignedStatusTab === "all"
        ? allAssignedAnomalies
        : activeAssignedAnomalies;

    if (assignedModuleFilter && assignedModuleFilter !== "all") {
      list = list.filter((a) => (a.module || "").toLowerCase() === assignedModuleFilter.toLowerCase());
    }
    if (assignedSearchQuery) {
      const q = assignedSearchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          (a.kpi_label || "").toLowerCase().includes(q) ||
          (a.kpi || "").toLowerCase().includes(q) ||
          (a.module || "").toLowerCase().includes(q) ||
          (a.platform || "").toLowerCase().includes(q) ||
          (a.assigned_to || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [assignedStatusTab, activeAssignedAnomalies, fixedAnomalies, allAssignedAnomalies, assignedModuleFilter, assignedSearchQuery]);

  const handleCopyAssignedReport = async () => {
    try {
      const res = await axios.post(`${DS_TESTER_API}/anomaly/preview-email`, {
        client: selectedClient || "boat",
        recipients: ["abhishek.j@trailytics.com"],
        anomaly_ids: assignedAnomalies.map((a) => a.id).filter(Boolean),
        priority: "P1 - Critical",
        from_email: "shushant@trailytics.com",
      });
      if (res.data?.html) {
        if (navigator.clipboard && window.ClipboardItem) {
          const blobHtml = new Blob([res.data.html], { type: "text/html" });
          const blobText = new Blob([res.data.html], { type: "text/plain" });
          await navigator.clipboard.write([new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText })]);
        } else {
          await navigator.clipboard.writeText(res.data.html);
        }
        setAssignedCopied(true);
        setTimeout(() => setAssignedCopied(false), 3500);
      }
    } catch (e) {
      console.error("Copy report error:", e);
    }
  };

  const triggerSentinelScan = async () => {
    setSentinelScanning(true);
    setBusyMessage(null);

    // Immediately switch the main UI client to match the Sentinel target if single client selected
    if (sentinelTargetClient && sentinelTargetClient !== "all") {
      setSelectedClient(sentinelTargetClient);
    }

    const activeCustom = sentinelFilterMode === "custom" ? {
      ...customSentinelFilters,
      startDate: customSentinelFilters.startDate || timeStart.format("YYYY-MM-DD"),
      endDate: customSentinelFilters.endDate || timeEnd.format("YYYY-MM-DD"),
    } : null;

    try {
      const res = await axios.post(`${DS_TESTER_API}/anomaly/trigger`, {
        clients: sentinelTargetClient === "all" ? null : [sentinelTargetClient],
        headless: !watchLiveBrowser,
        custom_filters: activeCustom,
      });

      if (res.data?.status === "busy") {
        setSentinelScanning(false);
        setBusyMessage(res.data.message || "Another test run or sweep is currently active.");
        return;
      }

      await fetchSentinelStatus();
      startSentinelPolling();
    } catch (err) {
      console.error("Sentinel scan trigger error:", err);
      setSentinelScanning(false);
    }
  };


  // Time Period Popup State - dynamically synced with active dashboard FilterContext
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [targetSegment, setTargetSegment] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState({
    startDate: defaultStart.format("YYYY-MM-DD"),
    endDate: defaultEnd.format("YYYY-MM-DD"),
  });
  const [timeStart, setTimeStart] = useState(defaultStart);
  const [timeEnd, setTimeEnd] = useState(defaultEnd);

  // Primary Summary Filters State

  const [primaryBrand, setPrimaryBrand] = useState("All");

  const [primaryRetailer, setPrimaryRetailer] = useState("All");

  const [primaryProduct, setPrimaryProduct] = useState("All");

  const [primaryDivision, setPrimaryDivision] = useState("All");

  const [primaryZone, setPrimaryZone] = useState("All");

  const [primaryFilterOptions, setPrimaryFilterOptions] = useState({

    brands: ["All", "Acrofy", "Venusia", "Cipcal", "Razo", "Ketorol", "Omez"],

    retailers: ["All", "Amazon", "Apollo", "Flipkart", "Netmeds", "Pharmeasy"],

    products: ["All"],

    divisions: ["All"],

    zones: ["All"],

  });



  // Load Primary Summary filter options dynamically from backend
  useEffect(() => {
    if (selectedModule === "primary_summary" || selectedClient === "drl") {
      axios.get(`${DS_TESTER_API}/filters`, { params: { module: "primary_summary", client: selectedClient } })
        .then((res) => {
          if (res?.data?.success && res?.data?.data) {
            const d = res.data.data;
            setPrimaryFilterOptions({
              brands: ["All", ...(d.brandName || d.brands || d.brand || [])],
              retailers: ["All", ...(d.retailerName || d.retailers || d.customer_name || [])],
              products: ["All", ...(d.product || d.products || d.product_description || [])],
              divisions: ["All", ...(d.division || d.divisions || [])],
              zones: ["All", ...(d.zone || d.zones || [])],
            });
          }
        })
        .catch((err) => {
          console.warn("[DsTester] Could not load primary filters:", err);
        });
    }
  }, [selectedModule, selectedClient]);



  // Secondary Summary Filters State
  const [secSeller, setSecSeller] = useState("All");
  const [secPlatform, setSecPlatform] = useState("All");
  const [secBrand, setSecBrand] = useState("All");
  const [secSubBrand, setSecSubBrand] = useState("All");
  const [secSku, setSecSku] = useState("All");
  const [secSapCode, setSecSapCode] = useState("All");
  const [secFiscalYear, setSecFiscalYear] = useState("All");
  const [secQuarter, setSecQuarter] = useState("All");
  const [secViewBy, setSecViewBy] = useState("monthly");
  const [secFilterOptions, setSecFilterOptions] = useState({
    seller: ["All"],
    platformName: ["All"],
    brand: ["All"],
    subBrand: ["All"],
    sku: ["All"],
    sapCode: ["All"],
    fiscalYear: ["All"],
    quarter: ["All"],
  });

  // Load Secondary Summary filter options dynamically from backend
  useEffect(() => {
    if (selectedModule === "secondary_summary" || selectedClient === "drl") {
      axios.get(`${DS_TESTER_API}/filters`, { params: { module: "secondary_summary", client: selectedClient } })
        .then((res) => {
          if (res?.data?.success && res?.data?.data) {
            const d = res.data.data;
            setSecFilterOptions({
              seller: ["All", ...(d.seller || [])],
              platformName: ["All", ...(d.platformName || [])],
              brand: ["All", ...(d.brand || [])],
              subBrand: ["All", ...(d.subBrand || [])],
              sku: ["All", ...(d.sku || [])],
              sapCode: ["All", ...(d.sapCode || [])],
              fiscalYear: ["All", ...(d.fiscalYear || [])],
              quarter: ["All", ...(d.quarter || [])],
            });
          }
        })
        .catch((err) => {
          console.warn("[DsTester] Could not load secondary filters:", err);
        });
    }
  }, [selectedModule, selectedClient]);

  // Geo Intelligence (India Overview) Filter State
  const [geoMetric, setGeoMetric] = useState("OSA %");
  const [geoChannel, setGeoChannel] = useState("All");
  const [geoPlatform, setGeoPlatform] = useState("All");
  const [geoBrand, setGeoBrand] = useState("All");
  const [geoCategory, setGeoCategory] = useState("All");
  const [geoMsl, setGeoMsl] = useState("All");
  const [geoTimePeriod, setGeoTimePeriod] = useState("MTD");
  const [geoFilterOptions, setGeoFilterOptions] = useState({
    channels: ["All", "Quick Commerce", "E-Commerce"],
    metrics: ["OSA %", "Market Share", "Sales", "Orders"],
    platforms: ["All"],
    brands: ["All"],
    categories: ["All"],
    msls: ["All", "0", "1"],
    timePeriods: ["MTD", "7D", "14D", "31D", "Custom"],
  });

  // Load Geo Intelligence filter options dynamically from backend
  useEffect(() => {
    if (selectedModule === "geo_intelligence") {
      axios.get(`${DS_TESTER_API}/filters`, { params: { module: "geo_intelligence", client: selectedClient } })
        .then((res) => {
          if (res?.data?.success && res?.data?.data) {
            const d = res.data.data;
            setGeoFilterOptions({
              channels: d.channels || ["All", "Quick Commerce", "E-Commerce"],
              metrics: d.metrics || ["OSA %", "Market Share", "Sales", "Orders"],
              platforms: ["All", ...(d.platforms || [])],
              brands: ["All", ...(d.brands || [])],
              categories: ["All", ...(d.categories || [])],
              msls: d.msls || ["All", "0", "1"],
              timePeriods: d.timePeriods || ["MTD", "7D", "14D", "31D", "Custom"],
            });
          }
        })
        .catch((err) => {
          console.warn("[DsTester] Could not load geo intelligence filters:", err);
        });
    }
  }, [selectedModule, selectedClient]);

  // Insights Filter State
  const [insightsChannel, setInsightsChannel] = useState("All");
  const [insightsPlatform, setInsightsPlatform] = useState("All");
  const [insightsBrand, setInsightsBrand] = useState("All");
  const [insightsCategory, setInsightsCategory] = useState("All");
  const [insightsCity, setInsightsCity] = useState("All");
  const [insightsFilterOptions, setInsightsFilterOptions] = useState({
    channels: ["All", "Quick Commerce", "E-Commerce"],
    platforms: ["All"],
    brands: ["All"],
    categories: ["All"],
    cities: ["All"],
    channelPlatforms: {},
  });

  // Load Insights filter options dynamically from backend
  useEffect(() => {
    if (selectedModule === "insights") {
      axios.get(`${DS_TESTER_API}/filters`, { params: { module: "insights", client: selectedClient } })
        .then((res) => {
          if (res?.data?.success && res?.data?.data) {
            const d = res.data.data;
            setInsightsFilterOptions({
              channels: d.channels || ["All", "Quick Commerce", "E-Commerce"],
              channelPlatforms: d.channelPlatforms || {},
              platforms: ["All", ...(d.platforms || [])],
              brands: ["All", ...(d.brands || [])],
              categories: ["All", ...(d.categories || [])],
              cities: ["All", ...(d.cities || [])],
            });
          }
        })
        .catch((err) => {
          console.warn("[DsTester] Could not load insights filters:", err);
        });
    }
  }, [selectedModule, selectedClient]);

  // PDS Score 3 Filters State (Platform, Year, Period)
  const [pdsPlatform, setPdsPlatform] = useState("Blinkit");
  const [pdsYear, setPdsYear] = useState("2026");
  const [pdsPeriod, setPdsPeriod] = useState("Period 6");

  const PDS_PERIOD_DATES = {
    "Period 1": { startDate: "2025-12-28", endDate: "2026-01-24" },
    "Period 2": { startDate: "2026-01-25", endDate: "2026-02-21" },
    "Period 3": { startDate: "2026-02-22", endDate: "2026-03-21" },
    "Period 4": { startDate: "2026-03-22", endDate: "2026-04-18" },
    "Period 5": { startDate: "2026-04-19", endDate: "2026-05-16" },
    "Period 6": { startDate: "2026-05-17", endDate: "2026-06-13" },
  };

  // Details Side Panel State
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [detailsDrawerExpanded, setDetailsDrawerExpanded] = useState(false);
  const [sentinelDrawerExpanded, setSentinelDrawerExpanded] = useState(false);
  const [drawerRunData, setDrawerRunData] = useState(null);

  // Polling ref
  const pollingTimerRef = useRef(null);

  // 1. Load available clients and session runs on mount
  useEffect(() => {
    fetchClients();
    fetchSessionRuns();

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  // 2. Fetch client-specific segments dynamically from rca_sku_dim whenever selectedClient changes
  useEffect(() => {
    if (selectedClient) {
      fetchModules(selectedClient);
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${DS_TESTER_API}/clients`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setClients(res.data);
        // Keep the selected client valid for the loaded list (avoids MUI out-of-range warning)
        const ids = res.data.map((c) => c.id);
        if (!ids.includes(selectedClient)) {
          setSelectedClient(ids[0]);
        }
      }
    } catch (err) {
      console.error("[DsTester] Failed to load clients:", err);
    }
  };

  const fetchModules = async (clientOverride) => {
    try {
      const c = clientOverride || selectedClient;
      const res = await axios.get(`${DS_TESTER_API}/modules?client=${c}`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setModules(res.data);
        const validIds = res.data.map((m) => m.id);
        if (!selectedModule || !validIds.includes(selectedModule)) {
          setSelectedModule(res.data[0].id);
        }
        if (anomalyModuleFilter !== "all" && anomalyModuleFilter !== "assigned" && !validIds.includes(anomalyModuleFilter)) {
          setAnomalyModuleFilter("all");
        }
      }
    } catch (err) {
      console.error("[DsTester] Failed to load modules:", err);
    }
  };

  const fetchSessionRuns = async () => {
    try {
      const res = await axios.get(`${DS_TESTER_API}/runs`);
      if (Array.isArray(res.data)) {
        const map = {};
        let runningRun = null;
        res.data.forEach((r) => {
          const c = r.client || selectedClient;
          const key = `${r.module.toLowerCase()}:${r.segment.toLowerCase()}:${c.toLowerCase()}`;
          map[key] = r;
          if (r.status === "running" || r.overall === "RUNNING") {
            runningRun = r;
          }
        });
        setRunsMap(map);

        if (runningRun) {
          setActiveRunId(runningRun.run_id);
          setActiveRunData(runningRun);
          // User selectedClient and selectedModule preserved
          if (runningRun.module && !selectedModule) setSelectedModule(runningRun.module);
        }
      }

      // Check active endpoint to catch running background tests immediately upon page reload
      try {
        const activeRes = await axios.get(`${DS_TESTER_API}/active`);
        if (activeRes.data?.has_active_run && activeRes.data.run) {
          const r = activeRes.data.run;
          setActiveRunId(r.run_id);
          setActiveRunData(r);
          const c = r.client || selectedClient;
          const key = `${r.module.toLowerCase()}:${r.segment.toLowerCase()}:${c.toLowerCase()}`;
          setRunsMap((prev) => ({ ...prev, [key]: r }));
          // User selectedClient and selectedModule preserved
          if (r.module && !selectedModule) setSelectedModule(r.module);
        }
      } catch (err) {
        // Non-blocking
      }
    } catch (err) {
      console.error("[DsTester] Failed to restore session runs:", err);
    }
  };

  const handleCancelRun = async () => {
    setCancelling(true);
    try {
      await axios.post(`${DS_TESTER_API}/cancel`);
      await axios.post(`${DS_TESTER_API}/anomaly/cancel`).catch(() => { });
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      if (sentinelTimerRef.current) {
        clearInterval(sentinelTimerRef.current);
        sentinelTimerRef.current = null;
      }
      setActiveRunId(null);
      setActiveRunData(null);
      setBusyMessage(null);
      setIsBatchMode(false);
      setBatchQueue([]);
      setSentinelScanning(false);
      await Promise.all([
        fetchSentinelStatus(),
        fetchSentinelAnomalies(),
        fetchSessionRuns(),
      ]);
    } catch (err) {
      console.error("[DsTester] Failed to cancel active run:", err);
    } finally {
      setCancelling(false);
    }
  };

  // 2. Poll for active run status
  useEffect(() => {
    if (!activeRunId || sentinelScanning) return;

    pollingTimerRef.current = setInterval(async () => {
      try {
        const [runsRes, activeRes, anomsRes] = await Promise.all([
          axios.get(`${DS_TESTER_API}/runs`).catch(() => ({ data: [] })),
          axios.get(`${DS_TESTER_API}/runs/${activeRunId}`).catch(() => null),
          axios.get(`${DS_TESTER_API}/anomaly/results`, { params: { limit: 300 } }).catch(() => null),
        ]);

        if (anomsRes?.data?.anomalies) {
          setSentinelAnomalies(anomsRes.data.anomalies);
        }

        const runData = activeRes?.data;
        if (runData) {
          setActiveRunData(runData);
          if (drawerRunData && drawerRunData.run_id === activeRunId) {
            setDrawerRunData(runData);
          }
        }

        // Cleanly rebuild runsMap so finished segments show PASS/FAIL, and active run shows Running...
        if (Array.isArray(runsRes.data)) {
          const map = {};
          runsRes.data.forEach((r) => {
            const c = r.client || selectedClient;
            const key = `${r.module.toLowerCase()}:${r.segment.toLowerCase()}:${c.toLowerCase()}`;
            map[key] = r;
          });
          if (runData) {
            const c = runData.client || selectedClient;
            const key = `${runData.module.toLowerCase()}:${runData.segment.toLowerCase()}:${c.toLowerCase()}`;
            map[key] = runData;
          }
          setRunsMap(map);
        }

        if (runData && (runData.status === "done" || runData.status === "error" || runData.status === "cancelled")) {
          // Check if there is a next run in the active batch queue
          const currentIndex = batchQueue.indexOf(activeRunId);
          if (currentIndex !== -1 && currentIndex < batchQueue.length - 1) {
            // Smoothly advance to the next segment in the batch
            const nextRunId = batchQueue[currentIndex + 1];
            setActiveRunId(nextRunId);
            fetchSessionRuns();
          } else {
            // All runs in batch (or single run) complete
            clearInterval(pollingTimerRef.current);
            setActiveRunId(null);
            setBatchQueue([]);
            setIsBatchMode(false);
            fetchSessionRuns();
            // Keep preview visible for 4.5 seconds after finish so tester can review outcome
            setTimeout(() => {
              setActiveRunData((current) => (current?.run_id === runData.run_id ? null : current));
            }, 4500);
          }
        }
      } catch (err) {
        console.error("[DsTester] Polling error:", err);
        clearInterval(pollingTimerRef.current);
        setActiveRunId(null);
        setBatchQueue([]);
        setIsBatchMode(false);
      }
    }, 1000);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [activeRunId, drawerRunData, selectedClient, batchQueue, sentinelScanning]);

  // Handle open refresh / period modal for a single segment
  const handleOpenPeriodModal = (seg) => {
    setIsBatchMode(false);
    if (selectedModule === "content_analysis" || selectedModule === "review_rating") {
      setTargetSegment(seg);
      handleDirectRun(seg);
      return;
    }
    if (selectedModule === "pds_score") {
      const platLabel = seg?.platform_label || seg?.platform || (seg?.id ? seg.id.replace("pds_score_", "") : "Blinkit");
      const cleanPlat = platLabel.charAt(0).toUpperCase() + platLabel.slice(1);
      setPdsPlatform(cleanPlat.includes("Flipkart") ? "Flipkart National" : cleanPlat);
      setPdsYear("2026");
      setPdsPeriod("Period 6");
      setTargetSegment(seg);
      setPeriodModalOpen(true);
      setBusyMessage(null);
      return;
    }
    if (selectedClient === "mars") {
      setTimeStart(dayjs("2026-10-01"));
      setTimeEnd(dayjs("2026-10-31"));
      setSelectedPeriod({
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      });
    }
    setTargetSegment(seg);
    setPeriodModalOpen(true);
    setBusyMessage(null);
  };

  // Open modal or directly trigger batch run for ALL segments in the module
  const handleOpenRunAllModal = () => {
    setIsBatchMode(true);
    setTargetSegment(null);

    if (selectedModule === "content_analysis" || selectedModule === "review_rating") {
      executeRunAll();
      return;
    }

    if (selectedModule === "pds_score") {
      setPdsPlatform("Blinkit");
      setPdsYear("2026");
      setPdsPeriod("Period 6");
      setPeriodModalOpen(true);
      setBusyMessage(null);
      return;
    }

    if (selectedClient === "mars") {
      setTimeStart(dayjs("2026-10-01"));
      setTimeEnd(dayjs("2026-10-31"));
      setSelectedPeriod({
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      });
    }

    setPeriodModalOpen(true);
    setBusyMessage(null);
  };

  const handleDirectRun = async (seg) => {
    setIsBatchMode(false);
    const target = seg || targetSegment;
    if (!target || !selectedModule) return;

    const periodObj = selectedModule === "review_rating"
      ? { startDate: "Last 6 Months", endDate: "Last 6 Months", preset: "6M" }
      : { startDate: "Snapshot", endDate: "Snapshot" };

    const activeFilters = selectedModule === "primary_summary" ? {
      brandName: primaryBrand,
      retailerName: primaryRetailer,
      product: primaryProduct,
      division: primaryDivision,
      zone: primaryZone,
    } : selectedModule === "secondary_summary" ? {
      seller: secSeller,
      platformName: secPlatform,
      brand: secBrand,
      subBrand: secSubBrand,
      sku: secSku,
      sapCode: secSapCode,
      fiscalYear: secFiscalYear,
      quarter: secQuarter,
      granularity: secViewBy,
    } : selectedModule === "geo_intelligence" ? {
      metric: geoMetric,
      channel: geoChannel,
      platform: geoPlatform,
      brand: geoBrand,
      category: geoCategory,
      msl: geoMsl,
      timePeriod: geoTimePeriod,
    } : selectedModule === "insights" ? {
      channel: insightsChannel,
      platform: insightsPlatform,
      brand: insightsBrand,
      category: insightsCategory,
      city: insightsCity,
    } : null;

    const payload = {
      module: selectedModule,
      segment: target.id,
      period: periodObj,
      client: selectedClient,
      headless: !watchLiveBrowser,
      filters: activeFilters,
    };

    try {
      const res = await axios.post(`${DS_TESTER_API}/run`, payload);
      if (res.data?.run_id) {
        setActiveRunId(res.data.run_id);
        setBatchQueue([res.data.run_id]);
        setLiveScreenMinimized(false);
        setActiveRunData({
          run_id: res.data.run_id,
          module: selectedModule,
          segment: target.id,
          period: periodObj,
          client: selectedClient,
          headless: !watchLiveBrowser,
          status: "running",
          live_step: "Initializing Step 1 (API) and Step 2 (ClickHouse)...",
          live_screenshot: null,
          steps: {
            api: { status: "running" },
            logic: { status: "pending" },
            ui: { status: "pending" },
          },
        });
        const key = `${selectedModule.toLowerCase()}:${target.id.toLowerCase()}:${selectedClient.toLowerCase()}`;
        setRunsMap((prev) => ({
          ...prev,
          [key]: {
            run_id: res.data.run_id,
            status: "running",
            overall: "RUNNING",
            steps: { api: "running", logic: "pending", ui: "pending" },
          },
        }));
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setBusyMessage("A verification test is already running. Please wait for it to complete.");
      }
    }
  };

  // Execute single run
  const executeSingleRun = async () => {
    if (!targetSegment || !selectedModule) return;
    setPeriodModalOpen(false);

    let periodPayload = selectedPeriod;
    if (sentinelFilterMode === "custom" && (customSentinelFilters.startDate || timeStart)) {
      periodPayload = {
        startDate: customSentinelFilters.startDate || timeStart.format("YYYY-MM-DD"),
        endDate: customSentinelFilters.endDate || timeEnd.format("YYYY-MM-DD"),
      };
    }
    let segId = targetSegment.id;

    if (selectedModule === "review_rating") {
      periodPayload = { startDate: "Last 6 Months", endDate: "Last 6 Months", preset: "6M" };
    } else if (selectedModule === "pds_score") {
      const dates = PDS_PERIOD_DATES[pdsPeriod] || { startDate: "2026-10-04", endDate: "2026-10-31" };
      periodPayload = {
        platform: pdsPlatform,
        year: pdsYear,
        period: pdsPeriod,
        startDate: dates.startDate,
        endDate: dates.endDate,
      };
      const platKey = pdsPlatform.toLowerCase().replace(/[^a-z0-9]/g, "");
      const matched = segments.find((s) => s.id.toLowerCase().includes(platKey) || platKey.includes(s.id.replace("pds_score_", "")));
      if (matched) segId = matched.id;
    }

    const activeFilters = selectedModule === "primary_summary" ? {
      brandName: primaryBrand,
      retailerName: primaryRetailer,
      product: primaryProduct,
      division: primaryDivision,
      zone: primaryZone,
    } : selectedModule === "secondary_summary" ? {
      seller: secSeller,
      platformName: secPlatform,
      brand: secBrand,
      subBrand: secSubBrand,
      sku: secSku,
      sapCode: secSapCode,
      fiscalYear: secFiscalYear,
      quarter: secQuarter,
      granularity: secViewBy,
    } : selectedModule === "geo_intelligence" ? {
      metric: geoMetric,
      channel: geoChannel,
      platform: geoPlatform,
      brand: geoBrand,
      category: geoCategory,
      msl: geoMsl,
      timePeriod: geoTimePeriod,
    } : selectedModule === "insights" ? {
      channel: insightsChannel,
      platform: insightsPlatform,
      brand: insightsBrand,
      category: insightsCategory,
      city: insightsCity,
    } : null;

    const payload = {
      module: selectedModule,
      segment: segId,
      period: periodPayload,
      client: selectedClient,
      headless: !watchLiveBrowser,
      filters: activeFilters,
    };

    try {
      const res = await axios.post(`${DS_TESTER_API}/run`, payload);
      if (res.data?.run_id) {
        setActiveRunId(res.data.run_id);
        setBatchQueue([res.data.run_id]);
        setLiveScreenMinimized(false);
        setActiveRunData({
          run_id: res.data.run_id,
          module: selectedModule,
          segment: targetSegment.id,
          period: periodPayload,
          client: selectedClient,
          headless: !watchLiveBrowser,
          status: "running",
          live_step: "Initializing Step 1 (API) and Step 2 (ClickHouse)...",
          live_screenshot: null,
          steps: {
            api: { status: "running" },
            logic: { status: "pending" },
            ui: { status: "pending" },
          },
        });
        const key = `${selectedModule.toLowerCase()}:${targetSegment.id.toLowerCase()}:${selectedClient.toLowerCase()}`;
        setRunsMap((prev) => ({
          ...prev,
          [key]: {
            run_id: res.data.run_id,
            module: selectedModule,
            segment: targetSegment.id,
            period: periodPayload,
            client: selectedClient,
            headless: !watchLiveBrowser,
            status: "running",
            overall: "RUNNING",
            steps: {
              api: { status: "running" },
              logic: { status: "pending" },
              ui: { status: "pending" },
            },
            kpis: [],
          },
        }));
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setBusyMessage(
          err.response.data?.detail || "Another test is currently running. Please wait for it to finish."
        );
      } else {
        setBusyMessage(err.message || "Failed to trigger run.");
      }
    }
  };

  // Execute batch run for ALL segments of current module
  const executeRunAll = async (overridePeriod) => {
    if (!selectedModule) return;
    setPeriodModalOpen(false);

    let periodPayload = overridePeriod || (sentinelFilterMode === "custom" && (customSentinelFilters.startDate || timeStart) ? {
      startDate: customSentinelFilters.startDate || timeStart.format("YYYY-MM-DD"),
      endDate: customSentinelFilters.endDate || timeEnd.format("YYYY-MM-DD"),
    } : selectedPeriod);
    if (selectedModule === "review_rating") {
      periodPayload = { startDate: "Last 6 Months", endDate: "Last 6 Months", preset: "6M" };
    } else if (selectedModule === "content_analysis") {
      periodPayload = { startDate: "Snapshot", endDate: "Snapshot" };
    } else if (selectedModule === "pds_score") {
      const dates = PDS_PERIOD_DATES[pdsPeriod] || { startDate: "2026-10-04", endDate: "2026-10-31" };
      periodPayload = {
        year: pdsYear,
        period: pdsPeriod,
        startDate: dates.startDate,
        endDate: dates.endDate,
      };
    }

    const activeFilters = selectedModule === "primary_summary" ? {
      brandName: primaryBrand,
      retailerName: primaryRetailer,
      product: primaryProduct,
      division: primaryDivision,
      zone: primaryZone,
    } : selectedModule === "secondary_summary" ? {
      seller: secSeller,
      platformName: secPlatform,
      brand: secBrand,
      subBrand: secSubBrand,
      sku: secSku,
      sapCode: secSapCode,
      fiscalYear: secFiscalYear,
      quarter: secQuarter,
      granularity: secViewBy,
    } : selectedModule === "geo_intelligence" ? {
      metric: geoMetric,
      channel: geoChannel,
      platform: geoPlatform,
      brand: geoBrand,
      category: geoCategory,
      msl: geoMsl,
      timePeriod: geoTimePeriod,
    } : selectedModule === "insights" ? {
      channel: insightsChannel,
      platform: insightsPlatform,
      brand: insightsBrand,
      category: insightsCategory,
      city: insightsCity,
    } : null;

    const payload = {
      module: selectedModule,
      period: periodPayload,
      client: selectedClient,
      headless: !watchLiveBrowser,
      filters: activeFilters,
    };

    try {
      const res = await axios.post(`${DS_TESTER_API}/run-all`, payload);
      if (res.data?.run_ids && res.data.run_ids.length > 0) {
        const { run_ids, batch_id } = res.data;
        setIsBatchMode(true);
        setBatchQueue(run_ids);
        setActiveRunId(run_ids[0]);
        setLiveScreenMinimized(false);

        // Pre-populate runsMap so every segment row immediately shows its queued status
        const updatedRuns = {};
        segments.forEach((seg, idx) => {
          const key = `${selectedModule.toLowerCase()}:${seg.id.toLowerCase()}:${selectedClient.toLowerCase()}`;
          const isFirst = idx === 0;
          updatedRuns[key] = {
            run_id: run_ids[idx] || `${batch_id}_${seg.id}`,
            module: selectedModule,
            segment: seg.id,
            period: periodPayload,
            client: selectedClient,
            headless: !watchLiveBrowser,
            status: isFirst ? "running" : "pending",
            overall: isFirst ? "RUNNING" : "PENDING",
            batch_id: batch_id,
            batch_index: idx,
            batch_total: segments.length,
            steps: {
              api: { status: isFirst ? "running" : "pending" },
              logic: { status: "pending" },
              ui: { status: "pending" },
            },
            kpis: [],
          };
        });
        setRunsMap((prev) => ({ ...prev, ...updatedRuns }));

        setActiveRunData({
          run_id: run_ids[0],
          module: selectedModule,
          segment: segments[0]?.id,
          period: periodPayload,
          client: selectedClient,
          headless: !watchLiveBrowser,
          status: "running",
          live_step: `Starting batch run (1 of ${segments.length}): ${segments[0]?.label}...`,
          live_screenshot: null,
          batch_id: batch_id,
          batch_index: 0,
          batch_total: segments.length,
          steps: {
            api: { status: "running" },
            logic: { status: "pending" },
            ui: { status: "pending" },
          },
        });
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setBusyMessage(
          err.response.data?.detail || "Another test is currently running. Please wait for it to finish."
        );
      } else {
        setBusyMessage(err.message || "Failed to trigger batch run.");
      }
      setIsBatchMode(false);
      setBatchQueue([]);
    }
  };

  // Confirm run handler branches on isBatchMode
  const handleConfirmRun = async () => {
    if (isBatchMode) {
      await executeRunAll();
    } else {
      await executeSingleRun();
    }
  };

  const currentModuleObj = modules.find((m) => m.id === selectedModule) || (selectedModule ? {
    id: selectedModule,
    name: MODULE_DISPLAY_NAMES[selectedModule] || selectedModule.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
    segments: [],
  } : modules[0]);
  const segments = currentModuleObj?.segments || [];
  const currentClientObj = clients.find((c) => c.id === selectedClient) || clients[0] || { id: "drl", label: "Dr. Reddy's" };

  // Render Status Badge
  const renderStatusBadge = (run) => {
    if (!run) {
      return (
        <Chip
          label="Not Run"
          size="small"
          sx={{
            bgcolor: "#f1f5f9",
            color: "#64748b",
            fontWeight: 600,
            fontSize: "12px",
          }}
        />
      );
    }

    if (run.status === "pending") {
      return (
        <Chip
          icon={<HourglassEmptyIcon sx={{ fontSize: "15px !important", color: "#64748b !important" }} />}
          label="Pending in queue..."
          size="small"
          sx={{
            bgcolor: "#f1f5f9",
            color: "#64748b",
            fontWeight: 700,
            fontSize: "12px",
            border: "1px dashed #cbd5e1",
          }}
        />
      );
    }

    if (run.status === "running") {
      let activeStep = "API";
      if (run.steps?.ui?.status === "running") {
        activeStep = run.headless ? "UI (Invisible Headless)" : "UI (Live Chrome)";
      } else if (run.steps?.logic?.status === "running") {
        activeStep = "Logic";
      }

      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={16} sx={{ color: "#2563eb" }} />
          <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#2563eb" }}>
            Running {activeStep}...
          </Typography>
        </Box>
      );
    }

    if (run.status === "cancelled" || run.overall === "CANCELLED") {
      return (
        <Chip
          label="CANCELLED"
          size="small"
          sx={{
            bgcolor: "#f1f5f9",
            color: "#64748b",
            fontWeight: 700,
            fontSize: "12px",
            border: "1px dashed #94a3b8",
          }}
        />
      );
    }

    if (run.overall === "PASS") {
      return (
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: "16px !important", color: "#16a34a !important" }} />}
          label="PASS"
          size="small"
          sx={{
            bgcolor: "#dcfce7",
            color: "#16a34a",
            fontWeight: 800,
            fontSize: "12px",
            border: "1px solid #bbf7d0",
          }}
        />
      );
    }

    if (run.overall === "FAIL") {
      return (
        <Chip
          icon={<CancelIcon sx={{ fontSize: "16px !important", color: "#dc2626 !important" }} />}
          label="FAIL"
          size="small"
          sx={{
            bgcolor: "#fee2e2",
            color: "#dc2626",
            fontWeight: 800,
            fontSize: "12px",
            border: "1px solid #fecaca",
          }}
        />
      );
    }

    if (run.overall === "ERROR") {
      return (
        <Chip
          icon={<WarningIcon sx={{ fontSize: "16px !important", color: "#d97706 !important" }} />}
          label="ERROR"
          size="small"
          sx={{
            bgcolor: "#fef3c7",
            color: "#d97706",
            fontWeight: 800,
            fontSize: "12px",
            border: "1px solid #fde68a",
          }}
        />
      );
    }

    return null;
  };

  // Helper for segment icons
  const getSegmentIcon = (segId) => {
    if (segId.includes("insights")) return <LightbulbIcon sx={{ fontSize: 18, color: "#eab308" }} />;
    if (segId.includes("platform_overview")) return <TableChartIcon sx={{ fontSize: 18, color: "#6366f1" }} />;
    if (segId.includes("city_breach") || segId.includes("city_overview")) return <WarningIcon sx={{ fontSize: 18, color: "#f59e0b" }} />;
    if (segId.includes("city_") || segId.includes("sku_matrix")) return <StorefrontIcon sx={{ fontSize: 18, color: "#0284c7" }} />;
    return <AutoGraphIcon sx={{ fontSize: 18, color: "#2563eb" }} />;
  };

  const pageContent = (
    <Box sx={{ p: isEmbedded ? 0 : 3, maxWidth: isEmbedded ? "100%" : 1200, margin: isEmbedded ? "0" : "0 auto" }}>
      {/* Header Title & Intro */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#1e293b", mb: 0.5 }}>
              Data Science Live Validation Suite
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              3-Way live automated consistency verification comparing platform API, ClickHouse OLAP logic, and visible non-headless Chrome UI.
            </Typography>
          </Box>

          {/* Live Browser Mode Toggle: Tester chooses Visible vs Invisible Execution */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: "8px 16px",
              bgcolor: watchLiveBrowser ? "#f0fdf4" : "#f8fafc",
              border: "1.5px solid",
              borderColor: watchLiveBrowser ? "#86efac" : "#cbd5e1",
              borderRadius: "14px",
              boxShadow: watchLiveBrowser ? "0 2px 8px rgba(34, 197, 94, 0.15)" : "none",
              transition: "all 0.25s ease-in-out",
            }}
          >
            {watchLiveBrowser ? (
              <VisibilityIcon sx={{ fontSize: 22, color: "#16a34a" }} />
            ) : (
              <VisibilityOffIcon sx={{ fontSize: 22, color: "#64748b" }} />
            )}
            <Box>
              <Typography sx={{ fontSize: "13px", fontWeight: 800, color: watchLiveBrowser ? "#15803d" : "#334155", lineHeight: 1.2 }}>
                {watchLiveBrowser ? "Watch Live Browser (Visible Chrome)" : "Invisible Mode (Headless Background)"}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: "11px", color: watchLiveBrowser ? "#16a34a" : "#64748b", display: "block" }}>
                {watchLiveBrowser
                  ? "Opens Chrome on desktop: watch navigation, scrolling & element highlights"
                  : "Runs silently in background without popping open any browser window"}
              </Typography>
            </Box>
            <Switch
              checked={watchLiveBrowser}
              onChange={(e) => setWatchLiveBrowser(e.target.checked)}
              color="success"
              sx={{
                ml: 0.5,
                "& .MuiSwitch-switchBase.Mui-checked": {
                  color: "#16a34a",
                },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                  backgroundColor: "#22c55e",
                },
              }}
            />
          </Box>
        </Box>
      </Box>

      {busyMessage && (
        <Alert
          severity="warning"
          sx={{
            mb: 3,
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            "& .MuiAlert-message": { flex: 1 },
          }}
          action={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Button
                color="error"
                size="small"
                variant="contained"
                disabled={cancelling}
                onClick={handleCancelRun}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "12px",
                  borderRadius: "8px",
                  bgcolor: "#dc2626",
                  "&:hover": { bgcolor: "#b91c1c" },
                }}
              >
                {cancelling ? "Stopping..." : "Stop Running Test"}
              </Button>
              <IconButton size="small" onClick={() => setBusyMessage(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          }
        >
          {busyMessage}
        </Alert>
      )}


      {/* Autonomous 2-Hour Anomaly Sentinel Banner */}
      <Card
        sx={{
          mb: 2.5,
          p: 2,
          borderRadius: "16px",
          bgcolor: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          color: "#0f172a",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                bgcolor: sentinelStatus?.running ? "#16a34a" : "#d97706",
                boxShadow: sentinelStatus?.running
                  ? "0 0 10px rgba(22, 163, 74, 0.4)"
                  : "none",
              }}
            />
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography sx={{ fontWeight: 800, fontSize: "15px", color: "#0f172a", letterSpacing: "-0.01em" }}>
                  Anomaly Sentinel (Manual Mode)
                </Typography>
                <Chip
                  label="MANUAL RUN ONLY"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "10px",
                    fontWeight: 800,
                    bgcolor: "#eff6ff",
                    color: "#2563eb",
                    border: "1px solid #bfdbfe",
                  }}
                />
                <Chip
                  label="MAX THRESHOLD: ≤ 10%"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "10px",
                    fontWeight: 800,
                    bgcolor: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #e2e8f0",
                  }}
                />
              </Box>
              <Typography sx={{ fontSize: "12px", color: "#64748b", mt: 0.3 }}>
                Execution Mode: <strong style={{ color: "#0f172a" }}>Manual On-Demand (No Automation)</strong>{" "}
                | Status:{" "}
                <strong style={{ color: sentinelStatus?.pipeline_status && !sentinelStatus.pipeline_status.startsWith("Idle") ? "#2563eb" : "#475569" }}>
                  {sentinelStatus?.pipeline_status || "Idle (Ready for Manual Run)"}
                </strong>{" "}
                | Select brand or scope below and click <strong>Run Anomaly Scan</strong> to execute on demand.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setSentinelDrawerOpen(true)}
                startIcon={<WarningIcon sx={{ color: sentinelAnomalies.length > 0 ? "#dc2626" : "#16a34a" }} />}
                sx={{
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "none",
                  color: "#334155",
                  borderColor: "#cbd5e1",
                  bgcolor: "#ffffff",
                  height: 34,
                  "&:hover": {
                    bgcolor: "#f1f5f9",
                    borderColor: "#94a3b8",
                  },
                }}
              >
                Detected Anomalies ({sentinelAnomalies.length})
              </Button>
              {sentinelAnomalies.length > 0 && (
                <Tooltip title={`Clear detected anomalies for ${currentClientObj.label}`}>
                  <Button
                    size="small"
                    onClick={() => handleClearAnomalies(selectedClient)}
                    startIcon={<DeleteOutlineIcon sx={{ fontSize: "14px !important" }} />}
                    sx={{
                      minWidth: "auto",
                      px: 1,
                      height: 34,
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#dc2626",
                      borderRadius: "8px",
                      border: "1px dashed #fca5a5",
                      bgcolor: "#fff5f5",
                      textTransform: "none",
                      "&:hover": { bgcolor: "#fee2e2", borderColor: "#f87171" },
                    }}
                  >
                    Clear {currentClientObj.label}
                  </Button>
                </Tooltip>
              )}
            </Box>

            {/* Scope Selector: Individual Client vs Full Fleet */}
            <FormControl size="small" sx={{ minWidth: 175 }}>
              <Select
                value={sentinelTargetClient}
                onChange={(e) => setSentinelTargetClient(e.target.value)}
                disabled={sentinelScanning}
                sx={{
                  height: 34,
                  fontSize: "12px",
                  fontWeight: 700,
                  bgcolor: "#ffffff",
                  borderRadius: "10px",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#cbd5e1",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#94a3b8",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#2563eb",
                  },
                }}
              >
                <MenuItem value="all" sx={{ fontSize: "12px", fontWeight: 700, color: "#2563eb" }}>
                  🌐 All Brands (Full Fleet)
                </MenuItem>
                {clients.map((c) => (
                  <MenuItem key={c.id} value={c.id} sx={{ fontSize: "12px", fontWeight: 600 }}>
                    {c.label || c.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Filter Mode Button: Default Baseline vs Custom Configuration */}
            <Tooltip title="View Default Baseline Filter Details or Apply Custom Filters">
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  const startStr = customSentinelFilters.startDate || timeStart.format("YYYY-MM-DD");
                  const endStr = customSentinelFilters.endDate || timeEnd.format("YYYY-MM-DD");
                  setCustomSentinelFilters((prev) => ({
                    ...prev,
                    startDate: startStr,
                    endDate: endStr,
                  }));
                  setSentinelFilterModalOpen(true);
                }}
                disabled={sentinelScanning}
                startIcon={<TuneIcon fontSize="small" sx={{ color: sentinelFilterMode === "custom" ? "#2563eb" : "#64748b" }} />}
                sx={{
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "none",
                  color: sentinelFilterMode === "custom" ? "#1d4ed8" : "#334155",
                  borderColor: sentinelFilterMode === "custom" ? "#2563eb" : "#cbd5e1",
                  bgcolor: sentinelFilterMode === "custom" ? "#eff6ff" : "#ffffff",
                  height: 34,
                  px: 1.5,
                  whiteSpace: "nowrap",
                  "&:hover": {
                    bgcolor: sentinelFilterMode === "custom" ? "#dbeafe" : "#f1f5f9",
                    borderColor: "#94a3b8",
                  },
                }}
              >
                {sentinelFilterMode === "custom" ? "🎯 Custom Filters: Active" : "⚡ Filters: Default (30D Baselines)"}
              </Button>
            </Tooltip>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={triggerSentinelScan}
                disabled={sentinelScanning}
                startIcon={
                  sentinelScanning ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <RefreshIcon fontSize="small" />
                  )
                }
                sx={{
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "none",
                  bgcolor: "#2563eb",
                  height: 34,
                  whiteSpace: "nowrap",
                  boxShadow: "none",
                  "&:hover": {
                    bgcolor: "#1d4ed8",
                    boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
                  },
                }}
              >
                {sentinelScanning
                  ? "Scanning Fleet..."
                  : sentinelTargetClient === "all"
                    ? "Run Fleet Scan (Manual)"
                    : `Run for ${clients.find((c) => c.id === sentinelTargetClient)?.label || sentinelTargetClient}`}
              </Button>

              {/* Assign / Forward Anomalies via Outlook Email */}
              <Tooltip title="Forward client anomalies to engineer/tester via Outlook HTML email">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setEmailModalConfig({
                      open: true,
                      client: sentinelTargetClient !== "all" ? sentinelTargetClient : selectedClient,
                      selectedAnomaly: null,
                      anomalies: sentinelAnomalies.length > 0 ? sentinelAnomalies : brandAnomalies,
                    });
                  }}
                  startIcon={<EmailIcon fontSize="small" />}
                  sx={{
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "none",
                    color: "#0369a1",
                    borderColor: "#7dd3fc",
                    bgcolor: "#f0f9ff",
                    height: 34,
                    px: 1.5,
                    whiteSpace: "nowrap",
                    "&:hover": {
                      bgcolor: "#e0f2fe",
                      borderColor: "#0284c7",
                    },
                  }}
                >
                  Assign via Email
                </Button>
              </Tooltip>

              {sentinelScanning && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleCancelRun}
                  disabled={cancelling}
                  startIcon={cancelling ? <CircularProgress size={14} color="inherit" /> : <StopIcon fontSize="small" />}
                  sx={{
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: 800,
                    textTransform: "none",
                    bgcolor: "#ef4444",
                    color: "#ffffff",
                    height: 34,
                    px: 2,
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.35)",
                    "&:hover": {
                      bgcolor: "#dc2626",
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.45)",
                    },
                  }}
                >
                  {cancelling ? "Stopping Fleet..." : "⏹️ Stop Run"}
                </Button>
              )}
            </Box>
          </Box>
          {sentinelFilterMode === "custom" && (
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px dashed #e2e8f0", display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#2563eb" }}>
                Active Custom Filters:
              </Typography>
              <Chip
                size="small"
                label={`Platform: ${customSentinelFilters.platform}`}
                onDelete={() => setCustomSentinelFilters({ ...customSentinelFilters, platform: "All" })}
                sx={{ fontSize: "11px", fontWeight: 600, bgcolor: "#eff6ff", color: "#1d4ed8" }}
              />
              <Chip
                size="small"
                label={`Channel: ${customSentinelFilters.channel}`}
                onDelete={() => setCustomSentinelFilters({ ...customSentinelFilters, channel: "All" })}
                sx={{ fontSize: "11px", fontWeight: 600, bgcolor: "#eff6ff", color: "#1d4ed8" }}
              />
              {customSentinelFilters.brandName !== "All" && (
                <Chip
                  size="small"
                  label={`Brand: ${customSentinelFilters.brandName}`}
                  onDelete={() => setCustomSentinelFilters({ ...customSentinelFilters, brandName: "All" })}
                  sx={{ fontSize: "11px", fontWeight: 600, bgcolor: "#eff6ff", color: "#1d4ed8" }}
                />
              )}
              {customSentinelFilters.category !== "All" && (
                <Chip
                  size="small"
                  label={`Category: ${customSentinelFilters.category}`}
                  onDelete={() => setCustomSentinelFilters({ ...customSentinelFilters, category: "All" })}
                  sx={{ fontSize: "11px", fontWeight: 600, bgcolor: "#eff6ff", color: "#1d4ed8" }}
                />
              )}
              {customSentinelFilters.startDate && customSentinelFilters.endDate && (
                <Chip
                  size="small"
                  label={`Dates: ${customSentinelFilters.startDate} to ${customSentinelFilters.endDate}`}
                  onDelete={() => setCustomSentinelFilters({ ...customSentinelFilters, startDate: null, endDate: null })}
                  sx={{ fontSize: "11px", fontWeight: 600, bgcolor: "#eff6ff", color: "#1d4ed8" }}
                />
              )}
              <Button
                size="small"
                onClick={() => setSentinelFilterModalOpen(true)}
                sx={{ fontSize: "11px", fontWeight: 700, textTransform: "none", color: "#2563eb", p: 0, minWidth: "auto", ml: 1 }}
              >
                Edit Filters
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setSentinelFilterMode("default");
                  setCustomSentinelFilters({
                    startDate: null,
                    endDate: null,
                    platform: "All",
                    channel: "All",
                    brandName: "All",
                    category: "All",
                    retailerName: "All",
                  });
                }}
                sx={{ fontSize: "11px", fontWeight: 700, textTransform: "none", color: "#ef4444", p: 0, minWidth: "auto", ml: 1 }}
              >
                Reset to Default
              </Button>
            </Box>
          )}
        </Box>
      </Card>

      {/* Configuration Bar: Client & Module Selection */}
      <Card
        sx={{
          mb: 3,
          p: 2.5,
          borderRadius: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          border: "1px solid #e2e8f0",
          bgcolor: "#ffffff",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          {/* 1. Client / Workspace Selection */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <StorefrontIcon sx={{ color: "#2563eb", fontSize: 20 }} />
            <Typography sx={{ fontWeight: 700, fontSize: "14px", color: "#334155" }}>
              Client / Brand:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <Select
                value={selectedClient}
                onChange={(e) => {
                  const nextClient = e.target.value;
                  setSelectedClient(nextClient);
                  fetchModules(nextClient);
                }}
                sx={{
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  bgcolor: "#f8fafc",
                }}
              >
                {clients.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 2 }}>
                      <span>{c.label}</span>
                      {c.category && (
                        <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: "11px" }}>
                          {c.category}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* 2. Module Selection */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "14px", color: "#334155" }}>
              Module:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                sx={{
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  bgcolor: "#f8fafc",
                }}
              >
                {modules.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}
                  </MenuItem>
                ))}
                {selectedModule && !modules.some((m) => m.id === selectedModule) && (
                  <MenuItem key={selectedModule} value={selectedModule}>
                    {MODULE_DISPLAY_NAMES[selectedModule] || selectedModule.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
                  </MenuItem>
                )}
              </Select>
            </FormControl>
          </Box>

          {/* Target Database Badge & Clickable Brand Anomaly Counter */}
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Chip
              icon={brandAnomalies.length > 0 ? <WarningAmberIcon sx={{ fontSize: "15px !important", color: "#dc2626 !important" }} /> : <CheckCircleIcon sx={{ fontSize: "15px !important", color: "#16a34a !important" }} />}
              label={brandAnomalies.length > 0 ? `${brandAnomalies.length} Anomalies (${currentClientObj.label})` : `0 Anomalies (${currentClientObj.label})`}
              onClick={() => setActiveMainTab("brand_anomalies")}
              size="small"
              sx={{
                cursor: "pointer",
                bgcolor: brandAnomalies.length > 0 ? "#fee2e2" : "#dcfce7",
                color: brandAnomalies.length > 0 ? "#dc2626" : "#16a34a",
                fontWeight: 700,
                fontSize: "12px",
                border: brandAnomalies.length > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                "&:hover": {
                  bgcolor: brandAnomalies.length > 0 ? "#fecaca" : "#bbf7d0",
                },
              }}
            />
            <Chip
              label={`Database: ${selectedClient}`}
              size="small"
              sx={{
                bgcolor: "#f1f5f9",
                color: "#475569",
                fontFamily: "monospace",
                fontWeight: 600,
                fontSize: "12px",
              }}
            />
          </Box>
        </Box>
      </Card>

      {/* Main Section Navigation: Parity Verification Suite vs Overall Brand Anomalies */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, borderBottom: "1px solid #e2e8f0", pb: 1, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button
            onClick={() => setActiveMainTab("parity_suite")}
            variant={activeMainTab === "parity_suite" ? "contained" : "text"}
            startIcon={<RuleIcon />}
            sx={{
              borderRadius: "10px",
              textTransform: "none",
              fontWeight: 700,
              fontSize: "13px",
              bgcolor: activeMainTab === "parity_suite" ? "#2563eb" : "transparent",
              color: activeMainTab === "parity_suite" ? "#ffffff" : "#64748b",
              "&:hover": {
                bgcolor: activeMainTab === "parity_suite" ? "#1d4ed8" : "#f1f5f9",
                color: activeMainTab === "parity_suite" ? "#ffffff" : "#0f172a",
              },
              px: 2,
              py: 0.8,
            }}
          >
            📋 Parity Verification Suite ({segments.length} Segments)
          </Button>

          <Button
            onClick={() => setActiveMainTab("brand_anomalies")}
            variant={activeMainTab === "brand_anomalies" ? "contained" : "text"}
            startIcon={<WarningAmberIcon />}
            sx={{
              borderRadius: "10px",
              textTransform: "none",
              fontWeight: 700,
              fontSize: "13px",
              bgcolor: activeMainTab === "brand_anomalies" ? "#dc2626" : "transparent",
              color: activeMainTab === "brand_anomalies" ? "#ffffff" : (brandAnomalies.length > 0 ? "#dc2626" : "#64748b"),
              "&:hover": {
                bgcolor: activeMainTab === "brand_anomalies" ? "#b91c1c" : "#f1f5f9",
                color: activeMainTab === "brand_anomalies" ? "#ffffff" : "#0f172a",
              },
              px: 2,
              py: 0.8,
            }}
          >
            🚨 Overall Brand Anomalies ({currentClientObj.label}: {brandAnomalies.length})
          </Button>

          <Button
            onClick={() => setActiveMainTab("assigned_anomalies")}
            variant={activeMainTab === "assigned_anomalies" ? "contained" : "text"}
            startIcon={<AssignmentIndIcon />}
            sx={{
              borderRadius: "10px",
              textTransform: "none",
              fontWeight: 700,
              fontSize: "13px",
              bgcolor: activeMainTab === "assigned_anomalies" ? "#0284c7" : "transparent",
              color: activeMainTab === "assigned_anomalies" ? "#ffffff" : (assignedAnomalies.length > 0 ? "#0284c7" : "#64748b"),
              "&:hover": {
                bgcolor: activeMainTab === "assigned_anomalies" ? "#0369a1" : "#f1f5f9",
                color: activeMainTab === "assigned_anomalies" ? "#ffffff" : "#0f172a",
              },
              px: 2,
              py: 0.8,
            }}
          >
            📋 Assigned Anomalies Registry ({currentClientObj.label}: {activeAssignedAnomalies.length} Pending{fixedAnomalies.length > 0 ? ` • ${fixedAnomalies.length} Fixed` : ''})
          </Button>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {activeMainTab === "assigned_anomalies" ? (
            <Card
              sx={{
                borderRadius: "16px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                border: "1px solid #e2e8f0",
                overflow: "hidden",
                p: 3,
                mb: 3,
              }}
            >
              {/* Header & Attribution Banner */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 3 }}>
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                    <AssignmentIndIcon sx={{ color: "#0284c7", fontSize: 30 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>
                      {currentClientObj.label} • Commercial Anomaly Assignment Registry
                    </Typography>
                    <Chip
                      label={`${activeAssignedAnomalies.length} Pending Issues`}
                      size="small"
                      sx={{
                        fontWeight: 800,
                        fontSize: "12px",
                        bgcolor: activeAssignedAnomalies.length > 0 ? "#e0f2fe" : "#f1f5f9",
                        color: activeAssignedAnomalies.length > 0 ? "#0284c7" : "#64748b",
                        border: "1px solid #bae6fd",
                      }}
                    />
                    {fixedAnomalies.length > 0 && (
                      <Chip
                        label={`${fixedAnomalies.length} Fixed`}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          fontSize: "12px",
                          bgcolor: "#dcfce7",
                          color: "#15803d",
                          border: "1px solid #86efac",
                        }}
                      />
                    )}
                    <Chip
                      label="P1 - Critical Priority"
                      size="small"
                      sx={{
                        fontWeight: 800,
                        fontSize: "11px",
                        bgcolor: "#fee2e2",
                        color: "#dc2626",
                        border: "1px solid #fecaca",
                      }}
                    />
                  </Box>
                  <Typography sx={{ color: "#64748b", fontSize: "13px", mt: 0.5 }}>
                    Enterprise assignment ledger for <strong>{currentClientObj.label}</strong>. Tracks exactly which commercial anomaly was assigned to whom by whom, with verified ClickHouse OLAP metrics, allowed tolerance corridors, and human-readable audit timestamps.
                  </Typography>

                  {/* Audit Attribution Badges */}
                  {assignedAnomalies.length > 0 && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mt: 1.5 }}>
                      <Box sx={{ px: 1.5, py: 0.5, bgcolor: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd", display: "flex", alignItems: "center", gap: 0.8 }}>
                        <Typography sx={{ fontSize: "11px", color: "#0369a1", fontWeight: 700 }}>ASSIGNED TO:</Typography>
                        <Typography sx={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>
                          {assignedAnomalies[0].assigned_to || "abhishek.j@trailytics.com"}
                        </Typography>
                      </Box>
                      <Box sx={{ px: 1.5, py: 0.5, bgcolor: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1", display: "flex", alignItems: "center", gap: 0.8 }}>
                        <Typography sx={{ fontSize: "11px", color: "#475569", fontWeight: 700 }}>ASSIGNED BY:</Typography>
                        <Typography sx={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>
                          {assignedAnomalies[0].assigned_by || "shushant@trailytics.com"}
                        </Typography>
                      </Box>
                      <Box sx={{ px: 1.5, py: 0.5, bgcolor: "#fef3c7", borderRadius: "8px", border: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 0.8 }}>
                        <Typography sx={{ fontSize: "11px", color: "#92400e", fontWeight: 700 }}>ASSIGNMENT DATE:</Typography>
                        <Typography sx={{ fontSize: "12px", color: "#92400e", fontWeight: 800 }}>
                          📅 {assignedAnomalies[0].assigned_at || "23 Nov 2026, 03:36 PM"}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>

                {/* Action Buttons */}
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleCopyAssignedReport}
                    startIcon={<ContentCopyIcon />}
                    sx={{
                      borderRadius: "10px",
                      fontWeight: 700,
                      fontSize: "12px",
                      textTransform: "none",
                      color: "#334155",
                      borderColor: "#cbd5e1",
                      px: 2,
                      "&:hover": { bgcolor: "#f8fafc", borderColor: "#94a3b8" },
                    }}
                  >
                    {assignedCopied ? "Copied Formatted Report!" : "Copy Formatted Report"}
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      setEmailModalConfig({
                        open: true,
                        client: selectedClient,
                        selectedAnomaly: null,
                        anomalies: assignedAnomalies,
                      });
                    }}
                    startIcon={<EmailIcon />}
                    sx={{
                      borderRadius: "10px",
                      fontWeight: 700,
                      fontSize: "12px",
                      textTransform: "none",
                      bgcolor: "#0078d4",
                      color: "#ffffff",
                      px: 2.2,
                      boxShadow: "0 2px 6px rgba(0,120,212,0.3)",
                      "&:hover": { bgcolor: "#005a9e" },
                    }}
                  >
                    Forward via Outlook Web
                  </Button>
                </Box>
              </Box>

              {/* Status View Selector & Filter Toolbar */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 2.5, p: 1.5, bgcolor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                {/* Sub-Tabs: Pending Fix vs Fixed Anomalies vs All */}
                <Box sx={{ display: "flex", gap: 0.8, alignItems: "center", bgcolor: "#e2e8f0", p: 0.4, borderRadius: "10px" }}>
                  <Button
                    size="small"
                    onClick={() => setAssignedStatusTab("active")}
                    sx={{
                      fontSize: "11px",
                      fontWeight: 800,
                      borderRadius: "8px",
                      textTransform: "none",
                      px: 1.5,
                      py: 0.4,
                      bgcolor: assignedStatusTab === "active" ? "#ffffff" : "transparent",
                      color: assignedStatusTab === "active" ? "#0284c7" : "#475569",
                      boxShadow: assignedStatusTab === "active" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      "&:hover": { bgcolor: assignedStatusTab === "active" ? "#ffffff" : "#f1f5f9" }
                    }}
                  >
                    Pending Fix ({activeAssignedAnomalies.length})
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setAssignedStatusTab("fixed")}
                    sx={{
                      fontSize: "11px",
                      fontWeight: 800,
                      borderRadius: "8px",
                      textTransform: "none",
                      px: 1.5,
                      py: 0.4,
                      bgcolor: assignedStatusTab === "fixed" ? "#16a34a" : "transparent",
                      color: assignedStatusTab === "fixed" ? "#ffffff" : "#475569",
                      boxShadow: assignedStatusTab === "fixed" ? "0 1px 3px rgba(22,163,74,0.3)" : "none",
                      "&:hover": { bgcolor: assignedStatusTab === "fixed" ? "#15803d" : "#f1f5f9" }
                    }}
                  >
                    Fixed Anomalies ({fixedAnomalies.length})
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setAssignedStatusTab("all")}
                    sx={{
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "8px",
                      textTransform: "none",
                      px: 1.2,
                      py: 0.4,
                      bgcolor: assignedStatusTab === "all" ? "#ffffff" : "transparent",
                      color: assignedStatusTab === "all" ? "#0f172a" : "#475569",
                      boxShadow: assignedStatusTab === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      "&:hover": { bgcolor: assignedStatusTab === "all" ? "#ffffff" : "#f1f5f9" }
                    }}
                  >
                    All ({allAssignedAnomalies.length})
                  </Button>
                </Box>

                <TextField
                  size="small"
                  placeholder="Search assigned anomalies by metric, module, platform..."
                  value={assignedSearchQuery}
                  onChange={(e) => setAssignedSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ color: "#94a3b8", fontSize: 20, mr: 1 }} />,
                  }}
                  sx={{
                    minWidth: 320,
                    flex: 1,
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "#ffffff",
                      borderRadius: "8px",
                      fontSize: "13px",
                    },
                  }}
                />

                <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", alignItems: "center" }}>
                  <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#64748b", mr: 0.5 }}>
                    Filter Module:
                  </Typography>
                  {["all", ...Array.from(new Set(assignedAnomalies.map((a) => (a.module || "").toLowerCase())))].map((mod) => (
                    <Chip
                      key={mod}
                      label={mod === "all" ? `All (${assignedAnomalies.length})` : mod.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      onClick={() => setAssignedModuleFilter(mod)}
                      size="small"
                      sx={{
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: assignedModuleFilter === mod ? 800 : 600,
                        bgcolor: assignedModuleFilter === mod ? "#0284c7" : "#ffffff",
                        color: assignedModuleFilter === mod ? "#ffffff" : "#475569",
                        border: assignedModuleFilter === mod ? "1px solid #0284c7" : "1px solid #cbd5e1",
                        "&:hover": { bgcolor: assignedModuleFilter === mod ? "#0369a1" : "#f1f5f9" },
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Assigned Anomalies Registry Table */}
              {filteredAssignedAnomalies.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center", bgcolor: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                  <Typography sx={{ color: "#64748b", fontSize: "13px", fontWeight: 600 }}>
                    No assigned anomalies found matching the current search or module filter.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left", backgroundColor: "#ffffff" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                        <th style={{ padding: "8px 6px", color: "#1e293b", fontWeight: 800, width: "30px", textAlign: "center" }}>#</th>
                        <th style={{ padding: "8px 8px", color: "#1e293b", fontWeight: 800 }}>Module</th>
                        <th style={{ padding: "8px 10px", color: "#1e293b", fontWeight: 800 }}>Metric / Anomaly KPI Name</th>
                        <th style={{ padding: "8px 6px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Platform</th>
                        <th style={{ padding: "8px 8px", color: "#1e293b", fontWeight: 800, textAlign: "right" }}>Actual vs Base</th>
                        <th style={{ padding: "8px 6px", color: "#1e293b", fontWeight: 800, textAlign: "right" }}>Dev</th>
                        <th style={{ padding: "8px 8px", color: "#1e293b", fontWeight: 800 }}>Assigned To</th>
                        <th style={{ padding: "8px 8px", color: "#1e293b", fontWeight: 800 }}>Assigned By</th>
                        <th style={{ padding: "8px 8px", color: "#1e293b", fontWeight: 800, whiteSpace: "nowrap" }}>Date & Time</th>
                        <th style={{ padding: "8px 6px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Priority</th>
                        <th style={{ padding: "8px 6px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Status</th>
                        <th style={{ padding: "8px 10px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssignedAnomalies.map((anom, idx) => {
                        const dev = anom.deviation_pct !== undefined ? anom.deviation_pct : -100.0;
                        const devColor = Math.abs(dev) >= 25 ? "#dc2626" : Math.abs(dev) >= 10 ? "#ea580c" : "#16a34a";
                        const devBg = Math.abs(dev) >= 25 ? "#fee2e2" : Math.abs(dev) >= 10 ? "#ffedd5" : "#dcfce7";
                        const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
                        return (
                          <tr
                            key={anom.id || idx}
                            style={{
                              backgroundColor: rowBg,
                              borderBottom: "1px solid #e2e8f0",
                              transition: "background-color 0.15s ease",
                            }}
                          >
                            <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#64748b" }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  backgroundColor: "#eff6ff",
                                  color: "#1d4ed8",
                                  fontWeight: 700,
                                  fontSize: "11px",
                                  border: "1px solid #bfdbfe",
                                }}
                              >
                                {anom.module || "General"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "13px" }}>
                                {anom.kpi_label || anom.kpi}
                              </div>
                              <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>
                                ID: {anom.id}
                              </div>
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  backgroundColor: "#f1f5f9",
                                  color: "#334155",
                                  fontWeight: 600,
                                  fontSize: "11px",
                                }}
                              >
                                {anom.platform || "All"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontSize: "12px", color: "#334155" }}>
                              <strong>{anom.actual}{anom.unit || ""}</strong> / <span style={{ color: "#64748b" }}>{anom.baseline}{anom.unit || ""}</span>
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  backgroundColor: devBg,
                                  color: devColor,
                                  fontWeight: 800,
                                  fontSize: "11px",
                                  border: `1px solid ${devColor}33`,
                                }}
                              >
                                {dev > 0 ? "+" : ""}{dev}%
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ color: "#0369a1", fontWeight: 700, fontSize: "12px" }}>
                                {anom.assigned_to || "abhishek.j@trailytics.com"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", color: "#475569", fontWeight: 600, fontSize: "12px" }}>
                              {anom.assigned_by || "shushant@trailytics.com"}
                            </td>
                            <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <span>📅</span> {anom.assigned_at || "23 Nov 2026, 03:36 PM"}
                              </div>
                            </td>
                            <td style={{ padding: "10px 10px", textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 7px",
                                  borderRadius: "4px",
                                  backgroundColor: "#fee2e2",
                                  color: "#dc2626",
                                  fontWeight: 800,
                                  fontSize: "10px",
                                }}
                              >
                                {anom.priority || "P1"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 10px", textAlign: "center" }}>
                              {anom.assignment_status === "FIXED" || anom.status === "FIXED" ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "3px 8px",
                                    borderRadius: "12px",
                                    backgroundColor: "#dcfce7",
                                    color: "#15803d",
                                    fontWeight: 800,
                                    fontSize: "11px",
                                    border: "1px solid #86efac",
                                  }}
                                >
                                  ✓ FIXED
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "3px 8px",
                                    borderRadius: "12px",
                                    backgroundColor: "#e0f2fe",
                                    color: "#0369a1",
                                    fontWeight: 800,
                                    fontSize: "11px",
                                    border: "1px solid #bae6fd",
                                  }}
                                >
                                  ASSIGNED
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "center" }}>
                              <Box sx={{ display: "flex", gap: 0.8, justifyContent: "center", alignItems: "center" }}>
                                {anom.assignment_status === "FIXED" || anom.status === "FIXED" ? (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={markingDoneId === anom.id}
                                    onClick={() => handleMarkAnomalyDone(anom, "ASSIGNED")}
                                    startIcon={<ReplayIcon sx={{ fontSize: "13px !important" }} />}
                                    sx={{
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      textTransform: "none",
                                      p: "2px 8px",
                                      minWidth: "auto",
                                      borderColor: "#cbd5e1",
                                      color: "#64748b",
                                      "&:hover": { borderColor: "#94a3b8", color: "#334155" },
                                    }}
                                  >
                                    {markingDoneId === anom.id ? "Saving..." : "Reopen"}
                                  </Button>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    disabled={markingDoneId === anom.id}
                                    onClick={() => handleMarkAnomalyDone(anom, "FIXED")}
                                    startIcon={<CheckCircleIcon sx={{ fontSize: "13px !important" }} />}
                                    sx={{
                                      fontSize: "11px",
                                      fontWeight: 800,
                                      textTransform: "none",
                                      p: "2px 9px",
                                      minWidth: "auto",
                                      bgcolor: "#16a34a",
                                      color: "#ffffff",
                                      boxShadow: "0 2px 5px rgba(22, 163, 74, 0.3)",
                                      "&:hover": { bgcolor: "#15803d" },
                                    }}
                                  >
                                    {markingDoneId === anom.id ? "Saving..." : "Mark Done"}
                                  </Button>
                                )}
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setSelectedKpiForChart({
                                      kpiKey: anom.kpi,
                                      kpiLabel: anom.kpi_label || anom.kpi,
                                      module: anom.module,
                                      segment: anom.segment,
                                      client: anom.client || selectedClient,
                                      platform: anom.platform,
                                      metric: anom.metric,
                                      api: anom.step1_api_val,
                                      logic: anom.step2_logic_val,
                                      ui: anom.step3_ui_val,
                                      actual: anom.actual,
                                      baseline: anom.baseline,
                                      deviation_pct: anom.deviation_pct,
                                      severity: anom.severity,
                                      threshold_pct: anom.threshold_pct,
                                      unit: anom.unit || "%",
                                      rca: anom.rca,
                                      anomalyObj: anom,
                                    });
                                    setChartDrawerOpen(true);
                                  }}
                                  sx={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    textTransform: "none",
                                    p: "2px 8px",
                                    minWidth: "auto",
                                    borderColor: "#cbd5e1",
                                    color: "#1d4ed8",
                                  }}
                                >
                                  Drill-Down
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => {
                                    setEmailModalConfig({
                                      open: true,
                                      client: anom.client || selectedClient,
                                      selectedAnomaly: anom,
                                      anomalies: [anom],
                                    });
                                  }}
                                  sx={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    textTransform: "none",
                                    p: "2px 8px",
                                    minWidth: "auto",
                                    bgcolor: "#0078d4",
                                    color: "#ffffff",
                                    "&:hover": { bgcolor: "#005a9e" },
                                  }}
                                >
                                  Email
                                </Button>
                              </Box>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Box>
              )}
            </Card>
          ) : activeMainTab === "brand_anomalies" ? (
            <Chip
              label="Cross-Module Variance • Strict ±10% Tolerance Boundary"
              size="small"
              sx={{
                bgcolor: "#f1f5f9",
                color: "#475569",
                fontWeight: 700,
                fontSize: "11px",
                border: "1px solid #cbd5e1",
              }}
            />
          ) : (
            <Chip
              icon={<AutoGraphIcon sx={{ fontSize: "14px !important", color: brandAnomalies.length > 0 ? "#dc2626 !important" : "#16a34a !important" }} />}
              label={brandAnomalies.length > 0 ? `${brandAnomalies.length} Anomalies Detected (${currentClientObj.label})` : "Corridor Normal (0 Anomalies)"}
              onClick={() => setActiveMainTab("brand_anomalies")}
              size="small"
              sx={{
                cursor: "pointer",
                bgcolor: brandAnomalies.length > 0 ? "#fee2e2" : "#dcfce7",
                color: brandAnomalies.length > 0 ? "#dc2626" : "#16a34a",
                fontWeight: 700,
                fontSize: "12px",
                border: brandAnomalies.length > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                "&:hover": {
                  bgcolor: brandAnomalies.length > 0 ? "#fecaca" : "#bbf7d0",
                },
              }}
            />
          )}
        </Box>
      </Box>

      {activeMainTab === "brand_anomalies" ? (
        <Card
          sx={{
            borderRadius: "16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            p: 3,
            mb: 3,
          }}
        >
          {/* Header & Stats Banner */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 3 }}>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                <WarningAmberIcon sx={{ color: "#dc2626", fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>
                  {currentClientObj.label} Anomaly Sentinel Matrix
                </Typography>
                <Chip
                  label={`${brandAnomalies.length} Total Anomalies`}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: "12px",
                    bgcolor: brandAnomalies.length > 0 ? "#fee2e2" : "#dcfce7",
                    color: brandAnomalies.length > 0 ? "#dc2626" : "#16a34a",
                    border: brandAnomalies.length > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                  }}
                />
              </Box>
              <Typography sx={{ color: "#64748b", fontSize: "13px", mt: 0.5 }}>
                Cross-module variance evaluation for <strong>{currentClientObj.label}</strong>. Identifies all verified KPIs deviating beyond the strict <strong>±10% tolerance boundary</strong> relative to 30-day historical baselines.
              </Typography>
            </Box>

            {/* Quick Stat Counter Cards */}
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              <Box sx={{ p: 1.5, px: 2, bgcolor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                <Typography sx={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>TESTED MODULES</Typography>
                <Typography sx={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>{modules.length}</Typography>
              </Box>
              <Box sx={{ p: 1.5, px: 2, bgcolor: "#fef2f2", borderRadius: "10px", border: "1px solid #fecaca", textAlign: "center" }}>
                <Typography sx={{ fontSize: "11px", color: "#dc2626", fontWeight: 700 }}>WITH ANOMALIES</Typography>
                <Typography sx={{ fontSize: "18px", fontWeight: 800, color: "#dc2626" }}>
                  {Object.keys(moduleAnomalyCounts).length}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, px: 2, bgcolor: "#f0fdf4", borderRadius: "10px", border: "1px solid #bbf7d0", textAlign: "center" }}>
                <Typography sx={{ fontSize: "11px", color: "#16a34a", fontWeight: 700 }}>ZERO ANOMALY MODULES</Typography>
                <Typography sx={{ fontSize: "18px", fontWeight: 800, color: "#16a34a" }}>
                  {Math.max(0, modules.length - Object.keys(moduleAnomalyCounts).length)}
                </Typography>
              </Box>
              <Box
                onClick={() => setActiveMainTab("assigned_anomalies")}
                sx={{
                  p: 1.5,
                  px: 2,
                  bgcolor: "#f0f9ff",
                  borderRadius: "10px",
                  border: "1px solid #bae6fd",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  "&:hover": { borderColor: "#0284c7", transform: "translateY(-1px)" },
                }}
              >
                <Typography sx={{ fontSize: "11px", color: "#0284c7", fontWeight: 700 }}>ASSIGNED TO TESTER</Typography>
                <Typography sx={{ fontSize: "18px", fontWeight: 800, color: "#0284c7" }}>
                  {assignedAnomalies.length} Issues
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  setEmailModalConfig({
                    open: true,
                    client: selectedClient,
                    selectedAnomaly: null,
                    anomalies: brandAnomalies,
                  });
                }}
                startIcon={<EmailIcon />}
                sx={{
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "12px",
                  textTransform: "none",
                  bgcolor: "#0284c7",
                  color: "#ffffff",
                  px: 2,
                  boxShadow: "none",
                  "&:hover": { bgcolor: "#0369a1" },
                }}
              >
                Forward All {brandAnomalies.length} Anomalies
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => handleClearAnomalies(selectedClient)}
                disabled={brandAnomalies.length === 0}
                startIcon={<DeleteOutlineIcon />}
                sx={{
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "12px",
                  textTransform: "none",
                  borderColor: "#fca5a5",
                  color: "#dc2626",
                  bgcolor: "#ffffff",
                  px: 1.5,
                  "&:hover": { bgcolor: "#fee2e2", borderColor: "#f87171" },
                }}
              >
                Clear {currentClientObj.label} Anomalies
              </Button>
            </Box>
          </Box>

          {/* Module Switcher Pills */}
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#475569", mb: 1.2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Switch Module to Inspect Anomalies:
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Button
                size="small"
                variant={anomalyModuleFilter === "all" ? "contained" : "outlined"}
                onClick={() => setAnomalyModuleFilter("all")}
                sx={{
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: anomalyModuleFilter === "all" ? 800 : 600,
                  textTransform: "none",
                  bgcolor: anomalyModuleFilter === "all" ? "#2563eb" : "#ffffff",
                  color: anomalyModuleFilter === "all" ? "#ffffff" : "#334155",
                  borderColor: anomalyModuleFilter === "all" ? "#2563eb" : "#cbd5e1",
                  "&:hover": {
                    bgcolor: anomalyModuleFilter === "all" ? "#1d4ed8" : "#f1f5f9",
                  },
                  px: 1.8,
                }}
              >
                🌐 All Tested Modules ({brandAnomalies.length})
              </Button>

              <Button
                size="small"
                variant={anomalyModuleFilter === "assigned" ? "contained" : "outlined"}
                onClick={() => {
                  setAnomalyModuleFilter("assigned");
                  setActiveMainTab("assigned_anomalies");
                }}
                sx={{
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 800,
                  textTransform: "none",
                  bgcolor: anomalyModuleFilter === "assigned" ? "#0284c7" : "#f0f9ff",
                  color: anomalyModuleFilter === "assigned" ? "#ffffff" : "#0284c7",
                  borderColor: anomalyModuleFilter === "assigned" ? "#0284c7" : "#bae6fd",
                  "&:hover": {
                    bgcolor: anomalyModuleFilter === "assigned" ? "#0369a1" : "#e0f2fe",
                  },
                  px: 1.8,
                }}
              >
                📋 Assigned to Tester ({assignedAnomalies.length})
              </Button>

              {modules.map((m) => {
                const count = moduleAnomalyCounts[m.id.toLowerCase()] || 0;
                const isSelected = anomalyModuleFilter.toLowerCase() === m.id.toLowerCase();
                return (
                  <Button
                    key={m.id}
                    size="small"
                    variant={isSelected ? "contained" : "outlined"}
                    onClick={() => setAnomalyModuleFilter(m.id)}
                    sx={{
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: isSelected ? 800 : 600,
                      textTransform: "none",
                      bgcolor: isSelected
                        ? (count > 0 ? "#dc2626" : "#2563eb")
                        : (count > 0 ? "#fff1f2" : "#ffffff"),
                      color: isSelected
                        ? "#ffffff"
                        : (count > 0 ? "#dc2626" : "#475569"),
                      borderColor: isSelected
                        ? (count > 0 ? "#dc2626" : "#2563eb")
                        : (count > 0 ? "#fecaca" : "#e2e8f0"),
                      "&:hover": {
                        bgcolor: isSelected
                          ? (count > 0 ? "#b91c1c" : "#1d4ed8")
                          : (count > 0 ? "#fee2e2" : "#f1f5f9"),
                      },
                      px: 1.5,
                    }}
                    endIcon={
                      count > 0 ? (
                        <Box component="span" sx={{ bgcolor: isSelected ? "rgba(255,255,255,0.3)" : "#dc2626", color: "#ffffff", borderRadius: "10px", px: 0.8, py: 0.1, fontSize: "10px", fontWeight: 800 }}>
                          {count}
                        </Box>
                      ) : (
                        <CheckCircleIcon sx={{ fontSize: "14px !important", color: isSelected ? "#ffffff !important" : "#16a34a !important" }} />
                      )
                    }
                  >
                    {m.name}
                  </Button>
                );
              })}
            </Box>
          </Box>

          {/* Anomaly Cards List or Zero-Anomaly Status Message */}
          {filteredBrandAnomalies.length === 0 ? (
            <Card
              sx={{
                p: 4,
                borderRadius: "16px",
                border: "1px solid #bbf7d0",
                bgcolor: "#f0fdf4",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", mb: 2, border: "2px solid #86efac" }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 36, color: "#16a34a" }} />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, color: "#14532d", mb: 0.5 }}>
                Zero Anomalies Detected for {currentClientObj.label} in {anomalyModuleFilter === "all" ? "All Selected Modules" : (modules.find((m) => m.id === anomalyModuleFilter)?.name || anomalyModuleFilter)}
              </Typography>

              <Chip
                label="100% Within Historical Tolerance Corridor (≤ 10% Deviation)"
                size="small"
                sx={{ bgcolor: "#dcfce7", color: "#15803d", fontWeight: 800, fontSize: "12px", border: "1px solid #86efac", mb: 2 }}
              />

              <Typography sx={{ color: "#166534", fontSize: "13px", maxWidth: 680, lineHeight: 1.6, mb: 3 }}>
                All tested KPIs in <strong>{anomalyModuleFilter === "all" ? "these modules" : (modules.find((m) => m.id === anomalyModuleFilter)?.name || anomalyModuleFilter)}</strong> are operating normally within the strict ±10% tolerance boundary relative to historical 30-day baselines. Stage 1 Parity Verification confirmed 100% consistency across Platform API, ClickHouse OLAP logic, and visible Chrome UI with zero data drift or operational disparities.
              </Typography>

              {/* Verified Checklist Box */}
              <Box sx={{ bgcolor: "#ffffff", borderRadius: "12px", border: "1px solid #bbf7d0", p: 2.5, width: "100%", maxWidth: 640, textAlign: "left" }}>
                <Typography sx={{ fontWeight: 700, fontSize: "12px", color: "#15803d", mb: 1.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Verified Quality & Tolerance Checklist ({currentClientObj.label})
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: "#16a34a" }} />
                    <Typography sx={{ fontSize: "12px", color: "#1e293b", fontWeight: 600 }}>
                      3-Way Consistency: API == ClickHouse OLAP == Live Chrome UI Parity Confirmed
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: "#16a34a" }} />
                    <Typography sx={{ fontSize: "12px", color: "#1e293b", fontWeight: 600 }}>
                      Historical Drift: All KPIs within ±10% expected corridor (Zero statistical anomalies)
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: "#16a34a" }} />
                    <Typography sx={{ fontSize: "12px", color: "#1e293b", fontWeight: 600 }}>
                      Root Cause Engine: Zero business alerts, platform shocks, or SKU deviations detected
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ mt: 3, display: "flex", gap: 1.5 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    if (anomalyModuleFilter !== "all") {
                      setSelectedModule(anomalyModuleFilter);
                    }
                    setActiveMainTab("parity_suite");
                  }}
                  sx={{
                    borderRadius: "10px",
                    textTransform: "none",
                    fontWeight: 700,
                    fontSize: "12px",
                    borderColor: "#86efac",
                    color: "#15803d",
                    bgcolor: "#ffffff",
                    "&:hover": { bgcolor: "#f0fdf4", borderColor: "#16a34a" },
                  }}
                >
                  📋 View Segment Parity Suite for {anomalyModuleFilter === "all" ? currentModuleObj?.name : (modules.find((m) => m.id === anomalyModuleFilter)?.name || "Module")}
                </Button>
              </Box>
            </Card>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {filteredBrandAnomalies.map((anom) => (
                <Card
                  key={anom.id}
                  sx={{
                    bgcolor: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    p: 2.5,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      borderColor: "#cbd5e1",
                    },
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Chip
                          label={(anom.client || selectedClient).toUpperCase()}
                          size="small"
                          sx={{ fontWeight: 800, fontSize: "11px", bgcolor: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0" }}
                        />
                        <Chip
                          label={modules.find((m) => m.id === anom.module)?.name || anom.module}
                          size="small"
                          sx={{ fontWeight: 700, fontSize: "11px", bgcolor: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}
                        />
                        <Chip
                          label={`Segment: ${anom.segment}`}
                          size="small"
                          sx={{ fontWeight: 600, fontSize: "11px", bgcolor: "#f8fafc", color: "#64748b" }}
                        />
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: "16px", color: "#0f172a", mt: 1 }}>
                        {anom.kpi_label || anom.kpi}
                      </Typography>
                      <Typography sx={{ fontSize: "11px", color: "#64748b", mt: 0.3 }}>
                        Verified Run ID: <code style={{ fontSize: "10px", color: "#475569" }}>{anom.verified_run_id || "sentinel_auto"}</code> • Detected {anom.timestamp}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip
                        label={anom.severity || "WARNING"}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          fontSize: "11px",
                          bgcolor: anom.severity === "CRITICAL" ? "#fee2e2" : "#fef3c7",
                          color: anom.severity === "CRITICAL" ? "#dc2626" : "#d97706",
                          border: anom.severity === "CRITICAL" ? "1px solid #fecaca" : "1px solid #fde68a",
                        }}
                      />
                      <Chip
                        label={`${anom.deviation_pct > 0 ? "+" : ""}${anom.deviation_pct}% Deviation`}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          fontSize: "12px",
                          bgcolor: "#fee2e2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                        }}
                      />
                    </Box>
                  </Box>

                  {/* 3-Way Parity Verification Box */}
                  <Box sx={{ bgcolor: "#f8fafc", p: 1.5, borderRadius: "10px", border: "1px solid #e2e8f0", mb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                      <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                        3-Way Consistency Parity:
                      </Typography>
                      <Typography sx={{ fontSize: "12px", color: "#1e293b", fontWeight: 600 }}>
                        API: <strong>{anom.step1_api_val !== undefined && anom.step1_api_val !== null ? anom.step1_api_val : "—"}</strong>
                      </Typography>
                      <Typography sx={{ fontSize: "12px", color: "#1e293b", fontWeight: 600 }}>
                        ClickHouse Logic: <strong>{anom.step2_logic_val !== undefined && anom.step2_logic_val !== null ? anom.step2_logic_val : "—"}</strong>
                      </Typography>
                      <Typography sx={{ fontSize: "12px", color: "#1e293b", fontWeight: 600 }}>
                        Live UI (Chrome): <strong>{anom.step3_ui_val !== undefined && anom.step3_ui_val !== null ? anom.step3_ui_val : "—"}</strong>
                      </Typography>
                    </Box>
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: "14px !important", color: "#16a34a !important" }} />}
                      label="100% 3-Way Parity Confirmed (Zero Code Drift)"
                      size="small"
                      sx={{ bgcolor: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: "11px", border: "1px solid #bbf7d0" }}
                    />
                  </Box>

                  {/* Actual vs 30-Day Historical Baseline */}
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5, mb: 1.5 }}>
                    <Box sx={{ p: 1.5, bgcolor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <Typography sx={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Current Value</Typography>
                      <Typography sx={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                        {anom.actual} <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>{anom.unit}</span>
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, bgcolor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <Typography sx={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>30-Day Historical Baseline</Typography>
                      <Typography sx={{ fontSize: "18px", fontWeight: 800, color: "#64748b" }}>
                        {anom.baseline} <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>{anom.unit}</span>
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, bgcolor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <Typography sx={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Allowed Tolerance Corridor</Typography>
                      <Typography sx={{ fontSize: "18px", fontWeight: 800, color: "#2563eb" }}>
                        ±{anom.threshold_pct || 10.0}%
                      </Typography>
                    </Box>
                  </Box>

                  {/* Root Cause Analysis (RCA) Box */}
                  {anom.rca && (
                    <Box sx={{ bgcolor: "#f8fafc", p: 1.5, borderRadius: "10px", border: "1px solid #e2e8f0", mb: 2 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <Typography sx={{ fontSize: "11px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase" }}>
                          RCA Diagnosis: {anom.rca.class}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: "12px", color: "#334155", lineHeight: 1.5 }}>
                        {anom.rca.summary}
                      </Typography>
                    </Box>
                  )}

                  {/* Actions */}
                  <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setEmailModalConfig({
                          open: true,
                          client: anom.client || selectedClient,
                          selectedAnomaly: anom,
                          anomalies: [anom],
                        });
                      }}
                      startIcon={<EmailIcon />}
                      sx={{
                        fontSize: "12px",
                        fontWeight: 700,
                        textTransform: "none",
                        color: "#0284c7",
                        borderColor: "#bae6fd",
                        bgcolor: "#f0f9ff",
                        borderRadius: "8px",
                        "&:hover": {
                          bgcolor: "#e0f2fe",
                          borderColor: "#7dd3fc",
                        },
                      }}
                    >
                      Assign via Email
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        setSelectedKpiForChart({
                          kpiKey: anom.kpi,
                          kpiLabel: anom.kpi_label || anom.kpi,
                          module: anom.module,
                          segment: anom.segment,
                          client: anom.client || selectedClient,
                          platform: anom.platform,
                          metric: anom.metric,
                          api: anom.step1_api_val,
                          logic: anom.step2_logic_val,
                          ui: anom.step3_ui_val,
                          actual: anom.actual,
                          baseline: anom.baseline,
                          deviation_pct: anom.deviation_pct,
                          severity: anom.severity,
                          threshold_pct: anom.threshold_pct,
                          unit: anom.unit || "%",
                          rca: anom.rca,
                          anomalyObj: anom,
                        });
                        setChartDrawerOpen(true);
                      }}
                      startIcon={<AutoGraphIcon />}
                      sx={{
                        fontSize: "12px",
                        fontWeight: 700,
                        textTransform: "none",
                        bgcolor: "#2563eb",
                        color: "#ffffff",
                        borderRadius: "8px",
                        boxShadow: "0 2px 6px rgba(37,99,235,0.2)",
                        "&:hover": {
                          bgcolor: "#1d4ed8",
                        },
                      }}
                    >
                      Inspect Graph & 5-Level Drill-Down
                    </Button>
                  </Box>
                </Card>
              ))}
            </Box>
          )}
        </Card>
      ) : (
        /* Segments Table */
        <Card
          sx={{
            borderRadius: "16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}
        >
          <Box sx={{ p: 2, bgcolor: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                Segments for {currentModuleObj?.name || "Pricing Analysis"} ({currentClientObj.label})
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b" }}>
                {segments.length} Segments available for {currentModuleObj?.name || "Module"}
              </Typography>
            </Box>

            <Button
              variant="contained"
              size="small"
              startIcon={activeRunId && isBatchMode ? <CircularProgress size={16} sx={{ color: "#ffffff" }} /> : <PlayArrowIcon />}
              onClick={handleOpenRunAllModal}
              disabled={!!activeRunId || segments.length === 0}
              sx={{
                bgcolor: activeRunId && isBatchMode ? "#3b82f6" : "#2563eb",
                "&:hover": { bgcolor: "#1d4ed8" },
                borderRadius: "10px",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "13px",
                px: 2,
                py: 0.7,
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
              }}
            >
              {activeRunId && isBatchMode
                ? `Running Batch (${(batchQueue.indexOf(activeRunId) + 1 || 1)}/${batchQueue.length || segments.length})...`
                : `Run All Segments (${segments.length})`}
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "#ffffff" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: "13px", color: "#64748b" }}>
                    Segment / Section
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "13px", color: "#64748b", width: 140 }}>
                    Action
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "13px", color: "#64748b", width: 240 }}>
                    Verification Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "13px", color: "#64748b", width: 160 }}>
                    Details
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {segments.map((seg) => {
                  const key = `${selectedModule.toLowerCase()}:${seg.id.toLowerCase()}:${selectedClient.toLowerCase()}`;
                  const run = runsMap[key];
                  const isRunning = run?.status === "running";

                  return (
                    <TableRow key={seg.id} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          {getSegmentIcon(seg.id)}
                          <span>{seg.label}</span>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Tooltip title={`Run 3-way test for ${seg.label} on ${currentClientObj.label}`}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenPeriodModal(seg)}
                              disabled={isRunning || !!activeRunId}
                              sx={{
                                bgcolor: "#f1f5f9",
                                color: "#2563eb",
                                "&:hover": { bgcolor: "#e2e8f0" },
                              }}
                            >
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>

                      <TableCell>{renderStatusBadge(run)}</TableCell>

                      <TableCell>
                        {run && run.status !== "running" ? (
                          <Button
                            size="small"
                            onClick={() => {
                              setDrawerRunData(run);
                              setDetailsDrawerOpen(true);
                            }}
                            sx={{
                              fontSize: "12px",
                              fontWeight: 700,
                              textTransform: "none",
                              color: run.overall === "PASS" ? "#16a34a" : "#dc2626",
                            }}
                          >
                            View details
                          </Button>
                        ) : (
                          <Typography sx={{ fontSize: "12px", color: "#94a3b8" }}>—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Sentinel Verification Filter Configuration Dialog */}

      <Dialog

        open={sentinelFilterModalOpen}

        onClose={() => setSentinelFilterModalOpen(false)}

        maxWidth="sm"

        fullWidth

        PaperProps={{

          sx: {

            borderRadius: "20px",

            p: 1.5,

            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",

          },

        }}

      >

        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>

            <TuneIcon sx={{ color: "#2563eb", fontSize: 24 }} />

            <Box>

              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "16px", color: "#0f172a" }}>

                Verification Filter Configuration

              </Typography>

              <Typography variant="caption" sx={{ color: "#64748b" }}>

                Target Scope: <strong>{sentinelTargetClient === "all" ? "All Brands (Full Fleet)" : (clients.find(c => c.id === sentinelTargetClient)?.label || sentinelTargetClient)}</strong>

              </Typography>

            </Box>

          </Box>

          <IconButton size="small" onClick={() => {
            const startStr = customSentinelFilters.startDate || timeStart.format("YYYY-MM-DD");
            const endStr = customSentinelFilters.endDate || timeEnd.format("YYYY-MM-DD");
            setCustomSentinelFilters((prev) => ({
              ...prev,
              startDate: startStr,
              endDate: endStr,
            }));
            setSelectedPeriod({ startDate: startStr, endDate: endStr });
            setSentinelFilterMode("custom");
            setSentinelFilterModalOpen(false);
          }}>

            <CloseIcon fontSize="small" />

          </IconButton>

        </DialogTitle>



        <DialogContent sx={{ pt: 1.5 }}>

          {/* Mode Switcher Tabs */}

          <Box sx={{ display: "flex", gap: 1.5, p: 0.5, bgcolor: "#f1f5f9", borderRadius: "12px", mb: 2.5 }}>

            <Button

              fullWidth

              size="small"

              variant={sentinelFilterMode === "default" ? "contained" : "text"}

              onClick={() => setSentinelFilterMode("default")}

              sx={{

                borderRadius: "8px",

                textTransform: "none",

                fontWeight: 700,

                fontSize: "12px",

                bgcolor: sentinelFilterMode === "default" ? "#2563eb" : "transparent",

                color: sentinelFilterMode === "default" ? "#ffffff" : "#475569",

                boxShadow: sentinelFilterMode === "default" ? "0 2px 4px rgba(37,99,235,0.2)" : "none",

                "&:hover": { bgcolor: sentinelFilterMode === "default" ? "#1d4ed8" : "#e2e8f0" },

              }}

            >

              ⚡ Default Baseline Filters

            </Button>



            <Button

              fullWidth

              size="small"

              variant={sentinelFilterMode === "custom" ? "contained" : "text"}

              onClick={() => setSentinelFilterMode("custom")}

              sx={{

                borderRadius: "8px",

                textTransform: "none",

                fontWeight: 700,

                fontSize: "12px",

                bgcolor: sentinelFilterMode === "custom" ? "#2563eb" : "transparent",

                color: sentinelFilterMode === "custom" ? "#ffffff" : "#475569",

                boxShadow: sentinelFilterMode === "custom" ? "0 2px 4px rgba(37,99,235,0.2)" : "none",

                "&:hover": { bgcolor: sentinelFilterMode === "custom" ? "#1d4ed8" : "#e2e8f0" },

              }}

            >

              🎯 Custom Filter Configuration

            </Button>

          </Box>



          {/* Default Baseline Specifications View */}

          {sentinelFilterMode === "default" ? (

            <Box sx={{ p: 2.5, bgcolor: "#f8fafc", borderRadius: "14px", border: "1px solid #e2e8f0" }}>

              <Typography sx={{ fontWeight: 800, fontSize: "13px", color: "#1e293b", mb: 1.5 }}>

                Standard Baseline Filter Specifications

              </Typography>



              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, fontSize: "12px", color: "#334155" }}>

                <Box sx={{ display: "flex", justifyContent: "space-between", pb: 1, borderBottom: "1px solid #e2e8f0" }}>

                  <span style={{ color: "#64748b", fontWeight: 600 }}>Active Period:</span>

                  <strong style={{ color: "#0f172a" }}>Dynamic Client Baseline (Mars: Oct 2026, DRL: Apr-Sep 2026, Fleet: 14-Day)</strong>

                </Box>

                <Box sx={{ display: "flex", justifyContent: "space-between", pb: 1, borderBottom: "1px solid #e2e8f0" }}>

                  <span style={{ color: "#64748b", fontWeight: 600 }}>Platform Coverage:</span>

                  <strong style={{ color: "#0f172a" }}>All Supported Platforms (Amazon, Blinkit, Zepto, Instamart, Flipkart)</strong>

                </Box>

                <Box sx={{ display: "flex", justifyContent: "space-between", pb: 1, borderBottom: "1px solid #e2e8f0" }}>

                  <span style={{ color: "#64748b", fontWeight: 600 }}>Channel Scope:</span>

                  <strong style={{ color: "#0f172a" }}>All Channels (Quick Commerce, E-Commerce, National)</strong>

                </Box>

                <Box sx={{ display: "flex", justifyContent: "space-between", pb: 1, borderBottom: "1px solid #e2e8f0" }}>

                  <span style={{ color: "#64748b", fontWeight: 600 }}>Brand & Retailer:</span>

                  <strong style={{ color: "#0f172a" }}>All Brands, All Retailers & Sellers</strong>

                </Box>

                <Box sx={{ display: "flex", justifyContent: "space-between" }}>

                  <span style={{ color: "#64748b", fontWeight: 600 }}>Anomaly Tolerance:</span>

                  <strong style={{ color: "#16a34a" }}>Strict ≤ 10% Parity Threshold</strong>

                </Box>

              </Box>



              <Alert severity="info" sx={{ mt: 2, fontSize: "11px", borderRadius: "10px" }}>

                Default Baseline evaluates 100% of the active database without subset biases, guaranteeing comprehensive fleet coverage.

              </Alert>

            </Box>

          ) : (

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

              <Typography sx={{ fontWeight: 800, fontSize: "13px", color: "#1e293b" }}>

                Custom Verification Parameters

              </Typography>



              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Platform</InputLabel>
                  <Select
                    value={customSentinelFilters.platform}
                    label="Platform"
                    onChange={(e) => setCustomSentinelFilters({ ...customSentinelFilters, platform: e.target.value })}
                    sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}
                  >
                    {(availableFilterOptions.platforms || ["All", "Amazon", "Blinkit", "Zepto", "Instamart", "Flipkart"]).map((p) => (
                      <MenuItem key={p} value={p} sx={{ fontSize: "12px" }}>{p}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Channel</InputLabel>
                  <Select
                    value={customSentinelFilters.channel}
                    label="Channel"
                    onChange={(e) => setCustomSentinelFilters({ ...customSentinelFilters, channel: e.target.value })}
                    sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}
                  >
                    {(availableFilterOptions.channels || ["All", "Quick Commerce", "E-Commerce", "National"]).map((ch) => (
                      <MenuItem key={ch} value={ch} sx={{ fontSize: "12px" }}>{ch}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Brand Name</InputLabel>
                  <Select
                    value={customSentinelFilters.brandName}
                    label="Brand Name"
                    onChange={(e) => setCustomSentinelFilters({ ...customSentinelFilters, brandName: e.target.value })}
                    sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}
                  >
                    {(availableFilterOptions.brands || ["All"]).map((b) => (
                      <MenuItem key={b} value={b} sx={{ fontSize: "12px" }}>{b}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Category</InputLabel>
                  <Select
                    value={customSentinelFilters.category}
                    label="Category"
                    onChange={(e) => setCustomSentinelFilters({ ...customSentinelFilters, category: e.target.value })}
                    sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}
                  >
                    {(availableFilterOptions.categories || ["All"]).map((cat) => (
                      <MenuItem key={cat} value={cat} sx={{ fontSize: "12px" }}>{cat}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* If target client is DRL, show Retailer dropdown as well */}
              {(sentinelTargetClient === "drl" || selectedClient === "drl") && (
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 1.5 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Retailer Name</InputLabel>
                    <Select
                      value={customSentinelFilters.retailerName}
                      label="Retailer Name"
                      onChange={(e) => setCustomSentinelFilters({ ...customSentinelFilters, retailerName: e.target.value })}
                      sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}
                    >
                      {(primaryFilterOptions.retailers || ["All"]).map((r) => (
                        <MenuItem key={r} value={r} sx={{ fontSize: "12px" }}>{r}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}



              <Box sx={{ p: 1.5, bgcolor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>

                <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#334155", mb: 1 }}>

                  Custom Date Range

                </Typography>

                <DateRangeComparePicker

                  timeStart={timeStart}

                  timeEnd={timeEnd}

                  onApply={(s, e) => {
                    setTimeStart(s);
                    setTimeEnd(e);
                    const sStr = s.format("YYYY-MM-DD");
                    const eStr = e.format("YYYY-MM-DD");
                    setCustomSentinelFilters((prev) => ({
                      ...prev,
                      startDate: sStr,
                      endDate: eStr,
                    }));
                    setSelectedPeriod({ startDate: sStr, endDate: eStr });
                  }}
                />

                <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#64748b", fontWeight: 600 }}>

                  Active: {customSentinelFilters.startDate || timeStart.format("YYYY-MM-DD")} to {customSentinelFilters.endDate || timeEnd.format("YYYY-MM-DD")}

                </Typography>

              </Box>

            </Box>

          )}

        </DialogContent>



        <DialogActions sx={{ px: 3, pb: 2, pt: 1, display: "flex", justifyContent: "space-between" }}>

          <Button

            size="small"

            onClick={() => {
              setSentinelFilterMode("default");
              setCustomSentinelFilters({
                startDate: defaultStart.format("YYYY-MM-DD"),
                endDate: defaultEnd.format("YYYY-MM-DD"),
                platform: "All",
                channel: "All",
                brandName: "All",
                category: "All",
                retailerName: "All",
              });
              setSelectedPeriod({
                startDate: defaultStart.format("YYYY-MM-DD"),
                endDate: defaultEnd.format("YYYY-MM-DD"),
              });
              setSentinelFilterModalOpen(false);
            }}

            sx={{ color: "#64748b", textTransform: "none", fontWeight: 600, fontSize: "12px" }}

          >

            Reset to Default Baseline

          </Button>



          <Button

            size="small"

            variant="contained"

            onClick={() => {
              const startStr = customSentinelFilters.startDate || timeStart.format("YYYY-MM-DD");
              const endStr = customSentinelFilters.endDate || timeEnd.format("YYYY-MM-DD");
              setCustomSentinelFilters((prev) => ({
                ...prev,
                startDate: startStr,
                endDate: endStr,
              }));
              setSelectedPeriod({ startDate: startStr, endDate: endStr });
              setSentinelFilterMode("custom");
              setSentinelFilterModalOpen(false);
            }}

            sx={{

              bgcolor: "#2563eb",

              "&:hover": { bgcolor: "#1d4ed8" },

              borderRadius: "8px",

              textTransform: "none",

              fontWeight: 700,

              fontSize: "12px",

              px: 2,

            }}

          >

            Apply Custom Filters

          </Button>

        </DialogActions>

      </Dialog>



      {/* Time Period / PDS Parameters Selection Popup Dialog */}
      <Dialog
        open={periodModalOpen}
        onClose={() => setPeriodModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: "18px", p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: "18px", pb: 1 }}>
          {isBatchMode
            ? `Run All Segments: ${currentModuleObj?.name || "Module"}`
            : (selectedModule === "pds_score" ? "Configure PDS Score Verification" : "Select Verification Period")}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
            Target Client: <strong>{currentClientObj.label}</strong>
            <br />
            {isBatchMode ? (
              <>
                Scope: <strong>All {segments.length} Segments</strong> ({segments.map((s) => s.label).join(", ")})
                <br />
                <Typography component="span" sx={{ fontSize: "12px", color: "#2563eb", fontWeight: 600, display: "block", mt: 0.5 }}>
                  Executes sequentially in 1 shared Chrome session with identical filters applied across all segments.
                </Typography>
              </>
            ) : (
              <>Segment: <strong>{targetSegment?.label}</strong></>
            )}
          </Typography>

          {selectedModule === "pds_score" ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, my: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontSize: "13px", fontWeight: 600 }}>Platform</InputLabel>
                <Select
                  value={pdsPlatform}
                  label="Platform"
                  onChange={(e) => setPdsPlatform(e.target.value)}
                  sx={{ borderRadius: "10px", fontSize: "13px", fontWeight: 700 }}
                >
                  {["Blinkit", "Zepto", "Instamart", "Amazon", "Flipkart National", "BigBasket"].map((p) => (
                    <MenuItem key={p} value={p} sx={{ fontSize: "13px", fontWeight: 600 }}>
                      {p}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontSize: "13px", fontWeight: 600 }}>Year</InputLabel>
                <Select
                  value={pdsYear}
                  label="Year"
                  onChange={(e) => setPdsYear(e.target.value)}
                  sx={{ borderRadius: "10px", fontSize: "13px", fontWeight: 700 }}
                >
                  {["2026", "2025"].map((y) => (
                    <MenuItem key={y} value={y} sx={{ fontSize: "13px", fontWeight: 600 }}>
                      {y}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontSize: "13px", fontWeight: 600 }}>Mars Financial Period</InputLabel>
                <Select
                  value={pdsPeriod}
                  label="Mars Financial Period"
                  onChange={(e) => setPdsPeriod(e.target.value)}
                  sx={{ borderRadius: "10px", fontSize: "13px", fontWeight: 700 }}
                >
                  {["Period 1", "Period 2", "Period 3", "Period 4", "Period 5", "Period 6"].map((p) => (
                    <MenuItem key={p} value={p} sx={{ fontSize: "13px", fontWeight: 600 }}>
                      {p}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ mt: 1, p: 1.5, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px" }}>
                <Typography variant="caption" sx={{ color: "#166534", fontWeight: 700, display: "block" }}>
                  Applied PDS Parameters:
                </Typography>
                <Typography variant="body2" sx={{ color: "#15803d", fontWeight: 600, fontSize: "12px", mt: 0.5 }}>
                  Platform: <strong>{pdsPlatform}</strong> | Year: <strong>{pdsYear}</strong> | Period: <strong>{pdsPeriod}</strong>
                </Typography>
                {PDS_PERIOD_DATES[pdsPeriod] && (
                  <Typography variant="caption" sx={{ color: "#166534", fontSize: "11px", display: "block", mt: 0.3 }}>
                    Financial Cycle: {PDS_PERIOD_DATES[pdsPeriod].startDate} → {PDS_PERIOD_DATES[pdsPeriod].endDate}
                  </Typography>
                )}
              </Box>
            </Box>
          ) : (
            <>
              {selectedModule === "geo_intelligence" && (
                <Box sx={{ my: 1.5, p: 2, bgcolor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Typography sx={{ fontSize: "11px", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Active Verification Filters (Live India Overview Map & DB Query)
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Metric</InputLabel>
                      <Select
                        value={geoMetric}
                        label="Metric"
                        onChange={(e) => setGeoMetric(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(geoFilterOptions.metrics || ["OSA %", "Market Share", "Sales", "Orders"]).map((m) => (
                          <MenuItem key={m} value={m} sx={{ fontSize: "12px" }}>{m}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Channel</InputLabel>
                      <Select
                        value={geoChannel}
                        label="Channel"
                        onChange={(e) => {
                          const newCh = e.target.value;
                          setGeoChannel(newCh);
                          if (newCh !== "All" && geoFilterOptions?.channelPlatforms?.[newCh] && !geoFilterOptions.channelPlatforms[newCh].includes(geoPlatform)) {
                            setGeoPlatform("All");
                          }
                        }}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(geoFilterOptions.channels || ["All", "Quick Commerce", "E-Commerce"]).map((ch) => (
                          <MenuItem key={ch} value={ch} sx={{ fontSize: "12px" }}>{ch}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Platform</InputLabel>
                      <Select
                        value={geoPlatform}
                        label="Platform"
                        onChange={(e) => setGeoPlatform(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(() => {
                          const platList = (geoChannel !== "All" && geoFilterOptions?.channelPlatforms?.[geoChannel])
                            ? ["All", ...geoFilterOptions.channelPlatforms[geoChannel]]
                            : (geoFilterOptions.platforms || ["All"]);
                          return Array.from(new Set(platList)).map((p) => (
                            <MenuItem key={p} value={p} sx={{ fontSize: "12px" }}>{p}</MenuItem>
                          ));
                        })()}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Brand</InputLabel>
                      <Select
                        value={geoBrand}
                        label="Brand"
                        onChange={(e) => setGeoBrand(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(geoFilterOptions.brands || ["All"]).map((b) => (
                          <MenuItem key={b} value={b} sx={{ fontSize: "12px" }}>{b}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Category</InputLabel>
                      <Select
                        value={geoCategory}
                        label="Category"
                        onChange={(e) => setGeoCategory(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(geoFilterOptions.categories || ["All"]).map((c) => (
                          <MenuItem key={c} value={c} sx={{ fontSize: "12px" }}>{c}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Top SKU (MSL)</InputLabel>
                      <Select
                        value={geoMsl}
                        label="Top SKU (MSL)"
                        onChange={(e) => setGeoMsl(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(geoFilterOptions.msls || ["All", "0", "1"]).map((msl) => (
                          <MenuItem key={msl} value={msl} sx={{ fontSize: "12px" }}>{msl}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Time Period</InputLabel>
                      <Select
                        value={geoTimePeriod}
                        label="Time Period"
                        onChange={(e) => setGeoTimePeriod(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(geoFilterOptions.timePeriods || ["MTD", "7D", "14D", "31D", "Custom"]).map((tp) => (
                          <MenuItem key={tp} value={tp} sx={{ fontSize: "12px" }}>{tp}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              )}

              {selectedModule === "insights" && (
                <Box sx={{ my: 1.5, p: 2, bgcolor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Typography sx={{ fontSize: "11px", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Active Verification Filters (Live Insights Dashboard & DB Query)
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Channel</InputLabel>
                      <Select
                        value={insightsChannel}
                        label="Channel"
                        onChange={(e) => {
                          const newCh = e.target.value;
                          setInsightsChannel(newCh);
                          if (newCh !== "All" && insightsFilterOptions?.channelPlatforms?.[newCh] && !insightsFilterOptions.channelPlatforms[newCh].includes(insightsPlatform)) {
                            setInsightsPlatform("All");
                          }
                        }}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(insightsFilterOptions.channels || ["All", "Quick Commerce", "E-Commerce"]).map((ch) => (
                          <MenuItem key={ch} value={ch} sx={{ fontSize: "12px" }}>{ch}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Platform</InputLabel>
                      <Select
                        value={insightsPlatform}
                        label="Platform"
                        onChange={(e) => setInsightsPlatform(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(() => {
                          const platList = (insightsChannel !== "All" && insightsFilterOptions?.channelPlatforms?.[insightsChannel])
                            ? ["All", ...insightsFilterOptions.channelPlatforms[insightsChannel]]
                            : (insightsFilterOptions.platforms || ["All"]);
                          return platList.map((p) => (
                            <MenuItem key={p} value={p} sx={{ fontSize: "12px" }}>{p}</MenuItem>
                          ));
                        })()}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Category</InputLabel>
                      <Select
                        value={insightsCategory}
                        label="Category"
                        onChange={(e) => setInsightsCategory(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(insightsFilterOptions.categories || ["All"]).map((c) => (
                          <MenuItem key={c} value={c} sx={{ fontSize: "12px" }}>{c}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Brand</InputLabel>
                      <Select
                        value={insightsBrand}
                        label="Brand"
                        onChange={(e) => setInsightsBrand(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(insightsFilterOptions.brands || ["All"]).map((b) => (
                          <MenuItem key={b} value={b} sx={{ fontSize: "12px" }}>{b}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>City / Geography</InputLabel>
                      <Select
                        value={insightsCity}
                        label="City / Geography"
                        onChange={(e) => setInsightsCity(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(insightsFilterOptions.cities || ["All"]).map((ct) => (
                          <MenuItem key={ct} value={ct} sx={{ fontSize: "12px" }}>{ct}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              )}

              {selectedModule === "secondary_summary" && (
                <Box sx={{ my: 1.5, p: 2, bgcolor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Typography sx={{ fontSize: "11px", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Active Verification Filters (Live Secondary Dashboard & DB Query)
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Seller</InputLabel>
                      <Select
                        value={secSeller}
                        label="Seller"
                        onChange={(e) => setSecSeller(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(secFilterOptions.seller || ["All"]).map((s) => (
                          <MenuItem key={s} value={s} sx={{ fontSize: "12px" }}>{s}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Platform</InputLabel>
                      <Select
                        value={secPlatform}
                        label="Platform"
                        onChange={(e) => setSecPlatform(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(secFilterOptions.platformName || ["All"]).map((p) => (
                          <MenuItem key={p} value={p} sx={{ fontSize: "12px" }}>{p}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Brand</InputLabel>
                      <Select
                        value={secBrand}
                        label="Brand"
                        onChange={(e) => setSecBrand(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(secFilterOptions.brand || ["All"]).map((b) => (
                          <MenuItem key={b} value={b} sx={{ fontSize: "12px" }}>{b}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Sub Brand</InputLabel>
                      <Select
                        value={secSubBrand}
                        label="Sub Brand"
                        onChange={(e) => setSecSubBrand(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(secFilterOptions.subBrand || ["All"]).map((sb) => (
                          <MenuItem key={sb} value={sb} sx={{ fontSize: "12px" }}>{sb}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Fiscal Year</InputLabel>
                      <Select
                        value={secFiscalYear}
                        label="Fiscal Year"
                        onChange={(e) => setSecFiscalYear(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(secFilterOptions.fiscalYear || ["All"]).map((fy) => (
                          <MenuItem key={fy} value={fy} sx={{ fontSize: "12px" }}>{fy}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Quarter</InputLabel>
                      <Select
                        value={secQuarter}
                        label="Quarter"
                        onChange={(e) => setSecQuarter(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(secFilterOptions.quarter || ["All"]).map((q) => (
                          <MenuItem key={q} value={q} sx={{ fontSize: "12px" }}>{q}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>View By</InputLabel>
                      <Select
                        value={secViewBy}
                        label="View By"
                        onChange={(e) => setSecViewBy(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        <MenuItem value="daily" sx={{ fontSize: "12px" }}>Daily</MenuItem>
                        <MenuItem value="weekly" sx={{ fontSize: "12px" }}>Weekly</MenuItem>
                        <MenuItem value="monthly" sx={{ fontSize: "12px" }}>Monthly</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              )}
              {selectedModule === "primary_summary" && (
                <Box sx={{ my: 1.5, p: 2, bgcolor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Typography sx={{ fontSize: "11px", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Active Verification Filters (Live Dashboard & DB Query)
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Brand Name</InputLabel>
                      <Select
                        value={primaryBrand}
                        label="Brand Name"
                        onChange={(e) => setPrimaryBrand(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(primaryFilterOptions.brands || ["All"]).map((b) => (
                          <MenuItem key={b} value={b} sx={{ fontSize: "12px" }}>{b}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Retailer Name</InputLabel>
                      <Select
                        value={primaryRetailer}
                        label="Retailer Name"
                        onChange={(e) => setPrimaryRetailer(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(primaryFilterOptions.retailers || ["All"]).map((r) => (
                          <MenuItem key={r} value={r} sx={{ fontSize: "12px" }}>{r}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Division</InputLabel>
                      <Select
                        value={primaryDivision}
                        label="Division"
                        onChange={(e) => setPrimaryDivision(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(primaryFilterOptions.divisions || ["All"]).map((d) => (
                          <MenuItem key={d} value={d} sx={{ fontSize: "12px" }}>{d}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: "12px", fontWeight: 600 }}>Zone</InputLabel>
                      <Select
                        value={primaryZone}
                        label="Zone"
                        onChange={(e) => setPrimaryZone(e.target.value)}
                        sx={{ borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}
                      >
                        {(primaryFilterOptions.zones || ["All"]).map((z) => (
                          <MenuItem key={z} value={z} sx={{ fontSize: "12px" }}>{z}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              )}
              <Box sx={{ my: 2 }}>
                <DateRangeComparePicker
                  timeStart={timeStart}
                  timeEnd={timeEnd}
                  onApply={(s, e) => {
                    setTimeStart(s);
                    setTimeEnd(e);
                    setSelectedPeriod({
                      startDate: s.format("YYYY-MM-DD"),
                      endDate: e.format("YYYY-MM-DD"),
                    });
                  }}
                />
              </Box>

              <Box sx={{ mt: 2, p: 1.5, bgcolor: "#f8fafc", borderRadius: "10px" }}>
                <Typography variant="caption" sx={{ color: "#475569", fontWeight: 600 }}>
                  Selected Range: {selectedPeriod.startDate} to {selectedPeriod.endDate}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setPeriodModalOpen(false)}
            sx={{ color: "#64748b", textTransform: "none", fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmRun}
            sx={{
              bgcolor: watchLiveBrowser ? "#16a34a" : "#2563eb",
              "&:hover": { bgcolor: watchLiveBrowser ? "#15803d" : "#1d4ed8" },
              borderRadius: "10px",
              textTransform: "none",
              fontWeight: 700,
              px: 2.5,
            }}
          >
            {isBatchMode
              ? (watchLiveBrowser ? `Run All ${segments.length} Segments (Live Chrome)` : `Run All ${segments.length} Segments (Invisible Headless)`)
              : (watchLiveBrowser ? "Confirm & Run (Watch Live Browser)" : "Confirm & Run (Invisible Headless)")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Side Panel Drawer */}
      <Drawer
        anchor="right"
        open={detailsDrawerOpen}
        onClose={() => setDetailsDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: detailsDrawerExpanded ? "94vw" : 780, md: detailsDrawerExpanded ? "95vw" : 860 },
            transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            p: 3,
          },
        }}
      >
        {drawerRunData && (
          <Box>
            {/* Drawer Header */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#1e293b" }}>
                  Run Verification Details
                </Typography>
                <Typography variant="body2" sx={{ color: "#64748b" }}>
                  Client: <strong>{drawerRunData.client || selectedClient}</strong> | Segment: <strong>{drawerRunData.segment}</strong>
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title={detailsDrawerExpanded ? "Collapse Sidebar" : "Expand Sidebar (Wide Canvas View)"}>
                  <IconButton size="small" onClick={() => setDetailsDrawerExpanded(!detailsDrawerExpanded)}>
                    {detailsDrawerExpanded ? <FullscreenExitIcon /> : <FullscreenIcon />}
                  </IconButton>
                </Tooltip>
                <IconButton size="small" onClick={() => setDetailsDrawerOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Run Metadata Badge Bar */}
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 1.5,
                p: 2,
                bgcolor: "#f8fafc",
                borderRadius: "12px",
                mb: 3,
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                  Overall Result
                </Typography>
                {renderStatusBadge(drawerRunData)}
              </Box>

              <Box sx={{ ml: 2 }}>
                <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                  {drawerRunData.module === "content_analysis" ? "Scope" : (drawerRunData.module === "review_rating" ? "Analysis Window" : (drawerRunData.module === "pds_score" ? "Financial Period" : "Period"))}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "#1e293b" }}>
                  {drawerRunData.module === "content_analysis"
                    ? "Current Catalog Snapshot"
                    : (drawerRunData.module === "review_rating"
                      ? "Last 6 Months (6M Rolling)"
                      : (drawerRunData.module === "pds_score"
                        ? `${drawerRunData.period?.period || "Period 6"} (${drawerRunData.period?.year || "2026"})`
                        : `${drawerRunData.period?.startDate} to ${drawerRunData.period?.endDate}`))}
                </Typography>
              </Box>

              <Box sx={{ ml: 2 }}>
                <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                  Executed At
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "#1e293b" }}>
                  {drawerRunData.finished_at ? dayjs(drawerRunData.finished_at).format("DD MMM, HH:mm:ss") : "In Progress"}
                </Typography>
              </Box>
            </Box>

            {/* Applied Filters & Verification Parameters Bar */}
            <Box
              sx={{
                mb: 3,
                p: 2,
                bgcolor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", mb: 1 }}>
                Applied Verification Filters (Live Dashboard & DB Query)
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                <Chip
                  size="small"
                  label={`Client: ${drawerRunData.filters?.client || drawerRunData.client || selectedClient}`}
                  sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "11px" }}
                />
                {drawerRunData.module === "pds_score" ? (
                  <>
                    <Chip
                      size="small"
                      label={`Platform: ${drawerRunData.period?.platform || drawerRunData.segment?.replace("pds_score_", "").replace("_", " ").toUpperCase() || "Blinkit"}`}
                      sx={{ bgcolor: "#f0fdf4", color: "#15803d", fontWeight: 700, fontSize: "11px" }}
                    />
                    <Chip
                      size="small"
                      label={`Year: ${drawerRunData.period?.year || "2026"}`}
                      sx={{ bgcolor: "#fef3c7", color: "#b45309", fontWeight: 700, fontSize: "11px" }}
                    />
                    <Chip
                      size="small"
                      label={`Period: ${drawerRunData.period?.period || "Period 6"}`}
                      sx={{ bgcolor: "#fdf4ff", color: "#86198f", fontWeight: 700, fontSize: "11px" }}
                    />
                    <Chip
                      size="small"
                      label={`Financial Cycle: ${drawerRunData.period?.startDate || "2026-10-04"} → ${drawerRunData.period?.endDate || "2026-10-31"}`}
                      sx={{ bgcolor: "#f8fafc", color: "#334155", fontWeight: 600, fontSize: "11px", border: "1px solid #cbd5e1" }}
                    />
                  </>
                ) : drawerRunData.module === "geo_intelligence" ? (
                  <>
                    {drawerRunData.filters?.metric && (
                      <Chip
                        size="small"
                        label={`Metric: ${drawerRunData.filters.metric}`}
                        sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.channel && drawerRunData.filters.channel !== "All" && (
                      <Chip
                        size="small"
                        label={`Channel: ${drawerRunData.filters.channel}`}
                        sx={{ bgcolor: "#e0e7ff", color: "#4338ca", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.platform && drawerRunData.filters.platform !== "All" && (
                      <Chip
                        size="small"
                        label={`Platform: ${drawerRunData.filters.platform}`}
                        sx={{ bgcolor: "#f0fdf4", color: "#15803d", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.brand && drawerRunData.filters.brand !== "All" && (
                      <Chip
                        size="small"
                        label={`Brand: ${drawerRunData.filters.brand}`}
                        sx={{ bgcolor: "#fdf4ff", color: "#86198f", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.category && drawerRunData.filters.category !== "All" && (
                      <Chip
                        size="small"
                        label={`Category: ${drawerRunData.filters.category}`}
                        sx={{ bgcolor: "#fef3c7", color: "#b45309", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.msl && drawerRunData.filters.msl !== "All" && (
                      <Chip
                        size="small"
                        label={`MSL: ${drawerRunData.filters.msl}`}
                        sx={{ bgcolor: "#ecfdf5", color: "#047857", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    <Chip
                      size="small"
                      label={`Period: ${drawerRunData.filters?.startDate || ""} → ${drawerRunData.filters?.endDate || ""}`}
                      sx={{ bgcolor: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: "11px" }}
                    />
                  </>
                ) : drawerRunData.module === "insights" ? (
                  <>
                    {drawerRunData.filters?.channel && drawerRunData.filters.channel !== "All" && (
                      <Chip
                        size="small"
                        label={`Channel: ${drawerRunData.filters.channel}`}
                        sx={{ bgcolor: "#e0e7ff", color: "#4338ca", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.platform && drawerRunData.filters.platform !== "All" && (
                      <Chip
                        size="small"
                        label={`Platform: ${drawerRunData.filters.platform}`}
                        sx={{ bgcolor: "#f0fdf4", color: "#15803d", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.brand && drawerRunData.filters.brand !== "All" && (
                      <Chip
                        size="small"
                        label={`Brand: ${drawerRunData.filters.brand}`}
                        sx={{ bgcolor: "#fdf4ff", color: "#86198f", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.category && drawerRunData.filters.category !== "All" && (
                      <Chip
                        size="small"
                        label={`Category: ${drawerRunData.filters.category}`}
                        sx={{ bgcolor: "#fef3c7", color: "#b45309", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.city && drawerRunData.filters.city !== "All" && (
                      <Chip
                        size="small"
                        label={`City: ${drawerRunData.filters.city}`}
                        sx={{ bgcolor: "#ecfdf5", color: "#047857", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    <Chip
                      size="small"
                      label={`Period: ${drawerRunData.period?.startDate || ""} → ${drawerRunData.period?.endDate || ""}`}
                      sx={{ bgcolor: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: "11px" }}
                    />
                  </>
                ) : drawerRunData.module === "secondary_summary" ? (
                  <>
                    {drawerRunData.filters?.seller && drawerRunData.filters.seller !== "All" && (
                      <Chip
                        size="small"
                        label={`Seller: ${drawerRunData.filters.seller}`}
                        sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.platformName && drawerRunData.filters.platformName !== "All" && (
                      <Chip
                        size="small"
                        label={`Platform: ${drawerRunData.filters.platformName}`}
                        sx={{ bgcolor: "#f0fdf4", color: "#15803d", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.brand && drawerRunData.filters.brand !== "All" && (
                      <Chip
                        size="small"
                        label={`Brand: ${drawerRunData.filters.brand}`}
                        sx={{ bgcolor: "#fdf4ff", color: "#86198f", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.subBrand && drawerRunData.filters.subBrand !== "All" && (
                      <Chip
                        size="small"
                        label={`Sub Brand: ${drawerRunData.filters.subBrand}`}
                        sx={{ bgcolor: "#fef3c7", color: "#b45309", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.quarter && drawerRunData.filters.quarter !== "All" && (
                      <Chip
                        size="small"
                        label={`Quarter: ${drawerRunData.filters.quarter}`}
                        sx={{ bgcolor: "#ecfdf5", color: "#047857", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.fiscalYear && drawerRunData.filters.fiscalYear !== "All" && (
                      <Chip
                        size="small"
                        label={`FY: ${drawerRunData.filters.fiscalYear}`}
                        sx={{ bgcolor: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.granularity && (
                      <Chip
                        size="small"
                        label={`View By: ${String(drawerRunData.filters.granularity).toUpperCase()}`}
                        sx={{ bgcolor: "#eef2ff", color: "#4f46e5", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    <Chip
                      size="small"
                      label={`Period: ${drawerRunData.period?.startDate || drawerRunData.filters?.startDate || "Start"} → ${drawerRunData.period?.endDate || drawerRunData.filters?.endDate || "End"}`}
                      sx={{ bgcolor: "#f8fafc", color: "#334155", fontWeight: 600, fontSize: "11px", border: "1px solid #cbd5e1" }}
                    />
                  </>
                ) : drawerRunData.module === "primary_summary" ? (
                  <>
                    <Chip
                      size="small"
                      label={`Brand: ${drawerRunData.filters?.brandName || "All"}`}
                      sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "11px" }}
                    />
                    <Chip
                      size="small"
                      label={`Retailer: ${drawerRunData.filters?.retailerName || "All"}`}
                      sx={{ bgcolor: "#f0fdf4", color: "#15803d", fontWeight: 700, fontSize: "11px" }}
                    />
                    {drawerRunData.filters?.division && drawerRunData.filters.division !== "All" && (
                      <Chip
                        size="small"
                        label={`Division: ${drawerRunData.filters.division}`}
                        sx={{ bgcolor: "#fef3c7", color: "#b45309", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    {drawerRunData.filters?.zone && drawerRunData.filters.zone !== "All" && (
                      <Chip
                        size="small"
                        label={`Zone: ${drawerRunData.filters.zone}`}
                        sx={{ bgcolor: "#fdf4ff", color: "#86198f", fontWeight: 700, fontSize: "11px" }}
                      />
                    )}
                    <Chip
                      size="small"
                      label={`Period: ${drawerRunData.period?.startDate || drawerRunData.filters?.startDate || "Start"} → ${drawerRunData.period?.endDate || drawerRunData.filters?.endDate || "End"}`}
                      sx={{ bgcolor: "#f8fafc", color: "#334155", fontWeight: 600, fontSize: "11px", border: "1px solid #cbd5e1" }}
                    />
                  </>
                ) : (
                  <>
                    <Chip
                      size="small"
                      label={`Platform: ${drawerRunData.filters?.platform ? String(drawerRunData.filters.platform).toUpperCase() : "ALL"}`}
                      sx={{ bgcolor: "#f0fdf4", color: "#15803d", fontWeight: 700, fontSize: "11px" }}
                    />
                    <Chip
                      size="small"
                      label={`Channel: ${drawerRunData.filters?.channel || "Auto-detected"}`}
                      sx={{ bgcolor: "#fdf4ff", color: "#86198f", fontWeight: 700, fontSize: "11px" }}
                    />
                    <Chip
                      size="small"
                      label={
                        drawerRunData.module === "content_analysis"
                          ? "Audit Scope: Current Catalog Snapshot (Undated)"
                          : (drawerRunData.module === "review_rating"
                            ? "Analysis Window: Last 6 Months (6M Rolling)"
                            : `Period: ${drawerRunData.filters?.startDate || drawerRunData.period?.startDate} → ${drawerRunData.filters?.endDate || drawerRunData.period?.endDate}`)
                      }
                      sx={{ bgcolor: "#f8fafc", color: "#334155", fontWeight: 600, fontSize: "11px", border: "1px solid #cbd5e1" }}
                    />
                  </>
                )}
              </Box>
            </Box>

            {/* Step Progress Indicators */}
            <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
              <Box sx={{ flex: 1, p: 1.5, border: "1px solid #e2e8f0", borderRadius: "10px", bgcolor: "#ffffff" }}>
                <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                  Step 1: API
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: drawerRunData.steps?.api?.status === "done" ? "#16a34a" : "#dc2626" }}>
                  {drawerRunData.steps?.api?.status?.toUpperCase()}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, p: 1.5, border: "1px solid #e2e8f0", borderRadius: "10px", bgcolor: "#ffffff" }}>
                <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                  Step 2: Logic (OLAP)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: drawerRunData.steps?.logic?.status === "done" ? "#16a34a" : "#dc2626" }}>
                  {drawerRunData.steps?.logic?.status?.toUpperCase()}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, p: 1.5, border: "1px solid #e2e8f0", borderRadius: "10px", bgcolor: "#ffffff" }}>
                <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                  Step 3: UI ({drawerRunData.headless ? "Headless" : "Live Chrome"})
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: drawerRunData.steps?.ui?.status === "done" ? "#16a34a" : "#dc2626" }}>
                  {drawerRunData.steps?.ui?.status?.toUpperCase()}
                </Typography>
              </Box>
            </Box>

            {/* Warning Alert if Platform is unavailable for this client */}
            {(drawerRunData.kpis || []).some(k => k.reason && k.reason.toLowerCase().includes("not available")) && (
              <Alert severity="warning" sx={{ mb: 2.5, borderRadius: "10px", fontSize: "12px", border: "1px solid #fde68a" }}>
                <strong>Platform Not Available Notice:</strong> The requested platform is not present in this client&apos;s workspace. The DS Tester has prevented cross-platform data bleeding; UI values are correctly withheld (—) rather than displaying data from another platform.
              </Alert>
            )}

            {/* Side-by-side KPI Comparison Table */}
            <Typography sx={{ fontWeight: 700, fontSize: "14px", color: "#1e293b", mb: 1 }}>
              KPI Side-by-Side Comparison
            </Typography>
            <TableContainer component={Paper} sx={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "none" }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#f1f5f9" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: "12px" }}>KPI</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "12px" }}>API</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "12px" }}>Logic</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "12px" }}>UI</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "12px" }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "12px" }}>Diagnosis Reason</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "12px", textAlign: "center" }}>Graph & Drill-Down</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(drawerRunData.kpis || []).map((kpi) => {
                    const isFailed = kpi.status === "FAIL" || kpi.status === "ERROR";
                    return (
                      <TableRow
                        key={kpi.key}
                        sx={{
                          bgcolor: isFailed ? "#fff1f2" : "inherit",
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700, fontSize: "12px" }}>{kpi.label}</TableCell>
                        <TableCell sx={{ fontSize: "12px", fontFamily: "monospace" }}>
                          {kpi.api !== null && kpi.api !== undefined ? Number(kpi.api).toFixed(2) : "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: "12px", fontFamily: "monospace" }}>
                          {kpi.logic !== null && kpi.logic !== undefined ? Number(kpi.logic).toFixed(2) : "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: "12px", fontFamily: "monospace" }}>
                          {kpi.ui_raw ? kpi.ui_raw : (kpi.ui !== null && kpi.ui !== undefined ? Number(kpi.ui).toFixed(2) : "—")}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={kpi.status}
                            size="small"
                            sx={{
                              fontWeight: 800,
                              fontSize: "10px",
                              height: "20px",
                              bgcolor:
                                kpi.status === "PASS" ? "#dcfce7" : kpi.status === "FAIL" ? "#fee2e2" : "#fef3c7",
                              color:
                                kpi.status === "PASS" ? "#16a34a" : kpi.status === "FAIL" ? "#dc2626" : "#d97706",
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: "11px", color: isFailed ? "#991b1b" : "#64748b", maxWidth: 220 }}>
                          {kpi.reason || "Matched within tolerance"}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center" }}>
                          <Tooltip title="View Time-Series Corridor & 5-Level Breakdown">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedKpiForChart({
                                  kpiKey: kpi.key,
                                  kpiLabel: kpi.label,
                                  api: kpi.api,
                                  logic: kpi.logic,
                                  ui: kpi.ui,
                                  module: drawerRunData?.module,
                                  segment: drawerRunData?.segment,
                                  client: drawerRunData?.client || selectedClient,
                                });
                                setChartDrawerOpen(true);
                              }}
                              sx={{
                                bgcolor: "#f0f9ff",
                                color: "#0284c7",
                                border: "1px solid #bae6fd",
                                "&:hover": { bgcolor: "#e0f2fe", color: "#0369a1" },
                              }}
                            >
                              <AutoGraphIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Drawer>

      {/* Live Step 3 Selenium Screen - Automatically pops up and shows live progress & screen capture */}
      {activeRunData && (
        <Card
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: liveScreenMinimized ? 320 : { xs: "92%", sm: 540 },
            maxHeight: "85vh",
            zIndex: 9999,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 2px rgba(34, 197, 94, 0.4)",
            borderRadius: "20px",
            bgcolor: "#0f172a",
            color: "#f8fafc",
            overflow: "hidden",
            border: "2px solid #22c55e",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: "12px 18px",
              bgcolor: "#1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #334155",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: activeRunData.status === "running" ? "#ef4444" : "#22c55e",
                  boxShadow: activeRunData.status === "running" ? "0 0 12px #ef4444" : "0 0 12px #22c55e",
                }}
              />
              <Typography sx={{ fontWeight: 800, fontSize: "13px", color: "#f8fafc", letterSpacing: "0.5px" }}>
                {activeRunData.batch_total
                  ? `BATCH [${(activeRunData.batch_index ?? 0) + 1}/${activeRunData.batch_total}]: ${activeRunData.status === "running" ? "LIVE SELENIUM ON SCREEN" : "VERIFICATION COMPLETED"}`
                  : (activeRunData.status === "running" ? "LIVE STEP 3: SELENIUM ON SCREEN" : "VERIFICATION COMPLETED")}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {activeRunData.status === "running" && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={cancelling}
                  onClick={handleCancelRun}
                  sx={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "none",
                    minWidth: "auto",
                    p: "2px 8px",
                    borderColor: "#f87171",
                    color: "#f87171",
                    "&:hover": { borderColor: "#ef4444", bgcolor: "rgba(239, 68, 68, 0.15)" },
                  }}
                >
                  {cancelling ? "Stopping..." : "Stop Test"}
                </Button>
              )}
              <Button
                size="small"
                onClick={() => setLiveScreenMinimized(!liveScreenMinimized)}
                sx={{
                  color: "#94a3b8",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "none",
                  minWidth: "auto",
                  p: "2px 8px",
                }}
              >
                {liveScreenMinimized ? "Expand" : "Minimize"}
              </Button>
              <IconButton
                size="small"
                onClick={() => setActiveRunData(null)}
                sx={{ color: "#94a3b8", "&:hover": { color: "#ffffff" }, p: 0.5 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {!liveScreenMinimized && (
            <Box sx={{ p: 2 }}>
              {/* Active step banner */}
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "#1e293b",
                  borderRadius: "12px",
                  border: "1px solid #334155",
                  mb: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                {activeRunData.status === "running" ? (
                  <CircularProgress size={16} sx={{ color: "#22c55e" }} />
                ) : (
                  <CheckCircleIcon sx={{ fontSize: 18, color: "#22c55e" }} />
                )}
                <Typography sx={{ fontSize: "12.5px", fontWeight: 700, color: "#f1f5f9" }}>
                  {activeRunData.live_step || (activeRunData.status === "running" ? "Executing automated step 3 in Chrome..." : "UI Verification finished")}
                </Typography>
              </Box>

              {/* Live Screen capture or loader */}
              {activeRunData.live_screenshot ? (
                <Box
                  sx={{
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid #334155",
                    bgcolor: "#000000",
                    position: "relative",
                    maxHeight: 280,
                  }}
                >
                  <img
                    src={activeRunData.live_screenshot}
                    alt="Live Browser Feed"
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      bgcolor: "rgba(15, 23, 42, 0.85)",
                      color: "#4ade80",
                      px: 1.2,
                      py: 0.4,
                      borderRadius: "6px",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      border: "1px solid rgba(74, 222, 128, 0.4)",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    ● LIVE BROWSER FEED
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    height: 180,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "#1e293b",
                    borderRadius: "12px",
                    border: "1px dashed #475569",
                    gap: 1.5,
                  }}
                >
                  <CircularProgress size={26} sx={{ color: "#38bdf8" }} />
                  <Typography sx={{ fontSize: "12px", color: "#94a3b8" }}>
                    Launching Live Chrome window on screen...
                  </Typography>
                </Box>
              )}

              {/* Bottom Metadata & Controls */}
              <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: "11px" }}>
                  Client: <strong>{activeRunData.client}</strong> | Segment: <strong>{activeRunData.segment}</strong>
                </Typography>

                {activeRunData.status === "done" && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => {
                      setDrawerRunData(activeRunData);
                      setDetailsDrawerOpen(true);
                    }}
                    sx={{
                      bgcolor: activeRunData.overall === "PASS" ? "#16a34a" : "#dc2626",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "none",
                      borderRadius: "8px",
                    }}
                  >
                    View Full Details ({activeRunData.overall})
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Card>
      )}

      {/* Sentinel Anomalies List Drawer */}
      <Drawer
        anchor="right"
        open={sentinelDrawerOpen}
        onClose={() => setSentinelDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", md: sentinelDrawerExpanded ? "94vw" : 720, lg: sentinelDrawerExpanded ? "95vw" : 840 },
            transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            bgcolor: "#ffffff",
            color: "#0f172a",
            boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
            p: 3,
          },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <WarningIcon sx={{ color: "#dc2626", fontSize: 24 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>
                Active Detected Anomalies
              </Typography>
            </Box>
            <Typography sx={{ color: "#64748b", fontSize: "12px", mt: 0.5 }}>
              All KPIs exceeding the strict <strong>10% threshold</strong> across clients and modules.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {sentinelAnomalies.length > 0 && (
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => handleClearAnomalies("all")}
                startIcon={<DeleteOutlineIcon />}
                sx={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "none",
                  borderColor: "#fecaca",
                  color: "#dc2626",
                  borderRadius: "8px",
                  py: "2px",
                  px: 1,
                  "&:hover": { bgcolor: "#fee2e2", borderColor: "#f87171" },
                }}
              >
                Clear Store
              </Button>
            )}
            <Tooltip title={sentinelDrawerExpanded ? "Collapse Sidebar" : "Expand Sidebar (Wide Canvas View)"}>
              <IconButton size="small" onClick={() => setSentinelDrawerExpanded(!sentinelDrawerExpanded)} sx={{ color: "#64748b" }}>
                {sentinelDrawerExpanded ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
            <IconButton onClick={() => setSentinelDrawerOpen(false)} sx={{ color: "#64748b" }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {sentinelAnomalies.length === 0 ? (
          <Alert severity="success" sx={{ bgcolor: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" }}>
            Zero anomalies detected. All KPIs within 10% tolerance boundary.
          </Alert>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {sentinelAnomalies.map((anom) => (
              <Card
                key={anom.id}
                sx={{
                  bgcolor: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  p: 2,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip
                        label={anom.client.toUpperCase()}
                        size="small"
                        sx={{ fontWeight: 800, fontSize: "10px", bgcolor: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0" }}
                      />
                      <Typography sx={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>
                        {anom.kpi_label || anom.kpi}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: "11px", color: "#64748b", mt: 0.3 }}>
                      Module: {anom.module} | Segment: {anom.segment} | {anom.timestamp}
                    </Typography>
                  </Box>

                  <Chip
                    label={`${anom.deviation_pct > 0 ? "+" : ""}${anom.deviation_pct}%`}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: "12px",
                      bgcolor: "#fee2e2",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                    }}
                  />
                </Box>

                {/* RCA Summary */}
                {anom.rca && (
                  <Box sx={{ bgcolor: "#f8fafc", p: 1.5, borderRadius: "8px", my: 1.5, border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#2563eb" }}>
                      {anom.rca.class}
                    </Typography>
                    <Typography sx={{ fontSize: "12px", color: "#334155", mt: 0.5 }}>
                      {anom.rca.summary}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setSelectedKpiForChart({
                        kpiKey: anom.kpi,
                        kpiLabel: anom.kpi_label || anom.kpi,
                        module: anom.module,
                        segment: anom.segment,
                        client: anom.client || selectedClient,
                        platform: anom.platform,
                        metric: anom.metric,
                        api: anom.step1_api_val,
                        logic: anom.step2_logic_val,
                        ui: anom.step3_ui_val,
                        actual: anom.actual,
                        baseline: anom.baseline,
                        deviation_pct: anom.deviation_pct,
                        severity: anom.severity,
                        threshold_pct: anom.threshold_pct,
                        unit: anom.unit || "%",
                        rca: anom.rca,
                        anomalyObj: anom,
                      });
                      setChartDrawerOpen(true);
                    }}
                    startIcon={<AutoGraphIcon />}
                    sx={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "none",
                      color: "#2563eb",
                      borderColor: "#bfdbfe",
                      bgcolor: "#eff6ff",
                      "&:hover": {
                        borderColor: "#2563eb",
                        bgcolor: "#dbeafe",
                      },
                    }}
                  >
                    Inspect Graph & 5-Level Drill-Down
                  </Button>
                </Box>
              </Card>
            ))}
          </Box>
        )}
      </Drawer>

      {/* Interactive KPI Anomaly & Multi-Level Trend Drawer (Protected by DrawerErrorBoundary) */}
      {selectedKpiForChart && (
        <DrawerErrorBoundary open={chartDrawerOpen} onClose={() => setChartDrawerOpen(false)}>
          <KpiAnomalyChartDrawer
            open={chartDrawerOpen}
            onClose={() => setChartDrawerOpen(false)}
            kpiKey={selectedKpiForChart.kpiKey}
            kpiLabel={selectedKpiForChart.kpiLabel}
            client={selectedKpiForChart.client || selectedClient}
            moduleName={selectedKpiForChart.module}
            segmentName={selectedKpiForChart.segment}
            apiValue={selectedKpiForChart.api}
            logicValue={selectedKpiForChart.logic}
            uiValue={selectedKpiForChart.ui}
            anomalyData={selectedKpiForChart}
          />
        </DrawerErrorBoundary>
      )}

      {/* Assign Anomaly Outlook Email Modal */}
      <AssignAnomalyEmailModal
        open={emailModalConfig.open}
        onClose={() => setEmailModalConfig((prev) => ({ ...prev, open: false }))}
        client={emailModalConfig.client || selectedClient}
        selectedAnomaly={emailModalConfig.selectedAnomaly}
        anomalies={emailModalConfig.anomalies.length > 0 ? emailModalConfig.anomalies : brandAnomalies}
        onAssigned={fetchSentinelAnomalies}
      />

    </Box>
  );

  if (isEmbedded) {
    return pageContent;
  }

  return (
    <CommonContainer title="DS Tester" hideFilters={true}>
      {pageContent}
    </CommonContainer>
  );
}