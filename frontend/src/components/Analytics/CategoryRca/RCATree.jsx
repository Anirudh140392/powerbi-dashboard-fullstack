import React, { useState, useCallback, useMemo, useEffect } from "react";
import dayjs from "dayjs";

console.log('[RCATree] component file loaded. Version: 1.0.3 (Dynamic Data Fix)');

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
const CARD_WIDTH = 340;
const CARD_HEIGHT = 240; // Increased to 240 to prevent overlap for nodes with meta rows
const HORIZONTAL_GAP = 20;
const VERTICAL_STEP = 450;

// LR Layout Constants
const LR_X_STEP = 450;
const LR_Y_GAP = 30; // Increased to 30 for better vertical separation

const COMING_SOON_IDS = [
  'sb', 'dsp', 'organic-gvs', 'seller-listing', 
  'delivery-time', 'same-day', 'one-day', 'two-day', 'greater-two', 
  'combo-sales', 'large-sales', 'premium-sales',
  'sns', 'loyalty', 'new-cust'
];

const TYPO = {
  primary: "#0f172a",
  secondary: "#475569",
  border: "#e2e8f0",
  labelSize: "16px",
  valueSize: "24px",
  metaSize: "14px",
  minSize: "12px",
  footerSize: "14px",
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

  // Offtake / Revenue / Spend logic (Currency)
  if (l.includes("offtake") || l.includes("spend")) {
    if (absVal >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
    if (absVal >= 100000) return `₹ ${(num / 100000).toFixed(2)} lac`;
    return `₹ ${num.toLocaleString()}`;
  }

  // Volume / Count logic (GVs, Impressions) without currency
  if ((l.includes("impressions") || l.includes("gvs") || l.includes("ad gv") || l.includes("sd gv")) && !l.includes("keyword")) {
    if (absVal >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
    if (absVal >= 100000) return `${(num / 100000).toFixed(2)} lac`;
    if (absVal >= 1000) return `${(num / 1000).toFixed(1)} K`;
    return num.toLocaleString();
  }

  // Pricing logic
  if (l.includes("price") || l.includes("ppu")) return `₹ ${num.toFixed(2)}`;

  // Keyword SOS logic — values are percentages (0-100 range)
  if (l.includes("keyword")) {
    return `${num.toFixed(2)}%`;
  }

  // Percent / Conversion logic
  if (l.includes("%") || l.includes("conv") || l.includes("rate") || l.includes("sov") || l.includes("cvr") || l === "conversion" || l === "cvr") return `${num.toFixed(1)}%`;
  if (l.includes("roas")) return num.toFixed(2);

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
const HoverMetricsPopup = ({ id, kpiLabel, category, metrics, keywordMetrics, platform, selectedBrand, selectedSku, selectedCategory, position = "top", onDrillDown, prefetchedRows }) => {
  const isComingSoon = COMING_SOON_IDS.includes(id);
  const isBottom = position === "bottom";
  const [activeTab, setActiveTab] = useState("gainers");

  // Decide which entity level to show based on sidebar selection
  const isBrandFilterActive = selectedBrand && selectedBrand !== "All Brands" && selectedBrand !== "All";
  const isSkuFilterActive = selectedSku && selectedSku !== "All SKUs" && selectedSku !== "All";
  const l = (kpiLabel || "").toLowerCase();
  const isKeywordKpi = l.includes("impression") || l.includes("conversion") || l.includes("conv") || l.includes("keyword") || l.includes("cvr");

  let entityType = isSkuFilterActive ? "City" : isBrandFilterActive ? (isKeywordKpi ? "Keyword" : "Location") : "Brand";
  // PRE-FETCHED DATA PRIORITY:
  // If we have specialized pre-fetched data for this node from the /category-rca API (gainers/drainers sorted),
  // we use it. Otherwise, we calculate from the metrics array.
  const prefetchedNodeData = prefetchedRows?.[id] || prefetchedRows; // Handle both direct array or object map
  const hasPrefetchedRows = prefetchedNodeData && (prefetchedNodeData.gainers || prefetchedNodeData.drainers || (Array.isArray(prefetchedNodeData) && prefetchedNodeData.length > 0));

  let allRows = [];
  if (hasPrefetchedRows) {
    const rawData = prefetchedNodeData[activeTab] || (Array.isArray(prefetchedNodeData) ? prefetchedNodeData : []);
    allRows = (rawData || []).map(row => {
      const changeNum = typeof row._delta === 'number' ? row._delta : parseFloat((row.change || '0').replace(/[^-\d.]/g, ''));
      return {
        name: row.name,
        current: formatValue(row.currentVal, kpiLabel),
        prev: formatValue(row.prevVal, kpiLabel),
        change: changeNum,
        changeStr: row.change || '0%',
        pos: changeNum >= 0
      };
    });
  } else {
    // Derive manually from metrics array (fallback)
    let allEntities = [];
    if (entityType === "Keyword" && keywordMetrics && keywordMetrics.length > 0) {
      allEntities = keywordMetrics.map(m => m.keyword);
    } else if (metrics && metrics.length > 0) {
      allEntities = metrics.map(m => m.brand || m.label || m.Product).filter(Boolean);
    }

    allRows = allEntities.map((name, i) => {
      let curVal = 0, delta = 0, prevVal = 0;

      // Override with REAL data if available (supports Brand, SKU, and City levels)
      if (metrics && metrics.length > 0) {
        const match = metrics.find(m => m.brand === name);
        if (match) {
          if (l === "impressions" || l === "indexed-impressions") {
            curVal = match.rawImpressions || 0;
            prevVal = match.rawPrevImpressions || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l === "organic impressions") {
            curVal = match.rawOrganic || 0;
            prevVal = match.rawPrevOrganic || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l === "ad impressions") {
            curVal = match.rawAd || 0;
            prevVal = match.rawPrevAd || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l.includes("offtake")) {
            curVal = match.rawOfftake || 0;
            prevVal = match.rawPrevOfftake || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l.includes("price") || l.includes("asp")) {
            curVal = match.rawPrice || 0;
            prevVal = match.rawPrevPrice || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l.includes("listing")) {
            curVal = match.rawListing || 0;
            prevVal = match.rawPrevListing || 0;
            delta = (curVal - prevVal);
          } else if (l === "conversion" || l === "indexed-cvr" || l === "cvr" || l === "inorganic-cvr" || l === "organic-cvr" || category === "inorganic-cvr" || category === "organic-cvr") {
            curVal = match.rawOrgCvr || match.rawInorgCvr || match.rawCvr || 0;
            prevVal = match.rawPrevOrgCvr || match.rawPrevInorgCvr || match.rawPrevCvr || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l === "availability" || l.includes("osa") || category === "availability" || category === "buybox") {
            curVal = match.rawBuyBox || match.rawOsa || 0;
            prevVal = match.rawPrevBuyBox || match.rawPrevOsa || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l.includes("discount") || l.includes("disc")) {
            curVal = match.rawDiscount || 0;
            prevVal = match.rawPrevDiscount || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l.includes("gvs")) {
            curVal = match.rawGvs || 0;
            prevVal = match.rawPrevGvs || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l.includes("sov")) {
            curVal = match.rawSov || 0;
            prevVal = match.rawPrevSov || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l.includes("sponsored display") || category === "sd") {
            curVal = match.rawSdGvs || 0;
            prevVal = match.rawPrevSdGvs || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l.includes("sponsored search") || category === "sponsored-search") {
            curVal = match.rawSsGvs || 0;
            prevVal = match.rawPrevSsGvs || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if ((l.includes("ad gvs") || l.includes("ad ")) && category === "ad") {
            curVal = match.rawTotalAdSales || match.rawAdGvs || 0;
            prevVal = match.rawPrevTotalAdSales || match.rawPrevAdGvs || 0;
            delta = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : (curVal > 0 ? 100 : 0);
          } else if (l.includes("sp ") || l.includes("sponsored product") || category === "sp") {
            curVal = match.rawSpGvs || 0;
            prevVal = match.rawPrevSpGvs || 0;
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
        pos: delta >= 0
      };
    });
  }

  // Filter: Gainers = >=0%, Drainers = <0%
  // Gainers: sorted descending (highest positive first)
  // Drainers: sorted ascending (most negative first) // wait, actually ascending for negative numbers puts most negative first!
  const filteredRows = allRows.filter(r => activeTab === "gainers" ? r.change >= 0 : r.change < 0);
  const sortedRows = [...filteredRows].sort((a, b) => activeTab === "gainers" ? b.change - a.change : a.change - b.change);
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
        width: isComingSoon ? "600px" : "850px", backgroundColor: "#fff", borderRadius: "32px",
        padding: "0", zIndex: 100001, pointerEvents: "auto",
        boxShadow: "0 100px 200px -40px rgba(15,23,42,0.5), 0 0 120px rgba(99,102,241,0.35)",
        border: "1px solid rgba(0,0,0,0.2)", overflow: "hidden"
      }}
    >
      {isComingSoon ? (
        <Box sx={{ p: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <Activity size={80} color="#6366f1" strokeWidth={1.5} />
          </motion.div>
          <Typography sx={{ fontSize: "42px", fontWeight: 1000, color: "#0f172a", textTransform: "uppercase", letterSpacing: "8px" }}>
            Coming Soon
          </Typography>
          <Typography sx={{ fontSize: "20px", fontWeight: 700, color: "#94a3b8", textTransform: 'uppercase', letterSpacing: '3px' }}>
            Predictive Intelligence & Real-time ingestion is currently in progress
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ p: 4, bgcolor: "#f8fafc", borderBottom: "1px solid #edf2f7", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: "22px", fontWeight: 1000, color: "#0f172a", textTransform: "uppercase", letterSpacing: "2px" }}>
            {entityType} Analysis: {category === "ad" ? "Ad " : category === "organic" ? "Organic " : ""}{kpiLabel} {l.includes("keyword") ? "SOS" : ""}
          </Typography>
          <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#64748b", mt: 0.5, textTransform: "uppercase", letterSpacing: "1.5px" }}>
            Flagship {entityType} Performance comparison matrix
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', bgcolor: "#f1f5f9", p: 1, borderRadius: "16px", gap: 1.5 }}>
          {["gainers", "drainers"].map(t => (
            <Box key={t} onClick={(e) => { e.stopPropagation(); setActiveTab(t); }}
              sx={{
                px: 3, py: 1, borderRadius: "12px", cursor: 'pointer', transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                bgcolor: activeTab === t ? (t === 'gainers' ? "#059669" : "#dc2626") : "transparent",
                color: activeTab === t ? "#fff" : "#64748b", fontWeight: 1000, fontSize: "13px", textTransform: 'uppercase',
                boxShadow: activeTab === t ? "0 8px 20px rgba(0,0,0,0.2)" : "none",
                transform: activeTab === t ? "scale(1.05)" : "scale(1)"
              }}>
              {t}
            </Box>
          ))}
        </Box>
      </Box>
      <Box sx={{ p: 0 }}>
        <Table size="large" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "rgba(241, 245, 249, 1.0)", "& th": { py: 2 } }}>
              <TableCell align="left" sx={{ width: '25%', fontSize: "15px", fontWeight: 900, color: "#0f172a", textTransform: "uppercase", pl: 4, whiteSpace: 'nowrap' }}>{entityType} Name</TableCell>
              <TableCell align="left" sx={{ width: '25%', fontSize: "15px", fontWeight: 900, color: "#0f172a", textTransform: "uppercase", whiteSpace: 'nowrap' }}>Current Period</TableCell>
              <TableCell align="left" sx={{ width: '30%', fontSize: "15px", fontWeight: 900, color: "#0f172a", textTransform: "uppercase", whiteSpace: 'nowrap' }}>Comparison Period</TableCell>
              <TableCell align="left" sx={{ width: '20%', fontSize: "15px", fontWeight: 900, color: "#0f172a", textTransform: "uppercase", pr: 4, whiteSpace: 'nowrap' }}>Variance %</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayRows.length > 0 ? displayRows.map((r, i) => (
              <TableRow key={i} sx={{ "&:hover": { bgcolor: "rgba(99,102,241,0.08)" }, borderBottom: i === displayRows.length - 1 ? "none" : "1px solid #f1f5f9" }}>
                <TableCell align="left" sx={{ py: 2, pl: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {canDrillDown && (
                      <Box onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDrillDown(r.name); }}
                        sx={{
                          width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          bgcolor: "rgba(99,102,241,0.2)", color: "#6366f1", cursor: "pointer",
                          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                          "&:hover": { bgcolor: "#6366f1", color: "#fff", transform: "scale(1.2) rotate(180deg)", boxShadow: "0 0 15px rgba(99,102,241,0.4)" }
                        }}>
                        <Plus size={16} strokeWidth={4} />
                      </Box>
                    )}
                    {!canDrillDown && <Box sx={{ width: 28 }} />}
                    <Typography sx={{ fontSize: "16px", fontWeight: 500, color: "#1e293b", letterSpacing: "0.5px" }}>{r.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell align="left" sx={{ fontSize: "16px", fontWeight: 900, color: "#0f172a" }}>{r.current}</TableCell>
                <TableCell align="left" sx={{ fontSize: "16px", fontWeight: 700, color: "#94a3b8" }}>{r.prev}</TableCell>
                <TableCell align="left" sx={{ py: 2, pr: 4 }}>
                  <Typography sx={{
                    fontSize: "14px",
                    fontWeight: 1000,
                    color: r.pos ? "#059669" : "#dc2626",
                    bgcolor: r.pos ? "rgba(5, 150, 105, 0.2)" : "rgba(220, 38, 38, 0.2)",
                    px: 1.8, py: 0.6, borderRadius: "12px", display: "inline-block",
                    border: `2px solid ${r.pos ? "rgba(5, 150, 105, 0.35)" : "rgba(220, 38, 38, 0.35)"}`
                  }}>
                    {r.changeStr}
                  </Typography>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 20 }}>
                  <Typography sx={{ fontSize: "32px", fontWeight: 700, color: "#94a3b8", textTransform: 'uppercase', letterSpacing: '4px' }}>
                    No Data Available
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ p: 2.5, textAlign: "center", bgcolor: "#f8fafc", borderTop: "1px solid #edf2f7" }}>
        <Typography sx={{ fontSize: "12px", fontWeight: 800, color: "#94a3b8", letterSpacing: "1.5px", textTransform: 'uppercase' }}>
          Ultra-Precision Driver Diagnostics • {canDrillDown ? "Use [+] for Deep Entity Trace" : "Absolute Ground Level Analysis"}
        </Typography>
      </Box>
        </>
      )}
    </motion.div>
  );
};

