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
import { motion, useSpring, useMotionValue } from "framer-motion";
import { Plus, Minus, Activity, Zap } from "lucide-react";
import axiosInstance from "../../../api/axiosInstance";
import RCACardMetric from "./RCACardMetric";
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
} from "@mui/material";

// --- Layout & Typography Tokens ---
const CARD_WIDTH = 380;
const HORIZONTAL_GAP = 70;
const VERTICAL_STEP = 340;

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
      top: -14,
      right: 20,
      backgroundColor: "#8b5cf6",
      color: "white",
      padding: "6px 14px",
      borderRadius: "14px",
      fontSize: "10px",
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "1.2px",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      zIndex: 11,
      boxShadow: "0 8px 20px rgba(139, 92, 246, 0.4)",
      border: "1.5px solid rgba(255, 255, 255, 0.4)",
    }}
  >
    <Zap size={11} fill="white" strokeWidth={3} />
    {text}
  </motion.div>
);

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
  } = data;

  const accentColor = COLORS[category] || COLORS.impressions;

  const isOutcome = importance === "outcome";
  const isPrimary = importance === "primary";

  const targetScale = isSelected ? 1.10 : 1;
  const targetLift = isSelected ? -10 : 0;

  const baseBorder = isOutcome ? `2.5px solid ${accentColor}` : isPrimary ? "2px solid #cbd5e1" : "2px solid #cbd5e1";
  const baseShadow = isOutcome
    ? "0 18px 44px -10px rgba(15, 23, 42, 0.22), 0 10px 22px -10px rgba(15, 23, 42, 0.14)"
    : "0 12px 32px -6px rgba(15, 23, 42, 0.18), 0 6px 16px -6px rgba(15, 23, 42, 0.12)";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 18 }}
      animate={{
        opacity: isDimmed ? 0.28 : 1,
        scale: targetScale,
        y: targetLift,
        filter: isDimmed ? "grayscale(0.25) blur(0.15px)" : "none",
      }}
      whileHover={{
        y: -18,
        scale: isDimmed ? 1 : 1.04,
        boxShadow: isDimmed
          ? baseShadow
          : `0 30px 60px -12px rgba(0, 0, 0, 0.15),
             0 18px 36px -18px rgba(0, 0, 0, 0.2),
             0 10px 20px -10px rgba(0, 0, 0, 0.1)`,
        border: isDimmed ? baseBorder : `2.5px solid ${accentColor}`,
      }}
      transition={{ type: "spring", damping: 12, stiffness: 70 }}
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
        zIndex: isSelected ? 30 : 10,
        transformOrigin: "center",
      }}
      onMouseEnter={() => onHover?.(data.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={(e) => {
        if (e.target.closest(".toggle-btn")) return;
        onClickDetail(data);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "transparent", border: "none", width: 0, height: 0, top: -8 }} />

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

      {hasChildren && (
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
            bottom: -20,
            left: "50%",
            marginLeft: -20,
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
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: "transparent", border: "none", width: 0, height: 0, bottom: -8 }} />
    </motion.div>
  );
};

