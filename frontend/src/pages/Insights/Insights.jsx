import React, { useMemo, useState, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Sparkles,
    Radar,
    BadgePercent,
    Megaphone,
    MapPinned,
    Truck,
    ShoppingBag,
    Store,
    Zap,
    BrainCircuit,
    Activity,
    BarChart3,
    AlertTriangle,
    ArrowUpRight,
    Loader2,
    ChevronRight,
    ChevronDown,
    TrendingUp,
    TrendingDown,
    Download,
    Search,
    LayoutGrid,
    List,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
const safeNum = (v) => (typeof v === "number" ? `${v}` : "-");
const safeINR = (v) => (typeof v === "number" ? formatINRCompact(v) : "-");
const safeINRFull = (v) =>
    typeof v === "number" ? `₹${v.toLocaleString("en-IN")}` : "-";

// ─── SIGNAL CONFIG ───────────────────────────────────────────────────────────

const SIGNAL_META = {
    "Share Headroom Hotspots": {
        family: "Market Share",
        color: "#6366f1",
        colorBg: "#eef2ff",
        colorText: "#4338ca",
        colorBorder: "#c7d2fe",
        FamilyIcon: BarChart3,
        metricKey: "impactInr",
        metricLabel: "Offtake Loss Impact",
        countLabel: "Platforms",
    },
    "Price Parity Radar": {
        family: "Pricing Positioning",
        color: "#0ea5e9",
        colorBg: "#f0f9ff",
        colorText: "#0369a1",
        colorBorder: "#bae6fd",
        FamilyIcon: BadgePercent,
        metricKey: "impactInr",
        metricLabel: "Opportunity Available",
        countLabel: "Platforms",
    },
    "Replenishment Breaks": {
        family: "Supply Chain",
        color: "#8b5cf6",
        colorBg: "#f5f3ff",
        colorText: "#5b21b6",
        colorBorder: "#ddd6fe",
        FamilyIcon: Truck,
        metricKey: "impactInr",
        metricLabel: "Excess Inventory Value",
        countLabel: "Platforms",
    },
    "Competitor OSA Weak Spots": {
        family: "Competitive Landscape",
        color: "#10b981",
        colorBg: "#ecfdf5",
        colorText: "#065f46",
        colorBorder: "#a7f3d0",
        FamilyIcon: Radar,
        metricKey: "impactInr",
        metricLabel: "Opportunity Available",
        countLabel: "Platforms",
    },
    "Ad Stock Mismatch": {
        family: "Performance Marketing",
        color: "#f97316",
        colorBg: "#fff7ed",
        colorText: "#c2410c",
        colorBorder: "#fed7aa",
        FamilyIcon: Megaphone,
        metricKey: "impactInr",
        metricLabel: "Ad Efficiency Loss",
        countLabel: "Platforms",
    },
    "Keyword Efficiency and Budget Caps": {
        family: "Performance Marketing",
        color: "#f97316",
        colorBg: "#fff7ed",
        colorText: "#c2410c",
        colorBorder: "#fed7aa",
        FamilyIcon: Megaphone,
        metricKey: "impactInr",
        metricLabel: "Wasted Ad Spend",
        countLabel: "Platforms",
    },
    "Challenger Launch Watch": {
        family: "Competitive Landscape",
        color: "#10b981",
        colorBg: "#ecfdf5",
        colorText: "#065f46",
        colorBorder: "#a7f3d0",
        FamilyIcon: Radar,
        metricKey: "impactInr",
        metricLabel: "Missed Opportunity",
        countLabel: "Platforms",
    },
};

const REQUIRED_SIGNAL_TYPES = Object.keys(SIGNAL_META);

// ─── EMPTY SIGNAL FACTORY ────────────────────────────────────────────────────

const createEmptySignal = (type, brandName = "Brand") => {
    const base = {
        id: `empty_${type.replace(/\s+/g, "_")}`,
        type,
        title: "No data detected for this signal",
        family: SIGNAL_META[type]?.family || "Market",
        platforms: ["-"],
        city: "-",
        category: "-",
        impactInr: 0,
        impactLabel: "-",
        brandName,
        kpis: [],
        whatWeSee: ["-", "-"],
        evidence: [],
    };

    switch (type) {
        case "Competitor OSA Weak Spots":
            base.kpis = [
                { label: "Other brand OSA", value: "0%" },
                { label: `${brandName} OSA`, value: "0%" },
                { label: "Cities", value: "0" },
            ];
            base.evidence = [{ category: "-", city: "-", skuOrBrand: "-", otherBrandOsa: 0, kwOsa: 0 }];
            break;
        case "Ad Stock Mismatch":
            base.kpis = [
                { label: `${brandName} OSA (avg)`, value: "0%" },
                { label: "Ad SOV", value: "0%" },
                { label: "Spend", value: "₹0" },
            ];
            base.evidence = [{ city: "-", skuOrBrand: "-", kwOsa: 0, adSov: 0, spendInr: 0, estLostSalesInr: 0 }];
            break;
        case "Price Parity Radar":
            base.kpis = [
                { label: "Price index", value: "0" },
                { label: "Cluster share", value: "0%" },
                { label: "Cluster growth", value: "0%" },
            ];
            base.evidence = [{ city: "-", category: "-", clusterName: "-", kwPpu: 0, peerPpu: 0, priceIndex: 0, clusterContributionPct: 0, clusterGrowthPct: 0 }];
            break;
        case "Share Headroom Hotspots":
            base.kpis = [
                { label: "Cities", value: "0" },
                { label: "Avg share gap", value: "0%" },
                { label: "Offtake Loss", value: "₹0" },
            ];
            base.evidence = [{
                city: "-",
                category: "-",
                brandOsa: 0,
                marketShare: 0,
                marketShareMoM: 0,
                psl: 0,
                offtake: 0,
                offtakeMoM: 0,
                myTopSku: "-",
                competitorSku: "-",
                possibleCause: "-"
            }];
            break;
        case "Challenger Launch Watch":
            base.kpis = [
                { label: "Share", value: "0%" },
                { label: "First seen", value: "-" },
                { label: "PPU", value: "0" },
            ];
            base.evidence = [{ city: "-", category: "-", skuOrBrand: "-", newItemShare: 0, ppu: 0, firstSeen: "-" }];
            break;
        case "Replenishment Breaks":
            base.kpis = [
                { label: "Fill rate", value: "0%" },
                { label: "Missing PO", value: "0" },
                { label: "Depot", value: "0" },
            ];
            base.evidence = [{ depotOrDb: "-", city: "-", skuOrBrand: "-", plannedQty: 0, dispatchedQty: 0, fillRate: 0, poCreated: false, poNo: "-" }];
            break;
        case "Keyword Efficiency and Budget Caps":
            base.kpis = [
                { label: "Waste keywords", value: "0" },
                { label: "Best ACOS", value: "0%" },
                { label: "Budget caps", value: "-" },
            ];
            base.evidence = [{ keyword: "-", campaign: "-", bid: 0, dailyBudget: 0, spend: 0, sales: 0, acos: 0, budgetCapped: false }];
            break;
        default:
            break;
    }
    return base;
};

// ─── AI INSIGHTS PANEL ───────────────────────────────────────────────────────

const buildAISegments = (insight) => {
    const type = insight.type;
    const brand = insight.brandName || "Brand";
    const city = insight.city !== "-" ? insight.city : "multiple regions";
    const category = insight.category !== "-" ? insight.category : "the overall category";
    const impactStr = formatINRCompact(insight.impactInr || 0);
    const ev = insight.evidence?.[0] || {};

    let highText = insight.whatWeSee?.[1] || "Significant deviation from benchmark detected — immediate review required.";
    let focusText = insight.whatWeSee?.[0] || "Signal detected with notable deviation from benchmark.";
    let recText = `Prioritize inventory alignment and review bid strategies for impacted SKUs in ${city}.`;

    if (type === "Replenishment Breaks") {
        highText = `Critical supply chain friction: ${ev.depotOrDb || "Depots"} are experiencing dispatch lags for ${ev.skuOrBrand || brand}. Fill rate has dropped to ${safePct(ev.fillRate) || "low levels"}.`;
        focusText = `Immediate focus required on ${ev.depotOrDb || "impacted DBs"}. ${ev.poCreated === false ? "No Purchase Order has been created to resolve this." : "PO is generated but dispatch remains stalled."}`;
        recText = `Investigate logistics bottlenecks at ${ev.depotOrDb || "key DBs"}. Prioritize pushing the pending ${Math.max(0, (ev.plannedQty || 0) - (ev.dispatchedQty || 0))} units of ${ev.skuOrBrand || brand}.`;
    } else if (type === "Competitor OSA Weak Spots") {
        highText = `Prime shelf-space void: ${ev.skuOrBrand || "Key competitors"} are seeing an OSA crash to ${safePct(ev.otherBrandOsa) || "low levels"}.`;
        focusText = `Capitalize on competitor stockouts in ${city}. Your OSA for ${brand} remains healthy at ${safePct(ev.kwOsa) || "benchmark"}, providing a structural advantage.`;
        recText = `Instruct field teams in ${city} to aggressively push ${brand} facings. Increase quick-commerce digital shelf visibility while competitor stock is dried up.`;
        // Replace the existing `else if (type === "Share Headroom Hotspots")` block with this:

    } else if (type === "Share Headroom Hotspots") {
        const t = insight.aiTrendData || {};
        const topThreat = t.topThreat || t;
        const ownBrand = t.ownBrand || null;
        const competitors = t.competitors || [];
        const hasRichData = topThreat && topThreat.brandName;

        if (hasRichData) {
            const isAdDriven = topThreat.primaryDriver === 'ad' || (topThreat.adSosChange || 0) > (topThreat.orgSosChange || 0);
            const driverLabel = isAdDriven ? 'Paid SOS (Ad Spend)' : 'Organic Visibility';
            const segments = [];

            // 1. Insights Summary — what happened
            let summaryText = `Off-take declined in ${category} (${city}, ~${impactStr})`;
            if (ownBrand && ownBrand.shareChangePpt < 0) {
                summaryText += `. ${brand}'s market share dropped from ${safePct(ownBrand.prevSharePct)} → ${safePct(ownBrand.currSharePct)} (${safePct(ownBrand.shareChangePpt)} change)`;
            }
            summaryText += ` driven by increased competitor visibility from ${topThreat.brandName}, limiting conversion and traffic for ${brand}.`;
            segments.push({ label: "✨ Insights Summary", priority: "high", text: summaryText });

            // 2. Why This is Happening — competitor SOS driver
            let whyText = `${topThreat.brandName} significantly stepped up overall visibility in ${city}`;
            whyText += `, gaining ${safePct(topThreat.shareChangePpt)} market share (now at ${safePct(topThreat.currSharePct)}).`;
            whyText += ` The primary driver is ${driverLabel}`;
            if (isAdDriven && topThreat.adSosChange) {
                whyText += ` — their Ad SOS jumped by ${safePct(topThreat.adSosChange)} (currently ${safePct(topThreat.currAdSos)})`;
            } else if (topThreat.orgSosChange) {
                whyText += ` — their Organic SOS rose by ${safePct(topThreat.orgSosChange)} (currently ${safePct(topThreat.currOrgSos)})`;
            }
            whyText += `, reducing traffic for ${brand} despite stable execution.`;
            segments.push({ label: "💡 Why This is Happening", priority: "focus", text: whyText });

            // 3. SKU Level Impact — the hero SKU that drove the gain
            let skuText = `${brand} lost share in ${city} as competitor '${topThreat.brandName}' pushed aggressive visibility on their hero SKU '${topThreat.skuProduct || topThreat.topSku || 'N/A'}'`;
            if (topThreat.overtook) {
                skuText += `. ${topThreat.brandName} has now overtaken ${brand} by ${safePct(topThreat.shareAheadBy)} market share`;
            }
            skuText += `, weakening your conversion despite stable ad execution.`;
            segments.push({ label: "📊 SKU Level Impact", priority: "neutral", text: skuText });

            // 4. Additional Competitor Threats (if > 1 competitor gained share)
            if (competitors.length > 1) {
                const others = competitors.slice(1, 4);
                const otherLines = others.map(c => {
                    const d = c.primaryDriver === 'ad' ? 'Ad SOS' : 'Organic SOS';
                    return `${c.brandName} (+${safePct(c.shareChangePpt)} share via ${d}, hero SKU: '${c.topSku || 'N/A'}')`;
                }).join('; ');
                segments.push({
                    label: "⚠️ Other Competitors Gaining",
                    priority: "focus",
                    text: `Additional competitors also gained share in this period: ${otherLines}.`
                });
            }

            // 5. Recommended Action
            segments.push({
                label: "🎯 Recommended Action",
                priority: "good",
                text: `Reach out to your CSM for a detailed report on Market Share Drop and to re-calibrate your ${isAdDriven ? 'bidding strategies and ad placements' : 'organic content and SEO optimizations'} against ${topThreat.brandName}${competitors.length > 1 ? ` and ${competitors.length - 1} other rising competitor${competitors.length > 2 ? 's' : ''}` : ''}.`
            });

            return segments;
        } else {
            // Fallback narrative if trend data isn't available
            highText = `Growth opportunity: A market share gap of ${safePct(ev.shareGap)} exists against benchmark potentials in ${city}.`;
            focusText = `The primary algorithmic growth driver flagged is '${ev.driverTag || "visibility"}'. Bridging the gap from ${safePct(ev.kwShare)} to the benchmark of ${safePct(ev.benchmarkShare)} will yield maximum returns.`;
            recText = `Mobilize promotional trade spends toward '${ev.driverTag || "conversion"}' factors in ${city} to quickly capture the ${impactStr} headroom.`;
        }
    } else if (type === "Price Parity Radar") {
        highText = `Pricing mismatch: ${brand} PPU is misaligned with the ${ev.clusterName || "market"} benchmark, currently sitting at an index of ${typeof ev.priceIndex === "number" ? ev.priceIndex.toFixed(1) : "-"}.`;
        focusText = `While peers are pricing at ₹${ev.peerPpu || "-"}, ${brand} sits at ₹${ev.kwPpu || "-"}. This disparity in ${category} threatens volume velocity.`;
        recText = `Evaluate running targeted markdown campaigns in ${city} or re-negotiating channel margins to restore price parity within the ${ev.clusterName || "category"} cluster.`;
    } else if (type === "Ad Stock Mismatch") {
        highText = `Wasted Ad Spend: Heavy ad spend combined with dangerously low stock! ${brand} has an Ad SOV of ${safePct(ev.adSov)} but OSA is severely depleted.`;
        focusText = `₹${typeof ev.spendInr === "number" ? ev.spendInr.toLocaleString("en-IN") : "-"} is actively being burnt on campaigns while stockouts are driving an estimated ${formatINRCompact(ev.estLostSalesInr || 0)} in lost sales.`;
        recText = `Pause ad campaigns for ${ev.skuOrBrand || brand} in ${city} immediately until stock replenishment is confirmed by supply chain.`;
    } else if (type === "Keyword Efficiency and Budget Caps") {
        const acosText = typeof ev.acos === "number" ? ev.acos + "%" : "high levels";
        highText = `Poor ROAS: Campaign '${ev.campaign || "Search"}' targeting '${ev.keyword || "keywords"}' is experiencing severe efficiency friction.`;
        focusText = `${ev.budgetCapped ? "Budgets are capping out too early in the day" : "ACOS is ballooning to " + acosText}, severely limiting the conversion potential of '${ev.keyword || "this keyword"}'.`;
        recText = `${ev.budgetCapped ? "Reallocate budgets from poorer performing keywords to ensure this campaign remains active during peak traffic." : "Lower exact-match bids or add negative search terms to trim wasted spend."}`;
    } else if (type === "Challenger Launch Watch") {
        highText = `Threat detection: New competitor entry! '${ev.skuOrBrand || "A new brand"}' recently launched and has already captured ${safePct(ev.newItemShare)} share.`;
        focusText = `Launched around ${ev.firstSeen || "recent dates"} at a disruptive PPU of ₹${ev.ppu || "-"}, directly threatening ${brand} volumes in ${city}.`;
        recText = `Monitor '${ev.skuOrBrand || "challenger"}' week-on-week share trajectory. Deploy defensive trade-promotions in ${city} to limit their early trial conversions.`;
    }

    return [
        { label: "🚨 High Priority", priority: "high", text: highText },
        { label: "📈 Estimated Impact", priority: "good", text: `${impactStr} revenue opportunity identified if corrective actions are deployed within the next 7-day window.` },
        { label: "🎯 Focus Area", priority: "focus", text: focusText },
        { label: "📊 Signal Context", priority: "neutral", text: `The ${type} signal was triggered across ${city} with category exposure in ${category}. The data correlates strongly with historical revenue dips.` },
        { label: "💡 Recommended Action", priority: "focus", text: recText },
        { label: "ℹ️ Strategic Next Step", priority: "neutral", text: `Reach out to your CSM for a detailed report on Market Share Trends and a targeted defensive tactical plan.` },
    ];
};

const priorityStyles = {
    high: { label: "text-red-600", text: "text-red-800", bg: "bg-red-50", border: "border-red-200" },
    focus: { label: "text-blue-600", text: "text-blue-800", bg: "bg-blue-50", border: "border-blue-200" },
    good: { label: "text-emerald-600", text: "text-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200" },
    neutral: { label: "text-violet-600", text: "text-slate-700", bg: "bg-white", border: "border-slate-200" },
};

const AIInsightsPanel = ({ insight, onClose }) => {
    const [phase, setPhase] = useState("loading");
    const [visibleCount, setVisibleCount] = useState(0);
    const segments = useMemo(() => buildAISegments(insight), [insight]);

    useEffect(() => {
        setPhase("loading");
        setVisibleCount(0);
        const t = setTimeout(() => setPhase("reveal"), 3000);
        return () => clearTimeout(t);
    }, [insight]);

    useEffect(() => {
        if (phase !== "reveal") return;
        if (visibleCount >= segments.length) return;
        const t = setTimeout(() => setVisibleCount((c) => c + 1), visibleCount === 0 ? 0 : 320);
        return () => clearTimeout(t);
    }, [phase, visibleCount, segments.length]);

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] backdrop-blur-md bg-slate-900/40"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="fixed w-[95%] max-w-2xl max-h-[65vh] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] bg-slate-50 rounded-2xl border border-slate-200 shadow-2xl shadow-black/20 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-md shadow-violet-500/20">
                            <BrainCircuit className="h-4 w-4 text-white" />
                        </div>
                        <div className="text-sm font-semibold text-slate-900">Signal Intelligence Report</div>
                    </div>
                    <div className="flex items-center gap-3">
                        {phase === "loading" && (
                            <div className="flex items-center gap-2 text-xs text-violet-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Analyzing signal...</span>
                            </div>
                        )}
                        <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-8 space-y-4 overflow-y-auto">
                    {phase === "loading" ? (
                        <div className="space-y-4 animate-pulse">
                            {segments.map((seg, i) => (
                                <div key={i} className="relative rounded-xl border border-slate-200 p-5 bg-white shadow-sm overflow-hidden">
                                    <div className="opacity-0 pointer-events-none">
                                        <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5">{seg.label}</div>
                                        <p className="text-sm leading-relaxed">{seg.text}</p>
                                    </div>
                                    <div className="absolute inset-0 p-5 flex flex-col justify-start pointer-events-none">
                                        <div className="h-2 w-28 rounded bg-slate-300 mb-4 mt-0.5" />
                                        <div className="h-3 rounded bg-slate-300 mb-2" style={{ width: i % 2 === 0 ? "85%" : "75%" }} />
                                        <div className="h-3 w-1/2 rounded bg-slate-300" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        segments.map((seg, idx) => {
                            const s = priorityStyles[seg.priority] || priorityStyles.neutral;
                            return (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, filter: "blur(12px)", y: 6 }}
                                    animate={idx < visibleCount ? { opacity: 1, filter: "blur(0px)", y: 0 } : { opacity: 0, filter: "blur(12px)", y: 6 }}
                                    transition={{ duration: 0.55, ease: "easeOut" }}
                                    className={`rounded-xl border p-5 ${s.bg} ${s.border}`}
                                >
                                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${s.label}`}>{seg.label}</div>
                                    <p className={`text-sm leading-relaxed ${s.text}`}>{seg.text}</p>
                                </motion.div>
                            );
                        })
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <span className="text-xs text-slate-500">Powered by Trailytics AI</span>
                    <Button size="sm" variant="outline" className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 text-xs" onClick={onClose}>
                        Back to Data
                    </Button>
                </div>
            </motion.div>
        </>
    );
};

// ─── OVERVIEW SIGNAL CARD (GobbleCube style) ─────────────────────────────────

const OverviewSignalCard = ({ insight, isSelected, onClick, index }) => {
    const [isHovered, setIsHovered] = useState(false);
    const isEmpty = insight.id.startsWith("empty_");
    const meta = SIGNAL_META[insight.type] || {};
    const { FamilyIcon, color, colorBg, colorText, colorBorder, family, metricLabel } = meta;

    const evidenceCount = insight.evidence?.filter((e) => {
        const hasData = Object.values(e).some((v) => v !== "-" && v !== 0 && v !== false && v !== null);
        return hasData;
    }).length || 0;

    const isNegativeMetric = /waste|miss|loss|excess|drop|break|penalty/i.test(metricLabel || "") || /waste|miss|loss|drop|break/i.test(insight.type || "");
    const metricColorClass = isNegativeMetric ? "text-rose-600" : "text-blue-600";

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: -4 }}
            transition={{ delay: index * 0.05, type: "spring", stiffness: 260, damping: 22 }}
            whileHover={{ scale: 1.04, y: -12 }}
            whileTap={{ scale: 0.96 }}
        >
            <div
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`relative rounded-2xl border border-transparent cursor-pointer transition-all duration-400 overflow-hidden group h-full flex flex-col ${isSelected || isHovered ? "shadow-[0_15px_80px_rgba(0,0,0,0.22)]" : "shadow-[0_8px_50px_rgba(0,0,0,0.14)]"
                    }`}
                style={{
                    background: isEmpty ? "#fafafa" : "white",
                    opacity: isEmpty ? 0.55 : 1,
                }}
            >
                <div className="px-5 pt-4 pb-4 min-h-[115px] flex flex-col justify-start">
                    {/* Family label */}
                    <div className="mb-2">
                        <span
                            className="text-[12px] font-bold"
                            style={{ color: colorText }}
                        >
                            {family}
                        </span>
                    </div>

                    {/* Signal type name */}
                    <div className="flex items-center gap-2.5">
                        {FamilyIcon && (
                            <FamilyIcon style={{ width: 14, height: 14, color }} />
                        )}
                        <span className="text-[18px] font-bold text-slate-900 leading-snug">
                            {insight.type}
                        </span>
                    </div>
                </div>

                {/* Divider Line & Columns */}
                <div className="border-t border-slate-300 flex-1 grid grid-cols-2 mt-0">
                    {/* Metrics col 1 */}
                    <div className="px-4 py-2.5 border-r border-slate-300 flex flex-col justify-center">
                        <div className="text-[12px] text-slate-500 mb-0.5">{metricLabel}</div>
                        <div className={`text-[19px] font-bold leading-none ${isEmpty ? "text-slate-400" : metricColorClass}`}>
                            {isEmpty ? "—" : formatINRCompact(insight.impactInr || 0)}
                        </div>
                    </div>
                    {/* Metrics col 2 */}
                    <div className="px-4 py-2.5 flex flex-col justify-center relative">
                        <div className="text-[12px] text-slate-500 mb-0.5">
                            Platforms
                        </div>
                        <div className="text-[20px] font-bold text-slate-900">
                            {isEmpty ? "0" : Math.max(evidenceCount, insight.evidence?.length || 0)}
                        </div>

                        {/* Hover search indicator */}
                        <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Search className="h-4 w-4 text-slate-800" />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
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
        return data.filter((row) =>
            Object.values(row).some((v) => String(v).toLowerCase().includes(q))
        );
    }, [insight.evidence, search, activePlatform]);

    return (
        <div>
            {/* Table toolbar */}
            <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    Evidence Data
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-slate-400 w-44"
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
                <ScrollArea className="h-[320px]">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                                {view === "osa" && (<>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Category</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Platform</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">City</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Competitor</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Other brand OSA</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">{insight.brandName} OSA</TableHead>
                                </>)}
                                {view === "share" && (<>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Category</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Platform</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">City</TableHead>
                                    {/* Replaced Overall SOS with dynamic Brand OSA */}
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">{insight.brandName} OSA</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Market Share (MoM delta)</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">PSI / PSL</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Offtake (Delta MoM)</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5 pl-4">My Brand Loser SKU</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5 pl-4">Competitor Hero SKU</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Possible Cause</TableHead>
                                </>)}
                                {view === "pricing" && (<>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">City</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Category</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">PPU Cluster</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">{insight.brandName} PPU</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Peer PPU</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Index</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Cluster Share</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Cluster Growth</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Headroom</TableHead>
                                </>)}
                                {view === "adStock" && (<>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">City</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">{insight.brandName} SKU</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">{insight.brandName} OSA</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Ad SOV</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Spend</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Est. Lost Sales</TableHead>
                                </>)}
                                {view === "newEntry" && (<>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Platform</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">City</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Category</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Competitor SKU</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Share</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">PPU</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">First Seen</TableHead>
                                </>)}
                                {view === "supply" && (<>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Platform</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Depot / DB</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">City</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">{insight.brandName} SKU</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Planned</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Dispatched</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Fill Rate</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">PO</TableHead>
                                </>)}
                                {view === "keyword" && (<>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Keyword</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-slate-500 py-2.5">Campaign</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Bid</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Budget</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Spend</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Sales</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">ACOS</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold text-slate-500 py-2.5">Budget Cap</TableHead>
                                </>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((d, idx) => (
                                <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    {view === "osa" && (
                                        <>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.category}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-500">{d.platform ?? "-"}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.city}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.skuOrBrand}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">{safePct(d.otherBrandOsa)}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-blue-600">{safePct(d.kwOsa)}</TableCell>
                                        </>
                                    )}
                                    {view === "share" && (
                                        <>
                                            <TableCell>
                                                <div className="flex flex-col items-start gap-1.5 py-1">
                                                    <span className="text-[12px] font-medium text-slate-900">{d.category ?? insight.category}</span>
                                                    <button className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-semibold hover:bg-blue-100 transition-colors">
                                                        Show
                                                    </button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-500">{d.platform ?? "-"}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.city ?? insight.city}</TableCell>

                                            {/* Render OSA instead of kwShare */}
                                            <TableCell className="text-right text-[12px] font-medium text-indigo-600">{safePct(d.brandOsa)}</TableCell>

                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">
                                                {safePct(d.marketShare)}{" "}
                                                <span className={d.marketShareMoM < 0 ? "text-rose-500" : "text-emerald-500"}>
                                                    ({d.marketShareMoM > 0 ? '+' : ''}{safePct(d.marketShareMoM)})
                                                </span>
                                            </TableCell>

                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">{safeINR(d.psl)}</TableCell>

                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">
                                                {safeINR(d.offtake)}{" "}
                                                <span className={(d.offtakeDelta || 0) < 0 ? "text-rose-500" : "text-emerald-500"}>
                                                    ({(d.offtakeDelta || 0) > 0 ? '+' : ''}{safeINR(d.offtakeDelta)} / {safePct(d.offtakeMoM)})
                                                </span>
                                            </TableCell>

                                            {/* Our Top Impacted SKU */}
                                            <TableCell className="pl-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-9 w-9 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                                                        <ShoppingBag className="h-4 w-4 text-slate-300" />
                                                    </div>
                                                    <span className="text-[12px] font-medium text-slate-800 line-clamp-2 max-w-[150px]">
                                                        {d.myTopSku || "-"}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            {/* Competitor Hero SKU */}
                                            <TableCell className="pl-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-9 w-9 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                                                        <TrendingUp className="h-4 w-4 text-rose-300" />
                                                    </div>
                                                    <span className="text-[12px] font-medium text-slate-800 line-clamp-2 max-w-[150px]">
                                                        {d.competitorSku || "-"}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.possibleCause || "-"}</TableCell>
                                        </>
                                    )}
                                    {view === "pricing" && (
                                        <>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.city}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.category}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.clusterName}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">₹{d.kwPpu}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">₹{d.peerPpu}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-amber-600">{d.priceIndex}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">{safePct(d.clusterContributionPct)}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">{safePct(d.clusterGrowthPct)}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-emerald-600">{safeINR(d.headroomInr)}</TableCell>
                                        </>
                                    )}
                                    {view === "adStock" && (
                                        <>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.city}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-800">{d.skuOrBrand}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-rose-600">{safePct(d.kwOsa)}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-amber-600">{safePct(d.adSov)}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">{safeINR(d.spendInr)}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-rose-500">{safeINR(d.estLostSalesInr)}</TableCell>
                                        </>
                                    )}
                                    {view === "newEntry" && (
                                        <>
                                            <TableCell className="text-[12px] font-medium text-slate-500">{d.platform ?? "-"}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.city}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.category}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-800">{d.skuOrBrand}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-emerald-600">{safePct(d.newItemShare)}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">₹{d.ppu}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-400">{d.firstSeen}</TableCell>
                                        </>
                                    )}
                                    {view === "supply" && (
                                        <>
                                            <TableCell className="text-[12px] font-medium text-slate-500">{d.platform ?? "-"}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-800">{d.depotOrDb}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.city}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-800">{d.skuOrBrand}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-400">{d.plannedQty}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">{d.dispatchedQty}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-rose-600">{safePct(d.fillRate)}</TableCell>
                                            <TableCell className="text-right">
                                                {d.poCreated ? (
                                                    <div className="flex flex-col items-end">
                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Created</Badge>
                                                        <span className="text-[9px] text-slate-400 mt-0.5">{d.poNo}</span>
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">Missing</Badge>
                                                )}
                                            </TableCell>
                                        </>
                                    )}
                                    {view === "keyword" && (
                                        <>
                                            <TableCell className="text-[12px] font-medium text-slate-900">{d.keyword}</TableCell>
                                            <TableCell className="text-[12px] font-medium text-slate-500 max-w-[150px] truncate">{d.campaign}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-900">₹{d.bid?.toFixed(1)}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-slate-400">{safeINR(d.dailyBudget)}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-amber-600">{safeINR(d.spend)}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-emerald-600">{safeINR(d.sales)}</TableCell>
                                            <TableCell className="text-right text-[12px] font-medium text-indigo-600">{safePct(d.acos)}</TableCell>
                                            <TableCell className="text-right">
                                                {d.budgetCapped ? (
                                                    <Badge className="bg-rose-500 text-white text-[10px]">Capped</Badge>
                                                ) : (
                                                    <span className="text-slate-300 text-[10px]">Active</span>
                                                )}
                                            </TableCell>
                                        </>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    );
};

// ─── DRILL DOWN PANEL ─────────────────────────────────────────────────────────

const getKpiColor = (label, value) => {
    const l = String(label).toLowerCase();
    const v = String(value).toLowerCase();

    // 1. Red (Negatives/Warnings)
    if (v.startsWith('-') || /gap|miss|lost|waste|drop|out of stock/.test(l)) {
        return { bg: "bg-rose-50", border: "border-rose-200", label: "text-rose-500", val: "text-rose-700" };
    }
    // 2. Green (Organic/Growth/Positive)
    if (/org|organic|growth|headroom|fill rate|best/.test(l)) {
        return { bg: "bg-emerald-50", border: "border-emerald-200", label: "text-emerald-600", val: "text-emerald-700" };
    }
    // 3. Orange (Ads/Spend/Costs)
    if (/ad\b|spend|budget|ppu|price|cost|acos/.test(l)) {
        return { bg: "bg-amber-50", border: "border-amber-200", label: "text-amber-500", val: "text-amber-700" };
    }
    // 4. Blue (Overall/Shares/SOS)
    if (/overall|share|sos|sov|osa|index/.test(l)) {
        return { bg: "bg-blue-50", border: "border-blue-200", label: "text-blue-500", val: "text-blue-700" };
    }
    // 5. Default Grayish
    return { bg: "bg-slate-50", border: "border-slate-200", label: "text-slate-500", val: "text-slate-700" };
};

const PlatformTag = ({ platform, active, onClick }) => {
    const PIcon = platform === "Blinkit" ? ShoppingBag : platform === "Zepto" ? Zap : Store;
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${active
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
        >
            <PIcon className="h-3 w-3" />
            {platform}
        </button>
    );
};

const DrillDownModal = ({ insight, open, onClose, onAI, showAIPanel, onCloseAIPanel, hubPlatform = "All platforms" }) => {
    const [activePlatform, setActivePlatform] = useState(hubPlatform !== "All platforms" ? hubPlatform : "All platforms");

    useEffect(() => {
        if (insight) {
            if (hubPlatform !== "All platforms") {
                setActivePlatform(hubPlatform);
            } else {
                setActivePlatform("All platforms");
            }
        }
    }, [insight, hubPlatform]);

    if (!insight) return null;

    const meta = SIGNAL_META[insight.type] || {};
    const { color, colorBg, colorBorder } = meta;
    const platforms = (insight.platforms || []).filter((p) => p !== "-");
    const isEmpty = insight.id.startsWith("empty_");

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-5xl w-[95vw] p-0 gap-0 rounded-2xl overflow-hidden border-0 shadow-2xl shadow-black/20 outline-none [&>button]:hidden">
                <DialogTitle className="sr-only">{insight.type} Dashboard</DialogTitle>
                <motion.div
                    initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col min-h-[75vh] max-h-[90vh]"
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
                        style={{ borderColor: colorBorder, background: colorBg }}
                    >
                        <div className="flex items-center gap-2">
                            {/* Colored top accent strip */}
                            <div className="h-7 w-1 rounded-full" style={{ background: color }} />
                            <div>
                                <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mb-0.5 mt-1">
                                    <span>Insights</span>
                                    <ChevronRight className="h-3 w-3" />
                                    <span className="font-semibold" style={{ color }}>{insight.type}</span>
                                </div>
                                <div className="text-lg font-bold text-slate-900 leading-tight line-clamp-1 mt-1 mb-1">
                                    {insight.title}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[11px] text-slate-400">Generated {dayjs().format("DD MMM, YYYY")}</span>
                            <button
                                onClick={onClose}
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white/70 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Platform tabs */}
                    {platforms.length > 1 && (
                        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 bg-white shrink-0">
                            <button
                                onClick={() => setActivePlatform("All platforms")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${activePlatform === "All platforms"
                                    ? "bg-slate-900 text-white border-slate-900"
                                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                    }`}
                            >
                                <LayoutGrid className="h-3 w-3" />
                                All Platforms
                            </button>
                            {platforms.map((p) => (
                                <PlatformTag
                                    key={p}
                                    platform={p}
                                    active={activePlatform === p}
                                    onClick={() => setActivePlatform(p)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Summary bar */}
                    <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[12px] font-semibold text-slate-800">
                                {insight.evidence?.length || 0} insights
                                <span className="text-slate-400 font-normal"> · Est. impact </span>
                                <span style={{ color }} className="font-bold">
                                    {formatINRCompact(insight.impactInr || 0)}
                                </span>
                            </span>
                        </div>
                        {/* KPI chips */}
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {(insight.kpis || []).map((k, i) => {
                                const c = getKpiColor(k.label, k.value);
                                return (
                                    <div key={i} className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1 ${c.bg} ${c.border}`}>
                                        <span className={`text-[10px] font-semibold ${c.label}`}>{k.label}</span>
                                        <span className={`text-[11px] font-bold ${c.val}`}>{k.value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Scrollable body */}
                    <div className="flex-1 overflow-y-auto bg-white">
                        {/* Insights summary bullets */}
                        {!isEmpty && insight.whatWeSee?.some((w) => w !== "-") && (
                            <div className="px-6 py-4 border-b border-slate-100">
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                                    Insights Summary
                                </div>
                                <ul className="space-y-1.5">
                                    {insight.whatWeSee.map((w, i) => (
                                        <li key={i} className="flex gap-2 text-[12px] text-slate-600">
                                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                                            {w}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* AI Insights Banner */}
                        <div
                            onClick={onAI}
                            className="mx-6 mt-5 flex items-center justify-between px-4 py-2.5 rounded-xl cursor-pointer hover:shadow-md transition-all border border-blue-100 bg-gradient-to-r from-blue-50/80 via-white to-white group"
                        >
                            <div className="flex items-center gap-2.5">
                                <Sparkles className="h-4 w-4 text-blue-600" />
                                <span className="text-[14px] font-bold text-blue-700">Insights Summary</span>
                                <div className="flex flex-col ml-1.5 justify-center">
                                    <span style={{ fontSize: '6px' }} className="uppercase tracking-widest text-blue-400 font-bold leading-[6px] mb-[2px]">powered by</span>
                                    <span style={{ fontSize: '10px' }} className="font-bold text-blue-500 leading-[10px]">Trailytics AI</span>
                                </div>
                            </div>
                            <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center group-hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/30">
                                <ChevronDown className="h-3.5 w-3.5 text-white" />
                            </div>
                        </div>

                        {/* Evidence table */}
                        <div className="px-6 pb-6 pt-5">
                            {isEmpty ? (
                                <div className="text-center py-16 text-slate-400 text-sm">
                                    No data available for this signal.
                                </div>
                            ) : (
                                <EvidenceTable insight={insight} activePlatform={activePlatform} />
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-end shrink-0">
                        <Button
                            onClick={onClose}
                            size="sm"
                            className="rounded-xl font-semibold px-6 bg-slate-900 text-white hover:bg-slate-800 text-xs h-10 border-0"
                        >
                            Dismiss
                        </Button>
                    </div>
                </motion.div>

                {/* AI Insights overlay — sits safely inside Radix DOM tree */}
                <AnimatePresence>
                    {showAIPanel && (
                        <AIInsightsPanel insight={insight} onClose={onCloseAIPanel} />
                    )}
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
            <div className="bg-background text-foreground">
                <div className="mx-auto max-w-7xl">

                    {/* Page Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between mt-6 mb-6"
                    >
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
                                    <Activity className="h-4 w-4 text-white" />
                                </div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Insights</h1>
                            </div>
                            <p className="text-[12px] text-slate-400">Live anomaly detection across all monitored platforms</p>
                        </div>

                        {/* Summary pills */}
                        {!loading && (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="text-[11px] font-semibold text-emerald-700">
                                        {formatINRCompact(totalImpact)} total opportunity
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5">
                                    <Activity className="h-3.5 w-3.5 text-indigo-600" />
                                    <span className="text-[11px] font-semibold text-indigo-700">
                                        {activeSignals} active signals
                                    </span>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* NEW: Insights Summary Banner (Screenshot style) */}
                    {/* {!loading && activeSignals > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white border-l-4 border-indigo-500 rounded-xl shadow-sm border border-slate-200 p-6 mb-6"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-4 w-4 text-indigo-500" />
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Insights Summary</h3>
                                <span className="text-[11px] text-slate-400 font-normal">powered by Trailytics IQ</span>
                            </div>
                            <ul className="space-y-3">
                                {allInsights
                                    .filter(i => !i.id.startsWith("empty_") && (i.type === "Share Headroom Hotspots" || i.type === "Ad Stock Mismatch"))
                                    .slice(0, 2)
                                    .map((i, idx) => {
                                        const lines = [];

                                        if (i.type === "Share Headroom Hotspots" && i.aiTrendData) {
                                            const t = i.aiTrendData;
                                            const topT = t.topThreat || t;
                                            const own = t.ownBrand || null;
                                            const comps = t.competitors || [];

                                            if (topT && topT.brandName) {
                                                const driverType = topT.primaryDriver === 'ad' ? 'Paid SOS' : 'Organic';
                                                // Line 1: What happened
                                                let l1 = `Off-take declined in ${i.category} (${i.city}, ~${formatINRCompact(i.impactInr || 0)})`;
                                                if (own && own.shareChangePpt < 0) {
                                                    l1 += ` — ${i.brandName}'s share dropped by ${safePct(Math.abs(own.shareChangePpt))}`;
                                                }
                                                l1 += ` as ${topT.brandName} gained ${safePct(topT.shareChangePpt)} share via ${driverType}.`;
                                                lines.push(l1);

                                                // Line 2: Competitor detail
                                                let l2 = `${topT.brandName} stepped up visibility in ${i.city}`;
                                                if (topT.adSosChange > 0) l2 += `, Ad SOS +${safePct(topT.adSosChange)}`;
                                                if (topT.orgSosChange > 0) l2 += `, Org SOS +${safePct(topT.orgSosChange)}`;
                                                if (topT.topSku || topT.skuProduct) l2 += `, hero SKU: '${topT.topSku || topT.skuProduct}'`;
                                                if (topT.overtook) l2 += ` — now overtaking ${i.brandName}`;
                                                l2 += '.';
                                                lines.push(l2);

                                                // Line 3: Additional competitors
                                                if (comps.length > 1) {
                                                    const others = comps.slice(1, 3).map(c => `${c.brandName} (+${safePct(c.shareChangePpt)})`).join(', ');
                                                    lines.push(`Other brands also gaining: ${others}.`);
                                                }
                                            } else {
                                                lines.push(`${i.title} in ${i.city} impacting headroom by ${formatINRCompact(i.impactInr)}.`);
                                            }
                                        } else if (i.type === "Ad Stock Mismatch") {
                                            lines.push(`Off-take in ${i.category} (${i.city}) is constrained by inventory gaps despite stable campaign spend, driving ${formatINRCompact(i.impactInr)} in potential lost sales.`);
                                        } else {
                                            lines.push(`${i.title} in ${i.city} impacting headroom by ${formatINRCompact(i.impactInr)}.`);
                                        }

                                        return lines.map((text, lineIdx) => (
                                            <li key={`${idx}-${lineIdx}`} className="flex items-start gap-3">
                                                <div className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                                <p className="text-sm text-slate-600 leading-relaxed">
                                                    {text}
                                                </p>
                                            </li>
                                        ));
                                    })
                                }
                                {activeSignals === 0 && (
                                    <li className="flex items-start gap-3">
                                        <div className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                        <p className="text-sm text-slate-600 leading-relaxed">No critical anomalies detected across your portfolio today.</p>
                                    </li>
                                )}
                            </ul>
                        </motion.div>
                    )} */}

                    {/* Filter Bar */}
                    <Box sx={{ display: "flex", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" }, alignItems: "flex-end", mb: 3 }}>
                        <CustomHeaderDropdown
                            label="SIGNAL TYPE"
                            options={slicerOptions.types}
                            value={typeFilter}
                            onChange={(v) => setTypeFilter(v === "All" ? "All signals" : v)}
                            width={{ xs: "calc(50% - 6px)", sm: 140 }}
                            multiSelect={false}
                        />
                        <CustomHeaderDropdown
                            label="GEOGRAPHY"
                            options={slicerOptions.cities}
                            value={cityFilter}
                            onChange={(v) => setCityFilter(v === "All" ? "All cities" : v)}
                            width={{ xs: "calc(50% - 6px)", sm: 130 }}
                            multiSelect={false}
                        />
                        <CustomHeaderDropdown
                            label="CATEGORY"
                            options={slicerOptions.categories}
                            value={categoryFilter}
                            onChange={(v) => setCategoryFilter(v === "All" ? "All categories" : v)}
                            width={{ xs: "calc(50% - 6px)", sm: 130 }}
                            multiSelect={false}
                        />
                        <CustomHeaderDropdown
                            label="CHANNEL"
                            options={slicerOptions.platforms}
                            value={platformFilter}
                            onChange={(v) => setPlatformFilter(v === "All" ? "All platforms" : v)}
                            width={{ xs: "calc(50% - 6px)", sm: 120 }}
                            multiSelect={false}
                        />
                        <Box sx={{ width: { xs: "100%", sm: 200 }, flexShrink: 0 }}>
                            <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, mb: 0.4, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "Roboto, sans-serif", color: "#64748b" }}>
                                TIME PERIOD
                            </Typography>
                            <DateRangeComparePicker
                                timeStart={startDate}
                                timeEnd={endDate}
                                compareStart={null}
                                compareEnd={null}
                                maxDate={maxDate || dayjs()}
                                onApply={(s, e) => { setStartDate(s); setEndDate(e); }}
                            />
                        </Box>
                    </Box>

                    {/* "Actionable Insights Overview" label */}
                    <div className="flex items-center gap-2 mb-3">
                        {/* <span className="text-[12px] font-semibold text-slate-600">Actionable Insights Overview</span> */}
                        <div className="flex items-center gap-1.5 rounded-md border border-violet-100 bg-violet-50 px-2 py-0.5">
                            {/* <div className="h-1.5 w-1.5 rounded-full bg-violet-500" /> */}
                            {/* <span className="text-[10px] font-semibold text-violet-600">powered by Trailytics AI</span> */}
                        </div>
                        {/* <span className="text-[11px] text-slate-400 ml-1">· Click a signal to view details</span> */}
                    </div>

                    {/* Signal Cards Grid */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="relative">
                                <div className="h-10 w-10 rounded-full border-4 border-violet-100 border-t-violet-500 animate-spin" />
                                <Activity className="h-3.5 w-3.5 text-violet-400 absolute inset-0 m-auto" />
                            </div>
                            <div className="text-[12px] font-medium text-slate-400">Scanning signals across platforms...</div>
                        </div>
                    ) : filteredInsights.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-slate-100 p-16 text-center">
                            <div className="mx-auto h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center mb-3 border">
                                <Radar className="h-5 w-5 text-slate-300" />
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900">No signals detected</h3>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">Try broadening your filters or selecting a different city or time period.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {filteredInsights.map((ins, idx) => (
                                    <OverviewSignalCard
                                        key={ins.id}
                                        insight={ins}
                                        isSelected={selectedId === ins.id && dialogOpen}
                                        onClick={() => handleCardClick(ins.id)}
                                        index={idx}
                                    />
                                ))}
                            </div>

                            {/* Signal Detail Modal */}
                            <DrillDownModal
                                insight={selected}
                                open={dialogOpen}
                                onClose={handleClose}
                                onAI={() => setShowAIPanel(true)}
                                showAIPanel={showAIPanel}
                                onCloseAIPanel={() => setShowAIPanel(false)}
                            />
                        </>
                    )}

                </div>
            </div>
        </CommonContainer>
    );
};

export default InsightsSignalHub;