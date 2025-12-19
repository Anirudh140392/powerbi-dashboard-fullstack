import React, { useState, useCallback, useMemo } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    addEdge,
    ConnectionLineType,
    MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    Minus,
    Info,
    BarChart3,
    ChevronRight,
    ExternalLink,
    Target,
    Zap,
    TrendingUp,
    Tag,
    Search,
    Maximize2
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
    offtake: "#000000",
    price: "#3b82f6",
    impressions: "#3b82f6",
    availability: "#10b981",
    organic: "#3b82f6",
    ad: "#3b82f6",
    discounting: "#1d4ed8",
    segment: "#64748b",
    rating: "#64748b",
    conversion: "#10b981",
};

// --- Helper Components ---
const DeltaBadge = ({ change, isPositive, small = false }) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: isPositive ? '#dcfce7' : '#fee2e2',
            color: isPositive ? '#166534' : '#991b1b',
            px: 1,
            py: 0.25,
            borderRadius: '4px',
            fontSize: small ? '10px' : '11px',
            fontWeight: 700,
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
        isRoot = false
    } = data;

    const headerColor = COLORS[category] || COLORS.impressions;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
            style={{
                width: 260,
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
                cursor: 'default',
                position: 'relative'
            }}
            onClick={(e) => {
                if (e.target.closest('.toggle-btn')) return;
                onClickDetail(data);
            }}
        >
            <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />

            <Box sx={{
                bgcolor: isRoot ? '#18181b' : headerColor,
                px: 2,
                py: 0.75,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#fff'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {label}
                    </Typography>
                    <Info size={12} style={{ opacity: 0.8 }} />
                </Box>
                <BarChart3 size={14} style={{ opacity: 0.8 }} />
            </Box>

            <Box sx={{ p: 2, bgcolor: isRoot ? '#18181b' : '#fff', color: isRoot ? '#fff' : '#1e293b' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Typography sx={{ fontSize: '24px', fontWeight: 800, lineHeight: 1 }}>
                        {value}
                    </Typography>
                    <DeltaBadge change={change} isPositive={isPositive} />
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {meta.map((m, idx) => (
                        <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: '11px', color: isRoot ? '#a1a1aa' : '#64748b' }}>
                                {m.label}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: isRoot ? '#fff' : '#1e293b' }}>
                                {m.value}
                                {m.change && (
                                    <span style={{ color: m.isPositive ? '#16a34a' : '#dc2626', marginLeft: '6px' }}>
                                        {m.isPositive ? '▲' : '▼'} {m.change}
                                    </span>
                                )}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Box>

            {hasChildren && (
                <Box
                    className="toggle-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                    }}
                    sx={{
                        position: 'absolute',
                        right: -14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: '#fff',
                        border: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        '&:hover': { bgcolor: '#f9fafb' }
                    }}
                >
                    {isCollapsed ? <Plus size={16} color="#64748b" /> : <Minus size={16} color="#64748b" />}
                </Box>
            )}

            <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
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
            meta: [{ label: "Overall ASP", value: "₹ 185.0" }]
        },
        {
            id: "indexed-impressions",
            label: "Indexed Impressions",
            value: "3.4 lac",
            change: "12.8%",
            isPositive: false,
            category: "impressions",
            meta: [{ label: "Overall SOV", value: "1.1%", change: "0.5%", isPositive: true }],
            children: [
                {
                    id: "availability",
                    label: "Wt. OSA %",
                    value: "84.2%",
                    change: "6.7%",
                    isPositive: true,
                    category: "availability",
                    children: [
                        {
                            id: "listing",
                            label: "DS Listing %",
                            value: "65.6%",
                            change: "2.1%",
                            isPositive: true,
                            category: "availability"
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
                    meta: [{ label: "Organic SOV", value: "1.1%", change: "0.8%", isPositive: false }],
                    children: [
                        { id: "org-generic", label: "Generic Keywords", value: "1.1 lac", change: "23.7%", isPositive: false, category: "organic", meta: [{ label: "SOV", value: "1.1%", change: "0.3%", isPositive: false }] },
                        { id: "org-branded", label: "Branded Keywords", value: "69.4 K", change: "10.6%", isPositive: false, category: "organic", meta: [{ label: "SOV", value: "54.5%", change: "1.2%", isPositive: true }] },
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
            children: [
                {
                    id: "ad-impressions",
                    label: "Ad Impressions",
                    value: "1.5 lac",
                    change: "11.4%",
                    isPositive: false,
                    category: "ad",
                    meta: [{ label: "Ad SOV", value: "1.2%", change: "2.4%", isPositive: true }],
                    children: [
                        { id: "ad-branded", label: "Branded Keywords", value: "51.6 K", change: "3.7%", isPositive: false, category: "ad", meta: [{ label: "SOV", value: "88.4%", change: "1.4%", isPositive: true }] },
                        { id: "ad-comp", label: "Comp Keywords", value: "30.5 K", change: "22.5%", isPositive: true, category: "ad", meta: [{ label: "SOV", value: "0.9%", change: "10.3%", isPositive: true }] }
                    ]
                },
                {
                    id: "discounting",
                    label: "Wt. Disc %",
                    value: "31.8%",
                    change: "4.7%",
                    isPositive: false,
                    category: "discounting"
                },
                {
                    id: "rating-count",
                    label: "Rating Count",
                    value: "1.8 lac",
                    change: "11.6%",
                    isPositive: true,
                    category: "rating"
                }
            ]
        }
    ]
};

const nodeTypes = {
    kpi: KpiNode,
};

// --- Layout Engine (Smart Height Aggregation) ---
const VERTICAL_STEP = 340;
const HORIZONTAL_STEP = 420;

const computeSubtreeHeight = (node, collapsedNodes) => {
    if (!node.children || node.children.length === 0 || collapsedNodes.has(node.id)) {
        return VERTICAL_STEP;
    }
    return node.children.reduce((total, child) => total + computeSubtreeHeight(child, collapsedNodes), 0);
};

const layoutTreeNodes = (node, x, y, collapsedNodes, results) => {
    const isCollapsed = collapsedNodes.has(node.id);
    const subtreeHeight = computeSubtreeHeight(node, collapsedNodes);

    const currentNode = {
        id: node.id,
        type: "kpi",
        position: { x, y: y + subtreeHeight / 2 - VERTICAL_STEP / 2 },
        data: {
            ...node,
            hasChildren: node.children?.length > 0,
            isCollapsed,
            onToggle: () => { }, // Injected later
            onClickDetail: () => { }, // Injected later
        },
    };
    results.nodes.push(currentNode);

    if (node.children && !isCollapsed) {
        let currentChildY = y;
        node.children.forEach(child => {
            const childHeight = computeSubtreeHeight(child, collapsedNodes);

            results.edges.push({
                id: `${node.id}-${child.id}`,
                source: node.id,
                target: child.id,
                type: ConnectionLineType.SmoothStep,
                animated: true,
                style: { stroke: '#94a3b8', strokeWidth: 2, borderRadius: 20 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 12, height: 12 }
            });

            layoutTreeNodes(child, x + HORIZONTAL_STEP, currentChildY, collapsedNodes, results);
            currentChildY += childHeight;
        });
    }
};

const NodeDetailPopup = ({ open, onClose, nodeData }) => {
    if (!nodeData) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ p: 1, borderRadius: '8px', bgcolor: COLORS[nodeData.category] + '15', color: COLORS[nodeData.category] }}>
                        <TrendingUp size={20} />
                    </Box>
                    <Typography variant="h6" fontWeight={700}>{nodeData.label} Detail</Typography>
                </Box>
                <IconButton onClick={onClose} size="small"><Plus style={{ transform: 'rotate(45deg)' }} /></IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Grid container spacing={3}>
                    <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Current Value</Typography>
                        <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>{nodeData.value}</Typography>
                        <Box sx={{ mt: 1 }}>
                            <DeltaBadge change={nodeData.change} isPositive={nodeData.isPositive} />
                        </Box>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Data Source</Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>keyword_performance_v4</Typography>
                    </Grid>

                    <Grid item xs={12}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Breakdown Analysis</Typography>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {nodeData.meta?.map((m, i) => (
                                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">{m.label}</Typography>
                                        <Typography variant="body2" fontWeight={700}>{m.value}</Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </DialogContent>
        </Dialog>
    );
};

// --- Internal RCATree Component ---
const RcaTreeInner = ({ title }) => {
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

        // Inject handlers
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

    React.useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <Box sx={{
                position: 'absolute',
                top: 24,
                left: 24,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 2
            }}>
                <Box sx={{
                    bgcolor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    px: 3,
                    py: 1.5,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                }}>
                    <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#64748b' }}>
                        Root Cause Analysis for
                    </Typography>
                    <Box sx={{ bgcolor: '#e0f2fe', color: '#0369a1', px: 1.5, py: 0.5, borderRadius: '8px', fontSize: '15px', fontWeight: 700 }}>
                        {title || "All x Delhi-NCR"}
                    </Box>
                </Box>

            </Box>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.2}
                maxZoom={2}
            >
                <Background color="#94a3b8" variant="dots" gap={20} size={1} />
                <Controls showInteractive={false} />
                <MiniMap
                    nodeStrokeWidth={3}
                    zoomable pannable
                    maskColor="rgba(248, 250, 252, 0.7)"
                    style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
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

export default function RCATree({ title }) {
    return (
        <ReactFlowProvider>
            <div className="h-full w-full">
                <RcaTreeInner title={title} />
            </div>
        </ReactFlowProvider>
    );
}
