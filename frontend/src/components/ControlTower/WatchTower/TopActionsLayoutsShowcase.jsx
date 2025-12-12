import React, { useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

const issues = [
    {
        id: 1,
        label: "OSA – Quick Commerce NCR",
        subtitle: "62 dark stores OOS in top 4 SKUs",
        leak: "₹1.70 Cr leak",
        tag: "OSA / Availability",
        severity: "high",
    },
    {
        id: 2,
        label: "SOS / SOV – Competitive Visibility",
        subtitle: "Share vs competition across platforms",
        leak: "₹0.90 Cr risk",
        tag: "Visibility",
        severity: "high",
    },
    {
        id: 3,
        label: "Price Elasticity – Demand Sensitivity",
        subtitle: "Volume vs price change impact",
        leak: "₹0.70 Cr pressure",
        tag: "Pricing",
        severity: "medium",
    },
    {
        id: 4,
        label: "PO Fill Rate – Supply Reliability",
        subtitle: "OTIF & fill performance by depot",
        leak: "₹0.33 Cr execution gap",
        tag: "Supply Chain",
        severity: "medium",
    },
    {
        id: 5,
        label: "Offtake – Consumption Momentum",
        subtitle: "Consumer pull vs dispatch trend",
        leak: "₹0.19 Cr slowdown",
        tag: "Demand",
        severity: "low",
    },
    {
        id: 6,
        label: "Performance Marketing – ROI",
        subtitle: "ROAS, CTR & conversion efficiency",
        leak: "₹0.42 Cr inefficiency",
        tag: "Marketing",
        severity: "medium",
    },
];

const severityColor = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const DetailPanel = ({ selected }) => {
    const [showModal, setShowModal] = useState(false);
    const [compareMode, setCompareMode] = useState("week");

    if (!selected) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Select a card on the left to see full intelligence.
            </div>
        );
    }

    const issue1Kpis = [
        { name: "OSA %", value: "91.2%", delta: "-4.1 pt" },
        { name: "Fill Rate", value: "86.4%", delta: "-6.8 pt" },
        { name: "Sales MTD", value: "₹12.4 Cr", delta: "+8.2%" },
        { name: "Lost Sales", value: "₹1.7 Cr", delta: "+22%" },
        { name: "Active Stores", value: "412", delta: "-62" },
        { name: "Hero SKUs", value: "4", delta: "0" },
    ];

    const overallTrendWeek = [
        { day: "D-6", current: 94, compare: 97 },
        { day: "D-5", current: 93, compare: 96 },
        { day: "D-4", current: 91, compare: 95 },
        { day: "D-3", current: 89, compare: 94 },
        { day: "D-2", current: 87, compare: 93 },
        { day: "D-1", current: 84, compare: 92 },
        { day: "Today", current: 82, compare: 92 },
    ];

    const overallTrendMonth = [
        { day: "Wk 1", current: 95, compare: 96 },
        { day: "Wk 2", current: 93, compare: 95 },
        { day: "Wk 3", current: 90, compare: 94 },
        { day: "Wk 4", current: 88, compare: 93 },
    ];

    const darkStoreRows = Array.from({ length: 12 }).map((_, idx) => ({
        store: `Dark Store ${idx + 1}`,
        city: idx < 5 ? "Gurgaon" : idx < 9 ? "Delhi" : "Noida",
        cornetto: idx % 3 === 0 ? "0%" : "35%",
        magnum: idx % 4 === 0 ? "15%" : "42%",
        feast: idx % 2 === 0 ? "0%" : "28%",
        chocobar: idx % 5 === 0 ? "10%" : "31%",
        leak: `₹${(3.2 - idx * 0.12).toFixed(1)}L`,
    }));

    const sosSovKpis = [
        { name: "SOS %", value: "71%", delta: "-6 pt" },
        { name: "SOV %", value: "64%", delta: "-9 pt" },
        { name: "Search Rank (avg)", value: "#6", delta: "-2" },
        { name: "Impression Share", value: "58%", delta: "-7 pt" },
        { name: "Top Slot Presence", value: "43%", delta: "-11 pt" },
        { name: "Hero SKU Coverage", value: "78%", delta: "-8 pt" },
    ];

    const priceElasticityKpis = [
        { name: "Price Index vs Comp", value: "0.96", delta: "-0.04" },
        { name: "Elasticity Coefficient", value: "-1.48", delta: "+0.12" },
        { name: "Volume vs Base", value: "-7.2%", delta: "-2.1 pt" },
        { name: "Promo Lift", value: "+11%", delta: "+4 pt" },
        { name: "Promo Depth (avg)", value: "18%", delta: "+3 pt" },
        { name: "Price Gaps Fixed", value: "37", delta: "+12" },
    ];

    const poFillRateKpis = [
        { name: "PO Fill Rate", value: "86.1%", delta: "-5.9 pt" },
        { name: "OTIF %", value: "82.4%", delta: "-7.1 pt" },
        { name: "Backorder %", value: "9.6%", delta: "+3.2 pt" },
        { name: "Depots < 85%", value: "7", delta: "+3" },
        { name: "Lines Short Shipped", value: "312", delta: "+84" },
        { name: "Avg Lead Time", value: "3.8 days", delta: "+0.6" },
    ];

    const offtakeKpis = [
        { name: "Offtake MTD", value: "₹18.4 Cr", delta: "+6.8%" },
        { name: "Units Sold", value: "9.2 L", delta: "+4.1%" },
        { name: "Repeat Rate", value: "27%", delta: "+3 pt" },
        { name: "Buy Rate", value: "1.42", delta: "+0.12" },
        { name: "Penetration", value: "18%", delta: "+2 pt" },
        { name: "Promo Offtake Share", value: "61%", delta: "+5 pt" },
    ];

    const perfMarketingKpis = [
        { name: "ROAS", value: "3.1", delta: "+0.4" },
        { name: "CTR", value: "2.6%", delta: "+0.7 pt" },
        { name: "CPC", value: "₹6.1", delta: "-₹1.2" },
        { name: "Conversion Rate", value: "9.4%", delta: "+1.6 pt" },
        { name: "Spend vs Plan", value: "112%", delta: "+12 pt" },
        { name: "New Buyers Share", value: "34%", delta: "+4 pt" },
    ];

    const genericKpisByIssue = {
        2: sosSovKpis,
        3: priceElasticityKpis,
        4: poFillRateKpis,
        5: offtakeKpis,
        6: perfMarketingKpis,
    };

    const Header = () => (
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Today’s Focus
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    {selected.label}
                </h2>
                <p className="text-sm text-slate-500">{selected.subtitle}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                    {selected.leak}
                </span>
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {selected.tag}
                </span>
            </div>
        </div>
    );

    if (selected.id === 1) {
        const kpis = issue1Kpis;

        return (
            <div className="relative flex h-full flex-col gap-4 rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">

                <Header />

                {/* KPI GRID */}
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
                    {kpis.map((kpi) => {
                        const negative =
                            kpi.delta.trim().startsWith("-") || kpi.delta.includes("↓");
                        return (
                            <div
                                key={kpi.name}
                                className="rounded-2xl border border-slate-100 bg-white p-3 shadow-xs"
                            >
                                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                    {kpi.name}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {kpi.value}
                                </p>
                                <p
                                    className={`text-[11px] font-medium ${negative ? "text-rose-500" : "text-emerald-600"
                                        }`}
                                >
                                    Δ {kpi.delta}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* TREND CHART */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-600">
                                Average OSA of top 4 SKUs across 62 dark stores
                            </p>
                            <p className="text-[11px] text-slate-500">
                                Compare current period vs last week / last month.
                            </p>
                        </div>

                        <div className="inline-flex items-center rounded-full bg-white p-0.5 text-[10px] shadow-xs">
                            <button
                                onClick={() => setCompareMode("week")}
                                className={`rounded-full px-2 py-0.5 font-medium ${compareMode === "week"
                                    ? "bg-sky-500 text-white"
                                    : "text-slate-500 hover:text-sky-700"
                                    }`}
                            >
                                Week
                            </button>
                            <button
                                onClick={() => setCompareMode("month")}
                                className={`rounded-full px-2 py-0.5 font-medium ${compareMode === "month"
                                    ? "bg-sky-500 text-white"
                                    : "text-slate-500 hover:text-sky-700"
                                    }`}
                            >
                                Month
                            </button>
                        </div>
                    </div>

                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={
                                    compareMode === "week"
                                        ? overallTrendWeek
                                        : overallTrendMonth
                                }
                                margin={{ top: 10, left: -20, right: 10 }}
                            >
                                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={[80, 100]} />
                                <Tooltip contentStyle={{ fontSize: 11 }} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Line
                                    type="monotone"
                                    dataKey="current"
                                    name={
                                        compareMode === "week" ? "This week avg" : "This month avg"
                                    }
                                    stroke="#0f766e"
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="compare"
                                    name={
                                        compareMode === "week" ? "Last week avg" : "Last month avg"
                                    }
                                    stroke="#e11d48"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* DARK STORE GRID */}
                {/* <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-600">
                                Dark store view (top 10 of 62)
                            </p>
                            <p className="text-[11px] text-slate-500">
                                OSA by SKU for each dark store – sorted by highest leak.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-sky-200 hover:text-sky-700"
                        >
                            View all 62 dark stores
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-[11px]">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/80">
                                    <th className="px-2 py-1 font-medium text-slate-500">
                                        Dark store
                                    </th>
                                    <th className="px-2 py-1 font-medium text-slate-500">City</th>
                                    <th className="px-2 py-1 font-medium text-slate-500">
                                        Cornetto OSA
                                    </th>
                                    <th className="px-2 py-1 font-medium text-slate-500">
                                        Magnum OSA
                                    </th>
                                    <th className="px-2 py-1 font-medium text-slate-500">
                                        Feast OSA
                                    </th>
                                    <th className="px-2 py-1 font-medium text-slate-500">
                                        Chocobar OSA
                                    </th>
                                    <th className="px-2 py-1 font-medium text-slate-500">
                                        Leak (₹)
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {darkStoreRows.slice(0, 10).map((row) => (
                                    <tr key={row.store} className="border-b border-slate-50">
                                        <td className="px-2 py-1 text-slate-700">{row.store}</td>
                                        <td className="px-2 py-1 text-slate-500">{row.city}</td>
                                        <td className="px-2 py-1 text-rose-600">{row.cornetto}</td>
                                        <td className="px-2 py-1 text-rose-600">{row.magnum}</td>
                                        <td className="px-2 py-1 text-rose-600">{row.feast}</td>
                                        <td className="px-2 py-1 text-rose-600">{row.chocobar}</td>
                                        <td className="px-2 py-1 font-medium text-rose-600">
                                            {row.leak}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div> */}

                {/* FOOTER */}
                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                    <span className="rounded-full bg-slate-50 px-2 py-1">
                        Lead owner: QC Ecom KAM
                    </span>
                    <span className="rounded-full bg-slate-50 px-2 py-1">ETA: 24–48 hrs</span>
                    <span className="rounded-full bg-slate-50 px-2 py-1">
                        Platforms: Blinkit · Zepto · Instamart
                    </span>
                    <button
                        onClick={() => setShowModal(true)}
                        className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-sky-200 hover:text-sky-700"
                        style={{
                            cursor: "pointer",
                        }}
                    >
                        Show All
                    </button>
                </div>


                {/* MODAL */}
                {showModal && (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                        <div className="max-h-[80vh] w-full max-w-4xl rounded-3xl bg-white p-5 shadow-xl">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">
                                        All 62 dark stores – OSA by SKU
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Use this grid to assign store-level actions to city and
                                        supply teams.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600 hover:border-sky-200 hover:text-sky-700"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="overflow-auto rounded-2xl border border-slate-100">
                                <table className="min-w-full text-left text-[11px]">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/80">
                                            <th className="px-2 py-1 font-medium text-slate-500">
                                                Dark store
                                            </th>
                                            <th className="px-2 py-1 font-medium text-slate-500">
                                                City
                                            </th>
                                            <th className="px-2 py-1 font-medium text-slate-500">
                                                Cornetto OSA
                                            </th>
                                            <th className="px-2 py-1 font-medium text-slate-500">
                                                Magnum OSA
                                            </th>
                                            <th className="px-2 py-1 font-medium text-slate-500">
                                                Feast OSA
                                            </th>
                                            <th className="px-2 py-1 font-medium text-slate-500">
                                                Chocobar OSA
                                            </th>
                                            <th className="px-2 py-1 font-medium text-slate-500">
                                                Leak (₹)
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {darkStoreRows.map((row) => (
                                            <tr key={row.store} className="border-b border-slate-50">
                                                <td className="px-2 py-1 text-slate-700">{row.store}</td>
                                                <td className="px-2 py-1 text-slate-500">{row.city}</td>
                                                <td className="px-2 py-1 text-rose-600">{row.cornetto}</td>
                                                <td className="px-2 py-1 text-rose-600">{row.magnum}</td>
                                                <td className="px-2 py-1 text-rose-600">{row.feast}</td>
                                                <td className="px-2 py-1 text-rose-600">{row.chocobar}</td>
                                                <td className="px-2 py-1 font-medium text-rose-600">
                                                    {row.leak}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // OTHER ISSUE TYPES
    const kpis = genericKpisByIssue[selected.id] || [];

    return (
        <div className="flex h-full flex-col gap-4 rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">

            <Header />

            {/* KPI GRID */}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
                {kpis.map((kpi) => {
                    const negative =
                        kpi.delta.trim().startsWith("-") || kpi.delta.includes("↓");
                    const critical =
                        negative &&
                        (kpi.name.includes("SOS") ||
                            kpi.name.includes("Fill") ||
                            kpi.name.includes("OTIF") ||
                            kpi.name.includes("ROAS"));

                    return (
                        <div
                            key={kpi.name}
                            className="rounded-2xl border border-slate-100 bg-white p-3 shadow-xs"
                        >
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                {kpi.name}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {kpi.value}
                            </p>
                            <p
                                className={`text-[11px] font-medium ${negative ? "text-rose-500" : "text-emerald-600"
                                    }`}
                            >
                                {kpi.delta}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* KPI DETAIL TABLE */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-600">KPI detail view</p>
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                        All KPIs for this issue
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-[11px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                <th className="px-2 py-1 font-medium text-slate-500">KPI</th>
                                <th className="px-2 py-1 font-medium text-slate-500">Current</th>
                                <th className="px-2 py-1 font-medium text-slate-500">Δ vs prev</th>
                                <th className="px-2 py-1 font-medium text-slate-500">Health</th>
                            </tr>
                        </thead>

                        <tbody>
                            {kpis.map((kpi) => {
                                const negative =
                                    kpi.delta.trim().startsWith("-") ||
                                    kpi.delta.includes("↓");
                                const critical =
                                    negative &&
                                    (kpi.name.includes("SOS") ||
                                        kpi.name.includes("Fill") ||
                                        kpi.name.includes("OTIF") ||
                                        kpi.name.includes("ROAS"));

                                return (
                                    <tr key={kpi.name} className="border-b border-slate-50">
                                        <td className="px-2 py-1 text-slate-700">{kpi.name}</td>
                                        <td className="px-2 py-1 text-slate-900">{kpi.value}</td>
                                        <td
                                            className={`px-2 py-1 font-medium ${negative ? "text-rose-500" : "text-emerald-600"
                                                }`}
                                        >
                                            {kpi.delta}
                                        </td>
                                        <td className="px-2 py-1">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${critical
                                                    ? "bg-rose-50 text-rose-600"
                                                    : negative
                                                        ? "bg-amber-50 text-amber-700"
                                                        : "bg-emerald-50 text-emerald-700"
                                                    }`}
                                            >
                                                {critical
                                                    ? "Needs immediate fix"
                                                    : negative
                                                        ? "Watch"
                                                        : "Healthy"}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* FOOTER */}
            <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                <span className="rounded-full bg-slate-50 px-2 py-1">
                    Lead owner: Ecommerce KAM
                </span>
                <span className="rounded-full bg-slate-50 px-2 py-1">ETA: 48 hrs</span>
                <span className="rounded-full bg-slate-50 px-2 py-1">
                    Platforms: Blinkit · Zepto · Instamart · Amazon
                </span>
                <button
                    onClick={() => setShowModal(true)}
                    className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-sky-200 hover:text-sky-700"
                    style={{
                        cursor: "pointer",
                    }}
                >
                    Show All
                </button>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                    <div className="max-h-[80vh] w-full max-w-4xl rounded-3xl bg-white p-5 shadow-xl">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">
                                    All 62 dark stores – OSA by SKU
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    Use this grid to assign store-level actions to city and
                                    supply teams.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600 hover:border-sky-200 hover:text-sky-700"
                            >
                                Close
                            </button>
                        </div>

                        <div className="overflow-auto rounded-2xl border border-slate-100">
                            <table className="min-w-full text-left text-[11px]">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/80">
                                        <th className="px-2 py-1 font-medium text-slate-500">
                                            Dark store
                                        </th>
                                        <th className="px-2 py-1 font-medium text-slate-500">
                                            City
                                        </th>
                                        <th className="px-2 py-1 font-medium text-slate-500">
                                            Cornetto OSA
                                        </th>
                                        <th className="px-2 py-1 font-medium text-slate-500">
                                            Magnum OSA
                                        </th>
                                        <th className="px-2 py-1 font-medium text-slate-500">
                                            Feast OSA
                                        </th>
                                        <th className="px-2 py-1 font-medium text-slate-500">
                                            Chocobar OSA
                                        </th>
                                        <th className="px-2 py-1 font-medium text-slate-500">
                                            Leak (₹)
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {darkStoreRows.map((row) => (
                                        <tr key={row.store} className="border-b border-slate-50">
                                            <td className="px-2 py-1 text-slate-700">{row.store}</td>
                                            <td className="px-2 py-1 text-slate-500">{row.city}</td>
                                            <td className="px-2 py-1 text-rose-600">{row.cornetto}</td>
                                            <td className="px-2 py-1 text-rose-600">{row.magnum}</td>
                                            <td className="px-2 py-1 text-rose-600">{row.feast}</td>
                                            <td className="px-2 py-1 text-rose-600">{row.chocobar}</td>
                                            <td className="px-2 py-1 font-medium text-rose-600">
                                                {row.leak}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

const LayoutOne = () => {
    const [selectedId, setSelectedId] = useState(issues[0].id);
    const selected = issues.find((x) => x.id === selectedId) || null;

    return (
        <section className="grid gap-4 rounded-3xl bg-gradient-to-br bg-white p-5 shadow-sm md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <div className="flex flex-col gap-3 bg-white">

                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">
                            Top actions – top actions for today
                        </h2>
                        <p className="text-xs text-slate-500">
                            Ranked by 7-day leak and opportunity.
                        </p>
                    </div>

                    <button className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 shadow-xs">
                        View full playbook
                    </button>
                </div>

                <div className="flex flex-col gap-2 overflow-hidden rounded-2xl bg-white/70 p-2 backdrop-blur">

                    {issues.map((item, idx) => {
                        const isActive = item.id === selectedId;

                        return (
                            <button
                                key={item.id}
                                onClick={() => setSelectedId(item.id)}
                                className={`group flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition-all ${isActive
                                    ? "border-sky-300 bg-sky-50 shadow-sm"
                                    : "border-transparent bg-white hover:border-sky-200 hover:bg-sky-50/70"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 group-hover:bg-sky-500 group-hover:text-white">
                                        #{idx + 1}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-900">
                                            {item.label}
                                        </p>
                                        <p className="text-[11px] text-slate-500 line-clamp-1">
                                            {item.subtitle}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[11px] font-semibold text-rose-600">
                                        {item.leak}
                                    </span>
                                    <span
                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${severityColor[item.severity]
                                            }`}
                                    >
                                        Priority
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <DetailPanel selected={selected} />
        </section>
    );
};

const TopActionsLayoutsShowcase = () => {
    return (
        <div className="min-h-[500px] w-full bg-white p-4">
            <LayoutOne />
        </div>
    );
};

export default TopActionsLayoutsShowcase;
