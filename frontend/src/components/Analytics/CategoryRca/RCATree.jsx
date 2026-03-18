import React, { useState, useCallback, useMemo, useEffect } from "react";
import ReactFlow, {
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ConnectionLineType,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion, useSpring, useMotionValue, AnimatePresence } from "framer-motion";
import { Plus, Minus, Activity, Zap, LineChart, Download } from "lucide-react";
import axiosInstance from "../../../api/axiosInstance";
import ErrorRetryOverlay from "../../CommonLayout/ErrorRetryOverlay";
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Paper,
  Divider,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TablePagination,
  Tooltip,
} from "@mui/material";

// --- Layout & Typography Tokens ---
const CARD_WIDTH = 380;
const CARD_HEIGHT = 280; // Estimated height for vertical centering
const VERTICAL_GAP = 180;
const HORIZONTAL_STEP = 580;

const TYPO = {
  primary: "#0f172a",
  secondary: "#475569",
  border: "#e2e8f0",
  labelSize: "20px",
  valueSize: "34px",
  metaSize: "18px",
  minSize: "12px",
  footerSize: "20px",
  weightHeavy: 800,
  weightBold: 700,
  weightSemibold: 600,
};

const COLORS = {
  offtake: "#000000",
  price: "#5E23BB", // Zepto Purple
  impressions: "#FFD54F", // Blinkit Yellow
  availability: "#0C831F", // Blinkit Green
  organic: "#9C27B0", // Premium Purple
  ad: "#2563EB", // Modern Blue
  discounting: "#F59E0B", // Orange
  segment: "#64748B",
  rating: "#E91E63", // Pink
  conversion: "#0C831F",
};

// --- Custom Cursor / Mouse Follower ---
const MagicCursor = () => {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const springConfig = { damping: 25, stiffness: 150 };
  const trailX = useSpring(cursorX, springConfig);
  const trailY = useSpring(cursorY, springConfig);

  useEffect(() => {
    const moveCursor = (e) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };
    window.addEventListener("mousemove", moveCursor);
    return () => window.removeEventListener("mousemove", moveCursor);
  }, []);

  return (
    <Box sx={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 9999 }}>
      <motion.div
        style={{
          position: "absolute",
          top: -60,
          left: -60,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(15, 23, 42, 0.08) 0%, rgba(15, 23, 42, 0) 70%)",
          x: trailX,
          y: trailY,
        }}
      />
      <motion.div
        style={{
          position: "absolute",
          top: -12,
          left: -12,
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "2.5px solid rgba(79, 70, 229, 0.8)",
          boxShadow: "0 0 10px rgba(79, 70, 229, 0.2)",
          x: cursorX,
          y: cursorY,
        }}
      />
    </Box>
  );
};

const CoolGreyBackground = () => (
  <Box sx={{ position: "absolute", inset: 0, zIndex: 0, background: "#ffffff" }} />
);

// --- AI Insight Badge ---
const AiInsightBadge = ({ text }) => (
  <motion.div
    animate={{
      boxShadow: [
        "0 0 0px rgba(139, 92, 246, 0)",
        "0 0 15px rgba(139, 92, 246, 0.6)",
        "0 0 0px rgba(139, 92, 246, 0)",
      ],
      scale: [1, 1.05, 1],
    }}
    transition={{ duration: 2, repeat: Infinity }}
    style={{
      position: "absolute",
      top: -24,
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "#FFD54F", // Blinkit Yellow
      color: "black",
      padding: "10px 22px",
      borderRadius: "18px",
      fontSize: "13px",
      fontWeight: 900,
      whiteSpace: "nowrap",
      textTransform: "uppercase",
      letterSpacing: "1.2px",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      zIndex: 50,
      boxShadow: "0 12px 24px rgba(139, 92, 246, 0.5)",
      border: "1.5px solid rgba(255, 255, 255, 0.45)",
    }}
  >
    <Zap size={11} fill="white" strokeWidth={3} />
    {text}
  </motion.div>
);
// --- Trend Button (Purple Flickering) ---
const TrendButton = ({ onClick }) => (
  <motion.div
    animate={{
      boxShadow: [
        "0 0 0px rgba(124, 58, 237, 0)",
        "0 0 15px rgba(124, 58, 237, 0.6)",
        "0 0 0px rgba(124, 58, 237, 0)",
      ],
      scale: [1, 1.05, 1],
    }}
    transition={{ duration: 2, repeat: Infinity }}
    style={{
      position: "absolute",
      top: 10,
      right: 15,
      zIndex: 15,
    }}
  >
    <IconButton
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      sx={{
        bgcolor: "#7c3aed",
        color: "white",
        width: 34,
        height: 34,
        borderRadius: "12.5px",
        "&:hover": { bgcolor: "#6d28d9", transform: "scale(1.1)" },
        boxShadow: "0 8px 16px rgba(124, 58, 237, 0.3)",
        border: "1.5px solid rgba(255, 255, 255, 0.4)",
        transition: "all 0.2s ease"
      }}
    >
      <LineChart size={18} strokeWidth={3.5} />
    </IconButton>
  </motion.div>
);

const HoverMetricsPopup = ({ metrics, position = "top", isOrganic = false, kpiLabel = "KPI", category = "", platform = "" }) => {
  const brands = ["Snickers", "Galaxy", "Twix", "Orbit", "Bounty", "Boomer"];
  const isBottom = position === "bottom";
  const popupRef = React.useRef(null);
  const [hOffset, setHOffset] = useState(0);

  useEffect(() => {
    if (popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      const padding = 20; // safe margin
      let offset = 0;

      if (rect.left < padding) {
        offset = padding - rect.left;
      } else if (rect.right > window.innerWidth - padding) {
        offset = window.innerWidth - padding - rect.right;
      }

      if (offset !== 0) {
        setHOffset(offset);
      }
    }
  }, []);

  if (isOrganic) {
    // This is now handled by the generalized dynamic tooltip
  }

  const getMetricKey = (label, cat) => {
    const l = label.toLowerCase();
    const c = cat ? cat.toLowerCase() : "";

    // Keyword specific mappings
    if (l.includes("branded")) {
      return c === "ad" ? "adBranded" : "orgBranded";
    }
    if (l.includes("generic")) {
      return "orgGeneric";
    }
    if (l.includes("comp")) {
      return "adComp";
    }
    if (l.includes("organic impressions")) return "organic";
    if (l.includes("ad impressions")) return "ad";

    // Standard mappings
    if (l.includes("offtake")) return "offtake";
    if (l.includes("price")) return "price";
    if (l.includes("impressions")) return "impressions";
    if (l.includes("conversion")) return "conversion";
    if (l.includes("disc")) return "discount";
    if (l.includes("osa")) return "osa";
    if (l.includes("ppu")) return "ppu";
    if (l.includes("rating")) return "rating";
    if (l.includes("listing")) return "listing";
    return "offtake";
  };

  const parseVal = (str) => {
    if (!str) return 0;
    let s = String(str).replace(/[₹,% ]/g, "").toLowerCase();
    let multiplier = 1;
    if (s.endsWith('lac')) { multiplier = 100000; s = s.replace('lac', ''); }
    else if (s.endsWith('k')) { multiplier = 1000; s = s.replace('k', ''); }
    else if (s.endsWith('cr')) { multiplier = 10000000; s = s.replace('cr', ''); }
    return (parseFloat(s) || 0) * multiplier;
  };

  const formatVal = (val) => {
    const absVal = Math.abs(val);
    if (kpiLabel.toLowerCase().includes("offtake")) {
      if (absVal >= 10000000) return `₹ ${(val / 10000000).toFixed(2)} Cr`;
      if (absVal >= 100000) return `₹ ${(val / 100000).toFixed(2)} lac`;
      return `₹ ${val.toLocaleString()}`;
    }
    if (kpiLabel.toLowerCase().includes("impressions")) {
      if (absVal >= 100000) return `${(val / 100000).toFixed(1)} lac`;
      if (absVal >= 1000) return `${(val / 1000).toFixed(1)} K`;
      return val.toLocaleString();
    }
    if (kpiLabel.toLowerCase().includes("price") || kpiLabel.toLowerCase().includes("ppu")) return `₹${val.toFixed(1)}`;
    if (kpiLabel.includes("%") || kpiLabel.toLowerCase().includes("conv")) return `${val.toFixed(1)}%`;
    return val.toFixed(1);
  };

  const displayMetrics = (metrics && metrics.length > 0) ? metrics : brands.map((brand, idx) => {
    // Generate varied numbers based on brand, kpi and platform
    const brandSeed = brand.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const kpiSeed = kpiLabel.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const platformSeed = (platform || "base").split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seed = (brandSeed + kpiSeed + platformSeed + idx) % 20;

    const isPercent = kpiLabel.toLowerCase().includes("%") || kpiLabel.toLowerCase().includes("conv") || kpiLabel.toLowerCase().includes("osa") || kpiLabel.toLowerCase().includes("listing");
    const isCurrency = kpiLabel.toLowerCase().includes("offtake") || kpiLabel.toLowerCase().includes("price") || kpiLabel.toLowerCase().includes("ppu");
    const isImpressions = kpiLabel.toLowerCase().includes("impression");

    let currentVal, deltaVal;

    if (isPercent) {
      currentVal = 65 + (seed * 1.5);
      deltaVal = (seed - 10) * 0.8;
    } else if (isImpressions) {
      currentVal = (8 + seed * 6) * 100000;
      deltaVal = (seed - 12) * 20000;
    } else if (isCurrency) {
      currentVal = (40 + seed * 15) * 100000;
      deltaVal = (seed - 8) * 60000;
    } else {
      currentVal = 100 + seed * 20;
      deltaVal = (seed - 10) * 15;
    }

    const mKey = getMetricKey(kpiLabel, category);
    const dKey = `delta${mKey.charAt(0).toUpperCase() + mKey.slice(1)}`;
    const sign = deltaVal >= 0 ? "+" : "";

    return {
      brand,
      [mKey]: formatVal(currentVal),
      [dKey]: isPercent ? `${sign}${(deltaVal).toFixed(1)}%` : `${sign}${formatVal(deltaVal)}`
    };
  });

  const metricKey = getMetricKey(kpiLabel, category);
  const deltaKey = `delta${metricKey.charAt(0).toUpperCase() + metricKey.slice(1)}`;

  return (
    <motion.div
      ref={popupRef}
      initial={{ opacity: 0, scale: 0.9, y: isBottom ? -25 : 25 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: isBottom ? -25 : 25 }}
      style={{
        position: "absolute",
        ...(isBottom ? { top: "calc(100% + 40px)" } : { bottom: "calc(100% + 40px)" }),
        left: "50%",
        transform: `translateX(calc(-50% + ${hOffset}px))`,
        width: "max(600px, min(1400px, 95vw))", // Responsive width with constraints
        backgroundColor: "rgba(10, 15, 28, 0.98)",
        backdropFilter: "blur(40px) saturate(200%)",
        borderRadius: "44px",
        padding: "0",
        zIndex: 100000,
        boxShadow: "0 100px 200px -40px rgba(0, 0, 0, 0.95), 0 0 120px rgba(79, 70, 229, 0.2)",
        border: "2px solid rgba(255, 255, 255, 0.18)",
        pointerEvents: "auto",
        overflow: "hidden",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <Box sx={{ px: { xs: 3, md: 6 }, py: { xs: 3, md: 4 }, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "rgba(255,255,255,0.01)" }}>
        <Box>
          <Typography sx={{ color: "rgba(255,255,255,0.8)", fontSize: "clamp(18px, 2vw, 28px)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "5px", mb: 0.5 }}>
            Market Intelligence Trace
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.3)", fontSize: "clamp(10px, 1vw, 14px)", fontWeight: 700, letterSpacing: "1px" }}>
            PRO INTELLIGENCE PIPELINE V2.0 • REAL-TIME DATA STREAM
          </Typography>
        </Box>
      </Box>

      <TableContainer sx={{
        overflowY: "auto",
        flex: 1,
        "&::-webkit-scrollbar": { width: "10px" },
        "&::-webkit-scrollbar-track": { background: "rgba(255,255,255,0.02)" },
        "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "10px", border: "2px solid rgba(10,15,28,0.1)" },
        "&::-webkit-scrollbar-thumb:hover": { backgroundColor: "rgba(255,255,255,0.3)" }
      }}>
        <Table size="small" sx={{ "& td, & th": { border: "none", py: { xs: 2, md: 2.5 }, px: { xs: 3, md: 6 } } }}>
          <TableHead>
            <TableRow sx={{ borderBottom: "1px solid rgba(255,255,255,0.1)", position: "sticky", top: 0, bgcolor: "rgba(10, 15, 28, 1)", zIndex: 10 }}>
              <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: "clamp(14px, 1.5vw, 20px)", fontWeight: 800 }}>Brand Identity</TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: "clamp(14px, 1.5vw, 20px)", fontWeight: 800 }}>Current Month {kpiLabel}</TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: "clamp(14px, 1.5vw, 20px)", fontWeight: 800 }}>Previous Month {kpiLabel}</TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: "clamp(14px, 1.5vw, 20px)", fontWeight: 800 }}>Change</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayMetrics.map((row, idx) => {
              const currStr = row[metricKey];
              const deltaStr = row[deltaKey];
              const currVal = parseVal(currStr);
              const deltaVal = parseVal(deltaStr);
              const prevVal = currVal - deltaVal;

              return (
                <TableRow key={idx} sx={{ "&:hover": { bgcolor: "rgba(255,255,255,0.04)" }, transition: "background 0.3s" }}>
                  <TableCell sx={{ color: "#fff", fontSize: "clamp(16px, 1.8vw, 24px)", fontWeight: 900, letterSpacing: "-0.5px" }}>{row.brand}</TableCell>
                  <TableCell sx={{ color: "#fff", fontSize: "clamp(16px, 1.8vw, 24px)", fontWeight: 900 }}>{currStr}</TableCell>
                  <TableCell sx={{ color: "rgba(255,255,255,0.7)", fontSize: "clamp(16px, 1.8vw, 24px)", fontWeight: 900 }}>{formatVal(prevVal)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Typography sx={{ color: String(deltaStr).startsWith("-") ? "#ff4d4d" : "#00ff99", fontSize: "clamp(12px, 1.2vw, 18px)", fontWeight: 900, bgcolor: "rgba(255,255,255,0.05)", px: 1.5, py: 0.5, borderRadius: "8px" }}>
                        {deltaStr}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </motion.div>
  );
};

const StatusDot = ({ status = "healthy" }) => {
  const color = status === "healthy" ? "#10b981" : status === "warning" ? "#f59e0b" : "#f43f5e";
  return (
    <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div
        animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2.5, repeat: Infinity }}
        style={{
          position: "absolute",
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: color,
          zIndex: 1,
          border: "2px solid rgba(255,255,255,0.9)",
        }}
      />
    </Box>
  );
};

