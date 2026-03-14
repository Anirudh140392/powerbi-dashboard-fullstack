// InsightsPricingView.jsx
import React, { useMemo, useState, useEffect, useContext } from "react";
import { FilterContext } from "@/utils/FilterContext";
import axiosInstance from "../../api/axiosInstance";
import { Box, Typography, Skeleton, Dialog, Slide } from "@mui/material";
import PricingInsightsTable from "./PricingInsightsTable";

// Transition removed for centered modal

function cn(...c) {
    return c.filter(Boolean).join(" ");
}

const tabs = [
    { key: "pd_my", label: "Price Drop (my SKUs)", count: 4 },
    { key: "pi_my", label: "Price Increase (my SKUs)", count: 4 },
    { key: "pd_comp", label: "Price Drop (comp. SKUs)", count: 4 },
    { key: "pi_comp", label: "Price Increase (comp. SKUs)", count: 4 },
];

/* ─── Derived tab badge tone ─────────────────────────────────────────────── */
function badgeTone(tabKey) {
    if (tabKey === "pd_my" || tabKey === "pd_comp") return "red";
    return "green";
}

function cityChangeTone(value) {
    if (value >= 0) return "emerald";
    return "rose";
}

/* ─── Mini components ────────────────────────────────────────────────────── */
function Pill({ children, tone = "neutral" }) {
    const toneMap = {
        neutral: "bg-slate-100 text-slate-700 border-slate-200",
        blue: "bg-blue-50 text-blue-700 border-blue-200",
        red: "bg-rose-50 text-rose-700 border-rose-200",
        green: "bg-emerald-50 text-emerald-700 border-emerald-200",
        amber: "bg-amber-50 text-amber-800 border-amber-200",
        dark: "bg-slate-900 text-white border-slate-900",
    };
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold",
                toneMap[tone]
            )}
        >
            {children}
        </span>
    );
}

function Delta({ value }) {
    const down = value < 0;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-[12px] font-semibold",
                down ? "text-rose-600" : "text-emerald-600"
            )}
        >
            <span
                className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    down ? "bg-rose-600" : "bg-emerald-600"
                )}
            />
            {Math.abs(value).toFixed(1)}%
            <span className="font-medium text-slate-500">{down ? "down" : "up"}</span>
        </span>
    );
}

function MiniSkuMark({ brand }) {
    return (
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50">
            <div className="text-center">
                <div className="mx-auto h-2 w-7 rounded-full bg-slate-900" />
                <div className="mt-2 text-[10px] font-bold text-slate-700">
                    {String(brand || "SKU").slice(0, 3).toUpperCase()}
                </div>
            </div>
        </div>
    );
}