/**
 * PREMIUM FULL MODAL (Click)
 */
const KpiDetailModal = ({ open, onClose, id, kpiLabel, category, platform, selectedBrand, selectedSku, selectedCategory, focusedEntity, context, initialRows }) => {
  const isComingSoon = id && COMING_SOON_IDS.includes(id);
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
  const isKeywordScopedKpi = (kpiLabel || "").toLowerCase().includes("impression") || (kpiLabel || "").toLowerCase().includes("conversion") || (kpiLabel || "").toLowerCase().includes("keyword");
  const hasSpecificBrand = selectedBrand && selectedBrand !== "All" && selectedBrand !== "All Brands";
  const isKeywordDrillDown = isQCPlatform && isKeywordScopedKpi;

  const fetchRows = useCallback(async (level = "brand", parentId = null, isInitialLoad = false) => {
    try {
      if (level === "brand" || isInitialLoad) setLoading(true);
      const params = {
        platform,
        categoryVal: category, // This is "organic" / "ad"
        category: context?.category || context?.categoryVal || 'All', // This is product category e.g. "GMFC"
        kpiCategory: kpiLabel, // Use kpiLabel directly for backend mapping
        drilldownLevel: level,
        drilldownId: parentId,
        activeTab: (level === "brand" && !parentId) ? activeTab : "all",
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
      const res = await axiosInstance.get('/category-rca', { params });
      const data = res.data?.rows || [];

      if (isInitialLoad) {
        // For initial load (whether brand-level or sku-level), set as main rows
        // If the backend returns gainers/drainers, use the active tab
        if (res.data?.rows && activeTab === 'all') {
          setRows(res.data.rows);
        } else if (res.data?.gainers || res.data?.drainers) {
          setRows(res.data[activeTab] || []);
        } else {
          setRows(data);
        }
      } else {
        // For subsequent drilldowns (expand within table), set as drilldown data
        // If the backend returns gainers/drainers, use the active tab
        if (res.data?.rows) {
          setDrilldownData(prev => ({
            ...prev,
            [parentId]: res.data.rows
          }));
        } else if (res.data?.gainers || res.data?.drainers) {
          setDrilldownData(prev => ({
            ...prev,
            [parentId]: res.data[activeTab] || []
          }));
        } else {
          setDrilldownData(prev => ({
            ...prev,
            [parentId]: data
          }));
        }
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
      setDrilldownData({});
      setExpandedBrand(null);
      setExpandedSku(null);

      // Always fetch to ensure accurate Gainers/Drainers sorting over the entire dataset
      setRows([]);
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
      PaperProps={{ sx: { borderRadius: "20px", overflow: "hidden", boxShadow: "0 40px 80px -15px rgba(0,0,0,0.3)", minHeight: isComingSoon ? '500px' : 'auto' } }}>
      {isComingSoon ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, p: 10, bgcolor: '#f8fafc' }}>
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity }}>
            <Zap size={80} color="#6366f1" fill="#6366f120" strokeWidth={1.5} />
          </motion.div>
          <Typography sx={{ fontSize: "48px", fontWeight: 1000, color: "#0f172a", textTransform: "uppercase", letterSpacing: "10px", textAlign: 'center' }}>
            Coming Soon
          </Typography>
          <Typography sx={{ fontSize: "18px", fontWeight: 700, color: "#64748b", textTransform: 'uppercase', letterSpacing: '3px', textAlign: 'center', maxWidth: '600px', lineHeight: 1.6 }}>
            Predictive Intelligence & Real-time ingestion is currently in progress. This module is undergoing architectural optimization.
          </Typography>
          <Button
            onClick={onClose}
            variant="contained"
            sx={{ mt: 2, px: 6, py: 1.5, borderRadius: '16px', bgcolor: '#0f172a', fontWeight: 900, '&:hover': { bgcolor: '#1e293b' } }}
          >
            Close
          </Button>
        </Box>
      ) : (
        <>
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
            {["all", "gainers", "drainers"].map(t => (
              <Box key={t} onClick={() => { setActiveTab(t); setPage(0); }}
                sx={{
                  px: 2, py: 0.75, borderRadius: "8px", cursor: 'pointer', transition: 'all 0.2s',
                  bgcolor: activeTab === t ? (t === 'all' ? "#6366f1" : (t === 'gainers' ? "#059669" : "#dc2626")) : "transparent",
                  color: activeTab === t ? "#fff" : "#64748b", fontWeight: 700, fontSize: "12px", textTransform: 'uppercase'
                }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
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
            ) : topRows.length > 0 ? topRows.map((row, idx) => {
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
                  if (newExpanded && !drilldownData[newExpanded]) fetchRows("sku", newExpanded);
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
            }) : (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                  <Typography sx={{ fontSize: "18px", fontWeight: 700, color: "#94a3b8", textTransform: 'uppercase', letterSpacing: '2px' }}>
                    No Data Available
                  </Typography>
                </TableCell>
              </TableRow>
            )}
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
        </>
      )}
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
  const displayChange = typeof change === 'string' ? change.replace(/^[\+\-]\s*/, '') : change;
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
    isLR,
  } = data;

  const isComingSoon = data.id && COMING_SOON_IDS.includes(data.id);

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
      <Handle 
        type="target" 
        position={isLR ? Position.Left : Position.Top} 
        style={{ 
          background: "transparent", 
          border: "none", 
          width: 0, height: 0, 
          ...(isLR ? { left: -8, top: "50%" } : { top: -8, left: "50%" }) 
        }} 
      />

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
            id={data.id}
            kpiLabel={label}
            category={data.category}
            metrics={data.metrics}
            keywordMetrics={data.keywordMetrics}
            platform={data.platform || ""}
            selectedBrand={data.selectedBrand || ""}
            selectedSku={data.selectedSku || ""}
            selectedCategory={data.selectedCategory || ""}
            position={data.popupPosition}
            prefetchedRows={data.prefetchedRows}
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
            <Typography sx={{ fontSize: "13px", color: TYPO.secondary, fontWeight: TYPO.weightHeavy, textTransform: "uppercase", mb: 0.8, letterSpacing: "0.5px" }}>Current</Typography>
            <Typography sx={{ fontSize: isComingSoon ? "15px" : "24px", color: isComingSoon ? "#6366f1" : TYPO.primary, fontWeight: TYPO.weightHeavy, lineHeight: 1, textTransform: isComingSoon ? "uppercase" : "none" }}>
              {isComingSoon ? "Coming Soon" : value}
            </Typography>
          </Box>
          <Box sx={{ width: "1px", height: "35px", bgcolor: TYPO.border, mx: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "13px", color: TYPO.secondary, fontWeight: TYPO.weightHeavy, textTransform: "uppercase", mb: 0.8, letterSpacing: "0.5px" }}>Previous</Typography>
            <Typography sx={{ fontSize: "17px", color: TYPO.secondary, fontWeight: TYPO.weightBold, lineHeight: 1 }}>{isComingSoon ? "—" : (prevValue || "—")}</Typography>
          </Box>
          <Box sx={{ width: "1px", height: "35px", bgcolor: TYPO.border, mx: 2 }} />
          <Box sx={{ flex: 1, textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <Typography sx={{ fontSize: "13px", color: TYPO.secondary, fontWeight: TYPO.weightHeavy, textTransform: "uppercase", mb: 0.8, letterSpacing: "0.5px" }}>Variance %</Typography>
            <Box sx={{ mt: "2px" }}>
              {isComingSoon ? (
                <Typography sx={{ fontSize: "14px", fontWeight: 800, color: "#94a3b8" }}>—</Typography>
              ) : (
                <DeltaBadge change={change} isPositive={isPositive} />
              )}
            </Box>
          </Box>
        </Box>

        {meta?.length > 0 && !isComingSoon && (
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
              ...(isLR 
                ? { right: -28, top: "50%", marginTop: -20 } 
                : { bottom: -28, left: "50%", marginLeft: -20 }
              ),
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

      <Handle 
        type="source" 
        position={isLR ? Position.Right : Position.Bottom} 
        style={{ 
          background: "transparent", 
          border: "none", 
          width: 0, height: 0, 
          ...(isLR ? { right: -8, top: "50%" } : { bottom: -8, left: "50%" })
        }} 
      />
    </motion.div >
  );
};

// --- Dynamic Data Helpers ---
// (using global getSeedFromStr)

const getDynamicRcaTreeData = (context) => {
  const { platform, channel, category: categoryVal, brand, sku, month, timeStart, compareStart } = context;

  const isEcom = channel?.toLowerCase().includes("e-commerce") || channel?.toLowerCase().includes("ecom") || 
                 ["amazon", "flipkart", "blinkit", "zepto", "instamart"].includes(platform?.toLowerCase());

  // Seed for overall consistency - now including month and custom date ranges
  const dateSeed = timeStart ? timeStart.format('YYYYMMDD') : (month || "All");
  const compareSeed = compareStart ? compareStart.format('YYYYMMDD') : "None";
  const seed = getSeedFromStr(`${platform}-${brand}-${sku}-${categoryVal || "All"}-${dateSeed}-${compareSeed}`);

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
      value: "---",
      prevValue: "---",
      change: "0%",
      isPositive: true,
      category: "offtake",
      importance: "outcome",
      insight: "---",
      meta: [{ label: "Est. Category share", value: "---", change: "---", isPositive: true }],
      children: [
        {
          id: isFlipkart ? "impressions" : "gvs",
          label: isFlipkart ? "Impressions" : "GVs",
          value: "---",
          change: "---",
          isPositive: false,
          category: "impressions",
          importance: "primary",
          meta: [
            { label: "Share of Search", value: "---", change: "---", isPositive: false },
            { label: `${gvLabel} Share`, value: "---", change: "---", isPositive: true }
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
                  value: "---",
                  change: "---",
                  isPositive: false,
                  category: "ad",
                  meta: [
                    { label: "PLA Impressions", value: "---", change: "---", isPositive: false },
                    { label: "Conversion", value: "---", change: "---", isPositive: false }
                  ]
                },
                {
                  id: "pca",
                  label: "PCA",
                  value: "---",
                  change: "---",
                  isPositive: false,
                  category: "ad",
                  meta: [
                    { label: "PCA Impressions", value: "---", change: "---", isPositive: false },
                    { label: "Conversion", value: "---", change: "---", isPositive: true }
                  ]
                },
                {
                  id: "display-ads",
                  label: "Display Ads",
                  value: "---",
                  change: "---",
                  isPositive: false,
                  category: "ad",
                  meta: [
                    { label: "Display Impressions", value: "---", change: "---", isPositive: false },
                    { label: "Conversion", value: "---", change: "---", isPositive: false }
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
                      value: "---",
                      change: "---",
                      isPositive: false,
                      category: "ad",
                      meta: [
                        { label: "Search GVs", value: "---", change: "---", isPositive: false },
                        { label: "Conversion", value: "---", change: "---", isPositive: false }
                      ],
                      children: [
                        {
                          id: "sp",
                          label: "Sponsored Product",
                          value: "---",
                          change: "---",
                          isPositive: false,
                          category: "ad",
                          meta: [
                            { label: "SP GVs", value: "---", change: "---", isPositive: false },
                            { label: "Conversion", value: "---", change: "---", isPositive: true },
                            { label: "SP ROAS", value: "---", change: "---", isPositive: false },
                            { label: "SP SPEND", value: "---", change: "---", isPositive: false }
                          ]
                        },
                        {
                          id: "sb",
                          label: "Sponsored Brand",
                          value: "---",
                          change: "---",
                          isPositive: false,
                          category: "ad",
                          meta: [
                            { label: "SB All GVs", value: "---", change: "---", isPositive: false },
                            { label: "Conversion", value: "---", change: "---", isPositive: false },
                            { label: "SB ROAS", value: "---", change: "---", isPositive: false },
                            { label: "SB SPEND", value: "---", change: "---", isPositive: false }
                          ]
                        },
                        {
                          id: "sd",
                          label: "Sponsored Display",
                          value: "---",
                          change: "---",
                          isPositive: true,
                          category: "sd",
                          meta: [
                            { label: "SD GVs", value: "---", change: "---", isPositive: true },
                            { label: "Conversion", value: "---", change: "---", isPositive: false },
                            { label: "SD ROAS", value: "---", change: "---", isPositive: false },
                            { label: "SD SPEND", value: "---", change: "---", isPositive: true }
                          ]
                        }
                      ]
                    }
              ]
            },
            {
              id: "sov-overall",
              label: "SOV Overall",
              value: "---",
              change: "---",
              isPositive: true,
              category: "sov",
              meta: [{ label: "SOV", value: "---" }]
            }
          ]
        },
        {
          id: "cvr",
          label: "CVR",
          value: "---",
          prevValue: "---",
          change: "---",
          isPositive: true,
          category: "cvr",
          importance: "primary",
          children: [
            {
              id: "availability",
              label: "Availability",
              value: "---",
              change: "---",
              isPositive: true,
              category: "availability",
              children: [
                {
                  id: "buybox",
                  label: "BuyBox%",
                  value: "---",
                  change: "---",
                  isPositive: true,
                  category: "availability"
                },
                {
                  id: "seller-listing",
                  label: "Seller Listing%",
                  value: "---",
                  change: "---",
                  isPositive: true,
                  category: "availability"
                }
              ]
            },
            {
              id: "delivery-time",
              label: "Delivery Time",
              value: "---",
              change: "---",
              isPositive: true,
              category: "segment",
              children: isFlipkart ? [] : [
                { id: "same-day", label: `Same Day ${pluralGvLabel}%`, value: "---", change: "---", isPositive: true, category: "segment" }
              ]
            },
            {
              id: "discounting",
              label: "Discounting%",
              value: "---",
              change: "---",
              isPositive: true,
              category: "discounting",
              children: isFlipkart ? [] : [
                { id: "one-day", label: `1 Day ${pluralGvLabel}%`, value: "---", change: "---", isPositive: true, category: "segment" }
              ]
            },
            {
              id: "organic-cvr",
              label: "Organic CVR",
              value: "---",
              change: "---",
              isPositive: true,
              category: "organic",
              children: isFlipkart ? [] : [
                { id: "two-day", label: `2 Day ${pluralGvLabel}%`, value: "---", change: "---", isPositive: true, category: "segment" }
              ]
            },
            {
              id: "inorganic-cvr",
              label: "Inorganic CVR",
              value: "---",
              change: "---",
              isPositive: true,
              category: "ad",
              children: isFlipkart ? [] : [
                { id: "greater-two", label: `> 2 Days ${pluralGvLabel}%`, value: "---", change: "---", isPositive: true, category: "segment" }
              ]
            }
          ]
        },
        {
          id: "asp",
          label: "ASP",
          value: "---",
          change: "---",
          isPositive: true,
          category: "price",
          importance: "primary",
          children: [
            { id: "combo-sales", label: "Combo Sales%", value: "---", change: "---", isPositive: true, category: "segment" },
            { id: "large-sales", label: "Large Sales%", value: "---", change: "---", isPositive: true, category: "segment" },
            { id: "premium-sales", label: "Premium Sales%", value: "---", change: "---", isPositive: true, category: "segment" }
          ]
        },
        {
          id: "sns",
          label: "Subscribe & Save %",
          value: "0.00%",
          change: "0.00%",
          isPositive: true,
          category: "segment",
          meta: [{ label: "SnS Sales%", value: "---" }],
          children: [
            { id: "loyalty", label: "Loyalty/Repeats %", value: "---", change: "---", isPositive: true, category: "segment" },
            { id: "new-cust", label: "New Customer %", value: "---", change: "---", isPositive: false, category: "segment" }
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
    metrics: [],
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
        metrics: [],
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
        metrics: [],
        meta: [{ label: "Overall SOS", value: getVal(12.5, true, seed + "sos", 25), change: getChange("meta2").val, isPositive: getChange("meta2").isPos }],
        children: [
          {
            id: "availability",
            label: "Wt. OSA %",
            value: getVal(72.5, true, seed + "osa", 40),
            change: osaChange.val,
            isPositive: osaChange.isPos,
            category: "availability",
            metrics: [],
            children: [
              {
                id: "listing",
                label: "DS Listing %",
                value: getVal(60.0, true, seed + "listing", 50),
                change: getChange("meta3").val,
                isPositive: getChange("meta3").isPos,
                category: "availability",
                metrics: [],
              },
              {
                id: "buybox",
                label: "BuyBox%",
                value: getVal(43.01, true, seed + "buybox", 40),
                change: getChange("meta7").val,
                isPositive: getChange("meta7").isPos,
                category: "buybox",
                metrics: [],
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
            metrics: [],
            meta: [{ label: "Organic SOS", value: getVal(8.5, true, seed + "orgsos", 15), change: getChange("meta4").val, isPositive: getChange("meta4").isPos }],
          },
          {
            id: "ad-impressions",
            label: "Ad Impressions",
            value: formatLac(1.5 * finalVolume * getEntityBase(brand + "ad", 0.9)),
            change: adChange.val,
            isPositive: adChange.isPos,
            category: "ad",
            metrics: [],
            meta: [{ label: "Ad SOS", value: getVal(4.5, true, seed + "adsos", 10), change: getChange("meta5").val, isPositive: getChange("meta5").isPos }],
            children: [
              {
                id: "ad-comp", label: "Comp Keywords", value: formatLac(0.305 * finalVolume * getEntityBase("adc", 0.5)), change: getChange("adc").val, isPositive: getChange("adc").isPos, category: "ad", metrics: []
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
        metrics: [],
        children: [
          {
            id: "discounting", label: "Wt. Disc %", value: getVal(18.5, true, seed + "disc", 30), change: getChange("meta6").val, isPositive: getChange("meta6").isPos, category: "discounting", metrics: []
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
const computeSubtreeWidth = (node, collapsedNodes) => {
  if (!node.children || node.children.length === 0 || collapsedNodes.has(node.id)) return CARD_WIDTH;
  const childWidths = node.children.map((child) => computeSubtreeWidth(child, collapsedNodes));
  return childWidths.reduce((sum, w, idx) => sum + w + (idx > 0 ? HORIZONTAL_GAP : 0), 0);
};

const computeSubtreeHeight = (node, collapsedNodes) => {
  if (!node.children || node.children.length === 0 || collapsedNodes.has(node.id)) return CARD_HEIGHT;
  const childHeights = node.children.map((child) => computeSubtreeHeight(child, collapsedNodes));
  return childHeights.reduce((sum, h, idx) => sum + h + (idx > 0 ? LR_Y_GAP : 0), 0);
};

const layoutTreeNodesLR = (node, x, y, collapsedNodes, results, onViewTrends, platform = "", selectedBrand = "", selectedSku = "", selectedCategory = "", currentPeriodLabel = "", comparePeriodLabel = "") => {
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
      isLR: true,
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

      layoutTreeNodesLR(child, x + LR_X_STEP, currentChildY, collapsedNodes, results, onViewTrends, platform, selectedBrand, selectedSku, selectedCategory, currentPeriodLabel, comparePeriodLabel);
      currentChildY += childHeight + LR_Y_GAP;
    });
  }
};

const layoutTreeNodes = (node, x, y, collapsedNodes, results, onViewTrends, platform = "", selectedBrand = "", selectedSku = "", selectedCategory = "", currentPeriodLabel = "", comparePeriodLabel = "") => {
  const isCollapsed = collapsedNodes.has(node.id);
  const subtreeWidth = computeSubtreeWidth(node, collapsedNodes);

  results.nodes.push({
    id: node.id,
    type: "kpi",
    position: { x: x + subtreeWidth / 2 - CARD_WIDTH / 2, y },
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
    let currentChildX = x;
    node.children.forEach((child) => {
      const childWidth = computeSubtreeWidth(child, collapsedNodes);

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

      layoutTreeNodes(child, currentChildX, y + VERTICAL_STEP, collapsedNodes, results, onViewTrends, platform, selectedBrand, selectedSku, selectedCategory, currentPeriodLabel, comparePeriodLabel);
      currentChildX += childWidth + HORIZONTAL_GAP;
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
  const [ecomOfftakeData, setEcomOfftakeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [hasInitializedCollapse, setHasInitializedCollapse] = useState(false);
  const reactFlowInstance = useReactFlow();

  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [selectedKpiModalData, setSelectedKpiModalData] = useState(null);
  const [prefetchedModalRows, setPrefetchedModalRows] = useState([]);
  const [prefetchedHoverData, setPrefetchedHoverData] = useState({});

  const handleKpiClick = useCallback((data) => {
    if (COMING_SOON_IDS.includes(data.id)) {
      // Just show a toast or nothing for now as per "click data coming soon"
      // We'll pass a flag to the modal if needed, or just return early.
      // The user wants click data coming soon, so maybe a separate small modal or alert.
      // For now, let's let the modal open but handle 'Coming Soon' inside it.
    }

    setSelectedKpiModalData({
      id: data.id,
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
    const platformLower = (context.platform || '').toLowerCase();
    const channelLower = (context.channel || '').toLowerCase();
    const isEcom = channelLower.includes('e-commerce') || channelLower.includes('ecom') || 
                   ['amazon', 'flipkart', 'blinkit', 'zepto', 'instamart'].includes(platformLower);

    if (isEcom) {
      // For ecom platforms, fetch real offtake from rb_pdp_olap
      setLoading(true);
      setApiError(null);
      try {
        const params = {};
        if (context.platform) params.platform = context.platform;
        if (context.category && context.category !== 'All') params.category = context.category;
        if (context.brand && context.brand !== 'All Brands' && context.brand !== 'All') params.brand = context.brand;
        if (context.sku && context.sku !== 'All SKUs' && context.sku !== 'All') params.sku = context.sku;
        if (context.timeStart) params.startDate = context.timeStart.format('YYYY-MM-DD');
        if (context.timeEnd) params.endDate = context.timeEnd.format('YYYY-MM-DD');
        if (context.compareOn && context.compareStart) {
          params.compareStartDate = context.compareStart.format('YYYY-MM-DD');
          params.compareEndDate = context.compareEnd.format('YYYY-MM-DD');
        }
        const res = await axiosInstance.get('/rca-tree-kpis', { params });
        console.log('[RCATree] /rca-tree-kpis call result:', JSON.stringify({
          currFormatted: res.data?.currFormatted,
          gvsFormatted: res.data?.currGvsFormatted, 
          cvrFormatted: res.data?.currCvrFormatted,
          aspFormatted: res.data?.currAspFormatted,
          brands: res.data?.brandMetrics?.length
        }));
        setEcomOfftakeData(res.data || null);
      } catch (err) {
        console.warn('[RCATree] rca-tree-kpis fetch failed:', err.message);
        setEcomOfftakeData(null);
      } finally {
        setApiTreeData(null);
        setLoading(false);
      }
      return;
    }

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
    context.channel,
    context.category,
    context.brand,
    context.sku,
    context.timeStart,
    context.timeEnd,
    context.compareStart,
    context.compareEnd,
    context.compareOn,
    setEcomOfftakeData
  ]);

  useEffect(() => {
    const timer = setTimeout(fetchRcaData, 300);
    return () => clearTimeout(timer);
  }, [fetchRcaData]);

  // Helper to collect all non-coming-soon node IDs and categories from a tree
  const collectAllNodes = useCallback((node, result = []) => {
    if (node && !COMING_SOON_IDS.includes(node.id)) {
      result.push({ id: node.id, category: node.category, label: node.label });
    }
    if (node.children) {
      node.children.forEach(child => collectAllNodes(child, result));
    }
    return result;
  }, []);



  // Use API data if available, otherwise fall back to hardcoded.
  // For ecom, patch the root node with real offtake values from the backend.
  const currentTreeData = useMemo(() => {
    const isEcom = (context.channel || '').toLowerCase().includes('e-commerce')
      || (context.channel || '').toLowerCase().includes('ecom')
      || ['amazon', 'flipkart', 'blinkit', 'zepto', 'instamart'].includes((context.platform || '').trim().toLowerCase());

    console.log('[RCATree] useMemo re-run. context.platform:', context.platform, 'isEcom:', isEcom, 'hasOfftake:', !!ecomOfftakeData);
    let tree = apiTreeData || getDynamicRcaTreeData(context);

    if (isEcom && ecomOfftakeData) {
      console.log('[RCATree] PATCHING ROOT with:', ecomOfftakeData.currFormatted);
      const { 
        currFormatted, varianceStr, isPositive, totalVariancePct, 
        currGvsFormatted, prevGvsFormatted, gvsVarianceStr, isGvsPositive,
        currSovFormatted, prevSovFormatted, sovVarianceStr, isSovPositive,
        brandMetrics 
      } = ecomOfftakeData;

      // Build HoverMetricsPopup-compatible metrics from real brand data
      const realMetrics = (brandMetrics || []).map(bm => ({
        brand: bm.brand,
        rawOfftake: bm.rawOfftake,
        rawPrevOfftake: bm.rawPrevOfftake,
        rawGvs: bm.rawGvs,
        rawPrevGvs: bm.rawPrevGvs,
        rawSov: bm.rawSov,
        rawPrevSov: bm.rawPrevSov
      }));

      // Patch the Offtake root node
      console.log('[RCATree] Patching root with real data. ID:', tree.id, 'Value:', currFormatted);
      
      const patchedTree = {
        ...tree,
        value: currFormatted || tree.value,
        prevValue: ecomOfftakeData.prevFormatted || tree.prevValue,
        change: varianceStr || tree.change,
        isPositive,
        insight: isPositive ? 'Volume Growth' : 'Critical Decline',
        metrics: realMetrics,
        meta: [
          { 
            label: "Est. Category share", 
            value: ecomOfftakeData.currCatShareFormatted || "---", 
            change: ecomOfftakeData.catShareVarStr || "---", 
            isPositive: ecomOfftakeData.isCatSharePos 
          }
        ]
      };

      // Patch children
      if (patchedTree.children && patchedTree.children.length > 0) {
        // CVR Node
        const cvrNodeIndex = patchedTree.children.findIndex(c => c.id === 'cvr' || c.id === 'indexed-cvr');
        if (cvrNodeIndex !== -1) {
          const { currCvrFormatted, prevCvrFormatted, cvrVarianceStr, isCvrPositive } = ecomOfftakeData;
          const cvrNodePatch = {
            ...patchedTree.children[cvrNodeIndex],
            value: currCvrFormatted || '0.00%',
            prevValue: prevCvrFormatted || '--',
            change: cvrVarianceStr || '0%',
            isPositive: isCvrPositive,
            metrics: (brandMetrics || []).map(bm => ({
              brand: bm.brand,
              rawCvr: bm.rawCvr,
              rawPrevCvr: bm.rawPrevCvr,
              cvrVariancePct: bm.cvrVariancePct
            }))
          };

          // Patch Availability (child of CVR node)
          const { currOsaFormatted, prevOsaFormatted, osaVarianceStr, isOsaPositive } = ecomOfftakeData;
          if (cvrNodePatch.children && cvrNodePatch.children.length > 0) {
            const availIdx = cvrNodePatch.children.findIndex(c => c.id === 'availability');
            if (availIdx !== -1) {
              cvrNodePatch.children = [...cvrNodePatch.children];
              cvrNodePatch.children[availIdx] = {
                ...cvrNodePatch.children[availIdx],
                value: currOsaFormatted || '0.00%',
                prevValue: prevOsaFormatted || '--',
                change: osaVarianceStr || '0%',
                isPositive: isOsaPositive,
                category: 'availability',
                metrics: (brandMetrics || []).map(bm => ({
                  brand: bm.brand,
                  rawOsa: bm.rawOsa,
                  rawPrevOsa: bm.rawPrevOsa,
                  osaVariancePct: bm.osaVariancePct
                }))
              };

              // Patch BuyBox% (child of Availability)
              const { currBuyBoxFormatted, prevBuyBoxFormatted, buyBoxVarStr, isBuyBoxPositive } = ecomOfftakeData;
              const buyBoxIdx = cvrNodePatch.children[availIdx].children?.findIndex(c => c.id === 'buybox');
              if (buyBoxIdx !== -1 && buyBoxIdx !== undefined) {
                cvrNodePatch.children[availIdx].children = [...cvrNodePatch.children[availIdx].children];
                cvrNodePatch.children[availIdx].children[buyBoxIdx] = {
                  ...cvrNodePatch.children[availIdx].children[buyBoxIdx],
                  value: currBuyBoxFormatted || '0.00%',
                  prevValue: prevBuyBoxFormatted || '--',
                  change: buyBoxVarStr || '0%',
                  isPositive: isBuyBoxPositive,
                  category: 'buybox',
                  metrics: (brandMetrics || []).map(bm => ({
                    brand: bm.brand,
                    rawBuyBox: bm.rawBuyBox,
                    rawPrevBuyBox: bm.rawPrevBuyBox,
                    buyBoxVariancePct: bm.buyBoxVariancePct
                  }))
                };
              }
            }
          }

          // Patch Discounting% (child of CVR node)
          const { currDiscFormatted, prevDiscFormatted, discVarianceStr, isDiscPositive } = ecomOfftakeData;
          if (cvrNodePatch.children && cvrNodePatch.children.length > 0) {
            const discIdx = cvrNodePatch.children.findIndex(c => c.id === 'discounting');
            if (discIdx !== -1) {
              cvrNodePatch.children = [...cvrNodePatch.children];
              cvrNodePatch.children[discIdx] = {
                ...cvrNodePatch.children[discIdx],
                value: currDiscFormatted || '0.00%',
                prevValue: prevDiscFormatted || '--',
                change: discVarianceStr || '0%',
                isPositive: isDiscPositive,
                category: 'discounting',
                metrics: (brandMetrics || []).map(bm => ({
                  brand: bm.brand,
                  rawDiscount: bm.rawDiscount,
                  rawPrevDiscount: bm.rawPrevDiscount,
                  discountVariancePct: bm.discountVariancePct
                }))
              };
            }
          }

          // Patch Inorganic CVR (child of CVR node)
          const { currInorgCvrFormatted, prevInorgCvrFormatted, inorgCvrVarStr, isInorgCvrPositive } = ecomOfftakeData;
          if (cvrNodePatch.children && cvrNodePatch.children.length > 0) {
            const inorgCvrIdx = cvrNodePatch.children.findIndex(c => c.id === 'inorganic-cvr');
            if (inorgCvrIdx !== -1) {
              cvrNodePatch.children = [...cvrNodePatch.children];
              cvrNodePatch.children[inorgCvrIdx] = {
                ...cvrNodePatch.children[inorgCvrIdx],
                value: currInorgCvrFormatted || '0.00%',
                prevValue: prevInorgCvrFormatted || '--',
                change: inorgCvrVarStr || '0%',
                isPositive: isInorgCvrPositive,
                category: 'inorganic-cvr',
                metrics: (brandMetrics || []).map(bm => ({
                  brand: bm.brand,
                  rawInorgCvr: bm.rawInorgCvr,
                  rawPrevInorgCvr: bm.rawPrevInorgCvr,
                  inorgCvrVariancePct: bm.inorgCvrVariancePct
                }))
              };
            }

            // Patch Organic CVR (child of CVR node)
            const { currOrgCvrFormatted, prevOrgCvrFormatted, orgCvrVarStr, isOrgCvrPositive } = ecomOfftakeData;
            const orgCvrIdx = cvrNodePatch.children.findIndex(c => c.id === 'organic-cvr');
            if (orgCvrIdx !== -1) {
              cvrNodePatch.children = [...cvrNodePatch.children];
              cvrNodePatch.children[orgCvrIdx] = {
                ...cvrNodePatch.children[orgCvrIdx],
                value: currOrgCvrFormatted || '0.00%',
                prevValue: prevOrgCvrFormatted || '--',
                change: orgCvrVarStr || '0%',
                isPositive: isOrgCvrPositive,
                category: 'organic-cvr',
                metrics: (brandMetrics || []).map(bm => ({
                  brand: bm.brand,
                  rawOrgCvr: bm.rawOrgCvr,
                  rawPrevOrgCvr: bm.rawPrevOrgCvr,
                  orgCvrVariancePct: bm.orgCvrVariancePct
                }))
              };
            }
          }

          patchedTree.children[cvrNodeIndex] = cvrNodePatch;
        }

        // GVs Node
        const gvsNodeIndex = patchedTree.children.findIndex(c => c.id === 'gvs' || c.id === 'impressions');
        if (gvsNodeIndex !== -1) {
          const gvsNode = { ...patchedTree.children[gvsNodeIndex] };
          
          gvsNode.value = currGvsFormatted;
          gvsNode.prevValue = prevGvsFormatted;
          gvsNode.change = gvsVarianceStr;
          gvsNode.isPositive = isGvsPositive;
          gvsNode.metrics = realMetrics;
          gvsNode.category = "gvs";

          // SOV Overall Node (Child of GVs)
          if (gvsNode.children && gvsNode.children.length > 0) {
            const sovNodeIndex = gvsNode.children.findIndex(c => c.id === 'sov-overall');
            if (sovNodeIndex !== -1) {
              gvsNode.children[sovNodeIndex] = {
                ...gvsNode.children[sovNodeIndex],
                value: currSovFormatted,
                prevValue: prevSovFormatted,
                change: sovVarianceStr,
                isPositive: isSovPositive,
                metrics: realMetrics,
                category: "sov"
              };
            }
          }

          // Sponsored Display Node — navigate: gvsNode -> Ad GVs -> Sponsored Search -> SD
          if (gvsNode.children && gvsNode.children.length > 1) {
            const adGvsIdx = gvsNode.children.findIndex(c => c.id === 'ad-gvs' || c.id === 'ad-impressions');
            if (adGvsIdx !== -1) {
              gvsNode.children[adGvsIdx] = { ...gvsNode.children[adGvsIdx] };
              const adGvsNode = gvsNode.children[adGvsIdx];

              // Patch Ad GVs node with Aggregate Data
              const {
                currAdSalesFormatted, adSalesVarStr, isAdSalesPos,
                currAdSpendFormatted, adSpendVarStr, isAdSpendPos,
                currAdRoasFormatted, adRoasVarStr, isAdRoasPos
              } = ecomOfftakeData;

              const adMetrics = (brandMetrics || []).map(bm => ({
                brand: bm.brand,
                rawTotalAdSales: bm.rawTotalAdSales,
                rawPrevTotalAdSales: bm.rawPrevTotalAdSales
              }));

              adGvsNode.value = currAdSalesFormatted || '0';
              adGvsNode.change = adSalesVarStr || '0%';
              adGvsNode.isPositive = isAdSalesPos;
              adGvsNode.category = "ad";
              adGvsNode.metrics = adMetrics;
              adGvsNode.meta = [
                { label: "AD Spend", value: currAdSpendFormatted || '0', change: adSpendVarStr || '0%', isPositive: isAdSpendPos },
                { label: "Total ROAS", value: currAdRoasFormatted || '0', change: adRoasVarStr || '0%', isPositive: isAdRoasPos }
              ];

              if (adGvsNode.children && adGvsNode.children.length > 0) {
                // Sponsored Search is the parent of SP, SB, SD
                const ssIdx = adGvsNode.children.findIndex(c => c.id === 'sponsored-search');
                if (ssIdx !== -1) {
                  adGvsNode.children[ssIdx] = { ...adGvsNode.children[ssIdx] };
                  const ssNode = adGvsNode.children[ssIdx];
                  
                  // Make Sponsored Search real (Sum of SP + SD)
                  const currSsGvs = parseFloat(ecomOfftakeData.currTotalSpGvs || 0) + parseFloat(ecomOfftakeData.currTotalSdGvs || 0);
                  const prevSsGvs = parseFloat(ecomOfftakeData.prevTotalSpGvs || 0) + parseFloat(ecomOfftakeData.prevTotalSdGvs || 0);
                  const ssGvsVar = prevSsGvs > 0 ? ((currSsGvs - prevSsGvs) / prevSsGvs) * 100 : (currSsGvs > 0 ? 100 : 0);
                  
                  const formatUnitsLocal = (val) => {
                      const v = parseFloat(val);
                      if (isNaN(v)) return '0';
                      if (v >= 10000000) return `${(v / 10000000).toFixed(2)} Cr`;
                      if (v >= 100000)   return `${(v / 100000).toFixed(2)} Lac`;
                      if (v >= 1000)     return `${(v / 1000).toFixed(2)} K`;
                      return `${v.toFixed(0)}`;
                  };

                  const currSsGvsFormatted = formatUnitsLocal(currSsGvs);
                  const ssVarStr = (ssGvsVar >= 0 ? '+' : '') + ssGvsVar.toFixed(2) + '%';

                  ssNode.value = currSsGvsFormatted;
                  ssNode.change = ssVarStr;
                  ssNode.isPositive = ssGvsVar >= 0;
                  ssNode.category = "sponsored-search";

                  if (ssNode.meta && ssNode.meta.length > 0) {
                      ssNode.meta[0].value = currSsGvsFormatted;
                      ssNode.meta[0].change = ssVarStr;
                      ssNode.meta[0].isPositive = ssGvsVar >= 0;
                  }

                  // Brandwise Metrics for Sponsored Search
                  ssNode.metrics = (ecomOfftakeData.brandMetrics || []).map(bm => {
                      const sp = parseFloat(bm.rawSpGvs || 0);
                      const sd = parseFloat(bm.rawSdGvs || 0);
                      const p_sp = parseFloat(bm.rawPrevSpGvs || 0);
                      const p_sd = parseFloat(bm.rawPrevSdGvs || 0);
                      
                      const rawSsGvs = sp + sd;
                      const rawPrevSsGvs = p_sp + p_sd;
                      const ssVariancePct = rawPrevSsGvs > 0 ? ((rawSsGvs - rawPrevSsGvs) / rawPrevSsGvs) * 100 : (rawSsGvs > 0 ? 100 : 0);
                      
                      return {
                          brand: bm.brand,
                          rawSsGvs,
                          rawPrevSsGvs,
                          ssVariancePct
                      };
                  });

                  if (ssNode.children && ssNode.children.length > 0) {
                    // Sponsored Display (Real)
                    const sdIdx = ssNode.children.findIndex(c => c.id === 'sd');
                    if (sdIdx !== -1) {
                      const { 
                        currSdGvsFormatted, sdGvsVarStr, isSdGvsPos,
                        currSdSpendFormatted, sdSpendVarStr, isSdSpendPos,
                        currSdRoasFormatted, sdRoasVarStr, isSdRoasPos
                      } = ecomOfftakeData;

                      const sdMetrics = (brandMetrics || []).map(bm => ({
                        brand: bm.brand,
                        rawSdGvs: bm.rawSdGvs,
                        rawPrevSdGvs: bm.rawPrevSdGvs,
                        sdGvsVariancePct: bm.sdGvsVariancePct,
                        rawSdSpend: bm.rawSdSpend,
                        rawPrevSdSpend: bm.rawPrevSdSpend,
                        rawSdRoas: bm.rawSdRoas,
                        rawPrevSdRoas: bm.rawPrevSdRoas,
                        sdRoasVariancePct: bm.sdRoasVariancePct
                      }));

                      ssNode.children[sdIdx] = {
                        ...ssNode.children[sdIdx],
                        value: currSdGvsFormatted || '0',
                        change: sdGvsVarStr || '0%',
                        isPositive: isSdGvsPos,
                        category: "sd",
                        metrics: sdMetrics,
                        meta: [
                          { label: "SD GVs", value: currSdGvsFormatted || '0', change: sdGvsVarStr || '0%', isPositive: isSdGvsPos },
                          { label: "SD ROAS", value: currSdRoasFormatted || '0', change: sdRoasVarStr || '0%', isPositive: isSdRoasPos },
                          { label: "SD SPEND", value: currSdSpendFormatted || '0', change: sdSpendVarStr || '0%', isPositive: isSdSpendPos }
                        ]
                      };
                    }

                    // Sponsored Product (Swap logic from Ad GVs)
                    const spIdx = ssNode.children.findIndex(c => c.id === 'sp');
                    if (spIdx !== -1) {
                      const {
                        currSpGvsFormatted, spGvsVarStr, isSpGvsPos,
                        currSpSpendFormatted, spSpendVarStr, isSpSpendPos,
                        currSpRoasFormatted, spRoasVarStr, isSpRoasPos
                      } = ecomOfftakeData;

                      const spMetrics = (brandMetrics || []).map(bm => ({
                        brand: bm.brand,
                        rawSpGvs: bm.rawSpGvs,
                        rawPrevSpGvs: bm.rawPrevSpGvs,
                        spGvsVariancePct: bm.spGvsVariancePct
                      }));

                      ssNode.children[spIdx] = {
                        ...ssNode.children[spIdx],
                        value: currSpGvsFormatted || '0',
                        change: spGvsVarStr || '0%',
                        isPositive: isSpGvsPos,
                        category: "sp",
                        metrics: spMetrics,
                        meta: [
                          { label: "SP Spend", value: currSpSpendFormatted || '0', change: spSpendVarStr || '0%', isPositive: isSpSpendPos },
                          { label: "SP ROAS", value: currSpRoasFormatted || '0', change: spRoasVarStr || '0%', isPositive: isSpRoasPos }
                        ]
                      };
                    }
                  }
                }
              }
            }
          }

          patchedTree.children[gvsNodeIndex] = gvsNode;
        }

        // ASP Node
        const aspNodeIndex = patchedTree.children.findIndex(c => c.id === 'asp');
        if (aspNodeIndex !== -1) {
          const { currAspFormatted, prevAspFormatted, aspVarianceStr, isAspPositive, totalAspVariancePct } = ecomOfftakeData;
          patchedTree.children[aspNodeIndex] = {
            ...patchedTree.children[aspNodeIndex],
            value: currAspFormatted || '0',
            prevValue: prevAspFormatted || '--',
            change: aspVarianceStr || '0%',
            isPositive: isAspPositive,
            category: 'price',
            metrics: (brandMetrics || []).map(bm => ({
              brand: bm.brand,
              rawPrice: bm.rawAsp,
              rawPrevPrice: bm.rawPrevAsp,
              aspVariancePct: bm.aspVariancePct
            }))
          };
        }
      }

      // Assign to outer tree variable so fallback logic can catch it
      tree = patchedTree;
    } // <-- END OF `if (isEcom && ecomOfftakeData)`

    // ==== NEW FRONTEND AGGREGATION LOGIC ===============================
    // If we have prefetched drilldown data, calculate the card values by 
    // aggregating the drilldown table rows (sum or avg)!
    // This perfectly bypasses the backend ecomOfftake API if it fails.
    if (prefetchedHoverData && Object.keys(prefetchedHoverData).length > 0) {
      const patchFromPrefetch = (node) => {
        const nodeData = prefetchedHoverData[node.id];
        if (nodeData && !COMING_SOON_IDS.includes(node.id)) {
          const allRows = [...(nodeData.gainers || []), ...(nodeData.drainers || [])];
          if (allRows.length > 0) {
            let currTotal = 0;
            let prevTotal = 0;
            let validCount = 0;

            // Which KPIs need averaging vs summing?
            const isAvg = ['cvr', 'indexed-cvr', 'organic-cvr', 'inorganic-cvr', 'availability', 'buybox', 'discounting', 'sov', 'sov-overall', 'asp', 'price', 'share-of-search', 'rating'].includes(node.id) || ['cvr', 'availability', 'price', 'discounting', 'sov'].includes(node.category);

            allRows.forEach(row => {
              const cur = parseFloat(row.currentVal || 0);
              const prev = parseFloat(row.prevVal || 0);
              
              if (!isNaN(cur)) currTotal += cur;
              if (!isNaN(prev)) prevTotal += prev;
              if (row.currentVal !== null && row.currentVal !== undefined && !isNaN(cur)) {
                  validCount++;
              }
            });

            if (isAvg && validCount > 0) {
              currTotal /= validCount;
              prevTotal /= validCount;
            }

            // Set formatted values
            node.value = formatValue(currTotal, node.label);
            node.prevValue = formatValue(prevTotal, node.label);

            // Variance Calculation
            let varianceNum = prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : (currTotal > 0 ? 100 : 0);
            const varianceStr = (varianceNum >= 0 ? "+" : "") + varianceNum.toFixed(2) + "%";
            
            node.change = varianceStr;
            node.isPositive = varianceNum >= 0;

            if (node.id === 'root' || node.id === 'offtake') {
              node.insight = varianceNum >= 0 ? 'Volume Growth' : 'Critical Decline';
            }
          }
        }
        if (node.children) {
          node.children = node.children.map(child => patchFromPrefetch({ ...child }));
        }
        return node;
      };

      return patchFromPrefetch({ ...tree });
    }
    // ====================================================================

    return tree;
  }, [apiTreeData, context, ecomOfftakeData, prefetchedHoverData]);

  // Pre-fetch /category-rca drilldown data for ALL tree nodes on page load
  // This is the same API called on click — now fires on mount for every node
  useEffect(() => {
    if (!context.platform || loading) return;

    const fetchAllNodeData = async () => {
      // Create a structural base to traverse, avoiding currentTreeData to break circular dependency!
      const structuralTree = apiTreeData || getDynamicRcaTreeData(context);
      const allNodes = collectAllNodes(structuralTree);
      const results = {};
      console.log(`[RCATree] Pre-fetching category-rca for ${allNodes.length} nodes on page load`);

      const promises = allNodes.map(async (node) => {
        try {
          const params = {
            platform: context.platform,
            categoryVal: node.category,
            category: context.category || 'All',
            kpiCategory: node.category || node.label,
            drilldownLevel: 'brand',
            activeTab: 'all', // Fetch both gainers and drainers
            brand: context.brand || 'All',
            sku: context.sku || 'All',
            brandScope: context.brand || 'All',
          };
          if (context.timeStart) params.startDate = context.timeStart.format('YYYY-MM-DD');
          if (context.timeEnd) params.endDate = context.timeEnd.format('YYYY-MM-DD');
          if (context.compareOn && context.compareStart) {
            params.compareStartDate = context.compareStart.format('YYYY-MM-DD');
            params.compareEndDate = context.compareEnd.format('YYYY-MM-DD');
          }

          const res = await axiosInstance.get('/category-rca', { params });
          if (res.data?.gainers || res.data?.drainers) {
            results[node.id] = res.data;
          }
        } catch (err) {
          console.warn(`[RCATree] Failed to pre-fetch for ${node.id}:`, err.message);
        }
      });

      await Promise.all(promises);
      setPrefetchedHoverData(results);
      // Also set the root node rows for modal pre-fetch
      if (results['root'] || results['offtake']) {
        setPrefetchedModalRows(results['root'] || results['offtake']);
      }
    };

    const timer = setTimeout(fetchAllNodeData, 500);
    return () => clearTimeout(timer);
  }, [
    apiTreeData, // Only re-fetch if structural apiTreeData changes
    context.platform,
    context.category,
    context.brand,
    context.sku,
    context.timeStart,
    context.timeEnd,
    context.compareStart,
    context.compareEnd,
    context.compareOn,
    loading
  ]);

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
      if (next.has(id)) {
        // EXPANDING - Strict Sibling Auto-Collapse
        next.delete(id);
        
        const parentId = index.parent.get(id);
        if (parentId) {
          const siblings = index.children.get(parentId) || [];
          siblings.forEach(sId => {
            if (sId !== id) {
              // Collapse sibling and ALL its descendants for total focus
              next.add(sId);
            }
          });
        }
      } else {
        // COLLAPSING
        next.add(id);
      }
      return next;
    });
  }, [index]);

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
    const isEcom = context.channel?.toLowerCase().includes("e-commerce") || context.channel?.toLowerCase().includes("ecom") || 
                   ["amazon", "flipkart", "blinkit", "zepto", "instamart"].includes(context.platform?.toLowerCase());
    const results = { nodes: [], edges: [] };

    const fmtDate = (d) => d ? dayjs(d).format("D MMM'YY") : null;
    const curP = (context.timeStart && context.timeEnd) ? `${fmtDate(context.timeStart)} - ${fmtDate(context.timeEnd)}` : "Current Period";
    const comP = (context.compareStart && context.compareEnd) ? `${fmtDate(context.compareStart)} - ${fmtDate(context.compareEnd)}` : "Compare Period";

    if (isEcom) {
      const rootHeight = computeSubtreeHeight(currentTreeData, collapsedNodes);
      layoutTreeNodesLR(currentTreeData, 0, -rootHeight / 2, collapsedNodes, results, onViewTrends, context.platform, context.brand, context.sku, context.category, curP, comP);
    } else {
      const rootWidth = computeSubtreeWidth(currentTreeData, collapsedNodes);
      layoutTreeNodes(currentTreeData, -rootWidth / 2, 0, collapsedNodes, results, onViewTrends, context.platform, context.brand, context.sku, context.category, curP, comP);
    }

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
          prefetchedRows: prefetchedHoverData[n.id] || [],
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
  }, [currentTreeData, collapsedNodes, onToggleNode, handleCardClick, handleKpiClick, selectedNodeId, focusSet, onHover, hoveredNodeId, context.platform, context.brand, context.sku, context.category, context.channel, context.timeStart, context.timeEnd, context.compareStart, context.compareEnd, onViewTrends, prefetchedHoverData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  useEffect(() => {
    if (currentTreeData && !hasInitializedCollapse) {
      const isEcom = (context.channel || '').toLowerCase().includes('e-commerce')
        || (context.channel || '').toLowerCase().includes('ecom')
        || ['amazon', 'flipkart', 'blinkit', 'zepto', 'instamart'].includes((context.platform || '').toLowerCase());

      if (isEcom && currentTreeData.children) {
        // Collapse all direct children of the root to show only root + children initially
        const childrenToCollapse = currentTreeData.children.map(c => c.id);
        setCollapsedNodes(new Set(childrenToCollapse));
        setHasInitializedCollapse(true);
      }
    }
  }, [currentTreeData, hasInitializedCollapse, context.channel, context.platform, context.category]);

  useEffect(() => {
    // Reset initialization flag when platform or category changes to re-apply collapse to new data
    setHasInitializedCollapse(false);
  }, [context.platform, context.category]);

  useEffect(() => {
    if (!hasInitializedCollapse) {
      // Zoom logic ONLY for initial load - using 0.7 maxZoom to prevent "huge node" effect
      reactFlowInstance.fitView({ padding: 0.3, duration: 800, maxZoom: 0.7 });
      const t = setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.3, duration: 400, maxZoom: 0.7 });
      }, 100);
      return () => clearTimeout(t);
    }
    // Static camera after initialization: Clicking +/- will strictly toggle children WITHOUT moving the view
  }, [reactFlowInstance, currentTreeData, hasInitializedCollapse]);

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
          id={selectedKpiModalData.id}
          kpiLabel={selectedKpiModalData.label}
          category={selectedKpiModalData.category}
          platform={selectedKpiModalData.platform}
          selectedBrand={selectedKpiModalData.selectedBrand}
          selectedSku={selectedKpiModalData.selectedSku}
          selectedCategory={selectedKpiModalData.selectedCategory}
          focusedEntity={selectedKpiModalData.focusedEntity}
          context={selectedKpiModalData.context}
          initialRows={prefetchedHoverData[selectedKpiModalData.id] || []}
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
