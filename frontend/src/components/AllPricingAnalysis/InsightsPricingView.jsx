// InsightsPricingView.jsx
import React, { useMemo, useState, useEffect, useContext } from "react";
import { FilterContext } from "@/utils/FilterContext";
import axiosInstance from "../../api/axiosInstance";
import { Box, Typography, Skeleton, Grid } from "@mui/material";

function cn(...c) {
    return c.filter(Boolean).join(" ");
}

const tabs = [
    { key: "pd_my", label: "Price Drop (my SKUs)", count: 4 },
    { key: "pi_my", label: "Price Increase (my SKUs)", count: 4 },
    { key: "pd_comp", label: "Price Drop (comp. SKUs)", count: 4 },
    { key: "pi_comp", label: "Price Increase (comp. SKUs)", count: 4 },
];

/* ─── Per-tab datasets ───────────────────────────────────────────────────── */

const DATA_BY_TAB = {
    // MY SKUs – Price dropped (discount went up → good signal or MRP cut)
    pd_my: [
        {
            id: "pd_my_01",
            badge: "Price Drop 01",
            cat: "Cassata",
            brand: "Amul",
            title: "Amul Cassata Royal 500ml",
            size: "500 ml",
            delta: -1.2,
            cities: [
                { name: "Mumbai", discount: 14.8, change: 3.2 },
                { name: "Delhi NCR", discount: 13.5, change: 2.9 },
            ],
        },
        {
            id: "pd_my_02",
            badge: "Price Drop 02",
            cat: "Cassata",
            brand: "Amul",
            title: "Amul Cassata Yummy 1 Ltr",
            size: "1 Ltr",
            delta: -0.9,
            cities: [
                { name: "Bengaluru", discount: 12.4, change: 2.1 },
                { name: "Hyderabad", discount: 11.9, change: 1.8 },
            ],
        },
        {
            id: "pd_my_03",
            badge: "Price Drop 03",
            cat: "Core Tubs",
            brand: "Mother Dairy",
            title: "Mother Dairy Vanilla Tub 1 Ltr",
            size: "1 Ltr",
            delta: -1.5,
            cities: [
                { name: "Kolkata", discount: 18.2, change: 4.1 },
                { name: "Chennai", discount: 17.6, change: 3.8 },
            ],
        },
        {
            id: "pd_my_04",
            badge: "Price Drop 04",
            cat: "Core Tubs",
            brand: "Mother Dairy",
            title: "Mother Dairy Butterscotch Tub 750ml",
            size: "750 ml",
            delta: -0.6,
            cities: [
                { name: "Pune", discount: 15.3, change: 2.5 },
            ],
        },
    ],

    // MY SKUs – Price increased (discount went down or MRP raised)
    pi_my: [
        {
            id: "pi_my_01",
            badge: "Price Hike 01",
            cat: "Cup",
            brand: "Amul",
            title: "Amul Kool Kulfi 100ml Cup",
            size: "100 ml",
            delta: 1.4,
            cities: [
                { name: "Delhi NCR", discount: 8.3, change: -2.1 },
                { name: "Jaipur", discount: 7.9, change: -1.9 },
            ],
        },
        {
            id: "pi_my_02",
            badge: "Price Hike 02",
            cat: "Sandwich",
            brand: "Amul",
            title: "Amul Choco Sandwich 65ml",
            size: "65 ml",
            delta: 0.8,
            cities: [
                { name: "Ahmedabad", discount: 9.7, change: -1.5 },
                { name: "Surat", discount: 9.2, change: -1.3 },
            ],
        },
        {
            id: "pi_my_03",
            badge: "Price Hike 03",
            cat: "Core Tubs",
            brand: "Mother Dairy",
            title: "Mother Dairy Chocolate Tub 1 Ltr",
            size: "1 Ltr",
            delta: 1.1,
            cities: [
                { name: "Mumbai", discount: 16.4, change: -3.2 },
                { name: "Bengaluru", discount: 15.8, change: -2.8 },
            ],
        },
        {
            id: "pi_my_04",
            badge: "Price Hike 04",
            cat: "Cassata",
            brand: "Mother Dairy",
            title: "Mother Dairy Mixed Fruit Cassata 500ml",
            size: "500 ml",
            delta: 0.5,
            cities: [
                { name: "Chennai", discount: 11.2, change: -1.4 },
            ],
        },
    ],

    // COMPETITOR SKUs – Price dropped (competitor is getting aggressive)
    pd_comp: [
        {
            id: "pd_cp_01",
            badge: "Comp Drop 01",
            cat: "Cassata",
            brand: "Vadilal",
            title: "Vadilal Cassata Jumbo 500ml",
            size: "500 ml",
            delta: -2.1,
            cities: [
                { name: "Kolkata", discount: 22.5, change: 5.4 },
                { name: "Bhubaneswar", discount: 21.8, change: 5.0 },
            ],
        },
        {
            id: "pd_cp_02",
            badge: "Comp Drop 02",
            cat: "Core Tubs",
            brand: "Kwality Walls",
            title: "Kwality Walls Trixy Tub 1 Ltr",
            size: "1 Ltr",
            delta: -1.7,
            cities: [
                { name: "Mumbai", discount: 19.3, change: 4.2 },
                { name: "Pune", discount: 18.7, change: 3.9 },
            ],
        },
        {
            id: "pd_cp_03",
            badge: "Comp Drop 03",
            cat: "Cup",
            brand: "Havmor",
            title: "Havmor Choco Bar 80ml",
            size: "80 ml",
            delta: -1.3,
            cities: [
                { name: "Ahmedabad", discount: 16.1, change: 3.1 },
                { name: "Rajkot", discount: 15.5, change: 2.8 },
            ],
        },
        {
            id: "pd_cp_04",
            badge: "Comp Drop 04",
            cat: "Sandwich",
            brand: "Vadilal",
            title: "Vadilal Choco Sandwich 60ml",
            size: "60 ml",
            delta: -0.9,
            cities: [
                { name: "Bengaluru", discount: 12.8, change: 2.2 },
            ],
        },
    ],

    // COMPETITOR SKUs – Price increased (competitor pulling back discounts)
    pi_comp: [
        {
            id: "pi_cp_01",
            badge: "Comp Hike 01",
            cat: "Core Tubs",
            brand: "Kwality Walls",
            title: "Kwality Walls Feast 1 Ltr Tub",
            size: "1 Ltr",
            delta: 1.8,
            cities: [
                { name: "Delhi NCR", discount: 17.0, change: -3.5 },
                { name: "Lucknow", discount: 16.4, change: -3.1 },
            ],
        },
        {
            id: "pi_cp_02",
            badge: "Comp Hike 02",
            cat: "Cassata",
            brand: "Vadilal",
            title: "Vadilal Party Pack Cassata 750ml",
            size: "750 ml",
            delta: 1.2,
            cities: [
                { name: "Surat", discount: 20.1, change: -2.7 },
                { name: "Ahmedabad", discount: 19.4, change: -2.4 },
            ],
        },
        {
            id: "pi_cp_03",
            badge: "Comp Hike 03",
            cat: "Sandwich",
            brand: "Havmor",
            title: "Havmor Nutty Sandwich 65ml",
            size: "65 ml",
            delta: 0.7,
            cities: [
                { name: "Jaipur", discount: 10.6, change: -1.8 },
                { name: "Udaipur", discount: 10.1, change: -1.5 },
            ],
        },
        {
            id: "pi_cp_04",
            badge: "Comp Hike 04",
            cat: "Cup",
            brand: "Kwality Walls",
            title: "Kwality Walls Cornetto Mini 75ml",
            size: "75 ml",
            delta: 0.4,
            cities: [
                { name: "Hyderabad", discount: 9.3, change: -1.2 },
            ],
        },
    ],
};

/* ─── Derived tab badge tone ─────────────────────────────────────────────── */
function badgeTone(tabKey) {
    if (tabKey === "pd_my" || tabKey === "pd_comp") return "red";
    return "green";
}

function cityChangeTone(tabKey) {
    // For price-drop tabs, the change is positive (discount went up)
    // For price-hike tabs, change is negative (discount went down)
    if (tabKey === "pd_my" || tabKey === "pd_comp") return "emerald";
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

function CardMinimal({ item, tabKey }) {
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

                    <div className="mt-1 text-[11px] font-medium text-slate-500">{item.brand}</div>
                    <div className="mt-1 line-clamp-1 text-[15px] font-semibold text-slate-900">
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
                    {item.cities.slice(0, 2).map((c) => (
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
                                        changeTone === "rose" ? "text-rose-600" : "text-emerald-600"
                                    )}
                                >
                                    {c.change > 0 ? "+" : ""}{c.change.toFixed(1)}%
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <button className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Know more →
            </button>
        </div>
    );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function InsightsPricingView({ loading = false }) {
    const [activeTab, setActiveTab] = useState("pd_my");

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
                    <div>
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
                                        <CardMinimal key={it.id} item={it} tabKey={activeTab} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}