// --- Mock Data ---
const INITIAL_TREE = {
  id: "root",
  label: "Offtake",
  value: "₹ 53.8 lac",
  change: "2.3%",
  isPositive: true,
  category: "offtake",
  importance: "outcome",
  insight: "Strong Growth",
  meta: [{ label: "Est. Category Share", value: "2.1%", change: "11.2%", isPositive: true }],
  children: [
    { id: "asp", label: "ASP", value: "₹ 189.2", change: "0.2%", isPositive: true, category: "price", importance: "primary", meta: [{ label: "Overall ASP", value: "₹ 185.0" }] },
    {
      id: "indexed-impressions",
      label: "Indexed Impressions",
      value: "3.4 lac",
      change: "12.8%",
      isPositive: false,
      category: "impressions",
      importance: "primary",
      insight: "Systemic Drop",
      meta: [{ label: "Overall SOS", value: "1.1%", change: "0.5%", isPositive: true }],
      children: [
        { id: "availability", label: "Wt. OSA %", value: "84.2%", change: "6.7%", isPositive: true, category: "availability", children: [{ id: "listing", label: "DS Listing %", value: "65.6%", change: "2.1%", isPositive: true, category: "availability" }] },
        {
          id: "organic-impressions",
          label: "Organic Impressions",
          value: "1.9 lac",
          change: "32.4%",
          isPositive: false,
          category: "organic",
          insight: "High Decline",
          meta: [{ label: "Organic SOS", value: "1.1%", change: "0.8%", isPositive: false }],
          children: [
            { id: "org-generic", label: "Generic Keywords", value: "1.1 lac", change: "23.7%", isPositive: false, category: "organic" },
            { id: "org-branded", label: "Branded Keywords", value: "69.4 K", change: "10.6%", isPositive: false, category: "organic" },
          ],
        },
      ],
    },
    {
      id: "indexed-cvr",
      label: "Indexed CVR",
      value: "5.7%",
      change: "22.3%",
      isPositive: true,
      category: "conversion",
      importance: "outcome",
      insight: "Efficiency High",
      children: [
        {
          id: "ad-impressions",
          label: "Ad Impressions",
          value: "1.5 lac",
          change: "11.4%",
          isPositive: false,
          category: "ad",
          meta: [{ label: "Ad SOS", value: "1.2%", change: "2.4%", isPositive: true }],
          children: [
            { id: "ad-branded", label: "Branded Keywords", value: "51.6 K", change: "3.7%", isPositive: false, category: "ad" },
            { id: "ad-comp", label: "Comp Keywords", value: "30.5 K", change: "22.5%", isPositive: true, category: "ad" },
          ],
        },
        { id: "discounting", label: "Wt. Disc %", value: "31.8%", change: "4.7%", isPositive: false, category: "discounting" },
        { id: "rating-count", label: "Rating Count", value: "1.8 lac", change: "11.6%", isPositive: true, category: "rating" },
      ],
    },
  ],
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

const layoutTreeNodes = (node, x, y, collapsedNodes, results) => {
  const isCollapsed = collapsedNodes.has(node.id);
  const subtreeWidth = computeSubtreeWidth(node, collapsedNodes);

  results.nodes.push({
    id: node.id,
    type: "kpi",
    position: { x: x + subtreeWidth / 2 - CARD_WIDTH / 2, y },
    data: {
      ...node,
      hasChildren: node.children?.length > 0,
      isCollapsed,
      onToggle: () => { },
      onClickDetail: () => { },
      onHover: () => { },
      isSelected: false,
      isDimmed: false,
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
        animated: false, // only animate focus path
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

      layoutTreeNodes(child, currentChildX, y + VERTICAL_STEP, collapsedNodes, results);
      currentChildX += childWidth + HORIZONTAL_GAP;
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
const RcaTreeInner = ({ context }) => {
  const [treeData, setTreeData] = useState(null);
  const [cardData, setCardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsedNodes, setCollapsedNodes] = useState(new Set(["listing", "ad-impressions"]));
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const reactFlowInstance = useReactFlow();

  useEffect(() => {
    const fetchRcaData = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get('/category-rca', { params: context });
        if (response.data) {
          setTreeData(response.data.tree);
          setCardData(response.data.cards);
        }
      } catch (error) {
        console.error('Error fetching RCA data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRcaData();
  }, [context]);

  const index = useMemo(() => treeData ? buildIndex(treeData) : { parent: new Map(), children: new Map() }, [treeData]);
  const focusId = selectedNodeId || hoveredNodeId;

  const focusSet = useMemo(() => {
    if (!focusId || !index) return null;
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
    if (!treeData) return { nodes: [], edges: [] };
    const results = { nodes: [], edges: [] };
    const rootWidth = computeSubtreeWidth(treeData, collapsedNodes);
    layoutTreeNodes(treeData, -rootWidth / 2, 0, collapsedNodes, results);

    const nodes = results.nodes.map((n) => {
      const isFocused = focusSet ? focusSet.has(n.id) : true;
      const dim = focusSet ? !isFocused : false;

      return {
        ...n,
        data: {
          ...n.data,
          onToggle: () => onToggleNode(n.id),
          onClickDetail: handleCardClick,
          onHover,
          isSelected: selectedNodeId === n.id,
          isDimmed: dim,
        },
        style: { zIndex: selectedNodeId === n.id ? 30 : 3 },
      };
    });

    const edges = results.edges.map((e) => {
      const inFocus = focusSet ? focusSet.has(e.source) && focusSet.has(e.target) : true;
      return {
        ...e,
        animated: inFocus && !!focusSet, // animate only when focused
        style: {
          ...(e.style || {}),
          stroke: inFocus ? "rgba(15,23,42,0.85)" : "rgba(15,23,42,0.18)",
          strokeWidth: inFocus ? 3.3 : 2.0,
          strokeDasharray: inFocus ? "6,6" : "4,8",
        },
        markerEnd: {
          ...(e.markerEnd || {}),
          color: inFocus ? "rgba(15,23,42,0.8)" : "rgba(15,23,42,0.35)",
          width: inFocus ? 16 : 12,
          height: inFocus ? 16 : 12,
        },
      };
    });

    return { nodes, edges };
  }, [treeData, collapsedNodes, onToggleNode, handleCardClick, selectedNodeId, focusSet, onHover]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  useEffect(() => {
    reactFlowInstance.fitView?.({ padding: 0.22, duration: 350 });
    const t = setTimeout(() => {
      const current = reactFlowInstance.getZoom ? reactFlowInstance.getZoom() : 1;
      reactFlowInstance.zoomTo?.(Math.min(1.12, current * 1.03), { duration: 240 });
    }, 360);
    return () => clearTimeout(t);
  }, [reactFlowInstance]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", cursor: "none" }}>
      <CoolGreyBackground />
      <MagicCursor />

      {/* Dynamic Header Metrics - Removed per user request */}

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="h4" fontWeight={900} color="primary.main">Analyzing Market Vectors...</Typography>
        </Box>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{ animated: false, type: "step" }}
        >
          <Controls
            showInteractive={false}
            style={{
              borderRadius: "20px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.8)",
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.06)",
            }}
          />
        </ReactFlow>
      )}

      <NodeDetailPopup open={detailOpen} onClose={() => setDetailOpen(false)} nodeData={selectedNode} />
    </div>
  );
};

export default function RCATree({ context }) {
  return (
    <ReactFlowProvider>
      <RcaTreeInner context={context} />
    </ReactFlowProvider>
  );
}
