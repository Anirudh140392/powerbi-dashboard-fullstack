import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    X,
    Sparkles,
    LayoutGrid,
    List,
    Radar,
    BadgePercent,
    Megaphone,
    MapPinned,
    Truck,
    ShoppingBag,
    Store,
    Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import CommonContainer from "@/components/CommonLayout/CommonContainer";

/**
 * Kwality Walls - Signal Hub (Ice Cream)
 * - Cards are clickable (no Open button)
 * - Cards -> Modal only
 * - Filters: Signal, City, Category, Platform
 * - No "Recommended actions", no "Updated yesterday", no "High confidence"
 * - No status tags shown (removed New / In Progress pills)
 * - No search bar
 * - No duplicate header chips inside modal
 */

function formatINRCompact(n) {
    const abs = Math.abs(n);
    if (abs >= 1e7) return `₹${(n / 1e7).toFixed(1)} Cr`;
    if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
    if (abs >= 1e3) return `₹${(n / 1e3).toFixed(0)} K`;
    return `₹${n.toFixed(0)}`;
}

function safePct(v) {
    return typeof v === "number" ? `${v.toFixed(1)}%` : "-";
}

function safeNum(v) {
    return typeof v === "number" ? `${v}` : "-";
}

function safeINR(v) {
    return typeof v === "number" ? formatINRCompact(v) : "-";
}

const familyMeta = {
    Market: { icon: MapPinned, tone: "bg-indigo-500/10 text-indigo-700" },
    Pricing: { icon: BadgePercent, tone: "bg-sky-500/10 text-sky-700" },
    Performance: { icon: Megaphone, tone: "bg-orange-500/10 text-orange-700" },
    Competitive: { icon: Radar, tone: "bg-emerald-500/10 text-emerald-700" },
    Supply: { icon: Truck, tone: "bg-violet-500/10 text-violet-700" },
};

function ImpactPill({
    label,
    value,
}) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{formatINRCompact(value)}</span>
        </div>
    );
}

function KPIChips({ kpis }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {kpis.map((k, idx) => (
                <div
                    key={idx}
                    className="rounded-full border bg-background/60 px-3 py-1 text-xs"
                >
                    <span className="text-muted-foreground">{k.label}</span>
                    <span className="mx-1 text-muted-foreground">:</span>
                    <span className="font-medium">{k.value}</span>
                </div>
            ))}
        </div>
    );
}

function Slicer({
    label,
    value,
    onChange,
    options,
}) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{label}</span>
            <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 transition-all cursor-pointer"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map((o) => (
                    <option key={o} value={o}>
                        {o}
                    </option>
                ))}
            </select>
        </label>
    );
}

function LayoutToggle({
    layout,
    setLayout,
}) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-2">
            <div className="pl-2">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Cards</div>
                <div className="text-xs font-bold text-slate-700">Layout</div>
            </div>
            <div className="flex items-center gap-1.5">
                <Button
                    type="button"
                    variant={layout === "grid" ? "default" : "outline"}
                    className="rounded-xl h-8 w-9 px-0 border-none shadow-none"
                    onClick={() => setLayout("grid")}
                    aria-label="Grid"
                >
                    <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant={layout === "list" ? "default" : "outline"}
                    className="rounded-xl h-8 w-9 px-0 border-none shadow-none"
                    onClick={() => setLayout("list")}
                    aria-label="List"
                >
                    <List className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

function PlatformIcon({ platform }) {
    const Icon =
        platform === "Blinkit" ? ShoppingBag : platform === "Zepto" ? Zap : Store;
    return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border bg-background/60">
            <Icon className="h-4 w-4" />
        </span>
    );
}

function PlatformIconsRow({ platforms }) {
    return (
        <div className="flex items-center gap-2">
            {platforms.map((p) => (
                <PlatformIcon key={p} platform={p} />
            ))}
        </div>
    );
}

