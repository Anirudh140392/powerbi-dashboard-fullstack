import React, { useMemo, useState, useEffect, useContext, useCallback } from "react";
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
    ChevronDown,
    Search,
    Filter,
    Signal,
    Package,
    ArrowRightLeft,
    MapPin,
    Store,
    Info,
    TrendingUp,
    TrendingDown,
    ArrowLeft,
    Calendar,
    Link2,
} from "lucide-react";


import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import CommonContainer from "@/components/CommonLayout/CommonContainer";
import { FilterContext } from "@/utils/FilterContext";
import { fetchInsights, fetchInsightsFilters, fetchCorrelations, fetchCorrelationsTrend } from "@/api/insightsService";
import AIInsightsPanelLive from "@/components/insights/AIInsightsPanelLive";
import TrailyticsTypewriterLoader from "@/components/insights/TrailyticsTypewriterLoader";
import CustomHeaderDropdown from "@/components/CommonLayout/CustomHeaderDropdown";
import DateRangeComparePicker from "@/components/CommonLayout/DateRangeComparePicker";
import dayjs from "dayjs";
import { Typography, Divider, Skeleton, Tooltip } from "@mui/material";
import InsightsOnboardingTour, { DrillDownTour } from "@/components/insights/InsightsOnboardingTour";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import useKpiPermissions from "../../hooks/useKpiPermissions";

// ─── HELPERS ────────────────────────────────────────────────────────────────