function TabsHeader({ active, onChange, tabs }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {tabs.map((t) => {
                const a = t.key === active;
                return (
                    <button
                        key={t.key}
                        onClick={() => onChange(t.key)}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                            a
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        )}
                    >
                        <span className="font-semibold">{t.label}</span>
                        <span
                            className={cn(
                                "rounded-full px-2 py-0.5 text-[12px]",
                                a ? "bg-white/15" : "bg-slate-100"
                            )}
                        >
                            {t.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function CardMinimal({ item, tabKey, onSelected }) {
    const tone = badgeTone(tabKey);
    const changeTone = cityChangeTone(tabKey);

    return (
        <div className="w-[360px] shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <MiniSkuMark brand={item.brand} />

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <Pill tone={tone}>{item.badge}</Pill>
                        <Pill tone="neutral">Cat: {item.cat}</Pill>
                    </div>

                    <div className="mt-1 text-[12px] font-semibold text-slate-600">{item.brand}</div>
                    <div className="mt-1 line-clamp-1 text-[16px] font-bold text-black">
                        {item.title}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Pill tone="blue">{item.size}</Pill>
                        <Delta value={item.delta} />
                    </div>
                </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between px-3 py-2 text-[12px] font-semibold text-slate-500">
                    <span>Top impacted cities</span>
                    <span>Discount %</span>
                </div>

                <div className="divide-y divide-slate-200">
                    {item.cities
                        .filter(c => {
                            if (tabKey.startsWith('pd')) return c.change < 0;
                            if (tabKey.startsWith('pi')) return c.change > 0;
                            return true;
                        })
                        .slice(0, 2).map((c) => (
                        <div
                            key={c.name}
                            className="flex items-center justify-between px-3 py-2"
                        >
                            <span className="text-sm font-medium text-slate-800">{c.name}</span>
                            <span className="text-sm font-semibold text-slate-900">
                                {c.discount.toFixed(1)}
                                <span
                                    className={cn(
                                        "ml-2 text-[12px] font-semibold",
                                        c.change >= 0 ? "text-emerald-600" : "text-rose-600"
                                    )}
                                >
                                    {c.change > 0 ? "+" : ""}{c.change.toFixed(1)}%
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            
            <button
                onClick={() => {
                    onSelected(item);
                }}
                className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-[13px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
                Know More
            </button>
        </div>
    );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function InsightsPricingView({ loading = false }) {
    const [activeTab, setActiveTab] = useState("pd_my");
    const [selectedSku, setSelectedSku] = useState(null);

    // Get global filters
    const {
        platform: globalPlatform,
        selectedBrand,
        selectedLocation,
        selectedCategory,
        selectedChannel,
        timeStart,
        timeEnd,
        datesInitialized,
    } = useContext(FilterContext);

    const [insightsData, setInsightsData] = useState({
        pd_my: [],
        pi_my: [],
        pd_comp: [],
        pi_comp: []
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!datesInitialized) return;

        const fetchInsights = async () => {
            setIsLoading(true);
            try {
                const params = {
                    startDate: timeStart?.format('YYYY-MM-DD'),
                    endDate: timeEnd?.format('YYYY-MM-DD'),
                };

                const toStr = (v) => Array.isArray(v) ? v.join(',') : v;
                if (globalPlatform && globalPlatform !== 'All') params.platform = toStr(globalPlatform);
                if (selectedLocation && selectedLocation !== 'All') params.location = toStr(selectedLocation);
                if (selectedCategory && selectedCategory !== 'All') params.category = toStr(selectedCategory);
                if (selectedBrand && selectedBrand !== 'All') params.brand = toStr(selectedBrand);
                if (selectedChannel && selectedChannel !== 'All') params.channel = toStr(selectedChannel);

                console.log("[InsightsPricingView] Fetching Insights with params:", params);
                const response = await axiosInstance.get('/pricing-analysis/insights', { params });

                if (response.data?.success && response.data?.data) {
                    setInsightsData(response.data.data);
                } else {
                    setInsightsData({ pd_my: [], pi_my: [], pd_comp: [], pi_comp: [] });
                }
            } catch (error) {
                console.error("Error fetching Pricing Insights:", error);
                setInsightsData({ pd_my: [], pi_my: [], pd_comp: [], pi_comp: [] });
            } finally {
                setIsLoading(false);
            }
        };

        fetchInsights();
    }, [timeStart, timeEnd, datesInitialized, globalPlatform, selectedLocation, selectedCategory, selectedChannel, selectedBrand]);

    const data = useMemo(() => insightsData[activeTab] || [], [activeTab, insightsData]);

    // Use dynamic tabs configuration based on counts
    const dynamicTabs = [
        { key: "pd_my", label: "Price Drop (my SKUs)", count: insightsData.pd_my.length },
        { key: "pi_my", label: "Price Increase (my SKUs)", count: insightsData.pi_my.length },
        { key: "pd_comp", label: "Price Drop (comp. SKUs)", count: insightsData.pd_comp.length },
        { key: "pi_comp", label: "Price Increase (comp. SKUs)", count: insightsData.pi_comp.length },
    ];

    return (
        <div className="w-full bg-slate-50 p-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
                    <div className="flex flex-col">
                        <div className="text-xl font-bold text-slate-900">Insights</div>
                        <div className="mt-1 text-sm text-slate-600">
                            Pricing signals across your SKUs &amp; competitors
                        </div>
                    </div>
                </div>

                {(isLoading || loading) ? (
                    <Box sx={{ mt: 2 }}>
                        <div className="flex gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton
                                    key={i}
                                    variant="rectangular"
                                    width={280}
                                    height={180}
                                    sx={{ borderRadius: 4, flexShrink: 0 }}
                                />
                            ))}
                        </div>
                    </Box>
                ) : (
                    <>
                        <TabsHeader active={activeTab} onChange={setActiveTab} tabs={dynamicTabs} />

                        {/* Horizontal rail */}
                        <div className="mt-2 overflow-x-auto pb-2 min-h-[160px]">
                            {data.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                                    No significant changes detected for this period.
                                </Typography>
                            ) : (
                                <div className="flex min-w-max gap-3">
                                    {data.map((it) => (
                                        <CardMinimal 
                                            key={it.id} 
                                            item={it} 
                                            tabKey={activeTab} 
                                            onSelected={(sku) => setSelectedSku(sku)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Detailed Table Dialog - Now Centered Modal */}
            <Dialog
                open={!!selectedSku}
                onClose={() => setSelectedSku(null)}
                maxWidth="md"
                fullWidth
                slotProps={{
                    backdrop: {
                        sx: {
                            backdropFilter: "blur(4px)",
                            backgroundColor: "rgba(0, 0, 0, 0.4)",
                        },
                    },
                }}
                PaperProps={{
                    sx: {
                        borderRadius: "20px",
                        overflow: "hidden",
                        boxShadow: "0 10px 30px -5px rgba(0,0,0,0.1)",
                        background: "white",
                        display: "flex",
                        flexDirection: "column",
                        maxHeight: "90vh",
                        height: "auto"
                    }
                }}
            >
                {selectedSku && (
                    <PricingInsightsTable 
                        sku={selectedSku}
                        onClose={() => setSelectedSku(null)} 
                        insightType={activeTab.startsWith('pd') ? 'drop' : 'increase'}
                    />
                )}
            </Dialog>
        </div>
    );
}