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
    Filter
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
        color: "#3b82f6", // Precise blue
        FamilyIcon: BarChart3,
        metricKey: "impactInr",
        metricLabel: "Offtake Loss Impact",
    },
    "Price Parity Radar": {
        family: "Pricing Positioning",
        color: "#0284c7", // Precise sky
        FamilyIcon: BadgePercent,
        metricKey: "impactInr",
        metricLabel: "Opportunity Available",
    },
    "Replenishment Breaks": {
        family: "Supply Chain",
        color: "#6366f1", // Precise indigo
        FamilyIcon: Truck,
        metricKey: "impactInr",
        metricLabel: "Excess Inventory Value",
    },
    "Competitor OSA Weak Spots": {
        family: "Competitive Landscape",
        color: "#10b981", // Precise emerald
        FamilyIcon: Radar,
        metricKey: "impactInr",
        metricLabel: "Opportunity Available",
    },
    "Ad Stock Mismatch": {
        family: "Performance Marketing",
        color: "#f59e0b", // Precise amber
        FamilyIcon: Megaphone,
        metricKey: "impactInr",
        metricLabel: "Ad Efficiency Loss",
    },
    "Keyword Efficiency and Budget Caps": {
        family: "Performance Marketing",
        color: "#f59e0b", // Precise amber
        FamilyIcon: Megaphone,
        metricKey: "impactInr",
        metricLabel: "Wasted Ad Spend",
    },
    "Challenger Launch Watch": {
        family: "Competitive Landscape",
        color: "#10b981", // Precise emerald
        FamilyIcon: Radar,
        metricKey: "impactInr",
        metricLabel: "Missed Opportunity",
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
    high: { border: "border-l-red-500", label: "text-red-700" },
    focus: { border: "border-l-blue-500", label: "text-blue-700" },
    good: { border: "border-l-emerald-500", label: "text-emerald-700" },
    neutral: { border: "border-l-slate-400", label: "text-slate-600" },
};

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
        const t = setTimeout(() => setVisibleCount((c) => c + 1), 150);
        return () => clearTimeout(t);
    }, [phase, visibleCount, segments.length]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="absolute top-0 right-0 h-full w-[320px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-slate-700" />
                    <div className="text-[12px] font-semibold text-slate-900">AI Summary</div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-slate-50/30">
                {phase === "loading" ? (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <Loader2 className="h-3 w-3 animate-spin" /> Analyzing signal data...
                    </div>
                ) : (
                    segments.map((seg, idx) => {
                        const s = priorityStyles[seg.priority] || priorityStyles.neutral;
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 5 }}
                                animate={idx < visibleCount ? { opacity: 1, y: 0 } : { opacity: 0, y: 5 }}
                                className={`bg-white border border-slate-200 p-3 shadow-sm rounded-sm border-l-2 ${s.border}`}
                            >
                                <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${s.label}`}>{seg.label}</div>
                                <p className="text-[11px] text-slate-700 leading-relaxed">{seg.text}</p>
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
    const isEmpty = insight.id.startsWith("empty_");
    const meta = SIGNAL_META[insight.type] || {};
    const { FamilyIcon, color, family, metricLabel } = meta;
    const evidenceCount = Math.max(0, insight.evidence?.filter(e => Object.values(e).some(v => v !== "-" && v !== 0 && v !== false && v !== null)).length || 0);
    const isNegativeMetric = /waste|miss|loss|excess|drop|break/i.test(metricLabel || "") || /waste|miss|loss|drop|break/i.test(insight.type || "");

    return (
        <div
            onClick={onClick}
            className={`group flex flex-col bg-white border transition-all duration-150 cursor-pointer rounded-sm
                ${isEmpty ? "opacity-60 border-slate-200" : "hover:border-slate-400 border-slate-200"}
                ${isSelected ? "ring-1 ring-blue-500 border-blue-500" : ""}
            `}
        >
            <div className="p-3 flex-1 flex flex-col">
                <div className="flex items-center gap-1.5 mb-2 text-slate-500">
                    {FamilyIcon && <FamilyIcon className="h-3 w-3" style={{ color: isEmpty ? '#94a3b8' : color }} />}
                    <span className="text-[10px] font-medium uppercase tracking-wider">{family}</span>
                </div>
                <h3 className="text-[13px] font-semibold text-slate-900 leading-tight mb-4 line-clamp-2 min-h-[32px]">
                    {insight.type}
                </h3>
                <div className="mt-auto grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                    <div>
                        <div className="text-[10px] text-slate-500 mb-0.5">{metricLabel}</div>
                        <div className={`text-[14px] font-bold ${isEmpty ? "text-slate-400" : (isNegativeMetric ? "text-red-600" : "text-slate-800")}`}>
                            {isEmpty ? "—" : formatINRCompact(insight.impactInr || 0)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-500 mb-0.5">Platforms</div>
                        <div className="text-[14px] font-bold text-slate-800">
                            {isEmpty ? "0" : Math.max(evidenceCount, insight.evidence?.length || 0)}
                        </div>
                    </div>
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
        <div className="flex flex-col h-full bg-white border border-slate-200 rounded-sm">
            <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50">
                <span className="text-[11px] font-semibold text-slate-700 ml-1">Evidence Data</span>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        className="pl-7 pr-2 py-1 text-[11px] border border-slate-300 rounded-sm bg-white focus:outline-none focus:border-blue-500 w-48"
                    />
                </div>
            </div>
            <ScrollArea className="h-[380px] w-full">
                <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <TableRow className="border-b border-slate-200 hover:bg-transparent">
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
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} OSA</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Market Share (MoM delta)</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PSL</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Offtake (Delta MoM)</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">My Brand Loser SKU</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Competitor Hero SKU</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Possible Cause</TableHead>
                            </>)}
                            {view === "pricing" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">PPU Cluster</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} PPU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Peer PPU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Index</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Cluster Share</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Cluster Growth</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Headroom</TableHead>
                            </>)}
                            {view === "adStock" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} SKU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} OSA</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Ad SOV</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Spend</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Est. Lost Sales</TableHead>
                            </>)}
                            {view === "newEntry" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Competitor SKU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Share</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PPU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">First Seen</TableHead>
                            </>)}
                            {view === "supply" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Depot / DB</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} SKU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Planned</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Dispatched</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Fill Rate</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PO</TableHead>
                            </>)}
                            {view === "keyword" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Keyword</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Campaign</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Bid</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Budget</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Spend</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Sales</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">ACOS</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Budget Cap</TableHead>
                            </>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-[11px] text-slate-400">
                                    No evidence data available.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((d, idx) => (
                                <TableRow key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                    {view === "osa" && (
                                        <>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.category}</TableCell>
                                            <TableCell className="text-[11px] text-slate-500 px-3 py-1.5">{d.platform ?? "-"}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.city}</TableCell>
                                            <TableCell className="text-[11px] text-slate-800 px-3 py-1.5">{d.skuOrBrand}</TableCell>
                                            <TableCell className="text-right text-[11px] text-slate-800 px-3 py-1.5">{safePct(d.otherBrandOsa)}</TableCell>
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

const PlatformButton = ({ platform, active, onClick }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 text-[12px] font-medium border-b-2 transition-colors ${active
            ? "border-slate-800 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
    >
        {platform}
    </button>
);

const DrillDownModal = ({ insight, open, onClose, onAI, showAIPanel, onCloseAIPanel, hubPlatform = "All platforms" }) => {
    const [activePlatform, setActivePlatform] = useState(hubPlatform !== "All platforms" ? hubPlatform : "All platforms");

    useEffect(() => {
        if (insight) setActivePlatform(hubPlatform !== "All platforms" ? hubPlatform : "All platforms");
    }, [insight, hubPlatform]);

    if (!insight) return null;

    const platforms = (insight.platforms || []).filter((p) => p !== "-");
    const isEmpty = insight.id.startsWith("empty_");

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-[1000px] w-[95vw] p-0 gap-0 rounded-sm overflow-hidden shadow-2xl bg-white border border-slate-300 outline-none [&>button]:hidden flex">
                
                <div className="flex-1 flex flex-col max-h-[85vh]">
                    <div className="border-b border-slate-200 px-5 py-4 flex items-start justify-between bg-slate-50/50 shrink-0">
                        <div>
                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-1.5">
                                <span>Signal Detail</span>
                                <ChevronRight className="h-3 w-3 text-slate-400" />
                                <span className="text-slate-700">{insight.family}</span>
                            </div>
                            <h2 className="text-[18px] font-semibold text-slate-900">{insight.type}</h2>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-800 transition-colors mt-1">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="border-b border-slate-200 px-5 py-3 flex flex-wrap gap-x-6 gap-y-3 items-center justify-between shrink-0 bg-white">
                        <div className="flex items-center gap-6">
                            <div>
                                <p className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide">Impact</p>
                                <p className="text-[15px] font-semibold text-slate-900">{formatINRCompact(insight.impactInr || 0)}</p>
                            </div>
                            <Separator orientation="vertical" className="h-8 bg-slate-200" />
                            <div className="flex gap-6">
                                {(insight.kpis || []).map((k, i) => (
                                    <div key={i}>
                                        <p className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide">{k.label}</p>
                                        <p className={`text-[14px] font-semibold ${getKpiStyle(k.label, k.value)}`}>{k.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <Button 
                            onClick={onAI}
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] rounded-sm border-slate-300 hover:bg-slate-50 text-slate-700"
                        >
                            <BrainCircuit className="h-3 w-3 mr-1.5" />
                            AI Insights
                        </Button>
                    </div>

                    {platforms.length > 1 && (
                        <div className="px-5 border-b border-slate-200 flex items-center gap-3 shrink-0 bg-slate-50/30">
                            <PlatformButton platform="All Platforms" active={activePlatform === "All platforms"} onClick={() => setActivePlatform("All platforms")} />
                            {platforms.map((p) => <PlatformButton key={p} platform={p} active={activePlatform === p} onClick={() => setActivePlatform(p)} />)}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-5 bg-white">
                        {!isEmpty && insight.whatWeSee?.some((w) => w !== "-") && (
                            <div className="mb-5">
                                <h3 className="text-[11px] font-semibold text-slate-800 uppercase tracking-widest mb-2">Key Observations</h3>
                                <ul className="space-y-1.5">
                                    {insight.whatWeSee.map((w, i) => (
                                        <li key={i} className="flex gap-2.5 text-[12px] text-slate-600">
                                            <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                                            <span>{w}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {isEmpty ? (
                            <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-sm">
                                <Activity className="h-5 w-5 mx-auto text-slate-300 mb-2" />
                                <p className="text-[12px]">No detailed evidence available.</p>
                            </div>
                        ) : (
                            <EvidenceTable insight={insight} activePlatform={activePlatform} />
                        )}
                    </div>
                </div>

                {/* Inline AI Panel Drawer */}
                <AnimatePresence>
                    {showAIPanel && <AIInsightsPanel insight={insight} onClose={onCloseAIPanel} />}
                </AnimatePresence>

            </DialogContent>
        </Dialog>
    );
};

// ─── MAIN PAGE COMPONENT ──────────────────────────────────────────────────────

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
            <div className="bg-slate-50 min-h-screen text-slate-900 pb-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">

                    {/* Header Strip */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4 mb-5">
                        <div>
                            <h1 className="text-[20px] font-semibold text-slate-900 mb-1 tracking-tight">AI Insights</h1>
                            <p className="text-[12px] text-slate-500">Anomaly detection & opportunity tracking</p>
                        </div>
                        {!loading && (
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-0.5">Total Opportunity</span>
                                    <span className="text-[16px] font-semibold text-slate-900">{formatINRCompact(totalImpact)}</span>
                                </div>
                                <div className="h-8 w-px bg-slate-300"></div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-0.5">Active Signals</span>
                                    <span className="text-[16px] font-semibold text-slate-900">{activeSignals}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Compact Filter Bar */}
                    <div className="bg-white p-3 rounded-sm border border-slate-200 flex flex-col md:flex-row flex-wrap gap-3 items-end mb-6 shadow-sm">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 self-center hidden lg:flex mr-2">
                            <Filter className="h-3.5 w-3.5" /> Filters
                        </div>
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                            <CustomHeaderDropdown label="SIGNAL" options={slicerOptions.types} value={typeFilter} onChange={(v) => setTypeFilter(v === "All" ? "All signals" : v)} multiSelect={false} />
                            <CustomHeaderDropdown label="GEOGRAPHY" options={slicerOptions.cities} value={cityFilter} onChange={(v) => setCityFilter(v === "All" ? "All cities" : v)} multiSelect={false} />
                            <CustomHeaderDropdown label="CATEGORY" options={slicerOptions.categories} value={categoryFilter} onChange={(v) => setCategoryFilter(v === "All" ? "All categories" : v)} multiSelect={false} />
                            <CustomHeaderDropdown label="CHANNEL" options={slicerOptions.platforms} value={platformFilter} onChange={(v) => setPlatformFilter(v === "All" ? "All platforms" : v)} multiSelect={false} />
                        </div>
                        <div className="w-full md:w-auto md:ml-2 flex-shrink-0">
                            <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, mb: 0.5, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>TIME PERIOD</Typography>
                            <DateRangeComparePicker timeStart={startDate} timeEnd={endDate} compareStart={null} compareEnd={null} maxDate={maxDate || dayjs()} onApply={(s, e) => { setStartDate(s); setEndDate(e); }} />
                        </div>
                    </div>

                    {/* Content Grid */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-200 rounded-sm">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400 mb-3" />
                            <div className="text-[12px] text-slate-500">Scanning analytics...</div>
                        </div>
                    ) : filteredInsights.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-200 rounded-sm">
                            <Radar className="h-8 w-8 text-slate-300 mb-3" />
                            <h3 className="text-[13px] font-semibold text-slate-900 mb-1">No signals detected</h3>
                            <p className="text-[11px] text-slate-500">Adjust filters to broaden scope.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredInsights.map((ins, idx) => (
                                <OverviewSignalCard key={ins.id} insight={ins} isSelected={selectedId === ins.id && dialogOpen} onClick={() => handleCardClick(ins.id)} />
                            ))}
                        </div>
                    )}

                    <DrillDownModal insight={selected} open={dialogOpen} onClose={handleClose} onAI={() => setShowAIPanel(true)} showAIPanel={showAIPanel} onCloseAIPanel={() => setShowAIPanel(false)} />
                </div>
            </div>
        </CommonContainer>
    );
};

export default InsightsSignalHub;