const formatINRCompact = (n) => {
    if (typeof n !== "number") return "N/A";
    const abs = Math.abs(n);
    if (abs >= 1e7) return `₹${(n / 1e7).toFixed(1)} Cr`;
    if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)} lac`;
    if (abs >= 1e3) return `₹${(n / 1e3).toFixed(0)} K`;
    return `₹${n.toFixed(0)}`;
};

const formatUnitsCompact = (n) => {
    if (typeof n !== "number") return "N/A";
    const abs = Math.abs(n);
    if (abs >= 1e7) return `${(n / 1e7).toFixed(1)} Cr`;
    if (abs >= 1e5) return `${(n / 1e5).toFixed(1)} lac`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
    return n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
};

const safePct = (v) => (typeof v === "number" ? `${v.toFixed(1)}%` : "-");
const safeINR = (v) => (typeof v === "number" ? formatINRCompact(v) : "-");

// ─── SIGNAL CONFIG ───────────────────────────────────────────────────────────

export const SIGNAL_META = {
    "Share Headroom Hotspots": {
        family: "Market Share",
        color: "#4a6fa5", accent: "#e8eef6",
        FamilyIcon: BarChart3, metricKey: "impactInr",
        metricLabel: "Offtake Loss Impact", trend: "negative",
        isBeta: false,
    },
    "Price Parity Radar": {
        family: "Pricing Positioning",
        color: "#3d7a8a", accent: "#e4f0f3",
        FamilyIcon: BadgePercent, metricKey: "impactInr",
        metricLabel: "Opportunity Available", trend: "negative",
        isBeta: false,
    },
    "DS Listing Summary": {
        family: "Dark Store",
        color: "#7c3aed", accent: "#ede9fe",
        FamilyIcon: Store, metricKey: "impactInr",
        metricLabel: "Potential Sales Loss", trend: "negative",
        isBeta: true,
    },
    "Competitor OSA Weak Spots": {
        family: "Competitive Landscape",
        color: "#3a7d68", accent: "#e3f1ec",
        FamilyIcon: Radar, metricKey: "impactInr",
        metricLabel: "Opportunity Available", trend: "positive",
        isBeta: false,
    },
    "Remove Ad Low OSA": {
        family: "Performance Marketing",
        color: "#8a6a3d", accent: "#f3ede3",
        FamilyIcon: Megaphone, metricKey: "impactInr",
        metricLabel: "Ad Efficiency Loss", trend: "negative",
        isBeta: false,
    },

    "Surplus Stock": {
        family: "Supply Chain",
        color: "#6b5ea8", accent: "#eeebf8",
        FamilyIcon: Package, metricKey: "impactInr",
        metricLabel: "Excess Inventory", trend: "negative",
        isBeta: false,
    },
    "Prioritise PO": {
        family: "Supply Chain",
        color: "#8a4a6b", accent: "#f5e8ef",
        FamilyIcon: Truck, metricKey: "impactInr",
        metricLabel: "Projected Sales Loss", trend: "negative",
        isBeta: false,
    },
    "Transfer Issue": {
        family: "Supply Chain",
        color: "#5a7a4e", accent: "#ebf3e8",
        FamilyIcon: ArrowRightLeft, metricKey: "impactInr",
        metricLabel: "Projected Sales Loss", trend: "negative",
        isBeta: false,
    },
    "New Market Entry": {
        family: "Competitive Landscape",
        color: "#4a6b8a", accent: "#e6eff6",
        FamilyIcon: MapPin, metricKey: "impactInr",
        metricLabel: "Last Seen Date", trend: "negative",
        isBeta: true,
    },
    "Dark Store Coverage Gaps": {
        family: "Dark Store",
        color: "#7c3aed", accent: "#ede9fe",
        FamilyIcon: Store, metricKey: "impactInr",
        metricLabel: "Potential Sales Loss", trend: "negative",
    },
    "New Dark Store Expansion": {
        family: "Dark Store",
        color: "#6d28d9", accent: "#f5f3ff",
        FamilyIcon: Store, metricKey: "impactInr",
        metricLabel: "Potential Sales Loss", trend: "negative",
    },
    "Co-Relations": {
        family: "KPI Correlation",
        color: "#6366f1", accent: "#eef2ff",
        FamilyIcon: Link2, metricKey: "impactInr",
        metricLabel: "KPI Anomalies Detected", trend: "negative",
        isBeta: true,
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
            base.evidence = [{ category: "-", city: "-", platform: "-", skuOrBrand: "-", otherBrandOsa: 0, otherBrandOsaChangePct: 0, kwOsa: 0, ourBrandMkShare: null, gapPct: 0 }];
            break;
        case "Remove Ad Low OSA":
            base.kpis = [{ label: `${brandName} OSA (avg)`, value: "0%" }, { label: "Ad SOV", value: "0%" }, { label: "Spend", value: "₹0" }];
            base.evidence = [{ city: "-", platform: "-", skuOrBrand: "-", kwOsa: 0, adSov: 0, spendInr: 0, estLostSalesInr: 0 }];
            break;
        case "Price Parity Radar":
            base.kpis = [];
            base.evidence = [{ city: "-", category: "-", ourPpu: 0, compPpu: 0, impactedSku: "-", compSku: "-", gapPct: 0, psl: 0 }];
            break;
        case "Share Headroom Hotspots":
            base.kpis = [{ label: "Market Share", value: "0%" }, { label: "Offtake", value: "₹0" }, { label: "Avg share gap", value: "0%" }];
            base.evidence = [{ city: "-", category: "-", brandOsa: 0, marketShare: 0, marketShareMoM: 0, psl: 0, offtake: 0, offtakeMoM: 0, myTopSku: "-", competitorSku: "-", possibleCause: "-" }];
            break;
        case "DS Listing Summary":
            base.kpis = [{ label: "Priority Localities", value: "0" }, { label: "Affected SKUs", value: "0" }, { label: "Avg OSA", value: "0%" }];
            base.evidence = [{ skuName: "-", city: "-", platform: "-", category: "-", priorityLocalities: 0, categorySales: 0, competitors: "-", osa: 0, possibleCause: "-" }];
            break;

        case "Surplus Stock":
            base.kpis = [{ label: "Avg DOI", value: "0 days" }, { label: "Affected SKUs", value: "0" }, { label: "Open PO Qty", value: "0" }];
            base.evidence = [{ skuName: "-", platform: "-", city: "-", excessInventory: 0, excessDOI: 0, drr: 0, currentDiscount: 0, excessInventoryValue: 0, openPOQty: 0 }];
            break;
        case "Prioritise PO":
            base.kpis = [{ label: "PSL", value: "₹0" }, { label: "Avg OSA", value: "0%" }, { label: "Critical SKUs", value: "0" }];
            base.evidence = [{ poNumber: "-", skuName: "-", platform: "-", facility: "-", osa: 0, projectedSalesLoss: 0, poRaisedDate: "-", poStatus: "-" }];
            break;
        case "Transfer Issue":
            base.kpis = [{ label: "PSL", value: "₹0" }, { label: "Avg Backed DOI", value: "0 days" }, { label: "Cities", value: "0" }];
            base.evidence = [{ skuName: "-", city: "-", platform: "-", cpd: 0, backedDOI: 0, osa: 0, projectedSalesLoss: 0 }];
            break;
        case "New Market Entry":
            base.kpis = [{ label: "New SKUs", value: "0" }, { label: "Competitors", value: "0" }, { label: "Cities", value: "0" }];
            base.evidence = [{ skuName: "-", city: "-", platform: "-", category: "-", competitorName: "-", pfu: 0, firstSeenDate: "-" }];
            break;
        case "Dark Store Coverage Gaps":
            base.kpis = [{ label: "Avg Listing %", value: "0%" }, { label: "Dark Stores", value: "0" }, { label: "Avg OSA", value: "0%" }];
            base.evidence = [{ category: "-", city: "-", platform: "-", storeCount: 0, listedSkus: 0, totalPlatformSkus: 0, listingPct: 0, osa: 0, sales: 0, psl: 0 }];
            break;
        case "New Dark Store Expansion":
            base.kpis = [{ label: "New Stores", value: "0" }, { label: "Cities", value: "0" }, { label: "Avg Listing %", value: "0%" }];
            base.evidence = [{ category: "-", city: "-", platform: "-", region: "-", tier: "-", newStoreCount: 0, listingPct: 0, sobNewDs: 0, sales: 0, competitors: "-", psl: 0 }];
            break;
        case "Co-Relations":
            base.kpis = [{ label: "KPI Anomalies", value: "0" }, { label: "Sales Change", value: "0%" }, { label: "OSA Change", value: "0pp" }];
            base.evidence = [];
            break;
        default: break;
    }
    return base;
};

// ─── AI INSIGHTS HELPERS ─────────────────────────────────────────────────────

const B = (v) => `**${v}**`;

const renderBoldText = (text) => {
    if (!text) return null;
    const parts = String(text).split(/(\*\*[^*]+\*\*)/);
    return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={i} style={{ color: "#0f172a", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
};

const diagnoseCause = (evidence, aiTrendData, brand) => {
    const ev = evidence?.[0] || {};
    const threat = aiTrendData?.topThreat;

    if (threat?.primaryDriver === "ad" && threat?.shareChangePpt > 0) {
        return { cause: "ad", competitor: threat.brandName, text: `${B(threat.brandName)} grew Paid SOS by ${B(safePct(threat.adSosChange || threat.shareChangePpt))}, outbidding ${B(brand)}.` };
    }
    if (threat?.primaryDriver === "organic" && threat?.shareChangePpt > 0) {
        return { cause: "organic", competitor: threat.brandName, text: `${B(threat.brandName)} grew Organic visibility by ${B(safePct(threat.orgSosChange || threat.shareChangePpt))}, displacing ${B(brand)}.` };
    }
    if (ev.brandOsa && ev.brandOsa < 80) {
        return { cause: "osa", competitor: ev.topThreat || "competitors", text: `${B(brand)} OSA at ${B(safePct(ev.brandOsa))} — out-of-stock listings losing conversions.` };
    }
    if (threat?.brandName) {
        return { cause: "share", competitor: threat.brandName, text: `${B(threat.brandName)} gained ${B("+" + safePct(threat.shareChangePpt))} share${threat.topSku ? ` via SKU ${B("'" + threat.topSku + "'")}` : ""}.` };
    }
    return { cause: "visibility", competitor: "N/A", text: `${B(brand)} visibility underperforming vs category benchmark.` };
};

export const buildAISegments = (insight) => {
    const type = insight.type;
    const brand = insight.brandName || "Brand";
    const allEv = insight.evidence || [];

    // If no evidence, fallback safely
    if (allEv.length === 0) return [
        { label: "Signal", priority: "high", text: "No data detected." },
        { label: "Details", priority: "focus", text: "We need more data to analyze." },
        { label: "Impact", priority: "good", text: "Impact unknown." },
        { label: "Action", priority: "neutral", text: "Continue monitoring." },
    ];

    const impact = B(formatINRCompact(insight.impactInr || 0));

    if (type === "Share Headroom Hotspots") {
        const worst = allEv.reduce((w, e) => ((e.psl || 0) > (w.psl || 0) ? e : w), allEv[0]);
        const totalPsl = allEv.reduce((s, e) => s + (e.psl || 0), 0);
        const city = worst.city !== "-" ? worst.city : "multiple regions";
        const category = worst.category !== "-" ? worst.category : "the category";
        const compSku = worst.competitorSku && worst.competitorSku !== "-" ? worst.competitorSku : null;
        const ourSku = worst.myTopSku && worst.myTopSku !== "-" ? worst.myTopSku : null;

        return [
            {
                label: "Share Decline", priority: "high",
                text: `Significant share opportunity identified. ${B(brand)} is experiencing a decline in ${B(category)} across ${B(allEv.length)} locations, primarily in ${B(city)}.`
            },
            {
                label: "Root Cause", priority: "focus",
                text: `A ${B("visibility gap")} against competitors is the primary driver. The current market share of ${B(safePct(worst.marketShare))} in ${B(city)} requires attention.`
            },
            {
                label: "SKU Performance", priority: "neutral",
                text: compSku
                    ? `Competitor SKU ${B("'" + compSku + "'")} is outperforming ${ourSku ? `${B(brand)}'s ${B("'" + ourSku + "'")}` : "the current lineup"}.`
                    : `Key SKUs are currently underperforming against established category benchmarks.`
            },
            {
                label: "Recommended Action", priority: "good",
                text: `Focus efforts in ${B(city)}. Optimize visibility and improve OSA to capture a potential recovery pool of ${B(formatINRCompact(totalPsl))}.`
            },
        ];
    }

    if (type === "Price Parity Radar") {
        const worst = allEv.reduce((w, e) => (Math.abs(e.gapPct || 0) > Math.abs(w.gapPct || 0) ? e : w), allEv[0]);
        const compSku = worst.compSku && worst.compSku !== "-" ? worst.compSku : "competitor";
        const ourSku = worst.impactedSku && worst.impactedSku !== "-" ? worst.impactedSku : "our product";
        const dir = (worst.gapPct || 0) > 0 ? "overpriced" : "underpriced";

        return [
            {
                label: "Pricing Variance", priority: "high",
                text: `Pricing discrepancy detected. ${B(brand)} is ${B(dir)} across ${B(allEv.length)} locations. Maximum variance observed: ${B(safePct(Math.abs(worst.gapPct || 0)))} in ${B(worst.city)}.`
            },
            {
                label: "SKU Comparison", priority: "focus",
                text: `Competitor SKU ${B(compSku)} is priced at ${B("₹" + worst.compPpu)}, whereas ${B("'" + ourSku + "'")} is priced at ${B("₹" + worst.ourPpu)}.`
            },
            {
                label: "Revenue Impact", priority: "good",
                text: `This pricing misalignment presents a potential revenue risk of ${impact} if unresolved.`
            },
            {
                label: "Recommended Action", priority: "neutral",
                text: dir === "overpriced"
                    ? `Consider targeted price adjustments or promotional offers in ${B(worst.city)} to align with ${B(compSku)}.`
                    : `Pricing advantage identified. Evaluate potential price adjustments to optimize margins.`
            },
        ];
    }

    if (type === "Competitor OSA Weak Spots") {
        const worstComp = allEv.reduce((w, e) => ((e.otherBrandOsa || 100) < (w.otherBrandOsa || 100) ? e : w), allEv[0]);
        const totalGap = allEv.reduce((s, e) => s + (e.gapPct || 0), 0) / allEv.length;

        return [
            {
                label: "Market Opportunity", priority: "high",
                text: `Competitor out-of-stock events detected across ${B(allEv.length)} regions. Average availability gap: ${B(safePct(totalGap))}.`
            },
            {
                label: "Key Competitor", priority: "focus",
                text: `${B(worstComp.skuOrBrand || "A key competitor")} has experienced an OSA drop to ${B(safePct(worstComp.otherBrandOsa))} in ${B(worstComp.city)}.`
            },
            {
                label: "Upside Potential", priority: "good",
                text: `${B(brand)} maintains stable availability at ${B(safePct(worstComp.kwOsa))}, presenting a potential ${impact} market capture opportunity.`
            },
            {
                label: "Recommended Action", priority: "neutral",
                text: `Increase sponsored ad visibility in ${B(worstComp.city)} to capture consumer demand during competitor stockouts.`
            },
        ];
    }

    if (type === "Remove Ad Low OSA") {
        const worst = allEv.reduce((w, e) => ((e.estLostSalesInr || 0) > (w.estLostSalesInr || 0) ? e : w), allEv[0]);
        const totalSpend = allEv.reduce((s, e) => s + (e.spendInr || 0), 0);
        const totalLoss = allEv.reduce((s, e) => s + (e.estLostSalesInr || 0), 0);

        return [
            {
                label: "Ad Efficiency", priority: "high",
                text: `Inefficient ad spend detected. ${B("₹" + totalSpend.toLocaleString("en-IN"))} is allocated to promoting ${B(allEv.length)} items with low availability.`
            },
            {
                label: "Primary Driver", priority: "focus",
                text: `${B("'" + (worst.skuOrBrand || brand) + "'")} in ${B(worst.city)} is consuming ad budget while experiencing low OSA (${B(safePct(worst.kwOsa))}).`
            },
            {
                label: "Sales Impact", priority: "good",
                text: `Traffic directed to out-of-stock items has resulted in an estimated ${B(formatINRCompact(totalLoss))} in missed sales.`
            },
            {
                label: "Recommended Action", priority: "neutral",
                text: `Pause ad campaigns for ${B("'" + (worst.skuOrBrand || brand) + "'")} in ${B(worst.city)}. Reallocate budget to items with >80% OSA.`
            },
        ];
    }

    if (type === "Keyword Efficiency and Budget Caps") {
        const worst = allEv.reduce((w, e) => ((e.spend || 0) > (w.spend || 0) ? e : w), allEv[0]);
        const totalWaste = allEv.reduce((s, e) => s + (e.spend || 0), 0);
        const cappedCount = allEv.filter(e => e.budgetCapped).length;

        return [
            {
                label: "Keyword Efficiency", priority: "high",
                text: `${B(allEv.length)} underperforming keywords identified, resulting in ${B("₹" + totalWaste.toLocaleString("en-IN"))} of inefficient spend.`
            },
            {
                label: "Primary Driver", priority: "focus",
                text: `The keyword ${B("'" + (worst.keyword || "-") + "'")} on ${B(worst.platform || "-")} is underperforming with an ACOS of ${B(safePct(worst.acos))}.`
            },
            {
                label: "Budget Impact", priority: "good",
                text: cappedCount > 0 ? `${B(cappedCount)} high-performing campaigns are currently budget-capped due to inefficient keyword allocation.` : `${impact} of ad spend could be optimized for higher returns.`
            },
            {
                label: "Recommended Action", priority: "neutral",
                text: `Reduce bids on ${B("'" + (worst.keyword || "underperforming keywords") + "'")} to reallocate funds toward higher-yielding campaigns.`
            },
        ];
    }

    if (type === "DS Listing Summary") {
        const worst = allEv.reduce((w, e) => ((e.priorityLocalities || 0) > (w.priorityLocalities || 0) ? e : w), allEv[0]);
        const totalPriorityLoc = allEv.reduce((s, e) => s + (e.priorityLocalities || 0), 0);
        const uniqueCities = new Set(allEv.map(e => e.city).filter(Boolean)).size;
        const withCompetitors = allEv.filter(e => e.competitors && e.competitors !== '-').length;

        return [
            {
                label: "Listing Gap", priority: "high",
                text: `${B(allEv.length)} SKUs are missing from ${B(totalPriorityLoc)} priority dark store localities across ${B(uniqueCities)} cities.`
            },
            {
                label: "Key Concern", priority: "focus",
                text: `${B("'" + (worst.skuName || brand) + "'")} is absent from ${B(worst.priorityLocalities || 0)} localities in ${B(worst.city)}, with OSA at ${B(safePct(worst.osa))}.`
            },
            {
                label: "Competitive Risk", priority: "good",
                text: withCompetitors > 0
                    ? `${B(withCompetitors)} of these locations have competitor brands actively listed, capturing demand.`
                    : `These listing gaps place an estimated ${impact} of revenue at risk.`
            },
            {
                label: "Recommended Action", priority: "neutral",
                text: `Prioritize listing ${B("'" + (worst.skuName || brand) + "'")} in ${B(worst.city)} dark stores. Fix cause: ${B(worst.possibleCause || "Transfer issue")}.`
            },
        ];
    }


    if (type === "Surplus Stock") {
        const worst = allEv.reduce((w, e) => ((e.excessInventoryValue || 0) > (w.excessInventoryValue || 0) ? e : w), allEv[0]);
        const totalValue = allEv.reduce((s, e) => s + (e.excessInventoryValue || 0), 0);
        const totalOpenPO = allEv.reduce((s, e) => s + (e.openPOQty || 0), 0);

        return [
            {
                label: "Excess Inventory", priority: "high",
                text: `Surplus stock identified. ${B(allEv.length)} SKUs currently account for ${B(formatINRCompact(totalValue))} in excess inventory value.`
            },
            {
                label: "Key Contributor", priority: "focus",
                text: `${B("'" + (worst.skuName || brand) + "'")} at the ${B(worst.city)} facility currently holds ${B((worst.excessDOI || 0).toFixed(0))} days of excess inventory.`
            },
            {
                label: "Open PO Status", priority: "good",
                text: totalOpenPO > 0
                    ? `There are currently ${B(Math.round(totalOpenPO).toLocaleString('en-IN'))} units in open purchase orders, which may further increase surplus levels.`
                    : `No open purchase orders detected. Inventory depletion rates remain slower than expected.`
            },
            {
                label: "Recommended Action", priority: "neutral",
                text: `Consider promotional bundles or targeted sales for ${B("'" + (worst.skuName || brand) + "'")} in ${B(worst.city)} to accelerate inventory clearance.`
            },
        ];
    }

    if (type === "Prioritise PO") {
        const worst = allEv.reduce((w, e) => ((e.projectedSalesLoss || 0) > (w.projectedSalesLoss || 0) ? e : w), allEv[0]);
        const totalPSL = allEv.reduce((s, e) => s + (e.projectedSalesLoss || 0), 0);
        const criticalCount = allEv.filter(e => e.poStatus === "Critical" || e.poStatus === "High").length;

        return [
            {
                label: "PO Prioritization", priority: "high",
                text: `${B(criticalCount)} critical SKUs require immediate restocking. Estimated projected sales loss is ${B(formatINRCompact(totalPSL))}.`
            },
            {
                label: "Primary Risk", priority: "focus",
                text: `${B("'" + (worst.skuName || brand) + "'")} in ${B(worst.city)} currently has an uncharacteristically low OSA of ${B(safePct(worst.osa))}.`
            },
            {
                label: "Revenue Risk", priority: "good",
                text: `Failure to replenish ${B("'" + (worst.skuName || brand) + "'")} may result in an estimated ${B(formatINRCompact(worst.projectedSalesLoss || 0))} in lost sales.`
            },
            {
                label: "Recommended Action", priority: "neutral",
                text: `Initiate a high-priority purchase order for the ${B(worst.city)} facility to restore availability levels.`
            },
        ];
    }

    if (type === "Transfer Issue") {
        const worst = allEv.reduce((w, e) => ((e.projectedSalesLoss || 0) > (w.projectedSalesLoss || 0) ? e : w), allEv[0]);
        const totalPSL = allEv.reduce((s, e) => s + (e.projectedSalesLoss || 0), 0);
        const uniqueCities = new Set(allEv.map(e => e.city).filter(Boolean)).size;

        return [
            {
                label: "Stock Imbalance", priority: "high",
                text: `Demand-supply misalignment detected. A potential loss of ${B(formatINRCompact(totalPSL))} is forecasted across ${B(uniqueCities)} locations.`
            },
            {
                label: "Critical Shortage", priority: "focus",
                text: `${B(worst.city)} is currently facing a shortage of ${B("'" + (worst.skuName || brand) + "'")}, with only ${B((worst.backedDOI || 0).toFixed(1))} days of stock remaining.`
            },
            {
                label: "Depletion Rate", priority: "good",
                text: `Given the current consumption rate of ${B((worst.cpd || 0).toFixed(1))} units/day, standard replenishment schedules may be insufficient.`
            },
            {
                label: "Recommended Action", priority: "neutral",
                text: `Initiate an inter-warehouse stock transfer to ${B(worst.city)} to address the immediate inventory gap.`
            },
        ];
    }

    if (type === "New Market Entry") {
        const worst = allEv.reduce((w, e) => ((e.pfu || 9999) < (w.pfu || 9999) ? e : w), allEv[0]);
        const uniqueCompetitors = new Set(allEv.map(e => e.competitorName).filter(Boolean)).size;

        return [
            {
                label: "Market Entry", priority: "high",
                text: `New competitor activity detected. ${B(uniqueCompetitors)} emerging competitor(s) identified within ${B(worst.category || "the category")}.`
            },
            {
                label: "Competitor Profile", priority: "focus",
                text: `${B(worst.competitorName || "A new brand")} has established a presence in ${B(worst.city)}, introducing potential market disruption.`
            },
            {
                label: "Pricing Strategy", priority: "good",
                text: `The competitor is offering a highly competitive price point of ${B("₹" + (worst.pfu || "-"))}, potentially impacting our sales volume.`
            },
            {
                label: "Recommended Action", priority: "neutral",
                text: `Monitor competitor performance in ${B(worst.city)} and consider strategic promotions to maintain market share.`
            },
        ];
    }

    if (type === "Co-Relations") {
        return [
            { label: "KPI Correlation", priority: "high", text: `Comparative analysis across ${B(allEv.length)} dimension combinations reveals significant KPI movements.` },
            { label: "Key Finding", priority: "focus", text: `Sales, OSA and SOS metrics show correlated changes requiring attention.` },
            { label: "Impact", priority: "good", text: `Review the trend data to identify root causes of KPI shifts.` },
            { label: "Action", priority: "neutral", text: `Click on trend buttons to drill into time-series analysis.` },
        ];
    }

    // Default Fallback
    const worstGeneric = allEv[0] || {};
    return [
        { label: "Anomaly Detected", priority: "high", text: `We scanned ${B(allEv.length)} rows and found critical deviations in performance.` },
        { label: "Key Finding", priority: "focus", text: `The sharpest drop centers around ${B(worstGeneric.city || "key regions")} for ${B(worstGeneric.category || "top categories")}.` },
        { label: "Financial Stake", priority: "good", text: `Actioning this immediately secures a ${impact} opportunity for ${B(brand)}.` },
        { label: "Next Steps", priority: "neutral", text: `Deep dive into the data grid below to isolate the specific SKU bottlenecks.` },
    ];
};

const priorityStyles = {
    high: { border: "border-l-red-500", label: "text-red-600", bg: "bg-red-50" },
    focus: { border: "border-l-blue-500", label: "text-blue-700", bg: "bg-blue-50" },
    good: { border: "border-l-emerald-500", label: "text-emerald-700", bg: "bg-emerald-50" },
    neutral: { border: "border-l-slate-400", label: "text-slate-600", bg: "bg-slate-50" },
};

// ─── BADGES ──────────────────────────────────────────────────────────────

const BetaBadge = ({ size = "sm" }) => (
    <span
        className="status-pulse-blue"
        style={{
            fontSize: size === "xs" ? "8.5px" : "9px",
            fontWeight: 800,
            letterSpacing: "0.05em",
            background: "#2563eb",
            color: "#fff",
            borderRadius: "5px",
            padding: size === "xs" ? "2.5px 8px" : "2.5px 8px",
            display: "inline-flex",
            alignItems: "center",
            textTransform: "uppercase",
            lineHeight: 1,
            fontFamily: "'Inter', sans-serif",
            whiteSpace: "nowrap",
            verticalAlign: "middle",
            boxShadow: "0 2px 4px rgba(37, 99, 235, 0.3)",
        }}
    >
        BETA
    </span>
);

const LiveBadge = ({ size = "sm" }) => (
    <span
        className="status-pulse-green"
        style={{
            fontSize: size === "xs" ? "8.5px" : "9px",
            fontWeight: 800,
            letterSpacing: "0.05em",
            background: "#10b981",
            color: "#fff",
            borderRadius: "5px",
            padding: size === "xs" ? "2.5px 8px" : "2.5px 8px",
            display: "inline-flex",
            alignItems: "center",
            verticalAlign: "middle",
            textTransform: "uppercase",
            lineHeight: 1,
            fontFamily: "'Inter', sans-serif",
            boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)",
        }}
    >
        LIVE
    </span>
);


const SignalStatusBadge = ({ isEmpty, isBeta }) => (
    isEmpty ? (
        <span style={{
            fontSize: "7.5px", fontWeight: 700, letterSpacing: "0.1em",
            background: "#f1f5f9", color: "#94a3b8", border: "1px solid #e2e8f0",
            borderRadius: "3px", padding: "1.5px 5px",
            display: "inline-flex", alignItems: "center", gap: "3px",
            textTransform: "uppercase",
        }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#cbd5e1", display: "inline-block" }} />
            NO DATA
        </span>
    ) : (isBeta ? <BetaBadge /> : <LiveBadge />)
);


// ─── AI INSIGHTS PANEL (static version — replaced by AIInsightsPanelLive import) ──
// Kept here only as reference; no longer called anywhere.
// eslint-disable-next-line no-unused-vars
const AIInsightsPanel = ({ insight, onClose }) => {
    const [phase, setPhase] = useState("loading");
    const [visibleCount, setVisibleCount] = useState(0);
    const segments = useMemo(() => buildAISegments(insight), [insight]);

    useEffect(() => {
        setPhase("reveal");
        setVisibleCount(segments.length);
    }, [insight, segments.length]);

    const meta = SIGNAL_META[insight.type] || {};
    const isBeta = meta.isBeta !== false;

    return (
        <motion.div
            initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }}
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
            style={{
                position: "absolute", top: 0, right: 0, height: "100%", width: "320px",
                background: "rgba(255, 255, 255, 0.99)",
                backdropFilter: "blur(25px)",
                borderLeft: "1px solid rgba(226, 232, 240, 0.8)",
                boxShadow: "-12px 0 40px rgba(0,0,0,0.07)",
                zIndex: 60, display: "flex", flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header with Mesh Gradient */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px",
                background: "linear-gradient(135deg, #f8faff 0%, #f1f5ff 100%)",
                borderBottom: "1px solid rgba(99, 102, 241, 0.08)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: "8px",
                        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(99,102,241,0.25)"
                    }}>
                        <BrainCircuit size={16} color="#fff" strokeWidth={2.5} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "#1e1b4b", display: "flex", alignItems: "center", gap: "5px", letterSpacing: "-0.01em" }}>
                            AI Summary {isBeta ? <BetaBadge size="xs" /> : <LiveBadge size="xs" />}
                        </div>
                        <div style={{ fontSize: "9px", color: "#6366f1", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", marginTop: "1px" }}>powered by Trailytics AI</div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        color: "#94a3b8", cursor: "pointer", background: "rgba(0,0,0,0.03)",
                        border: "none", padding: 5, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                        e.currentTarget.style.color = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(0,0,0,0.03)";
                        e.currentTarget.style.color = "#94a3b8";
                    }}
                >
                    <X size={14} strokeWidth={2.5} />
                </button>
            </div>

            {/* Scrollable Content with Insight Cards */}
            <div style={{
                flex: 1, padding: "20px 16px", overflowY: "auto",
                display: "flex", flexDirection: "column", gap: "14px",
                background: "linear-gradient(to bottom, #ffffff, #fbfcfd)"
            }}>
                {phase === "loading" ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: "12px" }}>
                        <Loader2 size={24} style={{ animation: "spin 2s linear infinite", color: "#6366f1" }} />
                        <span style={{ color: "#64748b", fontSize: "11.5px", fontWeight: 500, letterSpacing: "0.01em" }}>Retrieving Data...</span>
                    </div>
                ) : (
                    segments.map((seg, idx) => {
                        const s = priorityStyles[seg.priority] || priorityStyles.neutral;
                        const borderColor = seg.priority === "high" ? "#ef4444" :
                            seg.priority === "focus" ? "#3b82f6" :
                                seg.priority === "good" ? "#10b981" : "#94a3b8";

                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: 20 }}
                                animate={idx < visibleCount ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                                transition={{ type: "spring", stiffness: 400, damping: 40 }}
                                style={{
                                    background: "#fff",
                                    border: "1.5px solid rgba(226, 232, 240, 0.9)",
                                    borderLeft: `4px solid ${borderColor}`,
                                    borderRadius: "12px",
                                    padding: "14px 16px",
                                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)",
                                    position: "relative",
                                    outline: "none",
                                }}
                            >
                                <div style={{
                                    fontSize: "9px", fontWeight: 800,
                                    textTransform: "uppercase", letterSpacing: "0.08em",
                                    marginBottom: "8px", color: borderColor,
                                    display: "flex", alignItems: "center", gap: "5px"
                                }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: borderColor }} />
                                    {seg.label}
                                </div>
                                <p style={{
                                    fontSize: "11.5px", color: "#334155",
                                    lineHeight: 1.6, margin: 0, fontWeight: 500
                                }}>
                                    {renderBoldText(seg.text)}
                                </p>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* Subtle Footer */}
            {/* <div style={{ 
                padding: "12px 16px", 
                borderTop: "1px solid rgba(226, 232, 240, 0.6)",
                background: "#f8f9fa",
                display: "flex", alignItems: "center", gap: "8px"
            }}>
                <Sparkles size={11} color="#6366f1" />
                <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600 }}>AI Insights generated in real-time</span>
            </div> */}
        </motion.div>
    );
};

// ─── OVERVIEW SIGNAL CARD ────────────────────────────────────────────────────

const OverviewSignalCard = ({ insight, isSelected, onClick, loading }) => {
    const [hovered, setHovered] = useState(false);
    const isEmpty = insight.id.startsWith("empty_");
    const meta = SIGNAL_META[insight.type] || {};
    const { FamilyIcon, color, family, metricLabel, trend } = meta;
    const isNegative = trend === "negative";

    const evidence = insight.evidence || [];
    const displayRows = evidence.slice(0, 3);

    // Make sure Category is always first
    const getColumns = () => {
        const t = insight.type;
        if (t === "Share Headroom Hotspots") return [
            { key: "category", label: "Category", fmt: (v, r) => v || insight.category || "-" },
            { key: "city", label: "City" },
            {
                key: "brandOsa", label: `${insight.brandName || "Brand"} OSA`, fmt: (v, r) => v != null ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{safePct(v)}</span>
                        <span style={{ fontSize: '10px', color: (r.brandOsaDelta || 0) < 0 ? '#ef4444' : '#10b981' }}>
                            {(r.brandOsaDelta || 0) >= 0 ? "+" : ""}{(r.brandOsaDelta || 0).toFixed(1)}%
                        </span>
                    </div>
                ) : "-"
            },
            { key: "marketShare", label: "Mkt Share", fmt: (v, r) => v != null ? `${safePct(v)} (${r.marketShareMoM >= 0 ? "+" : ""}${safePct(r.marketShareMoM)})` : "-" },
            {
                key: "offtake", label: "Offtake", fmt: (v, r) => v != null ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{safeINR(v)}</span>
                        <span style={{ fontSize: '10px', color: (r.offtakeDelta || 0) < 0 ? '#ef4444' : '#10b981' }}>
                            {(r.offtakeDelta || 0) >= 0 ? "+" : ""}{safeINR(r.offtakeDelta)} ({(r.offtakeMoM || 0) >= 0 ? "+" : ""}{safePct(r.offtakeMoM)})
                        </span>
                    </div>
                ) : "-"
            },
            { key: "possibleCause", label: "Cause", isText: true },
        ];
        if (t === "Competitor OSA Weak Spots") return [
            { key: "category", label: "Category", fmt: (v, r) => v || insight.category || "-" },
            { key: "platform", label: "Platform", fmt: (v) => v || "-" },
            { key: "city", label: "City" },
            { key: "skuOrBrand", label: "Competitor Brand", isText: true },
            {
                key: "otherBrandOsa", label: "Comp OSA", fmt: (v, r) => (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{safePct(v)}</span>
                        <span style={{ fontSize: '10px', color: (r.otherBrandOsaChangePct || 0) < 0 ? '#ef4444' : '#10b981' }}>
                            {(r.otherBrandOsaChangePct || 0) >= 0 ? "+" : ""}{(r.otherBrandOsaChangePct || 0).toFixed(1)}%
                        </span>
                    </div>
                )
            },
            {
                key: "otherBrandMkShare", label: "Comp MK Share", fmt: (v, r) => v != null ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{safePct(v)}</span>
                        <span style={{ fontSize: '10px', color: (r.otherBrandMkShareChange || 0) < 0 ? '#ef4444' : '#10b981' }}>
                            {(r.otherBrandMkShareChange || 0) >= 0 ? "+" : ""}{(r.otherBrandMkShareChange || 0).toFixed(1)}%
                        </span>
                    </div>
                ) : "-"
            },
            { key: "kwOsa", label: `${insight.brandName || "Brand"} OSA`, fmt: safePct },
            { key: "gapPct", label: "Gap %", fmt: (v) => <span style={{ color: (v || 0) < 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{safePct(v)}</span> },
            {
                key: "ourBrandMkShare", label: `${insight.brandName || "Brand"} Mkt Share`, fmt: (v, r) => v != null ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{safePct(v)}</span>
                        <span style={{ fontSize: '10px', color: (r.ourBrandMkShareChange || 0) < 0 ? '#ef4444' : '#10b981' }}>
                            {(r.ourBrandMkShareChange || 0) >= 0 ? "+" : ""}{(r.ourBrandMkShareChange || 0).toFixed(1)}%
                        </span>
                    </div>
                ) : "-"
            },
        ];
        if (t === "Price Parity Radar") return [
            { key: "category", label: "Category", fmt: (v, r) => v || insight.category || "-" },
            { key: "city", label: "City" },
            { key: "impactedSku", label: "Impacted SKU", isText: true },
            { key: "compSku", label: "Comp SKU", isText: true },
            { key: "gapPct", label: "GAP % (Change)", fmt: (v, r) => `${safePct(v)} (${r.gapPctChange > 0 ? '+' : ''}${safePct(r.gapPctChange)})` },
            { key: "ourPpu", label: `${insight.brandName || "Our"} PPU`, fmt: (v, r) => v != null ? `₹${Number(v).toFixed(1)} (${r.ourPpuChange > 0 ? '+' : ''}${Number(r.ourPpuChange).toFixed(1)})` : "-" },
            { key: "compPpu", label: "Comp PPU", fmt: (v, r) => v != null ? `₹${Number(v).toFixed(1)} (${r.compPpuChange > 0 ? '+' : ''}${Number(r.compPpuChange).toFixed(1)})` : "-" },
        ];
        if (t === "Remove Ad Low OSA") return [
            { key: "skuOrBrand", label: "Product", isText: true },
            { key: "platform", label: "Platform" },
            { key: "city", label: "City" },
            { key: "kwOsa", label: "OSA % (Change %)", fmt: (v, r) => `${safePct(v)} (${r.kwOsaChangePct > 0 ? '+' : ''}${safePct(r.kwOsaChangePct)})` },
            { key: "adSov", label: "Ad SOV % (Change %)", fmt: (v, r) => `${safePct(v)} (${r.adSovChangePct > 0 ? '+' : ''}${safePct(r.adSovChangePct)})` },
        ];
        if (t === "Keyword Efficiency and Budget Caps") return [
            { key: "category", label: "Category", fmt: (v, r) => v || insight.category || "-" },
            { key: "platform", label: "Platform" },
            { key: "city", label: "City" },
            { key: "acos", label: "ACOS", fmt: (v, r) => `${safePct(v)} (${r.acosChangePct > 0 ? '+' : ''}${safePct(r.acosChangePct)})` },
            { key: "spend", label: "Spend", fmt: safeINR },
            { key: "keyword", label: "Keyword", isText: true },
            { key: "campaign", label: "Campaign", isText: true },
        ];
        if (t === "DS Listing Summary") return [
            { key: "skuName", label: "SKU Name", isText: true },
            { key: "city", label: "City" },
            { key: "priorityLocalities", label: "# Priority Localities" },
            { key: "categorySales", label: "Category Sales (est.)", fmt: safeINR },
            { key: "competitors", label: "Key Competitors in DS", isText: true },
            { key: "possibleCause", label: "Possible Cause", isText: true },
        ];
        if (t === "Surplus Stock") return [
            { key: "skuName", label: "SKU Name", isText: true },
            { key: "platform", label: "Platform" },
            { key: "facility", label: "Facility" },
            { key: "excessInventory", label: "Excess Inv", fmt: (v) => `${Number(v || 0).toLocaleString('en-IN')} units` },
            { key: "excessDOI", label: "Excess DOI", fmt: (v) => `${Number(v || 0).toFixed(0)} days` },
            { key: "drr", label: "DRR", fmt: (v) => Number(v || 0).toFixed(2) },
            { key: "currentDiscount", label: "Discount %", fmt: (v) => `${Number(v || 0).toFixed(1)}%` },
            { key: "openPOQty", label: "Open PO Qty", fmt: (v) => Number(v || 0).toLocaleString('en-IN') },
        ];
        if (t === "Prioritise PO") return [
            { key: "poNumber", label: "PO Number", isText: true },
            { key: "skuName", label: "SKU Name", isText: true },
            { key: "platform", label: "Platform" },
            { key: "facility", label: "Facility" },
            { key: "osa", label: "OSA %", fmt: safePct },
            { key: "projectedSalesLoss", label: "PSL", fmt: safeINR },
            { key: "poRaisedDate", label: "PO Raised Date", isText: true },
            { key: "poStatus", label: "PO Status", isText: true },
        ];
        if (t === "Transfer Issue") return [
            { key: "skuName", label: "SKU Name", isText: true },
            { key: "city", label: "City" },
            { key: "cpd", label: "CPD", fmt: (v) => Number(v || 0).toFixed(1) },
            { key: "backedDOI", label: "Backed DOI", fmt: (v) => `${Number(v || 0).toFixed(1)} days` },
            { key: "osa", label: "OSA %", fmt: safePct },
            { key: "projectedSalesLoss", label: "Projected Sales Loss", fmt: safeINR },
        ];
        if (t === "New Market Entry") return [
            { key: "skuName", label: "SKU Name", isText: true },
            { key: "category", label: "Category" },
            { key: "competitorName", label: "Competitor Name", isText: true },
            { key: "pfu", label: "PFU", fmt: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}` },
            { key: "firstSeenDate", label: "First Seen Date", isText: true },
            { key: "city", label: "City" },
        ];
        if (t === "Dark Store Coverage Gaps") return [
            { key: "category", label: "Category", fmt: (v, r) => v || insight.category || "-" },
            { key: "city", label: "City" },
            { key: "storeCount", label: "# Stores" },
            { key: "listingPct", label: "Listing %", fmt: safePct },
            { key: "osa", label: "OSA %", fmt: safePct },
            { key: "psl", label: "PSL", fmt: safeINR },
        ];
        if (t === "New Dark Store Expansion") return [
            { key: "category", label: "Category", fmt: (v, r) => v || insight.category || "-" },
            { key: "city", label: "City" },
            { key: "newStoreCount", label: "# New DS" },
            { key: "listingPct", label: "Listing %", fmt: safePct },
            { key: "sobNewDs", label: "SOB New DS %", fmt: safePct },
            { key: "competitors", label: "Competitors", isText: true },
            { key: "psl", label: "PSL", fmt: safeINR },
        ];
        return [
            { key: "category", label: "Category", fmt: (v, r) => v || insight.category || "-" },
            { key: "city", label: "City" },
            { key: "impactInr", label: "Impact", fmt: safeINR },
        ];
    };

    const columns = getColumns();



    const getCellStyle = (col, val) => {
        const base = { fontSize: "11px", color: "#374151", maxWidth: "100px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
        if (col.key === "marketShareMoM" || col.key === "gapPct") {
            if (typeof val === "number") return { ...base, color: val < 0 ? "#dc2626" : "#16a34a", fontWeight: 600 };
        }
        if (col.key === "fillRate" || col.key === "otherBrandOsa") {
            if (typeof val === "number" && val < 80) return { ...base, color: "#dc2626", fontWeight: 600 };
        }
        if (col.key === "possibleCause" || col.isText) return { ...base, color: "#6b7280" };
        return base;
    };

    return (
        <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
            <div
                onClick={onClick}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                tabIndex={-1}
                className="focus:outline-none focus:ring-0 outline-none"
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "0px",
                    cursor: "pointer",
                    overflow: "hidden",
                    position: "relative",
                    background: "#ffffff",
                    outline: "none",
                    WebkitTapHighlightColor: "transparent",
                    boxShadow: isSelected
                        ? `0 10px 25px -5px rgba(0,0,0,0.1)`
                        : hovered
                            ? "0 12px 20px -5px rgba(0,0,0,0.08)"
                            : "none",
                    border: "1px solid #f1f5f9",
                    transition: "all 0.2s ease",
                    transform: hovered ? "translateY(-4px)" : "translateY(0px)",
                }}
            >
                {/* Top Badge Row */}
                <div style={{
                    padding: "10px 14px 4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                }}>
                    <SignalStatusBadge isEmpty={isEmpty} isBeta={meta.isBeta !== false} />
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{
                            width: 22, height: 22, borderRadius: "5px",
                            background: "#f8fafc", border: "1px solid #f1f5f9",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            {FamilyIcon && <FamilyIcon size={12} color={isEmpty ? "#94a3b8" : "#475569"} />}
                        </div>
                    </div>
                </div>

                {/* Title Section */}
                <div style={{ padding: "2px 14px 8px" }}>
                    <div style={{
                        fontSize: "9px", fontWeight: 700,
                        color: "#94748b", textTransform: "uppercase",
                        letterSpacing: "0.06em", marginBottom: "3px"
                    }}>
                        {family}
                    </div>
                    <div style={{
                        fontSize: "13px", fontWeight: 800,
                        color: "#1e293b", lineHeight: 1.3,
                        minHeight: "18px"
                    }}>
                        {insight.type}
                    </div>
                </div>

                <Divider sx={{ mx: 1.5, borderColor: "#f1f5f9" }} />

                {/* Metric Hero Section */}
                <div style={{ padding: "10px 14px 10px" }}>
                    <div style={{
                        fontSize: "8.5px", fontWeight: 700,
                        color: "#94a3b8", textTransform: "uppercase",
                        letterSpacing: "0.05em", marginBottom: "8px"
                    }}>
                        {metricLabel}
                    </div>
                    <div style={{
                        display: "inline-flex",
                        padding: "5px 13px",
                        borderRadius: "8px",
                        background: loading ? "#f1f5f9" : (isEmpty
                            ? "#f1f5f9"
                            : (isNegative ? "#fef2f2" : "#f0fdf4")),
                        border: `1px solid ${loading ? "#e2e8f0" : (isEmpty ? "#e2e8f0" : (isNegative ? "#fee2e2" : "#dcfce7"))}`,
                    }}>
                        <span style={{
                            fontSize: "16px", fontWeight: 900,
                            color: loading ? "#94a3b8" : (isEmpty ? "#94a3b8" : (isNegative ? "#dc2626" : "#16a34a")),
                            letterSpacing: "-0.01em"
                        }}>
                            {loading ? (
                                <div className="skeleton-pulse" style={{ width: "60px", height: "16px", borderRadius: "4px" }} />
                            ) : isEmpty ? "—" : insight.type === "New Market Entry"
                                ? (() => {
                                    const topRow = (insight.evidence || []).slice().sort((a, b) => {
                                        const da = a.firstSeenDate && a.firstSeenDate !== "-" ? new Date(a.firstSeenDate) : new Date(0);
                                        const db = b.firstSeenDate && b.firstSeenDate !== "-" ? new Date(b.firstSeenDate) : new Date(0);
                                        return db - da;
                                    })[0];
                                    return (topRow && topRow.firstSeenDate && topRow.firstSeenDate !== "-") ? topRow.firstSeenDate : "—";
                                })()
                                : insight.type === "Surplus Stock"
                                    ? `${Number(insight.totalExcessInventoryUnits || (insight.evidence || []).reduce((s, e) => s + (e.excessInventory || 0), 0)).toLocaleString('en-IN')} Units`
                                    : formatINRCompact(insight.impactInr || 0)}
                        </span>
                    </div>
                </div>



                <div style={{
                    padding: "8px 14px",
                    borderTop: "1px solid #f1f5f9",
                    display: "flex", alignItems: "center", justifyContent: "flex-end",
                    background: "#fff",
                }}>
                    <div style={{
                        fontSize: "10px", fontWeight: 700,
                        color: hovered ? (color || "#2563eb") : "#9ca3af",
                        display: "flex", alignItems: "center", gap: "3px",
                        textTransform: "uppercase", letterSpacing: "0.07em",
                        transition: "color 0.2s ease",
                    }}>
                        View Detail <ChevronRight size={10} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── ROW-LEVEL AI POPUP ──────────────────────────────────────────────────────

// ─── ROW-LEVEL AI POPUP ──────────────────────────────────────────────────────

const RowAIPopup = ({ insight, rowData, onClose }) => {
    const [phase, setPhase] = useState("loading");
    const [segments, setSegments] = useState([]);

    const rowInsight = useMemo(() => ({
        ...insight,
        evidence: [rowData]
    }), [insight, rowData]);

    useEffect(() => {
        let cancelled = false;
        setPhase("loading");
        setSegments([]);

        callClaudeForInsights(rowInsight, [rowData])
            .then(parsed => {
                if (cancelled) return;
                // Only show first 2 segments in the compact popup
                setSegments(
                    parsed.slice(0, 2).map((seg, i) => ({
                        label: seg.label || `Insight ${i + 1}`,
                        text: seg.text || "",
                        priority: SEGMENT_PRIORITY[i] || "neutral",
                    }))
                );
                setPhase("reveal");
            })
            .catch(() => {
                if (cancelled) return;
                const fallback = buildAISegments(rowInsight).slice(0, 2).map((seg, i) => ({
                    ...seg,
                    priority: SEGMENT_PRIORITY[i] || "neutral",
                }));
                setSegments(fallback);
                setPhase("reveal");
            });

        return () => { cancelled = true; };
    }, [rowInsight]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
                width: "360px",
                background: "rgba(255, 255, 255, 0.98)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(99, 102, 241, 0.15)",
                borderRadius: "16px",
                boxShadow: "0 20px 50px -12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.02)",
                overflow: "hidden",
                cursor: "default",
            }}
        >
            {/* AI Header with Mesh-like Gradient */}
            <div style={{
                padding: "14px 18px",
                background: "linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%)",
                borderBottom: "1px solid rgba(99, 102, 241, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: 22, height: 22, borderRadius: "6px",
                        background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                        display: "flex", alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 3px 8px rgba(99,102,241,0.25)"
                    }}>
                        <Sparkles size={11} color="#fff" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#1e1b4b", letterSpacing: "-0.01em" }}>
                            Why This is Happening
                        </span>
                        <span style={{
                            fontSize: "7px",
                            fontWeight: 700,
                            color: "#6366f1",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            marginTop: "1px"
                        }}>
                            Powered by Trailytics AI
                        </span>
                    </div>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    style={{
                        background: "rgba(0,0,0,0.03)",
                        border: "none",
                        cursor: "pointer",
                        color: "#64748b",
                        padding: "5px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                        e.currentTarget.style.color = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(0,0,0,0.03)";
                        e.currentTarget.style.color = "#64748b";
                    }}
                >
                    <X size={12} strokeWidth={2.5} />
                </button>
            </div>

            {/* Body Content */}
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {phase === "loading" ? (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px 0",
                        gap: "10px"
                    }}>
                        <Loader2 size={18} style={{ animation: "spin 1.2s linear infinite", color: "#6366f1" }} />
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500, letterSpacing: "0.02em" }}>
                            Analysing this row…
                        </span>
                    </div>
                ) : (
                    segments.map((seg, idx) => (
                        <motion.div key={idx}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.06 }}
                            style={{
                                display: "flex",
                                gap: "12px",
                                alignItems: "flex-start",
                                padding: "8px 10px",
                                borderRadius: "8px",
                                background: "rgba(248, 250, 252, 0.5)",
                                border: "1px solid rgba(241, 245, 249, 0.8)"
                            }}
                        >
                            <div style={{
                                width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 6,
                                background: seg.priority === "high" ? "#ef4444" : seg.priority === "focus" ? "#3b82f6" : seg.priority === "good" ? "#10b981" : "#94a3b8",
                                boxShadow: `0 0 10px ${seg.priority === "high" ? "rgba(239,68,68,0.4)" : "rgba(148,163,184,0.3)"}`
                            }} />
                            <p style={{
                                fontSize: "11.5px",
                                color: "#334155",
                                lineHeight: 1.6,
                                margin: 0,
                                fontWeight: 500
                            }}>
                                {renderBoldText(seg.text)}
                            </p>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Footer with improved aesthetics */}
            <div style={{
                padding: "10px 18px",
                background: "linear-gradient(to right, rgba(241, 245, 249, 0.4), rgba(226, 232, 240, 0.3))",
                borderTop: "1px solid rgba(226, 232, 240, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Activity size={11} color="#6366f1" />
                    <span style={{ fontSize: "9.5px", color: "#475569", fontWeight: 600 }}>
                        Signal Analysis
                    </span>
                </div>
                {/* <div style={{ 
                    fontSize: "9px", 
                    color: "#6366f1", 
                    fontWeight: 700, 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "2px",
                    textTransform: "uppercase",
                    letterSpacing: "0.02em"
                }}>
                    Full Summary <ChevronRight size={10} />
                </div> */}
            </div>
        </motion.div>
    );
};