function getCompetitorName(insight) {
    // Heuristic: pick the first non-KW label from evidence (sample uses "Other brand")
    const rows = insight.evidence ?? [];
    for (const r of rows) {
        const s = (r.skuOrBrand ?? "").trim();
        if (!s) continue;
        const lower = s.toLowerCase();
        if (!lower.includes("kwality walls") && !lower.includes("kw ")) return s;
    }
    return "";
}

function getEvidenceView(type) {
    if (type === "Replenishment Breaks") return "supply";
    if (type === "Keyword Efficiency and Budget Caps") return "keyword";
    if (type === "Price Parity Radar") return "pricing";
    if (type === "Share Headroom Hotspots") return "share";
    if (type === "Challenger Launch Watch") return "newEntry";
    if (type === "Ad Stock Mismatch") return "adStock";
    return "osa";
}

function DetailBody({ insight }) {
    const view = getEvidenceView(insight.type);

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/15 p-4">
                <div className="text-sm font-semibold">Snapshot</div>

                <div className="mt-3">
                    <KPIChips kpis={insight.kpis} />
                </div>

                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {insight.whatWeSee.map((b, i) => (
                        <li key={i} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground/50" />
                            <span className="leading-relaxed">{b}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <Separator />

            <div>
                <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">Evidence</div>
                </div>

                <div className="rounded-xl border overflow-hidden">
                    <ScrollArea className="h-[420px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {view === "osa" && (
                                        <>
                                            <TableHead>Category</TableHead>
                                            <TableHead>City</TableHead>
                                            <TableHead>Competitor</TableHead>
                                            <TableHead className="text-right">Other brand OSA</TableHead>
                                            <TableHead className="text-right">KW OSA</TableHead>
                                        </>
                                    )}

                                    {view === "share" && (
                                        <>
                                            <TableHead>City</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right">KW Share</TableHead>
                                            <TableHead className="text-right">Benchmark</TableHead>
                                            <TableHead className="text-right">Gap</TableHead>
                                            <TableHead className="text-right">Headroom</TableHead>
                                            <TableHead>Driver</TableHead>
                                        </>
                                    )}

                                    {view === "pricing" && (
                                        <>
                                            <TableHead>City</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>PPU cluster</TableHead>
                                            <TableHead className="text-right">KW PPU</TableHead>
                                            <TableHead className="text-right">Peer PPU</TableHead>
                                            <TableHead className="text-right">Index</TableHead>
                                            <TableHead className="text-right">Cluster share</TableHead>
                                            <TableHead className="text-right">Cluster growth</TableHead>
                                        </>
                                    )}

                                    {view === "adStock" && (
                                        <>
                                            <TableHead>City</TableHead>
                                            <TableHead>KW SKU</TableHead>
                                            <TableHead className="text-right">KW OSA</TableHead>
                                            <TableHead className="text-right">Ad SOV</TableHead>
                                            <TableHead className="text-right">Spend</TableHead>
                                            <TableHead className="text-right">Est. lost sales</TableHead>
                                        </>
                                    )}

                                    {view === "newEntry" && (
                                        <>
                                            <TableHead>City</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Competitor SKU</TableHead>
                                            <TableHead className="text-right">Share</TableHead>
                                            <TableHead className="text-right">PPU</TableHead>
                                            <TableHead className="text-right">First seen</TableHead>
                                        </>
                                    )}

                                    {view === "supply" && (
                                        <>
                                            <TableHead>Depot / DB</TableHead>
                                            <TableHead>City</TableHead>
                                            <TableHead>KW SKU</TableHead>
                                            <TableHead className="text-right">Planned</TableHead>
                                            <TableHead className="text-right">Dispatched</TableHead>
                                            <TableHead className="text-right">Fill rate</TableHead>
                                            <TableHead className="text-right">PO</TableHead>
                                        </>
                                    )}

                                    {view === "keyword" && (
                                        <>
                                            <TableHead>Keyword</TableHead>
                                            <TableHead>Campaign</TableHead>
                                            <TableHead className="text-right">Bid</TableHead>
                                            <TableHead className="text-right">Budget</TableHead>
                                            <TableHead className="text-right">Spend</TableHead>
                                            <TableHead className="text-right">Sales</TableHead>
                                            <TableHead className="text-right">ACOS</TableHead>
                                            <TableHead className="text-right">Budget cap</TableHead>
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {insight.evidence.map((d, idx) => (
                                    <TableRow key={idx}>
                                        {view === "osa" && (
                                            <>
                                                <TableCell className="font-medium">
                                                    {d.category ?? insight.category}
                                                </TableCell>
                                                <TableCell>{d.city ?? insight.city}</TableCell>
                                                <TableCell className="max-w-[320px] truncate">
                                                    {d.skuOrBrand ?? "-"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {safePct(d.otherBrandOsa)}
                                                </TableCell>
                                                <TableCell className="text-right">{safePct(d.kwOsa)}</TableCell>
                                            </>
                                        )}

                                        {view === "share" && (
                                            <>
                                                <TableCell className="font-medium">{d.city ?? insight.city}</TableCell>
                                                <TableCell>{d.category ?? insight.category}</TableCell>
                                                <TableCell className="text-right">{safePct(d.kwShare)}</TableCell>
                                                <TableCell className="text-right">{safePct(d.benchmarkShare)}</TableCell>
                                                <TableCell className="text-right">{safePct(d.shareGap)}</TableCell>
                                                <TableCell className="text-right">{safeINR(d.headroomInr)}</TableCell>
                                                <TableCell className="max-w-[220px] truncate">{d.driverTag ?? "-"}</TableCell>
                                            </>
                                        )}

                                        {view === "pricing" && (
                                            <>
                                                <TableCell className="font-medium">{d.city ?? insight.city}</TableCell>
                                                <TableCell>{d.category ?? insight.category}</TableCell>
                                                <TableCell className="max-w-[240px] truncate">{d.clusterName ?? "-"}</TableCell>
                                                <TableCell className="text-right">{safeNum(d.kwPpu)}</TableCell>
                                                <TableCell className="text-right">{safeNum(d.peerPpu)}</TableCell>
                                                <TableCell className="text-right">{safeNum(d.priceIndex)}</TableCell>
                                                <TableCell className="text-right">{safePct(d.clusterContributionPct)}</TableCell>
                                                <TableCell className="text-right">{safePct(d.clusterGrowthPct)}</TableCell>
                                            </>
                                        )}

                                        {view === "adStock" && (
                                            <>
                                                <TableCell className="font-medium">{d.city ?? insight.city}</TableCell>
                                                <TableCell className="max-w-[360px] truncate">{d.skuOrBrand ?? "-"}</TableCell>
                                                <TableCell className="text-right">{safePct(d.kwOsa)}</TableCell>
                                                <TableCell className="text-right">{safePct(d.adSov)}</TableCell>
                                                <TableCell className="text-right">{safeINR(d.spendInr)}</TableCell>
                                                <TableCell className="text-right">{safeINR(d.estLostSalesInr)}</TableCell>
                                            </>
                                        )}

                                        {view === "newEntry" && (
                                            <>
                                                <TableCell className="font-medium">{d.city ?? insight.city}</TableCell>
                                                <TableCell>{d.category ?? insight.category}</TableCell>
                                                <TableCell className="max-w-[320px] truncate">{d.skuOrBrand ?? "-"}</TableCell>
                                                <TableCell className="text-right">{safePct(d.newItemShare)}</TableCell>
                                                <TableCell className="text-right">{safeNum(d.ppu)}</TableCell>
                                                <TableCell className="text-right">{d.firstSeen ?? "-"}</TableCell>
                                            </>
                                        )}

                                        {view === "supply" && (
                                            <>
                                                <TableCell className="font-medium">{d.depotOrDb ?? "-"}</TableCell>
                                                <TableCell>{d.city ?? insight.city}</TableCell>
                                                <TableCell className="max-w-[320px] truncate">{d.skuOrBrand ?? "-"}</TableCell>
                                                <TableCell className="text-right">{typeof d.plannedQty === "number" ? d.plannedQty : "-"}</TableCell>
                                                <TableCell className="text-right">{typeof d.dispatchedQty === "number" ? d.dispatchedQty : "-"}</TableCell>
                                                <TableCell className="text-right">{safePct(d.fillRate)}</TableCell>
                                                <TableCell className="text-right">
                                                    {d.poCreated === true ? d.poNo ?? "Created" : d.poCreated === false ? "Missing" : "-"}
                                                </TableCell>
                                            </>
                                        )}

                                        {view === "keyword" && (
                                            <>
                                                <TableCell className="font-medium">{d.keyword ?? "-"}</TableCell>
                                                <TableCell className="max-w-[240px] truncate">{d.campaign ?? "-"}</TableCell>
                                                <TableCell className="text-right">{typeof d.bid === "number" ? d.bid.toFixed(2) : "-"}</TableCell>
                                                <TableCell className="text-right">{typeof d.dailyBudget === "number" ? d.dailyBudget.toFixed(0) : "-"}</TableCell>
                                                <TableCell className="text-right">{typeof d.spend === "number" ? d.spend.toFixed(0) : "-"}</TableCell>
                                                <TableCell className="text-right">{typeof d.sales === "number" ? d.sales.toFixed(0) : "-"}</TableCell>
                                                <TableCell className="text-right">{typeof d.acos === "number" ? `${d.acos}%` : "-"}</TableCell>
                                                <TableCell className="text-right">{d.budgetCapped === true ? "Yes" : "No"}</TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}

function PremiumSignalCard({
    insight,
    layout,
    onClick,
}) {
    const isList = layout === "list";
    const meta = familyMeta[insight.family];
    const FamilyIcon = meta.icon;
    const competitor = getCompetitorName(insight);

    return (
        <motion.div
            whileHover={{ y: -2 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="h-full"
        >
            <Card
                className={
                    "rounded-2xl overflow-hidden border bg-background shadow-sm cursor-pointer select-none h-full flex flex-col"
                }
                role="button"
                tabIndex={0}
                onClick={onClick}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onClick();
                }}
            >
                <div className="relative flex-1 flex flex-col">
                    <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_10%_10%,hsl(var(--foreground)),transparent_55%)]" />

                    <div
                        className={
                            "relative p-4 flex-1 flex flex-col " +
                            (isList ? "md:flex-row md:items-start md:justify-between md:gap-6" : "")
                        }
                    >
                        <div className={isList ? "min-w-0 flex-1" : "min-w-0"}>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span
                                    className={`inline-flex h-7 w-7 items-center justify-center rounded-xl border ${meta.tone}`}
                                >
                                    <FamilyIcon className="h-4 w-4" />
                                </span>
                                <span className="truncate">{insight.type}</span>
                            </div>

                            <div className="mt-2 text-[15px] font-semibold leading-snug line-clamp-2">
                                {insight.title}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{insight.city}</Badge>
                                <Badge variant="outline">{insight.category}</Badge>

                                {/* Platform icons only */}
                                <PlatformIconsRow platforms={insight.platforms} />

                                {/* Competitor visible when relevant */}
                                {competitor ? (
                                    <Badge variant="secondary" className="rounded-full">
                                        {competitor}
                                    </Badge>
                                ) : null}
                            </div>

                            <div className="mt-3">
                                <KPIChips kpis={insight.kpis.slice(0, 3)} />
                            </div>
                        </div>

                        <div className={isList ? "mt-3 md:mt-0 shrink-0" : "mt-auto pt-4"}>
                            <ImpactPill label={insight.impactLabel} value={insight.impactInr} />
                        </div>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}

const sampleInsights = [
    {
        id: "sig_1",
        type: "Competitor OSA Weak Spots",
        title: "Other brand is frequently out of stock, KW can capture share quickly",
        family: "Performance",
        platforms: ["Blinkit", "Zepto"],
        city: "Delhi NCR",
        category: "Ice Cream",
        impactInr: 310000,
        impactLabel: "Headroom",
        kpis: [
            { label: "Other brand OSA", value: "66%" },
            { label: "KW OSA", value: "93%" },
            { label: "Cities", value: "3" },
        ],
        whatWeSee: [
            "Other brand is missing on key Ice Cream searches, creating an easy share-grab window.",
            "KW is in stock, so conversion is mostly limited by visibility, not supply.",
        ],
        evidence: [
            {
                category: "Ice Cream",
                city: "Delhi NCR",
                skuOrBrand: "Other brand",
                otherBrandOsa: 66,
                kwOsa: 93,
            },
            {
                category: "Ice Cream",
                city: "Pune",
                skuOrBrand: "Other brand",
                otherBrandOsa: 49,
                kwOsa: 92,
            },
            {
                category: "Ice Cream",
                city: "Kolkata",
                skuOrBrand: "Other brand",
                otherBrandOsa: 57,
                kwOsa: 91,
            },
        ],
    },
    {
        id: "sig_2",
        type: "Ad Stock Mismatch",
        title: "Ads are running while KW availability is low in Hyderabad",
        family: "Performance",
        platforms: ["Blinkit"],
        city: "Hyderabad",
        category: "Ice Cream",
        impactInr: 86000,
        impactLabel: "Ad Waste",
        kpis: [
            { label: "KW OSA (avg)", value: "50%" },
            { label: "Ad SOV", value: "3.2%" },
            { label: "Spend", value: "₹42K" },
        ],
        whatWeSee: [
            "When OSA is low, paid visibility converts poorly and spend leaks.",
            "Replenishment first, then bids. Otherwise you buy clicks for empty shelves.",
        ],
        evidence: [
            {
                city: "Hyderabad",
                skuOrBrand: "Kwality Walls Magnum Almond",
                kwOsa: 52,
                adSov: 3.2,
                spendInr: 22000,
                estLostSalesInr: 46000,
            },
            {
                city: "Hyderabad",
                skuOrBrand: "Kwality Walls Cornetto Chocolate",
                kwOsa: 49,
                adSov: 2.6,
                spendInr: 20000,
                estLostSalesInr: 40000,
            },
        ],
    },
    {
        id: "sig_3",
        type: "Price Parity Radar",
        title: "KW looks premium in Kolkata, conversion is likely taking a hit",
        family: "Pricing",
        platforms: ["Instamart", "Zepto"],
        city: "Kolkata",
        category: "Ice Cream",
        impactInr: 740000,
        impactLabel: "Headroom",
        kpis: [
            { label: "Price index", value: "110" },
            { label: "Cluster share", value: "41%" },
            { label: "Cluster growth", value: "+23%" },
        ],
        whatWeSee: [
            "We compare PPU (price per unit) inside the same PPU segment to avoid unfair comparisons.",
            "The biggest cluster is growing, but KW sits above peer pricing, which can suppress conversion.",
        ],
        evidence: [
            {
                city: "Kolkata",
                category: "Ice Cream",
                clusterName: "Mass PPU cluster",
                kwPpu: 178,
                peerPpu: 132,
                priceIndex: 110,
                clusterContributionPct: 41,
                clusterGrowthPct: 22.7,
            },
            {
                city: "Kolkata",
                category: "Ice Cream",
                clusterName: "Value PPU cluster",
                kwPpu: 102,
                peerPpu: 100,
                priceIndex: 102,
                clusterContributionPct: 27,
                clusterGrowthPct: 8.4,
            },
        ],
    },
    {
        id: "sig_4",
        type: "Share Headroom Hotspots",
        title: "City pockets where KW share trails the category benchmark",
        family: "Market",
        platforms: ["Blinkit", "Instamart", "Zepto"],
        city: "Multi-city",
        category: "Ice Cream",
        impactInr: 4120000,
        impactLabel: "Headroom",
        kpis: [
            { label: "Cities", value: "4" },
            { label: "Avg share gap", value: "-2.4%" },
            { label: "Headroom", value: "₹41.2L" },
        ],
        whatWeSee: [
            "We flag city-category zones where KW share is below its own benchmark (pan-India or cluster baseline).",
            "Drivers usually split into assortment coverage, in-stock rate, visibility, or a competitor push.",
        ],
        evidence: [
            {
                city: "Mumbai",
                category: "Ice Cream",
                kwShare: 2.0,
                benchmarkShare: 3.9,
                shareGap: -1.9,
                headroomInr: 1000000,
                driverTag: "Assortment coverage",
            },
            {
                city: "Bengaluru",
                category: "Ice Cream",
                kwShare: 2.1,
                benchmarkShare: 3.9,
                shareGap: -1.8,
                headroomInr: 2400000,
                driverTag: "Availability",
            },
            {
                city: "Kolkata",
                category: "Ice Cream",
                kwShare: 2.8,
                benchmarkShare: 3.9,
                shareGap: -1.1,
                headroomInr: 91500,
                driverTag: "Visibility",
            },
            {
                city: "Hyderabad",
                category: "Ice Cream",
                kwShare: 3.2,
                benchmarkShare: 3.9,
                shareGap: -0.7,
                headroomInr: 54100,
                driverTag: "Competitive pressure",
            },
        ],
    },
    {
        id: "sig_5",
        type: "Challenger Launch Watch",
        title: "New Other brand SKU is gaining traction in Bengaluru",
        family: "Competitive",
        platforms: ["Blinkit"],
        city: "Bengaluru",
        category: "Ice Cream",
        impactInr: 0,
        impactLabel: "Headroom",
        kpis: [
            { label: "Share", value: "1.3%" },
            { label: "First seen", value: "2026-02-16" },
            { label: "PPU", value: "126" },
        ],
        whatWeSee: [
            "We watch new competitor listings that cross meaningful share thresholds quickly.",
            "The early signal is visibility plus pricing. Promotions usually follow.",
        ],
        evidence: [
            {
                city: "Bengaluru",
                category: "Ice Cream",
                skuOrBrand: "Other brand Choco Bar (new)",
                newItemShare: 1.3,
                ppu: 126,
                firstSeen: "2026-02-16",
            },
        ],
    },
    {
        id: "sig_6",
        type: "Replenishment Breaks",
        title: "Fill rate is low and POs are missing for fast-moving SKUs in Bengaluru",
        family: "Supply",
        platforms: ["Blinkit", "Zepto"],
        city: "Bengaluru",
        category: "Ice Cream",
        impactInr: 520000,
        impactLabel: "Loss",
        kpis: [
            { label: "Fill rate", value: "62%" },
            { label: "Missing PO", value: "2 SKUs" },
            { label: "Depot", value: "2" },
        ],
        whatWeSee: [
            "Planned quantities are not getting dispatched, causing repeat OOS and lost sales.",
            "A few high-velocity SKUs have no PO created, blocking replenishment entirely.",
        ],
        evidence: [
            {
                depotOrDb: "BLR-DC-02",
                city: "Bengaluru",
                skuOrBrand: "Kwality Walls Magnum Almond",
                plannedQty: 1200,
                dispatchedQty: 640,
                fillRate: 53,
                poCreated: false,
            },
            {
                depotOrDb: "BLR-DC-02",
                city: "Bengaluru",
                skuOrBrand: "Kwality Walls Cornetto Chocolate",
                plannedQty: 900,
                dispatchedQty: 720,
                fillRate: 80,
                poCreated: false,
            },
            {
                depotOrDb: "BLR-DC-01",
                city: "Bengaluru",
                skuOrBrand: "Kwality Walls Feast Chocolate",
                plannedQty: 650,
                dispatchedQty: 390,
                fillRate: 60,
                poCreated: true,
                poNo: "PO-847291",
            },
        ],
    },
    {
        id: "sig_7",
        type: "Keyword Efficiency and Budget Caps",
        title: "Spend is leaking on broad keywords, while winners hit budget caps",
        family: "Performance",
        platforms: ["Blinkit"],
        city: "Delhi NCR",
        category: "Ice Cream",
        impactInr: 220000,
        impactLabel: "Ad Waste",
        kpis: [
            { label: "Waste keywords", value: "2" },
            { label: "Best ACOS", value: "22%" },
            { label: "Budget caps", value: "Yes" },
        ],
        whatWeSee: [
            "Broad queries are absorbing spend but not converting, pushing ACOS high.",
            "The converting terms hit daily budget early, so incremental sales get throttled.",
        ],
        evidence: [
            {
                keyword: "ice cream",
                campaign: "KW | Generic | Always-on",
                bid: 7.5,
                dailyBudget: 12000,
                spend: 5400,
                sales: 1700,
                acos: 318,
                budgetCapped: false,
            },
            {
                keyword: "chocolate ice cream",
                campaign: "KW | Generic | Chocolate",
                bid: 5.2,
                dailyBudget: 8000,
                spend: 3100,
                sales: 1200,
                acos: 258,
                budgetCapped: false,
            },
            {
                keyword: "magnum",
                campaign: "KW | Brand | Magnum",
                bid: 3.8,
                dailyBudget: 5000,
                spend: 4800,
                sales: 22000,
                acos: 22,
                budgetCapped: true,
            },
        ],
    },
];

export default function KwalityWallsSignalHub() {
    const allInsights = useMemo(() => sampleInsights, []);

    const [typeFilter, setTypeFilter] = useState("All signals");
    const [cityFilter, setCityFilter] = useState("All cities");
    const [categoryFilter, setCategoryFilter] = useState("All categories");
    const [platformFilter, setPlatformFilter] = useState("All platforms");
    const [layout, setLayout] = useState("grid");

    const slicerOptions = useMemo(() => {
        const types = Array.from(new Set(allInsights.map((i) => i.type))).sort();
        const cities = Array.from(new Set(allInsights.map((i) => i.city))).sort();
        const cats = Array.from(new Set(allInsights.map((i) => i.category))).sort();
        const plats = Array.from(new Set(allInsights.flatMap((i) => i.platforms))).sort();

        return {
            types: ["All signals", ...types],
            cities: ["All cities", ...cities],
            categories: ["All categories", ...cats],
            platforms: ["All platforms", ...plats],
        };
    }, [allInsights]);

    const insights = useMemo(() => {
        return allInsights.filter((i) => {
            const okType = typeFilter === "All signals" ? true : i.type === typeFilter;
            const okCity = cityFilter === "All cities" ? true : i.city === cityFilter;
            const okCat = categoryFilter === "All categories" ? true : i.category === categoryFilter;
            const okPlat =
                platformFilter === "All platforms"
                    ? true
                    : i.platforms.includes(platformFilter);

            return okType && okCity && okCat && okPlat;
        });
    }, [allInsights, typeFilter, cityFilter, categoryFilter, platformFilter]);

    const [selectedId, setSelectedId] = useState(null);
    const selected = useMemo(
        () => allInsights.find((x) => x.id === selectedId) ?? null,
        [allInsights, selectedId]
    );

    const [dialogOpen, setDialogOpen] = useState(false);

    const openModal = (id) => {
        setSelectedId(id);
        setDialogOpen(true);
    };

    const [filters, setFilters] = useState({
        platform: "All platforms",
        city: "All cities",
        category: "All categories",
        signal: "All signals"
    });

    return (
        <CommonContainer
            title="Signal Hub"
            filters={filters}
            onFiltersChange={setFilters}
        >
            <div className="bg-background text-foreground">
                <div className="mx-auto max-w-7xl">


                    <div className="grid gap-4 lg:grid-cols-8 mb-8">
                        <div className="lg:col-span-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                            <Slicer label="Signal Type" value={typeFilter} onChange={setTypeFilter} options={slicerOptions.types} />
                            <Slicer label="Geography" value={cityFilter} onChange={setCityFilter} options={slicerOptions.cities} />
                            <Slicer label="Product Line" value={categoryFilter} onChange={setCategoryFilter} options={slicerOptions.categories} />
                            <Slicer label="Channel" value={platformFilter} onChange={setPlatformFilter} options={slicerOptions.platforms} />
                        </div>

                        <div className="lg:col-span-2">
                            <LayoutToggle layout={layout} setLayout={setLayout} />
                        </div>
                    </div>

                    <div>
                        {insights.length === 0 ? (
                            <div className="rounded-2xl border-2 border-dashed border-slate-100 p-12 text-center">
                                <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                    <Radar className="h-6 w-6 text-slate-300" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900">No signals detected</h3>
                                <p className="text-xs text-slate-500 mt-1">Try broadening your filters or selecting a different city.</p>
                            </div>
                        ) : (
                            <div
                                className={
                                    layout === "grid"
                                        ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                                        : "space-y-4"
                                }
                            >
                                {insights.map((ins) => (
                                    <PremiumSignalCard
                                        key={ins.id}
                                        insight={ins}
                                        layout={layout}
                                        onClick={() => openModal(ins.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogContent className="max-w-4xl rounded-3xl border-none p-0 overflow-hidden outline-none top-[54%] left-[55%]">
                            {selected && (
                                <div className="flex flex-col max-h-[82vh]">
                                    <div className="p-8 border-b bg-gradient-to-r from-slate-50 to-white">
                                        <div className="flex items-center justify-between">
                                            <DialogHeader className="space-y-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border ${familyMeta[selected.family].tone}`}>
                                                        {React.createElement(familyMeta[selected.family].icon, { className: "h-3.5 w-3.5" })}
                                                    </span>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{selected.type}</span>
                                                </div>
                                                <DialogTitle className="text-2xl font-bold text-slate-900">
                                                    {selected.title}
                                                </DialogTitle>
                                            </DialogHeader>
                                        </div>

                                        <div className="mt-6 flex flex-wrap items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="px-3 py-1 rounded-lg text-xs font-bold bg-white shadow-sm border-slate-100">
                                                    <MapPinned className="h-3 w-3 mr-1.5 text-slate-400" />
                                                    {selected.city}
                                                </Badge>
                                                <Badge variant="secondary" className="px-3 py-1 rounded-lg text-xs font-bold bg-white shadow-sm border-slate-100">
                                                    <Zap className="h-3 w-3 mr-1.5 text-slate-400" />
                                                    {selected.category}
                                                </Badge>
                                            </div>

                                            <Separator orientation="vertical" className="h-6" />

                                            <PlatformIconsRow platforms={selected.platforms} />

                                            <Separator orientation="vertical" className="h-6" />

                                            <ImpactPill label={selected.impactLabel} value={selected.impactInr} />
                                        </div>
                                    </div>

                                    <div className="p-8 overflow-y-auto no-scrollbar">
                                        <DetailBody insight={selected} />
                                    </div>

                                    <div className="p-6 border-t bg-slate-50/50 flex items-center justify-end gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => setDialogOpen(false)}
                                            className="rounded-xl font-bold px-6 border-slate-200"
                                        >
                                            Dismiss
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </CommonContainer>
    );
}
