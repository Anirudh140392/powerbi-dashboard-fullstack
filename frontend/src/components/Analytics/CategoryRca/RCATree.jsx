import React, { useState, useCallback, useMemo, useEffect } from "react";
import dayjs from "dayjs";
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
  CircularProgress
} from "@mui/material";

// --- Layout & Typography Tokens ---
const CARD_WIDTH = 380;
const CARD_HEIGHT = 280; // Estimated height for vertical centering
const VERTICAL_GAP = 80;
const HORIZONTAL_STEP = 480;

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

// --- Core Utility Helpers (Global) ---
const getSeedFromStr = (str) => {
  let h = 0xdeadbeef;
  for (let i = 0; i < (str || "").length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
  }
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const formatValue = (val, kpiLabel) => {
  if (val === null || val === undefined || isNaN(parseFloat(val))) return "0.0";
  const num = parseFloat(val);
  const absVal = Math.abs(num);
  const l = (kpiLabel || "").toLowerCase();

  // Offtake / Revenue logic
  if (l.includes("offtake")) {
    if (absVal >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
    if (absVal >= 100000) return `₹ ${(num / 100000).toFixed(2)} lac`;
    return `₹ ${num.toLocaleString()}`;
  }

  // Impressions / Rating Count logic (but NOT keyword labels)
  if ((l.includes("impressions") || l.includes("rating")) && !l.includes("keyword")) {
    if (absVal >= 100000) return `${(num / 100000).toFixed(1)} lac`;
    if (absVal >= 1000) return `${(num / 1000).toFixed(1)} K`;
    return num.toLocaleString();
  }

  // Pricing logic
  if (l.includes("price") || l.includes("ppu") || l === "asp") return `₹ ${num.toFixed(2)}`;

  // Keyword SOS logic — values are percentages (0-100 range)
  if (l.includes("keyword")) {
    return `${num.toFixed(2)}%`;
  }

  // Percent / Conversion logic
  if (l.includes("%") || l.includes("conv") || l.includes("rate") || l.includes("cvr")) return `${num.toFixed(1)}%`;

  // Default fallback
  return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
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

/**
 * SLEEK MINI PREVIEW (Hover)
 */
/**
 * DETAILED METRICS POPUP (Hover)
 * Shows Brand Identity table with a '+' button to drill down into Modal.
 */
const HoverMetricsPopup = ({ kpiLabel, category, metrics, keywordMetrics, platform, selectedBrand, selectedSku, selectedCategory, position = "top", onDrillDown, nodeValue }) => {
  const isBottom = position === "bottom";
  const [activeTab, setActiveTab] = useState("gainers");

  // Show a clean "Coming Soon" placeholder for nodes without real data
  const isComingSoon = nodeValue && (String(nodeValue).includes('Coming Soon') || String(nodeValue).includes('--'));
  if (isComingSoon) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: isBottom ? -20 : 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: isBottom ? -20 : 20 }}
        style={{
          position: "absolute",
          ...(isBottom ? { top: "calc(100% + 40px)" } : { bottom: "calc(100% + 40px)" }),
          left: "50%", transform: "translateX(-50%)",
          width: "480px", backgroundColor: "#fff", borderRadius: "32px",
          padding: "0", zIndex: 100001, pointerEvents: "auto",
          boxShadow: "0 40px 100px -20px rgba(15,23,42,0.35), 0 0 60px rgba(99,102,241,0.2)",
          border: "1px solid rgba(0,0,0,0.1)", overflow: "hidden"
        }}
      >
        <Box sx={{ p: 5, textAlign: 'center' }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(99,102,241,0.15)'
            }}>
              <Zap size={28} color="#6366f1" />
            </Box>
          </Box>
          <Typography sx={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', mb: 1, letterSpacing: '-0.5px' }}>
            {kpiLabel}
          </Typography>
          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Coming Soon
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#cbd5e1', mt: 1.5 }}>
            Brand-level analytics for this metric will be available shortly.
          </Typography>
        </Box>
      </motion.div>
    );
  }

  // Decide which entity level to show based on sidebar selection
  const isBrandFilterActive = selectedBrand && selectedBrand !== "All Brands";
  const isSkuFilterActive = selectedSku && selectedSku !== "All SKUs";
  const l = (kpiLabel || "").toLowerCase();
  const isKeywordKpi = l.includes("impression") || l.includes("conversion") || l.includes("conv") || l.includes("keyword");

  // If SKU is selected, breakdown is City. If Brand is selected, breakdown is SKU. Otherwise Brand.
  let entityType = isSkuFilterActive ? "City" : isBrandFilterActive ? "SKU" : "Brand";

  // Dedicated keyword breakdown branches (Branded Keyword, Generic Keyword, etc) pass keywordMetrics
  if (isBrandFilterActive && keywordMetrics && keywordMetrics.length > 0) {
    entityType = "Keyword";
  }

  // Use real metrics if available (backend now provides appropriate level in metrics array)
  let entities = [];
  if (entityType === "Keyword" && keywordMetrics && keywordMetrics.length > 0) {
    entities = keywordMetrics.map(m => m.keyword).slice(0, 12);
  } else if (metrics && metrics.length > 0) {
    entities = metrics.map(m => m.brand || m.label || m.Product).filter(Boolean).slice(0, 12);
  } else {
    // Fallback to mock data if no real metrics
    const brandPrefix = selectedBrand && selectedBrand !== "All Brands" ? selectedBrand : "Brand";

    if (entityType === "City" || entityType === "Location") {
      entities = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow", "Surat", "Kanpur"];
    } else if (entityType === "Keyword") {
      entities = [`Best ${brandPrefix}`, `${brandPrefix} reviews`, `Buy ${brandPrefix}`, `${brandPrefix} discount`, `${brandPrefix} deals`, `${brandPrefix} near me`, `${brandPrefix} price`, `Top ${brandPrefix}`];
    } else if (entityType === "SKU") {
      entities = [`${brandPrefix} 100g Pack`, `${brandPrefix} 250g Box`, `${brandPrefix} Single Bar`, `${brandPrefix} Multipack`, `${brandPrefix} Value Pack`, `${brandPrefix} Twin Pack`, `${brandPrefix} Family Pack`];
    } else {
      entities = ["Snickers", "Galaxy", "Twix", "Orbit", "Bounty", "Boomer", "Mars", "Skittles", "Doublemint", "M&M's", "Hubba Bubba", "Extra"];
    }
  }

  const allRows = entities.map((name, i) => {
    const seed = getSeedFromStr(`${category}-${kpiLabel}-${name}-${i}`);

    let curVal, delta;
    if (isKeywordKpi) {
      // Range -2.5% to +2.5% for conversion changes
      curVal = 5 + seed * 10;
      delta = (seed * 5) - 2.5;
    } else if (l.includes("discount") || l.includes("disc")) {
      // Logical Mars discount range: 5% to 25%
      curVal = 5 + seed * 20;
      delta = (seed * 10) - 5;
    } else {
      curVal = 70 + seed * 80;
      delta = (seed * 12) - 5;
    }

    let prevVal = curVal / (1 + delta / 100);

    // Override with REAL data if available (supports Brand, SKU, and City levels)
    if (metrics && metrics.length > 0) {
      const match = metrics.find(m => m.brand === name);
      if (match) {
        if (l === "ad impressions" || l === "ad gvs") {
          curVal = match.rawAd || 0;
          prevVal = match.rawPrevAd || 0;
          delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
        } else if (l === "impressions" || l === "indexed-impressions" || l === "gvs" || l.includes("gv")) {
          curVal = match.rawGv !== undefined ? match.rawGv : match.rawImpressions || 0;
          prevVal = match.rawPrevGv !== undefined ? match.rawPrevGv : match.rawPrevImpressions || 0;
          delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
        } else if (l === "organic impressions") {
          curVal = match.rawOrganic || 0;
          prevVal = match.rawPrevOrganic || 0;
          delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
        } else if (l.includes("offtake")) {
          curVal = match.rawOfftake || 0;
          prevVal = match.rawPrevOfftake || 0;
          delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
        } else if (l.includes("price") || l.includes("asp")) {
          curVal = match.rawPrice || 0;
          prevVal = match.rawPrevPrice || 0;
          delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
        } else if (l.includes("osa")) {
          // Wt. OSA % — use rawOsa (neno/deno ratio)
          curVal = match.rawOsa || 0;
          prevVal = match.rawPrevOsa || 0;
          delta = (curVal - prevVal); // OSA % variance in absolute points
        } else if (l.includes("listing")) {
          curVal = match.rawListing || 0;
          prevVal = match.rawPrevListing || 0;
          delta = (curVal - prevVal); // Listing % variance in absolute points
        } else if (l.includes("comp keyword")) {
          if (category === "organic") {
            curVal = match.rawOrgCompSos || 0;
            prevVal = match.rawPrevOrgCompSos || 0;
          } else {
            curVal = match.rawAdCompSos || 0;
            prevVal = match.rawPrevAdCompSos || 0;
          }
          delta = (curVal - prevVal);
        } else if (l.includes("branded keyword")) {
          if (category === "organic") {
            curVal = match.rawOrgBrandedSos || 0;
            prevVal = match.rawPrevOrgBrandedSos || 0;
          } else {
            curVal = match.rawAdBrandedSos || 0;
            prevVal = match.rawPrevAdBrandedSos || 0;
          }
          delta = (curVal - prevVal);
        } else if (l.includes("generic keyword")) {
          if (category === "organic") {
            curVal = match.rawOrgGenericSos || 0;
            prevVal = match.rawPrevOrgGenericSos || 0;
          } else {
            curVal = match.rawAdGenericSos || 0;
            prevVal = match.rawPrevAdGenericSos || 0;
          }
          delta = (curVal - prevVal);
        } else if (l === "inorganic cvr") {
          curVal = match.rawInorganicCvr || 0;
          prevVal = match.rawPrevInorganicCvr || 0;
          delta = (curVal - prevVal); // CVR variance usually absolute points
        } else if (l === "organic cvr") {
          curVal = match.rawOrganicCvr !== undefined ? match.rawOrganicCvr : 0;
          prevVal = match.rawPrevOrganicCvr !== undefined ? match.rawPrevOrganicCvr : 0;
          delta = (curVal - prevVal); // CVR variance usually absolute points
        } else if (l === "conversion" || l === "indexed-cvr" || l === "cvr" || l.includes("cvr")) {
          curVal = match.rawCvr || 0;
          prevVal = match.rawPrevCvr || 0;
          delta = (curVal - prevVal); // CVR variance usually absolute points
        } else if (l.includes("discount") || l.includes("disc")) {
          curVal = match.rawDiscount || 0;
          prevVal = match.rawPrevDiscount || 0;
          delta = (curVal - prevVal); // Discount % variance usually absolute points
        } else if (l === "share of search overall" || l.includes("sos") || l === "sov-overall") {
          curVal = match.rawSos || 0;
          prevVal = match.rawPrevSos || 0;
          delta = (curVal - prevVal); // SOS % variance usually absolute points
        } else if (l.includes("rating")) {
          // Rating Count — use rawRating (qty)
          curVal = match.rawRating || 0;
          prevVal = match.rawPrevRating || 0;
          delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
        } else if (l === "sp") {
          curVal = match.rawSp || 0;
          prevVal = match.rawPrevSp || 0;
          delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
        } else if (l === "sb") {
          curVal = match.rawSb || 0;
          prevVal = match.rawPrevSb || 0;
          delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
        }
      }
    }

    // Override with REAL data for Keywords
    if (isKeywordKpi && isBrandFilterActive && keywordMetrics && keywordMetrics.length > 0 && entityType === "Keyword") {
      const match = keywordMetrics.find(m => m.keyword === name);
      if (match) {
        return {
          name,
          current: match.current,
          prev: match.previous,
          change: match.rawChange || 0,
          changeStr: match.change,
          rawCurrent: match.rawCurrent || 0,
          pos: match.isPositive
        };
      }
    }

    return {
      name,
      current: formatValue(curVal, kpiLabel),
      prev: formatValue(prevVal, kpiLabel),
      change: delta,
      changeStr: (delta >= 0 ? "+" : "") + delta.toFixed(1) + "%",
      rawCurrent: curVal,
      pos: delta >= 0
    };
  });

  // Filter: Gainers = only positive (green), Drainers = only negative (red)
  const filteredRows = allRows.filter(r => activeTab === "gainers" ? r.change > 0 : r.change < 0);
  
  // Sort descending by highest value (rawCurrent) instead of variance
  const sortedRows = [...filteredRows].sort((a, b) => b.rawCurrent - a.rawCurrent);
  
  const displayRows = sortedRows.slice(0, 5);

  const canDrillDown = entityType === "Brand" || (entityType === "SKU");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: isBottom ? -20 : 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: isBottom ? -20 : 20 }}
      style={{
        position: "absolute",
        ...(isBottom ? { top: "calc(100% + 40px)" } : { bottom: "calc(100% + 40px)" }),
        left: "50%", transform: "translateX(-50%)",
        width: "1500px", backgroundColor: "#fff", borderRadius: "64px",
        padding: "0", zIndex: 100001, pointerEvents: "auto",
        boxShadow: "0 100px 200px -40px rgba(15,23,42,0.5), 0 0 120px rgba(99,102,241,0.35)",
        border: "1px solid rgba(0,0,0,0.2)", overflow: "hidden"
      }}
    >
      <Box sx={{ p: 7, bgcolor: "#f8fafc", borderBottom: "1px solid #edf2f7", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: "38px", fontWeight: 1000, color: "#0f172a", textTransform: "uppercase", letterSpacing: "5px" }}>
            {entityType} Analysis: {category === "ad" ? "Ad " : category === "organic" ? "Organic " : ""}{kpiLabel} {l.includes("keyword") ? "SOS" : ""}
          </Typography>
          <Typography sx={{ fontSize: "20px", fontWeight: 700, color: "#64748b", mt: 2, textTransform: "uppercase", letterSpacing: "3px" }}>
            Flagship {entityType} Performance comparison matrix
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', bgcolor: "#f1f5f9", p: 2, borderRadius: "28px", gap: 2.5 }}>
          {["gainers", "drainers"].map(t => (
            <Box key={t} onClick={(e) => { e.stopPropagation(); setActiveTab(t); }}
              sx={{
                px: 6, py: 2, borderRadius: "22px", cursor: 'pointer', transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                bgcolor: activeTab === t ? (t === 'gainers' ? "#059669" : "#dc2626") : "transparent",
                color: activeTab === t ? "#fff" : "#64748b", fontWeight: 1000, fontSize: "18px", textTransform: 'uppercase',
                boxShadow: activeTab === t ? "0 20px 45px rgba(0,0,0,0.3)" : "none",
                transform: activeTab === t ? "scale(1.12)" : "scale(1)"
              }}>
              {t}
            </Box>
          ))}
        </Box>
      </Box>
      <Box sx={{ p: 0 }}>
        <Table size="large" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "rgba(241, 245, 249, 1.0)", "& th": { py: 5 } }}>
              <TableCell align="left" sx={{ width: '25%', fontSize: "28px", fontWeight: 900, color: "#0f172a", textTransform: "uppercase", pl: 9, whiteSpace: 'nowrap' }}>{entityType} Name</TableCell>
              <TableCell align="left" sx={{ width: '25%', fontSize: "28px", fontWeight: 900, color: "#0f172a", textTransform: "uppercase", whiteSpace: 'nowrap' }}>Current Period</TableCell>
              <TableCell align="left" sx={{ width: '30%', fontSize: "28px", fontWeight: 900, color: "#0f172a", textTransform: "uppercase", whiteSpace: 'nowrap' }}>Comparison Period</TableCell>
              <TableCell align="left" sx={{ width: '20%', fontSize: "28px", fontWeight: 900, color: "#0f172a", textTransform: "uppercase", pr: 11, whiteSpace: 'nowrap' }}>Variance %</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayRows.map((r, i) => (
              <TableRow key={i} sx={{ "&:hover": { bgcolor: "rgba(99,102,241,0.08)" }, borderBottom: i === displayRows.length - 1 ? "none" : "1px solid #f1f5f9", height: "155px" }}>
                <TableCell align="left" sx={{ py: 0, pl: 9 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {canDrillDown && (
                      <Box onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDrillDown(r.name); }}
                        sx={{
                          width: 54, height: 54, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          bgcolor: "rgba(99,102,241,0.2)", color: "#6366f1", cursor: "pointer",
                          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                          "&:hover": { bgcolor: "#6366f1", color: "#fff", transform: "scale(1.3) rotate(180deg)", boxShadow: "0 0 40px rgba(99,102,241,0.7)" }
                        }}>
                        <Plus size={28} strokeWidth={4} />
                      </Box>
                    )}
                    {!canDrillDown && <Box sx={{ width: 54 }} />}
                    <Typography sx={{ fontSize: "34px", fontWeight: 500, color: "#1e293b", letterSpacing: "1px" }}>{r.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell align="left" sx={{ fontSize: "30px", fontWeight: 900, color: "#0f172a" }}>{r.current}</TableCell>
                <TableCell align="left" sx={{ fontSize: "30px", fontWeight: 700, color: "#94a3b8" }}>{r.prev}</TableCell>
                <TableCell align="left" sx={{ py: 0, pr: 11 }}>
                  <Typography sx={{
                    fontSize: "26px",
                    fontWeight: 1000,
                    color: r.pos ? "#059669" : "#dc2626",
                    bgcolor: r.pos ? "rgba(5, 150, 105, 0.2)" : "rgba(220, 38, 38, 0.2)",
                    px: 5, py: 2, borderRadius: "22px", display: "inline-block",
                    border: `4px solid ${r.pos ? "rgba(5, 150, 105, 0.35)" : "rgba(220, 38, 38, 0.35)"}`
                  }}>
                    {r.changeStr}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ p: 5, textAlign: "center", bgcolor: "#f8fafc", borderTop: "5px solid #edf2f7" }}>
        <Typography sx={{ fontSize: "22px", fontWeight: 800, color: "#94a3b8", letterSpacing: "2.5px", textTransform: 'uppercase' }}>
          Ultra-Precision Driver Diagnostics • {canDrillDown ? "Use [+] for Deep Entity Trace" : "Absolute Ground Level Analysis"}
        </Typography>
      </Box>
    </motion.div>
  );
};

