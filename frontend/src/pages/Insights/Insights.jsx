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
    ChevronDown,
    Search,
    Filter,
    Signal,
    Package,
    ArrowRightLeft,
    MapPin,
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
import { fetchInsights, fetchInsightsFilters } from "@/api/insightsService";
import CustomHeaderDropdown from "@/components/CommonLayout/CustomHeaderDropdown";
import DateRangeComparePicker from "@/components/CommonLayout/DateRangeComparePicker";
import dayjs from "dayjs";
import { Typography, Divider, Skeleton } from "@mui/material";

// ─── HELPERS ────────────────────────────────────────────────────────────────

const formatINRCompact = (n) => {
    if (typeof n !== "number") return "N/A";
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
        metricLabel: "Opportunity Available", trend: "negative",
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
    "Remove Ad Low OSA": {
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
    "Surplus Stock": {
        family: "Supply Chain",
        color: "#6b5ea8", accent: "#eeebf8",
        FamilyIcon: Package, metricKey: "impactInr",
        metricLabel: "Excess Inventory Value", trend: "negative",
    },
    "Prioritise PO": {
        family: "Supply Chain",
        color: "#8a4a6b", accent: "#f5e8ef",
        FamilyIcon: Truck, metricKey: "impactInr",
        metricLabel: "Projected Sales Loss", trend: "negative",
    },
    "Transfer Issue": {
        family: "Supply Chain",
        color: "#5a7a4e", accent: "#ebf3e8",
        FamilyIcon: ArrowRightLeft, metricKey: "impactInr",
        metricLabel: "Projected Sales Loss", trend: "negative",
    },
    "New Market Entry": {
        family: "Competitive Landscape",
        color: "#4a6b8a", accent: "#e6eff6",
        FamilyIcon: MapPin, metricKey: "impactInr",
        metricLabel: "Competitor Revenue", trend: "negative",
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
        case "Replenishment Breaks":
            base.kpis = [{ label: "Fill rate", value: "0%" }, { label: "Missing PO", value: "0" }, { label: "Depot", value: "0" }];
            base.evidence = [{ depotOrDb: "-", city: "-", skuOrBrand: "-", plannedQty: 0, dispatchedQty: 0, fillRate: 0, poCreated: false, poNo: "-" }];
            break;
        case "Keyword Efficiency and Budget Caps":
            base.kpis = [{ label: "Waste keywords", value: "0" }, { label: "Best ACOS", value: "0%" }, { label: "Budget caps", value: "-" }];
            base.evidence = [{ keyword: "-", city: "-", campaign: "-", bid: 0, dailyBudget: 0, spend: 0, sales: 0, acos: 0, budgetCapped: false }];
            break;
        case "Surplus Stock":
            base.kpis = [{ label: "Avg DOI", value: "0 days" }, { label: "Affected SKUs", value: "0" }, { label: "Avg Discount", value: "0%" }];
            base.evidence = [{ skuName: "-", city: "-", platform: "-", excessInventory: 0, excessDOI: 0, currentDiscount: 0, excessInventoryValue: 0, openPOQty: 0 }];
            break;
        case "Prioritise PO":
            base.kpis = [{ label: "PSL", value: "₹0" }, { label: "Avg OSA", value: "0%" }, { label: "Critical SKUs", value: "0" }];
            base.evidence = [{ skuName: "-", city: "-", platform: "-", osa: 0, projectedSalesLoss: 0, poRaisedDate: "-", poStatus: "-" }];
            break;
        case "Transfer Issue":
            base.kpis = [{ label: "PSL", value: "₹0" }, { label: "Avg Backed DOI", value: "0 days" }, { label: "Cities", value: "0" }];
            base.evidence = [{ skuName: "-", city: "-", platform: "-", cpd: 0, backedDOI: 0, osa: 0, projectedSalesLoss: 0 }];
            break;
        case "New Market Entry":
            base.kpis = [{ label: "New SKUs", value: "0" }, { label: "Competitors", value: "0" }, { label: "Cities", value: "0" }];
            base.evidence = [{ skuName: "-", city: "-", platform: "-", category: "-", competitorName: "-", pfu: 0, firstSeenDate: "-" }];
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

const buildAISegments = (insight) => {
    const type = insight.type;
    const brand = insight.brandName || "Brand";
    const allEv = insight.evidence || [];
    const ev = allEv[0] || {};

    const city = (insight.city !== "-" && insight.city !== "Multi-city")
        ? insight.city
        : (ev.city && ev.city !== "-" ? ev.city : (insight.city !== "-" ? insight.city : "regions"));

    const category = (insight.category !== "-" && insight.category !== "Overall")
        ? insight.category
        : (ev.category && ev.category !== "-" ? ev.category : (insight.category !== "-" ? insight.category : "category"));

    const impact = B(formatINRCompact(insight.impactInr || 0));

    if (type === "Share Headroom Hotspots") {
        const d = diagnoseCause(allEv, insight.aiTrendData, brand);
        const threat = insight.aiTrendData?.topThreat;
        const topCity = ev.city || city;
        const compSku = ev.competitorSku && ev.competitorSku !== "-" ? ev.competitorSku : null;
        const ourSku = ev.myTopSku && ev.myTopSku !== "-" ? ev.myTopSku : null;

        return [
            {
                label: "What's Happening", priority: "high",
                text: threat?.brandName
                    ? `${B(threat.brandName)} gained ${B("+" + safePct(threat.shareChangePpt))} share in ${B(category)} (${B(topCity)}). ${B(brand)} losing ground.`
                    : `Share headroom in ${B(category)} across ${B(topCity)}.`
            },
            { label: "Root Cause", priority: "focus", text: d.text },
            {
                label: "SKU Impact", priority: "neutral",
                text: compSku
                    ? `${B(d.competitor)}'s hero: ${B("'" + compSku + "'")}${ourSku ? ` vs ${B(brand)}'s weak SKU: ${B("'" + ourSku + "'")}` : ""}.`
                    : ourSku ? `${B(brand)} weakest SKU: ${B("'" + ourSku + "'")}.` : `No SKU-level data available.`
            },
            {
                label: "Action", priority: "good",
                text: d.cause === "ad" ? `Increase bids on ${B(category)} keywords vs ${B(d.competitor)}. Recovery: ${impact}.`
                    : d.cause === "organic" ? `Improve SEO & listing quality vs ${B(d.competitor)}. Recovery: ${impact}.`
                        : d.cause === "osa" ? `Fix OSA in ${B(topCity)} before scaling ad spend. Recovery: ${impact}.`
                            : `Boost visibility in ${B(topCity)}. Recovery: ${impact}.`
            },
        ];
    }

    if (type === "Price Parity Radar") {
        const worst = allEv.reduce((w, e) => (Math.abs(e.gapPct || 0) > Math.abs(w.gapPct || 0) ? e : w), ev);
        const compSku = worst.compSku && worst.compSku !== "-" ? worst.compSku : "competitor";
        const ourSku = worst.impactedSku && worst.impactedSku !== "-" ? worst.impactedSku : null;
        const dir = (worst.gapPct || 0) > 0 ? "overpriced" : "underpriced";

        return [
            {
                label: "Pricing Alert", priority: "high",
                text: `${B(brand)} is ${B(dir)} by ${B(safePct(Math.abs(worst.gapPct || 0)))} for ${B(category)} vs ${B(compSku)} in ${B(worst.city || city)}.`
            },
            {
                label: "SKU Comparison", priority: "focus",
                text: `${B(compSku)} PPU at ${B("₹" + (typeof worst.compPpu === "number" ? worst.compPpu.toFixed(1) : worst.compPpu))}${ourSku ? ` → ${B(brand)} SKU ${B("'" + ourSku + "'")} at ${B("₹" + (typeof worst.ourPpu === "number" ? worst.ourPpu.toFixed(1) : worst.ourPpu))}` : `, ${B(brand)} at ${B("₹" + (typeof worst.ourPpu === "number" ? worst.ourPpu.toFixed(1) : worst.ourPpu))}`}.`
            },
            {
                label: "Revenue at Risk", priority: "good",
                text: `PSL from price gap: ${impact}. ${B(allEv.length.toString())} city-category combo(s) affected.`
            },
            {
                label: "Action", priority: "neutral",
                text: dir === "overpriced"
                    ? `Run markdown / bundle offer in ${B(worst.city || city)} to close gap vs ${B(compSku)}.`
                    : `Price advantage vs ${B(compSku)} — consider strategic price increase for margin.`
            },
        ];
    }

    if (type === "Competitor OSA Weak Spots") {
        const top3 = allEv.filter(e => e.skuOrBrand && e.skuOrBrand !== "-").slice(0, 3);
        return [
            {
                label: "Opportunity", priority: "high",
                text: `${B(ev.skuOrBrand || "Competitor")} OSA crashed to ${B(safePct(ev.otherBrandOsa))} in ${B(ev.category || category)}. ${B(brand)} healthy at ${B(safePct(ev.kwOsa))}.`
            },
            {
                label: "Weak Competitors", priority: "focus",
                text: top3.map(e => `${B(e.skuOrBrand)}: ${B(safePct(e.otherBrandOsa))} OSA (${e.city || city})`).join(" · ") || `Below threshold in ${B(city)}.`
            },
            {
                label: "Upside", priority: "good",
                text: `${impact} revenue if ${B(brand)} captures share across ${B(allEv.length.toString())} hotspot(s).`
            },
            {
                label: "Action", priority: "neutral",
                text: `Boost ${B(brand)} sponsored placements in ${B(ev.city || city)} while ${B(ev.skuOrBrand || "competitor")} is OOS.`
            },
        ];
    }

    if (type === "Remove Ad Low OSA") {
        const totalSpend = allEv.reduce((s, e) => s + (e.spendInr || 0), 0);
        const totalLoss = allEv.reduce((s, e) => s + (e.estLostSalesInr || 0), 0);
        return [
            {
                label: "Wasted Spend", priority: "high",
                text: `${B("₹" + totalSpend.toLocaleString("en-IN"))} ad spend on SKUs with ${B(safePct(ev.kwOsa))} OSA. Worst: ${B("'" + (ev.skuOrBrand || brand) + "'")} in ${B(ev.city || city)}.`
            },
            {
                label: "Affected SKUs", priority: "focus",
                text: allEv.filter(e => e.skuOrBrand && e.skuOrBrand !== "-").slice(0, 3)
                    .map(e => `${B(e.skuOrBrand)} (${e.city || city}) — OSA ${B(safePct(e.kwOsa))}`).join(" · ") || `OSA-ad mismatch in ${B(city)}.`
            },
            {
                label: "Est. Loss", priority: "good",
                text: `${B(formatINRCompact(totalLoss))} lost sales from ad→OOS leakage.`
            },
            {
                label: "Action", priority: "neutral",
                text: `Pause campaigns for ${B("'" + (ev.skuOrBrand || brand) + "'")} in ${B(ev.city || city)} until restocked. Redirect to OSA >80% SKUs.`
            },
        ];
    }

    if (type === "Keyword Efficiency and Budget Caps") {
        const totalWaste = allEv.reduce((s, e) => s + (e.spend || 0), 0);
        const cappedCount = allEv.filter(e => e.budgetCapped).length;
        return [
            {
                label: "Efficiency Alert", priority: "high",
                text: `${B(allEv.length.toString())} keywords bleeding ${B("₹" + totalWaste.toLocaleString("en-IN"))}. Top offender: ${B("'" + (ev.keyword || "-") + "'")} on ${B(ev.platform || "-")} at ${B(safePct(ev.acos))} ACOS.`
            },
            {
                label: "Worst Keywords", priority: "focus",
                text: allEv.filter(e => e.keyword && e.keyword !== "-").slice(0, 3)
                    .map(e => `${B(e.keyword)} (${e.platform || "-"}) — ACOS ${B(safePct(e.acos))}`).join(" · ") || `Underperforming in ${B(city)}.`
            },
            {
                label: "Budget Impact", priority: "good",
                text: `${impact} at risk.${cappedCount > 0 ? ` ${B(cappedCount.toString())} keyword(s) budget-capped.` : ""}`
            },
            {
                label: "Action", priority: "neutral",
                text: cappedCount > 0
                    ? `Uncap high-ROAS keywords, pause ${B("'" + (ev.keyword || "underperformers") + "'")}.`
                    : `Lower bids on ${B("'" + (ev.keyword || "poor performers") + "'")}. Target ACOS <15%.`
            },
        ];
    }

    if (type === "Replenishment Breaks") {
        const noPoCount = allEv.filter(e => e.poCreated === false).length;
        return [
            {
                label: "Stockout Risk", priority: "high",
                text: `${B("'" + (ev.skuOrBrand || brand) + "'")} in ${B(ev.city || city)}: fill rate ${B(safePct(ev.fillRate))}.${noPoCount > 0 ? ` ${B(noPoCount.toString())} SKU(s) have **no active PO**.` : ""}`
            },
            {
                label: "Affected SKUs", priority: "focus",
                text: allEv.filter(e => e.skuOrBrand && e.skuOrBrand !== "-").slice(0, 3)
                    .map(e => `${B(e.skuOrBrand)} (${e.city || city}) — ${B(safePct(e.fillRate))} fill`).join(" · ") || `Supply issues in ${B(city)}.`
            },
            {
                label: "Sales at Risk", priority: "good",
                text: `${impact} revenue loss. ${B(allEv.length.toString())} SKU(s) below 80% fill rate.`
            },
            {
                label: "Action", priority: "neutral",
                text: noPoCount > 0
                    ? `Create emergency POs for ${B(noPoCount.toString())} SKU(s). Prioritize ${B("'" + (ev.skuOrBrand || brand) + "'")} in ${B(ev.city || city)}.`
                    : `Escalate dispatch at ${B(ev.depotOrDb || "local DC")}. Prioritize ${B("'" + (ev.skuOrBrand || brand) + "'")}.`
            },
        ];
    }


    if (type === "Surplus Stock") {
        const totalValue = allEv.reduce((s, e) => s + (e.excessInventoryValue || 0), 0);
        return [
            {
                label: "Surplus Alert", priority: "high",
                text: `${B(allEv.length.toString())} SKUs carrying ${B(formatINRCompact(totalValue))} excess inventory. Worst: ${B("'" + (ev.skuName || brand) + "'")} in ${B(ev.city || city)} with ${B((ev.excessDOI || 0).toFixed(0))} days DOI.`
            },
            {
                label: "Slow Movers", priority: "focus",
                text: allEv.filter(e => e.skuName && e.skuName !== "-").slice(0, 3)
                    .map(e => `${B(e.skuName)} (${e.city || city}) — ${B((e.excessDOI || 0).toFixed(0))} days DOI`).join(" · ") || `Excess stock in ${B(city)}.`
            },
            {
                label: "Discount Gap", priority: "good",
                text: `Current avg discount: ${B(safePct(ev.currentDiscount))}. ${(ev.currentDiscount || 0) < 10 ? `Consider deeper markdowns to clear stock.` : `Discount already active but DOI still high.`}`
            },
            {
                label: "Action", priority: "neutral",
                text: `Clear surplus via bundle offers / flash sales for ${B("'" + (ev.skuName || brand) + "'")} in ${B(ev.city || city)}. Halt new POs until DOI normalises.`
            },
        ];
    }

    if (type === "Prioritise PO") {
        const totalPSL = allEv.reduce((s, e) => s + (e.projectedSalesLoss || 0), 0);
        const criticalCount = allEv.filter(e => e.poStatus === "Critical" || e.poStatus === "High").length;
        return [
            {
                label: "PO Urgency", priority: "high",
                text: `${B(criticalCount.toString())} critical SKUs need urgent PO. ${B("'" + (ev.skuName || brand) + "'")} in ${B(ev.city || city)} at ${B(safePct(ev.osa))} OSA — PSL: ${B(formatINRCompact(ev.projectedSalesLoss || 0))}.`
            },
            {
                label: "Top PO Needs", priority: "focus",
                text: allEv.filter(e => e.skuName && e.skuName !== "-").slice(0, 3)
                    .map(e => `${B(e.skuName)} (${e.city || city}) — OSA ${B(safePct(e.osa))} [${e.poStatus}]`).join(" · ") || `PO needed in ${B(city)}.`
            },
            {
                label: "Revenue at Risk", priority: "good",
                text: `Combined PSL: ${B(formatINRCompact(totalPSL))} across ${B(allEv.length.toString())} SKU(s).`
            },
            {
                label: "Action", priority: "neutral",
                text: `Raise emergency PO for ${B("'" + (ev.skuName || brand) + "'")}. Prioritise ${B(ev.city || city)} warehouse — OSA at ${B(safePct(ev.osa))}.`
            },
        ];
    }

    if (type === "Transfer Issue") {
        const totalPSL = allEv.reduce((s, e) => s + (e.projectedSalesLoss || 0), 0);
        const uniqueCities = new Set(allEv.map(e => e.city).filter(Boolean)).size;
        return [
            {
                label: "Transfer Alert", priority: "high",
                text: `${B("'" + (ev.skuName || brand) + "'")} in ${B(ev.city || city)} has only ${B((ev.backedDOI || 0).toFixed(1))} days backed DOI with ${B((ev.cpd || 0).toFixed(1))} units/day demand.`
            },
            {
                label: "Affected SKUs", priority: "focus",
                text: allEv.filter(e => e.skuName && e.skuName !== "-").slice(0, 3)
                    .map(e => `${B(e.skuName)} (${e.city || city}) — ${B((e.backedDOI || 0).toFixed(1))} days DOI`).join(" · ") || `Supply gaps in ${B(city)}.`
            },
            {
                label: "PSL Impact", priority: "good",
                text: `${B(formatINRCompact(totalPSL))} across ${B(uniqueCities.toString())} cities. Inter-warehouse transfer can recover this.`
            },
            {
                label: "Action", priority: "neutral",
                text: `Initiate stock transfer to ${B(ev.city || city)}. CPD of ${B((ev.cpd || 0).toFixed(1))} requires immediate replenishment.`
            },
        ];
    }

    if (type === "New Market Entry") {
        const uniqueCompetitors = new Set(allEv.map(e => e.competitorName).filter(Boolean)).size;
        const uniqueCities = new Set(allEv.map(e => e.city).filter(Boolean)).size;
        return [
            {
                label: "New Entrant", priority: "high",
                text: `${B(ev.competitorName || "Competitor")} entered ${B(ev.category || category)} in ${B(ev.city || city)} — PFU ${B("₹" + (ev.pfu || "-"))}, first seen ${B(ev.firstSeenDate || "-")}.`
            },
            {
                label: "Market Expansion", priority: "focus",
                text: `${B(uniqueCompetitors.toString())} competitor(s) expanding across ${B(uniqueCities.toString())} cities: ` +
                    (allEv.filter(e => e.competitorName && e.competitorName !== "-").slice(0, 3)
                        .map(e => `${B(e.competitorName)} in ${e.city || city}`).join(" · ") || `New entries detected.`)
            },
            {
                label: "Threat Assessment", priority: "good",
                text: `${B(allEv.length.toString())} new SKU(s) detected.${ev.pfu && ev.pfu < 300 ? ` Aggressive pricing at ${B("₹" + ev.pfu)}.` : ` Premium segment entry.`}`
            },
            {
                label: "Action", priority: "neutral",
                text: `Monitor ${B(ev.competitorName || "new entrant")} in ${B(ev.city || city)}. Strengthen ${B(brand)} presence in ${B(ev.category || category)} with counter-promotions.`
            },
        ];
    }

    return [
        { label: "Signal", priority: "high", text: insight.whatWeSee?.[1] || "Deviation detected." },
        { label: "Details", priority: "focus", text: insight.whatWeSee?.[0] || "Notable deviation found." },
        { label: "Impact", priority: "good", text: `${impact} opportunity.` },
        { label: "Action", priority: "neutral", text: `Review strategies in ${B(city)}.` },
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

const LiveBadge = () => (
    <span 
        className="status-pulse-green"
        style={{
            fontSize: "8.5px",
            fontWeight: 800,
            letterSpacing: "0.05em",
            background: "#10b981",
            color: "#fff",
            borderRadius: "5px",
            padding: "2.5px 8px",
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


const SignalStatusBadge = ({ isEmpty }) => (
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
    ) : <LiveBadge />
);


// ─── AI INSIGHTS PANEL ───────────────────────────────────────────────────────

const AIInsightsPanel = ({ insight, onClose }) => {
    const [phase, setPhase] = useState("loading");
    const [visibleCount, setVisibleCount] = useState(0);
    const segments = useMemo(() => buildAISegments(insight), [insight]);

    useEffect(() => {
        setPhase("loading"); setVisibleCount(0);
        const t = setTimeout(() => setPhase("reveal"), 1000);
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
                            AI Summary <BetaBadge size="xs" />
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
                                transition={{ type: "spring", stiffness: 400, damping: 40, delay: idx * 0.05 }}
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

const OverviewSignalCard = ({ insight, isSelected, onClick }) => {
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
            { key: "brandOsa", label: `${insight.brandName || "Brand"} OSA`, fmt: (v, r) => v != null ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{safePct(v)}</span>
                    <span style={{ fontSize: '10px', color: (r.brandOsaDelta || 0) < 0 ? '#ef4444' : '#10b981' }}>
                        {(r.brandOsaDelta || 0) >= 0 ? "+" : ""}{(r.brandOsaDelta || 0).toFixed(1)}%
                    </span>
                </div>
            ) : "-" },
            { key: "marketShare", label: "Mkt Share", fmt: (v, r) => v != null ? `${safePct(v)} (${r.marketShareMoM >= 0 ? "+" : ""}${safePct(r.marketShareMoM)})` : "-" },
            { key: "offtake", label: "Offtake", fmt: (v, r) => v != null ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{safeINR(v)}</span>
                    <span style={{ fontSize: '10px', color: (r.offtakeDelta || 0) < 0 ? '#ef4444' : '#10b981' }}>
                        {(r.offtakeDelta || 0) >= 0 ? "+" : ""}{safeINR(r.offtakeDelta)} ({(r.offtakeMoM || 0) >= 0 ? "+" : ""}{safePct(r.offtakeMoM)})
                    </span>
                </div>
            ) : "-" },
            { key: "possibleCause", label: "Cause", isText: true },
        ];
        if (t === "Competitor OSA Weak Spots") return [
            { key: "category", label: "Category", fmt: (v, r) => v || insight.category || "-" },
            { key: "platform", label: "Platform", fmt: (v) => v || "-" },
            { key: "city", label: "City" },
            { key: "skuOrBrand", label: "Competitor", isText: true },
            { key: "otherBrandOsa", label: "Comp OSA", fmt: (v, r) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{safePct(v)}</span>
                    <span style={{ fontSize: '10px', color: (r.otherBrandOsaChangePct || 0) < 0 ? '#ef4444' : '#10b981' }}>
                        {(r.otherBrandOsaChangePct || 0) >= 0 ? "+" : ""}{(r.otherBrandOsaChangePct || 0).toFixed(1)}%
                    </span>
                </div>
            ) },
            { key: "otherBrandMkShare", label: "Comp MK Share", fmt: safePct },
            { key: "kwOsa", label: `${insight.brandName || "Brand"} OSA`, fmt: safePct },
            { key: "gapPct", label: "Gap %", fmt: (v) => <span style={{ color: (v || 0) < 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{safePct(v)}</span> },
            { key: "ourBrandMkShare", label: `${insight.brandName || "Brand"} Mkt Share`, fmt: safePct },
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
        if (t === "Replenishment Breaks") return [
            { key: "category", label: "Category", fmt: (v, r) => v || insight.category || "-" },
            { key: "city", label: "City" },
            { key: "fillRate", label: "Fill Rate", fmt: (v, r) => `${safePct(v)} (${r.fillRateChangePct > 0 ? '+' : ''}${safePct(r.fillRateChangePct)})` },
            { key: "plannedQty", label: "Planned" },
            { key: "skuOrBrand", label: "SKU", isText: true },
        ];
        if (t === "Surplus Stock") return [
            { key: "skuName", label: "SKU Name", isText: true },
            { key: "city", label: "Warehouse / City" },
            { key: "excessInventory", label: "Excess Inv", fmt: (v) => `${Number(v || 0).toLocaleString('en-IN')} units` },
            { key: "excessDOI", label: "Excess DOI", fmt: (v) => `${Number(v || 0).toFixed(0)} days` },
            { key: "currentDiscount", label: "Discount %", fmt: safePct },
            { key: "openPOQty", label: "Open PO Qty", fmt: (v) => Number(v || 0).toLocaleString('en-IN') },
        ];
        if (t === "Prioritise PO") return [
            { key: "skuName", label: "SKU Name", isText: true },
            { key: "city", label: "Facility / City" },
            { key: "osa", label: "OSA %", fmt: safePct },
            { key: "projectedSalesLoss", label: "Projected Sales Loss", fmt: safeINR },
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
                    borderRadius: "10px",
                    border: "none",
                    cursor: "pointer",
                    overflow: "hidden",
                    position: "relative",
                    background: "#ffffff",
                    outline: "none",
                    WebkitTapHighlightColor: "transparent",
                    boxShadow: isSelected 
                        ? `0 10px 25px -5px ${isEmpty ? "rgba(148,163,184,0.15)" : color + "26"}, 0 8px 10px -6px ${isEmpty ? "rgba(148,163,184,0.1)" : color + "1a"}`
                        : hovered
                            ? "0 12px 20px -5px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)"
                            : "0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)",
                    transition: "all 0.2s ease",
                    transform: hovered ? "translateY(-6px)" : "translateY(0px)",
                }}
            >
                {/* Top Badge Row */}
                <div style={{ 
                    padding: "10px 14px 4px", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between" 
                }}>
                    <SignalStatusBadge isEmpty={isEmpty} />
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {!isEmpty && <BetaBadge size="xs" />}
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
                        background: isEmpty 
                            ? "#f1f5f9" 
                            : (isNegative ? "#fef2f2" : "#f0fdf4"),
                        border: `1px solid ${isEmpty ? "#e2e8f0" : (isNegative ? "#fee2e2" : "#dcfce7")}`,
                    }}>
                        <span style={{
                            fontSize: "16px", fontWeight: 900,
                            color: isEmpty ? "#94a3b8" : (isNegative ? "#dc2626" : "#16a34a"),
                            letterSpacing: "-0.01em"
                        }}>
                            {isEmpty ? "—" : formatINRCompact(insight.impactInr || 0)}
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
    const [visibleCount, setVisibleCount] = useState(0);

    const rowInsight = useMemo(() => ({
        ...insight,
        evidence: [rowData]
    }), [insight, rowData]);

    const segments = useMemo(() => buildAISegments(rowInsight), [rowInsight]);

    useEffect(() => {
        setPhase("loading"); setVisibleCount(0);
        const t = setTimeout(() => setPhase("reveal"), 600);
        return () => clearTimeout(t);
    }, [rowInsight?.id]);

    useEffect(() => {
        if (phase !== "reveal") return;
        if (visibleCount >= Math.min(segments.length, 2)) return;
        const t = setTimeout(() => setVisibleCount((c) => c + 1), 220);
        return () => clearTimeout(t);
    }, [phase, visibleCount, segments.length]);

    const miniSegs = segments.slice(0, 2);

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
                        <Loader2 size={18} style={{ animation: "spin 2s linear infinite", color: "#6366f1" }} />
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500, letterSpacing: "0.02em" }}>
                            Running diagnostic analysis...
                        </span>
                    </div>
                ) : (
                    miniSegs.map((seg, idx) => (
                        <motion.div key={idx}
                            initial={{ opacity: 0, y: 5 }}
                            animate={idx < visibleCount ? { opacity: 1, y: 0 } : { opacity: 0, y: 5 }}
                            transition={{ duration: 0.4, delay: idx * 0.15 }}
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
                            onClick={(e) => { e.stopPropagation(); }}
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
                    <PopoverContent className="p-0 border-none bg-transparent shadow-none w-auto" side="bottom" align="start" sideOffset={8}>
                        <AnimatePresence>
                            {isOpen && (
                                <RowAIPopup 
                                    insight={insight} 
                                    rowData={rowData} 
                                    onClose={() => setActivePopupIdx(null)} 
                                />
                            )}
                        </AnimatePresence>
                    </PopoverContent>
                </Popover>
            </div>
        </TableCell>
    );
};


// ─── EVIDENCE TABLE ───────────────────────────────────────────────────────────

const getEvidenceView = (type) => {
    if (type === "Replenishment Breaks") return "supply";
    if (type === "Keyword Efficiency and Budget Caps") return "keyword";
    if (type === "Price Parity Radar") return "pricing";
    if (type === "Share Headroom Hotspots") return "share";

    if (type === "Remove Ad Low OSA") return "adStock";
    if (type === "Surplus Stock") return "surplus";
    if (type === "Prioritise PO") return "prioritisePO";
    if (type === "Transfer Issue") return "transferIssue";
    if (type === "New Market Entry") return "newMarket";
    return "osa";
};

const EvidenceTable = ({ insight, activePlatform }) => {
    const view = getEvidenceView(insight.type);
    const [search, setSearch] = useState("");
    const [activePopupIdx, setActivePopupIdx] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState("All");

    const categories = useMemo(() => {
        const cats = new Set();
        (insight.evidence || []).forEach(e => {
            if (e.category && e.category !== "-") cats.add(e.category);
        });
        return ["All", ...Array.from(cats)];
    }, [insight.evidence]);

    const filtered = useMemo(() => {
        let data = insight.evidence || [];
        if (activePlatform && activePlatform !== "-" && activePlatform !== "All platforms") {
            data = data.filter((e) => !e.platform || e.platform === activePlatform || e.platform === "-");
        }

        if (view === "share" && categoryFilter !== "All") {
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
    }, [insight.evidence, search, activePlatform, insight.type, categoryFilter, view]);

    return (
        <div style={{
            display: "flex", flexDirection: "column", height: "100%",
            background: "#fff", border: "2px solid #e2e8f0", borderRadius: "8px", overflow: "hidden",
            outline: "none",
        }}>
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderBottom: "1px solid #e2e8f0",
                background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
            }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e3a5f", letterSpacing: "0.02em" }}>
                    Evidence Data
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {view === "share" && categories.length > 1 && (
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            style={{
                                padding: "6px 28px 6px 12px",
                                fontSize: "11px",
                                fontWeight: 600,
                                color: categoryFilter !== "All" ? "#ffffff" : "#475569",
                                background: categoryFilter !== "All" ? "#0f172a" : "#ffffff",
                                border: categoryFilter !== "All" ? "1px solid #0f172a" : "1px solid #e2e8f0",
                                borderRadius: "8px",
                                outline: "none",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                appearance: "none",
                                backgroundPosition: "right 8px center",
                                backgroundRepeat: "no-repeat",
                                backgroundSize: "10px",
                                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${categoryFilter !== "All" ? "%23ffffff" : "%23475569"}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`
                            }}
                        >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}
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
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Comp OSA</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Comp MK Share</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} OSA</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Gap %</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} Mkt Share</TableHead>
                            </>)}
                            {view === "share" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">City</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">{insight.brandName} OSA</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Mkt Share</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">PSL</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Offtake</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Top SKU</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Comp SKU</TableHead>
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
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">GAP %</TableHead>
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
                            {view === "supply" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Category</TableHead>
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
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Warehouse / City</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Excess Inventory</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Excess DOI (days)</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Current Discount %</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Open PO Qty</TableHead>
                            </>)}
                            {view === "prioritisePO" && (<>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">SKU Name</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Platform</TableHead>
                                <TableHead className="text-[10px] uppercase text-slate-500 h-8 px-3">Facility / City</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">OSA %</TableHead>
                                <TableHead className="text-right text-[10px] uppercase text-slate-500 h-8 px-3">Projected Sales Loss</TableHead>
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
                            filtered.map((d, idx) => {
                                return (
                                    <React.Fragment key={idx}>
                                        <TableRow style={{ borderBottom: "1px solid #f1f5f9" }} className="hover:bg-blue-50/30 transition-colors">
                                            {view === "osa" && (
                                                <>
                                                    <CategoryCell category={d.category || insight.category || "-"} rowIdx={idx} activePopupIdx={activePopupIdx} setActivePopupIdx={setActivePopupIdx} insight={insight} rowData={d} totalCount={filtered.length} />
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.skuOrBrand ?? "-"}</TableCell>
                                                    <TableCell className="text-right px-3 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[11px] font-medium text-red-600">{safePct(d.otherBrandOsa)}</span>
                                                            <span className={`text-[10px] mt-0.5 ${(d.otherBrandOsaChangePct || 0) < 0 ? "text-red-500" : "text-emerald-500"}`}>
                                                                {(d.otherBrandOsaChangePct || 0) >= 0 ? '+' : ''}{(d.otherBrandOsaChangePct || 0).toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-red-600 px-3 py-3">{safePct(d.otherBrandMkShare)}</TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-blue-600 px-3 py-3">{safePct(d.kwOsa)}</TableCell>
                                                    <TableCell className="text-right text-[11px] font-semibold text-emerald-600 px-3 py-3">{safePct(d.gapPct)}</TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-blue-600 px-3 py-3">{safePct(d.ourBrandMkShare)}</TableCell>
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
                                                    <TableCell className="px-3 py-3"><span className="text-[11px] text-slate-800 truncate max-w-[120px] block">{d.myTopSku || "-"}</span></TableCell>
                                                    <TableCell className="px-3 py-3"><span className="text-[11px] text-slate-800 truncate max-w-[120px] block">{d.competitorSku || "-"}</span></TableCell>
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
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">
                                                        <span className="truncate max-w-[160px] block">{d.impactedSku || '-'}</span>
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">
                                                        <span className="truncate max-w-[160px] block">{d.compSku || '-'}</span>
                                                    </TableCell>
                                                    <TableCell className={`text-right text-[11px] font-medium px-3 py-3 ${d.gapPct > 0 ? 'text-red-600' : d.gapPct < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>{safePct(d.gapPct)}</TableCell>
                                                </>
                                            )}
                                            {view === "adStock" && (
                                                <>
                                                    <TableCell className="px-3 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <img 
                                                                src={d.imageUrl || `https://placehold.co/40x40/f1f5f9/94a3b8?text=${encodeURIComponent((d.skuOrBrand || '?')[0])}`} 
                                                                alt={d.skuOrBrand} 
                                                                className="w-10 h-10 rounded-md border border-slate-200 object-cover cursor-pointer hover:ring-2 hover:ring-blue-400 hover:shadow-lg transition-all duration-200" 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (d.imageUrl) setPreviewImage({ url: d.imageUrl, name: d.skuOrBrand, platform: d.platform, city: d.city });
                                                                }}
                                                                onError={(e) => { e.target.src = `https://placehold.co/40x40/f1f5f9/94a3b8?text=${encodeURIComponent((d.skuOrBrand || '?')[0])}`; }}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-semibold text-slate-800">{d.skuOrBrand}</span>
                                                                <div className="flex gap-2 text-[9px] text-slate-500 mt-1">
                                                                    {d.sharePct != null && <span className="bg-slate-100 px-1 py-0.5 rounded">{safePct(d.sharePct)}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
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
                                            {view === "supply" && (
                                                <>
                                                    <CategoryCell category={d.category ?? insight.category ?? "-"} rowIdx={idx} activePopupIdx={activePopupIdx} setActivePopupIdx={setActivePopupIdx} insight={insight} rowData={d} totalCount={filtered.length} />
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform ?? "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.depotOrDb}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.skuOrBrand}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-500 px-3 py-3">{d.plannedQty}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">{d.dispatchedQty}</TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-red-600 px-3 py-3">{safePct(d.fillRate)}</TableCell>
                                                    <TableCell className="text-right px-3 py-3">
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
                                                    <TableCell className="px-3 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-semibold text-slate-800">{d.skuName}</span>
                                                            <span className="text-[9px] text-slate-500 mt-0.5">{d.brandName || '-'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city || "-"}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">
                                                        {Number(d.excessInventory || 0).toLocaleString('en-IN')} units
                                                        {d.inventoryChange !== 0 && (
                                                            <span className={`ml-1 text-[10px] ${d.inventoryChange > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                ({d.inventoryChange > 0 ? '+' : ''}{Number(d.inventoryChange || 0).toLocaleString('en-IN')})
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-amber-600 px-3 py-3">
                                                        {Number(d.excessDOI || 0).toFixed(0)} days
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">
                                                        {safePct(d.currentDiscount)}
                                                        {d.discountChange !== 0 && (
                                                            <span className={`ml-1 text-[10px] ${d.discountChange > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                ({d.discountChange > 0 ? '+' : ''}{Number(d.discountChange || 0).toFixed(1)}%)
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-500 px-3 py-3">
                                                        {Number(d.openPOQty || 0).toLocaleString('en-IN')}
                                                    </TableCell>
                                                </>
                                            )}
                                            {view === "prioritisePO" && (
                                                <>
                                                    <TableCell className="px-3 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-semibold text-slate-800">{d.skuName}</span>
                                                            <span className="text-[9px] text-slate-500 mt-0.5">{d.brandName || '-'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.platform || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city || "-"}</TableCell>
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
                                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                                            d.poStatus === 'Critical' ? 'bg-red-100 text-red-700' :
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
                                                    <TableCell className="px-3 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-semibold text-slate-800">{d.skuName}</span>
                                                            <span className="text-[9px] text-slate-500 mt-0.5">{d.brandName || '-'}</span>
                                                        </div>
                                                    </TableCell>
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
                                                    <TableCell className="px-3 py-3">
                                                        <span className="text-[11px] font-semibold text-slate-800">{d.skuName}</span>
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.category || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3 font-medium">{d.competitorName || "-"}</TableCell>
                                                    <TableCell className="text-right text-[11px] text-slate-800 px-3 py-3">₹{Number(d.pfu || 0).toLocaleString('en-IN')}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-500 px-3 py-3">{d.firstSeenDate || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-800 px-3 py-3">{d.city || "-"}</TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    </React.Fragment>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
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
                            background: "rgba(0, 0, 0, 0.6)",
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
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
                                borderRadius: "20px",
                                padding: "0",
                                boxShadow: "0 40px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.15)",
                                maxWidth: "480px",
                                width: "90vw",
                                overflow: "hidden",
                                cursor: "default",
                            }}
                        >
                            {/* Image Container */}
                            <div style={{
                                position: "relative",
                                background: "linear-gradient(145deg, #f8fafc, #f1f5f9)",
                                padding: "32px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: "320px",
                            }}>
                                <img
                                    src={previewImage.url}
                                    alt={previewImage.name}
                                    style={{
                                        maxWidth: "100%",
                                        maxHeight: "320px",
                                        objectFit: "contain",
                                        borderRadius: "12px",
                                        filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.1))",
                                    }}
                                    onError={(e) => { e.target.src = `https://placehold.co/300x300/f1f5f9/94a3b8?text=Image+Not+Found`; }}
                                />
                                {/* Close button */}
                                <button
                                    onClick={() => setPreviewImage(null)}
                                    style={{
                                        position: "absolute",
                                        top: "12px",
                                        right: "12px",
                                        width: "32px",
                                        height: "32px",
                                        borderRadius: "50%",
                                        background: "rgba(255,255,255,0.9)",
                                        backdropFilter: "blur(8px)",
                                        border: "1px solid rgba(226,232,240,0.8)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                        transition: "all 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                                        e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.9)";
                                        e.currentTarget.style.borderColor = "rgba(226,232,240,0.8)";
                                    }}
                                >
                                    <X size={14} color="#64748b" />
                                </button>
                            </div>
                            {/* Product Info Footer */}
                            <div style={{
                                padding: "16px 24px 20px",
                                borderTop: "1px solid #f1f5f9",
                            }}>
                                <h3 style={{
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: "#0f172a",
                                    margin: "0 0 8px 0",
                                    lineHeight: 1.4,
                                    letterSpacing: "-0.01em",
                                }}>
                                    {previewImage.name}
                                </h3>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {previewImage.platform && (
                                        <span style={{
                                            fontSize: "10px",
                                            fontWeight: 600,
                                            color: "#3b82f6",
                                            background: "#eff6ff",
                                            border: "1px solid #dbeafe",
                                            padding: "3px 10px",
                                            borderRadius: "20px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.04em",
                                        }}>
                                            {previewImage.platform}
                                        </span>
                                    )}
                                    {previewImage.city && (
                                        <span style={{
                                            fontSize: "10px",
                                            fontWeight: 600,
                                            color: "#64748b",
                                            background: "#f8fafc",
                                            border: "1px solid #e2e8f0",
                                            padding: "3px 10px",
                                            borderRadius: "20px",
                                            letterSpacing: "0.04em",
                                        }}>
                                            {previewImage.city}
                                        </span>
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

const DynamicInsightsBar = ({ insight }) => {
    const [isOpen, setIsOpen] = useState(false);

    const getInsightsText = () => {
        if (insight?.type === "Remove Ad Low OSA") {
            if (!insight?.evidence?.length || insight.evidence[0].skuOrBrand === "-") {
                return [{ label: "Alert", text: "No low OSA ad data available." }];
            }
            const offenders = [...insight.evidence].sort((a, b) => {
                const mismatchA = (a.adSov || 0) - (a.kwOsa || 0);
                const mismatchB = (b.adSov || 0) - (b.kwOsa || 0);
                return mismatchB - mismatchA; 
            });
            const top1 = offenders[0];
            const top2 = offenders[1];
            
            const arr = [];
            arr.push({ label: "Observation", text: `Spending high Ad SOV (${(top1.adSov || 0).toFixed(1)}%) for "${top1.skuOrBrand}" in ${top1.city} while availability is only ${(top1.kwOsa || 0).toFixed(1)}%.` });
            
            if (top2 && ((top2.adSov || 0) - (top2.kwOsa || 0) > 0)) {
                 arr.push({ label: "Similarly", text: `"${top2.skuOrBrand}" in ${top2.city} has ${(top2.adSov || 0).toFixed(1)}% Ad SOV despite ${(top2.kwOsa || 0).toFixed(1)}% OSA.` });
            }
            arr.push({ label: "Action", text: `For ${insight.brandName || "Brand"}: Pause active campaigns for low OSA products and dynamically redirect ad spends towards well-stocked SKUs.` });
            return arr;
        }
        
        // For all other signals, use the central generator
        return buildAISegments(insight);
    };

    const segments = getInsightsText();

    return (
        <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{ 
                    width: "100%", 
                    background: "linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)", /* Matches exact filter button gradient */
                    color: "white",
                    padding: "10px 16px", 
                    borderRadius: isOpen ? "8px 8px 0 0" : "8px",
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: "0 2px 8px rgba(37,99,235,0.2)"
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Sparkles size={14} color="#fff" />
                    <span style={{ fontSize: "13px", fontWeight: "600", letterSpacing: "0.02em" }}>AI Insights</span>
                </div>
                <motion.div 
                    animate={{ y: isOpen ? 0 : [0, 3, 0] }} 
                    transition={{ repeat: isOpen ? 0 : Infinity, duration: 1.5, ease: "easeInOut" }}
                >
                    <ChevronDown size={18} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s ease" }} />
                </motion.div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: "hidden" }}
                    >
                        <div style={{ 
                            background: "#eff6ff", /* Light blue background for content */
                            padding: "16px 20px",
                            borderRadius: "0 0 8px 8px",
                            border: "1px solid #bfdbfe",
                            borderTop: "none",
                        }}>
                           <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#334155", display: "flex", flexDirection: "column", gap: "10px", listStyleType: "disc" }}>
                               {segments.map((segment, idx) => (
                                   <li key={idx} style={{ lineHeight: "1.5", fontWeight: segment.label === "Action" ? 600 : 400 }}>
                                       <strong>{segment.label}:</strong> {renderBoldText(segment.text)}
                                   </li>
                               ))}
                           </ul>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

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
            <DialogContent className="max-w-[1060px] w-[95vw] p-0 gap-0 rounded-xl overflow-hidden shadow-xl bg-white border-2 border-slate-200 outline-none [&>button]:hidden flex">
                <div className="flex-1 flex flex-col max-h-[85vh]">

                    {/* Modal Header */}
                    <div style={{
                        background: "#fff",
                        borderBottom: "1px solid #e5e9f0",
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
                        gap: "12px",
                        background: "#fff", flexShrink: 0,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "20px", width: "100%" }}>
                            <div>
                                <p style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Impact</p>
                                <p style={{ fontSize: "16px", fontWeight: 800, color: "#d59090ff", margin: 0, letterSpacing: "-0.02em" }}>{formatINRCompact(insight.impactInr || 0)}</p>
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
                        
                        <DynamicInsightsBar insight={insight} />
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

// ─── SIGNAL CARD SKELETON ───────────────────────────────────────────────────

const SignalCardSkeleton = () => (
    <div style={{
        width: "100%",
        height: "100%",
        minHeight: "280px",
        display: "flex",
        flexDirection: "column",
        borderRadius: "12px",
        background: "#ffffff",
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)",
        border: "1px solid #f1f5f9",
    }}>
        {/* Top Badge Row */}
        <div style={{ padding: "12px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="skeleton-pulse" style={{ width: "45px", height: "14px", borderRadius: "5px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div className="skeleton-pulse" style={{ width: "35px", height: "14px", borderRadius: "5px" }} />
                <div className="skeleton-pulse" style={{ width: "22px", height: "22px", borderRadius: "6px" }} />
            </div>
        </div>

        {/* Title Section */}
        <div style={{ padding: "4px 14px 12px" }}>
            <div className="skeleton-pulse" style={{ width: "40%", height: "9px", borderRadius: "3px", marginBottom: "6px" }} />
            <div className="skeleton-pulse" style={{ width: "85%", height: "14px", borderRadius: "4px", marginBottom: "4px" }} />
            <div className="skeleton-pulse" style={{ width: "60%", height: "14px", borderRadius: "4px" }} />
        </div>

        <Divider sx={{ mx: 1.5, my: 1, borderColor: "#f8fafc" }} />

        {/* Metric Hero Section */}
        <div style={{ padding: "14px 14px 12px" }}>
            <div className="skeleton-pulse" style={{ width: "55%", height: "8px", borderRadius: "3px", marginBottom: "12px" }} />
            <div className="skeleton-pulse" style={{ 
                width: "110px", height: "36px", borderRadius: "8px"
            }} />
        </div>

        <Divider sx={{ mx: 1.5, my: 1, borderColor: "#f8fafc" }} />

        {/* Evidence Rows (Preview) */}
        <div style={{ padding: "12px 14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="skeleton-pulse" style={{ width: "45%", height: "10px", borderRadius: "3px" }} />
                <div className="skeleton-pulse" style={{ width: "30%", height: "10px", borderRadius: "3px" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="skeleton-pulse" style={{ width: "40%", height: "10px", borderRadius: "3px" }} />
                <div className="skeleton-pulse" style={{ width: "25%", height: "10px", borderRadius: "3px" }} />
            </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "auto", padding: "10px 14px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", background: "#fcfdfe" }}>
            <div className="skeleton-pulse" style={{ width: "70px", height: "10px", borderRadius: "3px" }} />
        </div>
    </div>
);

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
    const [compareStartDate, setCompareStartDate] = useState(null);
    const [compareEndDate, setCompareEndDate] = useState(null);

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
                    ...(compareStartDate ? { compareStartDate: compareStartDate.format("YYYY-MM-DD") } : {}),
                    ...(compareEndDate ? { compareEndDate: compareEndDate.format("YYYY-MM-DD") } : {}),
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
    }, [filters, cityFilter, categoryFilter, platformFilter, startDate, endDate, compareStartDate, compareEndDate]);


    const allInsights = useMemo(() => fetchedInsights, [fetchedInsights]);

    const slicerOptions = useMemo(() => {
        const types = Array.from(new Set(allInsights.map((i) => i.type).filter(Boolean))).sort();
        const plats = Array.from(new Set(allInsights.flatMap((i) => i.platforms || []))).filter((p) => p && p !== "-").sort();
        return {
            types: ["All signals", ...types],
            cities: ["All cities", ...(fetchedFilterOptions.geographies.length > 0
                ? fetchedFilterOptions.geographies.filter((g) => g && g !== "-")
                : Array.from(new Set(allInsights.map((i) => i.city).filter(Boolean))).filter((c) => c !== "-").sort())],
            categories: ["All categories", ...(fetchedFilterOptions.categories.length > 0
                ? fetchedFilterOptions.categories.filter((c) => c && c !== "-")
                : Array.from(new Set(allInsights.map((i) => i.category).filter(Boolean))).filter((c) => c !== "-").sort())],
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
            `}</style>

            <div className="insights-page" style={{
                background: "#ffffff",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}>
                <div style={{ width: "100%", margin: "0 auto", padding: "6px 24px 12px 24px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

                    {/* ── Page Header ────────────────────────────────────── */}
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        flexWrap: "wrap", gap: "16px",
                        marginBottom: "12px",
                        background: "#fff",
                        border: "1px solid #e5e9f0",
                        borderRadius: "10px",
                        padding: "10px 16px",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        flexShrink: 0,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: "10px",
                                background: "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: "0 3px 10px rgba(37,99,235,0.25)",
                                flexShrink: 0,
                            }}>
                                <Signal size={18} color="#fff" />
                            </div>
                            <div>
                                <h1 style={{
                                    fontSize: "18px", fontWeight: 800, color: "#0f172a",
                                    margin: 0, letterSpacing: "-0.02em",
                                    display: "flex", alignItems: "center", gap: "8px",
                                }}>
                                    AI Signal Insights
                                    <LiveBadge />
                                    <BetaBadge />
                                </h1>
                                <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, marginTop: "2px", fontWeight: 400 }}>
                                    Anomaly detection & opportunity tracking across your retail landscape
                                </p>
                            </div>
                        </div>

                        {/* Stats pills */}
                        {!loading && (
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{
                                    background: "#f8fafc", border: "1px solid #e5e9f0",
                                    borderRadius: "8px", padding: "8px 14px", textAlign: "right",
                                }}>
                                    <div style={{ fontSize: "9px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>
                                        Total Opportunity
                                    </div>
                                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                                        {formatINRCompact(totalImpact)}
                                    </div>
                                </div>
                                <div style={{
                                    background: "#f0fdf4", border: "1px solid #bbf7d0",
                                    borderRadius: "8px", padding: "8px 14px", textAlign: "right",
                                }}>
                                    <div style={{ fontSize: "9px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>
                                        Active Signals
                                    </div>
                                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#16a34a", letterSpacing: "-0.02em" }}>
                                        {activeSignals}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Filter Bar ─────────────────────────────────────── */}
                    <div style={{
                        background: "#fff",
                        border: "1px solid #e5e9f0",
                        borderRadius: "10px",
                        padding: "8px 16px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "12px",
                        alignItems: "flex-end",
                        marginBottom: "16px",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        flexShrink: 0,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#9ca3af", alignSelf: "center", marginRight: "4px" }}>
                            <Filter size={12} />
                            <span style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Filters</span>
                        </div>
                        <div className="insights-filter-grid">
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <CustomHeaderDropdown label="SIGNAL" options={slicerOptions.types} value={typeFilter} onChange={(v) => setTypeFilter(v === "All" ? "All signals" : v)} multiSelect={false} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <CustomHeaderDropdown label="GEOGRAPHY" options={slicerOptions.cities} value={cityFilter} onChange={(v) => setCityFilter(v === "All" ? "All cities" : v)} multiSelect={false} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <CustomHeaderDropdown label="CATEGORY" options={slicerOptions.categories} value={categoryFilter} onChange={(v) => setCategoryFilter(v === "All" ? "All categories" : v)} multiSelect={false} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <CustomHeaderDropdown label="CHANNEL" options={slicerOptions.platforms} value={platformFilter} onChange={(v) => setPlatformFilter(v === "All" ? "All platforms" : v)} multiSelect={false} />
                            </div>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                            <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, mb: 0.5, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>TIME PERIOD</Typography>
                            <DateRangeComparePicker
                                timeStart={startDate} timeEnd={endDate}
                                compareStart={compareStartDate} compareEnd={compareEndDate}
                                maxDate={maxDate || dayjs()}
                                onApply={(s, e, cs, ce, compareOn) => { 
                                    setStartDate(s); 
                                    setEndDate(e); 
                                    if (compareOn && cs && ce) {
                                        setCompareStartDate(cs);
                                        setCompareEndDate(ce);
                                    } else {
                                        setCompareStartDate(null);
                                        setCompareEndDate(null);
                                    }
                                }}
                            />
                        </div>
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
                            {[...Array(11)].map((_, i) => (
                                <motion.div
                                    key={`skeleton-${i}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.05 }}
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
                                    style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}
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