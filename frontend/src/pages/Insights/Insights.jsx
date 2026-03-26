import React, { useMemo, useState, useEffect, useContext } from "react";
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
import { FilterContext } from "@/utils/FilterContext";
import { fetchInsights, fetchInsightsFilters } from "@/api/insightsService";

// --- HELPERS ---

const formatINRCompact = (n) => {
    const abs = Math.abs(n);
    if (abs >= 1e7) return `₹${(n / 1e7).toFixed(1)} Cr`;
    if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
    if (abs >= 1e3) return `₹${(n / 1e3).toFixed(0)} K`;
    return `₹${n.toFixed(0)}`;
};

const safePct = (v) => (typeof v === "number" ? `${v.toFixed(1)}%` : "-");
const safeNum = (v) => (typeof v === "number" ? `${v}` : "-");
const safeINR = (v) => (typeof v === "number" ? formatINRCompact(v) : "-");

const familyMeta = {
    Market: { icon: MapPinned, tone: "bg-indigo-500/10 text-indigo-700" },
    Pricing: { icon: BadgePercent, tone: "bg-sky-500/10 text-sky-700" },
    Performance: { icon: Megaphone, tone: "bg-orange-500/10 text-orange-700" },
    Competitive: { icon: Radar, tone: "bg-emerald-500/10 text-emerald-700" },
    Supply: { icon: Truck, tone: "bg-violet-500/10 text-violet-700" },
};

// --- STRICT SIGNAL ENFORCER ---

const REQUIRED_SIGNAL_TYPES = [
    "Share Headroom Hotspots",
    "Price Parity Radar",
    "Replenishment Breaks",
    "Competitor OSA Weak Spots",
    "Ad Stock Mismatch",
    "Keyword Efficiency and Budget Caps",
    "Challenger Launch Watch"
];

const createEmptySignal = (type) => {
    const base = {
        id: `empty_${type.replace(/\s+/g, '_')}`,
        type: type,
        title: "No data detected for this signal",
        family: "Market",
        platforms: ["-"],
        city: "-",
        category: "-",
        impactInr: 0,
        impactLabel: "-",
        kpis: [],
        whatWeSee: ["-", "-"],
        evidence: []
    };

    switch (type) {
        case "Competitor OSA Weak Spots":
            base.family = "Performance";
            base.kpis = [{ label: "Other brand OSA", value: "0%" }, { label: "KW OSA", value: "0%" }, { label: "Cities", value: "0" }];
            base.evidence = [{ category: "-", city: "-", skuOrBrand: "-", otherBrandOsa: 0, kwOsa: 0 }];
            break;
        case "Ad Stock Mismatch":
            base.family = "Performance";
            base.kpis = [{ label: "KW OSA (avg)", value: "0%" }, { label: "Ad SOV", value: "0%" }, { label: "Spend", value: "₹0" }];
            base.evidence = [{ city: "-", skuOrBrand: "-", kwOsa: 0, adSov: 0, spendInr: 0, estLostSalesInr: 0 }];
            break;
        case "Price Parity Radar":
            base.family = "Pricing";
            base.kpis = [{ label: "Price index", value: "0" }, { label: "Cluster share", value: "0%" }, { label: "Cluster growth", value: "0%" }];
            base.evidence = [{ city: "-", category: "-", clusterName: "-", kwPpu: 0, peerPpu: 0, priceIndex: 0, clusterContributionPct: 0, clusterGrowthPct: 0 }];
            break;
        case "Share Headroom Hotspots":
            base.family = "Market";
            base.kpis = [{ label: "Cities", value: "0" }, { label: "Avg share gap", value: "0%" }, { label: "Headroom", value: "₹0" }];
            base.evidence = [{ city: "-", category: "-", kwShare: 0, benchmarkShare: 0, shareGap: 0, headroomInr: 0, driverTag: "-" }];
            break;
        case "Challenger Launch Watch":
            base.family = "Competitive";
            base.kpis = [{ label: "Share", value: "0%" }, { label: "First seen", value: "-" }, { label: "PPU", value: "0" }];
            base.evidence = [{ city: "-", category: "-", skuOrBrand: "-", newItemShare: 0, ppu: 0, firstSeen: "-" }];
            break;
        case "Replenishment Breaks":
            base.family = "Supply";
            base.kpis = [{ label: "Fill rate", value: "0%" }, { label: "Missing PO", value: "0" }, { label: "Depot", value: "0" }];
            base.evidence = [{ depotOrDb: "-", city: "-", skuOrBrand: "-", plannedQty: 0, dispatchedQty: 0, fillRate: 0, poCreated: false, poNo: "-" }];
            break;
        case "Keyword Efficiency and Budget Caps":
            base.family = "Performance";
            base.kpis = [{ label: "Waste keywords", value: "0" }, { label: "Best ACOS", value: "0%" }, { label: "Budget caps", value: "-" }];
            base.evidence = [{ keyword: "-", campaign: "-", bid: 0, dailyBudget: 0, spend: 0, sales: 0, acos: 0, budgetCapped: false }];
            break;
        default:
            break;
    }
    return base;
};


