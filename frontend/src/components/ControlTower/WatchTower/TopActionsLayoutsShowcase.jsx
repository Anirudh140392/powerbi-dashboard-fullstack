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
        subtitle: "12 stores OOS in top 4 SKUs",
        leak: "₹1.70 Cr leak",
        tag: "OSA / Availability",
        severity: "high",
    },
    {
        id: 2,
        label: "SOS – Competitive Visibility",
        subtitle: "Share vs competition across platforms",
        leak: "₹0.90 Cr risk",
        tag: "Visibility",
        severity: "high",
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
        { name: "Active Stores", value: "412", delta: "-12" },
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

    const sosTrendWeek = [
        { day: "D-6", current: 78, compare: 82 },
        { day: "D-5", current: 77, compare: 81 },
        { day: "D-4", current: 75, compare: 81 },
        { day: "D-3", current: 74, compare: 80 },
        { day: "D-2", current: 73, compare: 80 },
        { day: "D-1", current: 72, compare: 79 },
        { day: "Today", current: 71, compare: 79 },
    ];

    const sosTrendMonth = [
        { day: "Wk 1", current: 80, compare: 82 },
        { day: "Wk 2", current: 78, compare: 81 },
        { day: "Wk 3", current: 75, compare: 80 },
        { day: "Wk 4", current: 73, compare: 79 },
    ];

    const offtakeTrendWeek = [
        { day: "D-6", current: 15.2, compare: 14.8 },
        { day: "D-5", current: 15.8, compare: 15.1 },
        { day: "D-4", current: 16.5, compare: 15.4 },
        { day: "D-3", current: 17.2, compare: 15.8 },
        { day: "D-2", current: 17.8, compare: 16.2 },
        { day: "D-1", current: 18.1, compare: 16.5 },
        { day: "Today", current: 18.4, compare: 17.1 },
    ];

    const perfTrendWeek = [
        { day: "D-6", current: 2.5, compare: 2.8 },
        { day: "D-5", current: 2.6, compare: 2.9 },
        { day: "D-4", current: 2.8, compare: 3.0 },
        { day: "D-3", current: 3.0, compare: 3.1 },
        { day: "D-2", current: 3.1, compare: 3.2 },
        { day: "D-1", current: 3.2, compare: 3.1 },
        { day: "Today", current: 3.1, compare: 3.0 },
    ];

    const priceTrendWeek = [
        { day: "D-6", current: 1.02, compare: 0.98 },
        { day: "D-5", current: 1.01, compare: 0.98 },
        { day: "D-4", current: 0.99, compare: 0.97 },
        { day: "D-3", current: 0.98, compare: 0.97 },
        { day: "D-2", current: 0.97, compare: 0.96 },
        { day: "D-1", current: 0.96, compare: 0.96 },
        { day: "Today", current: 0.96, compare: 0.95 },
    ];

    const poTrendWeek = [
        { day: "D-6", current: 92, compare: 94 },
        { day: "D-5", current: 91, compare: 94 },
        { day: "D-4", current: 89, compare: 93 },
        { day: "D-3", current: 88, compare: 93 },
        { day: "D-2", current: 87, compare: 92 },
        { day: "D-1", current: 86.5, compare: 92 },
        { day: "Today", current: 86.1, compare: 92 },
    ];

    const osaStoreRows = [
        { city: "Gurgaon", count: 5, osa: "91.2%", fillRate: "86.4%", sales: "₹2.2 Cr", lostSales: "₹0.4 Cr", heroSkus: "4" },
        { city: "Delhi", count: 4, osa: "88.5%", fillRate: "82.1%", sales: "₹2.1 Cr", lostSales: "₹0.3 Cr", heroSkus: "4" },
        { city: "Noida", count: 3, osa: "85.2%", fillRate: "79.8%", sales: "₹1.2 Cr", lostSales: "₹0.2 Cr", heroSkus: "4" },
        { city: "Mumbai", count: 3, osa: "92.1%", fillRate: "88.5%", sales: "₹1.8 Cr", lostSales: "₹0.2 Cr", heroSkus: "4" },
        { city: "Bengaluru", count: 2, osa: "94.5%", fillRate: "90.2%", sales: "₹1.5 Cr", lostSales: "₹0.1 Cr", heroSkus: "4" },
        { city: "Hyderabad", count: 4, osa: "89.8%", fillRate: "84.5%", sales: "₹1.6 Cr", lostSales: "₹0.2 Cr", heroSkus: "4" },
        { city: "Chennai", count: 3, osa: "87.2%", fillRate: "81.4%", sales: "₹1.2 Cr", lostSales: "₹0.2 Cr", heroSkus: "4" },
        { city: "Pune", count: 2, osa: "90.5%", fillRate: "85.2%", sales: "₹0.8 Cr", lostSales: "₹0.1 Cr", heroSkus: "4" }
    ];

    const sosStoreRows = [
        { city: "Gurgaon", count: 5, sos: "68%", rank: "#8", impression: "52%", topSlot: "38%", hero: "72%" },
        { city: "Delhi", count: 4, sos: "70%", rank: "#7", impression: "55%", topSlot: "41%", hero: "75%" },
        { city: "Noida", count: 3, sos: "65%", rank: "#9", impression: "50%", topSlot: "35%", hero: "70%" },
        { city: "Mumbai", count: 3, sos: "74%", rank: "#5", impression: "62%", topSlot: "48%", hero: "82%" },
        { city: "Bengaluru", count: 2, sos: "78%", rank: "#4", impression: "68%", topSlot: "52%", hero: "85%" },
        { city: "Hyderabad", count: 4, sos: "72%", rank: "#6", impression: "59%", topSlot: "45%", hero: "80%" },
        { city: "Chennai", count: 3, sos: "69%", rank: "#8", impression: "54%", topSlot: "40%", hero: "74%" },
        { city: "Pune", count: 2, sos: "71%", rank: "#7", impression: "57%", topSlot: "43%", hero: "77%" }
    ];

    const offtakeSkuRows = [
        { sku: "Magnum Chocolate Truffle 80ml", value: "₹4.2 Cr", volume: "2.1L", fillRate: "92.4%", contrib: "22.8%" },
        { sku: "Cornetto Choco Vanilla 120ml", value: "₹3.8 Cr", volume: "3.2L", fillRate: "88.1%", contrib: "20.6%" },
        { sku: "Feast Chocolate 70ml", value: "₹2.9 Cr", volume: "2.8L", fillRate: "85.6%", contrib: "15.7%" },
        { sku: "Kulfi Pista 60ml", value: "₹2.4 Cr", volume: "1.9L", fillRate: "90.2%", contrib: "13.0%" },
        { sku: "Magnum Hazelnut 80ml", value: "₹1.8 Cr", volume: "0.9L", fillRate: "84.5%", contrib: "9.8%" },
        { sku: "Cornetto Double Choco 120ml", value: "₹1.5 Cr", volume: "1.2L", fillRate: "86.8%", contrib: "8.1%" },
        { sku: "Paddle Pop Rainbow 60ml", value: "₹1.1 Cr", volume: "1.5L", fillRate: "91.1%", contrib: "6.0%" },
        { sku: "Chocobar Classic 60ml", value: "₹0.7 Cr", volume: "1.1L", fillRate: "89.4%", contrib: "4.0%" }
    ];

    const perfCampaignRows = [
        { campaign: "Magnum - Premium Indulgence", currentRoas: "2.4", prevRoas: "3.2", drop: "-25%", ctr: "1.8%", cpc: "₹8.2", status: "Attention" },
        { campaign: "Cornetto - Summer Vibes", currentRoas: "2.1", prevRoas: "2.8", drop: "-25%", ctr: "1.6%", cpc: "₹7.5", status: "Attention" },
        { campaign: "Feast - Choco Blast", currentRoas: "2.8", prevRoas: "3.1", drop: "-10%", ctr: "2.1%", cpc: "₹6.8", status: "Watch" },
        { campaign: "Kulfi - Local Flavor", currentRoas: "3.2", prevRoas: "3.4", drop: "-6%", ctr: "2.4%", cpc: "₹6.1", status: "Healthy" },
        { campaign: "Paddle Pop - Kids Choice", currentRoas: "1.9", prevRoas: "2.6", drop: "-27%", ctr: "1.4%", cpc: "₹5.9", status: "Attention" },
        { campaign: "Kwality Walls - Family Pack", currentRoas: "3.5", prevRoas: "3.6", drop: "-3%", ctr: "2.8%", cpc: "₹5.4", status: "Healthy" }
    ];

    const priceStoreRows = [
        { city: "Gurgaon", count: 5, index: "0.98", elast: "-1.45", vol: "-6.8%", lift: "+10%", depth: "17%", gaps: "8" },
        { city: "Delhi", count: 4, index: "0.95", elast: "-1.52", vol: "-8.2%", lift: "+12%", depth: "19%", gaps: "7" },
        { city: "Noida", count: 3, index: "1.02", elast: "-1.38", vol: "-5.1%", lift: "+8%", depth: "15%", gaps: "4" },
        { city: "Mumbai", count: 3, index: "0.94", elast: "-1.55", vol: "-9.1%", lift: "+13%", depth: "20%", gaps: "6" },
        { city: "Bengaluru", count: 2, index: "0.92", elast: "-1.62", vol: "-10.5%", lift: "+15%", depth: "22%", gaps: "3" },
        { city: "Hyderabad", count: 4, index: "0.97", elast: "-1.48", vol: "-7.5%", lift: "+11%", depth: "18%", gaps: "5" },
        { city: "Chennai", count: 3, index: "0.96", elast: "-1.46", vol: "-7.0%", lift: "+11%", depth: "18%", gaps: "3" },
        { city: "Pune", count: 2, index: "0.97", elast: "-1.44", vol: "-6.5%", lift: "+10%", depth: "17%", gaps: "2" }
    ];

    const poStoreRows = [
        { city: "Gurgaon", count: 5, fill: "84.2%", otif: "80.1%", backIdx: "10.5%", depots: "2", lines: "68", lead: "4.1" },
        { city: "Delhi", count: 4, fill: "87.5%", otif: "83.8%", backIdx: "8.2%", depots: "1", lines: "54", lead: "3.6" },
        { city: "Noida", count: 3, fill: "82.1%", otif: "78.5%", backIdx: "12.4%", depots: "1", lines: "42", lead: "4.5" },
        { city: "Mumbai", count: 3, fill: "89.4%", otif: "85.2%", backIdx: "7.1%", depots: "1", lines: "48", lead: "3.4" },
        { city: "Bengaluru", count: 2, fill: "92.1%", otif: "88.4%", backIdx: "5.4%", depots: "0", lines: "31", lead: "3.1" },
        { city: "Hyderabad", count: 4, fill: "86.8%", otif: "82.9%", backIdx: "8.9%", depots: "1", lines: "52", lead: "3.7" },
        { city: "Chennai", count: 3, fill: "85.4%", otif: "81.6%", backIdx: "9.2%", depots: "1", lines: "41", lead: "3.9" },
        { city: "Pune", count: 2, fill: "87.0%", otif: "83.1%", backIdx: "8.4%", depots: "0", lines: "26", lead: "3.6" }
    ];

    const sosVisibilityKpis = [
        { name: "SOS %", value: "71%", delta: "-6 pt" },
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
        { name: "Fill Rate", value: "88.2%", delta: "-2.4 pt" },
    ];

    const perfMarketingKpis = [
        { name: "ROAS", value: "3.1", delta: "+0.4" },
        { name: "CTR", value: "2.6%", delta: "+0.7 pt" },
        { name: "CPC", value: "₹6.1", delta: "-₹1.2" },
        { name: "Conversion Rate", value: "9.4%", delta: "+1.6 pt" },
    ];

    const genericKpisByIssue = {
        2: sosVisibilityKpis,
        3: priceElasticityKpis,
        4: poFillRateKpis,
        5: offtakeKpis,
        6: perfMarketingKpis,
    };

    const modalConfigs = {
        1: {
            title: "All 26 stores – OSA Deep Dive",
            headers: ["#Store", "City", "OSA %", "Fill Rate %", "Sales MTD", "Lost Sales", "Hero SKUs"],
            rows: osaStoreRows,
            renderRow: (row) => (
                <tr key={row.city} className="border-b border-slate-50">
                    <td className="px-2 py-1 text-slate-700">{row.count}</td>
                    <td className="px-2 py-1 font-bold text-slate-700">{row.city}</td>
                    <td className="px-2 py-1 text-rose-600 font-semibold">{row.osa}</td>
                    <td className="px-2 py-1 text-rose-600">{row.fillRate}</td>
                    <td className="px-2 py-1 text-emerald-600 font-medium">{row.sales}</td>
                    <td className="px-2 py-1 text-rose-600">{row.lostSales}</td>
                    <td className="px-2 py-1 text-slate-600">{row.heroSkus}</td>
                </tr>
            )
        },
        2: {
            title: "All 26 stores – Competitive Visibility (SOS)",
            headers: ["#Store", "City", "SOS %", "Rank", "Imp. Share", "Top Slot", "Hero Coverage"],
            rows: sosStoreRows,
            renderRow: (row) => (
                <tr key={row.city} className="border-b border-slate-50">
                    <td className="px-2 py-1 text-slate-700">{row.count}</td>
                    <td className="px-2 py-1 font-bold text-slate-700">{row.city}</td>
                    <td className="px-2 py-1 text-rose-600 font-semibold">{row.sos}</td>
                    <td className="px-2 py-1 text-rose-600">{row.rank}</td>
                    <td className="px-2 py-1 text-slate-600">{row.impression}</td>
                    <td className="px-2 py-1 text-slate-600">{row.topSlot}</td>
                    <td className="px-2 py-1 text-slate-600">{row.hero}</td>
                </tr>
            )
        },
        5: {
            title: "SKU-wise Offtake Performance",
            headers: ["SKU Name", "Offtake (Value)", "Volume (Units)", "Fill Rate %", "Contribution %"],
            rows: offtakeSkuRows,
            renderRow: (row) => (
                <tr key={row.sku} className="border-b border-slate-50">
                    <td className="px-2 py-1 font-bold text-slate-700">{row.sku}</td>
                    <td className="px-2 py-1 text-emerald-600 font-medium">{row.value}</td>
                    <td className="px-2 py-1 text-slate-600">{row.volume}</td>
                    <td className="px-2 py-1 text-rose-600 font-medium">{row.fillRate}</td>
                    <td className="px-2 py-1 text-slate-600">{row.contrib}</td>
                </tr>
            )
        },
        6: {
            title: "Campaign-wise Performance – ROAS Drop Analytics",
            headers: ["Campaign Name", "Current ROAS", "Prev. ROAS", "Drop %", "CTR", "CPC", "Status"],
            rows: perfCampaignRows,
            renderRow: (row) => (
                <tr key={row.campaign} className="border-b border-slate-50">
                    <td className="px-2 py-1 font-bold text-slate-700">{row.campaign}</td>
                    <td className="px-2 py-1 text-slate-700 font-medium">{row.currentRoas}</td>
                    <td className="px-2 py-1 text-slate-500">{row.prevRoas}</td>
                    <td className="px-2 py-1 text-rose-600 font-bold">{row.drop}</td>
                    <td className="px-2 py-1 text-slate-600">{row.ctr}</td>
                    <td className="px-2 py-1 text-slate-600">{row.cpc}</td>
                    <td className="px-2 py-1">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${row.status === "Attention" ? "bg-rose-100 text-rose-700" :
                            row.status === "Watch" ? "bg-amber-100 text-amber-700" :
                                "bg-emerald-100 text-emerald-700"
                            }`}>
                            {row.status}
                        </span>
                    </td>
                </tr>
            )
        },
        3: {
            title: "All 26 stores – Price Elasticity & Index",
            headers: ["#Store", "City", "Price Index", "Elasticity", "Volume vs Base", "Promo Lift", "Gaps"],
            rows: priceStoreRows,
            renderRow: (row) => (
                <tr key={row.city} className="border-b border-slate-50">
                    <td className="px-2 py-1 text-slate-700">{row.count}</td>
                    <td className="px-2 py-1 font-bold text-slate-700">{row.city}</td>
                    <td className="px-2 py-1 text-rose-600 font-medium">{row.index}</td>
                    <td className="px-2 py-1 text-slate-600">{row.elast}</td>
                    <td className="px-2 py-1 text-rose-600">{row.vol}</td>
                    <td className="px-2 py-1 text-emerald-600 font-medium">{row.lift}</td>
                    <td className="px-2 py-1 text-rose-600 font-bold">{row.gaps}</td>
                </tr>
            )
        },
        4: {
            title: "All 26 stores – PO Fill Rate & OTIF",
            headers: ["#Store", "City", "Fill Rate %", "OTIF %", "Backorder", "Lines Short", "Lead Time"],
            rows: poStoreRows,
            renderRow: (row) => (
                <tr key={row.city} className="border-b border-slate-50">
                    <td className="px-2 py-1 text-slate-700">{row.count}</td>
                    <td className="px-2 py-1 font-bold text-slate-700">{row.city}</td>
                    <td className="px-2 py-1 text-rose-600 font-semibold">{row.fill}</td>
                    <td className="px-2 py-1 text-rose-600">{row.otif}</td>
                    <td className="px-2 py-1 text-rose-600">{row.backIdx}</td>
                    <td className="px-2 py-1 font-medium text-rose-600">{row.lines}</td>
                    <td className="px-2 py-1 text-slate-600">{row.lead}</td>
                </tr>
            )
        }
    };

    const Header = () => (
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Today’s Focus
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900" style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, fontSize: "1.2rem" }}>
                    {selected.label}
                </h2>
                <p className="text-sm text-slate-500" style={{ fontFamily: "Roboto, sans-serif", fontWeight: 400, fontSize: "0.75rem" }}>{selected.subtitle}</p>
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

    const trendConfigs = {
        1: {
            title: "Average OSA of top 4 SKUs across 26 stores",
            week: overallTrendWeek,
            month: overallTrendMonth,
            domain: [80, 100],
            unit: "%"
        },
        2: {
            title: "Average SOS % across platforms vs competition",
            week: sosTrendWeek,
            month: sosTrendMonth,
            domain: [60, 90],
            unit: "%"
        },
        5: {
            title: "Daily Offtake Value (₹ Cr) vs Last Period",
            week: offtakeTrendWeek,
            month: offtakeTrendWeek, // Reuse or add month later
            domain: [12, 20],
            unit: "Cr"
        },
        6: {
            title: "ROAS Trend - Current vs Baseline",
            week: perfTrendWeek,
            month: perfTrendWeek,
            domain: [2, 4],
            unit: ""
        },
        3: {
            title: "Price Index Relative to Competition (Target: 1.0)",
            week: priceTrendWeek,
            month: priceTrendWeek,
            domain: [0.9, 1.1],
            unit: ""
        },
        4: {
            title: "Order Fill Rate (%) - Targeted vs Actual",
            week: poTrendWeek,
            month: poTrendWeek,
            domain: [80, 100],
            unit: "%"
        }
    };

    const config = trendConfigs[selected.id];
    const kpis = genericKpisByIssue[selected.id] || (selected.id === 1 ? issue1Kpis : []);

    return (
        <div className="relative flex h-full flex-col gap-4 rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
            <Header />

            {/* KPI GRID */}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
                {kpis.slice(0, 6).map((kpi) => {
                    const negative = kpi.delta.trim().startsWith("-") || kpi.delta.includes("↓");
                    return (
                        <div key={kpi.name} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-xs">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400" style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, fontSize: "0.95rem" }}>
                                {kpi.name}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900" style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, fontSize: "0.95rem" }}>
                                {kpi.value}
                            </p>
                            <p className={`text-[11px] font-medium ${negative ? "text-rose-500" : "text-emerald-600"}`} style={{ fontFamily: "Roboto, sans-serif", fontWeight: 400, fontSize: "0.75rem" }}>
                                {kpi.delta}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* TREND CHART */}
            {config && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-600" style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, fontSize: "0.95rem" }}>
                                {config.title}
                            </p>
                            <p className="text-[11px] text-slate-500" style={{ fontFamily: "Roboto, sans-serif", fontWeight: 400, fontSize: "0.75rem" }}>
                                Compare current period vs last period.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="inline-flex items-center rounded-full bg-white p-0.5 text-[10px] shadow-xs">
                                <button
                                    onClick={() => setCompareMode("week")}
                                    className={`rounded-full px-2 py-0.5 font-medium ${compareMode === "week" ? "bg-sky-500 text-white" : "text-slate-500 hover:text-sky-700"}`}
                                >
                                    Week
                                </button>
                                <button
                                    onClick={() => setCompareMode("month")}
                                    className={`rounded-full px-2 py-0.5 font-medium ${compareMode === "month" ? "bg-sky-500 text-white" : "text-slate-500 hover:text-sky-700"}`}
                                >
                                    Month
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={compareMode === "week" ? config.week : config.month}
                                margin={{ top: 10, left: -20, right: 10 }}
                            >
                                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={config.domain} />
                                <Tooltip contentStyle={{ fontSize: 11 }} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Line
                                    type="monotone"
                                    dataKey="current"
                                    name="Current Period"
                                    stroke="#0f766e"
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="compare"
                                    name="Last Period"
                                    stroke="#e11d48"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-2 flex justify-end">
                        <button
                            onClick={() => setShowModal(true)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 shadow-xs hover:border-sky-200 hover:text-sky-700"
                            style={{ cursor: "pointer" }}
                        >
                            Deep Dive
                        </button>
                    </div>
                </div>
            )}


            {/* FOOTER */}
            <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                <span className="rounded-full bg-slate-50 px-2 py-1">Lead owner: Ecommerce KAM</span>
                <span className="rounded-full bg-slate-50 px-2 py-1">ETA: 48 hrs</span>
                <span className="rounded-full bg-slate-50 px-2 py-1">Platforms: Blinkit · Zepto · Instamart</span>
            </div>

            {showModal && modalConfigs[selected.id] && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                    <div className="max-h-[80vh] w-full max-w-4xl rounded-3xl bg-white p-5 shadow-xl">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900" style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, fontSize: "1.2rem" }}>
                                    {modalConfigs[selected.id].title}
                                </h3>
                                <p className="text-[11px] text-slate-500" style={{ fontFamily: "Roboto, sans-serif", fontWeight: 400, fontSize: "0.75rem" }}>
                                    Use this grid to assign store-level actions to city and supply teams.
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600 hover:border-sky-200 hover:text-sky-700">Close</button>
                        </div>
                        <div className="overflow-auto rounded-2xl border border-slate-100" style={{ maxHeight: "260px" }}>
                            <table className="min-w-full text-left text-[11px]">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/80">
                                        {modalConfigs[selected.id].headers.map(h => (
                                            <th key={h} className={`px-2 py-1 ${h === "#Store" ? "font-bold text-slate-800" : "font-medium text-slate-500"}`}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalConfigs[selected.id].rows.map(modalConfigs[selected.id].renderRow)}
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
                        <h2 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 700, fontSize: '1.2rem' }}>
                            Top actions – top actions for today
                        </h2>
                        <p className="text-xs text-slate-500" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 400, fontSize: '0.75rem' }}>
                            Ranked by 7-day leak and opportunity.
                        </p>
                    </div>

                    <button className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 shadow-xs" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 500 }}>
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
                                className={`group flex items-start justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition-all ${isActive
                                    ? "border-sky-300 bg-sky-50 shadow-sm"
                                    : "border-transparent bg-white hover:border-sky-200 hover:bg-sky-50/70"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 group-hover:bg-sky-500 group-hover:text-white">
                                        #{idx + 1}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-900" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 700, fontSize: '0.95rem' }}>
                                            {item.label}
                                        </p>
                                        <p className="text-[11px] text-slate-500 line-clamp-1" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 400, fontSize: '0.75rem' }}>
                                            {item.subtitle}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-1 text-right">
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
        <div className="min-h-[500px] w-full bg-white p-4" style={{ fontFamily: 'Roboto, sans-serif' }}>
            <LayoutOne />
        </div>
    );
};

export default TopActionsLayoutsShowcase;
