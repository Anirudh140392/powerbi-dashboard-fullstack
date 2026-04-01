import React, { useMemo, useState, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Sparkles,
    Radar,
    BadgePercent,
    Megaphone,
    Truck,
    BrainCircuit,
    Activity,
    BarChart3,
    Loader2,
    ChevronRight,
    Search,
    Filter,
    TrendingUp,
    TrendingDown,
    Zap,
    Signal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import CommonContainer from "@/components/CommonLayout/CommonContainer";
import { FilterContext } from "@/utils/FilterContext";
import { fetchInsights, fetchInsightsFilters } from "@/api/insightsService";
import CustomHeaderDropdown from "@/components/CommonLayout/CustomHeaderDropdown";
import DateRangeComparePicker from "@/components/CommonLayout/DateRangeComparePicker";
import dayjs from "dayjs";
import { Box, Typography } from "@mui/material";

// ─── HELPERS ────────────────────────────────────────────────────────────────

const formatINRCompact = (n) => {
    if (typeof n !== "number") return "-";
    const abs = Math.abs(n);
    if (abs >= 1e7) return `₹${(n / 1e7).toFixed(1)} Cr`;
    if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)} lac`;
    if (abs >= 1e3) return `₹${(n / 1e3).toFixed(0)} K`;
    return `₹${n.toFixed(0)}`;
};

const safePct = (v) => (typeof v === "number" ? `${v.toFixed(1)}%` : "-");
const safeINR = (v) => (typeof v === "number" ? formatINRCompact(v) : "-");

// ─── SIGNAL CONFIG ───────────────────────────────────────────────────────────

const SIGNAL_META = {
    "Share Headroom Hotspots": {
        family: "Market Share",
        color: "#4a6fa5", accent: "#e8eef6",
        FamilyIcon: BarChart3, metricKey: "impactInr",
        metricLabel: "Offtake Loss Impact", trend: "negative",
    },
    "Price Parity Radar": {
        family: "Pricing Positioning",
        color: "#3d7a8a", accent: "#e4f0f3",
        FamilyIcon: BadgePercent, metricKey: "impactInr",
        metricLabel: "Opportunity Available", trend: "positive",
    },
    "Replenishment Breaks": {
        family: "Supply Chain",
        color: "#6b5ea8", accent: "#eeebf8",
        FamilyIcon: Truck, metricKey: "impactInr",
        metricLabel: "Excess Inventory Value", trend: "negative",
    },
    "Competitor OSA Weak Spots": {
        family: "Competitive Landscape",
        color: "#3a7d68", accent: "#e3f1ec",
        FamilyIcon: Radar, metricKey: "impactInr",
        metricLabel: "Opportunity Available", trend: "positive",
    },
    "Ad Stock Mismatch": {
        family: "Performance Marketing",
        color: "#8a6a3d", accent: "#f3ede3",
        FamilyIcon: Megaphone, metricKey: "impactInr",
        metricLabel: "Ad Efficiency Loss", trend: "negative",
    },
    "Keyword Efficiency and Budget Caps": {
        family: "Performance Marketing",
        color: "#8a6a3d", accent: "#f3ede3",
        FamilyIcon: Megaphone, metricKey: "impactInr",
        metricLabel: "Wasted Ad Spend", trend: "negative",
    },
    "Challenger Launch Watch": {
        family: "Competitive Landscape",
        color: "#7a5c6e", accent: "#f0e9ee",
        FamilyIcon: Radar, metricKey: "impactInr",
        metricLabel: "Missed Opportunity", trend: "negative",
    },
};

const REQUIRED_SIGNAL_TYPES = Object.keys(SIGNAL_META);

// ─── EMPTY SIGNAL FACTORY ────────────────────────────────────────────────────

const createEmptySignal = (type, brandName = "Brand") => {
    const base = {
        id: `empty_${type.replace(/\s+/g, "_")}`,
        type,
        title: "No data detected",
        family: SIGNAL_META[type]?.family || "Market",
        platforms: ["-"],
        city: "-",
        category: "-",
        impactInr: 0,
        brandName,
        kpis: [],
        whatWeSee: ["-", "-"],
        evidence: [],
    };

    switch (type) {
        case "Competitor OSA Weak Spots":
            base.kpis = [{ label: "Other brand OSA", value: "0%" }, { label: `${brandName} OSA`, value: "0%" }, { label: "Cities", value: "0" }];
            base.evidence = [{ category: "-", city: "-", skuOrBrand: "-", otherBrandOsa: 0, kwOsa: 0 }];
            break;
        case "Ad Stock Mismatch":
            base.kpis = [{ label: `${brandName} OSA (avg)`, value: "0%" }, { label: "Ad SOV", value: "0%" }, { label: "Spend", value: "₹0" }];
            base.evidence = [{ city: "-", skuOrBrand: "-", kwOsa: 0, adSov: 0, spendInr: 0, estLostSalesInr: 0 }];
            break;
        case "Price Parity Radar":
            base.kpis = [{ label: "Price index", value: "0" }, { label: "Cluster share", value: "0%" }, { label: "Cluster growth", value: "0%" }];
            base.evidence = [{ city: "-", category: "-", clusterName: "-", kwPpu: 0, peerPpu: 0, priceIndex: 0, clusterContributionPct: 0, clusterGrowthPct: 0 }];
            break;
        case "Share Headroom Hotspots":
            base.kpis = [{ label: "Cities", value: "0" }, { label: "Avg share gap", value: "0%" }, { label: "Offtake Loss", value: "₹0" }];
            base.evidence = [{ city: "-", category: "-", brandOsa: 0, marketShare: 0, marketShareMoM: 0, psl: 0, offtake: 0, offtakeMoM: 0, myTopSku: "-", competitorSku: "-", possibleCause: "-" }];
            break;
        case "Challenger Launch Watch":
            base.kpis = [{ label: "Share", value: "0%" }, { label: "First seen", value: "-" }, { label: "PPU", value: "0" }];
            base.evidence = [{ city: "-", category: "-", skuOrBrand: "-", newItemShare: 0, ppu: 0, firstSeen: "-" }];
            break;
        case "Replenishment Breaks":
            base.kpis = [{ label: "Fill rate", value: "0%" }, { label: "Missing PO", value: "0" }, { label: "Depot", value: "0" }];
            base.evidence = [{ depotOrDb: "-", city: "-", skuOrBrand: "-", plannedQty: 0, dispatchedQty: 0, fillRate: 0, poCreated: false, poNo: "-" }];
            break;
        case "Keyword Efficiency and Budget Caps":
            base.kpis = [{ label: "Waste keywords", value: "0" }, { label: "Best ACOS", value: "0%" }, { label: "Budget caps", value: "-" }];
            base.evidence = [{ keyword: "-", campaign: "-", bid: 0, dailyBudget: 0, spend: 0, sales: 0, acos: 0, budgetCapped: false }];
            break;
        default: break;
    }
    return base;
};

// ─── AI INSIGHTS PANEL ───────────────────────────────────────────────────────

const buildAISegments = (insight) => {
    const type = insight.type;
    const brand = insight.brandName || "Brand";
    const city = insight.city !== "-" ? insight.city : "regions";
    const category = insight.category !== "-" ? insight.category : "category";
    const impactStr = formatINRCompact(insight.impactInr || 0);
    const ev = insight.evidence?.[0] || {};

    let highText = insight.whatWeSee?.[1] || "Deviation from benchmark detected. Review required.";
    let focusText = insight.whatWeSee?.[0] || "Signal detected with notable deviation.";
    let recText = `Prioritize inventory and bid strategies in ${city}.`;

    if (type === "Replenishment Breaks") {
        highText = `Supply chain friction: ${ev.depotOrDb || "Depots"} experiencing dispatch lags for ${ev.skuOrBrand || brand}. Fill rate at ${safePct(ev.fillRate) || "low levels"}.`;
        focusText = `Focus required on ${ev.depotOrDb || "DBs"}. ${ev.poCreated === false ? "No PO created." : "PO generated but dispatch stalled."}`;
        recText = `Investigate bottlenecks at ${ev.depotOrDb || "DBs"}. Push pending ${Math.max(0, (ev.plannedQty || 0) - (ev.dispatchedQty || 0))} units of ${ev.skuOrBrand || brand}.`;
    } else if (type === "Competitor OSA Weak Spots") {
        highText = `Shelf-space void: ${ev.skuOrBrand || "Competitors"} seeing OSA crash to ${safePct(ev.otherBrandOsa) || "low levels"}.`;
        focusText = `Capitalize on stockouts in ${city}. ${brand} OSA remains healthy at ${safePct(ev.kwOsa) || "benchmark"}.`;
        recText = `Instruct field teams in ${city} to push ${brand} facings. Increase digital shelf visibility.`;
    } else if (type === "Share Headroom Hotspots") {
        if (insight.aiTrendData?.topThreat?.brandName) {
            const t = insight.aiTrendData;
            const isAdDriven = t.topThreat.primaryDriver === 'ad';
            return [
                { label: "Insights Summary", priority: "high", text: `Off-take declined in ${category} (${city}, ~${impactStr}) driven by ${t.topThreat.brandName} visibility.` },
                { label: "Why This is Happening", priority: "focus", text: `${t.topThreat.brandName} gained ${safePct(t.topThreat.shareChangePpt)} share primarily via ${isAdDriven ? 'Paid SOS' : 'Organic Visibility'}.` },
                { label: "SKU Level Impact", priority: "neutral", text: `${brand} lost share to competitor hero SKU '${t.topThreat.topSku || 'N/A'}'.` },
                { label: "Recommended Action", priority: "good", text: `Re-calibrate ${isAdDriven ? 'bidding strategies' : 'SEO'} against ${t.topThreat.brandName}.` }
            ];
        } else {
            highText = `Growth opportunity: Share gap of ${safePct(ev.shareGap)} exists against benchmark in ${city}.`;
            focusText = `Algorithmic driver flagged: '${ev.driverTag || "visibility"}'. Target benchmark of ${safePct(ev.benchmarkShare)}.`;
            recText = `Mobilize promotional spends toward '${ev.driverTag || "conversion"}' to capture ${impactStr} headroom.`;
        }
    } else if (type === "Price Parity Radar") {
        highText = `Pricing mismatch: ${brand} PPU misaligned with ${ev.clusterName || "market"}, index at ${typeof ev.priceIndex === "number" ? ev.priceIndex.toFixed(1) : "-"}.`;
        focusText = `Peers pricing at ₹${ev.peerPpu || "-"}, ${brand} at ₹${ev.kwPpu || "-"}.`;
        recText = `Evaluate markdown campaigns in ${city} or re-negotiate margins to restore parity.`;
    } else if (type === "Ad Stock Mismatch") {
        highText = `Wasted Ad Spend: ${brand} Ad SOV is ${safePct(ev.adSov)} but OSA is severely depleted.`;
        focusText = `₹${typeof ev.spendInr === "number" ? ev.spendInr.toLocaleString("en-IN") : "-"} burnt on campaigns; est. ${formatINRCompact(ev.estLostSalesInr || 0)} lost sales.`;
        recText = `Pause ad campaigns for ${ev.skuOrBrand || brand} in ${city} until replenishment is confirmed.`;
    } else if (type === "Keyword Efficiency and Budget Caps") {
        highText = `Poor ROAS: Campaign '${ev.campaign || "Search"}' targeting '${ev.keyword || "keywords"}' experiencing friction.`;
        focusText = `${ev.budgetCapped ? "Budgets capping early" : "ACOS ballooning to " + (typeof ev.acos === "number" ? ev.acos + "%" : "high levels")}.`;
        recText = `${ev.budgetCapped ? "Reallocate budgets from poorer keywords." : "Lower bids or add negative search terms."}`;
    } else if (type === "Challenger Launch Watch") {
        highText = `Threat detection: New entrant '${ev.skuOrBrand || "brand"}' captured ${safePct(ev.newItemShare)} share.`;
        focusText = `Launched at PPU of ₹${ev.ppu || "-"}, threatening ${brand} volumes in ${city}.`;
        recText = `Monitor '${ev.skuOrBrand || "challenger"}'. Deploy defensive trade-promotions in ${city}.`;
    }

    return [
        { label: "High Priority", priority: "high", text: highText },
        { label: "Focus Area", priority: "focus", text: focusText },
        { label: "Estimated Impact", priority: "good", text: `${impactStr} revenue opportunity identified.` },
        { label: "Recommended Action", priority: "neutral", text: recText },
    ];
};

const priorityStyles = {
    high: { border: "border-l-red-500", label: "text-red-600", bg: "bg-red-50" },
    focus: { border: "border-l-blue-500", label: "text-blue-700", bg: "bg-blue-50" },
    good: { border: "border-l-emerald-500", label: "text-emerald-700", bg: "bg-emerald-50" },
    neutral: { border: "border-l-slate-400", label: "text-slate-600", bg: "bg-slate-50" },
};

// ─── BETA BADGE ──────────────────────────────────────────────────────────────

const BetaBadge = ({ size = "sm" }) => (
    <span
        style={{
            fontSize: size === "xs" ? "8px" : "9px",
            fontWeight: 800,
            letterSpacing: "0.12em",
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            color: "#fff",
            borderRadius: "4px",
            padding: size === "xs" ? "1px 5px" : "2px 6px",
            boxShadow: "0 0 8px rgba(99,102,241,0.4)",
            display: "inline-flex",
            alignItems: "center",
            verticalAlign: "middle",
            textTransform: "uppercase",
            lineHeight: 1.4,
            animation: "betaPulse 2.5s ease-in-out infinite",
        }}
    >
        ✦ BETA
    </span>
);

// ─── SIGNAL STATUS BADGE ─────────────────────────────────────────────────────

const SignalStatusBadge = ({ isEmpty, hovered }) => (
    <span
        style={{
            fontSize: "8px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            background: hovered
                ? "rgba(255,255,255,0.18)"
                : isEmpty
                    ? "#94a3b8"
                    : "#c0392b",
            color: "#fff",
            borderRadius: 0,
            padding: "2px 6px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            textTransform: "uppercase",
            transition: "background 0.28s ease",
        }}
    >
        <span
            style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: hovered ? "rgba(255,255,255,0.9)" : isEmpty ? "#e2e8f0" : "#ff6b6b",
                display: "inline-block",
                animation: isEmpty || hovered ? "none" : "blink 1.1s ease-in-out infinite",
                boxShadow: (!isEmpty && !hovered) ? "0 0 0 0 rgba(255,107,107,0.6)" : "none",
            }}
        />
        {isEmpty ? "NO DATA" : "LIVE SIGNAL"}
    </span>
);

// ─── MINI SPARKLINE ──────────────────────────────────────────────────────────

const MiniSparkline = ({ color, negative, hovered }) => {
    const bars = [0.4, 0.6, 0.45, 0.8, 0.55, 0.9, 0.7, 0.85, 0.6, 0.95];
    return (
        <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "32px" }}>
            {bars.map((h, i) => (
                <div
                    key={i}
                    style={{
                        width: "4px",
                        height: `${h * 32}px`,
                        borderRadius: 0,
                        background: hovered
                            ? `rgba(255,255,255,${0.25 + h * 0.55})`
                            : negative
                                ? `rgba(239,68,68,${0.3 + h * 0.5})`
                                : `rgba(59,130,246,${0.3 + h * 0.5})`,
                        transition: "height 0.3s ease, background 0.28s ease",
                    }}
                />
            ))}
        </div>
    );
};

// ─── CONFIDENCE BARS ─────────────────────────────────────────────────────────

const ConfidenceBars = ({ level = 3, max = 5, hovered }) => (
    <div style={{ display: "flex", gap: "2px", alignItems: "flex-end" }}>
        {Array.from({ length: max }).map((_, i) => (
            <div
                key={i}
                style={{
                    width: "4px",
                    height: `${6 + i * 3}px`,
                    borderRadius: 0,
                    background: hovered
                        ? i < level ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)"
                        : i < level ? "#f59e0b" : "#e2e8f0",
                    transition: "background 0.28s ease",
                }}
            />
        ))}
    </div>
);

// ─── AI INSIGHTS PANEL ───────────────────────────────────────────────────────

const AIInsightsPanel = ({ insight, onClose }) => {
    const [phase, setPhase] = useState("loading");
    const [visibleCount, setVisibleCount] = useState(0);
    const segments = useMemo(() => buildAISegments(insight), [insight]);

    useEffect(() => {
        setPhase("loading"); setVisibleCount(0);
        const t = setTimeout(() => setPhase("reveal"), 1200);
        return () => clearTimeout(t);
    }, [insight]);

    useEffect(() => {
        if (phase !== "reveal") return;
        if (visibleCount >= segments.length) return;
        const t = setTimeout(() => setVisibleCount((c) => c + 1), 180);
        return () => clearTimeout(t);
    }, [phase, visibleCount, segments.length]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
                position: "absolute", top: 0, right: 0, height: "100%", width: "300px",
                background: "linear-gradient(180deg, #f0f7ff 0%, #fff 100%)",
                borderLeft: "1px solid #bfdbfe",
                boxShadow: "-8px 0 32px rgba(59,130,246,0.08)",
                zIndex: 50, display: "flex", flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderBottom: "1px solid #bfdbfe",
                background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: "6px",
                        background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <BrainCircuit size={14} color="#fff" />
                    </div>
                    <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e3a5f", letterSpacing: "0.02em" }}>
                            AI Summary <BetaBadge size="xs" />
                        </div>
                    </div>
                </div>
                <button onClick={onClose} style={{ color: "#94a3b8", cursor: "pointer", background: "none", border: "none", padding: 4 }}>
                    <X size={14} />
                </button>
            </div>

            <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {phase === "loading" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "11px", padding: "16px 0" }}>
                        <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                        Analyzing signal data...
                    </div>
                ) : (
                    segments.map((seg, idx) => {
                        const s = priorityStyles[seg.priority] || priorityStyles.neutral;
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 8 }}
                                animate={idx < visibleCount ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                                transition={{ duration: 0.3 }}
                                style={{
                                    background: "#fff",
                                    border: "1px solid #e2e8f0",
                                    borderLeft: `3px solid ${seg.priority === "high" ? "#ef4444" : seg.priority === "focus" ? "#3b82f6" : seg.priority === "good" ? "#10b981" : "#94a3b8"}`,
                                    borderRadius: "6px",
                                    padding: "10px 12px",
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                                }}
                            >
                                <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}
                                    className={s.label}>
                                    {seg.label}
                                </div>
                                <p style={{ fontSize: "11px", color: "#475569", lineHeight: 1.5, margin: 0 }}>{seg.text}</p>
                            </motion.div>
                        );
                    })
                )}
            </div>
        </motion.div>
    );
};

// ─── OVERVIEW SIGNAL CARD ────────────────────────────────────────────────────

const OverviewSignalCard = ({ insight, isSelected, onClick }) => {
    const [hovered, setHovered] = useState(false);
    const isEmpty = insight.id.startsWith("empty_");
    const meta = SIGNAL_META[insight.type] || {};
    const { FamilyIcon, color, accent, family, metricLabel, trend } = meta;
    const isNegative = trend === "negative";
    const impactValue = isEmpty ? "—" : formatINRCompact(insight.impactInr || 0);

    const kpi0 = insight.kpis?.[0];
    const kpi1 = insight.kpis?.[1];

    const hoverBg = isEmpty ? "#475569" : color;
    const txt = (base) => hovered ? "#ffffff" : base;
    const txtMuted = hovered ? "rgba(255,255,255,0.6)" : "#78828f";
    const txtFaint = hovered ? "rgba(255,255,255,0.42)" : "#a0aab4";
    const dividerColor = hovered ? "rgba(255,255,255,0.14)" : "#eaecf0";

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: "100%",
                height: "260px",
                display: "flex",
                flexDirection: "column",
                borderRadius: 0,
                border: isSelected
                    ? `2px solid ${color || "#4a6fa5"}`
                    : hovered
                        ? `1px solid ${color || "#4a6fa5"}`
                        : isEmpty
                            ? "1px solid #e4e8ed"
                            : `1px solid ${color ? color + "38" : "#c8d5e8"}`,
                cursor: "pointer",
                overflow: "hidden",
                position: "relative",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                background: hovered ? hoverBg : isEmpty ? "#f9fafb" : "#ffffff",
                boxShadow: hovered
                    ? `0 18px 44px ${color ? color + "40" : "rgba(74,111,165,0.25)"}, 0 4px 14px ${color ? color + "28" : "rgba(74,111,165,0.14)"}`
                    : isSelected
                        ? `0 0 0 3px ${color ? color + "28" : "rgba(74,111,165,0.18)"}`
                        : "0 1px 3px rgba(0,0,0,0.04)",
                transition: "background 0.26s ease, box-shadow 0.26s ease, border-color 0.26s ease, transform 0.2s ease",
                transform: hovered ? "translateY(-3px)" : "translateY(0px)",
                opacity: isEmpty && !hovered ? 0.68 : 1,
            }}
        >
            {/* Top accent bar */}
            <div style={{
                height: "3px", flexShrink: 0,
                background: hovered
                    ? "rgba(255,255,255,0.3)"
                    : isEmpty ? "#e4e8ed"
                        : `linear-gradient(90deg, ${color} 0%, ${color}70 100%)`,
                transition: "background 0.26s ease",
            }} />

            {/* Header row */}
            <div style={{
                padding: "11px 14px 6px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0,
            }}>
                <SignalStatusBadge isEmpty={isEmpty} hovered={hovered} />
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <BetaBadge size="xs" />
                    <div style={{
                        width: 22, height: 22, borderRadius: 0,
                        background: hovered ? "rgba(255,255,255,0.18)" : isEmpty ? "#f1f5f9" : accent,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "background 0.26s ease",
                    }}>
                        {FamilyIcon && <FamilyIcon size={11} color={hovered ? "#fff" : isEmpty ? "#94a3b8" : color} />}
                    </div>
                </div>
            </div>

            {/* Family label */}
            <div style={{ padding: "0 14px 2px", flexShrink: 0 }}>
                <span style={{
                    fontSize: "9px", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: hovered ? "rgba(255,255,255,0.62)" : isEmpty ? "#a0aab4" : color,
                    transition: "color 0.26s ease",
                }}>
                    {family}
                </span>
            </div>

            {/* Signal title — fixed height */}
            <div style={{ padding: "0 14px 10px", flexShrink: 0, height: "44px", overflow: "hidden" }}>
                <h3 style={{
                    fontSize: "13px", fontWeight: 700,
                    color: txt("#111827"),
                    lineHeight: 1.32, margin: 0,
                    display: "-webkit-box", WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical", overflow: "hidden",
                    transition: "color 0.26s ease",
                }}>
                    {insight.type}
                </h3>
            </div>

            {/* Divider */}
            <div style={{ margin: "0 14px", height: "1px", background: dividerColor, flexShrink: 0, transition: "background 0.26s ease" }} />

            {/* Impact metric — poppy number with subtle bg */}
            <div style={{ padding: "11px 14px 10px", flexShrink: 0 }}>
                <div style={{
                    fontSize: "9px", fontWeight: 600, marginBottom: "6px",
                    textTransform: "uppercase", letterSpacing: "0.07em",
                    color: txtFaint, transition: "color 0.26s ease",
                }}>
                    {metricLabel}
                </div>
                <div style={{ display: "inline-flex" }}>
                    <span style={{
                        fontSize: "20px", fontWeight: 900,
                        letterSpacing: "-0.03em",
                        color: hovered
                            ? "#ffffff"
                            : isEmpty ? "#a0aab4" : isNegative ? "#b94040" : "#2e7d5e",
                        background: hovered
                            ? "rgba(255,255,255,0.14)"
                            : isEmpty ? "#f1f3f5"
                                : isNegative ? "#fdf0f0" : "#eef7f3",
                        padding: "3px 10px",
                        borderRadius: "4px",
                        transition: "color 0.26s ease, background 0.26s ease",
                        lineHeight: 1.3,
                    }}>
                        {impactValue}
                    </span>
                </div>
            </div>

            {/* Divider */}
            <div style={{ margin: "0 14px", height: "1px", background: dividerColor, flexShrink: 0, transition: "background 0.26s ease" }} />

            {/* KPI rows with poppy number bg pills */}
            <div style={{ padding: "8px 14px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "6px" }}>
                {[kpi0, kpi1].filter(Boolean).map((k, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "10px", color: txtMuted, transition: "color 0.26s ease" }}>{k.label}</span>
                        <span style={{
                            fontSize: "11px", fontWeight: 800,
                            color: hovered ? "#fff" : "#1a2332",
                            background: hovered ? "rgba(255,255,255,0.16)" : "#f0f2f5",
                            padding: "1px 7px",
                            borderRadius: "3px",
                            letterSpacing: "-0.01em",
                            transition: "color 0.26s ease, background 0.26s ease",
                        }}>
                            {k.value}
                        </span>
                    </div>
                ))}
            </div>

            {/* Footer — VIEW DETAIL only */}
            <div style={{
                padding: "8px 14px",
                borderTop: `1px solid ${dividerColor}`,
                display: "flex", alignItems: "center", justifyContent: "flex-end",
                flexShrink: 0,
                background: hovered ? "rgba(0,0,0,0.08)" : "rgba(248,250,252,0.7)",
                transition: "background 0.26s ease, border-color 0.26s ease",
            }}>
                <div style={{
                    fontSize: "9px", fontWeight: 700,
                    color: hovered ? "rgba(255,255,255,0.88)" : color || "#4a6fa5",
                    display: "flex", alignItems: "center", gap: "3px",
                    textTransform: "uppercase", letterSpacing: "0.07em",
                    transition: "color 0.26s ease",
                }}>
                    VIEW DETAIL <ChevronRight size={9} />
                </div>
            </div>
        </div>
    );
};

// ─── EVIDENCE TABLE ───────────────────────────────────────────────────────────

const getEvidenceView = (type) => {
    if (type === "Replenishment Breaks") return "supply";
    if (type === "Keyword Efficiency and Budget Caps") return "keyword";
    if (type === "Price Parity Radar") return "pricing";
    if (type === "Share Headroom Hotspots") return "share";
    if (type === "Challenger Launch Watch") return "newEntry";
    if (type === "Ad Stock Mismatch") return "adStock";
    return "osa";
};

const EvidenceTable = ({ insight, activePlatform }) => {
    const view = getEvidenceView(insight.type);
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        let data = insight.evidence || [];
        if (activePlatform && activePlatform !== "-" && activePlatform !== "All platforms") {
            data = data.filter((e) => !e.platform || e.platform === activePlatform || e.platform === "-");
        }
        if (!search.trim()) return data;
        const q = search.toLowerCase();
        return data.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)));
    }, [insight.evidence, search, activePlatform]);

    return (
        <div style={{
            display: "flex", flexDirection: "column", height: "100%",
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden",
        }}>
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderBottom: "1px solid #e2e8f0",
                background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
            }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e3a5f", letterSpacing: "0.02em" }}>
                    Evidence Data
                </span>
                <div style={{ position: "relative" }}>
                    <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        style={{
                            paddingLeft: "26px", paddingRight: "8px", paddingTop: "5px", paddingBottom: "5px",
                            fontSize: "11px", border: "1px solid #bfdbfe", borderRadius: "6px",
                            background: "#fff", outline: "none", width: "180px", color: "#1e3a5f",
                        }}
                    />
                </div>
            </div>
            <ScrollArea className="h-[380px] w-full">
                <Table>
                    <TableHeader style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 10 }}>
                        <TableRow style={{ borderBottom: "1px solid #e2e8f0" }}>
                            {view === "osa" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Competitor</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Other brand OSA</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} OSA</TableHead>
                            </>)}
                            {view === "share" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Brand OSA</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Mkt Share</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PSL</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Offtake</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Top SKU</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Comp SKU</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Cause</TableHead>
                            </>)}
                            {view === "pricing" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Cluster</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} PPU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Peer PPU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Index</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Cluster %</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Growth %</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Headroom</TableHead>
                            </>)}
                            {view === "adStock" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Brand / SKU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">OSA</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Ad SOV</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Spend</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Est. Loss</TableHead>
                            </>)}
                            {view === "newEntry" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">SKU / Brand</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Share</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PPU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">First Seen</TableHead>
                            </>)}
                            {view === "supply" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Depot / DB</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">SKU / Brand</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Planned</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Dispatched</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Fill Rate</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PO Status</TableHead>
                            </>)}
                            {view === "keyword" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Keyword</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Campaign</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Bid</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Daily Budget</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Spend</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Sales</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">ACOS</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Capped</TableHead>
                            </>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-10 text-slate-400 text-[11px]">
                                    No matching rows
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((d, idx) => (
                                <TableRow key={idx} style={{ borderBottom: "1px solid #f1f5f9" }} className="hover:bg-blue-50/30 transition-colors">
                                    {view === "osa" && (
                                        <>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.category ?? insight.category}</TableCell>
                                            <TableCell className="text-[11px] text-slate-500 px-3 py-1.5">{d.platform ?? "-"}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.city ?? insight.city}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.skuOrBrand ?? "-"}</TableCell>
                                            <TableCell className="text-right text-[11px] font-medium text-red-600 px-3 py-1.5">{safePct(d.otherBrandOsa)}</TableCell>
                                            <TableCell className="text-right text-[11px] font-medium text-blue-600 px-3 py-1.5">{safePct(d.kwOsa)}</TableCell>
                                        </>
                                    )}
                                    {view === "share" && (
                                        <>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.category ?? insight.category}</TableCell>
                                            <TableCell className="text-[11px] text-slate-500 px-3 py-1.5">{d.platform ?? "-"}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.city ?? insight.city}</TableCell>
                                            <TableCell className="text-right text-[11px] font-medium text-blue-600 px-3 py-1.5">{safePct(d.brandOsa)}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">
                                                {safePct(d.marketShare)} <span className={d.marketShareMoM < 0 ? "text-red-600" : "text-emerald-600"}>({d.marketShareMoM > 0 ? '+' : ''}{safePct(d.marketShareMoM)})</span>
                                            </TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">{safeINR(d.psl)}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">
                                                {safeINR(d.offtake)} <span className={(d.offtakeDelta || 0) < 0 ? "text-red-600" : "text-emerald-600"}>({(d.offtakeDelta || 0) > 0 ? '+' : ''}{safeINR(d.offtakeDelta)} / {safePct(d.offtakeMoM)})</span>
                                            </TableCell>
                                            <TableCell className="px-3 py-1.5"><span className="text-[11px] text-slate-800 truncate max-w-[120px] block">{d.myTopSku || "-"}</span></TableCell>
                                            <TableCell className="px-3 py-1.5"><span className="text-[11px] text-slate-800 truncate max-w-[120px] block">{d.competitorSku || "-"}</span></TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.possibleCause || "-"}</TableCell>
                                        </>
                                    )}
                                    {view === "pricing" && (
                                        <>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.city}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.category}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.clusterName}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">₹{d.kwPpu}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">₹{d.peerPpu}</TableCell>
                                            <TableCell className="text-right text-[11px] text-amber-600 px-3 py-1.5">{d.priceIndex}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">{safePct(d.clusterContributionPct)}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">{safePct(d.clusterGrowthPct)}</TableCell>
                                            <TableCell className="text-right text-[11px] font-medium text-emerald-600 px-3 py-1.5">{safeINR(d.headroomInr)}</TableCell>
                                        </>
                                    )}
                                    {view === "adStock" && (
                                        <>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.city}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.skuOrBrand}</TableCell>
                                            <TableCell className="text-right text-[11px] font-medium text-red-600 px-3 py-1.5">{safePct(d.kwOsa)}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">{safePct(d.adSov)}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">{safeINR(d.spendInr)}</TableCell>
                                            <TableCell className="text-right text-[11px] font-medium text-red-600 px-3 py-1.5">{safeINR(d.estLostSalesInr)}</TableCell>
                                        </>
                                    )}
                                    {view === "newEntry" && (
                                        <>
                                            <TableCell className="text-[11px] text-slate-500 px-3 py-1.5">{d.platform ?? "-"}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.city}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.category}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.skuOrBrand}</TableCell>
                                            <TableCell className="text-right text-[11px] font-medium text-emerald-600 px-3 py-1.5">{safePct(d.newItemShare)}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">₹{d.ppu}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-500 px-3 py-1.5">{d.firstSeen}</TableCell>
                                        </>
                                    )}
                                    {view === "supply" && (
                                        <>
                                            <TableCell className="text-[11px] text-slate-500 px-3 py-1.5">{d.platform ?? "-"}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.depotOrDb}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.city}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.skuOrBrand}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-500 px-3 py-1.5">{d.plannedQty}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">{d.dispatchedQty}</TableCell>
                                            <TableCell className="text-right text-[11px] font-medium text-red-600 px-3 py-1.5">{safePct(d.fillRate)}</TableCell>
                                            <TableCell className="text-right px-3 py-1.5">
                                                {d.poCreated ? (
                                                    <span className="text-[10px] text-emerald-700">Yes ({d.poNo})</span>
                                                ) : (
                                                    <span className="text-[10px] text-red-600">Missing</span>
                                                )}
                                            </TableCell>
                                        </>
                                    )}
                                    {view === "keyword" && (
                                        <>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.keyword}</TableCell>
                                            <TableCell className="text-[11px] text-slate-500 px-3 py-1.5 max-w-[120px] truncate">{d.campaign}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">₹{d.bid?.toFixed(1)}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-500 px-3 py-1.5">{safeINR(d.dailyBudget)}</TableCell>
                                            <TableCell className="text-right text-[11px] text-amber-600 px-3 py-1.5">{safeINR(d.spend)}</TableCell>
                                            <TableCell className="text-right text-[11px] text-emerald-600 px-3 py-1.5">{safeINR(d.sales)}</TableCell>
                                            <TableCell className="text-right text-[11px] text-indigo-600 px-3 py-1.5">{safePct(d.acos)}</TableCell>
                                            <TableCell className="text-right px-3 py-1.5">
                                                {d.budgetCapped ? <span className="text-[10px] text-red-600">Capped</span> : <span className="text-slate-400 text-[10px]">-</span>}
                                            </TableCell>
                                        </>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
    );
};

// ─── PLATFORM TAB ─────────────────────────────────────────────────────────────

const PlatformButton = ({ platform, active, onClick }) => (
    <button
        onClick={onClick}
        style={{
            padding: "8px 16px",
            fontSize: "12px",
            fontWeight: active ? 700 : 500,
            borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
            color: active ? "#2563eb" : "#64748b",
            background: "none",
            border: "none",
            borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
            cursor: "pointer",
            transition: "all 0.15s ease",
        }}
    >
        {platform}
    </button>
);

// ─── DRILL DOWN MODAL ─────────────────────────────────────────────────────────

const getKpiStyle = (label, value) => {
    const l = String(label).toLowerCase();
    const v = String(value).toLowerCase();
    if (v.startsWith('-') || /gap|miss|lost|waste|drop|out of stock/.test(l)) return "text-red-600";
    if (/org|organic|growth|headroom|fill rate|best/.test(l)) return "text-emerald-600";
    if (/ad\b|spend|budget|ppu|price|cost|acos/.test(l)) return "text-amber-600";
    if (/overall|share|sos|sov|osa|index/.test(l)) return "text-blue-600";
    return "text-slate-900";
};

const DrillDownModal = ({ insight, open, onClose, onAI, showAIPanel, onCloseAIPanel, hubPlatform = "All platforms" }) => {
    const [activePlatform, setActivePlatform] = useState(hubPlatform !== "All platforms" ? hubPlatform : "All platforms");

    useEffect(() => {
        if (insight) setActivePlatform(hubPlatform !== "All platforms" ? hubPlatform : "All platforms");
    }, [insight, hubPlatform]);

    if (!insight) return null;

    const platforms = (insight.platforms || []).filter((p) => p !== "-");
    const isEmpty = insight.id.startsWith("empty_");
    const meta = SIGNAL_META[insight.type] || {};

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-[1000px] w-[95vw] p-0 gap-0 rounded-xl overflow-hidden shadow-2xl bg-white border border-blue-100 outline-none [&>button]:hidden flex">
                <div className="flex-1 flex flex-col max-h-[85vh]">

                    {/* Modal Header */}
                    <div style={{
                        background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                        borderBottom: "1px solid #bfdbfe",
                        padding: "16px 20px",
                        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                        flexShrink: 0,
                    }}>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                                <div style={{
                                    width: 20, height: 20, borderRadius: "5px",
                                    background: meta.color ? `${meta.color}22` : "#dbeafe",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    {meta.FamilyIcon && <meta.FamilyIcon size={11} color={meta.color || "#3b82f6"} />}
                                </div>
                                <span style={{ fontSize: "10px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                    Signal Detail
                                </span>
                                <ChevronRight size={11} color="#94a3b8" />
                                <span style={{ fontSize: "10px", fontWeight: 600, color: meta.color || "#3b82f6", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                    {insight.family}
                                </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
                                    {insight.type}
                                </h2>
                                <BetaBadge />
                            </div>
                        </div>
                        <button onClick={onClose} style={{
                            color: "#94a3b8", background: "none", border: "none",
                            cursor: "pointer", padding: 4, marginTop: 4,
                        }}>
                            <X size={16} />
                        </button>
                    </div>

                    {/* KPI Strip */}
                    <div style={{
                        borderBottom: "1px solid #e2e8f0",
                        padding: "12px 20px",
                        display: "flex", flexWrap: "wrap", alignItems: "center",
                        justifyContent: "space-between", gap: "12px",
                        background: "#fff", flexShrink: 0,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                            <div>
                                <p style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Impact</p>
                                <p style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{formatINRCompact(insight.impactInr || 0)}</p>
                            </div>
                            <div style={{ width: 1, height: 32, background: "#e2e8f0" }} />
                            <div style={{ display: "flex", gap: "20px" }}>
                                {(insight.kpis || []).map((k, i) => (
                                    <div key={i}>
                                        <p style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{k.label}</p>
                                        <p style={{ fontSize: "14px", fontWeight: 700, margin: 0 }} className={getKpiStyle(k.label, k.value)}>{k.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={onAI}
                            className="ai-btn"
                        >
                            <BrainCircuit size={12} />
                            AI Insights <BetaBadge size="xs" />
                        </button>
                    </div>

                    {/* Platform Tabs */}
                    {platforms.length > 1 && (
                        <div style={{
                            padding: "0 20px", borderBottom: "1px solid #e2e8f0",
                            display: "flex", alignItems: "center", gap: "4px",
                            flexShrink: 0, background: "#f8fafc",
                        }}>
                            <PlatformButton platform="All Platforms" active={activePlatform === "All platforms"} onClick={() => setActivePlatform("All platforms")} />
                            {platforms.map((p) => <PlatformButton key={p} platform={p} active={activePlatform === p} onClick={() => setActivePlatform(p)} />)}
                        </div>
                    )}

                    {/* Body */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "20px", background: "#fafcff" }}>
                        {!isEmpty && insight.whatWeSee?.some((w) => w !== "-") && (
                            <div style={{
                                marginBottom: "20px",
                                background: "linear-gradient(135deg, #eff6ff 0%, #f0f7ff 100%)",
                                border: "1px solid #bfdbfe",
                                borderRadius: "10px",
                                padding: "14px 16px",
                            }}>
                                <h3 style={{ fontSize: "10px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
                                    Key Observations
                                </h3>
                                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {insight.whatWeSee.map((w, i) => (
                                        <li key={i} style={{ display: "flex", gap: "10px", fontSize: "12px", color: "#334155", alignItems: "flex-start" }}>
                                            <div style={{
                                                width: 6, height: 6, borderRadius: "50%",
                                                background: "#3b82f6", marginTop: 5, flexShrink: 0,
                                            }} />
                                            <span>{w}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {isEmpty ? (
                            <div style={{
                                textAlign: "center", padding: "64px 16px",
                                border: "1px dashed #bfdbfe", borderRadius: "10px",
                                color: "#94a3b8",
                            }}>
                                <Activity size={20} style={{ margin: "0 auto 8px", color: "#cbd5e1" }} />
                                <p style={{ fontSize: "12px", margin: 0 }}>No detailed evidence available.</p>
                            </div>
                        ) : (
                            <EvidenceTable insight={insight} activePlatform={activePlatform} />
                        )}
                    </div>
                </div>

                {/* AI Panel Drawer */}
                <AnimatePresence>
                    {showAIPanel && <AIInsightsPanel insight={insight} onClose={onCloseAIPanel} />}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const InsightsSignalHub = () => {
    const { refreshFilters, maxDate } = useContext(FilterContext);

    const [filters, setFilters] = useState({ platform: "All platforms", city: "All cities", category: "All categories", signal: "All signals" });
    const [fetchedInsights, setFetchedInsights] = useState([]);
    const [fetchedFilterOptions, setFetchedFilterOptions] = useState({ categories: [], productLines: [], geographies: [] });
    const [loading, setLoading] = useState(false);

    const [typeFilter, setTypeFilter] = useState("All signals");
    const [cityFilter, setCityFilter] = useState("All cities");
    const [categoryFilter, setCategoryFilter] = useState("All categories");
    const [platformFilter, setPlatformFilter] = useState("All platforms");

    const [startDate, setStartDate] = useState(dayjs().subtract(30, "day"));
    const [endDate, setEndDate] = useState(dayjs());

    const [selectedId, setSelectedId] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [showAIPanel, setShowAIPanel] = useState(false);

    useEffect(() => {
        if (typeof refreshFilters === "function") refreshFilters();
        const loadOptions = async () => {
            const res = await fetchInsightsFilters();
            if (res?.success) setFetchedFilterOptions(res.data);
        };
        loadOptions();
    }, [refreshFilters]);

    useEffect(() => {
        const loadInsights = async () => {
            setLoading(true);
            try {
                const apiPayload = {
                    ...filters,
                    localCity: cityFilter,
                    localCategory: categoryFilter,
                    localPlatform: platformFilter,
                    startDate: startDate.format("YYYY-MM-DD"),
                    endDate: endDate.format("YYYY-MM-DD"),
                };
                const data = await fetchInsights(apiPayload);
                const apiResponseList = data?.success && Array.isArray(data?.data) ? data.data : [];
                const apiBrandName = apiResponseList.find((i) => i.brandName)?.brandName || "Brand";
                const enforcedInsights = REQUIRED_SIGNAL_TYPES.map((requiredType) => {
                    const found = apiResponseList.find((item) => item.type === requiredType);
                    return found ? found : createEmptySignal(requiredType, apiBrandName);
                });
                setFetchedInsights(enforcedInsights);
            } catch (err) {
                console.error("Fetch error:", err);
                setFetchedInsights(REQUIRED_SIGNAL_TYPES.map(createEmptySignal));
            } finally {
                setLoading(false);
            }
        };
        loadInsights();
    }, [filters, cityFilter, categoryFilter, platformFilter, startDate, endDate]);

    const allInsights = useMemo(() => fetchedInsights, [fetchedInsights]);

    const slicerOptions = useMemo(() => {
        const types = Array.from(new Set(allInsights.map((i) => i.type))).sort();
        const plats = Array.from(new Set(allInsights.flatMap((i) => i.platforms || []))).filter((p) => p !== "-").sort();
        return {
            types: ["All signals", ...types],
            cities: ["All cities", ...(fetchedFilterOptions.geographies.length > 0
                ? fetchedFilterOptions.geographies.filter((g) => g !== "-")
                : Array.from(new Set(allInsights.map((i) => i.city))).filter((c) => c !== "-").sort())],
            categories: ["All categories", ...(fetchedFilterOptions.categories.length > 0
                ? fetchedFilterOptions.categories.filter((c) => c !== "-")
                : Array.from(new Set(allInsights.map((i) => i.category))).filter((c) => c !== "-").sort())],
            platforms: ["All platforms", ...plats],
        };
    }, [allInsights, fetchedFilterOptions]);

    const filteredInsights = useMemo(() => {
        return allInsights.filter((i) => {
            const okType = typeFilter === "All signals" || i.type === typeFilter;
            const okCity = cityFilter === "All cities" || i.city === cityFilter;
            const okCat = categoryFilter === "All categories" || i.category === categoryFilter;
            const okPlat = platformFilter === "All platforms" || (i.platforms || []).includes(platformFilter);
            return okType && okCity && okCat && okPlat;
        });
    }, [allInsights, typeFilter, cityFilter, categoryFilter, platformFilter]);

    const selected = useMemo(() => allInsights.find((x) => x.id === selectedId) ?? null, [allInsights, selectedId]);
    const totalImpact = filteredInsights.reduce((s, i) => s + (i.impactInr || 0), 0);
    const activeSignals = filteredInsights.filter((i) => !i.id.startsWith("empty_")).length;

    const handleCardClick = (id) => {
        setSelectedId(id);
        setShowAIPanel(false);
        setDialogOpen(true);
    };

    const handleClose = () => {
        setDialogOpen(false);
        setShowAIPanel(false);
    };

    return (
        <CommonContainer title={null} filters={filters} onFiltersChange={setFilters} hideFilters>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
                @keyframes betaPulse {
                    0%, 100% { box-shadow: 0 0 8px rgba(99,102,241,0.4); }
                    50% { box-shadow: 0 0 16px rgba(99,102,241,0.7); }
                }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.15; }
                }
                @keyframes dot-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(0.8); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .signal-card-enter {
                    animation: fadeSlideIn 0.4s ease forwards;
                }
                .ai-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 13px;
                    font-size: 11px;
                    font-weight: 700;
                    color: #fff;
                    background: #3a3f4d;
                    border: 1px solid #4a5060;
                    border-radius: 0;
                    cursor: pointer;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    transition: background 0.18s ease, border-color 0.18s ease;
                }
                .ai-btn:hover {
                    background: #282c38;
                    border-color: #5a6070;
                }
            `}</style>

            <div style={{
                background: "linear-gradient(180deg, #f0f7ff 0%, #f8fafc 100%)",
                minHeight: "100vh",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                paddingBottom: "40px",
            }}>
                <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 16px" }}>

                    {/* ── Page Header ────────────────────────────────────── */}
                    <div style={{
                        display: "flex", flexDirection: "column", gap: "4px",
                        marginBottom: "24px",
                    }}>
                        {/* Title row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: "10px",
                                        background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
                                    }}>
                                        <Signal size={18} color="#fff" />
                                    </div>
                                    <div>
                                        <h1 style={{
                                            fontSize: "22px", fontWeight: 900, color: "#0f172a",
                                            margin: 0, letterSpacing: "-0.03em",
                                            display: "flex", alignItems: "center", gap: "10px",
                                        }}>
                                            AI Signal Insights
                                            <BetaBadge />
                                        </h1>
                                        <p style={{ fontSize: "12px", color: "#64748b", margin: 0, marginTop: "2px" }}>
                                            Anomaly detection & opportunity tracking across your retail landscape
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Stats pills */}
                            {!loading && (
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                    <div style={{
                                        background: "#fff",
                                        border: "1px solid #bfdbfe",
                                        borderRadius: "10px",
                                        padding: "10px 16px",
                                        textAlign: "right",
                                        boxShadow: "0 2px 8px rgba(59,130,246,0.08)",
                                    }}>
                                        <div style={{ fontSize: "9px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>
                                            Total Opportunity
                                        </div>
                                        <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em" }}>
                                            {formatINRCompact(totalImpact)}
                                        </div>
                                    </div>
                                    <div style={{
                                        background: "#fff",
                                        border: "1px solid #bfdbfe",
                                        borderRadius: "10px",
                                        padding: "10px 16px",
                                        textAlign: "right",
                                        boxShadow: "0 2px 8px rgba(59,130,246,0.08)",
                                    }}>
                                        <div style={{ fontSize: "9px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>
                                            Live Signals
                                        </div>
                                        <div style={{ fontSize: "18px", fontWeight: 900, color: "#2563eb", letterSpacing: "-0.03em" }}>
                                            {activeSignals}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Filter Bar ─────────────────────────────────────── */}
                    <div style={{
                        background: "#fff",
                        border: "1px solid #bfdbfe",
                        borderRadius: "12px",
                        padding: "12px 16px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "12px",
                        alignItems: "flex-end",
                        marginBottom: "24px",
                        boxShadow: "0 2px 12px rgba(59,130,246,0.06)",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94a3b8", alignSelf: "center" }}>
                            <Filter size={13} />
                            <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Filters</span>
                        </div>
                        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                            <CustomHeaderDropdown label="SIGNAL" options={slicerOptions.types} value={typeFilter} onChange={(v) => setTypeFilter(v === "All" ? "All signals" : v)} multiSelect={false} />
                            <CustomHeaderDropdown label="GEOGRAPHY" options={slicerOptions.cities} value={cityFilter} onChange={(v) => setCityFilter(v === "All" ? "All cities" : v)} multiSelect={false} />
                            <CustomHeaderDropdown label="CATEGORY" options={slicerOptions.categories} value={categoryFilter} onChange={(v) => setCategoryFilter(v === "All" ? "All categories" : v)} multiSelect={false} />
                            <CustomHeaderDropdown label="CHANNEL" options={slicerOptions.platforms} value={platformFilter} onChange={(v) => setPlatformFilter(v === "All" ? "All platforms" : v)} multiSelect={false} />
                        </div>
                        <div style={{ flexShrink: 0 }}>
                            <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, mb: 0.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>TIME PERIOD</Typography>
                            <DateRangeComparePicker
                                timeStart={startDate} timeEnd={endDate}
                                compareStart={null} compareEnd={null}
                                maxDate={maxDate || dayjs()}
                                onApply={(s, e) => { setStartDate(s); setEndDate(e); }}
                            />
                        </div>
                    </div>

                    {/* ── Signal Grid ─────────────────────────────────────── */}
                    {loading ? (
                        <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            justifyContent: "center", padding: "80px 0",
                            background: "#fff", border: "1px solid #bfdbfe",
                            borderRadius: "12px",
                            boxShadow: "0 2px 12px rgba(59,130,246,0.06)",
                        }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: "10px",
                                background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                marginBottom: "12px",
                            }}>
                                <Loader2 size={20} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e3a5f", marginBottom: "4px" }}>
                                Scanning analytics signals...
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                Powered by AI <BetaBadge size="xs" />
                            </div>
                        </div>
                    ) : filteredInsights.length === 0 ? (
                        <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            justifyContent: "center", padding: "80px 0",
                            background: "#fff", border: "1px dashed #bfdbfe",
                            borderRadius: "12px",
                        }}>
                            <Radar size={28} color="#bfdbfe" style={{ marginBottom: "10px" }} />
                            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1e3a5f", marginBottom: "4px" }}>
                                No signals detected
                            </h3>
                            <p style={{ fontSize: "12px", color: "#94a3b8" }}>Adjust filters to broaden scope.</p>
                        </div>
                    ) : (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                            gap: "16px",
                            alignItems: "stretch",
                        }}>
                            {filteredInsights.map((ins, idx) => (
                                <motion.div
                                    key={ins.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05, duration: 0.35, ease: "easeOut" }}
                                >
                                    <OverviewSignalCard
                                        insight={ins}
                                        isSelected={selectedId === ins.id && dialogOpen}
                                        onClick={() => handleCardClick(ins.id)}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    )}

                </div>
            </div>

            <DrillDownModal
                insight={selected}
                open={dialogOpen}
                onClose={handleClose}
                onAI={() => setShowAIPanel(true)}
                showAIPanel={showAIPanel}
                onCloseAIPanel={() => setShowAIPanel(false)}
            />
        </CommonContainer>
    );
};

export default InsightsSignalHub;