// ─── REUSABLE CATEGORY CELL ──────────────────────────────────────────────────

const CategoryCell = ({ category, rowIdx, activePopupIdx, setActivePopupIdx, insight, rowData, totalCount }) => {
    const isOpen = activePopupIdx === rowIdx;

    return (
        <TableCell className="px-3 py-4 align-top relative">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
                <span className="text-[11px] text-slate-800 font-semibold" style={{ lineHeight: 1.2 }}>{category}</span>
                <Popover open={isOpen} onOpenChange={(o) => setActivePopupIdx(o ? rowIdx : null)}>
                    <PopoverTrigger asChild>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActivePopupIdx(isOpen ? null : rowIdx);
                            }}
                            style={{
                                fontSize: "9px", fontWeight: 700,
                                color: "#4f46e5",
                                background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                                border: "1px solid rgba(99, 102, 241, 0.2)",
                                borderRadius: "6px",
                                padding: "4px 10px", cursor: "pointer",
                                display: "inline-flex", alignItems: "center", gap: "4px",
                                transition: "all 0.2s ease",
                                letterSpacing: "0.01em",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                minWidth: "max-content",
                                flexShrink: 0,
                                whiteSpace: "nowrap"
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#e0e7ff";
                                e.currentTarget.style.transform = "translateY(-1px)";
                                e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)";
                                e.currentTarget.style.transform = "translateY(0px)";
                                e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
                            }}
                        >
                            <Sparkles size={10} color="#4f46e5" />
                            Know More
                        </button>
                    </PopoverTrigger>
                    {isOpen && (
                        <PopoverContent style={{ zIndex: 2000 }} className="p-0 border-none bg-transparent shadow-none w-auto" side="bottom" align="start" sideOffset={8}>
                            <RowAIPopup
                                insight={insight}
                                rowData={rowData}
                                onClose={() => setActivePopupIdx(null)}
                            />
                        </PopoverContent>
                    )}
                </Popover>
            </div>
        </TableCell>
    );
};


