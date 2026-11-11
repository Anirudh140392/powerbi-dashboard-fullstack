import React, { useState, useEffect, useRef, useContext } from "react";
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
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
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
} from "@mui/icons-material";
import dayjs from "dayjs";
import axios from "axios";

import CommonContainer from "@/components/CommonLayout/CommonContainer";
import DateRangeComparePicker from "@/components/CommonLayout/DateRangeComparePicker";
import { FilterContext } from "@/utils/FilterContext";

// DS Tester API endpoints (proxied through /ds-tester in Vite to FastAPI)
const DS_TESTER_API = "/ds-tester";

export default function DsTesterPage({ isEmbedded = false }) {
  const filterContext = useContext(FilterContext);
  const defaultEnd = filterContext?.timeEnd ? dayjs(filterContext.timeEnd) : dayjs();
  const defaultStart = filterContext?.timeStart ? dayjs(filterContext.timeStart) : defaultEnd.subtract(14, "day");

  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("boat");
  const [watchLiveBrowser, setWatchLiveBrowser] = useState(true); // User toggle: true = visible Chrome window, false = headless background
  const [runsMap, setRunsMap] = useState({}); // key: `${module}:${segment}:${client}` -> run result object
  const [activeRunId, setActiveRunId] = useState(null);
  const [activeRunData, setActiveRunData] = useState(null);
  const [liveScreenMinimized, setLiveScreenMinimized] = useState(false);
  const [busyMessage, setBusyMessage] = useState(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchQueue, setBatchQueue] = useState([]);

  // Time Period Popup State - dynamically synced with active dashboard FilterContext
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [targetSegment, setTargetSegment] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState({
    startDate: defaultStart.format("YYYY-MM-DD"),
    endDate: defaultEnd.format("YYYY-MM-DD"),
  });
  const [timeStart, setTimeStart] = useState(defaultStart);
  const [timeEnd, setTimeEnd] = useState(defaultEnd);

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
      }
    } catch (err) {
      console.error("[DsTester] Failed to load clients:", err);
    }
  };

  const fetchModules = async (clientOverride) => {
    try {
      const c = clientOverride || selectedClient || "boat";
      const res = await axios.get(`${DS_TESTER_API}/modules?client=${c}`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setModules(res.data);
        const validIds = res.data.map((m) => m.id);
        if (!selectedModule || !validIds.includes(selectedModule)) {
          setSelectedModule(res.data[0].id);
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
        res.data.forEach((r) => {
          const c = r.client || "boat";
          const key = `${r.module.toLowerCase()}:${r.segment.toLowerCase()}:${c.toLowerCase()}`;
          map[key] = r;
        });
        setRunsMap(map);
      }
    } catch (err) {
      console.error("[DsTester] Failed to restore session runs:", err);
    }
  };

  // 2. Poll for active run status
  useEffect(() => {
    if (!activeRunId) return;

    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${DS_TESTER_API}/runs/${activeRunId}`);
        const runData = res.data;
        const c = runData.client || selectedClient || "boat";
        const key = `${runData.module.toLowerCase()}:${runData.segment.toLowerCase()}:${c.toLowerCase()}`;
        setRunsMap((prev) => ({ ...prev, [key]: runData }));
        setActiveRunData(runData);

        // If open in drawer, update real-time
        if (drawerRunData && drawerRunData.run_id === activeRunId) {
          setDrawerRunData(runData);
        }

        if (runData.status === "done" || runData.status === "error") {
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
  }, [activeRunId, drawerRunData, selectedClient, batchQueue]);

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

    const payload = {
      module: selectedModule,
      segment: target.id,
      period: periodObj,
      client: selectedClient,
      headless: !watchLiveBrowser,
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

    const payload = {
      module: selectedModule,
      segment: segId,
      period: periodPayload,
      client: selectedClient,
      headless: !watchLiveBrowser,
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

    let periodPayload = overridePeriod || selectedPeriod;
    if (selectedModule === "review_rating") {
      periodPayload = { startDate: "Last 6 Months", endDate: "Last 6 Months", preset: "6M" };
    } else if (selectedModule === "content_analysis") {
      periodPayload = { startDate: "Snapshot", endDate: "Snapshot" };
    } else if (selectedModule === "pds_score") {
      const dates = PDS_PERIOD_DATES[pdsPeriod] || { startDate: "2026-10-04", endDate: "2026-10-31" };
      periodPayload = {
        platform: pdsPlatform,
        year: pdsYear,
        period: pdsPeriod,
        startDate: dates.startDate,
        endDate: dates.endDate,
      };
    }

    const payload = {
      module: selectedModule,
      period: periodPayload,
      client: selectedClient,
      headless: !watchLiveBrowser,
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

  const currentModuleObj = modules.find((m) => m.id === selectedModule) || modules[0];
  const segments = currentModuleObj?.segments || [];
  const currentClientObj = clients.find((c) => c.id === selectedClient) || { id: "boat", label: "boAt" };

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
          <Alert severity="warning" sx={{ mb: 3, borderRadius: "12px" }} onClose={() => setBusyMessage(null)}>
            {busyMessage}
          </Alert>
        )}

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
                  onChange={(e) => setSelectedClient(e.target.value)}
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
                </Select>
              </FormControl>
            </Box>

            {/* Target Database Badge */}
            <Box sx={{ ml: "auto" }}>
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

        {/* Segments Table */}
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
          PaperProps={{ sx: { width: { xs: "100%", sm: 700 }, p: 3 } }}
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
                <IconButton size="small" onClick={() => setDetailsDrawerOpen(false)}>
                  <CloseIcon />
                </IconButton>
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
                        label={`Platform: ${drawerRunData.period?.platform || "Blinkit"}`}
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