const DeltaBadge = ({ change, isPositive }) => (
  <Box
    sx={{
      display: "inline-flex",
      alignItems: "center",
      gap: 0.5,
      bgcolor: isPositive ? "rgba(16, 185, 129, 0.18)" : "rgba(239, 68, 68, 0.18)",
      color: isPositive ? "#0f766e" : "#e11d48",
      px: 1.3,
      py: 0.55,
      borderRadius: "24px",
      fontSize: TYPO.metaSize,
      fontWeight: TYPO.weightBold,
      border: `1px solid ${isPositive ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)"
        }`,
      fontFamily: "inherit",
      whiteSpace: "nowrap",
    }}
  >
    {isPositive ? "+" : "-"} {change}
  </Box>
);

// --- Custom KPI Node ---
const KpiNode = ({ data }) => {
  const {
    label,
    value,
    change,
    isPositive,
    category,
    hasChildren,
    isCollapsed,
    onToggle,
    meta = [],
    onClickDetail,
    status = "healthy",
    insight = null,
    isSelected = false,
    isDimmed = false,
    importance = "driver", // "outcome" | "primary" | "driver"
    onHover,
    onViewTrends,
    metrics,
    hoveredNodeId, // Single source of truth for global hover
  } = data;

  const [localHover, setLocalHover] = useState(false);

  const accentColor = COLORS[category] || COLORS.impressions;

  const isOutcome = importance === "outcome";
  const isPrimary = importance === "primary";

  const targetScale = isSelected ? 1.08 : localHover && !isDimmed ? 1.03 : 1;
  const targetLift = isSelected ? -5 : 0;

  const baseBorder = isOutcome ? `2.5px solid ${accentColor}` : isPrimary ? "2px solid #cbd5e1" : "2px solid #cbd5e1";
  const baseShadow = isOutcome
    ? "0 18px 44px -10px rgba(15, 23, 42, 0.22)"
    : "0 12px 32px -6px rgba(15, 23, 42, 0.18)";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 18 }}
      animate={{
        opacity: isDimmed ? 0.35 : 1,
        scale: targetScale,
        y: targetLift,
        filter: isDimmed ? "grayscale(0.4) blur(0.2px)" : "none",
        zIndex: localHover && !isDimmed ? 1000 : 1,
      }}
      transition={{
        type: "spring",
        damping: 12,
        stiffness: 70,
        opacity: { duration: 0.2, ease: "easeOut" }
      }}
      whileHover={{
        boxShadow: isDimmed
          ? baseShadow
          : `0 35px 70px -15px rgba(0, 0, 0, 0.18)`,
        border: isDimmed ? baseBorder : `2.5px solid ${accentColor}`,
      }}
      style={{
        width: CARD_WIDTH,
        backgroundColor: "#ffffff",
        borderRadius: "32px",
        border: baseBorder,
        overflow: "visible",
        fontFamily: '"Outfit","Inter",sans-serif',
        cursor: "pointer",
        position: "relative",
        boxShadow: localHover && !isDimmed
          ? `0 40px 80px -15px rgba(0,0,0,0.15), 0 0 20px ${accentColor}20`
          : baseShadow,
        zIndex: localHover && !isDimmed ? 1000 : 1,
        transformOrigin: "center",
      }}
      onMouseEnter={(e) => {
        e.stopPropagation();
        setLocalHover(true);
        // Use a small timeout to prevent rapid state switching (flickering)
        if (window.hoverTimeout) clearTimeout(window.hoverTimeout);
        onHover?.(data.id);
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        setLocalHover(false);
        window.hoverTimeout = setTimeout(() => {
          onHover?.(null);
        }, 100);
      }}
      onClick={(e) => {
        if (e.target.closest(".toggle-btn")) return;
        onClickDetail(data);
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "transparent", border: "none", width: 0, height: 0, left: -8, top: "50%" }} />

      {/* Hover bridge to keep popup open when moving mouse between card and popup */}
      {
        localHover && hoveredNodeId === data.id && !isDimmed && (
          <Box
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              height: "45px", // Slightly more than the 40px gap
              zIndex: 99999,
              background: "transparent",
              ...(data.popupPosition === "bottom"
                ? { top: "100%" }
                : { bottom: "100%" }
              ),
            }}
          />
        )
      }

      <AnimatePresence>
        {localHover && hoveredNodeId === data.id && !isDimmed && (
          <HoverMetricsPopup
            metrics={metrics}
            position={data.popupPosition}
            isOrganic={label === "Organic Impressions" || label === "Organic GVs"}
            kpiLabel={label}
            category={category}
            platform={data.platform || ""}
          />
        )}
      </AnimatePresence>

      {/* Top accent strip */}
      <Box
        sx={{
          position: "absolute",
          top: 10,
          left: 14,
          right: 14,
          height: 6,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}30)`,
          opacity: isOutcome ? 0.9 : 0.55,
        }}
      />

      {insight && <AiInsightBadge text={insight} />}
      <TrendButton onClick={() => onViewTrends(label)} />

      <Box
        sx={{
          p: 2.3,
          pb: 1.8,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          borderBottom: `1px solid ${TYPO.border}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, pt: 0.8 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "4px", bgcolor: accentColor, boxShadow: `0 0 10px ${accentColor}55` }} />
          <Typography sx={{ fontSize: TYPO.labelSize, fontWeight: TYPO.weightBold, color: TYPO.primary, letterSpacing: "-0.2px" }}>
            {label}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <StatusDot status={isPositive ? "healthy" : "warning"} />
          {hasChildren && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              sx={{
                ml: 0.5,
                width: 34,
                height: 34,
                borderRadius: "12px",
                border: `1px solid ${TYPO.border}`,
                color: TYPO.primary,
                backgroundColor: "#f8fafc",
                "&:hover": { backgroundColor: "#eef2ff" },
              }}
            >
              {isCollapsed ? <Plus size={18} /> : <Minus size={18} />}
            </IconButton>
          )}
        </Box>
      </Box>

      <Box sx={{ p: 2.3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.8 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.2, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: TYPO.valueSize, fontWeight: TYPO.weightHeavy, color: TYPO.primary, lineHeight: 1.12, letterSpacing: "-0.8px" }}>
              {value}
            </Typography>
            <DeltaBadge change={change} isPositive={isPositive} />
          </Box>
        </Box>

        {meta?.length > 0 && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.4,
              bgcolor: "rgba(15, 23, 42, 0.04)",
              p: 2.0,
              borderRadius: "18px",
              border: `1px solid ${TYPO.border}`,
            }}
          >
            {meta.map((m, idx) => (
              <Box key={idx} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                <Typography sx={{ fontSize: TYPO.footerSize, fontWeight: TYPO.weightBold, color: TYPO.secondary }}>
                  {m.label}
                </Typography>
                <Typography sx={{ fontSize: TYPO.footerSize, fontWeight: TYPO.weightHeavy, color: TYPO.primary, whiteSpace: "nowrap" }}>
                  {m.value}
                  {m.change && (
                    <span
                      style={{
                        color: m.isPositive ? "#0f766e" : "#e11d48",
                        marginLeft: 10,
                        fontSize: TYPO.metaSize,
                        fontWeight: TYPO.weightBold,
                      }}
                    >
                      {m.isPositive ? "+" : "-"} {m.change}
                    </span>
                  )}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {
        hasChildren && (
          <motion.div
            className="toggle-btn"
            whileHover={{ scale: 1.18, rotate: 90, backgroundColor: "#4f46e5", color: "#fff" }}
            whileTap={{ scale: 0.92 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              position: "absolute",
              right: -28, // Centered on the source handle at right: -8
              top: "50%",
              marginTop: -20,
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "#fff",
              color: "#64748b",
              border: "2px solid rgba(255, 255, 255, 1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 15,
              boxShadow: "0 14px 26px -6px rgba(0, 0, 0, 0.16)",
            }}
          >
            {isCollapsed ? <Plus size={22} strokeWidth={3} /> : <Minus size={22} strokeWidth={3} />}
          </motion.div>
        )
      }

      <Handle type="source" position={Position.Right} style={{ background: "transparent", border: "none", width: 0, height: 0, right: -8 }} />
    </motion.div >
  );
};

// --- Dynamic Data Helpers ---
const getSeedFromStr = (str) => {
  let h = 0xdeadbeef;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
  }
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const getDynamicRcaTreeData = (context) => {
  const { platform, brand, sku, category, month } = context;

  // Seed for overall consistency - now including month
  const seed = getSeedFromStr(`${platform}-${brand}-${sku}-${category || "All"}-${month || "All"}`);

  // Base Multipliers to differentiate entities SIGNIFICANTLY
  const getEntityBase = (name, range = 0.5, offset = 1.0) => {
    const s = getSeedFromStr(name || "All");
    return (offset - range / 2) + (s * range);
  };

  const platformMult = getEntityBase(platform, 1.5);
  const brandMult = getEntityBase(brand, 2.0);
  const catMult = getEntityBase(category, 1.0);

  // Amplify behavior for certain platforms (Amazon should show larger swings)
  const platformAmplify = platform?.toLowerCase() === "amazon" ? 3.0 : 1.0;

  let subsetMultiplier = 1.0;
  if (brand && brand !== "All Brands") {
    const s = getSeedFromStr(brand);
    subsetMultiplier *= (0.15 + (s * 0.35));
  }
  if (sku && sku !== "All SKUs") {
    const s = getSeedFromStr(sku);
    subsetMultiplier *= (0.02 + (s * 0.1));
  }

  // Increase jitter and final volume for platforms that should show larger variation
  const volJitter = (0.6 + (seed * 0.8)) * (0.8 + platformAmplify * 0.6);
  const finalVolume = platformMult * brandMult * catMult * subsetMultiplier * volJitter * platformAmplify;

  const formatLac = (val) => {
    if (val >= 100) return `₹ ${(val / 100).toFixed(1)} Cr`;
    if (val >= 1) return `₹ ${val.toFixed(1)} lac`;
    if (val <= 0.05) return `${(val * 1000).toFixed(0)} units`;
    return `${(val * 100).toFixed(1)} K`;
  };

  const getPercentageValue = (base, seedStr, spread = 20) => {
    const s = getSeedFromStr(seedStr);
    const effectiveSpread = spread * (1 + (platformAmplify - 1) * 0.9);
    const variation = (s * effectiveSpread) - (effectiveSpread / 2);
    const v = Math.max(2, Math.min(99, base + variation));
    return `${v.toFixed(1)}%`;
  };

  const getVal = (base, isPct = false, seedStr = "", spread = 20) => {
    if (isPct) return getPercentageValue(base, seedStr, spread);
    const rawVal = base * finalVolume;
    // Always format numeric magnitudes using `formatLac` so large values
    // are displayed in lac/Cr notation (e.g., `₹ 3.9 Cr`). This ensures
    // Amazon Offtake and other high-magnitude KPIs use consistent units.
    return formatLac(rawVal);
  };

  const getChange = (baseSeed) => {
    const s = getSeedFromStr(seed + baseSeed);
    // scale magnitude of reported change for amplified platforms
    const scale = 1 + (platformAmplify - 1) * 1.5; // e.g. amazon -> larger changes
    const val = (0.1 + (s * 44.9 * scale)).toFixed(1);
    return { val: `${val}%`, isPos: s > 0.4 };
  };

  const brandId = brand || "base";
  const skuId = sku || "base";

  // --- FLIPKART & AMAZON SPECIFIC TREE (HARDCODED AS REQUESTED) ---
  if (platform?.toLowerCase() === "amazon" || platform?.toLowerCase() === "flipkart") {
    const isFlipkart = platform?.toLowerCase() === "flipkart";
    const gvLabel = isFlipkart ? "Impression" : "GV";
    const pluralGvLabel = isFlipkart ? "Impressions" : "GVs";

    return {
      id: "root",
      label: "Offtake",
      value: "₹ 2.95 Cr",
      change: "53.73%",
      isPositive: false,
      category: "offtake",
      importance: "outcome",
      insight: "Critical Decline",
      meta: [{ label: "Est. Category share", value: "0.00%", change: "2.40%", isPositive: false }],
      children: [
        {
          id: isFlipkart ? "impressions" : "gvs",
          label: isFlipkart ? "Impressions" : "GVs",
          value: "115.65K",
          change: "46.97%",
          isPositive: false,
          category: "impressions",
          importance: "primary",
          meta: [
            { label: "Share of Search", value: "45.80%", change: "7.63%", isPositive: false },
            { label: `${gvLabel} Share`, value: "100.00%", change: "0.00", isPositive: true }
          ],
          children: [
            {
              id: isFlipkart ? "organic-impressions" : "organic-gvs",
              label: isFlipkart ? "Organic " + pluralGvLabel : "Organic GVs",
              value: "80.10K",
              change: "37.63%",
              isPositive: false,
              category: "organic",
              meta: [
                { label: `Organic Share of Search`, value: "45.03%", change: "0.01%", isPositive: true },
                { label: `Organic ${gvLabel}%`, value: "69.26%", change: "10.38%", isPositive: true }
              ]
            },
            {
              id: isFlipkart ? "ad-impressions" : "ad-gvs",
              label: isFlipkart ? "Ad " + pluralGvLabel : "Ad GVs",
              value: "35.55K",
              change: "60.35%",
              isPositive: false,
              category: "ad",
              meta: [
                { label: "Sp. Share of Search", value: "47.60%", change: "29.79%", isPositive: false },
                { label: `AD Driven ${gvLabel}%`, value: "30.74%", change: "10.38%", isPositive: false },
                { label: "AD Spend", value: "3.33M", change: "50.58%", isPositive: false },
                { label: "Total ROAS", value: "2.77", change: "15.70%", isPositive: false }
              ],
              children: isFlipkart ? [
                {
                  id: "pla",
                  label: "PLA",
                  value: "22.45K",
                  change: "46.74%",
                  isPositive: false,
                  category: "ad",
                  meta: [
                    { label: "PLA Impressions", value: "22.45K", change: "46.74%", isPositive: false },
                    { label: "Conversion", value: "25.41%", change: "2.18%", isPositive: false }
                  ]
                },
                {
                  id: "pca",
                  label: "PCA",
                  value: "8.10K",
                  change: "56.80%",
                  isPositive: false,
                  category: "ad",
                  meta: [
                    { label: "PCA Impressions", value: "8.10K", change: "56.80%", isPositive: false },
                    { label: "Conversion", value: "29.21%", change: "6.80%", isPositive: true }
                  ]
                },
                {
                  id: "display-ads",
                  label: "Display Ads",
                  value: "5.00K",
                  change: "43.79%",
                  isPositive: false,
                  category: "ad",
                  meta: [
                    { label: "Display Impressions", value: "5.00K", change: "43.79%", isPositive: false },
                    { label: "Conversion", value: "23.28%", change: "2.18%", isPositive: false }
                  ]
                }
              ] : [
                {
                  id: "dsp",
                  label: "DSP",
                  value: "-- Coming Soon --",
                  change: "0.0%",
                  isPositive: true,
                  category: "ad",
                  meta: [
                    { label: "Display GVs", value: "-- Coming Soon --" },
                    { label: "Conversion", value: "-- Coming Soon --" }
                  ]
                },
                {
                  id: "sponsored-search",
                  label: "Sponsored Search",
                  value: "45.00K",
                  change: "46.74%",
                  isPositive: false,
                  category: "ad",
                  meta: [
                    { label: "Search GVs", value: "45.00K", change: "46.74%", isPositive: false },
                    { label: "Conversion", value: "25.41%", change: "2.18%", isPositive: false }
                  ],
                  children: [
                    {
                      id: "sp",
                      label: "Sponsored Product",
                      value: "30.41K",
                      change: "56.80%",
                      isPositive: false,
                      category: "ad",
                      meta: [
                        { label: "SP GVs", value: "30.41K", change: "56.80%", isPositive: false },
                        { label: "Conversion", value: "29.21%", change: "6.80%", isPositive: true },
                        { label: "SP ROAS", value: "2.83", change: "13.85%", isPositive: false },
                        { label: "SP SPEND", value: "2.61M", change: "55.17%", isPositive: false }
                      ]
                    },
                    {
                      id: "sb",
                      label: "Sponsored Brand",
                      value: "5.48K",
                      change: "43.79%",
                      isPositive: false,
                      category: "ad",
                      meta: [
                        { label: "SB All GVs", value: "5.48K", change: "43.79%", isPositive: false },
                        { label: "Conversion", value: "23.28%", change: "2.18%", isPositive: false },
                        { label: "SB ROAS", value: "1.50", change: "34.67%", isPositive: false },
                        { label: "SB SPEND", value: "544.89K", change: "32.99%", isPositive: false }
                      ]
                    },
                    {
                      id: "sd",
                      label: "Sponsored Display",
                      value: "9.11K",
                      change: "109.94%",
                      isPositive: true,
                      category: "ad",
                      meta: [
                        { label: "SD GVs", value: "9.11K", change: "109.94%", isPositive: true },
                        { label: "Conversion", value: "13.98%", change: "24.94%", isPositive: false },
                        { label: "SD ROAS", value: "5.79", change: "46.13%", isPositive: false },
                        { label: "SD SPEND", value: "177.33K", change: "63.58%", isPositive: true }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              id: "sov-overall",
              label: "SOV Overall",
              value: "8.75%",
              change: "0.0%",
              isPositive: true,
              category: "impressions",
              meta: [{ label: "SOV", value: "8.75%" }]
            }
          ]
        },
        {
          id: "cvr",
          label: "CVR",
          value: "40.68%",
          change: "13.01%",
          isPositive: true,
          category: "conversion",
          importance: "primary",
          children: [
            {
              id: "availability",
              label: "Availability",
              value: "69.55%",
              change: "4.60%",
              isPositive: false,
              category: "availability",
              children: [
                {
                  id: "buybox",
                  label: "BuyBox%",
                  value: "43.01%",
                  change: "22.74%",
                  isPositive: false,
                  category: "availability"
                },
                {
                  id: "seller-listing",
                  label: "Seller Listing%",
                  value: "42.85%",
                  change: "0.0%",
                  isPositive: true,
                  category: "availability"
                }
              ]
            },
            {
              id: "delivery-time",
              label: "Delivery Time",
              value: "Same Day",
              change: "22.74%",
              isPositive: false,
              category: "segment",
              children: isFlipkart ? [] : [
                { id: "same-day", label: `Same Day ${pluralGvLabel}%`, value: "100.00%", change: "81.09%", isPositive: true, category: "segment" }
              ]
            },
            {
              id: "discounting",
              label: "Discounting%",
              value: "9.11%",
              change: "9.45%",
              isPositive: false,
              category: "discounting",
              children: isFlipkart ? [] : [
                { id: "one-day", label: `1 Day ${pluralGvLabel}%`, value: "0.00%", change: "0.05%", isPositive: false, category: "segment" }
              ]
            },
            {
              id: "organic-cvr",
              label: "Organic CVR",
              value: "47.65%",
              change: "1.54%",
              isPositive: true,
              category: "organic",
              children: isFlipkart ? [] : [
                { id: "two-day", label: `2 Day ${pluralGvLabel}%`, value: "(Blank)", change: "74.95%", isPositive: false, category: "segment" }
              ]
            },
            {
              id: "inorganic-cvr",
              label: "Inorganic CVR",
              value: "29.21%",
              change: "1.81%",
              isPositive: true,
              category: "ad",
              children: isFlipkart ? [] : [
                { id: "greater-two", label: `> 2 Days ${pluralGvLabel}%`, value: "0.00%", change: "6.08%", isPositive: false, category: "segment" }
              ]
            }
          ]
        },
        {
          id: "asp",
          label: "ASP",
          value: "626.36",
          change: "17.02%",
          isPositive: false,
          category: "price",
          importance: "primary",
          children: [
            { id: "combo-sales", label: "Combo Sales%", value: "42.91%", change: "13.48%", isPositive: true, category: "segment" },
            { id: "large-sales", label: "Large Sales%", value: "53.41%", change: "17.39%", isPositive: false, category: "segment" },
            { id: "premium-sales", label: "Premium Sales%", value: "20.85%", change: "4.73%", isPositive: false, category: "segment" }
          ]
        },
        {
          id: "sns",
          label: "Subscribe & Save %",
          value: "0.00%",
          change: "0.00%",
          isPositive: true,
          category: "segment",
          meta: [{ label: "SnS Sales%", value: "0.00%" }],
          children: [
            { id: "loyalty", label: "Loyalty/Repeats %", value: "79.62%", change: "1.37%", isPositive: true, category: "segment" },
            { id: "new-cust", label: "New Customer %", value: "20.38%", change: "1.37%", isPositive: false, category: "segment" }
          ]
        }
      ]
    };
  }

  // --- STANDARD TREE (DEFAULT) ---
  const rootChange = getChange("root");
  const aspChange = getChange("asp");
  const impChange = getChange("imp");
  const cvrChange = getChange("cvr");
  const osaChange = getChange("osa");
  const orgChange = getChange("org");
  const adChange = getChange("ad");

  return {
    id: "root",
    label: "Offtake",
    value: getVal(53.8),
    change: rootChange.val,
    isPositive: rootChange.isPos,
    category: "offtake",
    importance: "outcome",
    insight: rootChange.isPos ? "Volume Growth" : "Critical Decline",
    metrics: [
      { brand: 'Snickers', offtake: '₹66.6 lac', deltaOfftake: '-₹1.4 lac', price: '₹66.6', deltaPrice: '-₹1.4', discount: '7.1%', deltaDiscount: '0.4%', ppu: '₹122.3', deltaPpu: '-₹7.5', impressions: '19.4 lac', deltaImpressions: '-2.1 lac', conversion: '7.0%', deltaConversion: '-0.3%', rating: '11.4 lac', deltaRating: '0.5 lac', listing: '85.5%', deltaListing: '1.2%' },
      { brand: 'Galaxy', offtake: '₹101.1 lac', deltaOfftake: '-₹8.4 lac', price: '₹101.1', deltaPrice: '-₹8.4', discount: '9.8%', deltaDiscount: '1.3%', ppu: '₹183.5', deltaPpu: '-₹1.8', impressions: '13.7 lac', deltaImpressions: '-4.7 K', conversion: '6.3%', deltaConversion: '-0.5%', listing: '82.1%', deltaListing: '-0.8%' },
      { brand: 'Bounty', offtake: '₹119.7 lac', deltaOfftake: '-₹9.8 lac', price: '₹119.7', deltaPrice: '-₹9.8', discount: '11.7%', deltaDiscount: '2.0%', ppu: '₹144.3', deltaPpu: '-₹14.7', impressions: '4.1 lac', deltaImpressions: '25.9 K', conversion: '7.0%', deltaConversion: '-0.4%', listing: '78.4%', deltaListing: '2.1%' },
      { brand: 'Twix', offtake: '₹117.9 lac', deltaOfftake: '-₹2.8 lac', price: '₹117.9', deltaPrice: '-₹2.8', discount: '5.0%', deltaDiscount: '0.6%', ppu: '₹175.1', deltaPpu: '-₹7', impressions: '30.2 K', deltaImpressions: '1.2 K', conversion: '12.7%', deltaConversion: '0.8%', listing: '91.2%', deltaListing: '-1.5%' },
      { brand: 'Mars', offtake: '₹92.8 lac', deltaOfftake: '-₹2.1 lac', price: '₹92.8', deltaPrice: '-₹2.1', discount: '4.1%', deltaDiscount: '0.3%', ppu: '₹182.1', deltaPpu: '-₹4.1', impressions: '10.5 K', deltaImpressions: '-0.5 K', conversion: '8.5%', deltaConversion: '-0.3%', listing: '88.5%', deltaListing: '0.5%' },
    ],
    meta: [{ label: "Est. Category Share", value: getVal(5.1, true, seed + "catshare", 15), change: getChange("meta1").val, isPositive: getChange("meta1").isPos }],
    children: [
      {
        id: "asp",
        label: "PRICE",
        value: `₹ ${(189.2 * getEntityBase(skuId + brandId, 1.2)).toFixed(1)}`,
        change: aspChange.val,
        isPositive: aspChange.isPos,
        category: "price",
        importance: "primary",
        meta: [{ label: "Baseline PRICE", value: "₹ 185.0" }],
        metrics: [
          { brand: 'Snickers', price: '₹122.3', deltaPrice: '-₹7.5' },
          { brand: 'Galaxy', price: '₹183.5', deltaPrice: '-₹1.8' },
          { brand: 'Bounty', price: '₹144.3', deltaPrice: '-₹14.7' },
          { brand: 'Twix', price: '₹175.1', deltaPrice: '-₹7.0' },
          { brand: 'Mars', price: '₹182.1', deltaPrice: '-₹4.1' },
        ],
      },
      {
        id: "indexed-impressions",
        label: "Impressions",
        value: formatLac(3.4 * finalVolume * getEntityBase(platform + "imp", 0.8)),
        change: impChange.val,
        isPositive: impChange.isPos,
        category: "impressions",
        importance: "primary",
        insight: impChange.isPos ? "High Visibility" : "Visibility Loss",
        metrics: [
          { brand: 'Snickers', impressions: '19.4 lac', deltaImpressions: '+1.2 lac' },
          { brand: 'Galaxy', impressions: '15.2 lac', deltaImpressions: '-0.8 lac' },
          { brand: 'Bounty', impressions: '10.1 lac', deltaImpressions: '+2.5 lac' },
          { brand: 'Twix', impressions: '8.4 lac', deltaImpressions: '-0.3 lac' },
          { brand: 'Mars', impressions: '7.0 lac', deltaImpressions: '+0.1 lac' },
        ],
        meta: [{ label: "Overall SOS", value: getVal(12.5, true, seed + "sos", 25), change: getChange("meta2").val, isPositive: getChange("meta2").isPos }],
        children: [
          {
            id: "availability",
            label: "Wt. OSA %",
            value: getVal(72.5, true, seed + "osa", 40),
            change: osaChange.val,
            isPositive: osaChange.isPos,
            category: "availability",
            metrics: [
              { brand: 'Snickers', osa: '82.5%', deltaOsa: '+1.2%' },
              { brand: 'Galaxy', osa: '75.1%', deltaOsa: '-2.4%' },
              { brand: 'Bounty', osa: '88.9%', deltaOsa: '+0.5%' },
              { brand: 'Twix', osa: '91.2%', deltaOsa: '-1.8%' },
              { brand: 'Mars', osa: '85.4%', deltaOsa: '+3.1%' },
            ],
            children: [
              {
                id: "listing",
                label: "DS Listing %",
                value: getVal(60.0, true, seed + "listing", 50),
                change: getChange("meta3").val,
                isPositive: getChange("meta3").isPos,
                category: "availability",
                metrics: [
                  { brand: 'Snickers', listing: '92.1%', deltaListing: '+1.5%' },
                  { brand: 'Galaxy', listing: '88.4%', deltaListing: '-0.8%' },
                  { brand: 'Bounty', listing: '85.0%', deltaListing: '+2.1%' },
                  { brand: 'Twix', listing: '95.2%', deltaListing: '-1.2%' },
                  { brand: 'Mars', listing: '89.7%', deltaListing: '+0.4%' },
                ],
              }
            ]
          },
          {
            id: "organic-impressions",
            label: "Organic Impressions",
            value: formatLac(1.9 * finalVolume * getEntityBase(category + "org", 0.6)),
            change: orgChange.val,
            isPositive: orgChange.isPos,
            category: "organic",
            insight: orgChange.isPos ? "Organic Pull" : "Low Ranking",
            metrics: [
              { brand: 'Snickers', organic: '12.2 lac', deltaOrganic: '+0.8 lac' },
              { brand: 'Galaxy', organic: '8.5 lac', deltaOrganic: '-0.3 lac' },
              { brand: 'Bounty', organic: '5.4 lac', deltaOrganic: '+0.2 lac' },
              { brand: 'Twix', organic: '3.1 lac', deltaOrganic: '-0.1 lac' },
              { brand: 'Mars', organic: '1.2 lac', deltaOrganic: '+0.05 lac' },
            ],
            meta: [{ label: "Organic SOS", value: getVal(8.5, true, seed + "orgsos", 15), change: getChange("meta4").val, isPositive: getChange("meta4").isPos }],
          },
          {
            id: "ad-impressions",
            label: "Ad Impressions",
            value: formatLac(1.5 * finalVolume * getEntityBase(brand + "ad", 0.9)),
            change: adChange.val,
            isPositive: adChange.isPos,
            category: "ad",
            metrics: [
              { brand: 'Snickers', ad: '7.2 lac', deltaAd: '+0.4 lac' },
              { brand: 'Galaxy', ad: '6.7 lac', deltaAd: '-0.5 lac' },
              { brand: 'Bounty', ad: '4.7 lac', deltaAd: '+0.3 lac' },
              { brand: 'Twix', ad: '5.3 lac', deltaAd: '+0.2 lac' },
              { brand: 'Mars', ad: '5.8 lac', deltaAd: '+0.1 lac' },
            ],
            meta: [{ label: "Ad SOS", value: getVal(4.5, true, seed + "adsos", 10), change: getChange("meta5").val, isPositive: getChange("meta5").isPos }],
            children: [
              {
                id: "ad-comp", label: "Comp Keywords", value: formatLac(0.305 * finalVolume * getEntityBase("adc", 0.5)), change: getChange("adc").val, isPositive: getChange("adc").isPos, category: "ad", metrics: [
                  { brand: 'Snickers', adComp: '3.1 lac', deltaAdComp: '-0.1 lac' },
                  { brand: 'Galaxy', adComp: '2.7 lac', deltaAdComp: '-0.2 lac' },
                  { brand: 'Bounty', adComp: '0.6 lac', deltaAdComp: '+0.1 lac' },
                  { brand: 'Twix', adComp: '3.6 K', deltaAdComp: '+0.2 K' },
                  { brand: 'Mars', adComp: '2.0 K', deltaAdComp: '-0.1 K' },
                ]
              },
            ],
          },
        ],
      },
      {
        id: "indexed-cvr",
        label: "Conversion",
        value: getVal(6.2, true, seed + "cvr", 8),
        change: cvrChange.val,
        isPositive: cvrChange.isPos,
        category: "conversion",
        importance: "outcome",
        insight: cvrChange.isPos ? "Conv. Efficacy" : "Conv. Drop",
        metrics: [
          { brand: 'Snickers', conversion: '7.2%', deltaConversion: '+0.5%' },
          { brand: 'Galaxy', conversion: '6.3%', deltaConversion: '-0.2%' },
          { brand: 'Bounty', conversion: '8.5%', deltaConversion: '+1.1%' },
          { brand: 'Twix', conversion: '12.7%', deltaConversion: '-2.4%' },
          { brand: 'Mars', conversion: '9.4%', deltaConversion: '+0.3%' },
        ],
        children: [
          {
            id: "discounting", label: "Wt. Disc %", value: getVal(18.5, true, seed + "disc", 30), change: getChange("meta6").val, isPositive: getChange("meta6").isPos, category: "discounting", metrics: [
              { brand: 'Snickers', discount: '7.1%', deltaDiscount: '+0.4%' },
              { brand: 'Galaxy', discount: '9.8%', deltaDiscount: '+1.3%' },
              { brand: 'Bounty', discount: '11.7%', deltaDiscount: '+2.0%' },
              { brand: 'Twix', discount: '5.0%', deltaDiscount: '+0.6%' },
              { brand: 'Mars', discount: '4.1%', deltaDiscount: '+0.3%' },
            ]
          },
        ],
      },
    ],
  };
};

const nodeTypes = { kpi: KpiNode };

// --- Index helpers (for focus mode) ---
const buildIndex = (tree) => {
  const parent = new Map();
  const children = new Map();
  const walk = (n, pid = null) => {
    parent.set(n.id, pid);
    children.set(n.id, (n.children || []).map((c) => c.id));
    (n.children || []).forEach((c) => walk(c, n.id));
  };
  walk(tree, null);
  return { parent, children };
};

const collectAncestors = (id, parentMap) => {
  const s = new Set();
  let cur = id;
  while (parentMap.get(cur)) {
    const p = parentMap.get(cur);
    s.add(p);
    cur = p;
  }
  return s;
};

const collectDescendants = (id, childMap) => {
  const s = new Set();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    const kids = childMap.get(cur) || [];
    kids.forEach((k) => {
      s.add(k);
      stack.push(k);
    });
  }
  return s;
};

// --- Layout Engine ---
const computeSubtreeHeight = (node, collapsedNodes) => {
  if (!node.children || node.children.length === 0 || collapsedNodes.has(node.id)) return CARD_HEIGHT;
  const childHeights = node.children.map((child) => computeSubtreeHeight(child, collapsedNodes));
  return childHeights.reduce((sum, h, idx) => sum + h + (idx > 0 ? VERTICAL_GAP : 0), 0);
};

const layoutTreeNodes = (node, x, y, collapsedNodes, results, onViewTrends, platform = "") => {
  const isCollapsed = collapsedNodes.has(node.id);
  const subtreeHeight = computeSubtreeHeight(node, collapsedNodes);

  results.nodes.push({
    id: node.id,
    type: "kpi",
    position: { x, y: y + subtreeHeight / 2 - CARD_HEIGHT / 2 },
    data: {
      ...node,
      platform,
      hasChildren: node.children?.length > 0,
      isCollapsed,
      onToggle: () => { },
      onClickDetail: () => { },
      onHover: () => { },
      isDimmed: false,
      onViewTrends,
    },
  });

  if (node.children && !isCollapsed) {
    let currentChildY = y;
    node.children.forEach((child) => {
      const childHeight = computeSubtreeHeight(child, collapsedNodes);

      results.edges.push({
        id: `${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
        type: ConnectionLineType.Step,
        animated: false,
        style: {
          stroke: "rgba(15,23,42,0.35)",
          strokeWidth: 2.2,
          strokeDasharray: "5,7",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "rgba(15,23,42,0.55)",
          width: 14,
          height: 14,
        },
      });

      layoutTreeNodes(child, x + HORIZONTAL_STEP, currentChildY, collapsedNodes, results, onViewTrends, platform);
      currentChildY += childHeight + VERTICAL_GAP;
    });
  }
};

// --- Detail Popup (Updated with Brand Filtering, Download, and Pagination) ---
const NodeDetailPopup = ({ open, onClose, nodeData, selectedBrand, selectedPlatform }) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [page, setPage] = useState(0);
  const rowsPerPage = 4;

  useEffect(() => {
    setPage(0);
  }, [tabIndex, selectedBrand]);

  if (!nodeData) return null;

  const normalizedPlatform = (selectedPlatform || "").toLowerCase();
  const kpiKey = (nodeData.category || nodeData.label || "").toLowerCase();
  const showKeywordColumn = /impression|conversion|cvr/i.test(nodeData.label || nodeData.category || "");
  const isAdImpressions = showKeywordColumn;

  const contributionsMap = {
    amazon: {
      offtake: {
        gainers: [
          { sku: "Snickers Peanut Duo 50g", keyword: "snickers bar", brand: "Snickers", value: "+18.5%" },
          { sku: "Galaxy Smooth Milk 80g", keyword: "galaxy chocolate", brand: "Galaxy", value: "+14.8%" },
          { sku: "M&M's Peanut 100g", keyword: "m&ms peanut", brand: "M&M", value: "+11.3%" },
          { sku: "Twix Single 50g", keyword: "twix bar", brand: "Twix", value: "+9.2%" },
          { sku: "Mars Bar Single 45g", keyword: "mars chocolate", brand: "Mars", value: "+7.1%" },
        ],
        drainers: [
          { sku: "Bounty Coconut 57g", keyword: "bounty bar", brand: "Bounty", value: "-12.7%" },
          { sku: "Orbit Spearmint Bottle", keyword: "orbit gum", brand: "Orbit", value: "-9.8%" },
          { sku: "Skittles Fruits 45g", keyword: "skittles candy", brand: "Skittles", value: "-7.5%" },
          { sku: "Doublemint Peppermint", keyword: "doublemint gum", brand: "Doublemint", value: "-5.2%" },
          { sku: "Boomer Jelly Blue", keyword: "boomer gum", brand: "Boomer", value: "-3.9%" },
        ],
      },
      impressions: {
        gainers: [
          { sku: "Snickers Stick 40g", keyword: "snickers ads", brand: "Snickers", value: "+22.8%" },
          { sku: "Galaxy Minis 150g", keyword: "galaxy shelf", brand: "Galaxy", value: "+18.1%" },
          { sku: "M&M's Chocolate 45g", keyword: "m&m banner", brand: "M&M", value: "+12.3%" },
          { sku: "Orbit White Bottle", keyword: "orbit ads", brand: "Orbit", value: "+10.9%" },
          { sku: "Skittles Wild Berry", keyword: "skittles banner", brand: "Skittles", value: "+9.4%" },
        ],
        drainers: [
          { sku: "Mars Minis Pack", keyword: "mars old ads", brand: "Mars", value: "-13.7%" },
          { sku: "Twix Minis 200g", keyword: "twix promo slot", brand: "Twix", value: "-8.6%" },
          { sku: "Bounty Minis 150g", keyword: "bounty banner", brand: "Bounty", value: "-6.1%" },
          { sku: "Doublemint Lemon", keyword: "doublemint ads", brand: "Doublemint", value: "-4.9%" },
          { sku: "Boomer Strawberry", keyword: "boomer ads", brand: "Boomer", value: "-3.0%" },
        ],
      },
      conversion: {
        gainers: [
          { sku: "Snickers Almond 40g", keyword: "snickers conversion", brand: "Snickers", value: "+11.2%" },
          { sku: "Galaxy Cookie Crumble", keyword: "galaxy conversion", brand: "Galaxy", value: "+9.5%" },
          { sku: "Orbit Blueberry Bottle", keyword: "orbit checkout", brand: "Orbit", value: "+8.1%" },
          { sku: "M&M's Crispy 80g", keyword: "m&m checkout", brand: "M&M", value: "+6.3%" },
          { sku: "Skittles Sour 45g", keyword: "skittles sour", brand: "Skittles", value: "+4.7%" },
        ],
        drainers: [
          { sku: "Mars Caramel 135g", keyword: "mars drop", brand: "Mars", value: "-10.2%" },
          { sku: "Twix White 50g", keyword: "twix drop", brand: "Twix", value: "-8.7%" },
          { sku: "Doublemint Peppermint", keyword: "doublemint drop", brand: "Doublemint", value: "-6.6%" },
          { sku: "Boomer Jelly Pink", keyword: "boomer drop", brand: "Boomer", value: "-4.2%" },
          { sku: "Bounty Coconut 57g", keyword: "bounty drop", brand: "Bounty", value: "-3.1%" },
        ],
      },
      price: {
        gainers: [
          { sku: "Orbit Peppermint 22g", keyword: "orbit price", brand: "Orbit", value: "+6.8%" },
          { sku: "Boomer Strawberry 5g", keyword: "boomer price", brand: "Boomer", value: "+4.5%" },
          { sku: "Doublemint Mints", keyword: "doublemint price", brand: "Doublemint", value: "+3.2%" },
          { sku: "Skittles Fruits 100g", keyword: "skittles price", brand: "Skittles", value: "+2.1%" },
          { sku: "Galaxy Fruit & Nut", keyword: "galaxy premium", brand: "Galaxy", value: "+1.0%" },
        ],
        drainers: [
          { sku: "Snickers Bulk Pack", keyword: "snickers discount", brand: "Snickers", value: "-9.8%" },
          { sku: "M&M's Party Bucket", keyword: "m&m discount", brand: "M&M", value: "-7.3%" },
          { sku: "Twix Multi-Pack", keyword: "twix discount", brand: "Twix", value: "-5.4%" },
          { sku: "Mars Party Pack", keyword: "mars discount", brand: "Mars", value: "-4.0%" },
          { sku: "Bounty Trio Pack", keyword: "bounty discount", brand: "Bounty", value: "-2.8%" },
        ],
      },
      availability: {
        gainers: [
          { sku: "Orbit Spearmint 22g", keyword: "orbit osa", brand: "Orbit", value: "+7.4%" },
          { sku: "Skittles Fruits 45g", keyword: "skittles osa", brand: "Skittles", value: "+5.7%" },
          { sku: "M&M's Peanut 45g", keyword: "m&m stock", brand: "M&M", value: "+4.9%" },
          { sku: "Galaxy Caramel 135g", keyword: "galaxy stock", brand: "Galaxy", value: "+3.3%" },
          { sku: "Snickers Peanut 50g", keyword: "snickers inventory", brand: "Snickers", value: "+2.4%" },
        ],
        drainers: [
          { sku: "Mars Single 45g", keyword: "mars oos", brand: "Mars", value: "-10.3%" },
          { sku: "Twix Single 50g", keyword: "twix oos", brand: "Twix", value: "-8.1%" },
          { sku: "Bounty Coconut 57g", keyword: "bounty oos", brand: "Bounty", value: "-5.6%" },
          { sku: "Doublemint Lemon", keyword: "doublemint oos", brand: "Doublemint", value: "-4.2%" },
          { sku: "Boomer Strawberry", keyword: "boomer oos", brand: "Boomer", value: "-2.1%" },
        ],
      },
    },
    flipkart: {
      offtake: {
        gainers: [
          { sku: "Galaxy Smooth Milk 80g", keyword: "galaxy chocolate", brand: "Galaxy", value: "+16.9%" },
          { sku: "Snickers Peanut Duo 50g", keyword: "snickers bar", brand: "Snickers", value: "+13.2%" },
          { sku: "M&M's Peanut 100g", keyword: "m&ms peanut", brand: "M&M", value: "+11.4%" },
          { sku: "Orbit Spearmint Bottle", keyword: "orbit gum", brand: "Orbit", value: "+8.8%" },
          { sku: "Twix Single 50g", keyword: "twix bar", brand: "Twix", value: "+7.3%" },
        ],
        drainers: [
          { sku: "Mars bar Single 45g", keyword: "mars bar", brand: "Mars", value: "-12.5%" },
          { sku: "Bounty Coconut 57g", keyword: "bounty coconut", brand: "Bounty", value: "-9.8%" },
          { sku: "Skittles Fruits 45g", keyword: "skittles candy", brand: "Skittles", value: "-6.9%" },
          { sku: "Doublemint Peppermint", keyword: "doublemint gum", brand: "Doublemint", value: "-4.3%" },
          { sku: "Boomer Jelly Blue", keyword: "boomer gum", brand: "Boomer", value: "-2.7%" },
        ],
      },
      impressions: {
        gainers: [
          { sku: "Snickers Stick 40g", keyword: "snickers ads", brand: "Snickers", value: "+21.5%" },
          { sku: "Galaxy Minis 150g", keyword: "galaxy shelf", brand: "Galaxy", value: "+18.1%" },
          { sku: "M&M's Chocolate 45g", keyword: "m&m banner", brand: "M&M", value: "+14.2%" },
          { sku: "Orbit White Bottle", keyword: "orbit ads", brand: "Orbit", value: "+11.0%" },
          { sku: "Skittles Wild Berry", keyword: "skittles banner", brand: "Skittles", value: "+9.1%" },
        ],
        drainers: [
          { sku: "Mars Minis Pack", keyword: "mars old ads", brand: "Mars", value: "-14.9%" },
          { sku: "Twix Minis 200g", keyword: "twix promo slot", brand: "Twix", value: "-10.3%" },
          { sku: "Bounty Minis 150g", keyword: "bounty banner", brand: "Bounty", value: "-7.8%" },
          { sku: "Doublemint Lemon", keyword: "doublemint ads", brand: "Doublemint", value: "-5.9%" },
          { sku: "Boomer Strawberry", keyword: "boomer ads", brand: "Boomer", value: "-3.4%" },
        ],
      },
      conversion: {
        gainers: [
          { sku: "Snickers Almond 40g", keyword: "snickers conversion", brand: "Snickers", value: "+12.4%" },
          { sku: "Galaxy Cookie Crumble", keyword: "galaxy conversion", brand: "Galaxy", value: "+10.2%" },
          { sku: "Orbit Blueberry Bottle", keyword: "orbit checkout", brand: "Orbit", value: "+8.0%" },
          { sku: "M&M's Crispy 80g", keyword: "m&m checkout", brand: "M&M", value: "+6.6%" },
          { sku: "Skittles Sour 45g", keyword: "skittles sour", brand: "Skittles", value: "+5.2%" },
        ],
        drainers: [
          { sku: "Mars Caramel 135g", keyword: "mars drop", brand: "Mars", value: "-10.8%" },
          { sku: "Twix White 50g", keyword: "twix drop", brand: "Twix", value: "-8.9%" },
          { sku: "Doublemint Peppermint", keyword: "doublemint drop", brand: "Doublemint", value: "-7.4%" },
          { sku: "Boomer Jelly Pink", keyword: "boomer drop", brand: "Boomer", value: "-5.3%" },
          { sku: "Bounty Coconut 57g", keyword: "bounty drop", brand: "Bounty", value: "-3.1%" },
        ],
      },
      price: {
        gainers: [
          { sku: "Orbit Peppermint 22g", keyword: "orbit price", brand: "Orbit", value: "+9.6%" },
          { sku: "Boomer Strawberry 5g", keyword: "boomer price", brand: "Boomer", value: "+6.2%" },
          { sku: "Doublemint Mints", keyword: "doublemint price", brand: "Doublemint", value: "+5.1%" },
          { sku: "Skittles Fruits 100g", keyword: "skittles price", brand: "Skittles", value: "+3.8%" },
          { sku: "Galaxy Fruit & Nut", keyword: "galaxy premium", brand: "Galaxy", value: "+2.6%" },
        ],
        drainers: [
          { sku: "Snickers Bulk Pack", keyword: "snickers discount", brand: "Snickers", value: "-11.1%" },
          { sku: "M&M's Party Bucket", keyword: "m&m discount", brand: "M&M", value: "-9.0%" },
          { sku: "Twix Multi-Pack", keyword: "twix discount", brand: "Twix", value: "-6.7%" },
          { sku: "Mars Party Pack", keyword: "mars discount", brand: "Mars", value: "-4.4%" },
          { sku: "Bounty Trio Pack", keyword: "bounty discount", brand: "Bounty", value: "-2.9%" },
        ],
      },
      availability: {
        gainers: [
          { sku: "Orbit Spearmint 22g", keyword: "orbit osa", brand: "Orbit", value: "+8.8%" },
          { sku: "Skittles Fruits 45g", keyword: "skittles osa", brand: "Skittles", value: "+7.3%" },
          { sku: "M&M's Peanut 45g", keyword: "m&m stock", brand: "M&M", value: "+5.7%" },
          { sku: "Galaxy Caramel 135g", keyword: "galaxy stock", brand: "Galaxy", value: "+4.2%" },
          { sku: "Snickers Peanut 50g", keyword: "snickers inventory", brand: "Snickers", value: "+3.1%" },
        ],
        drainers: [
          { sku: "Mars Single 45g", keyword: "mars oos", brand: "Mars", value: "-9.7%" },
          { sku: "Twix Single 50g", keyword: "twix oos", brand: "Twix", value: "-7.4%" },
          { sku: "Bounty Coconut 57g", keyword: "bounty oos", brand: "Bounty", value: "-5.8%" },
          { sku: "Doublemint Lemon", keyword: "doublemint oos", brand: "Doublemint", value: "-4.1%" },
          { sku: "Boomer Strawberry", keyword: "boomer oos", brand: "Boomer", value: "-2.7%" },
        ],
      },
    },
    blinkit: {
      offtake: {
        gainers: [
          { sku: "Orbit Spearmint Bottle", keyword: "orbit gum", brand: "Orbit", value: "+18.1%" },
          { sku: "Skittles Fruits 45g", keyword: "skittles candy", brand: "Skittles", value: "+13.2%" },
          { sku: "Snickers Peanut Duo 50g", keyword: "snickers bar", brand: "Snickers", value: "+10.3%" },
          { sku: "Galaxy Smooth Milk 80g", keyword: "galaxy chocolate", brand: "Galaxy", value: "+7.7%" },
          { sku: "Twix Single 50g", keyword: "twix bar", brand: "Twix", value: "+6.0%" },
        ],
        drainers: [
          { sku: "Mars bar Single 45g", keyword: "mars bar", brand: "Mars", value: "-11.9%" },
          { sku: "Bounty Coconut 57g", keyword: "bounty coconut", brand: "Bounty", value: "-9.4%" },
          { sku: "M&M's Peanut 100g", keyword: "m&ms peanut", brand: "M&M", value: "-6.9%" },
          { sku: "Doublemint Peppermint", keyword: "doublemint gum", brand: "Doublemint", value: "-5.2%" },
          { sku: "Boomer Jelly Blue", keyword: "boomer gum", brand: "Boomer", value: "-3.1%" },
        ],
      },
      impressions: {
        gainers: [
          { sku: "Blinkit Snickers Ad", keyword: "snickers banner", brand: "Snickers", value: "+14.8%" },
          { sku: "Galaxy Express Promo", keyword: "galaxy banner", brand: "Galaxy", value: "+11.9%" },
          { sku: "Twix Quick Deal", keyword: "twix deal", brand: "Twix", value: "+9.6%" },
          { sku: "Orbit Checkout Ad", keyword: "orbit ads", brand: "Orbit", value: "+7.2%" },
          { sku: "M&M's Pop-up", keyword: "m&m ads", brand: "M&M", value: "+5.0%" },
        ],
        drainers: [
          { sku: "Skittles Old Campaign", keyword: "skittles banner", brand: "Skittles", value: "-12.1%" },
          { sku: "Mars Night Deal", keyword: "mars banner", brand: "Mars", value: "-8.8%" },
          { sku: "Bounty Weekend Ad", keyword: "bounty banner", brand: "Bounty", value: "-6.3%" },
          { sku: "Doublemint Shelf Ad", keyword: "doublemint ads", brand: "Doublemint", value: "-4.7%" },
          { sku: "Boomer Mix Campaign", keyword: "boomer ads", brand: "Boomer", value: "-3.0%" },
        ],
      },
      conversion: {
        gainers: [
          { sku: "Snickers Almond 40g", keyword: "snickers checkout", brand: "Snickers", value: "+11.3%" },
          { sku: "Galaxy Cookie Crumble", keyword: "galaxy checkout", brand: "Galaxy", value: "+9.7%" },
          { sku: "Orbit White Bottle", keyword: "orbit checkout", brand: "Orbit", value: "+7.5%" },
          { sku: "Doublemint Lemon", keyword: "doublemint checkout", brand: "Doublemint", value: "+5.4%" },
          { sku: "Twix Single 50g", keyword: "twix checkout", brand: "Twix", value: "+4.1%" },
        ],
        drainers: [
          { sku: "Mars Single 45g", keyword: "mars drop", brand: "Mars", value: "-10.8%" },
          { sku: "Bounty Coconut 57g", keyword: "bounty drop", brand: "Bounty", value: "-8.6%" },
          { sku: "M&M's Peanut 45g", keyword: "m&m drop", brand: "M&M", value: "-6.2%" },
          { sku: "Skittles Fruits 45g", keyword: "skittles drop", brand: "Skittles", value: "-5.0%" },
          { sku: "Boomer Strawberry", keyword: "boomer drop", brand: "Boomer", value: "-3.4%" },
        ],
      },
      price: {
        gainers: [
          { sku: "Orbit Peppermint 22g", keyword: "orbit price", brand: "Orbit", value: "+7.8%" },
          { sku: "Boomer Strawberry 5g", keyword: "boomer price", brand: "Boomer", value: "+6.7%" },
          { sku: "Doublemint Mints", keyword: "doublemint price", brand: "Doublemint", value: "+5.1%" },
          { sku: "Skittles Fruits 100g", keyword: "skittles price", brand: "Skittles", value: "+3.9%" },
          { sku: "Snickers Stick 40g", keyword: "snickers price", brand: "Snickers", value: "+2.6%" },
        ],
        drainers: [
          { sku: "Mars Multi-Pack", keyword: "mars discount", brand: "Mars", value: "-12.4%" },
          { sku: "Bounty Trio Pack", keyword: "bounty discount", brand: "Bounty", value: "-9.3%" },
          { sku: "Galaxy Combo", keyword: "galaxy discount", brand: "Galaxy", value: "-7.2%" },
          { sku: "Orbit Bulk Pack", keyword: "orbit discount", brand: "Orbit", value: "-5.6%" },
          { sku: "Twix Mini Bag", keyword: "twix discount", brand: "Twix", value: "-3.9%" },
        ],
      },
      availability: {
        gainers: [
          { sku: "Snickers Peanut Duo", keyword: "snickers stock", brand: "Snickers", value: "+12.6%" },
          { sku: "Galaxy Smooth Milk", keyword: "galaxy stock", brand: "Galaxy", value: "+10.3%" },
          { sku: "Orbit Spearmint", keyword: "orbit stock", brand: "Orbit", value: "+8.0%" },
          { sku: "Mars Single 45g", keyword: "mars stock", brand: "Mars", value: "+6.1%" },
          { sku: "Doublemint Lemon", keyword: "doublemint stock", brand: "Doublemint", value: "+4.7%" },
        ],
        drainers: [
          { sku: "Twix Single 50g", keyword: "twix oos", brand: "Twix", value: "-10.2%" },
          { sku: "Bounty Coconut", keyword: "bounty oos", brand: "Bounty", value: "-8.5%" },
          { sku: "M&M's Peanut", keyword: "m&m oos", brand: "M&M", value: "-6.3%" },
          { sku: "Skittles Fruits", keyword: "skittles oos", brand: "Skittles", value: "-4.0%" },
          { sku: "Boomer Strawberry", keyword: "boomer oos", brand: "Boomer", value: "-2.5%" },
        ],
      },
    },
  };

  const dropdownBrands = ["mars", "snickers", "galaxy", "twix", "boomer", "bounty", "doublemint", "m&m", "orbit", "skittles"];

  const kpiCategoryFromLabel = (kpiLabel) => {
    const l = (kpiLabel || "").toLowerCase();
    if (l.includes("offtake")) return "offtake";
    if (l.includes("impression")) return "impressions";
    if (l.includes("conversion") || l.includes("cvr")) return "conversion";
    if (l.includes("price") || l.includes("asp")) return "price";
    if (l.includes("availability") || l.includes("osa")) return "availability";
    return "offtake";
  };

  const getKpiSeed = (brand, platform, kpi, isGainer, idx) => {
    const p = (platform || "").toLowerCase();
    const b = (brand || "").toLowerCase();
    const base = isGainer ? 10 : -7;
    const platformBoost = p.includes("amazon") ? 3 : p.includes("flipkart") ? 2 : 1;
    const kpiBoost = kpi === "offtake" ? 4 : kpi === "impressions" ? 3.6 : kpi === "conversion" ? 2.4 : kpi === "price" ? 1.1 : 2.5;
    return Math.round((base + kpiBoost * (idx + 1) + (brand.length % 4) + platformBoost) * (isGainer ? 1 : 1.05));
  };

  const generateBrandRows = (brand, kpi, platform, isGainer) => {
    const rows = [];
    for (let i = 0; i < 5; i += 1) {
      const delta = getKpiSeed(brand, platform, kpi, isGainer, i);
      const sign = delta >= 0 ? "+" : "";
      const value = `${sign}${delta.toFixed(1)}%`;
      const baseName = `${brand} ${kpi}`;
      rows.push({
        sku: `${baseName} SKU ${i + 1}`,
        keyword: `${baseName} KW ${i + 1}`,
        brand: brand.charAt(0).toUpperCase() + brand.slice(1),
        value,
      });
    }
    return rows;
  };

  const getBrandSpecificRows = (brand, kpi, platform) => {
    const normalized = (brand || "").trim().toLowerCase();
    if (!normalized || normalized === "all" || normalized === "all brands") return null;
    if (!dropdownBrands.includes(normalized)) return null;

    return {
      gainers: generateBrandRows(normalized, kpi, platform, true),
      drainers: generateBrandRows(normalized, kpi, platform, false),
    };
  };

  const getContributionRows = () => {
    const platformKey = normalizedPlatform === "flipkart" ? "flipkart" : normalizedPlatform === "amazon" ? "amazon" : "blinkit";
    const platformData = contributionsMap[platformKey] || contributionsMap.blinkit;
    const kpi = kpiCategoryFromLabel(kpiKey);

    const brandRows = getBrandSpecificRows(selectedBrand, kpi, normalizedPlatform);
    if (brandRows) {
      return brandRows;
    }

    const kpiRows = platformData[kpi] || platformData.offtake || { gainers: [], drainers: [] };
    return {
      gainers: kpiRows.gainers,
      drainers: kpiRows.drainers,
    };
  };

  const { gainers: fullGainers, drainers: fullDrainers } = getContributionRows();
  const filterByBrand = (list) => {
    if (!selectedBrand || selectedBrand === "All" || selectedBrand === "All Brands") return list;
    return list.filter(item => item.brand.toLowerCase() === selectedBrand.toLowerCase());
  };
  const filteredGainers = filterByBrand(fullGainers);
  const filteredDrainers = filterByBrand(fullDrainers);
  const activeData = tabIndex === 0 ? filteredGainers : filteredDrainers;
  const pagedData = activeData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleDownload = () => {
    const csvRows = [
      [isAdImpressions ? "Keyword" : "SKU Name", "Brand", `${nodeData.label} Delta`],
      ...activeData.map(row => [isAdImpressions ? (row.keyword || row.sku) : row.sku, row.brand, row.value])
    ];
    const csvString = csvRows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${nodeData.label}_${tabIndex === 0 ? 'Gainers' : 'Drainers'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "40px",
          bgcolor: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(40px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.8)",
          boxShadow: "0 60px 120px -30px rgba(0, 0, 0, 0.4)",
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1, p: 5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: "20px",
              bgcolor: (COLORS[nodeData.category] || "#6366f1") + "18",
              color: COLORS[nodeData.category] || "#6366f1",
              boxShadow: `inset 0 0 15px ${(COLORS[nodeData.category] || "#6366f1")}25`,
            }}
          >
            <Activity size={32} strokeWidth={2.5} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "24px", fontWeight: 900, color: "#000000", letterSpacing: "-1px" }}>
              {nodeData.label} Intelligence
            </Typography>
            <Typography sx={{ fontSize: "11px", fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "1.5px" }}>
              High Precision Diagnostic Stream
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ bgcolor: "rgba(0,0,0,0.05)", color: "#000000", width: 44, height: 44, "&:hover": { bgcolor: "rgba(0,0,0,0.1)" } }}>
          <Plus style={{ transform: "rotate(45deg)" }} size={28} />
        </IconButton>
      </DialogTitle>

      <Divider sx={{ opacity: 0.08 }} />

      <DialogContent sx={{ p: 5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography sx={{ fontSize: "13px", fontWeight: 900, color: "#000000", textTransform: "uppercase", letterSpacing: "1.2px" }}>
                {showKeywordColumn ? "Keyword Contribution Analysis" : "SKU Contribution Analysis"}
              </Typography>
              <Tooltip title="Download CSV" arrow>
                <IconButton onClick={handleDownload} sx={{ bgcolor: 'rgba(0,0,0,0.03)', color: '#64748b', p: 0.8 }}>
                  <Download size={16} />
                </IconButton>
              </Tooltip>
            </Box>
            <Tabs
              value={tabIndex}
              onChange={(_, n) => setTabIndex(n)}
              sx={{
                minHeight: 'auto',
                '& .MuiTabs-indicator': { display: 'none' },
                '& .MuiTabs-flexContainer': {
                  bgcolor: 'rgba(0,0,0,0.04)',
                  p: 0.5,
                  borderRadius: '12px',
                  gap: 0.5
                }
              }}
            >
              <Tab
                label="Gainers"
                sx={{
                  fontSize: '11px', fontWeight: 900, p: '6px 16px', borderRadius: '10px', minHeight: 'auto', minWidth: 'auto',
                  color: '#64748b',
                  '&.Mui-selected': { bgcolor: '#fff', color: '#0d9488', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }
                }}
              />
              <Tab
                label="Drainers"
                sx={{
                  fontSize: '11px', fontWeight: 900, p: '6px 16px', borderRadius: '10px', minHeight: 'auto', minWidth: 'auto',
                  color: '#64748b',
                  '&.Mui-selected': { bgcolor: '#fff', color: '#e11d48', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }
                }}
              />
            </Tabs>
          </Box>

          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                <TableRow>
                  <TableCell sx={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', py: 2 }}>
                    {isAdImpressions ? 'Keyword' : 'SKU Name'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', py: 2 }}>Brand</TableCell>
                  <TableCell align="right" sx={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', py: 2 }}>{nodeData.label} Δ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedData.length > 0 ? pagedData.map((row, idx) => (
                  <TableRow key={idx} sx={{ '&:last-child td': { border: 0 }, hover: { bgcolor: 'rgba(0,0,0,0.01)' } }}>
                    <TableCell sx={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', py: 2 }}>{showKeywordColumn ? (row.keyword || row.sku) : row.sku}</TableCell>
                    <TableCell sx={{ fontSize: '12px', fontWeight: 700, color: '#64748b', py: 2 }}>{row.brand}</TableCell>
                    <TableCell align="right" sx={{
                      fontSize: '13px', fontWeight: 900, py: 2,
                      color: row.value.startsWith('+') ? '#0d9488' : '#e11d48'
                    }}>
                      {row.value}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 4, color: '#94a3b8', fontStyle: 'italic', fontWeight: 600 }}>
                      No SKU results for "{selectedBrand}"
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {activeData.length > rowsPerPage && (
            <TablePagination
              component="div"
              count={activeData.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[]}
              sx={{
                border: 0,
                '& .MuiTablePagination-toolbar': { minHeight: 48 },
                '& .MuiTablePagination-selectLabel, .MuiTablePagination-input': { display: 'none' }
              }}
            />
          )}

          <Box sx={{ mt: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(0,0,0,0.05)' }} />
            <Typography sx={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
              End of Diagnostic Trace
            </Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(0,0,0,0.05)' }} />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

// --- Internal RCATree Component ---
const RcaTreeInner = ({ context, title, onViewTrends }) => {
  const [collapsedNodes, setCollapsedNodes] = useState(new Set(["listing", "ad-impressions"]));
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [apiTreeData, setApiTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const reactFlowInstance = useReactFlow();

  // Fetch RCA tree data from backend
  const fetchRcaData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const params = {};
      if (context.platform) params.platform = context.platform;
      if (context.category && context.category !== 'All') params.category = context.category;
      if (context.brand && context.brand !== 'All Brands' && context.brand !== 'All') params.brand = context.brand;
      if (context.sku && context.sku !== 'All SKUs' && context.sku !== 'All') params.sku = context.sku;

      // Date Range Support
      if (context.timeStart) params.startDate = context.timeStart.format('YYYY-MM-DD');
      if (context.timeEnd) params.endDate = context.timeEnd.format('YYYY-MM-DD');

      if (context.compareOn) {
        if (context.compareStart) params.compareStartDate = context.compareStart.format('YYYY-MM-DD');
        if (context.compareEnd) params.compareEndDate = context.compareEnd.format('YYYY-MM-DD');
      }

      const res = await axiosInstance.get('/category-rca', { params });
      if (res.data?.tree) {
        setApiTreeData(res.data.tree);
      }
    } catch (err) {
      console.error('[RCATree] API fetch failed:', err.message);
      setApiError(err.message || 'Failed to load RCA data');
    } finally {
      setLoading(false);
    }
  }, [
    context.platform,
    context.category,
    context.brand,
    context.sku,
    context.timeStart,
    context.timeEnd,
    context.compareStart,
    context.compareEnd,
    context.compareOn
  ]);

  useEffect(() => {
    const timer = setTimeout(fetchRcaData, 300);
    return () => clearTimeout(timer);
  }, [fetchRcaData]);

  // Use API data if available, otherwise fall back to hardcoded.
  // FORCE hardcoded data for Amazon/Flipkart as requested.
  const currentTreeData = useMemo(
    () => {
      const isMarketplace = context.platform?.toLowerCase() === 'amazon' || context.platform?.toLowerCase() === 'flipkart';
      if (isMarketplace) return getDynamicRcaTreeData(context);
      return apiTreeData || getDynamicRcaTreeData(context);
    },
    [apiTreeData, context]
  );

  const index = useMemo(() => buildIndex(currentTreeData), [currentTreeData]);
  const focusId = selectedNodeId || hoveredNodeId;

  const focusSet = useMemo(() => {
    if (!focusId) return null;
    const a = collectAncestors(focusId, index.parent);
    const d = collectDescendants(focusId, index.children);
    return new Set([focusId, ...a, ...d]);
  }, [focusId, index]);

  const onToggleNode = useCallback((id) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCardClick = useCallback(
    (data) => {
      setSelectedNode(data);
      setSelectedNodeId(data.id);
      setDetailOpen(true);
      const node = reactFlowInstance?.getNode?.(data.id);
      if (node) {
        reactFlowInstance.fitView?.({ nodes: [node], padding: 0.35, duration: 320 });
      }
    },
    [reactFlowInstance]
  );

  const onHover = useCallback((id) => setHoveredNodeId(id), []);

  const { nodes: computedNodes, edges: computedEdges } = useMemo(() => {
    const isFlipkartAmazon = context.platform?.toLowerCase() === "flipkart" || context.platform?.toLowerCase() === "amazon";
    const initialGap = isFlipkartAmazon ? 80 : 180;
    const results = { nodes: [], edges: [] };
    const rootHeight = computeSubtreeHeight(currentTreeData, collapsedNodes, initialGap);
    layoutTreeNodes(currentTreeData, 0, -rootHeight / 2, collapsedNodes, results, onViewTrends, context.platform);

    const nodesList = results.nodes.map((n) => {
      const isFocused = focusSet ? focusSet.has(n.id) : true;
      const isNearTop = n.position.y < -150;

      return {
        ...n,
        zIndex: (hoveredNodeId === n.id || selectedNodeId === n.id) ? 1000000 : 100,
        data: {
          ...n.data,
          onToggle: () => onToggleNode(n.id),
          onClickDetail: handleCardClick,
          onHover,
          isSelected: selectedNodeId === n.id,
          isDimmed: false,
          popupPosition: isNearTop ? "bottom" : "top",
          hoveredNodeId: hoveredNodeId, // Pass global state to individual node
        },
        style: { ...n.style },
      };
    });

    // KEY FIX: Sort nodes so that hovered or selected nodes come LAST in the array.
    // In React Flow, nodes later in the array are rendered on top of previous ones.
    const sortedNodes = [...nodesList].sort((a, b) => {
      if (a.id === hoveredNodeId || a.id === selectedNodeId) return 1;
      if (b.id === hoveredNodeId || b.id === selectedNodeId) return -1;
      return 0;
    });

    const edges = results.edges.map((e) => {
      return {
        ...e,
        animated: false,
        zoomable: false,
        style: {
          ...(e.style || {}),
          stroke: "rgba(10, 15, 28, 0.8)", // Constant solid stroke
          strokeWidth: 3.5,
          strokeDasharray: "0", // Always solid
          pointerEvents: "none",
          transition: "stroke 0.3s ease",
        },
        markerEnd: {
          ...(e.markerEnd || {}),
          color: "rgba(15, 23, 42, 0.6)",
          width: 18,
          height: 18,
        },
      };
    });

    return { nodes: sortedNodes, edges };
  }, [currentTreeData, collapsedNodes, onToggleNode, handleCardClick, selectedNodeId, focusSet, onHover, hoveredNodeId, context.platform]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  useEffect(() => {
    // Automatically fit the tree to the screen on load
    reactFlowInstance.fitView({ padding: 0.15, duration: 800 });

    const t = setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
    }, 100);
    return () => clearTimeout(t);
  }, [reactFlowInstance, currentTreeData]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", cursor: "none" }}>
      <CoolGreyBackground />
      <MagicCursor />

      {loading && (
        <Box sx={{
          position: "absolute", inset: 0, zIndex: 50,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          bgcolor: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", gap: 3
        }}>
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <Activity size={40} color="#6366f1" strokeWidth={2.5} />
          </motion.div>
          <Typography sx={{ fontSize: "13px", fontWeight: 800, color: "#6366f1", letterSpacing: "1.5px", textTransform: "uppercase" }}>
            Loading Intelligence Graph...
          </Typography>
          <Box sx={{ display: "flex", gap: 3, mt: 2 }}>
            {[160, 200, 180].map((w, i) => (
              <motion.div key={i} animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                style={{ width: w, height: 110, borderRadius: 24, backgroundColor: "#e2e8f0", border: "2px solid #cbd5e1" }} />
            ))}
          </Box>
        </Box>
      )}

      {!loading && apiError && !apiTreeData && (
        <Box sx={{
          position: "absolute", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)"
        }}>
          <ErrorRetryOverlay onRetry={fetchRcaData} message={apiError} />
        </Box>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{ animated: false, type: "step" }}
        elevateNodesOnSelect={true}
      >
        <Controls
          position="bottom-left"
          showInteractive={false}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            borderRadius: "16px",
            overflow: "hidden",
            border: "1px solid rgba(15, 23, 42, 0.1)",
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            padding: '4px',
            left: '20px',
            bottom: '20px'
          }}
        />
      </ReactFlow>

      <NodeDetailPopup
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          reactFlowInstance.fitView({ padding: 0.22, duration: 350 });
        }}
        nodeData={selectedNode}
        selectedBrand={context.brand}
        selectedPlatform={context.platform}
      />
    </div>
  );
};

export default function RCATree({ context, title, onViewTrends }) {
  return (
    <ReactFlowProvider>
      <RcaTreeInner context={context} title={title} onViewTrends={onViewTrends} />
    </ReactFlowProvider>
  );
}