// ─── SKU IMAGE CELL ──────────────────────────────────────────────────────────

const SkuImageCell = ({ name, imageUrl, subtext, onImageClick, className = "" }) => {
    const [imgError, setImgError] = useState(false);
    const initial = (name && name !== '-') ? name.charAt(0).toUpperCase() : '?';
    const hasImage = imageUrl && !imgError;

    return (
        <TableCell className={`px-3 py-3 ${className}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasImage && onImageClick) onImageClick({ url: imageUrl, name });
                    }}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: '8px',
                        flexShrink: 0,
                        overflow: 'hidden',
                        border: '1px solid #e2e8f0',
                        background: hasImage ? '#fff' : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: hasImage ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                    onMouseEnter={(e) => {
                        if (hasImage) {
                            e.currentTarget.style.borderColor = '#93c5fd';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.15)';
                            e.currentTarget.style.transform = 'scale(1.05)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    {hasImage ? (
                        <img
                            src={imageUrl}
                            alt={name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <span style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#94a3b8',
                            fontFamily: "'Inter', sans-serif",
                        }}>
                            {initial}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#1e293b',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        maxWidth: '180px',
                    }}>
                        {name || '-'}
                    </span>
                    {subtext && (
                        <span style={{
                            fontSize: '9px',
                            fontWeight: 500,
                            color: '#94a3b8',
                            marginTop: '2px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '160px',
                        }}>
                            {subtext}
                        </span>
                    )}
                </div>
            </div>
        </TableCell>
    );
};

// ─── EVIDENCE TABLE ───────────────────────────────────────────────────────────

const getEvidenceView = (type) => {
    if (type === "DS Listing Summary") return "dsListing";
    if (type === "Keyword Efficiency and Budget Caps") return "keyword";
    if (type === "Price Parity Radar") return "pricing";
    if (type === "Share Headroom Hotspots") return "share";

    if (type === "Remove Ad Low OSA") return "adStock";
    if (type === "Surplus Stock") return "surplus";
    if (type === "Prioritise PO") return "prioritisePO";
    if (type === "Transfer Issue") return "transferIssue";
    if (type === "New Market Entry") return "newMarket";
    if (type === "Dark Store Coverage Gaps") return "dsCoverage";
    if (type === "New Dark Store Expansion") return "dsNew";
    return "osa";
};

const EvidenceTable = ({ insight, loading }) => {
    const view = getEvidenceView(insight.type);
    const [search, setSearch] = useState("");
    const [activePopupIdx, setActivePopupIdx] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [activePlatform, setActivePlatform] = useState("All platforms");
    const [categoryFilter, setCategoryFilter] = useState("All categories");

    const categories = useMemo(() => {
        const cats = new Set();
        (insight.evidence || []).forEach(e => {
            if (e.category && e.category !== "-") cats.add(e.category);
        });
        return ["All categories", ...Array.from(cats)];
    }, [insight.evidence]);

    const platforms = useMemo(() => {
        const plats = new Set();
        (insight.evidence || []).forEach(e => {
            if (e.platform && e.platform !== "-") plats.add(e.platform);
        });
        return ["All platforms", ...Array.from(plats)];
    }, [insight.evidence]);

    const filtered = useMemo(() => {
        if (loading) return [];
        let data = insight.evidence || [];
        if (activePlatform !== "All platforms") {
            data = data.filter((e) => !e.platform || e.platform === activePlatform || e.platform === "-");
        }

        if (categoryFilter !== "All categories") {
            data = data.filter(e => e.category === categoryFilter);
        }

        if (insight.type === "Remove Ad Low OSA") {
            data = data.filter((e) => {
                const osa = Number(e.kwOsa) || 0;
                const adSovChange = typeof e.adSovChangePct === 'number' ? e.adSovChangePct : 0;
                const kwOsaChange = typeof e.kwOsaChangePct === 'number' ? e.kwOsaChangePct : 0;
                return osa < 60 && kwOsaChange < 0 && adSovChange > 0;
            });
        }

        if (!search.trim()) return data;
        const q = search.toLowerCase();
        return data.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)));
    }, [insight.evidence, search, activePlatform, categoryFilter, insight.type, view, loading]);

    return (
        <div style={{
            display: "flex", flexDirection: "column", flex: 1, width: "100%",
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px",
            overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            outline: "none",
        }}>
            <div className="evidence-header" style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
            }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e3a5f", letterSpacing: "0.02em" }}>
                    Evidence Data
                </span>
                <div className="evidence-actions-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                disabled={loading}
                                style={{
                                    display: "flex", alignItems: "center", gap: "6px",
                                    padding: "5px 12px", background: loading ? "#f8fafc" : "#fff", border: "1px solid #bfdbfe",
                                    borderRadius: "6px", fontSize: "11px", fontWeight: 600, color: loading ? "#94a3b8" : "#1e3a5f",
                                    cursor: loading ? "not-allowed" : "pointer"
                                }}
                            >
                                <Filter size={12} color={loading ? "#94a3b8" : "#1e3a5f"} />
                                Filters {(activePlatform !== "All platforms" || categoryFilter !== "All categories") && "*"}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent style={{ zIndex: 1001 }} align="end" sideOffset={8} className="w-[280px] p-5 bg-white rounded-xl shadow-xl border border-slate-200">
                            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "4px" }}>
                                    Table Filters
                                </div>
                                <CustomHeaderDropdown label="PLATFORM" options={platforms} value={activePlatform} onChange={(v) => setActivePlatform(v === "All" ? "All platforms" : v)} multiSelect={false} width="100%" />
                                <CustomHeaderDropdown label="CATEGORY" options={categories} value={categoryFilter} onChange={(v) => setCategoryFilter(v === "All" ? "All categories" : v)} multiSelect={false} width="100%" />
                            </div>
                        </PopoverContent>
                    </Popover>
                    <div className="evidence-search-container" style={{ position: "relative" }}>
                        <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                        <input
                            disabled={loading}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            style={{
                                paddingLeft: "26px", paddingRight: "8px", paddingTop: "5px", paddingBottom: "5px",
                                fontSize: "11px", border: "1px solid #bfdbfe", borderRadius: "6px",
                                background: loading ? "#f8fafc" : "#fff", outline: "none", width: "180px", color: loading ? "#94a3b8" : "#1e3a5f",
                            }}
                        />
                    </div>
                </div>
            </div>
            <ScrollArea className="flex-1 w-full" style={{ minHeight: 0 }}>
                <style>{`
                    .insight-grid th:not(:last-child),
                    .insight-grid td:not(:last-child) {
                        border-right: 1px solid #e2e8f0;
                    }
                    .insight-grid tbody tr:nth-child(even) {
                        background-color: #f8fafc;
                    }
                    .insight-grid thead th {
                        background: #f1f5f9;
                        font-weight: 600;
                        letter-spacing: 0.03em;
                        position: sticky;
                        top: 0;
                        z-index: 20;
                        box-shadow: 0 1px 0 #e2e8f0;
                    }
                `}</style>
                <table className="insight-grid w-full text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 20 }}>
                        <TableRow style={{ borderBottom: "2px solid #cbd5e1" }}>
                            {view === "osa" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Competitor Brand</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Comp OSA</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Comp MK Share</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} OSA</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} Mkt Share</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Gap %</TableHead>
                            </>)}
                            {view === "share" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} OSA</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Mkt Share</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PSL</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Offtake</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} Top Impacted SKU</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Comp Top SKU</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Cause</TableHead>
                            </>)}
                            {view === "pricing" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} PPU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Competitor PPU</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} Impacted SKU</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Competitor SKU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PSL</TableHead>
                            </>)}
                            {view === "adStock" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Product</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">OSA % (Change %)</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Ad SOV % (Change %)</TableHead>
                            </>)}
                            {view === "newEntry" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">SKU / Brand</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Share</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PPU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">First Seen</TableHead>
                            </>)}
                            {view === "dsListing" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">SKU Name</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3"># Priority Localities</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Category Sales (est.)</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Key Competitors in DS</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Possible Cause</TableHead>
                            </>)}
                            {view === "keyword" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Keyword</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Campaign</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Bid</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Daily Budget</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Spend</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Sales</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">ACOS</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Capped</TableHead>
                            </>)}
                            {view === "surplus" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">SKU Name</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Facility</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Excess Inventory</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Excess DOI (days)</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3 select-none">
                                    <div className="flex items-center justify-end gap-1">
                                        <span>DRR</span>
                                        <Tooltip title="DRR (Daily Run Rate) is calculated as the sum of quantities sold over the last 30 days divided by 30." arrow placement="top">
                                            <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                <Info size={12} className="inline-block" />
                                            </span>
                                        </Tooltip>
                                    </div>
                                </TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Current Discount %</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Open PO Qty</TableHead>
                            </>)}
                            {view === "prioritisePO" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">PO Number</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">SKU Name</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Facility</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">OSA %</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PSL</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">PO Raised Date</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">PO Status</TableHead>
                            </>)}
                            {view === "transferIssue" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">SKU Name</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">CPD</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Backed DOI (days)</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">OSA %</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Projected Sales Loss</TableHead>
                            </>)}
                            {view === "newMarket" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">SKU Name</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Competitor Name</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PFU</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">First Seen Date</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                            </>)}
                            {view === "dsCoverage" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3"># Stores</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Listing %</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">OSA %</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PSL</TableHead>
                            </>)}
                            {view === "dsNew" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3"># New DS</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Listing %</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">SOB New DS (%)</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Competitors</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PSL</TableHead>
                            </>)}
                        </TableRow>
                    </thead>
                    <TableBody>
                        {loading ? (
                            [...Array(6)].map((_, rIdx) => (
                                <TableRow key={rIdx}>
                                    {[...Array(8)].map((_, cIdx) => (
                                        <TableCell key={cIdx} className="px-3 py-4">
                                            <div style={{ height: "12px", width: "100%", borderRadius: "4px", background: "linear-gradient(90deg, #f1f5f9 25%, #f8fafc 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 2s infinite linear" }} />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-10 text-slate-400 text-[11px]">
                                    No matching rows
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((d, idx) => {
                                return (
                                    <React.Fragment key={idx}>
                                        <TableRow style={{ borderBottom: "1px solid #e2e8f0" }} className="hover:bg-blue-50/30 transition-colors">
                                            {view === "osa" && (
                                                <>
                                                    <CategoryCell category={d.category || insight.category || "-"} rowIdx={idx} activePopupIdx={activePopupIdx} setActivePopupIdx={setActivePopupIdx} insight={insight} rowData={d} totalCount={filtered.length} />
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city || "-"}</TableCell>
                                                    <SkuImageCell name={d.skuOrBrand ?? "-"} imageUrl={d.imageUrl} onImageClick={setPreviewImage} />
                                                    <TableCell className="text-right px-3 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[11px] font-medium text-red-600">{safePct(d.otherBrandOsa)}</span>
                                                            <span className={`text-[10px] mt-0.5 ${(d.otherBrandOsaChangePct || 0) < 0 ? "text-red-500" : "text-emerald-500"}`}>
                                                                {(d.otherBrandOsaChangePct || 0) >= 0 ? '+' : ''}{(d.otherBrandOsaChangePct || 0).toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right px-3 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[11px] font-medium text-red-600">{safePct(d.otherBrandMkShare)}</span>
                                                            {d.otherBrandMkShareChange != null && (
                                                                <span className={`text-[10px] mt-0.5 ${(d.otherBrandMkShareChange || 0) < 0 ? "text-red-500" : "text-emerald-500"}`}>
                                                                    {(d.otherBrandMkShareChange || 0) >= 0 ? '+' : ''}{(d.otherBrandMkShareChange || 0).toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-blue-600 px-3 py-3">{safePct(d.kwOsa)}</TableCell>
                                                    <TableCell className="text-right px-3 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[11px] font-medium text-blue-600">{safePct(d.ourBrandMkShare)}</span>
                                                            {d.ourBrandMkShareChange != null && (
                                                                <span className={`text-[10px] mt-0.5 ${(d.ourBrandMkShareChange || 0) < 0 ? "text-red-500" : "text-emerald-500"}`}>
                                                                    {(d.ourBrandMkShareChange || 0) >= 0 ? '+' : ''}{(d.ourBrandMkShareChange || 0).toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] font-semibold text-emerald-600 px-3 py-3">{safePct(d.gapPct)}</TableCell>
                                                </>
                                            )}
                                            {view === "share" && (
                                                <>
                                                    <CategoryCell category={d.category ?? insight.category ?? "-"} rowIdx={idx} activePopupIdx={activePopupIdx} setActivePopupIdx={setActivePopupIdx} insight={insight} rowData={d} totalCount={filtered.length} />
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform ?? "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city || "-"}</TableCell>
                                                    <TableCell className="text-right px-3 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[11px] font-medium text-blue-600">{safePct(d.brandOsa)}</span>
                                                            {d.brandOsaDelta !== undefined && d.brandOsaDelta !== 0 && (
                                                                <span className={`text-[10px] mt-0.5 ${(d.brandOsaDelta || 0) < 0 ? "text-red-500" : "text-emerald-500"}`}>
                                                                    {(d.brandOsaDelta || 0) > 0 ? '+' : ''}{d.brandOsaDelta.toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">
                                                        {safePct(d.marketShare)} <span className={d.marketShareMoM < 0 ? "text-red-600" : "text-emerald-600"}>({d.marketShareMoM > 0 ? '+' : ''}{safePct(d.marketShareMoM)})</span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">{safeINR(d.psl)}</TableCell>
                                                    <TableCell className="text-right px-3 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[11px] font-semibold text-slate-800">{safeINR(d.offtake)}</span>
                                                            <span className={`text-[10px] mt-0.5 ${(d.offtakeDelta || 0) < 0 ? "text-red-500" : "text-emerald-500"}`}>
                                                                {(d.offtakeDelta || 0) >= 0 ? '+' : ''}{safeINR(d.offtakeDelta)} ({(d.offtakeMoM || 0) >= 0 ? '+' : ''}{safePct(d.offtakeMoM)})
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <SkuImageCell name={d.myTopSku || "-"} imageUrl={d.myTopSkuImageUrl} onImageClick={setPreviewImage} />
                                                    <SkuImageCell name={d.competitorSku || "-"} imageUrl={d.competitorSkuImageUrl} onImageClick={setPreviewImage} />
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.possibleCause || "-"}</TableCell>
                                                </>
                                            )}
                                            {view === "pricing" && (
                                                <>
                                                    <CategoryCell category={d.category ?? insight.category ?? "-"} rowIdx={idx} activePopupIdx={activePopupIdx} setActivePopupIdx={setActivePopupIdx} insight={insight} rowData={d} totalCount={filtered.length} />
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform ?? "-"}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">₹{typeof d.ourPpu === 'number' ? d.ourPpu.toFixed(1) : d.ourPpu}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">₹{typeof d.compPpu === 'number' ? d.compPpu.toFixed(1) : d.compPpu}</TableCell>
                                                    <SkuImageCell name={d.impactedSku || '-'} imageUrl={d.impactedSkuImageUrl} onImageClick={setPreviewImage} />
                                                    <SkuImageCell name={d.compSku || '-'} imageUrl={d.compSkuImageUrl} onImageClick={setPreviewImage} />
                                                    <TableCell className="text-right text-[11px] font-medium text-red-600 px-3 py-3">{safeINR(d.psl)}</TableCell>
                                                </>
                                            )}
                                            {view === "adStock" && (
                                                <>
                                                    <SkuImageCell name={d.skuOrBrand} imageUrl={d.imageUrl} onImageClick={(img) => setPreviewImage({ ...img, platform: d.platform, city: d.city })} />
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3 font-medium">{d.platform}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3 font-medium">{d.city}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">
                                                        {Number(d.kwOsa || 0).toFixed(1)}%
                                                        <span className={`ml-1 text-[10px] ${(d.kwOsaChangePct ?? 0) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                            ({(d.kwOsaChangePct ?? 0) > 0 ? '+' : ''}{(d.kwOsaChangePct ?? 0).toFixed(1)}%)
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">
                                                        {Number(d.adSov || 0).toFixed(1)}%
                                                        <span className={`ml-1 text-[10px] ${(d.adSovChangePct ?? 0) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                            ({(d.adSovChangePct ?? 0) > 0 ? '+' : ''}{(d.adSovChangePct ?? 0).toFixed(1)}%)
                                                        </span>
                                                    </TableCell>
                                                </>
                                            )}
                                            {view === "newEntry" && (
                                                <>
                                                    <CategoryCell category={d.category ?? insight.category ?? "-"} rowIdx={idx} activePopupIdx={activePopupIdx} setActivePopupIdx={setActivePopupIdx} insight={insight} rowData={d} totalCount={filtered.length} />
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform ?? "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.skuOrBrand}</TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-emerald-600 px-3 py-3">{safePct(d.newItemShare)}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">₹{d.ppu}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-500 px-3 py-3">{d.firstSeen}</TableCell>
                                                </>
                                            )}
                                            {view === "dsListing" && (
                                                <>
                                                    <SkuImageCell name={d.skuName || '-'} imageUrl={d.imageUrl} onImageClick={setPreviewImage} />
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city || '-'}</TableCell>
                                                    <TableCell className="text-right px-3 py-3">
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            minWidth: '28px', padding: '2px 10px', borderRadius: '12px',
                                                            fontSize: '11px', fontWeight: 700,
                                                            background: Number(d.priorityLocalities || 0) > 5 ? '#fef2f2' : '#f5f3ff',
                                                            color: Number(d.priorityLocalities || 0) > 5 ? '#dc2626' : '#7c3aed',
                                                        }}>
                                                            {Number(d.priorityLocalities || 0)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-slate-800 px-3 py-3">{safeINR(d.categorySales)}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-600 px-3 py-3" style={{ maxWidth: '180px' }}>
                                                        {d.competitors && d.competitors !== '-' ? d.competitors : <span className="text-slate-400">-</span>}
                                                    </TableCell>
                                                    <TableCell className="px-3 py-3">
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            padding: '3px 10px', borderRadius: '6px',
                                                            fontSize: '10px', fontWeight: 600, letterSpacing: '0.02em',
                                                            background: d.possibleCause === 'Fix transfer issue' ? '#fef3c7' : d.possibleCause === 'Low availability' ? '#fee2e2' : '#ede9fe',
                                                            color: d.possibleCause === 'Fix transfer issue' ? '#92400e' : d.possibleCause === 'Low availability' ? '#991b1b' : '#5b21b6',
                                                        }}>
                                                            {d.possibleCause || '-'}
                                                        </span>
                                                    </TableCell>
                                                </>
                                            )}
                                            {view === "keyword" && (
                                                <>
                                                    <CategoryCell category={d.category ?? insight.category ?? "-"} rowIdx={idx} activePopupIdx={activePopupIdx} setActivePopupIdx={setActivePopupIdx} insight={insight} rowData={d} totalCount={filtered.length} />
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform ?? "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city ?? "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.keyword}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3 max-w-[120px] truncate">{d.campaign}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">₹{d.bid?.toFixed(1)}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-500 px-3 py-3">{safeINR(d.dailyBudget)}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-amber-600 px-3 py-3">{safeINR(d.spend)}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-emerald-600 px-3 py-3">{safeINR(d.sales)}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-indigo-600 px-3 py-3">{safePct(d.acos)}</TableCell>
                                                    <TableCell className="text-right px-3 py-3">
                                                        {d.budgetCapped ? <span className="text-[10px] text-red-600">Capped</span> : <span className="text-slate-400 text-[10px]">-</span>}
                                                    </TableCell>
                                                </>
                                            )}
                                            {view === "surplus" && (
                                                <>
                                                    <SkuImageCell name={d.skuName} imageUrl={d.imageUrl} subtext={d.brandName || '-'} onImageClick={setPreviewImage} />
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.facility || "-"}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">
                                                        {Number(d.excessInventory || 0).toLocaleString('en-IN')} units
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-amber-600 px-3 py-3">
                                                        {Number(d.excessDOI || 0).toFixed(0)} days
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">
                                                        {Number(d.drr || 0).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">
                                                        {d.currentDiscount != null ? `${Number(d.currentDiscount).toFixed(1)}%` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-500 px-3 py-3">
                                                        {Number(d.openPOQty || 0).toLocaleString('en-IN')}
                                                    </TableCell>
                                                </>
                                            )}
                                            {view === "prioritisePO" && (
                                                <>
                                                    <TableCell className="text-[11px] font-semibold text-slate-800 px-3 py-3">{d.poNumber || "-"}</TableCell>
                                                    <SkuImageCell name={d.skuName} imageUrl={d.imageUrl} subtext={d.brandName || '-'} onImageClick={setPreviewImage} />
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.facility || "-"}</TableCell>
                                                    <TableCell className="text-right text-[11px] px-3 py-3">
                                                        <span className={`font-medium ${Number(d.osa || 0) < 50 ? 'text-red-600' : Number(d.osa || 0) < 70 ? 'text-amber-600' : 'text-slate-800'}`}>
                                                            {safePct(d.osa)}
                                                        </span>
                                                        {d.osaChange !== 0 && (
                                                            <span className={`ml-1 text-[10px] ${(d.osaChange || 0) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                ({(d.osaChange || 0) > 0 ? '+' : ''}{Number(d.osaChange || 0).toFixed(1)}%)
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-red-600 px-3 py-3">
                                                        {safeINR(d.projectedSalesLoss)}
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.poRaisedDate || "-"}</TableCell>
                                                    <TableCell className="px-3 py-3">
                                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.poStatus === 'Critical' ? 'bg-red-100 text-red-700' :
                                                                d.poStatus === 'High' ? 'bg-amber-100 text-amber-700' :
                                                                    d.poStatus === 'Medium' ? 'bg-blue-100 text-blue-700' :
                                                                        'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {d.poStatus || "-"}
                                                        </span>
                                                    </TableCell>
                                                </>
                                            )}
                                            {view === "transferIssue" && (
                                                <>
                                                    <SkuImageCell name={d.skuName} imageUrl={d.imageUrl} subtext={d.brandName || '-'} onImageClick={setPreviewImage} />
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city || "-"}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">
                                                        {Number(d.cpd || 0).toFixed(1)}
                                                        {d.cpdChange !== 0 && (
                                                            <span className={`ml-1 text-[10px] ${(d.cpdChange || 0) > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                ({(d.cpdChange || 0) > 0 ? '+' : ''}{Number(d.cpdChange || 0).toFixed(1)})
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className={`text-right text-[11px] font-medium px-3 py-3 ${Number(d.backedDOI || 0) < 7 ? 'text-red-600' : Number(d.backedDOI || 0) < 15 ? 'text-amber-600' : 'text-slate-800'}`}>
                                                        {Number(d.backedDOI || 0).toFixed(1)} days
                                                        {d.backedDOIChange !== 0 && (
                                                            <span className={`ml-1 text-[10px] ${(d.backedDOIChange || 0) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                ({(d.backedDOIChange || 0) > 0 ? '+' : ''}{Number(d.backedDOIChange || 0).toFixed(1)})
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-blue-600 px-3 py-3">{safePct(d.osa)}</TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-red-600 px-3 py-3">{safeINR(d.projectedSalesLoss)}</TableCell>
                                                </>
                                            )}
                                            {view === "newMarket" && (
                                                <>
                                                    <SkuImageCell name={d.skuName} imageUrl={d.imageUrl} onImageClick={setPreviewImage} />
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.category || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3 font-medium">{d.competitorName || "-"}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">₹{Number(d.pfu || 0).toLocaleString('en-IN')}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.firstSeenDate || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city || "-"}</TableCell>
                                                </>
                                            )}
                                            {view === "dsCoverage" && (
                                                <>
                                                    <TableCell className="text-[11px] text-slate-800 font-semibold px-3 py-3">{d.category || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city || "-"}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">{Number(d.storeCount || 0)}</TableCell>
                                                    <TableCell className="text-right text-[11px] px-3 py-3">
                                                        <span className={`font-medium ${Number(d.listingPct || 0) < 50 ? 'text-red-600' : Number(d.listingPct || 0) < 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                            {safePct(d.listingPct)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-blue-600 px-3 py-3">{safePct(d.osa)}</TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-red-600 px-3 py-3">{safeINR(d.psl)}</TableCell>
                                                </>
                                            )}
                                            {view === "dsNew" && (
                                                <>
                                                    <TableCell className="text-[11px] text-slate-800 font-semibold px-3 py-3">{d.category || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city || "-"}</TableCell>
                                                    <TableCell className="text-right text-[11px] font-semibold text-violet-700 px-3 py-3">{Number(d.newStoreCount || 0)}</TableCell>
                                                    <TableCell className="text-right text-[11px] px-3 py-3">
                                                        <span className={`font-medium ${Number(d.listingPct || 0) < 50 ? 'text-red-600' : Number(d.listingPct || 0) < 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                            {safePct(d.listingPct)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-blue-600 px-3 py-3">{safePct(d.sobNewDs)}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-600 px-3 py-3 max-w-[200px] truncate">{d.competitors || "-"}</TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-red-600 px-3 py-3">{safeINR(d.psl)}</TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    </React.Fragment>
                                );
                            })
                        )}
                    </TableBody>
                </table>
            </ScrollArea>

            {/* ─── Image Preview Lightbox ─── */}
            <AnimatePresence>
                {previewImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setPreviewImage(null)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 9999,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(0, 0, 0, 0.7)",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                            cursor: "zoom-out",
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.85, opacity: 0, y: 20 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: "#ffffff",
                                borderRadius: "24px",
                                padding: "0",
                                boxShadow: "0 50px 100px -20px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.02)",
                                maxWidth: "520px",
                                width: "95vw",
                                overflow: "hidden",
                                cursor: "default",
                            }}
                        >
                            {/* Image Container */}
                            <div style={{
                                position: "relative",
                                background: "radial-gradient(circle at center, #ffffff 0%, #f8fafc 100%)",
                                padding: "20px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: "480px",
                            }}>
                                <img
                                    src={previewImage.url}
                                    alt={previewImage.name}
                                    style={{
                                        width: "100%",
                                        maxHeight: "540px",
                                        objectFit: "contain",
                                        transform: "scale(1.1)",
                                    }}
                                    onError={(e) => { e.target.src = `https://placehold.co/300x300/f1f5f9/94a3b8?text=Image+Not+Found`; }}
                                />
                                {/* Close button */}
                                <button
                                    onClick={() => setPreviewImage(null)}
                                    style={{
                                        position: "absolute",
                                        top: "16px",
                                        right: "16px",
                                        width: "36px",
                                        height: "36px",
                                        borderRadius: "50%",
                                        background: "rgba(255,255,255,0.95)",
                                        backdropFilter: "blur(8px)",
                                        border: "1px solid rgba(226,232,240,0.8)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                        zIndex: 10,
                                        transition: "all 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "#fff";
                                        e.currentTarget.style.transform = "scale(1.1) rotate(90deg)";
                                        e.currentTarget.style.color = "#ef4444";
                                        e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.15)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.95)";
                                        e.currentTarget.style.transform = "scale(1) rotate(0deg)";
                                        e.currentTarget.style.color = "#475569";
                                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                                    }}
                                >
                                    <X size={18} color="#475569" />
                                </button>
                            </div>
                            <div style={{
                                padding: "24px",
                                borderTop: "1px solid #f1f5f9",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                textAlign: "center",
                            }}>
                                <h3 style={{
                                    fontSize: "16px",
                                    fontWeight: 800,
                                    color: "#0f172a",
                                    margin: "0 0 12px 0",
                                    lineHeight: 1.3,
                                    letterSpacing: "-0.02em",
                                    textTransform: "capitalize",
                                }}>
                                    {previewImage.name}
                                </h3>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                                    {previewImage.platform && (
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "5px",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            color: "#4f46e5",
                                            background: "#f5f3ff",
                                            border: "1px solid #ddd6fe",
                                            padding: "4px 10px",
                                            borderRadius: "8px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.02em",
                                        }}>
                                            <Store size={11} strokeWidth={2.5} />
                                            {previewImage.platform}
                                        </div>
                                    )}
                                    {previewImage.city && (
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "5px",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            color: "#475569",
                                            background: "#f1f5f9",
                                            border: "1px solid #e2e8f0",
                                            padding: "4px 10px",
                                            borderRadius: "8px",
                                            letterSpacing: "0.02em",
                                        }}>
                                            <MapPin size={11} strokeWidth={2.5} />
                                            {previewImage.city}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
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

