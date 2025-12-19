import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    ConnectionLineType,
    MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import {
    Plus,
    Minus,
    Info,
    BarChart3,
    TrendingUp,
    Search,
    Activity,
    AlertCircle,
    Zap,
    MousePointer2
} from "lucide-react";
import {
    Box,
    Typography,
    Tooltip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    Paper,
    Divider,
    Grid
} from "@mui/material";

// --- Types & Constants ---
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

    // Smooth trailing effect
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
        <Box sx={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999 }}>
            {/* Soft Charcoal Glow Trail */}
            <motion.div
                style={{
                    position: 'absolute',
                    top: -60,
                    left: -60,
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(15, 23, 42, 0.08) 0%, rgba(15, 23, 42, 0) 70%)',
                    x: trailX,
                    y: trailY,
                }}
            />
            {/* Sharp Indigo Ring */}
            <motion.div
                style={{
                    position: 'absolute',
                    top: -12,
                    left: -12,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: '2.5px solid rgba(79, 70, 229, 0.8)',
                    boxShadow: '0 0 10px rgba(79, 70, 229, 0.2)',
                    x: cursorX,
                    y: cursorY,
                }}
            />
        </Box>
    );
};

// --- Cool Grey Studio Background ---
const CoolGreyBackground = () => (
    <Box sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        background: '#ffffff', // Pure white
    }} />
);


// --- AI Insight Badge ---
const AiInsightBadge = ({ text }) => (
    <motion.div
        animate={{
            boxShadow: ['0 0 0px rgba(139, 92, 246, 0)', '0 0 15px rgba(139, 92, 246, 0.6)', '0 0 0px rgba(139, 92, 246, 0)'],
            scale: [1, 1.05, 1]
        }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
            position: 'absolute',
            top: -14,
            right: 20,
            backgroundColor: '#8b5cf6',
            color: 'white',
            padding: '6px 14px',
            borderRadius: '14px',
            fontSize: '10px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 11,
            boxShadow: '0 8px 20px rgba(139, 92, 246, 0.4)',
            border: '1.5px solid rgba(255, 255, 255, 0.4)'
        }}
    >
        <Zap size={11} fill="white" strokeWidth={3} />
        {text}
    </motion.div>
);

// --- Context Ribbon ---
const ContextRibbon = ({ context }) => {
    const { platform, category, brand, sku, month } = context || {};

    const chipStyle = {
        px: 2,
        py: 0.8,
        borderRadius: '12px',
        bgcolor: 'rgba(15, 23, 42, 0.05)',
        border: '1px solid rgba(15, 23, 42, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.2
    };

    const labelStyle = {
        fontSize: '9px',
        fontWeight: 900,
        color: 'rgba(15, 23, 42, 0.4)',
        textTransform: 'uppercase',
        letterSpacing: '1px'
    };

    const valueStyle = {
        fontSize: '12px',
        fontWeight: 900,
        color: '#0f172a',
        letterSpacing: '-0.3px'
    };

    return (
        <Box sx={{
            position: 'absolute',
            top: 30,
            left: 30,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.2,
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
        }}>
            <Box sx={{ ...chipStyle, bgcolor: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.15)' }}>
                <Typography sx={labelStyle}>Platform</Typography>
                <Typography sx={valueStyle}>{platform}</Typography>
            </Box>
            <Box sx={chipStyle}>
                <Typography sx={labelStyle}>Category</Typography>
                <Typography sx={valueStyle}>{category}</Typography>
            </Box>
            <Box sx={chipStyle}>
                <Typography sx={labelStyle}>Brand</Typography>
                <Typography sx={valueStyle}>{brand}</Typography>
            </Box>
            {sku && sku !== 'All SKUs' && (
                <Box sx={chipStyle}>
                    <Typography sx={labelStyle}>SKU Selection</Typography>
                    <Typography sx={{ ...valueStyle, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sku}</Typography>
                </Box>
            )}
            <Box sx={chipStyle}>
                <Typography sx={labelStyle}>Fiscal Period</Typography>
                <Typography sx={valueStyle}>{month}</Typography>
            </Box>
        </Box>
    );
};

// --- Sparkline Component ---
const Sparkline = ({ data = [30, 45, 35, 60, 55, 80, 70], color = "#3b82f6" }) => {
    const width = 100;
    const height = 30;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const points = data.map((d, i) => ({
        x: (i / (data.length - 1)) * width,
        y: height - ((d - min) / range) * height
    }));

    const path = `M ${points.map(p => `${p.x},${p.y}`).join(" L ")}`;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d={`${path} L ${width},${height} L 0,${height} Z`}
                fill={`url(#gradient-${color})`}
                stroke="none"
            />
        </svg>
    );
};

const StatusDot = ({ status = "healthy" }) => {
    const color = status === "healthy" ? "#10b981" : status === "warning" ? "#f59e0b" : "#f43f5e";
    return (
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div
                animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                style={{
                    position: 'absolute',
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: color,
                }}
            />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, zIndex: 1, border: '2px solid rgba(255,255,255,0.9)' }} />
        </Box>
    );
};