// --- SUB-COMPONENTS ---

const ImpactPill = ({ label, value }) => (
    <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{formatINRCompact(value)}</span>
    </div>
);

const KPIChips = ({ kpis }) => (
    <div className="flex flex-wrap items-center gap-2">
        {kpis.map((k, idx) => (
            <div key={idx} className="rounded-full border bg-background/60 px-3 py-1 text-xs">
                <span className="text-muted-foreground">{k.label}</span>
                <span className="mx-1 text-muted-foreground">:</span>
                <span className="font-medium">{k.value}</span>
            </div>
        ))}
    </div>
);

const Slicer = ({ label, value, onChange, options }) => (
    <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{label}</span>
        <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 transition-all cursor-pointer"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            {options.map((o) => (
                <option key={o} value={o}>{o}</option>
            ))}
        </select>
    </label>
);

const LayoutToggle = ({ layout, setLayout }) => (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-2">
        <div className="pl-2">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Cards</div>
            <div className="text-xs font-bold text-slate-700">Layout</div>
        </div>
        <div className="flex items-center gap-1.5">
            <Button variant={layout === "grid" ? "default" : "outline"} className="rounded-xl h-8 w-9 px-0 border-none shadow-none" onClick={() => setLayout("grid")}>
                <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={layout === "list" ? "default" : "outline"} className="rounded-xl h-8 w-9 px-0 border-none shadow-none" onClick={() => setLayout("list")}>
                <List className="h-4 w-4" />
            </Button>
        </div>
    </div>
);

const PlatformIcon = ({ platform }) => {
    const Icon = platform === "Blinkit" ? ShoppingBag : platform === "Zepto" ? Zap : Store;
    return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border bg-background/60">
            <Icon className="h-4 w-4" />
        </span>
    );
};

const PlatformIconsRow = ({ platforms }) => (
    <div className="flex items-center gap-2">
        {(platforms || []).map((p) => (
            <PlatformIcon key={p} platform={p} />
        ))}
    </div>
);

const getCompetitorName = (insight) => {
    const rows = insight.evidence ?? [];
    for (const r of rows) {
        const s = (r.skuOrBrand ?? "").trim();
        if (!s) continue;
        const lower = s.toLowerCase();
        if (!lower.includes("kwality walls") && !lower.includes("kw ")) return s;
    }
    return "";
};

const getEvidenceView = (type) => {
    if (type === "Replenishment Breaks") return "supply";
    if (type === "Keyword Efficiency and Budget Caps") return "keyword";
    if (type === "Price Parity Radar") return "pricing";
    if (type === "Share Headroom Hotspots") return "share";
    if (type === "Challenger Launch Watch") return "newEntry";
    if (type === "Ad Stock Mismatch") return "adStock";
    return "osa";
};

// --- DATA VIEW RENDERER ---