// ─── SHARED CLAUDE API HELPER ────────────────────────────────────────────────
// Builds the prompt and calls Claude, returning 4 segment objects.
// Used by both DynamicInsightsBar and RowAIPopup.
const callClaudeForInsights = async (insight, evidenceOverride) => {
    // Return hardcoded sentences as requested by the user, skipping the LLM API completely.
    const insightData = {
        ...insight,
        evidence: evidenceOverride || insight.evidence || []
    };
    return buildAISegments(insightData).slice(0, 4);
};

// Priority positional map
const SEGMENT_PRIORITY = ["high", "focus", "good", "neutral"];

const DynamicInsightsBar = ({ insight, loading }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [segments, setSegments] = useState(null); // null = not loaded yet
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerate = async () => {
        if (isLoading) return;
        // If already generated, just toggle visibility
        if (segments !== null) {
            setIsOpen((prev) => !prev);
            return;
        }
        setIsOpen(true);
        setIsLoading(true);
        try {
            const parsed = await callClaudeForInsights(insight);
            setSegments(
                parsed.slice(0, 4).map((seg, i) => ({
                    label: seg.label || `Insight ${i + 1}`,
                    text: seg.text || "",
                    priority: SEGMENT_PRIORITY[i] || "neutral",
                }))
            );
        } catch (err) {
            console.warn("[DynamicInsightsBar] Falling back to static:", err.message);
            setSegments(buildAISegments(insight).map((seg, i) => ({
                ...seg,
                priority: SEGMENT_PRIORITY[i] || "neutral",
            })));
        } finally {
            setIsLoading(false);
        }
    };

    const meta = SIGNAL_META[insight.type] || {};
    const isBeta = meta.isBeta !== false;

    return (
        <div style={{
            width: "100%",
            border: "1.5px solid #3b82f6",
            borderRadius: "10px",
            background: "#ffffff",
            overflow: "hidden",
        }}>
            {/* Header */}
            <div style={{ padding: "10px 18px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#0f172a",
                        letterSpacing: "-0.01em",
                    }}>AI Insights</span>
                    <div
                        title="AI-powered insights for your data"
                        style={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            border: "1.5px solid #94a3b8",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "help",
                            flexShrink: 0,
                        }}
                    >
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", lineHeight: 1 }}>i</span>
                    </div>
                    {isBeta ? <BetaBadge size="xs" /> : <LiveBadge size="xs" />}
                </div>
                <p style={{
                    fontSize: "11px",
                    color: "#64748b",
                    margin: "0 0 8px 0",
                    lineHeight: 1.4,
                    letterSpacing: "0.01em",
                }}>
                    AI-powered insights for your data
                </p>
                {/* Generate / Toggle button */}
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 14px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#ffffff",
                        background: "linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #3b82f6 100%)",
                        border: "none",
                        borderRadius: "8px",
                        cursor: isLoading ? "wait" : "pointer",
                        transition: "all 0.2s ease",
                        boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                        marginBottom: "10px",
                        opacity: isLoading ? 0.8 : 1,
                    }}
                    onMouseEnter={(e) => {
                        if (!isLoading) {
                            e.currentTarget.style.boxShadow = "0 4px 14px rgba(99, 102, 241, 0.45)";
                            e.currentTarget.style.transform = "translateY(-1px)";
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(99, 102, 241, 0.3)";
                        e.currentTarget.style.transform = "translateY(0)";
                    }}
                >
                    {isLoading ? (
                        <Loader2 size={13} style={{ animation: "spin 1.2s linear infinite" }} />
                    ) : (
                        <Sparkles size={13} />
                    )}
                    {isLoading ? "Generating…" : segments !== null ? (isOpen ? "Hide summary" : "Show summary") : "Generate summary"}
                </button>
            </div>

            {/* Expandable insights panel */}
            <AnimatePresence>
                {(isOpen || loading) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        style={{ overflow: "hidden" }}
                    >
                        <div style={{
                            padding: "0 18px 16px",
                            borderTop: "1px solid #e2e8f0",
                            marginTop: "0",
                            paddingTop: "14px",
                        }}>
                            {loading ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    <div className="skeleton-pulse" style={{ width: "90%", height: "12px", borderRadius: "4px" }} />
                                    <div className="skeleton-pulse" style={{ width: "70%", height: "12px", borderRadius: "4px" }} />
                                    <div className="skeleton-pulse" style={{ width: "85%", height: "12px", borderRadius: "4px" }} />
                                </div>
                            ) : (isLoading || segments === null) ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0" }}>
                                    <Loader2 size={16} style={{ animation: "spin 1.2s linear infinite", color: "#6366f1" }} />
                                    <span style={{ fontSize: "12px", color: "#475569", fontWeight: 500 }}>Generating summary…</span>
                                </div>
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#334155", display: "flex", flexDirection: "column", gap: "10px", listStyleType: "disc" }}>
                                    {segments.map((segment, idx) => (
                                        <li key={idx} style={{ lineHeight: "1.5", fontWeight: segment.label === "Action" ? 600 : 400 }}>
                                            <strong>{segment.label}:</strong> {renderBoldText(segment.text)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const getKpiBadgeStyle = (label, value) => {
    const l = String(label).toLowerCase();
    const v = String(value).toLowerCase();

    if (v.startsWith('-') || /gap|miss|lost|waste|drop|out of stock/.test(l)) {
        return { bg: "#fff1f2", border: "#fecaca", text: "#dc2626" }; // Red
    }
    if (/org|organic|growth|headroom|fill rate|best|offtake/.test(l)) {
        return { bg: "#f0fdf4", border: "#dcfce7", text: "#16a34a" }; // Green
    }
    if (/ad\b|spend|budget|ppu|price|cost|acos|sov/.test(l)) {
        return { bg: "#fffbeb", border: "#fef3c7", text: "#d97706" }; // Amber
    }
    if (/overall|share|sos|osa|index/.test(l)) {
        return { bg: "#eff6ff", border: "#dbeafe", text: "#2563eb" }; // Blue
    }
    return { bg: "#f8fafc", border: "#e2e8f0", text: "#475569" }; // Neutral
};

const DrillDownModal = ({ insight, open, onClose, onAI, showAIPanel, onCloseAIPanel, loading }) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && open) onClose();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!insight) return null;

    const isEmpty = insight.id.startsWith("empty_");
    const meta = SIGNAL_META[insight.type] || {};

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 1000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#fff",
                    }}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ x: "100%", opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0.5 }}
                        transition={{ type: "spring", damping: 35, stiffness: 300 }}
                        style={{
                            position: "relative",
                            width: "100%",
                            height: "100%",
                            background: "#fff",
                            display: "flex",
                            flexDirection: "row",
                            overflow: "hidden",
                            zIndex: 101,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex-1 flex flex-col h-full" style={{ maxWidth: "100%" }}>
                            {/* Modal Header */}
                            <div className="modal-header-container" style={{
                                background: "#fff",
                                borderBottom: "1px solid #e5e9f0",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                flexShrink: 0,
                                padding: "10px 24px",
                            }}>
                                <div className="modal-header-title-row" style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                                    <button
                                        onClick={onClose}
                                        style={{
                                            color: "#94a3b8",
                                            background: "#f8fafc",
                                            border: "1px solid #e2e8f0",
                                            cursor: "pointer",
                                            padding: "8px",
                                            borderRadius: "12px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "all 0.2s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = "#f1f5f9";
                                            e.currentTarget.style.color = "#0f172a";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "#f8fafc";
                                            e.currentTarget.style.color = "#94a3b8";
                                        }}
                                    >
                                        <X size={20} />
                                    </button>

                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                                            <div style={{
                                                width: 18, height: 18, borderRadius: "5px",
                                                background: meta.color ? `${meta.color}22` : "#dbeafe",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                            }}>
                                                {meta.FamilyIcon && <meta.FamilyIcon size={10} color={meta.color || "#3b82f6"} />}
                                            </div>
                                            <span style={{ fontSize: "9px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                                Signal Detail
                                            </span>
                                            <ChevronRight size={10} color="#94a3b8" />
                                            <span style={{ fontSize: "9px", fontWeight: 600, color: meta.color || "#3b82f6", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                                {insight.family}
                                            </span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <h2 className="modal-header-title-text" style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
                                                {insight.type}
                                            </h2>
                                            {meta.isBeta !== false ? <BetaBadge size="xs" /> : <LiveBadge size="xs" />}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                    {loading ? (
                                        [...Array(4)].map((_, i) => (
                                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "60px" }}>
                                                <div className="skeleton-pulse" style={{ width: "40px", height: "8px", borderRadius: "2px", marginBottom: "4px" }} />
                                                <div className="skeleton-pulse" style={{ width: "100%", height: "22px", borderRadius: "6px" }} />
                                            </div>
                                        ))
                                    ) : (
                                        (insight.kpis || []).map((k, i) => {
                                            const theme = getKpiBadgeStyle(k.label, k.value);
                                            return (
                                                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "60px" }}>
                                                    <p style={{ fontSize: "8px", color: "#94a3b8", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, margin: 0 }}>{k.label}</p>
                                                    <div style={{
                                                        background: theme.bg,
                                                        border: `1px solid ${theme.border}`,
                                                        padding: "3px 10px",
                                                        borderRadius: "6px",
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        width: "100%"
                                                    }}>
                                                        <p style={{ fontSize: "12px", fontWeight: 800, color: theme.text, margin: 0 }}>{k.value}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    {insight.type !== "New Market Entry" && (
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "70px" }}>
                                            <p style={{ fontSize: "8px", color: "#94a3b8", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, margin: 0 }}>Impact</p>
                                            {loading ? (
                                                <div className="skeleton-pulse" style={{ width: "100%", height: "24px", borderRadius: "6px" }} />
                                            ) : (
                                                <div style={{
                                                    background: "#fff1f2",
                                                    border: "1px solid #fecaca",
                                                    padding: "3px 10px",
                                                    borderRadius: "6px",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    width: "100%"
                                                }}>
                                                    <p style={{ fontSize: "13px", fontWeight: 900, color: "#dc2626", margin: 0 }}>{formatINRCompact(insight.impactInr || 0)}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* AI Insights Bar */}
                            <div className="dynamic-insights-bar" style={{ padding: "8px 24px 12px", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
                                <DynamicInsightsBar insight={insight} loading={loading} />
                            </div>

                            {/* Body */}
                            <div className="modal-body-container" style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fafcff", overflow: "hidden" }}>
                                {loading ? (
                                    <div style={{ flex: 1, padding: "24px" }}>
                                        <div className="skeleton-pulse" style={{ width: "100%", height: "100%", borderRadius: "12px" }} />
                                    </div>
                                ) : isEmpty ? (
                                    <div style={{
                                        textAlign: "center", padding: "64px 16px",
                                        border: "1px dashed #bfdbfe", borderRadius: "10px",
                                        color: "#94a3b8",
                                    }}>
                                        <Activity size={20} style={{ margin: "0 auto 8px", color: "#cbd5e1" }} />
                                        <p style={{ fontSize: "12px", margin: 0 }}>No detailed evidence available.</p>
                                    </div>
                                ) : (
                                    <EvidenceTable insight={insight} loading={loading} />
                                )}
                            </div>
                        </div>

                        {/* Drill-down tour for first-time users */}
                        <DrillDownTour enabled={!isEmpty} />

                        {/* AI Panel Drawer */}
                        <AnimatePresence>
                            {showAIPanel && <AIInsightsPanelLive insight={insight} onClose={onCloseAIPanel} loading={loading} />}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ─── SIGNAL CARD SKELETON ───────────────────────────────────────────────────

const SignalCardSkeleton = () => (
    <div style={{
        width: "100%",
        height: "100%",
        minHeight: "180px",
        display: "flex",
        flexDirection: "column",
        borderRadius: "0px",
        background: "#ffffff",
        overflow: "hidden",
        position: "relative",
        border: "1px solid #f1f5f9",
    }}>
        {/* Top Badge Row */}
        <div style={{ padding: "10px 14px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="skeleton-pulse" style={{ width: "65px", height: "18px", borderRadius: "6px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div className="skeleton-pulse" style={{ width: "35px", height: "16px", borderRadius: "5px" }} />
                <div className="skeleton-pulse" style={{ width: "22px", height: "22px", borderRadius: "5px" }} />
            </div>
        </div>

        {/* Title Section */}
        <div style={{ padding: "2px 14px 8px" }}>
            <div className="skeleton-pulse" style={{ width: "30%", height: "8px", borderRadius: "3px", marginBottom: "6px" }} />
            <div className="skeleton-pulse" style={{ width: "80%", height: "14px", borderRadius: "4px" }} />
        </div>

        <Divider sx={{ mx: 1.5, borderColor: "#f1f5f9" }} />

        {/* Metric Hero Section */}
        <div style={{ padding: "10px 14px 10px" }}>
            <div className="skeleton-pulse" style={{ width: "55%", height: "8px", borderRadius: "3px", marginBottom: "8px" }} />
            <div className="skeleton-pulse" style={{
                width: "110px", height: "30px", borderRadius: "8px"
            }} />
        </div>

        {/* Footer */}
        <div style={{ marginTop: "auto", padding: "10px 14px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", background: "#ffffff" }}>
            <div className="skeleton-pulse" style={{ width: "70px", height: "10px", borderRadius: "3px" }} />
        </div>
    </div>
);

const StatsPillsSkeleton = () => (
    <div style={{ display: "flex", gap: "24px" }}>
        <div style={{ textAlign: "right" }}>
            <div className="skeleton-pulse" style={{ width: "80px", height: "10px", borderRadius: "3px", marginBottom: "6px", marginLeft: "auto" }} />
            <div className="skeleton-pulse" style={{ width: "100px", height: "22px", borderRadius: "4px", marginLeft: "auto" }} />
        </div>
        <div style={{ textAlign: "right" }}>
            <div className="skeleton-pulse" style={{ width: "70px", height: "10px", borderRadius: "3px", marginBottom: "6px", marginLeft: "auto" }} />
            <div className="skeleton-pulse" style={{ width: "40px", height: "22px", borderRadius: "4px", marginLeft: "auto" }} />
        </div>
    </div>
);


// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const InsightsSignalHub = () => {
    const {
        refreshFilters,
        maxDate,
        platform,
        selectedCategory,
        selectedBrand,
        selectedLocation,
        timeStart,
        timeEnd,
        compareStart,
        compareEnd
    } = useContext(FilterContext);

    const { isKpiEnabled, getKpiCount } = useKpiPermissions("Insights");
    const { enabled, total } = useMemo(() => getKpiCount(), [getKpiCount]);

    const [fetchedInsights, setFetchedInsights] = useState([]);
    const [fetchedFilterOptions, setFetchedFilterOptions] = useState({ categories: [], productLines: [], geographies: [] });
    const [loading, setLoading] = useState(false);

    const [selectedId, setSelectedId] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [showAIPanel, setShowAIPanel] = useState(false);

    // ── Co-Relations state ──
    const [showCorrelations, setShowCorrelations] = useState(false);
    const [correlationsLoading, setCorrelationsLoading] = useState(false);
    const [correlationsData, setCorrelationsData] = useState([]);
    const [correlationMode, setCorrelationMode] = useState("drainer");

    // Filter correlations data based on mode (drainer vs gainer) and sort by Sales descending
    const filteredCorrelations = useMemo(() => {
        const filtered = correlationsData.filter(row => {
            const salesVal = row.salesChange != null ? Number(row.salesChange) : 0;
            const osaVal = row.osaChange != null ? Number(row.osaChange) : 0;
            if (correlationMode === "drainer") {
                return salesVal < 0 && osaVal < 0;
            } else if (correlationMode === "gainer") {
                return salesVal > 0 && osaVal > 0;
            }
            return true;
        });

        return [...filtered].sort((a, b) => {
            const aSales = a.sales != null ? Number(a.sales) : 0;
            const bSales = b.sales != null ? Number(b.sales) : 0;
            return bSales - aSales;
        });
    }, [correlationsData, correlationMode]);

    const [correlationsPage, setCorrelationsPage] = useState(1);
    
    // Reset page on mode change
    useEffect(() => {
        setCorrelationsPage(1);
    }, [correlationMode]);

    const correlationsPerPage = 100;
    const totalCorrelationsPages = Math.ceil(filteredCorrelations.length / correlationsPerPage);
    const paginatedCorrelations = useMemo(() => {
        const startIndex = (correlationsPage - 1) * correlationsPerPage;
        return filteredCorrelations.slice(startIndex, startIndex + correlationsPerPage);
    }, [filteredCorrelations, correlationsPage]);
    const [correlationsTrendRow, setCorrelationsTrendRow] = useState(null);
    const [correlationsTrendData, setCorrelationsTrendData] = useState([]);
    const [correlationsTrendLoading, setCorrelationsTrendLoading] = useState(false);
    const [trendCustomStart, setTrendCustomStart] = useState("");
    const [trendCustomEnd, setTrendCustomEnd] = useState("");
    const [corrStartDate, setCorrStartDate] = useState(dayjs().subtract(30, 'day').format("YYYY-MM-DD"));
    const [corrEndDate, setCorrEndDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [showCorrelationsInfo, setShowCorrelationsInfo] = useState(false);
    const [activeTrendKPIs, setActiveTrendKPIs] = useState({
        sales: true,
        drr: true,
        osa: true,
        promo: true,
        listing: true,
        searchRank: true
    });


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
                const formatArray = (val, defaultVal) => {
                    if (!val || val === "All") return defaultVal;
                    return Array.isArray(val) ? val.join(",") : val;
                };

                const apiPayload = {
                    platform: formatArray(platform, "All platforms"),
                    category: formatArray(selectedCategory, "All categories"),
                    brand: formatArray(selectedBrand, "All brands"),
                    city: formatArray(selectedLocation, "All cities"),
                    type: "All signals",
                    startDate: timeStart?.format("YYYY-MM-DD") || dayjs().subtract(30, 'day').format("YYYY-MM-DD"),
                    endDate: timeEnd?.format("YYYY-MM-DD") || dayjs().format("YYYY-MM-DD"),
                    ...(compareStart ? { compareStartDate: compareStart.format("YYYY-MM-DD") } : {}),
                    ...(compareEnd ? { compareEndDate: compareEnd.format("YYYY-MM-DD") } : {}),
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
    }, [platform, selectedCategory, selectedBrand, selectedLocation, timeStart, timeEnd, compareStart, compareEnd]);




    const allInsights = useMemo(() => fetchedInsights, [fetchedInsights]);

    const filteredInsights = useMemo(() => {
        return allInsights.filter((ins) => {
            const kpiId = ins.type.toLowerCase().replace(/\s+/g, '_');
            return isKpiEnabled(kpiId);
        });
    }, [allInsights, isKpiEnabled]);

    const selected = useMemo(() => allInsights.find((x) => x.id === selectedId) ?? null, [allInsights, selectedId]);
    const totalImpact = filteredInsights.reduce((s, i) => s + (i.impactInr || 0), 0);
    const activeSignals = filteredInsights.filter((i) => !i.id.startsWith("empty_")).length;

    // ── Co-Relations handlers ──
    const fetchCorrelationsDataLocally = useCallback(async (start, end) => {
        setCorrelationsLoading(true);
        setCorrelationsData([]);
        try {
            const formatArray = (val, defaultVal) => {
                if (!val || val === "All") return defaultVal;
                return Array.isArray(val) ? val.join(",") : val;
            };
            const apiPayload = {
                platform: formatArray(platform, "All platforms"),
                category: formatArray(selectedCategory, "All categories"),
                brand: formatArray(selectedBrand, "All"),
                city: formatArray(selectedLocation, "All cities"),
                startDate: start,
                endDate: end,
            };
            const res = await fetchCorrelations(apiPayload);
            setCorrelationsData(res?.data || []);
            setCorrelationsPage(1);
        } catch (err) {
            console.error("Correlations fetch error:", err);
            setCorrelationsData([]);
            setCorrelationsPage(1);
        } finally {
            setCorrelationsLoading(false);
        }
    }, [platform, selectedCategory, selectedBrand, selectedLocation]);

    useEffect(() => {
        if (showCorrelations) {
            fetchCorrelationsDataLocally(corrStartDate, corrEndDate);
        }
    }, [showCorrelations, platform, selectedCategory, selectedBrand, selectedLocation, corrStartDate, corrEndDate, fetchCorrelationsDataLocally]);

    const handleCorrelationsOpen = useCallback(() => {
        setShowCorrelations(true);
    }, []);

    const handleTrendOpen = useCallback(async (row) => {
        setCorrelationsTrendRow(row);
        setCorrelationsTrendLoading(true);
        setCorrelationsTrendData([]);
        const startDate = row.dateRange?.split(" to ")?.[0] || dayjs().subtract(30, 'day').format("YYYY-MM-DD");
        const endDate = row.dateRange?.split(" to ")?.[1] || dayjs().format("YYYY-MM-DD");
        setTrendCustomStart(startDate);
        setTrendCustomEnd(endDate);
        try {
            const res = await fetchCorrelationsTrend({
                platform: row.platform, category: row.category,
                brand: row.brand, sku: row.sku, location: row.location,
                startDate, endDate,
                size: row.size,
            });
            setCorrelationsTrendData(res?.data || []);
        } catch (err) {
            console.error("Trend fetch error:", err);
        } finally {
            setCorrelationsTrendLoading(false);
        }
    }, []);

    const handleTrendCustomFetch = useCallback(async () => {
        if (!correlationsTrendRow || !trendCustomStart || !trendCustomEnd) return;
        setCorrelationsTrendLoading(true);
        try {
            const res = await fetchCorrelationsTrend({
                platform: correlationsTrendRow.platform, category: correlationsTrendRow.category,
                brand: correlationsTrendRow.brand, sku: correlationsTrendRow.sku, location: correlationsTrendRow.location,
                startDate: trendCustomStart, endDate: trendCustomEnd,
                size: correlationsTrendRow.size,
            });
            setCorrelationsTrendData(res?.data || []);
        } catch (err) {
            console.error("Trend custom fetch error:", err);
        } finally {
            setCorrelationsTrendLoading(false);
        }
    }, [correlationsTrendRow, trendCustomStart, trendCustomEnd]);

    const handleCardClick = (id) => {
        // Check if clicked card is Co-Relations
        const clickedInsight = allInsights.find(x => x.id === id);
        if (clickedInsight?.type === "Co-Relations") {
            handleCorrelationsOpen();
            return;
        }
        setSelectedId(id);
        setShowAIPanel(false);
        setDialogOpen(true);
    };

    const handleClose = () => {
        setDialogOpen(false);
        setShowAIPanel(false);
    };

    return (
        <CommonContainer title="Insights" disablePadding={true}>
            <InsightsOnboardingTour enabled={!loading && fetchedInsights.length > 0} />
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.2; }
                }
                @keyframes pulse-outward {
                    0% {
                        box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.6), 0 0 0 0 rgba(99, 102, 241, 0.3);
                        transform: scale(1);
                    }
                    70% {
                        box-shadow: 0 0 0 10px rgba(99, 102, 241, 0), 0 0 0 20px rgba(99, 102, 241, 0);
                        transform: scale(1.02);
                    }
                    100% {
                        box-shadow: 0 0 0 0 rgba(99, 102, 241, 0), 0 0 0 0 rgba(99, 102, 241, 0);
                        transform: scale(1);
                    }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                * { box-sizing: border-box; }
                .insights-page { font-family: 'Inter', system-ui, sans-serif; }
                .signal-card-enter { animation: fadeSlideIn 0.35s ease forwards; }
                .ai-pulse-button { animation: pulse-outward 2.5s infinite cubic-bezier(0.4, 0, 0.6, 1); }
                .status-pulse-blue { animation: pulse-blue-small 2.5s infinite cubic-bezier(0.4, 0, 0.6, 1); }
                .status-pulse-green { animation: pulse-green-small 2.5s infinite cubic-bezier(0.4, 0, 0.6, 1); }
                @keyframes pulse-blue-small {
                    0% {
                        box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.6);
                        transform: scale(1);
                    }
                    70% {
                        box-shadow: 0 0 0 6px rgba(37, 99, 235, 0);
                        transform: scale(1.05);
                    }
                    100% {
                        box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
                        transform: scale(1);
                    }
                }
                @keyframes pulse-green-small {
                    0% {
                        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6);
                        transform: scale(1);
                    }
                    70% {
                        box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
                        transform: scale(1.05);
                    }
                    100% {
                        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
                        transform: scale(1);
                    }
                }
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .skeleton-pulse {
                    background: linear-gradient(90deg, #f1f5f9 25%, #f8fafc 50%, #f1f5f9 75%);
                    background-size: 200% 100%;
                    animation: shimmer 2s infinite linear;
                }
                /* ── Responsive Signal Grid ── */
                .insights-signal-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                }
                @media (max-width: 1400px) {
                    .insights-signal-grid { grid-template-columns: repeat(3, 1fr); }
                }
                @media (max-width: 1100px) {
                    .insights-signal-grid { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 700px) {
                    .insights-signal-grid { grid-template-columns: 1fr; }
                }
                /* ── Responsive Filter Grid ── */
                .insights-filter-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    align-items: start;
                    flex: 1;
                    min-width: 0;
                }
                @media (max-width: 1100px) {
                    .insights-filter-grid { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 700px) {
                    .insights-filter-grid { grid-template-columns: 1fr; }
                }

                /* ── Responsive DrillDownModal ── */
                .modal-header-container {
                    padding: 20px 32px;
                }
                .modal-kpi-strip {
                    padding: 16px 32px;
                }
                .modal-body-container {
                    padding: 24px 32px 32px 32px;
                }
                @media (max-width: 900px) {
                    .modal-header-container { padding: 16px 20px; }
                    .modal-kpi-strip { padding: 12px 20px; }
                    .modal-body-container { padding: 0 16px 16px 16px; }
                }
                @media (max-width: 768px) {
                    .modal-header-container { flex-direction: column; align-items: flex-start !important; gap: 16px; }
                    .modal-header-title-row { gap: 12px !important; }
                    .modal-header-title-text { font-size: 18px !important; }
                    .modal-kpi-strip { gap: 16px !important; }
                    .modal-kpi-main-row { flex-direction: column; align-items: flex-start !important; gap: 16px !important; }
                    .modal-kpi-divider { display: none; }
                }

                /* ── Responsive Evidence Table ── */
                .evidence-header {
                    padding: 12px 18px;
                }
                @media (max-width: 640px) {
                    .evidence-header { flex-direction: column; align-items: flex-start !important; gap: 12px; }
                    .evidence-actions-row { width: 100%; justify-content: space-between; }
                    .evidence-search-container { width: 100% !important; }
                }

                /* ── AI Panel Responsiveness ── */
                .ai-insights-panel {
                    width: 320px;
                }
                @media (max-width: 480px) {
                    .ai-insights-panel { width: 100% !important; }
                }

                /* ── Main Container Padding ── */
                .insights-main-container {
                    padding: 0 24px 24px 24px;
                }
                @media (max-width: 640px) {
                    .insights-main-container { padding: 6px 12px 12px 12px; }
                }
            `}</style>

            <div className="insights-page" style={{
                background: "#f8fafc",
                height: "100%",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
            }}>
                <div className="insights-main-container" style={{ width: "100%", margin: "0 auto", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

                    {/* ── Page Header ──────────────────────────────────── ┐*/}
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        flexWrap: "wrap", gap: "16px",
                        marginBottom: "32px",
                        background: "transparent",
                        border: "none",
                        borderRadius: "0",
                        padding: "20px 0 10px 0",
                        boxShadow: "none",
                        flexShrink: 0,
                    }}>
                        <div className="tour-header" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: "8px",
                                background: "#0f172a",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                            }}>
                                <Sparkles size={20} color="#fff" strokeWidth={2} />
                            </div>
                            <div>
                                <h1 style={{
                                    fontSize: "18px", fontWeight: 800, color: "#0f172a",
                                    margin: 0, letterSpacing: "-0.02em",
                                    display: "flex", alignItems: "center", gap: "8px",
                                    flexWrap: "wrap",
                                }}>
                                    AI Signal Insights
                                    <BetaBadge />
                                    {total > 0 && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 shadow-sm transition hover:bg-indigo-100/50" title={`Currently displaying ${enabled} out of ${total} KPIs configured for this page.`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                            {enabled} of {total} KPIs Active
                                        </span>
                                    )}
                                </h1>
                                <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, marginTop: "2px", fontWeight: 400 }}>
                                    Anomaly detection & opportunity tracking across your retail landscape
                                </p>
                            </div>
                        </div>
                        {loading ? (
                            <StatsPillsSkeleton />
                        ) : (
                            <div style={{ display: "flex", gap: "24px" }}>
                                <div style={{
                                    background: "transparent", border: "none",
                                    borderRadius: "0", padding: "4px 0", textAlign: "right",
                                }}>
                                    <div style={{ fontSize: "9px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>
                                        Total Opportunity
                                    </div>
                                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                                        {formatINRCompact(totalImpact)}
                                    </div>
                                </div>
                                <div className="tour-active-signals" style={{
                                    background: "transparent", border: "none",
                                    borderRadius: "0", padding: "4px 0", textAlign: "right",
                                }}>
                                    <div style={{ fontSize: "9px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>
                                        Active Signals
                                    </div>
                                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#16a34a", letterSpacing: "-0.02em" }}>
                                        {activeSignals}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>



                    {/* ── Signal Grid ─────────────────────────────────────── */}
                    {loading ? (
                        <div className="insights-signal-grid" style={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: "auto",
                            overflowX: "hidden",
                            alignContent: "start",
                            paddingBottom: "12px",
                        }}>
                            {[...Array(REQUIRED_SIGNAL_TYPES.length)].map((_, i) => (
                                <motion.div
                                    key={`skeleton-${i}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <SignalCardSkeleton />
                                </motion.div>
                            ))}
                        </div>
                    ) : filteredInsights.length === 0 ? (
                        <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            justifyContent: "center", padding: "80px 0",
                            background: "#fff", border: "1px dashed #e5e9f0",
                            borderRadius: "10px",
                        }}>
                            <Radar size={26} color="#d1d5db" style={{ marginBottom: "10px" }} />
                            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                                No signals detected
                            </h3>
                            <p style={{ fontSize: "12px", color: "#9ca3af" }}>Adjust filters to broaden scope.</p>
                        </div>
                    ) : (
                        <div className="insights-signal-grid" style={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: "auto",
                            overflowX: "hidden",
                            alignContent: "start",
                            paddingBottom: "12px",
                        }}>
                            {filteredInsights.map((ins, idx) => (
                                <motion.div
                                    key={ins.id}
                                    className={`tour-card-${ins.type.replace(/\s+/g, '-').toLowerCase()}`}
                                    style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                >
                                    <OverviewSignalCard
                                        insight={ins}
                                        isSelected={selectedId === ins.id && dialogOpen}
                                        onClick={() => handleCardClick(ins.id)}
                                        loading={loading}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    )}

                </div>

                {/* Modal is inside the relative parent to properly adapt to sidebar layout shifts */}
                <DrillDownModal
                    insight={selected}
                    open={dialogOpen}
                    onClose={handleClose}
                    onAI={() => setShowAIPanel(true)}
                    showAIPanel={showAIPanel}
                    onCloseAIPanel={() => setShowAIPanel(false)}
                    loading={loading}
                />

                {/* ── Co-Relations Full-Screen Modal ─────────────────────── */}
                <AnimatePresence>
                    {showCorrelations && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: "absolute", inset: 0, zIndex: 1000,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: "#fff",
                            }}
                        >
                            <motion.div
                                initial={{ x: "100%", opacity: 0.5 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: "100%", opacity: 0.5 }}
                                transition={{ type: "spring", damping: 35, stiffness: 300 }}
                                style={{
                                    position: "relative", width: "100%", height: "100%",
                                    background: "#fff", display: "flex", flexDirection: "column",
                                    overflow: "hidden", zIndex: 101,
                                }}
                            >
                                {/* Header */}
                                <div style={{
                                    background: "#fff", borderBottom: "1px solid #e5e9f0",
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    flexShrink: 0, padding: "12px 24px",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                        <button
                                            onClick={() => {
                                                if (correlationsTrendRow) {
                                                    setCorrelationsTrendRow(null);
                                                } else {
                                                    setShowCorrelations(false);
                                                }
                                            }}
                                            style={{
                                                color: "#94a3b8", background: "#f8fafc",
                                                border: "1px solid #e2e8f0", cursor: "pointer",
                                                padding: "8px", borderRadius: "12px",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                transition: "all 0.2s ease",
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#0f172a"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#94a3b8"; }}
                                        >
                                            {correlationsTrendRow ? <ArrowLeft size={20} /> : <X size={20} />}
                                        </button>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <div style={{
                                                    width: 28, height: 28, borderRadius: "7px",
                                                    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                }}>
                                                    <Link2 size={14} color="#fff" />
                                                </div>
                                                <span style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                                                    {correlationsTrendRow ? "KPI Trend Analysis" : "Co-Relations"}
                                                </span>
                                                <BetaBadge size="xs" />
                                                {!correlationsTrendRow && (
                                                    <button
                                                        onClick={() => setShowCorrelationsInfo(true)}
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            color: "#6366f1",
                                                            cursor: "pointer",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            padding: "4px",
                                                            borderRadius: "50%",
                                                            marginLeft: "8px",
                                                            transition: "all 0.2s ease"
                                                        }}
                                                        title="Click to know how it works"
                                                        onMouseEnter={(e) => e.currentTarget.style.color = "#4f46e5"}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = "#6366f1"}
                                                    >
                                                        <Info size={16} />
                                                    </button>
                                                )}
                                            </div>
                                            <p style={{ fontSize: "11px", color: "#6b7280", margin: "2px 0 0 38px", fontWeight: 400 }}>
                                                {correlationsTrendRow
                                                    ? `${correlationsTrendRow.brand} › ${correlationsTrendRow.platform} › ${correlationsTrendRow.location}`
                                                    : "Comparative Sales & OSA analysis — sudden gains and drops"
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Body */}
                                <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
                                    {correlationsTrendRow ? (
                                        /* ── TREND VIEW ──────────────────────────── */
                                        <div style={{ padding: "24px" }}>
                                            {/* Custom Date Picker */}
                                            <div style={{
                                                display: "flex", alignItems: "center", gap: "12px",
                                                marginBottom: "24px", background: "#f8fafc",
                                                padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0",
                                                flexWrap: "wrap",
                                            }}>
                                                <Calendar size={14} color="#6366f1" />
                                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date Range</span>
                                                <input
                                                    type="date"
                                                    value={trendCustomStart}
                                                    onChange={(e) => setTrendCustomStart(e.target.value)}
                                                    style={{
                                                        fontSize: "12px", padding: "6px 10px", border: "1px solid #cbd5e1",
                                                        borderRadius: "6px", color: "#1e293b", background: "#fff",
                                                        fontWeight: 500, outline: "none",
                                                    }}
                                                />
                                                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>to</span>
                                                <input
                                                    type="date"
                                                    value={trendCustomEnd}
                                                    onChange={(e) => setTrendCustomEnd(e.target.value)}
                                                    style={{
                                                        fontSize: "12px", padding: "6px 10px", border: "1px solid #cbd5e1",
                                                        borderRadius: "6px", color: "#1e293b", background: "#fff",
                                                        fontWeight: 500, outline: "none",
                                                    }}
                                                />
                                                <button
                                                    onClick={handleTrendCustomFetch}
                                                    style={{
                                                        fontSize: "11px", fontWeight: 700, padding: "6px 16px",
                                                        borderRadius: "6px", border: "none", cursor: "pointer",
                                                        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                                                        color: "#fff", transition: "all 0.2s",
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(99,102,241,0.3)"; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                                                >
                                                    Apply
                                                </button>
                                            </div>

                                            {correlationsTrendLoading ? (
                                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
                                                    <TrailyticsTypewriterLoader size={0.85} message="Loading trend data..." />
                                                </div>
                                            ) : correlationsTrendData.length === 0 ? (
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", color: "#94a3b8" }}>
                                                    <Activity size={32} style={{ marginBottom: "12px" }} />
                                                    <p style={{ fontSize: "13px", fontWeight: 600 }}>No trend data available for this selection</p>
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                                                    {/* Combined KPI Trend */}
                                                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                                                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                                                            <Activity size={16} color="#6366f1" />
                                                            KPI Trend Analysis
                                                        </div>

                                                        {/* Interactive KPI Selectors */}
                                                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                                                            {[
                                                                { key: "sales", label: "Sales (₹)", color: "#6366f1", bg: "rgba(99, 102, 241, 0.08)" },
                                                                { key: "drr", label: "DRR (Units)", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.08)" },
                                                                { key: "osa", label: "OSA (%)", color: "#10b981", bg: "rgba(16, 185, 129, 0.08)" },
                                                                { key: "promo", label: "Promo (%)", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)" },
                                                                { key: "listing", label: "Listing (%)", color: "#ec4899", bg: "rgba(236, 72, 153, 0.08)" },
                                                                { key: "searchRank", label: "Search Rank", color: "#06b6d4", bg: "rgba(6, 182, 212, 0.08)" }
                                                            ].map((kpi) => {
                                                                const isActive = activeTrendKPIs[kpi.key];
                                                                return (
                                                                    <button
                                                                        key={kpi.key}
                                                                        onClick={() => {
                                                                            setActiveTrendKPIs(prev => ({
                                                                                ...prev,
                                                                                [kpi.key]: !prev[kpi.key]
                                                                            }));
                                                                        }}
                                                                        style={{
                                                                            display: "flex",
                                                                            alignItems: "center",
                                                                            gap: "8px",
                                                                            padding: "8px 16px",
                                                                            borderRadius: "20px",
                                                                            border: isActive ? `1.5px solid ${kpi.color}` : "1.5px solid #e2e8f0",
                                                                            background: isActive ? kpi.bg : "#fff",
                                                                            color: isActive ? kpi.color : "#64748b",
                                                                            fontSize: "12px",
                                                                            fontWeight: 600,
                                                                            cursor: "pointer",
                                                                            transition: "all 0.2s ease",
                                                                            outline: "none",
                                                                            boxShadow: isActive ? `0 2px 8px ${kpi.bg}` : "none",
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            if (!isActive) {
                                                                                e.currentTarget.style.border = `1.5px solid ${kpi.color}`;
                                                                                e.currentTarget.style.background = "#fafafa";
                                                                            }
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            if (!isActive) {
                                                                                e.currentTarget.style.border = "1.5px solid #e2e8f0";
                                                                                e.currentTarget.style.background = "#fff";
                                                                            }
                                                                        }}
                                                                    >
                                                                        <span style={{
                                                                            width: "8px",
                                                                            height: "8px",
                                                                            borderRadius: "50%",
                                                                            background: isActive ? kpi.color : "#94a3b8",
                                                                            display: "inline-block",
                                                                            transition: "background 0.2s ease"
                                                                        }} />
                                                                        {kpi.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        <ResponsiveContainer width="100%" height={380}>
                                                            <LineChart data={correlationsTrendData}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => v ? dayjs(v).format("DD MMM") : ""} />
                                                                
                                                                {/* Left Y-Axis — Sales (₹) */}
                                                                {activeTrendKPIs.sales && (
                                                                    <YAxis
                                                                        yAxisId="sales"
                                                                        orientation="left"
                                                                        tick={{ fontSize: 10, fill: "#6366f1" }}
                                                                        tickFormatter={(v) => v >= 1e5 ? `₹${(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${(v / 1e3).toFixed(0)}K` : `₹${v}`}
                                                                        axisLine={{ stroke: "#6366f1", strokeWidth: 1.5 }}
                                                                        tickLine={{ stroke: "#6366f1" }}
                                                                    />
                                                                )}

                                                                {/* Left/Right Y-Axis — DRR (Units) */}
                                                                {activeTrendKPIs.drr && (
                                                                    <YAxis
                                                                        yAxisId="units"
                                                                        orientation={activeTrendKPIs.sales ? "right" : "left"}
                                                                        tick={{ fontSize: 10, fill: "#8b5cf6" }}
                                                                        tickFormatter={(v) => formatUnitsCompact(v)}
                                                                        axisLine={{ stroke: "#8b5cf6", strokeWidth: 1.5 }}
                                                                        tickLine={{ stroke: "#8b5cf6" }}
                                                                    />
                                                                )}

                                                                {/* Right Y-Axis — OSA, Promo, Listing (%) */}
                                                                {(activeTrendKPIs.osa || activeTrendKPIs.promo || activeTrendKPIs.listing) && (
                                                                    <YAxis
                                                                        yAxisId="pct"
                                                                        orientation="right"
                                                                        domain={[0, 100]}
                                                                        tick={{ fontSize: 10, fill: "#64748b" }}
                                                                        tickFormatter={(v) => `${v}%`}
                                                                        axisLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                                                                        tickLine={{ stroke: "#94a3b8" }}
                                                                    />
                                                                )}

                                                                {/* Search Rank Y-Axis — reversed since rank 1 is best */}
                                                                {activeTrendKPIs.searchRank && (
                                                                    <YAxis
                                                                        yAxisId="rank"
                                                                        orientation={(activeTrendKPIs.sales || activeTrendKPIs.drr) ? "right" : "left"}
                                                                        reversed
                                                                        tick={{ fontSize: 10, fill: "#06b6d4" }}
                                                                        tickFormatter={(v) => `#${v}`}
                                                                        axisLine={{ stroke: "#06b6d4", strokeWidth: 1.5 }}
                                                                        tickLine={{ stroke: "#06b6d4" }}
                                                                    />
                                                                )}

                                                                <RechartsTooltip
                                                                    contentStyle={{ fontSize: "11px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", padding: "10px 14px" }}
                                                                    labelFormatter={(label) => label ? dayjs(label).format("DD MMM YYYY") : ""}
                                                                    formatter={(value, name) => {
                                                                        if (name === "sales") return [`₹${Number(value).toLocaleString("en-IN")}`, "Sales"];
                                                                        if (name === "drr") return [Number(value).toLocaleString("en-IN"), "DRR"];
                                                                        if (name === "osa") return [`${Number(value).toFixed(1)}%`, "OSA"];
                                                                        if (name === "promo") return [`${Number(value).toFixed(1)}%`, "Promo"];
                                                                        if (name === "listing") return [`${Number(value).toFixed(1)}%`, "Listing"];
                                                                        if (name === "searchRank") return [`#${Number(value).toFixed(1)}`, "Search Rank"];
                                                                        return [value, name];
                                                                    }}
                                                                />

                                                                {activeTrendKPIs.sales && (
                                                                    <Line yAxisId="sales" type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 5, stroke: "#6366f1", strokeWidth: 2, fill: "#fff" }} />
                                                                )}
                                                                {activeTrendKPIs.drr && (
                                                                    <Line yAxisId="units" type="monotone" dataKey="drr" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }} activeDot={{ r: 5, stroke: "#8b5cf6", strokeWidth: 2, fill: "#fff" }} />
                                                                )}
                                                                {activeTrendKPIs.osa && (
                                                                    <Line yAxisId="pct" type="monotone" dataKey="osa" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }} activeDot={{ r: 5, stroke: "#10b981", strokeWidth: 2, fill: "#fff" }} connectNulls />
                                                                )}
                                                                {activeTrendKPIs.promo && (
                                                                    <Line yAxisId="pct" type="monotone" dataKey="promo" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }} activeDot={{ r: 5, stroke: "#f59e0b", strokeWidth: 2, fill: "#fff" }} connectNulls />
                                                                )}
                                                                {activeTrendKPIs.listing && (
                                                                    <Line yAxisId="pct" type="monotone" dataKey="listing" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 3, fill: "#ec4899", strokeWidth: 0 }} activeDot={{ r: 5, stroke: "#ec4899", strokeWidth: 2, fill: "#fff" }} connectNulls />
                                                                )}

                                                                {activeTrendKPIs.searchRank && (
                                                                    <Line yAxisId="rank" type="monotone" dataKey="searchRank" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3, fill: "#06b6d4", strokeWidth: 0 }} activeDot={{ r: 5, stroke: "#06b6d4", strokeWidth: 2, fill: "#fff" }} connectNulls />
                                                                )}
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* ── MAIN CO-RELATIONS VIEW ──────────────── */
                                        <div>
                                            {/* Mode Toggle Toolbar */}
                                            <div style={{
                                                padding: "16px 24px",
                                                borderBottom: "1px solid #e2e8f0",
                                                background: "#ffffff",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                position: "sticky",
                                                top: 0,
                                                zIndex: 30,
                                                boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                     <div style={{
                                                         display: "inline-flex",
                                                         background: "#f1f5f9",
                                                         padding: "3px",
                                                         borderRadius: "8px",
                                                         border: "1px solid #e2e8f0"
                                                     }}>
                                                         <button
                                                             onClick={() => setCorrelationMode("drainer")}
                                                             style={{
                                                                 padding: "6px 16px",
                                                                 borderRadius: "6px",
                                                                 border: "none",
                                                                 fontSize: "11px",
                                                                 fontWeight: 700,
                                                                 cursor: "pointer",
                                                                 background: correlationMode === "drainer" ? "#ef4444" : "transparent",
                                                                 color: correlationMode === "drainer" ? "#ffffff" : "#64748b",
                                                                 display: "flex",
                                                                 alignItems: "center",
                                                                 gap: "6px",
                                                                 transition: "all 0.2s ease"
                                                             }}
                                                         >
                                                             <TrendingDown size={12} />
                                                             Drainers (Dropped)
                                                         </button>
                                                         <button
                                                             onClick={() => setCorrelationMode("gainer")}
                                                             style={{
                                                                 padding: "6px 16px",
                                                                 borderRadius: "6px",
                                                                 border: "none",
                                                                 fontSize: "11px",
                                                                 fontWeight: 700,
                                                                 cursor: "pointer",
                                                                 background: correlationMode === "gainer" ? "#10b981" : "transparent",
                                                                 color: correlationMode === "gainer" ? "#ffffff" : "#64748b",
                                                                 display: "flex",
                                                                 alignItems: "center",
                                                                 gap: "6px",
                                                                 transition: "all 0.2s ease"
                                                             }}
                                                         >
                                                             <TrendingUp size={12} />
                                                             Gainers (Increased)
                                                         </button>
                                                     </div>
                                                </div>
                                                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                                                    Showing anomalies based on selected mode
                                                </div>
                                            </div>

                                            {correlationsLoading ? (
                                                /* ── LOADER ──────────────────────────── */
                                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
                                                    <TrailyticsTypewriterLoader size={1.1} message="Analyzing KPI correlations..." />
                                                </div>
                                            ) : filteredCorrelations.length === 0 ? (
                                                /* ── EMPTY STATE ─────────────────────── */
                                                <div style={{
                                                    display: "flex", flexDirection: "column", alignItems: "center",
                                                    justifyContent: "center", minHeight: "400px", color: "#94a3b8",
                                                }}>
                                                    <Link2 size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
                                                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>No significant KPI changes detected</p>
                                                    <p style={{ fontSize: "12px", color: "#94a3b8" }}>Try adjusting the date range or filters.</p>
                                                </div>
                                            ) : (
                                                /* ── CORRELATIONS TABLE ──────────────── */
                                                <div style={{ padding: "0" }}>
                                                    <div style={{
                                                        padding: "12px 24px", borderBottom: "1px solid #e2e8f0",
                                                        background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
                                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                                    }}>
                                                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e3a5f", letterSpacing: "0.02em" }}>
                                                            {filteredCorrelations.length} Anomalies Detected
                                                        </span>
                                                        <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 500 }}>
                                                            Comparing current vs previous period
                                                        </span>
                                                    </div>
                                                    <div style={{ overflowX: "auto" }}>
                                                        <style>{`
                                                            .corr-table th, .corr-table td { border-right: 1px solid #e2e8f0; }
                                                            .corr-table tbody tr:nth-child(even) { background-color: #f8fafc; }
                                                            .corr-table tbody tr:hover { background-color: #f0f4ff !important; }
                                                            .corr-table thead th {
                                                                background: #f1f5f9; font-weight: 600; letter-spacing: 0.03em;
                                                                position: sticky; top: 0; z-index: 20; box-shadow: 0 1px 0 #e2e8f0;
                                                            }
                                                        `}</style>
                                                        <table className="corr-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: "2px solid #cbd5e1" }}>
                                                                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" }}>Date Range</th>
                                                                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" }}>Platform</th>
                                                                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" }}>Category</th>
                                                                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" }}>Brand</th>
                                                                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" }}>SKU</th>
                                                                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" }}>Location</th>
                                                                    <th style={{ padding: "8px 12px", textAlign: "right", fontSize: "10px", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" }}>Sales</th>
                                                                    <th style={{ padding: "8px 12px", textAlign: "right", fontSize: "10px", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" }}>DRR</th>
                                                                    <th style={{ padding: "8px 12px", textAlign: "right", fontSize: "10px", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" }}>OSA</th>
                                                                    <th style={{ padding: "8px 12px", textAlign: "center", fontSize: "10px", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" }}>Trend</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {paginatedCorrelations.map((row, idx) => {
                                                                    const salesUp = (row.salesChange || 0) >= 0;
                                                                    const osaUp = (row.osaChange || 0) >= 0;
                                                                    return (
                                                                        <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                                                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                                                                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                                                        <span style={{ fontSize: "8px", fontWeight: 800, padding: "2px 4px", borderRadius: "3px", background: "#dbeafe", color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.03em" }}>Cur</span>
                                                                                        <span style={{ fontWeight: 600, color: "#1e293b", fontSize: "11px" }}>{row.dateRange || "-"}</span>
                                                                                         {row.size && (
                                                                                             <span style={{
                                                                                                 fontSize: "9px",
                                                                                                 fontWeight: 700,
                                                                                                 padding: "1.5px 5px",
                                                                                                 borderRadius: "4px",
                                                                                                 background: "rgba(99, 102, 241, 0.1)",
                                                                                                 color: "#6366f1",
                                                                                                 border: "1px solid rgba(99, 102, 241, 0.15)",
                                                                                                 textTransform: "lowercase",
                                                                                                 letterSpacing: "0.02em",
                                                                                                 marginLeft: "6.5px"
                                                                                             }}>
                                                                                                 {row.size}-day
                                                                                             </span>
                                                                                         )}
                                                                                    </div>
                                                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                                                        <span style={{ fontSize: "8px", fontWeight: 800, padding: "2px 4px", borderRadius: "3px", background: "#f1f5f9", color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em" }}>Prev</span>
                                                                                        <span style={{ color: "#64748b", fontSize: "10px", fontWeight: 500 }}>{row.prevRange || "-"}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: "10px 12px", color: "#374151" }}>{row.platform || "-"}</td>
                                                                            <td style={{ padding: "10px 12px", color: "#374151", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.category || "-"}</td>
                                                                            <td style={{ padding: "10px 12px", color: "#374151", fontWeight: 600 }}>{row.brand || "-"}</td>
                                                                            <td style={{ padding: "10px 12px", color: "#6b7280", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.sku || "-"}</td>
                                                                            <td style={{ padding: "10px 12px", color: "#374151" }}>{row.location || "-"}</td>
                                                                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                                                                    <span style={{ fontWeight: 700, color: "#1e293b" }}>
                                                                                        {row.sales != null ? formatINRCompact(row.sales) : "-"}
                                                                                    </span>
                                                                                    <span style={{
                                                                                        fontSize: "9px", fontWeight: 700,
                                                                                        color: salesUp ? "#16a34a" : "#dc2626",
                                                                                        display: "flex", alignItems: "center", gap: "2px",
                                                                                    }}>
                                                                                        {salesUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                                                                        {salesUp ? "+" : ""}{row.salesChange != null ? `${row.salesChange}%` : "-"}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                                                                    <span style={{ fontWeight: 700, color: "#1e293b" }}>
                                                                                        {row.drr != null ? formatUnitsCompact(row.drr) : "-"}
                                                                                    </span>
                                                                                    <span style={{ fontSize: "9px", color: "#64748b", fontWeight: 500 }}>
                                                                                        {row.size}d Avg
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                                                                    <span style={{ fontWeight: 700, color: "#1e293b" }}>
                                                                                        {row.osa != null ? `${row.osa.toFixed(1)}%` : "-"}
                                                                                    </span>
                                                                                    <span style={{ fontSize: "9px", color: "#64748b", fontWeight: 500 }}>
                                                                                        {row.prevOsa != null ? `Prev: ${row.prevOsa.toFixed(1)}%` : "-"}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                                                <button
                                                                                    onClick={() => handleTrendOpen(row)}
                                                                                    style={{
                                                                                        fontSize: "10px", fontWeight: 700,
                                                                                        padding: "5px 14px", borderRadius: "6px",
                                                                                        border: "1px solid rgba(99,102,241,0.3)",
                                                                                        background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                                                                                        color: "#4f46e5", cursor: "pointer",
                                                                                        display: "inline-flex", alignItems: "center", gap: "4px",
                                                                                        transition: "all 0.2s ease", whiteSpace: "nowrap",
                                                                                        textTransform: "uppercase", letterSpacing: "0.05em",
                                                                                    }}
                                                                                    onMouseEnter={(e) => {
                                                                                        e.currentTarget.style.background = "#e0e7ff";
                                                                                        e.currentTarget.style.transform = "translateY(-1px)";
                                                                                        e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(99,102,241,0.15)";
                                                                                    }}
                                                                                    onMouseLeave={(e) => {
                                                                                        e.currentTarget.style.background = "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)";
                                                                                        e.currentTarget.style.transform = "translateY(0)";
                                                                                        e.currentTarget.style.boxShadow = "none";
                                                                                    }}
                                                                                >
                                                                                    <Activity size={10} />
                                                                                    Trend
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    {/* ── PAGINATION CONTROLS ──────────────── */}
                                                    {totalCorrelationsPages > 1 && (
                                                        <div style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "space-between",
                                                            padding: "16px 24px",
                                                            borderTop: "1px solid #e2e8f0",
                                                            background: "#f8fafc",
                                                            borderBottomLeftRadius: "16px",
                                                            borderBottomRightRadius: "16px"
                                                        }}>
                                                            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                                                                Showing <span style={{ fontWeight: 600, color: "#1e293b" }}>{((correlationsPage - 1) * correlationsPerPage) + 1}</span> to{" "}
                                                                <span style={{ fontWeight: 600, color: "#1e293b" }}>
                                                                    {Math.min(correlationsPage * correlationsPerPage, filteredCorrelations.length)}
                                                                </span> of{" "}
                                                                <span style={{ fontWeight: 600, color: "#1e293b" }}>{filteredCorrelations.length}</span> rows
                                                            </div>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                                <button
                                                                    disabled={correlationsPage === 1}
                                                                    onClick={() => setCorrelationsPage(prev => Math.max(prev - 1, 1))}
                                                                    style={{
                                                                        padding: "6px 12px",
                                                                        borderRadius: "6px",
                                                                        border: "1px solid #e2e8f0",
                                                                        background: correlationsPage === 1 ? "#f1f5f9" : "#ffffff",
                                                                        color: correlationsPage === 1 ? "#94a3b8" : "#334155",
                                                                        fontSize: "11px",
                                                                        fontWeight: 600,
                                                                        cursor: correlationsPage === 1 ? "not-allowed" : "pointer",
                                                                        transition: "all 0.2s ease"
                                                                    }}
                                                                >
                                                                    Previous
                                                                </button>
                                                                
                                                                {Array.from({ length: totalCorrelationsPages }).map((_, i) => {
                                                                    const pageNum = i + 1;
                                                                    if (
                                                                        pageNum === 1 ||
                                                                        pageNum === totalCorrelationsPages ||
                                                                        (pageNum >= correlationsPage - 1 && pageNum <= correlationsPage + 1)
                                                                    ) {
                                                                        return (
                                                                            <button
                                                                                key={pageNum}
                                                                                onClick={() => setCorrelationsPage(pageNum)}
                                                                                style={{
                                                                                    width: "32px",
                                                                                    height: "32px",
                                                                                    display: "flex",
                                                                                    alignItems: "center",
                                                                                    justifyContent: "center",
                                                                                    borderRadius: "6px",
                                                                                    border: pageNum === correlationsPage ? "1px solid #6366f1" : "1px solid #e2e8f0",
                                                                                    background: pageNum === correlationsPage ? "#6366f1" : "#ffffff",
                                                                                    color: pageNum === correlationsPage ? "#ffffff" : "#334155",
                                                                                    fontSize: "11px",
                                                                                    fontWeight: 700,
                                                                                    cursor: "pointer",
                                                                                    transition: "all 0.2s ease"
                                                                                }}
                                                                            >
                                                                                {pageNum}
                                                                            </button>
                                                                        );
                                                                    }
                                                                    
                                                                    if (
                                                                        (pageNum === 2 && correlationsPage > 3) ||
                                                                        (pageNum === totalCorrelationsPages - 1 && correlationsPage < totalCorrelationsPages - 2)
                                                                    ) {
                                                                        return (
                                                                            <span key={pageNum} style={{ padding: "0 4px", color: "#94a3b8", fontSize: "11px" }}>
                                                                                ...
                                                                            </span>
                                                                        );
                                                                    }
                                                                    
                                                                    return null;
                                                                })}

                                                                <button
                                                                    disabled={correlationsPage === totalCorrelationsPages}
                                                                    onClick={() => setCorrelationsPage(prev => Math.min(prev + 1, totalCorrelationsPages))}
                                                                    style={{
                                                                        padding: "6px 12px",
                                                                        borderRadius: "6px",
                                                                        border: "1px solid #e2e8f0",
                                                                        background: correlationsPage === totalCorrelationsPages ? "#f1f5f9" : "#ffffff",
                                                                        color: correlationsPage === totalCorrelationsPages ? "#94a3b8" : "#334155",
                                                                        fontSize: "11px",
                                                                        fontWeight: 600,
                                                                        cursor: correlationsPage === totalCorrelationsPages ? "not-allowed" : "pointer",
                                                                        transition: "all 0.2s ease"
                                                                    }}
                                                                >
                                                                    Next
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Explanation Dialog / Popover ─────────────────────── */}
                <AnimatePresence>
                    {showCorrelationsInfo && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCorrelationsInfo(false)}
                            style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(15, 23, 42, 0.4)",
                                backdropFilter: "blur(4px)",
                                zIndex: 1100,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "20px"
                            }}
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 15 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 15 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    background: "#ffffff",
                                    borderRadius: "16px",
                                    padding: "28px",
                                    maxWidth: "600px",
                                    width: "100%",
                                    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
                                    border: "1px solid #f1f5f9",
                                    position: "relative"
                                }}
                            >
                                <button
                                    onClick={() => setShowCorrelationsInfo(false)}
                                    style={{
                                        position: "absolute",
                                        top: "20px",
                                        right: "20px",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        color: "#94a3b8"
                                    }}
                                >
                                    <X size={20} />
                                </button>

                                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                                    <div style={{
                                        width: "36px", height: "36px", borderRadius: "50%",
                                        background: "rgba(99, 102, 241, 0.1)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: "#6366f1"
                                    }}>
                                        <Info size={20} />
                                    </div>
                                    <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                                        Guide for Users
                                    </h3>
                                </div>

                                <div style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "16px" }}>
                                    <div>
                                        <h4 style={{ fontWeight: 700, color: "#0f172a", marginBottom: "6px", fontSize: "14px" }}>
                                            What We Are Showing on the Co-Relations Card
                                        </h4>
                                        <p style={{ margin: 0 }}>
                                            We show a list of granular combinations across <strong>Platform, Category, Brand, SKU, and Location</strong> that have experienced a sudden, major change (either a gain or drop) in one or more of their core KPIs:
                                        </p>
                                        <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
                                            <li><strong>Sales:</strong> Significant revenue increases or decreases exceeding ±15%.</li>
                                            <li><strong>OSA (On-Shelf Availability):</strong> Stock availability changes exceeding ±5 percentage points (pp).</li>
                                            <li><strong>Market Share & Search Rank:</strong> Tracked on the trend graph to analyze how availability and search prominence drive overall platform market performance.</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 style={{ fontWeight: 700, color: "#0f172a", marginBottom: "6px", fontSize: "14px" }}>
                                            How We Pick the Current Date Range
                                        </h4>
                                        <p style={{ margin: 0 }}>
                                            Rather than a fixed range, the backend dynamically evaluates multiple rolling candidate periods (including <strong>4-day, 7-day, 12-day, 18-day, 25-day, 30-day, and 40-day windows</strong>) across our database history.
                                            For each unique combination of Platform, Category, Brand, SKU, and Location, the system automatically selects the specific date range where the absolute change in Sales or OSA was the largest.
                                        </p>
                                    </div>

                                    <div>
                                        <h4 style={{ fontWeight: 700, color: "#0f172a", marginBottom: "6px", fontSize: "14px" }}>
                                            How We Pick the Compare Date Range
                                        </h4>
                                        <p style={{ margin: 0 }}>
                                            To ensure mathematically fair and accurate comparisons, the <strong>Compare (Previous)</strong> date range is chosen to match the exact same number of days as the <strong>Current</strong> date range, immediately preceding it.
                                            For example, if the current range is a 12-day period (e.g., <em>14th May to 25th May</em>), the compare range will be the preceding 12-day period (e.g., <em>2nd May to 13th May</em>).
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </CommonContainer>
    );
};

export default InsightsSignalHub;