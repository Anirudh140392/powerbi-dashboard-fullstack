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
import { Plus, Minus, Activity, Zap, LineChart } from "lucide-react";
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
} from "@mui/material";

// --- Layout & Typography Tokens ---
const CARD_WIDTH = 380;
const CARD_HEIGHT = 220; // Estimated height for vertical centering
const VERTICAL_GAP = 50;
const HORIZONTAL_STEP = 520;

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
  offtake: "#0f172a",
  price: "#3b82f6",
  impressions: "#6366f1",
  availability: "#10b981",
  organic: "#8b5cf6",
  ad: "#06b6d4",
  discounting: "#f59e0b",
  segment: "#64748b",
  rating: "#f43f5e",
  conversion: "#10b981",
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
      backgroundColor: "#8b5cf6",
      color: "white",
      padding: "8px 18px",
      borderRadius: "16px",
      fontSize: "12px",
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

// --- Dark Hover Intelligence Popup (Table View) ---
// --- Dark Hover Intelligence Popup (Unified) ---
const HoverMetricsPopup = ({ metrics, position = "top", isOrganic = false, kpiLabel = "KPI", category = "" }) => {
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

  // Restoration of the Previous Black Card (Brand Intelligence)
  const displayMetrics = metrics || [];

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

  const metricKey = getMetricKey(kpiLabel, category);
  const deltaKey = `delta${metricKey.charAt(0).toUpperCase() + metricKey.slice(1)}`;

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
        borderRadius: "28px",
        border: baseBorder,
        overflow: "visible",
        fontFamily: '"Outfit","Inter",sans-serif',
        cursor: "pointer",
        position: "relative",
        boxShadow: baseShadow,
        zIndex: localHover && !isDimmed ? 1000 : 1, // Elevate hovered node to the top of the stacking context
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

  // --- AMAZON SPECIFIC TREE ---
  if (platform?.toLowerCase() === "amazon") {
    const rootChange = getChange("root");
    return {
      id: "root",
      label: "Offtake",
      value: getVal(5.0 * 100), // Amazon usually has higher scale
      change: rootChange.val,
      isPositive: rootChange.isPos,
      category: "offtake",
      importance: "outcome",
      insight: rootChange.isPos ? "Portfolio Growth" : "Market Pressure",
      metrics: [
        { brand: 'Snickers', asp: '₹66.6', discount: '7.1%', ppu: '₹122.3', deltaAsp: '-₹1.4', deltaDisc: '6.7%', deltaPpu: '-₹7.5' },
        { brand: 'Galaxy', asp: '₹101.1', discount: '9.8%', ppu: '₹183.5', deltaAsp: '-₹8.4', deltaDisc: '8.5%', deltaPpu: '-₹1.8' },
        { brand: 'Bounty', asp: '₹119.7', discount: '11.7%', ppu: '₹144.3', deltaAsp: '-₹9.8', deltaDisc: '9.7%', deltaPpu: '-₹14.7' },
        { brand: 'Twix', asp: '₹117.9', discount: '5.0%', ppu: '₹175.1', deltaAsp: '-₹2.8', deltaDisc: '4.4%', deltaPpu: '-₹7' },
        { brand: 'Mars', asp: '₹92.8', discount: '4.1%', ppu: '₹182.1', deltaAsp: '-₹2.1', deltaDisc: '3.8%', deltaPpu: '-₹4.1' },
      ],
      children: [
        {
          id: "gvs",
          label: "GVs",
          value: formatLac(133.1 * finalVolume),
          change: getChange("gvs").val,
          isPositive: getChange("gvs").isPos,
          category: "impressions",
          importance: "primary",
          metrics: [
            { brand: 'Snickers', asp: '₹64.2', discount: '8.4%', ppu: '₹118.5', deltaAsp: '+₹2.1', deltaDisc: '7.8%', deltaPpu: '+₹4.2' },
            { brand: 'Galaxy', asp: '₹98.5', discount: '10.2%', ppu: '₹179.2', deltaAsp: '-₹1.5', deltaDisc: '9.1%', deltaPpu: '-₹2.3' },
          ],
          meta: [{ label: "GV Share", value: "100.0%", change: "0.00", isPositive: true }],
          children: [
            {
              id: "organic-gvs",
              label: "Organic GVs",
              value: formatLac(73.3 * finalVolume),
              change: getChange("org_gv").val,
              isPositive: getChange("org_gv").isPos,
              category: "organic",
              metrics: { discount: "8.1%", ppu: "₹ 245", asp: "₹ 210" },
              meta: [
                { label: "Organic Share of Search", value: getVal(45.5, true, "osas", 10) },
                { label: "Organic GV%", value: getVal(55.0, true, "ogvp", 10) }
              ]
            },
            {
              id: "ad-gvs",
              label: "Ad GVs",
              value: formatLac(59.8 * finalVolume),
              change: getChange("ad_gv").val,
              isPositive: getChange("ad_gv").isPos,
              category: "ad",
              meta: [
                { label: "Sp. Share of Search", value: getVal(64.8, true, "ssos", 10) },
                { label: "AD Driven GV%", value: getVal(44.9, true, "adgv", 10) },
                { label: "AD Spend", value: `₹ ${(3.0 * finalVolume).toFixed(1)}M` },
                { label: "Total ROAS", value: (3.2 * (0.8 + seed * 0.4)).toFixed(2) }
              ],
              children: [
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
                  value: formatLac(46.8 * finalVolume),
                  change: getChange("sps").val,
                  isPositive: getChange("sps").isPos,
                  category: "ad",
                  meta: [{ label: "Search GVs", value: formatLac(46.8 * finalVolume) }, { label: "Conversion", value: "23.19%" }],
                  children: [
                    {
                      id: "sp",
                      label: "Sponsored Product",
                      value: formatLac(35.5 * finalVolume),
                      change: getChange("sp").val,
                      isPositive: getChange("sp").isPos,
                      category: "ad",
                      meta: [
                        { label: "SP GVs", value: formatLac(35.5 * finalVolume) },
                        { label: "Conversion", value: getVal(26.6, true, "spc", 5) },
                        { label: "SP ROAS", value: "3.56" },
                        { label: "SP SPEND", value: "2.62M" }
                      ]
                    },
                    {
                      id: "sb",
                      label: "Sponsored Brand",
                      value: formatLac(4.3 * finalVolume),
                      change: getChange("sb").val,
                      isPositive: getChange("sb").isPos,
                      category: "ad",
                      meta: [
                        { label: "SB All GVs", value: formatLac(4.3 * finalVolume) },
                        { label: "Conversion", value: "17.56%" },
                        { label: "SB ROAS", value: "0.42" },
                        { label: "SB SPEND", value: "264.49K" }
                      ]
                    },
                    {
                      id: "sd",
                      label: "Sponsored Display",
                      value: formatLac(6.9 * finalVolume),
                      change: getChange("sd").val,
                      isPositive: getChange("sd").isPos,
                      category: "ad",
                      meta: [
                        { label: "SD GVs", value: formatLac(6.9 * finalVolume) },
                        { label: "Conversion", value: "9.00%" },
                        { label: "SD ROAS", value: "1.64" },
                        { label: "SD SPEND", value: "112.06K" }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              id: "sov-overall",
              label: "SOV Overall",
              value: "15.66%",
              change: "0.0%",
              isPositive: true,
              category: "impressions",
              meta: [{ label: "SOV", value: "15.66%" }]
            }
          ]
        },
        {
          id: "cvr",
          label: "CVR",
          value: getVal(39.5, true, "cvr_main", 10),
          change: getChange("cvr").val,
          isPositive: getChange("cvr").isPos,
          category: "conversion",
          importance: "primary",
          children: [
            {
              id: "availability",
              label: "Availability",
              value: getVal(77.9, true, "avail", 10),
              change: getChange("ava").val,
              isPositive: getChange("ava").isPos,
              category: "availability",
              children: [
                {
                  id: "buybox",
                  label: "BuyBox%",
                  value: getVal(58.3, true, "bbox", 15),
                  change: getChange("bbx").val,
                  isPositive: getChange("bbx").isPos,
                  category: "availability"
                },
                {
                  id: "seller-listing",
                  label: "Seller Listing%",
                  value: getVal(56.7, true, "slst", 15),
                  change: getChange("sls").val,
                  isPositive: getChange("sls").isPos,
                  category: "availability"
                }
              ]
            },
            {
              id: "delivery-time",
              label: "Delivery Time",
              value: "1.5 Days",
              change: getChange("del").val,
              isPositive: getChange("del").isPos,
              category: "segment",
              meta: [{ label: "Delivery Time", value: "1.5 Days" }]
            },
            {
              id: "discounting",
              label: "Discounting%",
              value: getVal(9.8, true, "disc", 5),
              change: getChange("dsc").val,
              isPositive: getChange("dsc").isPos,
              category: "discounting"
            },
            {
              id: "organic-cvr",
              label: "Organic CVR",
              value: getVal(58.9, true, "ocvr", 10),
              change: getChange("ocvr").val,
              isPositive: getChange("ocvr").isPos,
              category: "organic"
            },
            {
              id: "inorganic-cvr",
              label: "Inorganic CVR",
              value: getVal(26.6, true, "icvr", 10),
              change: getChange("icvr").val,
              isPositive: getChange("icvr").isPos,
              category: "ad"
            },
            {
              id: "delivery-slots", // Same day, 1 day, etc
              label: "Delivery Slots",
              value: "Analysis",
              category: "segment",
              children: [
                { id: "same-day", label: "Same Day GVs%", value: "11.29%", category: "segment" },
                { id: "one-day", label: "1 Day GVs%", value: "0.00%", category: "segment" },
                { id: "two-day", label: "2 Day GVs%", value: "69.56%", category: "segment" },
                { id: "greater-two", label: "> 2 Days GVs%", value: "19.14%", category: "segment" }
              ]
            }
          ]
        },
        {
          id: "asp",
          label: "PRICE",
          value: `₹ ${(742.0 * getEntityBase(skuId + brandId, 0.4)).toFixed(2)}`,
          change: getChange("asp").val,
          isPositive: getChange("asp").isPos,
          category: "price",
          importance: "primary",
          children: [
            { id: "combo-sales", label: "Combo Sales%", value: "44.16%", category: "segment" },
            { id: "large-sales", label: "Large Sales%", value: "61.72%", category: "segment" },
            { id: "premium-sales", label: "Premium Sales%", value: "26.34%", category: "segment" }
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
      { brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%', organic: '12.2 lac', deltaOrganic: '1.1 lac', ad: '7.2 lac', deltaAd: '-0.2 lac', orgBranded: '8.4 lac', deltaOrgBranded: '0.8 lac', orgGeneric: '3.8 lac', deltaOrgGeneric: '0.3 lac', adBranded: '4.1 lac', deltaAdBranded: '-0.1 lac', adComp: '3.1 lac', deltaAdComp: '-0.1 lac', rating: '11.4 lac', deltaRating: '0.5 lac', listing: '85.5%', deltaListing: '1.2%' },
      { brand: 'Galaxy', offtake: '₹101.1 lac', price: '₹101.1', discount: '9.8%', ppu: '₹183.5', impressions: '13.7 lac', conversion: '6.3%', deltaOfftake: '-₹8.4 lac', deltaPrice: '-₹8.4', deltaDiscount: '1.3%', deltaPpu: '-₹1.8', deltaImpressions: '-4.7 K', deltaConversion: '-0.5%', organic: '8.5 lac', deltaOrganic: '-0.2 lac', ad: '5.2 lac', deltaAd: '-4.7 K', orgBranded: '5.1 lac', deltaOrgBranded: '-0.1 lac', orgGeneric: '3.4 lac', deltaOrgGeneric: '-0.1 lac', adBranded: '2.5 lac', deltaAdBranded: '-1.2 K', adComp: '2.7 lac', deltaAdComp: '-3.5 K' },
      { brand: 'Bounty', offtake: '₹119.7 lac', price: '₹119.7', discount: '11.7%', ppu: '₹144.3', impressions: '4.1 lac', conversion: '7.0%', deltaOfftake: '-₹9.8 lac', deltaPrice: '-₹9.8', deltaDiscount: '2.0%', deltaPpu: '-₹14.7', deltaImpressions: '25.9 K', deltaConversion: '-0.4%', organic: '2.8 lac', deltaOrganic: '15.2 K', ad: '1.3 lac', deltaAd: '10.7 K', orgBranded: '1.5 lac', deltaOrgBranded: '8.4 K', orgGeneric: '1.3 lac', deltaOrgGeneric: '6.8 K', adBranded: '0.7 lac', deltaAdBranded: '4.2 K', adComp: '0.6 lac', deltaAdComp: '6.5 K' },
      { brand: 'Twix', offtake: '₹117.9 lac', price: '₹117.9', discount: '5.0%', ppu: '₹175.1', impressions: '30.2 K', conversion: '12.7%', deltaOfftake: '-₹2.8 lac', deltaPrice: '-₹2.8', deltaDiscount: '0.6%', deltaPpu: '-₹7', deltaImpressions: '1.2 K', deltaConversion: '0.8%', organic: '22.4 K', deltaOrganic: '0.8 K', ad: '7.8 K', deltaAd: '0.4 K', orgBranded: '13.1 K', deltaOrgBranded: '0.5 K', orgGeneric: '9.3 K', deltaOrgGeneric: '0.3 K', adBranded: '4.2 K', deltaAdBranded: '0.2 K', adComp: '3.6 K', deltaAdComp: '0.2 K' },
      { brand: 'Mars', offtake: '₹92.8 lac', price: '₹92.8', discount: '4.1%', ppu: '₹182.1', impressions: '10.5 K', conversion: '8.5%', deltaOfftake: '-₹2.1 lac', deltaPrice: '-₹2.1', deltaDiscount: '0.3%', deltaPpu: '-4.1', deltaImpressions: '-0.5 K', deltaConversion: '-0.3%', organic: '6.4 K', deltaOrganic: '-0.2 K', ad: '4.1 K', deltaAd: '-0.3 K', orgBranded: '3.2 K', deltaOrgBranded: '-0.1 K', orgGeneric: '3.2 K', deltaOrgGeneric: '-0.1 K', adBranded: '2.1 K', deltaAdBranded: '-0.2 K', adComp: '2.0 K', deltaAdComp: '-0.1 K' },
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
          { brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%', organic: '12.2 lac', deltaOrganic: '1.1 lac', ad: '7.2 lac', deltaAd: '-0.2 lac', orgBranded: '8.4 lac', deltaOrgBranded: '0.8 lac', orgGeneric: '3.8 lac', deltaOrgGeneric: '0.3 lac', adBranded: '4.1 lac', deltaAdBranded: '-0.1 lac', adComp: '3.1 lac', deltaAdComp: '-0.1 lac', rating: '11.4 lac', deltaRating: '0.5 lac', listing: '85.5%', deltaListing: '1.2%' },
          { brand: 'Galaxy', offtake: '₹101.1 lac', price: '₹101.1', discount: '9.8%', ppu: '₹183.5', impressions: '13.7 lac', conversion: '6.3%', deltaOfftake: '-₹8.4 lac', deltaPrice: '-₹8.4', deltaDiscount: '1.3%', deltaPpu: '-₹1.8', deltaImpressions: '-4.7 K', deltaConversion: '-0.5%' },
          { brand: 'Bounty', offtake: '₹119.7 lac', price: '₹119.7', discount: '11.7%', ppu: '₹144.3', impressions: '4.1 lac', conversion: '7.0%', deltaOfftake: '-₹9.8 lac', deltaPrice: '-₹9.8', deltaDiscount: '2.0%', deltaPpu: '-₹14.7', deltaImpressions: '25.9 K', deltaConversion: '-0.4%' },
          { brand: 'Twix', offtake: '₹117.9 lac', price: '₹117.9', discount: '5.0%', ppu: '₹175.1', impressions: '30.2 K', conversion: '12.7%', deltaOfftake: '-₹2.8 lac', deltaPrice: '-₹2.8', deltaDiscount: '0.6%', deltaPpu: '-₹7', deltaImpressions: '1.2 K', deltaConversion: '0.8%' },
          { brand: 'Mars', offtake: '₹92.8 lac', price: '₹92.8', discount: '4.1%', ppu: '₹182.1', impressions: '10.5 K', conversion: '8.5%', deltaOfftake: '-₹2.1 lac', deltaPrice: '-₹2.1', deltaDiscount: '0.3%', deltaPpu: '-₹4.1', deltaImpressions: '-0.5 K', deltaConversion: '-0.3%' },
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
          { brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%', organic: '12.2 lac', deltaOrganic: '1.1 lac', ad: '7.2 lac', deltaAd: '-0.2 lac', orgBranded: '8.4 lac', deltaOrgBranded: '0.8 lac', orgGeneric: '3.8 lac', deltaOrgGeneric: '0.3 lac', adBranded: '4.1 lac', deltaAdBranded: '-0.1 lac', adComp: '3.1 lac', deltaAdComp: '-0.1 lac', rating: '11.4 lac', deltaRating: '0.5 lac', listing: '85.5%', deltaListing: '1.2%' },
          { brand: 'Galaxy', offtake: '₹101.1 lac', price: '₹101.1', discount: '9.8%', ppu: '₹183.5', impressions: '13.7 lac', conversion: '6.3%', deltaOfftake: '-₹8.4 lac', deltaPrice: '-₹8.4', deltaDiscount: '1.3%', deltaPpu: '-₹1.8', deltaImpressions: '-4.7 K', deltaConversion: '-0.5%' },
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
              { brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%', organic: '12.2 lac', deltaOrganic: '1.1 lac', ad: '7.2 lac', deltaAd: '-0.2 lac', orgBranded: '8.4 lac', deltaOrgBranded: '0.8 lac', orgGeneric: '3.8 lac', deltaOrgGeneric: '0.3 lac', adBranded: '4.1 lac', deltaAdBranded: '-0.1 lac', adComp: '3.1 lac', deltaAdComp: '-0.1 lac', rating: '11.4 lac', deltaRating: '0.5 lac', listing: '85.5%', deltaListing: '1.2%' },
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
                  { brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%', organic: '12.2 lac', deltaOrganic: '1.1 lac', ad: '7.2 lac', deltaAd: '-0.2 lac', orgBranded: '8.4 lac', deltaOrgBranded: '0.8 lac', orgGeneric: '3.8 lac', deltaOrgGeneric: '0.3 lac', adBranded: '4.1 lac', deltaAdBranded: '-0.1 lac', adComp: '3.1 lac', deltaAdComp: '-0.1 lac', rating: '11.4 lac', deltaRating: '0.5 lac', listing: '85.5%', deltaListing: '1.2%' },
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
              { brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%', organic: '12.2 lac', deltaOrganic: '1.1 lac', ad: '7.2 lac', deltaAd: '-0.2 lac', orgBranded: '8.4 lac', deltaOrgBranded: '0.8 lac', orgGeneric: '3.8 lac', deltaOrgGeneric: '0.3 lac', adBranded: '4.1 lac', deltaAdBranded: '-0.1 lac', adComp: '3.1 lac', deltaAdComp: '-0.1 lac', rating: '11.4 lac', deltaRating: '0.5 lac', listing: '85.5%', deltaListing: '1.2%' },
            ],
            meta: [{ label: "Organic SOS", value: getVal(8.5, true, seed + "orgsos", 15), change: getChange("meta4").val, isPositive: getChange("meta4").isPos }],
            children: [
              { id: "org-generic", label: "Generic Keywords", value: formatLac(1.1 * finalVolume * getEntityBase("gen", 0.4)), change: getChange("gen").val, isPositive: getChange("gen").isPos, category: "organic", metrics: [{ brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%' }] },
              { id: "org-branded", label: "Branded Keywords", value: formatLac(0.694 * finalVolume * getEntityBase("brand_kw", 0.4)), change: getChange("brand_kw").val, isPositive: getChange("brand_kw").isPos, category: "organic", metrics: [{ brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%' }] },
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
          { brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%', organic: '12.2 lac', deltaOrganic: '1.1 lac', ad: '7.2 lac', deltaAd: '-0.2 lac', orgBranded: '8.4 lac', deltaOrgBranded: '0.8 lac', orgGeneric: '3.8 lac', deltaOrgGeneric: '0.3 lac', adBranded: '4.1 lac', deltaAdBranded: '-0.1 lac', adComp: '3.1 lac', deltaAdComp: '-0.1 lac', rating: '11.4 lac', deltaRating: '0.5 lac', listing: '85.5%', deltaListing: '1.2%' },
        ],
        children: [
          {
            id: "ad-impressions",
            label: "Ad Impressions",
            value: formatLac(1.5 * finalVolume * getEntityBase(brand + "ad", 0.9)),
            change: adChange.val,
            isPositive: adChange.isPos,
            category: "ad",
            metrics: [
              { brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%', organic: '12.2 lac', deltaOrganic: '1.1 lac', ad: '7.2 lac', deltaAd: '-0.2 lac', orgBranded: '8.4 lac', deltaOrgBranded: '0.8 lac', orgGeneric: '3.8 lac', deltaOrgGeneric: '0.3 lac', adBranded: '4.1 lac', deltaAdBranded: '-0.1 lac', adComp: '3.1 lac', deltaAdComp: '-0.1 lac', rating: '11.4 lac', deltaRating: '0.5 lac', listing: '85.5%', deltaListing: '1.2%' },
            ],
            meta: [{ label: "Ad SOS", value: getVal(4.5, true, seed + "adsos", 10), change: getChange("meta5").val, isPositive: getChange("meta5").isPos }],
            children: [
              { id: "ad-branded", label: "Branded Keywords", value: formatLac(0.516 * finalVolume * getEntityBase("adb", 0.5)), change: getChange("adb").val, isPositive: getChange("adb").isPos, category: "ad", metrics: [{ brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%' }] },
              { id: "ad-comp", label: "Comp Keywords", value: formatLac(0.305 * finalVolume * getEntityBase("adc", 0.5)), change: getChange("adc").val, isPositive: getChange("adc").isPos, category: "ad", metrics: [{ brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%' }] },
            ],
          },
          { id: "discounting", label: "Wt. Disc %", value: getVal(18.5, true, seed + "disc", 30), change: getChange("meta6").val, isPositive: getChange("meta6").isPos, category: "discounting", metrics: [{ brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%' }] },
          { id: "rating-count", label: "Rating Count", value: formatLac(1.8 * finalVolume * getEntityBase("rat", 0.7)), change: getChange("meta7").val, isPositive: getChange("meta7").isPos, category: "rating", metrics: [{ brand: 'Snickers', offtake: '₹66.6 lac', price: '₹66.6', discount: '7.1%', ppu: '₹122.3', impressions: '19.4 lac', conversion: '7.0%', deltaOfftake: '-₹1.4 lac', deltaPrice: '-₹1.4', deltaDiscount: '0.4%', deltaPpu: '-₹7.5', deltaImpressions: '-2.1 lac', deltaConversion: '-0.3%' }] },
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

const layoutTreeNodes = (node, x, y, collapsedNodes, results, onViewTrends) => {
  const isCollapsed = collapsedNodes.has(node.id);
  const subtreeHeight = computeSubtreeHeight(node, collapsedNodes);

  results.nodes.push({
    id: node.id,
    type: "kpi",
    position: { x, y: y + subtreeHeight / 2 - CARD_HEIGHT / 2 },
    data: {
      ...node,
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

      layoutTreeNodes(child, x + HORIZONTAL_STEP, currentChildY, collapsedNodes, results, onViewTrends);
      currentChildY += childHeight + VERTICAL_GAP;
    });
  }
};

// --- Detail Popup (unchanged except kept) ---
const NodeDetailPopup = ({ open, onClose, nodeData }) => {
  if (!nodeData) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "40px",
          bgcolor: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(30px) saturate(170%)",
          border: "1px solid rgba(255, 255, 255, 0.7)",
          boxShadow: "0 50px 100px -20px rgba(0, 0, 0, 0.3)",
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
            <Typography sx={{ fontSize: "22px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.8px" }}>
              {nodeData.label} Intelligence
            </Typography>
            <Typography sx={{ fontSize: "11px", fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "1.2px" }}>
              High Precision Diagnostic Stream
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ bgcolor: "rgba(0,0,0,0.05)", color: "#0f172a", width: 44, height: 44, "&:hover": { bgcolor: "rgba(0,0,0,0.1)" } }}>
          <Plus style={{ transform: "rotate(45deg)" }} size={28} />
        </IconButton>
      </DialogTitle>

      <Divider sx={{ opacity: 0.08 }} />

      <DialogContent sx={{ p: 5 }}>
        <Grid container spacing={6}>
          <Grid item xs={6}>
            <Typography sx={{ fontSize: "11px", fontWeight: 900, color: "#64748b", textTransform: "uppercase", mb: 2, letterSpacing: "1.5px" }}>
              Metric Magnitude
            </Typography>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <Typography sx={{ fontSize: "48px", fontWeight: 900, color: "#0f172a", lineHeight: 1, letterSpacing: "-2px" }}>
                {nodeData.value}
              </Typography>
              <DeltaBadge change={nodeData.change} isPositive={nodeData.isPositive} />
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ p: 3, bgcolor: "rgba(99, 102, 241, 0.08)", borderRadius: "24px", border: "1px solid rgba(99, 102, 241, 0.15)", mb: 4 }}>
              <Typography sx={{ fontSize: "12px", fontWeight: 900, color: "#4f46e5", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 1.2, letterSpacing: "1px" }}>
                <Zap size={16} fill="#4f46e5" /> Predictive Insight
              </Typography>
              <Typography sx={{ fontSize: "15px", fontWeight: 800, color: "#1e293b", mt: 1.5, lineHeight: 1.6 }}>
                Automated root cause detected: Deviation in {nodeData.label} suggests a {nodeData.isPositive ? "positive" : "negative"} trend across channels.
              </Typography>
            </Box>

            <Typography sx={{ fontSize: "13px", fontWeight: 900, color: "#0f172a", mb: 3, textTransform: "uppercase", letterSpacing: "1.2px" }}>
              Structural Attributes
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
              {nodeData.meta?.map((m, i) => (
                <Paper
                  key={i}
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: "24px",
                    bgcolor: "rgba(255,255,255,0.5)",
                    border: "1px solid rgba(0,0,0,0.05)",
                    transition: "all 0.3s ease",
                    "&:hover": { transform: "translateY(-5px)", bgcolor: "#fff" },
                  }}
                >
                  <Typography sx={{ fontSize: "10px", fontWeight: 900, color: "#64748b", textTransform: "uppercase", mb: 1, letterSpacing: "0.5px" }}>
                    {m.label}
                  </Typography>
                  <Typography sx={{ fontSize: "20px", fontWeight: 900, color: "#1e293b", letterSpacing: "-0.5px" }}>{m.value}</Typography>
                  {m.change && (
                    <Typography sx={{ fontSize: "11px", fontWeight: 900, color: m.isPositive ? "#0d9488" : "#e11d48", mt: 1 }}>
                      {m.isPositive ? "↑" : "↓"} {m.change} WoW Momentum
                    </Typography>
                  )}
                </Paper>
              ))}
            </Box>
          </Grid>
        </Grid>
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
      if (context.month) params.month = context.month;

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
  }, [context.platform, context.category, context.brand, context.sku, context.month]);

  useEffect(() => {
    const timer = setTimeout(fetchRcaData, 300);
    return () => clearTimeout(timer);
  }, [fetchRcaData]);

  // Use API data if available, otherwise fall back to hardcoded
  const currentTreeData = useMemo(
    () => apiTreeData || getDynamicRcaTreeData(context),
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
    const results = { nodes: [], edges: [] };
    const rootHeight = computeSubtreeHeight(currentTreeData, collapsedNodes);
    layoutTreeNodes(currentTreeData, 0, -rootHeight / 2, collapsedNodes, results, onViewTrends);

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
  }, [currentTreeData, collapsedNodes, onToggleNode, handleCardClick, selectedNodeId, focusSet, onHover, hoveredNodeId]);

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