/**
 * PREMIUM FULL MODAL (Click)
 */
const KpiDetailModal = ({ open, onClose, kpiLabel, category, platform, selectedBrand, selectedSku, selectedCategory, focusedEntity, context }) => {
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState("gainers");
  const [expandedBrand, setExpandedBrand] = useState(null);
  const [expandedSku, setExpandedSku] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState({}); // { brandName: { skuRows }, skuName: { cityRows } }
  const rowsPerPage = 6;

  useEffect(() => {
    if (open) {
      if (focusedEntity) {
        const isBrandFilterActive = selectedBrand && selectedBrand !== "All Brands" && selectedBrand !== "All";
        if (isBrandFilterActive) {
          setExpandedBrand(selectedBrand);
          setExpandedSku(focusedEntity);
        } else {
          setExpandedBrand(focusedEntity);
          setExpandedSku(null);
        }
      } else {
        setExpandedBrand(null);
        setExpandedSku(null);
      }
      setPage(0);
    }
  }, [open, selectedBrand, activeTab, focusedEntity]);

  const handleDownload = () => {
    const allData = generateRows("", "brand", 20); // Get more brands
    let csv = `Entity,Value,Current Period,Comparison Period,Change\n`;
    allData.forEach(b => {
      csv += `${b.name},${b.currentStr},${b.currentStr},${b.prevStr},${b.change}\n`;
      const skus = generateRows(b.name, isKeywordDrillDown ? "sku" : "sku", 10);
      skus.forEach(s => {
        csv += `  - ${s.name},${s.currentStr},${s.currentStr},${s.prevStr},${s.change}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Diagnostic_Trace_${kpiLabel.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.csv`;
    a.click();
  };

  const isQCPlatform = ["blinkit", "zepto", "instamart"].includes((platform || "").toLowerCase());
  const platformLower = (platform || '').toLowerCase();
  const channelLower = (context?.channel || '').toLowerCase();
  const isEcom = channelLower.includes('e-commerce') || channelLower.includes('ecom') || platformLower === 'amazon' || platformLower === 'flipkart';
  
  const isKeywordScopedKpi = (kpiLabel || "").toLowerCase().includes("impression") || (kpiLabel || "").toLowerCase().includes("conversion") || (kpiLabel || "").toLowerCase().includes("keyword");
  const isEcomSos = isEcom && ((kpiLabel || "").toLowerCase().includes("search") || (kpiLabel || "").toLowerCase().includes("sos") || (kpiLabel || "").toLowerCase().includes("visibility"));
  const kpiLabelLower = (kpiLabel || "").toLowerCase();
  const isEcomPm = isEcom && (kpiLabelLower === "sp" || kpiLabelLower === "sb" || kpiLabelLower.includes("ad gvs") || kpiLabelLower.includes("ad impressions") || kpiLabelLower.includes("inorganic cvr"));
  const hasSpecificBrand = selectedBrand && selectedBrand !== "All" && selectedBrand !== "All Brands";
  const isKeywordDrillDown = (isQCPlatform && isKeywordScopedKpi) || isEcomSos || isEcomPm;

  const fetchRows = useCallback(async (level = "brand", parentId = null, isInitialLoad = false) => {
    try {
      if (level === "brand" || isInitialLoad) setLoading(true);
      const params = {
        platform,
        categoryVal: category, // This is "organic" / "ad"
        category: context?.category || context?.categoryVal || 'All', // This is product category e.g. "GMFC"
        kpiCategory: kpiLabel,
        drilldownLevel: level,
        drilldownId: parentId,
        activeTab,
        brand: selectedBrand || 'All',
        sku: selectedSku || 'All',
        brandScope: selectedBrand || 'All',
      };
      // Tell backend what kind of parent the drilldownId refers to
      if ((level === 'location' || level === 'keyword') && hasSpecificBrand && !parentId) {
        params.drilldownId = selectedBrand;
        params.drilldownParentLevel = 'brand';
      } else if (level === 'location' && parentId) {
        // When expanding sub-row (SKU -> location), parentId is SKU
        params.drilldownParentLevel = 'sku';
      }
      // Date Range Support from context
      if (context?.timeStart) params.startDate = context.timeStart.format('YYYY-MM-DD');
      if (context?.timeEnd) params.endDate = context.timeEnd.format('YYYY-MM-DD');
      if (context?.compareOn && context?.compareStart) {
        params.compareStartDate = context.compareStart.format('YYYY-MM-DD');
        params.compareEndDate = context.compareEnd.format('YYYY-MM-DD');
      }

      console.log("[KpiDetailModal] fetching", params);
      const endpoint = isEcom ? '/ecom-rca' : '/category-rca';
      const res = await axiosInstance.get(endpoint, { params });
      const data = res.data?.rows || [];

      if (level === "brand" || isInitialLoad) {
        // For initial load (whether brand-level or sku-level), set as main rows
        setRows(data);
      } else {
        // For subsequent drilldowns (expand within table), set as drilldown data
        setDrilldownData(prev => ({
          ...prev,
          [parentId]: data
        }));
      }
    } catch (err) {
      console.error(`[KpiDetailModal] Fetch failed for ${level}:`, err);
    } finally {
      if (level === "brand" || isInitialLoad) setLoading(false);
    }
  }, [platform, category, kpiLabel, activeTab, context, selectedBrand, selectedSku, hasSpecificBrand]);

  useEffect(() => {
    if (open) {
      setPage(0);
      setRows([]);
      setDrilldownData({});
      setExpandedBrand(null);
      setExpandedSku(null);

      if (hasSpecificBrand) {
        fetchRows(isKeywordDrillDown ? "keyword" : "location", focusedEntity || null, true);
      } else {
        fetchRows("brand", null, true);
      }
    }
  }, [open, fetchRows, hasSpecificBrand, selectedBrand, isKeywordDrillDown, focusedEntity]);

  const allRows = rows;
  const topRows = allRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const headerColumn = hasSpecificBrand ? (isKeywordDrillDown ? "Keyword" : "Location") : "Brand Identity";

  const thStyle = { color: "#64748b", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", py: 1.5 };
  const tdStyle = { color: "#0f172a", fontSize: "15px", fontWeight: 600, py: 1.8 };
  const tdMuted = { ...tdStyle, color: "#64748b", fontWeight: 500 };

  const renderExpandBtn = (isExpanded, onClick) => (
    <Box onClick={(e) => { e.stopPropagation(); onClick(); }}
      sx={{
        width: 26, height: 26, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center",
        bgcolor: isExpanded ? "#6366f1" : "rgba(99,102,241,0.12)", color: isExpanded ? "#fff" : "#6366f1",
        cursor: "pointer", transition: "all 0.2s", "&:hover": { bgcolor: isExpanded ? "#4f46e5" : "rgba(99,102,241,0.2)" },
        boxShadow: isExpanded ? "0 4px 12px rgba(99,102,241,0.3)" : "none"
      }}>
      {isExpanded ? <Minus size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { borderRadius: "20px", overflow: "hidden", boxShadow: "0 40px 80px -15px rgba(0,0,0,0.3)" } }}>
      <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: "#fafafa", borderBottom: "1px solid #eee" }}>
        <Box>
          <Typography sx={{ fontSize: "22px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "#0f172a" }}>
            {category === "ad" ? "Ad " : category === "organic" ? "Organic " : ""}{kpiLabel.toUpperCase()} {kpiLabel.toLowerCase().includes("keyword") ? "SOS " : ""}DIAGNOSTIC TRACE
          </Typography>
          <Typography sx={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.5px" }}>
            PRO INTELLIGENCE • DEEP-DIVE RCA MODULE • {platform?.toUpperCase() || "OMNI"}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Tooltip title="Download Complete Trace CSV">
            <IconButton onClick={handleDownload} sx={{ bgcolor: "rgba(99,102,241,0.06)", color: "#6366f1", "&:hover": { bgcolor: "rgba(99,102,241,0.12)" } }}>
              <Download size={18} strokeWidth={2.5} />
            </IconButton>
          </Tooltip>
          <Box sx={{ display: 'flex', bgcolor: "#f1f5f9", p: 0.5, borderRadius: "10px" }}>
            {["gainers", "drainers"].map(t => (
              <Box key={t} onClick={() => { setActiveTab(t); setPage(0); }}
                sx={{
                  px: 2, py: 0.75, borderRadius: "8px", cursor: 'pointer', transition: 'all 0.2s',
                  bgcolor: activeTab === t ? (t === 'gainers' ? "#059669" : "#dc2626") : "transparent",
                  color: activeTab === t ? "#fff" : "#64748b", fontWeight: 700, fontSize: "12px", textTransform: 'uppercase'
                }}>
                {t === 'gainers' ? 'Gainers' : 'Drainers'}
              </Box>
            ))}
          </Box>
          <IconButton onClick={onClose} sx={{ bgcolor: "#eee", "&:hover": { bgcolor: "#ddd" } }}><Plus style={{ transform: 'rotate(45deg)' }} /></IconButton>
        </Box>
      </Box>
      <DialogContent sx={{ p: 0, maxHeight: "70vh", overflowY: "auto", scrollBehavior: "smooth" }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...thStyle, pl: 5 }}>{headerColumn}</TableCell>
              <TableCell sx={thStyle}>Current Period</TableCell>
              <TableCell sx={thStyle}>Comparison Period</TableCell>
              <TableCell sx={thStyle}>Change</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 10 }}><CircularProgress /></TableCell></TableRow>
            ) : topRows.map((row, idx) => {
              const isLocationLevel = hasSpecificBrand && !isKeywordDrillDown;
              const isExpanded = hasSpecificBrand ? expandedSku === row.name : expandedBrand === row.name;
              const subRows = drilldownData[row.name] || [];

              const onToggle = () => {
                if (hasSpecificBrand) {
                  const newExpanded = expandedSku === row.name ? null : row.name;
                  setExpandedSku(newExpanded);
                  if (newExpanded && !drilldownData[newExpanded]) fetchRows("location", newExpanded);
                } else {
                  const newExpanded = expandedBrand === row.name ? null : row.name;
                  setExpandedBrand(newExpanded);
                  if (newExpanded && !drilldownData[newExpanded]) fetchRows(isKeywordDrillDown ? "keyword" : "sku", newExpanded);
                }
              };

              return (
                <React.Fragment key={idx}>
                  <TableRow sx={{ "&:hover": { bgcolor: "rgba(0,0,0,0.01)" } }}>
                    <TableCell sx={{ ...tdStyle, pl: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {!isLocationLevel && renderExpandBtn(isExpanded, onToggle)}
                        {isLocationLevel && <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#6366f1", ml: 1.25, mr: 0.75 }} />}
                        <Typography sx={{ ...tdStyle, fontSize: "15px", p: 0 }}>{row.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={tdStyle}>{formatValue(row.currentVal, kpiLabel)}</TableCell>
                    <TableCell sx={tdMuted}>{formatValue(row.prevVal, kpiLabel)}</TableCell>
                    <TableCell>
                      <Typography sx={{
                        color: row.change.startsWith("-") ? "#dc2626" : "#059669", fontWeight: 700,
                        bgcolor: row.change.startsWith("-") ? "rgba(220,38,38,0.06)" : "rgba(5,150,105,0.06)",
                        px: 1.5, py: 0.5, borderRadius: "8px", display: "inline-block", fontSize: "14px"
                      }}>
                        {row.change}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  {isExpanded && subRows.map((sr, sIdx) => {
                    const subExpanded = expandedSku === sr.name;
                    const cityRows = drilldownData[sr.name] || [];
                    const onToggleSub = () => {
                      const newExp = subExpanded ? null : sr.name;
                      setExpandedSku(newExp);
                      if (newExp && !drilldownData[newExp]) fetchRows("location", newExp);
                    };

                    return (
                      <React.Fragment key={`sub-${sIdx}`}>
                        <TableRow sx={{ bgcolor: "rgba(99,102,241,0.05)" }}>
                          <TableCell sx={{ ...tdStyle, pl: 7 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              {!hasSpecificBrand && renderExpandBtn(subExpanded, onToggleSub)}
                              {hasSpecificBrand && <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#6366f1", ml: 1.25, mr: 0.75 }} />}
                              <Typography sx={{ ...tdStyle, fontSize: "14px", p: 0 }}>{sr.name}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={tdStyle}>{formatValue(sr.currentVal, kpiLabel)}</TableCell>
                          <TableCell sx={tdMuted}>{formatValue(sr.prevVal, kpiLabel)}</TableCell>
                          <TableCell>
                            <Typography sx={{
                              color: sr.change.startsWith("-") ? "#dc2626" : "#059669", fontWeight: 700,
                              bgcolor: sr.change.startsWith("-") ? "rgba(220,38,38,0.06)" : "rgba(5,150,105,0.06)",
                              px: 1.5, py: 0.5, borderRadius: "8px", display: "inline-block", fontSize: "14px"
                            }}>
                              {sr.change}
                            </Typography>
                          </TableCell>
                        </TableRow>
                        {subExpanded && cityRows.map((cr, cIdx) => (
                          <TableRow key={`city-${cIdx}`} sx={{ bgcolor: "rgba(99,102,241,0.03)" }}>
                            <TableCell sx={{ ...tdStyle, pl: 11 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#6366f1", ml: 1.25, mr: 0.75 }} />
                                <Typography sx={{ ...tdStyle, fontSize: "13px", p: 0 }}>{cr.name}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={tdStyle}>{formatValue(cr.currentVal, kpiLabel)}</TableCell>
                            <TableCell sx={tdMuted}>{formatValue(cr.prevVal, kpiLabel)}</TableCell>
                            <TableCell>
                              <Typography sx={{
                                color: cr.change.startsWith("-") ? "#dc2626" : "#059669", fontWeight: 700,
                                bgcolor: cr.change.startsWith("-") ? "rgba(220,38,38,0.06)" : "rgba(5,150,105,0.06)",
                                px: 1.5, py: 0.5, borderRadius: "8px", display: "inline-block", fontSize: "14px"
                              }}>
                                {cr.change}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </DialogContent>
      <TablePagination
        rowsPerPageOptions={[]}
        component="div"
        count={allRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(e, p) => setPage(p)}
        sx={{
          bgcolor: "#fafafa", borderTop: "1px solid #eee",
          "& .MuiTablePagination-toolbar": { minHeight: "48px" },
          "& .MuiTypography-root": { fontWeight: 800, fontSize: "12px", color: "#64748b" }
        }}
      />
    </Dialog>
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

const DeltaBadge = ({ change, isPositive }) => {
  const displayChange = typeof change === 'string' ? change.replace(/^[+-]\s*/, '') : change;
  
  return (
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
    {isPositive ? "+" : "-"} {displayChange}
  </Box>
  );
};

// --- Custom KPI Node ---
const KpiNode = ({ data }) => {
  const {
    label,
    value,
    prevValue,
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
    keywordMetrics,
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
            kpiLabel={label}
            category={data.category}
            metrics={data.metrics}
            keywordMetrics={data.keywordMetrics}
            platform={data.platform || ""}
            selectedBrand={data.selectedBrand || ""}
            selectedSku={data.selectedSku || ""}
            selectedCategory={data.selectedCategory || ""}
            position={data.popupPosition}
            nodeValue={data.value}
            onDrillDown={(entityToFocus) => {
              onClickDetail({ ...data, focusedEntity: entityToFocus });
            }}
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

      <Box sx={{ p: "16px 20px" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.8 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "10px", color: TYPO.secondary, fontWeight: TYPO.weightHeavy, textTransform: "uppercase", mb: 0.8, letterSpacing: "0.5px" }}>Current</Typography>
            <Typography sx={{ fontSize: "24px", color: TYPO.primary, fontWeight: TYPO.weightHeavy, lineHeight: 1 }}>{value}</Typography>
          </Box>
          <Box sx={{ width: "1px", height: "35px", bgcolor: TYPO.border, mx: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "10px", color: TYPO.secondary, fontWeight: TYPO.weightHeavy, textTransform: "uppercase", mb: 0.8, letterSpacing: "0.5px" }}>Previous</Typography>
            <Typography sx={{ fontSize: "18px", color: TYPO.secondary, fontWeight: TYPO.weightBold, lineHeight: 1 }}>{prevValue || "—"}</Typography>
          </Box>
          <Box sx={{ width: "1px", height: "35px", bgcolor: TYPO.border, mx: 2 }} />
          <Box sx={{ flex: 1, textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <Typography sx={{ fontSize: "10px", color: TYPO.secondary, fontWeight: TYPO.weightHeavy, textTransform: "uppercase", mb: 0.8, letterSpacing: "0.5px" }}>Variance %</Typography>
            <Box sx={{ mt: "2px" }}><DeltaBadge change={change} isPositive={isPositive} /></Box>
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
// (using global getSeedFromStr)

const getDynamicRcaTreeData = (context) => {
  const { platform, channel, category: categoryVal, brand, sku, month } = context;

  const isEcom = channel?.toLowerCase().includes("e-commerce") || channel?.toLowerCase().includes("ecom") || platform?.toLowerCase() === "amazon" || platform?.toLowerCase() === "flipkart";

  // Seed for overall consistency - now including month
  const seed = getSeedFromStr(`${platform}-${brand}-${sku}-${categoryVal || "All"}-${month || "All"}`);

  // Base Multipliers to differentiate entities SIGNIFICANTLY
  const getEntityBase = (name, range = 0.5, offset = 1.0) => {
    const s = getSeedFromStr(name || "All");
    return (offset - range / 2) + (s * range);
  };

  const platformMult = getEntityBase(platform, 1.5);
  const brandMult = getEntityBase(brand, 2.0);
  const catMult = getEntityBase(categoryVal, 1.0);

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
    if (val >= 1) return `₹ ${val.toFixed(1)} Lacs`;
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

  // --- E-COMMERCE SPECIFIC TREE (DYNAMIC) ---
  if (isEcom) {
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
            value: formatLac(1.9 * finalVolume * getEntityBase(categoryVal + "org", 0.6)),
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

const layoutTreeNodes = (node, x, y, collapsedNodes, results, onViewTrends, platform = "", selectedBrand = "", selectedSku = "", selectedCategory = "", currentPeriodLabel = "", comparePeriodLabel = "") => {
  const isCollapsed = collapsedNodes.has(node.id);
  const subtreeHeight = computeSubtreeHeight(node, collapsedNodes);

  results.nodes.push({
    id: node.id,
    type: "kpi",
    position: { x, y: y + subtreeHeight / 2 - CARD_HEIGHT / 2 },
    data: {
      ...node,
      platform,
      selectedBrand,
      selectedSku,
      selectedCategory,
      currentPeriodLabel,
      comparePeriodLabel,
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

      layoutTreeNodes(child, x + HORIZONTAL_STEP, currentChildY, collapsedNodes, results, onViewTrends, platform, selectedBrand, selectedSku, selectedCategory, currentPeriodLabel, comparePeriodLabel);
      currentChildY += childHeight + VERTICAL_GAP;
    });
  }
};

// --- Detail Popup (Updated with Brand Filtering, Download, and Pagination) ---
const NodeDetailPopup = () => null;
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

  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [selectedKpiModalData, setSelectedKpiModalData] = useState(null);

  const handleKpiClick = useCallback((data) => {
    setSelectedKpiModalData({
      label: data.label,
      category: data.category,
      platform: data.platform,
      selectedBrand: data.brand || context.brand,
      selectedSku: data.sku || context.sku,
      selectedCategory: data.categoryVal || context.category,
      focusedEntity: data.focusedEntity,
      context: context // Pass current filters/dates
    });
    setKpiModalOpen(true);
  }, [context]);

  // Fetch RCA tree data from backend
  const fetchRcaData = useCallback(async () => {
    // For ecom platforms (Amazon, Flipkart), use the hardcoded ecom tree instead of QC backend
    const platformLower = (context.platform || '').toLowerCase();
    const channelLower = (context.channel || '').toLowerCase();
    const isEcom = channelLower.includes('e-commerce') || channelLower.includes('ecom') || platformLower === 'amazon' || platformLower === 'flipkart';

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

      if (isEcom) {
        try {
          const res = await axiosInstance.get('/ecom-rca', { params });
          if (res.data?.tree) {
            setApiTreeData(res.data.tree);
          } else {
            setApiTreeData(null);
          }
        } catch (err) {
          console.warn('[RCATree] E-com API failed, using fallback:', err.message);
          setApiTreeData(null);
        }
        setLoading(false);
        return;
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
    context.channel,
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
  const currentTreeData = useMemo(
    () => {
      if (apiTreeData) return apiTreeData;
      return getDynamicRcaTreeData(context);
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
    const isEcom = context.channel?.toLowerCase().includes("e-commerce") || context.channel?.toLowerCase().includes("ecom") || context.platform?.toLowerCase() === "amazon" || context.platform?.toLowerCase() === "flipkart";
    const initialGap = isEcom ? 80 : 180;
    const results = { nodes: [], edges: [] };
    const rootHeight = computeSubtreeHeight(currentTreeData, collapsedNodes, initialGap);

    const fmtDate = (d) => d ? dayjs(d).format("D MMM'YY") : null;
    const curP = (context.timeStart && context.timeEnd) ? `${fmtDate(context.timeStart)} - ${fmtDate(context.timeEnd)}` : "Current Period";
    const comP = (context.compareStart && context.compareEnd) ? `${fmtDate(context.compareStart)} - ${fmtDate(context.compareEnd)}` : "Compare Period";

    layoutTreeNodes(currentTreeData, 0, -rootHeight / 2, collapsedNodes, results, onViewTrends, context.platform, context.brand, context.sku, context.category, curP, comP);

    const nodesList = results.nodes.map((n) => {
      return {
        ...n,
        zIndex: (hoveredNodeId === n.id) ? 1000000 : 100,
        data: {
          ...n.data,
          onToggle: () => onToggleNode(n.id),
          onClickDetail: (clickData) => handleKpiClick({ ...n.data, id: n.id, brand: context.brand, categoryVal: context.category, ...(clickData?.focusedEntity ? { focusedEntity: clickData.focusedEntity } : {}) }),
          onHover,
          hoveredNodeId: hoveredNodeId,
          popupPosition: n.position.y < -150 ? "bottom" : "top",
        }
      };
    });

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
          stroke: "rgba(10, 15, 28, 0.8)",
          strokeWidth: 3.5,
          strokeDasharray: "0",
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
  }, [currentTreeData, collapsedNodes, onToggleNode, handleCardClick, handleKpiClick, selectedNodeId, focusSet, onHover, hoveredNodeId, context.platform, context.brand, context.sku, context.category, context.channel, context.timeStart, context.timeEnd, context.compareStart, context.compareEnd, onViewTrends]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  useEffect(() => {
    reactFlowInstance.fitView({ padding: 0.15, duration: 800 });
    const t = setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
    }, 100);
    return () => clearTimeout(t);
  }, [reactFlowInstance, currentTreeData]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <CoolGreyBackground />
      <MagicCursor />

      {loading && (
        <Box sx={{
          position: "absolute", inset: 0, zIndex: 100,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          bgcolor: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", gap: 3
        }}>
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <Activity size={40} color="#6366f1" strokeWidth={2.5} />
          </motion.div>
          <Typography sx={{ fontSize: "13px", fontWeight: 800, color: "#6366f1", letterSpacing: "1.5px", textTransform: "uppercase" }}>
            Loading Intelligence Graph...
          </Typography>
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

      {selectedKpiModalData && (
        <KpiDetailModal
          open={kpiModalOpen}
          onClose={() => setKpiModalOpen(false)}
          kpiLabel={selectedKpiModalData.label}
          category={selectedKpiModalData.category}
          platform={selectedKpiModalData.platform}
          selectedBrand={selectedKpiModalData.selectedBrand}
          selectedSku={selectedKpiModalData.selectedSku}
          selectedCategory={selectedKpiModalData.selectedCategory}
          focusedEntity={selectedKpiModalData.focusedEntity}
          context={selectedKpiModalData.context}
        />
      )}

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