const DeltaBadge = ({ change, isPositive, small = false }) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: isPositive ? 'rgba(20, 184, 166, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: isPositive ? '#0d9488' : '#e11d48',
            px: 1.5,
            py: 0.6,
            borderRadius: '24px',
            fontSize: small ? '10px' : '12px',
            fontWeight: 900,
            border: `1px solid ${isPositive ? 'rgba(20, 184, 166, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            fontFamily: 'inherit'
        }}
    >
        {isPositive ? '▲' : '▼'} {change}
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
        trend = [30, 45, 32, 55, 48, 70, 65],
        status = "healthy",
        insight = null,
        isRoot = false
    } = data;

    const accentColor = COLORS[category] || COLORS.impressions;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            whileHover={{
                y: -35, // Extreme liftoff for 3D depth
                scale: 1.06,
                boxShadow: `
                    0 30px 60px -12px rgba(0, 0, 0, 0.15),
                    0 18px 36px -18px rgba(0, 0, 0, 0.2),
                    0 10px 20px -10px rgba(0, 0, 0, 0.1)
                `,
                border: `2px solid ${accentColor}`
            }}
            transition={{ type: "spring", damping: 8, stiffness: 70 }}
            style={{
                width: 300,
                backgroundColor: '#ffffff', // Solid white for extreme contrast
                borderRadius: '32px',
                border: '2px solid #ffffff',
                overflow: 'visible',
                fontFamily: '"Outfit", "Inter", sans-serif',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: `
                    0 10px 30px -5px rgba(0, 0, 0, 0.08),
                    0 4px 12px -5px rgba(0, 0, 0, 0.1)
                ` // Deep base shadow for 3D effect on light grey
            }}
            onClick={(e) => {
                if (e.target.closest('.toggle-btn')) return;
                onClickDetail(data);
            }}
        >
            <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />

            {insight && <AiInsightBadge text={insight} />}

            <Box sx={{
                p: 2.5,
                pb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '4px',
                        bgcolor: accentColor,
                        boxShadow: `0 0 12px ${accentColor}60`
                    }} />
                    <Typography sx={{ fontSize: '13px', fontWeight: 900, color: '#000000', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                        {label}
                    </Typography>
                </Box>
                <StatusDot status={isPositive ? "healthy" : "warning"} />
            </Box>

            <Box sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                    <Box>
                        <Typography sx={{ fontSize: '38px', fontWeight: 900, color: '#000000', lineHeight: 1, mb: 1.5, letterSpacing: '-1.5px' }}>
                            {value}
                        </Typography>
                        <DeltaBadge change={change} isPositive={isPositive} />
                    </Box>
                    <Box sx={{ mt: 2 }}>
                        <Sparkline data={trend} color={accentColor} />
                    </Box>
                </Box>

                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    p: 2.2,
                    borderRadius: '20px',
                    border: '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                    {meta.map((m, idx) => (
                        <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: '11px', fontWeight: 900, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase' }}>
                                {m.label}
                            </Typography>
                            <Typography sx={{ fontSize: '12.5px', fontWeight: 900, color: '#000000' }}>
                                {m.value}
                                {m.change && (
                                    <span style={{
                                        color: m.isPositive ? '#0d9488' : '#e11d48',
                                        marginLeft: '10px',
                                        fontSize: '11px',
                                        fontWeight: 900
                                    }}>
                                        {m.isPositive ? '↑' : '↓'} {m.change}
                                    </span>
                                )}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Box>

            {hasChildren && (
                <motion.div
                    className="toggle-btn"
                    whileHover={{ scale: 1.25, rotate: 90, backgroundColor: '#4f46e5', color: '#fff' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                    }}
                    style={{
                        position: 'absolute',
                        bottom: -22,
                        left: '50%',
                        marginLeft: -22,
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        color: '#64748b',
                        border: '2px solid rgba(255, 255, 255, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 15,
                        boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.15)',
                        transition: 'color 0.2s, background-color 0.2s'
                    }}
                >
                    {isCollapsed ? <Plus size={24} strokeWidth={3} /> : <Minus size={24} strokeWidth={3} />}
                </motion.div>
            )}

            <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
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
    isRoot: true,
    insight: "Strong Growth",
    trend: [40, 45, 42, 50, 55, 60, 58],
    meta: [
        { label: "Est. Category Share", value: "2.1%", change: "11.2%", isPositive: true }
    ],
    children: [
        {
            id: "asp",
            label: "ASP",
            value: "₹ 189.2",
            change: "0.2%",
            isPositive: true,
            category: "price",
            trend: [188, 189, 188.5, 189.2, 189, 189.2, 189.2],
            meta: [{ label: "Overall ASP", value: "₹ 185.0" }]
        },
        {
            id: "indexed-impressions",
            label: "Indexed Impressions",
            value: "3.4 lac",
            change: "12.8%",
            isPositive: false,
            category: "impressions",
            insight: "Systemic Drop",
            trend: [4.2, 4.0, 3.8, 3.6, 3.5, 3.4, 3.4],
            meta: [{ label: "Overall SOV", value: "1.1%", change: "0.5%", isPositive: true }],
            children: [
                {
                    id: "availability",
                    label: "Wt. OSA %",
                    value: "84.2%",
                    change: "6.7%",
                    isPositive: true,
                    category: "availability",
                    trend: [78, 80, 82, 81, 83, 84, 84.2],
                    children: [
                        {
                            id: "listing",
                            label: "DS Listing %",
                            value: "65.6%",
                            change: "2.1%",
                            isPositive: true,
                            category: "availability",
                            trend: [62, 63, 64, 65, 65, 65.6, 65.6],
                        }
                    ]
                },
                {
                    id: "organic-impressions",
                    label: "Organic Impressions",
                    value: "1.9 lac",
                    change: "32.4%",
                    isPositive: false,
                    category: "organic",
                    insight: "High Decline",
                    trend: [2.8, 2.5, 2.2, 2.1, 2.0, 1.9, 1.9],
                    meta: [{ label: "Organic SOV", value: "1.1%", change: "0.8%", isPositive: false }],
                    children: [
                        { id: "org-generic", label: "Generic Keywords", value: "1.1 lac", change: "23.7%", isPositive: false, category: "organic", trend: [1.5, 1.4, 1.3, 1.2, 1.1, 1.1, 1.1] },
                        { id: "org-branded", label: "Branded Keywords", value: "69.4 K", change: "10.6%", isPositive: false, category: "organic", trend: [80, 78, 75, 72, 70, 69.4, 69.4] },
                    ]
                }
            ]
        },
        {
            id: "indexed-cvr",
            label: "Indexed CVR",
            value: "5.7%",
            change: "22.3%",
            isPositive: true,
            category: "conversion",
            insight: "Efficiency High",
            trend: [4.2, 4.5, 4.8, 5.0, 5.2, 5.5, 5.7],
            children: [
                {
                    id: "ad-impressions",
                    label: "Ad Impressions",
                    value: "1.5 lac",
                    change: "11.4%",
                    isPositive: false,
                    category: "ad",
                    trend: [1.8, 1.7, 1.6, 1.6, 1.5, 1.5, 1.5],
                    meta: [{ label: "Ad SOV", value: "1.2%", change: "2.4%", isPositive: true }],
                    children: [
                        { id: "ad-branded", label: "Branded Keywords", value: "51.6 K", change: "3.7%", isPositive: false, category: "ad", trend: [55, 54, 53, 52, 52, 51.6, 51.6] },
                        { id: "ad-comp", label: "Comp Keywords", value: "30.5 K", change: "22.5%", isPositive: true, category: "ad", trend: [24, 26, 28, 29, 30, 30.5, 30.5] }
                    ]
                },
                {
                    id: "discounting",
                    label: "Wt. Disc %",
                    value: "31.8%",
                    change: "4.7%",
                    isPositive: false,
                    category: "discounting",
                    trend: [34, 33, 33, 32, 32, 31.8, 31.8],
                },
                {
                    id: "rating-count",
                    label: "Rating Count",
                    value: "1.8 lac",
                    change: "11.6%",
                    isPositive: true,
                    category: "rating",
                    trend: [1.5, 1.6, 1.6, 1.7, 1.7, 1.8, 1.8],
                }
            ]
        }
    ]
};

const nodeTypes = {
    kpi: KpiNode,
};

// --- Layout Engine ---
const VERTICAL_STEP = 420;
const HORIZONTAL_STEP = 340;

const computeSubtreeWidth = (node, collapsedNodes) => {
    if (!node.children || node.children.length === 0 || collapsedNodes.has(node.id)) {
        return HORIZONTAL_STEP;
    }
    return node.children.reduce((total, child) => total + computeSubtreeWidth(child, collapsedNodes), 0);
};

const layoutTreeNodes = (node, x, y, collapsedNodes, results) => {
    const isCollapsed = collapsedNodes.has(node.id);
    const subtreeWidth = computeSubtreeWidth(node, collapsedNodes);

    const currentNode = {
        id: node.id,
        type: "kpi",
        position: { x: x + subtreeWidth / 2 - 150, y },
        data: {
            ...node,
            hasChildren: node.children?.length > 0,
            isCollapsed,
            onToggle: () => { },
            onClickDetail: () => { },
        },
    };
    results.nodes.push(currentNode);

    if (node.children && !isCollapsed) {
        let currentChildX = x;
        node.children.forEach(child => {
            const childWidth = computeSubtreeWidth(child, collapsedNodes);

            results.edges.push({
                id: `${node.id}-${child.id}`,
                source: node.id,
                target: child.id,
                type: ConnectionLineType.SmoothStep,
                animated: true,
                style: { stroke: 'rgba(100, 116, 139, 0.15)', strokeWidth: 3.5, borderRadius: 32, strokeDasharray: '8,8' },
                markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(100, 116, 139, 0.3)', width: 18, height: 18 }
            });

            layoutTreeNodes(child, currentChildX, y + VERTICAL_STEP, collapsedNodes, results);
            currentChildX += childWidth;
        });
    }
};

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
                    borderRadius: '40px',
                    bgcolor: 'rgba(255, 255, 255, 0.88)',
                    backdropFilter: 'blur(30px) saturate(170%)',
                    border: '1px solid rgba(255, 255, 255, 0.7)',
                    boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.3)',
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, p: 5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Box sx={{
                        p: 2,
                        borderRadius: '20px',
                        bgcolor: COLORS[nodeData.category] + '18',
                        color: COLORS[nodeData.category],
                        boxShadow: `inset 0 0 15px ${COLORS[nodeData.category]}25`
                    }}>
                        <Activity size={32} strokeWidth={2.5} />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.8px' }}>{nodeData.label} Intelligence</Typography>
                        <Typography sx={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.2px' }}>High Precision Diagnostic Stream</Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ bgcolor: 'rgba(0,0,0,0.05)', color: '#0f172a', width: 44, height: 44, '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' } }}>
                    <Plus style={{ transform: 'rotate(45deg)' }} size={28} />
                </IconButton>
            </DialogTitle>
            <Divider sx={{ opacity: 0.08 }} />
            <DialogContent sx={{ p: 5 }}>
                <Grid container spacing={6}>
                    <Grid item xs={6}>
                        <Typography sx={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', mb: 2, letterSpacing: '1.5px' }}>Metric Magnitude</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                            <Typography sx={{ fontSize: '48px', fontWeight: 900, color: '#0f172a', lineHeight: 1, letterSpacing: '-2px' }}>{nodeData.value}</Typography>
                            <DeltaBadge change={nodeData.change} isPositive={nodeData.isPositive} />
                        </Box>
                    </Grid>

                    <Grid item xs={12}>
                        <Box sx={{ p: 3, bgcolor: 'rgba(99, 102, 241, 0.08)', borderRadius: '24px', border: '1px solid rgba(99, 102, 241, 0.15)', mb: 4 }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 900, color: '#4f46e5', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 1.2, letterSpacing: '1px' }}>
                                <Zap size={16} fill="#4f46e5" /> Predictive Insight
                            </Typography>
                            <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', mt: 1.5, lineHeight: 1.6 }}>
                                Automated root cause detected: Deviation in {nodeData.label} suggests a {nodeData.isPositive ? 'positive' : 'negative'} trend across modern trade channels. Investigation into 'Quick Commerce' regional OSA is highly recommended.
                            </Typography>
                        </Box>

                        <Typography sx={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', mb: 3, textTransform: 'uppercase', letterSpacing: '1.2px' }}>Structural Attributes</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                            {nodeData.meta?.map((m, i) => (
                                <Paper key={i} elevation={0} sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.05)', transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-5px)', bgcolor: '#fff' } }}>
                                    <Typography sx={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'block', mb: 1, letterSpacing: '0.5px' }}>{m.label}</Typography>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.5px' }}>{m.value}</Typography>
                                    {m.change && (
                                        <Typography sx={{ fontSize: '11px', fontWeight: 900, color: m.isPositive ? '#0d9488' : '#e11d48', mt: 1 }}>
                                            {m.isPositive ? '↑' : '↓'} {m.change} WoW Momentum
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
const RcaTreeInner = ({ title, context }) => {
    const [collapsedNodes, setCollapsedNodes] = useState(new Set(["listing", "ad-impressions"]));
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);

    const onToggleNode = useCallback((id) => {
        setCollapsedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleCardClick = (data) => {
        setSelectedNode(data);
        setDetailOpen(true);
    };

    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        const results = { nodes: [], edges: [] };
        layoutTreeNodes(INITIAL_TREE, 0, 0, collapsedNodes, results);

        const nodes = results.nodes.map(n => ({
            ...n,
            data: {
                ...n.data,
                onToggle: () => onToggleNode(n.id),
                onClickDetail: handleCardClick
            }
        }));

        return { nodes, edges: results.edges };
    }, [collapsedNodes, onToggleNode]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    return (
        <div style={{
            width: "100%",
            height: "100%",
            position: "relative",
            cursor: 'none' // Hide default cursor because we have MagicCursor
        }}>
            <CoolGreyBackground />
            <MagicCursor />
            <ContextRibbon context={context} />


            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.2}
                maxZoom={2}
                style={{ zIndex: 1 }}
                defaultEdgeOptions={{
                    animated: true,
                    type: 'smoothstep'
                }}
            >

                <Controls
                    showInteractive={false}
                    style={{
                        borderRadius: '20px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.8)',
                        background: 'rgba(255,255,255,0.7)',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.06)'
                    }}
                />
                <MiniMap
                    nodeColor={(n) => {
                        if (n.data?.isRoot) return '#1e293b';
                        return COLORS[n.data?.category] || '#6366f1';
                    }}
                    nodeStrokeWidth={5}
                    zoomable pannable
                    maskColor="rgba(241, 245, 249, 0.5)"
                    style={{
                        borderRadius: '24px',
                        border: '1px solid rgba(255,255,255,0.9)',
                        background: 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: 'blur(16px)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.06)'
                    }}
                />
            </ReactFlow>

            <NodeDetailPopup
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                nodeData={selectedNode}
            />
        </div>
    );
};

export default function RCATree({ title, context }) {
    return (
        <ReactFlowProvider>
            <RcaTreeInner title={title} context={context} />
        </ReactFlowProvider>
    );
}