const DetailBody = ({ insight }) => {
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
                                            <TableCell className="font-medium">{d.category ?? insight.category}</TableCell>
                                            <TableCell>{d.city ?? insight.city}</TableCell>
                                            <TableCell className="max-w-[320px] truncate">{d.skuOrBrand ?? "-"}</TableCell>
                                            <TableCell className="text-right">{safePct(d.otherBrandOsa)}</TableCell>
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
                                            <TableCell className="text-right">{d.poCreated === true ? d.poNo ?? "Created" : d.poCreated === false ? "Missing" : "-"}</TableCell>
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
    );
};

// --- MAIN CARD ---

const PremiumSignalCard = ({ insight, layout, onClick }) => {
    const isList = layout === "list";
    const meta = familyMeta[insight.family] || familyMeta.Market;
    const FamilyIcon = meta.icon;
    const competitor = getCompetitorName(insight);

    return (
        <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="h-full">
            <Card className={"rounded-2xl overflow-hidden border bg-background shadow-sm cursor-pointer select-none h-full flex flex-col"} role="button" tabIndex={0} onClick={onClick}>
                <div className="relative flex-1 flex flex-col">
                    <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_10%_10%,hsl(var(--foreground)),transparent_55%)]" />
                    <div className={"relative p-4 flex-1 flex flex-col " + (isList ? "md:flex-row md:items-start md:justify-between md:gap-6" : "")}>
                        <div className={isList ? "min-w-0 flex-1" : "min-w-0"}>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-xl border ${meta.tone}`}>
                                    <FamilyIcon className="h-4 w-4" />
                                </span>
                                <span className="truncate">{insight.type}</span>
                            </div>
                            <div className="mt-2 text-[15px] font-semibold leading-snug line-clamp-2">{insight.title}</div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{insight.city}</Badge>
                                <Badge variant="outline">{insight.category}</Badge>
                                <PlatformIconsRow platforms={insight.platforms} />
                                {competitor ? <Badge variant="secondary" className="rounded-full">{competitor}</Badge> : null}
                            </div>
                            <div className="mt-3"><KPIChips kpis={insight.kpis.slice(0, 3)} /></div>
                        </div>
                        <div className={isList ? "mt-3 md:mt-0 shrink-0" : "mt-auto pt-4"}>
                            <ImpactPill label={insight.impactLabel} value={insight.impactInr} />
                        </div>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
};

// --- MAIN PAGE COMPONENT ---

const KwalityWallsSignalHub = () => {
    const { refreshFilters } = useContext(FilterContext);

    const [filters, setFilters] = useState({ platform: "All platforms", city: "All cities", category: "All categories", signal: "All signals" });
    const [fetchedInsights, setFetchedInsights] = useState([]);
    const [fetchedFilterOptions, setFetchedFilterOptions] = useState({ categories: [], productLines: [], geographies: [] });
    const [loading, setLoading] = useState(false);

    const [typeFilter, setTypeFilter] = useState("All signals");
    const [cityFilter, setCityFilter] = useState("All cities");
    const [categoryFilter, setCategoryFilter] = useState("All categories");
    const [platformFilter, setPlatformFilter] = useState("All platforms");
    const [layout, setLayout] = useState("grid");

    useEffect(() => {
        if (typeof refreshFilters === 'function') refreshFilters();

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
                const apiPayload = { ...filters, localCity: cityFilter, localCategory: categoryFilter, localPlatform: platformFilter };
                const data = await fetchInsights(apiPayload);
                const apiResponseList = (data?.success && Array.isArray(data?.data)) ? data.data : [];

                // STRICT ENFORCEMENT: Iterate over the 7 mandatory types.
                // If the API provided it, use it. If not, generate a zeroed-out fallback.
                const enforcedInsights = REQUIRED_SIGNAL_TYPES.map(requiredType => {
                    const foundInApi = apiResponseList.find(apiItem => apiItem.type === requiredType);
                    return foundInApi ? foundInApi : createEmptySignal(requiredType);
                });

                setFetchedInsights(enforcedInsights);
            } catch (error) {
                console.error("Fetch Error:", error);
                // On complete failure, still render all 7 empty signals
                setFetchedInsights(REQUIRED_SIGNAL_TYPES.map(createEmptySignal));
            } finally {
                setLoading(false);
            }
        };

        loadInsights();
    }, [filters, cityFilter, categoryFilter, platformFilter]);

    // Use memoized list for filtering on frontend
    const allInsights = useMemo(() => fetchedInsights, [fetchedInsights]);

    const slicerOptions = useMemo(() => {
        const types = Array.from(new Set(allInsights.map((i) => i.type))).sort();
        const plats = Array.from(new Set(allInsights.flatMap((i) => i.platforms || []))).sort();

        return {
            types: ["All signals", ...types],
            cities: ["All cities", ...(fetchedFilterOptions.geographies.length > 0 ? fetchedFilterOptions.geographies : Array.from(new Set(allInsights.map((i) => i.city))).sort())],
            categories: ["All categories", ...(fetchedFilterOptions.categories.length > 0 ? fetchedFilterOptions.categories : Array.from(new Set(allInsights.map((i) => i.category))).sort())],
            platforms: ["All platforms", ...plats],
        };
    }, [allInsights, fetchedFilterOptions]);

    const filteredInsights = useMemo(() => {
        return allInsights.filter((i) => {
            const okType = typeFilter === "All signals" ? true : i.type === typeFilter;
            const okCity = cityFilter === "All cities" ? true : i.city === cityFilter;
            const okCat = categoryFilter === "All categories" ? true : i.category === categoryFilter;
            const okPlat = platformFilter === "All platforms" ? true : (i.platforms || []).includes(platformFilter);

            return okType && okCity && okCat && okPlat;
        });
    }, [allInsights, typeFilter, cityFilter, categoryFilter, platformFilter]);

    const [selectedId, setSelectedId] = useState(null);
    const selected = useMemo(() => allInsights.find((x) => x.id === selectedId) ?? null, [allInsights, selectedId]);
    const [dialogOpen, setDialogOpen] = useState(false);

    const openModal = (id) => {
        setSelectedId(id);
        setDialogOpen(true);
    };

    return (
        <CommonContainer title="Signal Hub" filters={filters} onFiltersChange={setFilters}>
            <div className="bg-background text-foreground">
                <div className="mx-auto max-w-7xl">
                    <div className="grid gap-4 lg:grid-cols-8 mb-8">
                        <div className="lg:col-span-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                            <Slicer label="Signal Type" value={typeFilter} onChange={setTypeFilter} options={slicerOptions.types} />
                            <Slicer label="Geography" value={cityFilter} onChange={setCityFilter} options={slicerOptions.cities} />
                            <Slicer label="Category" value={categoryFilter} onChange={setCategoryFilter} options={slicerOptions.categories} />
                            <Slicer label="Channel" value={platformFilter} onChange={setPlatformFilter} options={slicerOptions.platforms} />
                        </div>
                        <div className="lg:col-span-2">
                            <LayoutToggle layout={layout} setLayout={setLayout} />
                        </div>
                    </div>

                    <div>
                        {loading ? (
                            <div className="flex justify-center p-20 text-slate-400">Detecting signals...</div>
                        ) : filteredInsights.length === 0 ? (
                            <div className="rounded-2xl border-2 border-dashed border-slate-100 p-12 text-center">
                                <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                    <Radar className="h-6 w-6 text-slate-300" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900">No signals detected</h3>
                                <p className="text-xs text-slate-500 mt-1">Try broadening your filters or selecting a different city.</p>
                            </div>
                        ) : (
                            <div className={layout === "grid" ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                                {filteredInsights.map((ins) => (
                                    <PremiumSignalCard key={ins.id} insight={ins} layout={layout} onClick={() => openModal(ins.id)} />
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
                                                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border ${familyMeta[selected.family]?.tone || familyMeta.Market.tone}`}>
                                                        {React.createElement(familyMeta[selected.family]?.icon || MapPinned, { className: "h-3.5 w-3.5" })}
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
                                        <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl font-bold px-6 border-slate-200">
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
};

export default KwalityWallsSignalHub;