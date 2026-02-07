import React, { useState, useMemo, useEffect, useContext } from "react";
import CityDetailedTable from "./CityDetailedTable";
import { KpiFilterPanel } from "../KpiFilterPanel";
import { FilterContext } from "../../utils/FilterContext";
import axiosInstance from "../../api/axiosInstance";
import {
    X,
    SlidersHorizontal,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    Download,
    RefreshCw,
    AlertCircle
} from "lucide-react";

/* ------------------------------------------------------
   Error Component
-------------------------------------------------------*/
const ErrorWithRefresh = ({ onRetry, message }) => (
    <div className="flex flex-col items-center justify-center py-12 px-3 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-4">
            <AlertCircle size={32} color="#ef4444" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">
            API Reference Error
        </h3>
        <p className="text-sm text-slate-500 mb-6 max-w-[300px]">
            {message || "We encountered an issue while fetching the latest data for this segment."}
        </p>
        <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-slate-800 transition-all active:scale-95"
        >
            <RefreshCw size={16} />
            Try Refreshing
        </button>
    </div>
);

/* ------------------------------------------------------
   KPI ORDER CONFIG
-------------------------------------------------------*/
const visibilityKpiOrder = [
    "adPosition",
    "adSos",
    "organicPosition",
    "overallSos",
    "volumeShare",
    "organicSos",
];

const availabilityKpiOrder = [
    "assortment",
    "soh",
    "doi",
    "stockoutRisk",
    "weightedOsa",
];

const salesKpiOrder = [
    "orders",
    "asp",
    "revenueShare",
];

const performanceKpiOrder = [
    "roas",
    "ctr",
    "clicks",
    "atc",
];

const inventoryKpiOrder = [
    "drr",
    "oos",
    "expiryRisk",
];

/* ------------------------------------------------------
   KPI LABELS
-------------------------------------------------------*/
const KPI_LABELS = {
    adPosition: "Ad Pos.",
    adSos: "Ad Sos",
    organicPosition: "Organic Pos.",
    overallSos: "Overall Sos",
    volumeShare: "Volume Share",
    organicSos: "Organic Sos",

    assortment: "Assortment",
    soh: "SOH",
    doi: "DOI",
    stockoutRisk: "Stock-out Risk",
    weightedOsa: "Weighted OSA",
    potentialSalesLoss: "Potential Sales Loss",
    fillrate: "Fillrate",

    orders: "Orders",
    asp: "ASP",
    revenueShare: "Rev Share",

    roas: "ROAS",
    ctr: "CTR",
    clicks: "Clicks",
    atc: "ATC",

    drr: "DRR",
    oos: "OOS",
    expiryRisk: "Expiry Risk",
};

/* ------------------------------------------------------
   Impact Pill (Green/Red)
-------------------------------------------------------*/
function ImpactPill({ value }) {
    const isPositive = value?.trim().startsWith("+");
    const isNegative = value?.trim().startsWith("-");

    let classes =
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border shadow-sm ";

    if (isPositive) classes += "bg-emerald-50 text-emerald-700 border-emerald-200";
    else if (isNegative) classes += "bg-rose-50 text-rose-700 border-rose-200";
    else classes += "bg-slate-100 text-slate-700 border-slate-200";

    return <span className={classes}>{value}</span>;
}

/* ------------------------------------------------------
   Segmented Switch
-------------------------------------------------------*/
function SegmentedSwitch({ options, value, onChange }) {
    return (
        <div className="inline-flex rounded-2xl bg-slate-100 p-1 shadow-inner border border-slate-200">
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={[
                            "px-4 py-1.5 rounded-2xl text-xs font-medium transition-all",
                            active
                                ? "bg-white text-slate-900 shadow translate-y-[-1px]"
                                : "text-slate-500 hover:text-slate-800",
                        ].join(" ")}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

/* ------------------------------------------------------
   FULL SAMPLE DATA
-------------------------------------------------------*/
const SAMPLE_SKUS = [
    /* --- VISIBILITY --- */
    {
        id: "VIS-D01",
        type: "drainer",
        metricType: "visibility",
        skuCode: "KW V01",
        skuName: "Cornetto Double Choco",
        packSize: "120 ml",
        platform: "Blinkit",
        categoryTag: "Cone",
        offtakeValue: "₹ 3.4 lac",
        impact: "-6.2%",
        kpis: {
            adPosition: "3",
            adSos: "14.5%",
            organicPosition: "18",
            overallSos: "9.8%",
            volumeShare: "8.2%",
            organicSos: "6.7%",
        },
        topCities: [
            { city: "Delhi", metric: "Overall Sos 7.2%", change: "-3.4%" },
            { city: "Gurgaon", metric: "Volume Share 6.8%", change: "-2.1%" },
        ],
    },
    {
        id: "VIS-D02",
        type: "drainer",
        metricType: "visibility",
        skuCode: "KW V02",
        skuName: "Kulfi Stick Malai",
        packSize: "60 ml",
        platform: "Zepto",
        categoryTag: "Kulfi",
        offtakeValue: "₹ 2.8 lac",
        impact: "-4.9%",
        kpis: {
            adPosition: "4",
            adSos: "8.9%",
            organicPosition: "22",
            overallSos: "7.4%",
            volumeShare: "5.3%",
            organicSos: "4.1%",
        },
        topCities: [
            { city: "Mumbai", metric: "Ad Sos 6.2%", change: "-2.7%" },
            { city: "Thane", metric: "Organic Sos 3.2%", change: "-1.9%" },
        ],
    },
    {
        id: "VIS-D03",
        type: "drainer",
        metricType: "visibility",
        skuCode: "KW V03",
        skuName: "Magnum Classic",
        packSize: "90 ml",
        platform: "Instamart",
        categoryTag: "Stick",
        offtakeValue: "₹ 2.5 lac",
        impact: "-3.8%",
        kpis: {
            adPosition: "5",
            adSos: "7.5%",
            organicPosition: "25",
            overallSos: "6.8%",
            volumeShare: "4.9%",
            organicSos: "3.5%",
        },
        topCities: [
            { city: "Bangalore", metric: "Ad Sos 5.8%", change: "-2.1%" },
            { city: "Chennai", metric: "Volume Share 4.2%", change: "-1.5%" },
        ],
    },
    {
        id: "VIS-D04",
        type: "drainer",
        metricType: "visibility",
        skuCode: "KW V04",
        skuName: "Choco Chip Tub",
        packSize: "750 ml",
        platform: "BigBasket",
        categoryTag: "Tub",
        offtakeValue: "₹ 2.2 lac",
        impact: "-3.5%",
        kpis: {
            adPosition: "6",
            adSos: "6.2%",
            organicPosition: "28",
            overallSos: "5.5%",
            volumeShare: "4.1%",
            organicSos: "3.1%",
        },
        topCities: [
            { city: "Hyderabad", metric: "Overall Sos 4.9%", change: "-1.8%" },
            { city: "Pune", metric: "Organic Sos 2.8%", change: "-1.2%" },
        ],
    },

    {
        id: "VIS-G01",
        type: "gainer",
        metricType: "visibility",
        skuCode: "KW V06",
        skuName: "Magnum Truffle",
        packSize: "80 ml",
        platform: "Blinkit",
        categoryTag: "Stick",
        offtakeValue: "₹ 4.9 lac",
        impact: "+7.8%",
        kpis: {
            adPosition: "1",
            adSos: "29.4%",
            organicPosition: "4",
            overallSos: "18.6%",
            volumeShare: "15.2%",
            organicSos: "12.3%",
        },
        topCities: [
            { city: "Bangalore", metric: "Ad Sos 34.1%", change: "+9.3%" },
            { city: "Hyderabad", metric: "Volume Share 17.5%", change: "+5.1%" },
        ],
    },
    {
        id: "VIS-G02",
        type: "gainer",
        metricType: "visibility",
        skuCode: "KW V07",
        skuName: "Feast Bar",
        packSize: "90 ml",
        platform: "Zepto",
        categoryTag: "Stick",
        offtakeValue: "₹ 3.9 lac",
        impact: "+5.1%",
        kpis: {
            adPosition: "2",
            adSos: "22.7%",
            organicPosition: "7",
            overallSos: "13.9%",
            volumeShare: "11.4%",
            organicSos: "9.6%",
        },
        topCities: [
            { city: "Pune", metric: "Overall Sos 16.2%", change: "+4.2%" },
            { city: "Mumbai", metric: "Ad Sos 21.5%", change: "+3.7%" },
        ],
    },
    {
        id: "VIS-G03",
        type: "gainer",
        metricType: "visibility",
        skuCode: "KW V08",
        skuName: "Oreo Cone",
        packSize: "110 ml",
        platform: "Instamart",
        categoryTag: "Cone",
        offtakeValue: "₹ 3.5 lac",
        impact: "+4.8%",
        kpis: {
            adPosition: "2",
            adSos: "20.1%",
            organicPosition: "8",
            overallSos: "12.5%",
            volumeShare: "10.1%",
            organicSos: "8.4%",
        },
        topCities: [
            { city: "Delhi", metric: "Volume Share 11.2%", change: "+3.5%" },
            { city: "Gurgaon", metric: "Overall Sos 13.1%", change: "+2.9%" },
        ],
    },
    {
        id: "VIS-G04",
        type: "gainer",
        metricType: "visibility",
        skuCode: "KW V09",
        skuName: "Trixy Cookie",
        packSize: "100 ml",
        platform: "Blinkit",
        categoryTag: "Stick",
        offtakeValue: "₹ 3.2 lac",
        impact: "+4.2%",
        kpis: {
            adPosition: "3",
            adSos: "18.5%",
            organicPosition: "10",
            overallSos: "11.2%",
            volumeShare: "9.5%",
            organicSos: "7.8%",
        },
        topCities: [
            { city: "Chennai", metric: "Ad Sos 19.8%", change: "+3.1%" },
            { city: "Bangalore", metric: "Organic Sos 8.5%", change: "+2.5%" },
        ],
    },

    /* --- AVAILABILITY --- */
    {
        id: "AVL-D01",
        type: "drainer",
        metricType: "availability",
        skuCode: "KW A01",
        skuName: "Family Pack Butterscotch",
        packSize: "700 ml",
        platform: "Blinkit",
        categoryTag: "Tub",
        offtakeValue: "₹ 6.1 lac",
        impact: "-5.3%",
        kpis: {
            soh: "3.1 days",
            doi: "12.4",
            weightedOsa: "88.2%",
        },
        topCities: [
            { city: "Delhi", metric: "OSA 84.1%", change: "-4.5%" },
            { city: "Lucknow", metric: "Fillrate 88.0%", change: "-3.1%" },
        ],
    },
    {
        id: "AVL-D02",
        type: "drainer",
        metricType: "availability",
        skuCode: "KW A02",
        skuName: "Party Pack Mango",
        packSize: "1.3 L",
        platform: "Blinkit",
        categoryTag: "Tub",
        offtakeValue: "₹ 5.4 lac",
        impact: "-3.7%",
        kpis: {
            soh: "1.8 days",
            doi: "7.9",
            weightedOsa: "79.6%",
        },
        topCities: [
            { city: "Chennai", metric: "Stock out 2.3 days", change: "-2.9%" },
            { city: "Coimbatore", metric: "OSA 76.8%", change: "-3.3%" },
        ],
    },
    {
        id: "AVL-D03",
        type: "drainer",
        metricType: "availability",
        skuCode: "KW A03",
        skuName: "Vanilla Cup 100ml",
        packSize: "100 ml",
        platform: "Blinkit",
        categoryTag: "Cup",
        offtakeValue: "₹ 4.8 lac",
        impact: "-3.2%",
        kpis: {
            soh: "2.1 days",
            doi: "8.5",
            weightedOsa: "82.4%",
        },
        topCities: [
            { city: "Bangalore", metric: "OSA 85.2%", change: "-3.8%" },
            { city: "Mysore", metric: "Fillrate 86.5%", change: "-2.5%" },
        ],
    },
    {
        id: "AVL-D04",
        type: "drainer",
        metricType: "availability",
        skuCode: "KW A04",
        skuName: "Strawberry Cone",
        packSize: "110 ml",
        platform: "Blinkit",
        categoryTag: "Cone",
        offtakeValue: "₹ 3.9 lac",
        impact: "-2.9%",
        kpis: {
            soh: "2.5 days",
            doi: "9.2",
            weightedOsa: "85.1%",
        },
        topCities: [
            { city: "Mumbai", metric: "Stock out 1.5 d", change: "-2.1%" },
            { city: "Pune", metric: "OSA 82.3%", change: "-1.8%" },
        ],
    },

    {
        id: "AVL-G01",
        type: "gainer",
        metricType: "availability",
        skuCode: "KW AG01",
        skuName: "Choco Brownie Fudge",
        packSize: "500 ml",
        platform: "Blinkit",
        categoryTag: "Tub",
        offtakeValue: "₹ 4.2 lac",
        impact: "-6.9%",
        kpis: {
            soh: "4.6 days",
            doi: "15.2",
            weightedOsa: "97.4%",
        },
        topCities: [
            { city: "Bangalore", metric: "OSA 99.1%", change: "+3.4%" },
            { city: "Mysore", metric: "Fillrate 99.5%", change: "+2.2%" },
        ],
    },
    {
        id: "AVL-G02",
        type: "gainer",
        metricType: "availability",
        skuCode: "KW AG02",
        skuName: "Chocobar Mini Multi",
        packSize: "6 x 45 ml",
        platform: "Blinkit",
        categoryTag: "Mini",
        offtakeValue: "₹ 3.7 lac",
        impact: "+4.3%",
        kpis: {
            soh: "5.3 days",
            doi: "17.8",
            weightedOsa: "98.6%",
        },
        topCities: [
            { city: "Mumbai", metric: "Assortment 99%", change: "+2.7%" },
            { city: "Ahmedabad", metric: "OSA 98.3%", change: "+1.9%" },
        ],
    },
    {
        id: "AVL-G03",
        type: "gainer",
        metricType: "availability",
        skuCode: "KW AG03",
        skuName: "Black Currant Tub",
        packSize: "750 ml",
        platform: "Blinkit",
        categoryTag: "Tub",
        offtakeValue: "₹ 3.5 lac",
        impact: "+3.8%",
        kpis: {
            soh: "5.1 days",
            doi: "16.5",
            weightedOsa: "96.8%",
        },
        topCities: [
            { city: "Hyderabad", metric: "Fillrate 99.1%", change: "+2.8%" },
            { city: "Vizag", metric: "OSA 98.8%", change: "+2.1%" },
            { city: "Mumbai", metric: "Assortment 99%", change: "+2.7%" },
            { city: "Ahmedabad", metric: "OSA 98.3%", change: "+1.9%" },

        ],
    },
    {
        id: "AVL-G04",
        type: "gainer",
        metricType: "availability",
        skuCode: "KW AG04",
        skuName: "Mango Stick",
        packSize: "60 ml",
        platform: "Blinkit",
        categoryTag: "Stick",
        offtakeValue: "₹ 3.1 lac",
        impact: "+3.2%",
        kpis: {
            soh: "4.8 days",
            doi: "15.9",
            weightedOsa: "95.5%",
        },
        topCities: [
            { city: "Chennai", metric: "Assortment 98%", change: "+2.2%" },
            { city: "Coimbatore", metric: "OSA 96.1%", change: "+1.5%" },
        ],
    },

    /* --- SALES --- */
    {
        id: "SA-KW-D01",
        type: "drainer",
        metricType: "sales",
        skuCode: "KW-D-MPK",
        skuName: "Family Pack Ice Cream",
        packSize: "Mixed",
        platform: "Blinkit",
        categoryTag: "Family Pack",
        offtakeValue: "₹ 6.2 lac",
        impact: "-4.8%",
        kpis: { orders: "8.1k", asp: "₹ 76", revenueShare: "4.9%" },
        topCities: [
            { city: "Mumbai", metric: "Offtake ₹ 2.1 lac", change: "-2.1%" },
            { city: "Pune", metric: "Orders 2.4k", change: "-1.4%" },
        ],
    },
    {
        id: "SA-KW-D02",
        type: "drainer",
        metricType: "sales",
        skuCode: "KW-D-KUL",
        skuName: "Kulfi",
        packSize: "Single",
        platform: "Blinkit",
        categoryTag: "Kulfi",
        offtakeValue: "₹ 4.7 lac",
        impact: "-3.2%",
        kpis: { orders: "6.6k", asp: "₹ 71", revenueShare: "3.8%" },
        topCities: [
            { city: "Delhi", metric: "Offtake ₹ 1.9 lac", change: "-1.8%" },
            { city: "Gurgaon", metric: "Orders 1.6k", change: "-1.1%" },
        ],
    },
    {
        id: "SA-SKU-D01",
        type: "drainer",
        metricType: "sales",
        skuCode: "KW-701",
        skuName: "Butterscotch 700ml",
        packSize: "700 ml",
        platform: "Blinkit",
        categoryTag: "Tub",
        offtakeValue: "₹ 3.8 lac",
        impact: "-5.6%",
        kpis: { orders: "4.2k", asp: "₹ 91", revenueShare: "2.6%" },
        topCities: [
            { city: "Chennai", metric: "Offtake ₹ 1.2 lac", change: "-2.0%" },
            { city: "Coimbatore", metric: "Orders 1.1k", change: "-1.3%" },
        ],
    },
    {
        id: "SA-SKU-D02",
        type: "drainer",
        metricType: "sales",
        skuCode: "KW-703",
        skuName: "Vanilla Party Pack",
        packSize: "1 L",
        platform: "Blinkit",
        categoryTag: "Tub",
        offtakeValue: "₹ 3.5 lac",
        impact: "-4.2%",
        kpis: { orders: "3.8k", asp: "₹ 85", revenueShare: "2.1%" },
        topCities: [
            { city: "Bangalore", metric: "Offtake ₹ 1.1 lac", change: "-1.7%" },
            { city: "Mysore", metric: "Orders 1.0k", change: "-0.9%" },
        ],
    },

    {
        id: "SA-KW-G01",
        type: "gainer",
        metricType: "sales",
        skuCode: "KW-G-CON",
        skuName: "Cone Ice Cream",
        packSize: "Mixed",
        platform: "Blinkit",
        categoryTag: "Cone",
        offtakeValue: "₹ 8.9 lac",
        impact: "+6.0%",
        kpis: { orders: "12.4k", asp: "₹ 72", revenueShare: "6.1%" },
        topCities: [
            { city: "Hyderabad", metric: "Offtake ₹ 2.6 lac", change: "+2.9%" },
            { city: "Bangalore", metric: "Orders 3.1k", change: "+2.1%" },
        ],
    },
    {
        id: "SA-SKU-G01",
        type: "gainer",
        metricType: "sales",
        skuCode: "KW-702",
        skuName: "Magnum Truffle 80ml",
        packSize: "80 ml",
        platform: "Blinkit",
        categoryTag: "Stick",
        offtakeValue: "₹ 7.1 lac",
        impact: "+4.2%",
        kpis: { orders: "9.6k", asp: "₹ 74", revenueShare: "5.4%" },
        topCities: [
            { city: "Delhi", metric: "Offtake ₹ 2.2 lac", change: "+1.7%" },
            { city: "Gurgaon", metric: "Orders 2.3k", change: "+1.2%" },
        ],
    },
    {
        id: "SA-KW-G02",
        type: "gainer",
        metricType: "sales",
        skuCode: "KW-G-BAR",
        skuName: "Choco Bar",
        packSize: "Single",
        platform: "Blinkit",
        categoryTag: "Stick",
        offtakeValue: "₹ 6.5 lac",
        impact: "+5.1%",
        kpis: { orders: "10.2k", asp: "₹ 64", revenueShare: "4.8%" },
        topCities: [
            { city: "Mumbai", metric: "Offtake ₹ 1.8 lac", change: "+2.4%" },
            { city: "Thane", metric: "Orders 2.1k", change: "+1.9%" },
        ],
    },
    {
        id: "SA-SKU-G02",
        type: "gainer",
        metricType: "sales",
        skuCode: "KW-704",
        skuName: "Cornetto Oreo",
        packSize: "110 ml",
        platform: "Blinkit",
        categoryTag: "Cone",
        offtakeValue: "₹ 5.9 lac",
        impact: "+4.5%",
        kpis: { orders: "7.8k", asp: "₹ 75", revenueShare: "4.1%" },
        topCities: [
            { city: "Pune", metric: "Offtake ₹ 1.5 lac", change: "+2.0%" },
            { city: "Nashik", metric: "Orders 1.4k", change: "+1.5%" },
        ],
    },

    /* --- PERFORMANCE MARKETING --- */
    {
        id: "PM-KW-D01",
        type: "drainer",
        metricType: "performance",
        skuCode: "KW-P-TUB",
        skuName: "Ice Cream Tub",
        packSize: "Mixed",
        platform: "Blinkit",
        categoryTag: "Discovery",
        offtakeValue: "₹ 2.9 lac",
        impact: "-3.6%",
        kpis: { roas: "2.1x", ctr: "0.8%", clicks: "18k", atc: "2.4k" },
        topCities: [
            { city: "Delhi", metric: "ROAS 1.9x", change: "-0.2x" },
            { city: "Gurgaon", metric: "CTR 0.7%", change: "-0.1%" },
        ],
    },
    {
        id: "PM-SKU-D01",
        type: "drainer",
        metricType: "performance",
        skuCode: "KW-801",
        skuName: "Belgian Chocolate 500ml",
        packSize: "500 ml",
        platform: "Blinkit",
        categoryTag: "Tub",
        offtakeValue: "₹ 2.0 lac",
        impact: "-4.1%",
        kpis: { roas: "1.8x", ctr: "0.7%", clicks: "12k", atc: "1.3k" },
        topCities: [
            { city: "Pune", metric: "ROAS 1.6x", change: "-0.3x" },
            { city: "Nashik", metric: "Clicks 2.1k", change: "-420" },
        ],
    },
    {
        id: "PM-KW-D02",
        type: "drainer",
        metricType: "performance",
        skuCode: "KW-P-CUP",
        skuName: "Cup Ice Cream",
        packSize: "Small",
        platform: "Blinkit",
        categoryTag: "Cup",
        offtakeValue: "₹ 1.8 lac",
        impact: "-3.2%",
        kpis: { roas: "1.9x", ctr: "0.75%", clicks: "14k", atc: "1.8k" },
        topCities: [
            { city: "Bangalore", metric: "ROAS 1.7x", change: "-0.2x" },
            { city: "Chennai", metric: "CTR 0.6%", change: "-0.1%" },
        ],
    },
    {
        id: "PM-SKU-D02",
        type: "drainer",
        metricType: "performance",
        skuCode: "KW-803",
        skuName: "Vanilla Cup 100ml",
        packSize: "100 ml",
        platform: "Blinkit",
        categoryTag: "Cup",
        offtakeValue: "₹ 1.5 lac",
        impact: "-3.8%",
        kpis: { roas: "1.7x", ctr: "0.6%", clicks: "10k", atc: "1.1k" },
        topCities: [
            { city: "Hyderabad", metric: "ROAS 1.5x", change: "-0.3x" },
            { city: "Mysore", metric: "Clicks 1.5k", change: "-300" },
        ],
    },

    {
        id: "PM-KW-G01",
        type: "gainer",
        metricType: "performance",
        skuCode: "KW-P-MAG",
        skuName: "Magnum Ice Cream",
        packSize: "Stick",
        platform: "Blinkit",
        categoryTag: "Premium",
        offtakeValue: "₹ 4.1 lac",
        impact: "+5.2%",
        kpis: { roas: "3.7x", ctr: "1.6%", clicks: "41k", atc: "5.8k" },
        topCities: [
            { city: "Mumbai", metric: "ROAS 3.9x", change: "+0.4x" },
            { city: "Thane", metric: "ATC 1.6k", change: "+320" },
        ],
    },
    {
        id: "PM-SKU-G01",
        type: "gainer",
        metricType: "performance",
        skuCode: "KW-802",
        skuName: "Cornetto Double Choco",
        packSize: "110 ml",
        platform: "Blinkit",
        categoryTag: "Cone",
        offtakeValue: "₹ 3.7 lac",
        impact: "+3.9%",
        kpis: { roas: "3.2x", ctr: "1.3%", clicks: "27k", atc: "3.9k" },
        topCities: [
            { city: "Chennai", metric: "ROAS 3.4x", change: "+0.2x" },
            { city: "Coimbatore", metric: "ATC 980", change: "+140" },
        ],
    },
    {
        id: "PM-KW-G02",
        type: "gainer",
        metricType: "performance",
        skuCode: "KW-P-FAM",
        skuName: "Family Packs",
        packSize: "Large",
        platform: "Blinkit",
        categoryTag: "Bulk",
        offtakeValue: "₹ 5.2 lac",
        impact: "+4.5%",
        kpis: { roas: "3.5x", ctr: "1.4%", clicks: "35k", atc: "4.5k" },
        topCities: [
            { city: "Delhi", metric: "ROAS 3.8x", change: "+0.3x" },
            { city: "Gurgaon", metric: "ATC 1.2k", change: "+250" },
        ],
    },
    {
        id: "PM-SKU-G02",
        type: "gainer",
        metricType: "performance",
        skuCode: "KW-804",
        skuName: "Trixy Cookie",
        packSize: "100 ml",
        platform: "Blinkit",
        categoryTag: "Stick",
        offtakeValue: "₹ 3.5 lac",
        impact: "+4.1%",
        kpis: { roas: "3.1x", ctr: "1.2%", clicks: "25k", atc: "3.2k" },
        topCities: [
            { city: "Bangalore", metric: "ROAS 3.3x", change: "+0.2x" },
            { city: "Pune", metric: "ATC 850", change: "+180" },
        ],
    },

    /* --- INVENTORY --- */
    {
        id: "IN-KW-D01",
        type: "drainer",
        metricType: "inventory",
        skuCode: "KW-I-KUL",
        skuName: "Kulfi",
        packSize: "Mixed",
        platform: "Blinkit",
        categoryTag: "Kulfi",
        offtakeValue: "₹ 1.8 lac",
        impact: "-2.8%",
        kpis: { doi: "6.1", drr: "82", oos: "11%", expiryRisk: "High" },
        topCities: [
            { city: "Delhi", metric: "DOI 5.4", change: "-0.8" },
            { city: "Gurgaon", metric: "DRR 88", change: "+6" },
        ],
    },
    {
        id: "IN-SKU-D01",
        type: "drainer",
        metricType: "inventory",
        skuCode: "KW-901",
        skuName: "Butterscotch 700ml",
        packSize: "700 ml",
        platform: "Blinkit",
        categoryTag: "Tub",
        offtakeValue: "₹ 2.1 lac",
        impact: "-3.5%",
        kpis: { doi: "4.9", drr: "96", oos: "13%", expiryRisk: "Med" },
        topCities: [
            { city: "Pune", metric: "DOI 4.1", change: "-0.7" },
            { city: "Nashik", metric: "OOS 14%", change: "+2%" },
        ],
    },
    {
        id: "IN-KW-D02",
        type: "drainer",
        metricType: "inventory",
        skuCode: "KW-I-CUP",
        skuName: "Cup Ice Cream",
        packSize: "Small",
        platform: "Blinkit",
        categoryTag: "Cup",
        offtakeValue: "₹ 1.6 lac",
        impact: "-2.5%",
        kpis: { doi: "5.5", drr: "88", oos: "10%", expiryRisk: "Med" },
        topCities: [
            { city: "Mumbai", metric: "DOI 5.0", change: "-0.5" },
            { city: "Thane", metric: "DRR 92", change: "+5" },
        ],
    },
    {
        id: "IN-SKU-D02",
        type: "drainer",
        metricType: "inventory",
        skuCode: "KW-903",
        skuName: "Vanilla Cup 100ml",
        packSize: "100 ml",
        platform: "Blinkit",
        categoryTag: "Cup",
        offtakeValue: "₹ 1.4 lac",
        impact: "-3.1%",
        kpis: { doi: "4.5", drr: "92", oos: "12%", expiryRisk: "High" },
        topCities: [
            { city: "Chennai", metric: "DOI 4.0", change: "-0.6" },
            { city: "Coimbatore", metric: "OOS 13%", change: "+1.5%" },
        ],
    },

    {
        id: "IN-KW-G01",
        type: "gainer",
        metricType: "inventory",
        skuCode: "KW-I-CON",
        skuName: "Cone Ice Cream",
        packSize: "Mixed",
        platform: "Blinkit",
        categoryTag: "Cone",
        offtakeValue: "₹ 3.2 lac",
        impact: "+3.1%",
        kpis: { doi: "14.7", drr: "55", oos: "4%", expiryRisk: "Low" },
        topCities: [
            { city: "Mumbai", metric: "DOI 15.3", change: "+1.2" },
            { city: "Thane", metric: "DRR 52", change: "-4" },
        ],
    },
    {
        id: "IN-SKU-G01",
        type: "gainer",
        metricType: "inventory",
        skuCode: "KW-902",
        skuName: "Magnum Truffle 80ml",
        packSize: "80 ml",
        platform: "Blinkit",
        categoryTag: "Stick",
        offtakeValue: "₹ 2.9 lac",
        impact: "+2.6%",
        kpis: { doi: "12.2", drr: "61", oos: "5%", expiryRisk: "Low" },
        topCities: [
            { city: "Chennai", metric: "DOI 12.8", change: "+0.6" },
            { city: "Coimbatore", metric: "DRR 59", change: "-3" },
        ],
    },
    {
        id: "IN-KW-G02",
        type: "gainer",
        metricType: "inventory",
        skuCode: "KW-I-BAR",
        skuName: "Choco Bar",
        packSize: "Single",
        platform: "Blinkit",
        categoryTag: "Stick",
        offtakeValue: "₹ 2.7 lac",
        impact: "+2.9%",
        kpis: { doi: "13.5", drr: "58", oos: "6%", expiryRisk: "Low" },
        topCities: [
            { city: "Bangalore", metric: "DOI 14.1", change: "+0.8" },
            { city: "Mysore", metric: "DRR 56", change: "-2" },
        ],
    },
    {
        id: "IN-SKU-G02",
        type: "gainer",
        metricType: "inventory",
        skuCode: "KW-904",
        skuName: "Cornetto Oreo",
        packSize: "110 ml",
        platform: "Blinkit",
        categoryTag: "Cone",
        offtakeValue: "₹ 3.0 lac",
        impact: "+3.0%",
        kpis: { doi: "14.0", drr: "54", oos: "4.5%", expiryRisk: "Low" },
        topCities: [
            { city: "Delhi", metric: "DOI 14.8", change: "+1.0" },
            { city: "Gurgaon", metric: "DRR 50", change: "-4" },
        ],
    },
];

/* ------------------------------------------------------
   SIGNAL CARD UI
-------------------------------------------------------*/
function SignalCard({ sku, metricType, onShowDetails }) {
    const [showAllCities, setShowAllCities] = useState(false);
    const citiesToShow = showAllCities ? sku.topCities : sku.topCities.slice(0, 2);

    const kpiOrderMap = {
        visibility: visibilityKpiOrder,
        availability: availabilityKpiOrder,
        sales: salesKpiOrder,
        performance: performanceKpiOrder,
        inventory: inventoryKpiOrder,
    };
    const kpiKeys = kpiOrderMap[metricType] || visibilityKpiOrder;

    const configMap = {
        availability: { label: "Offtake", key: "offtakeValue" },
        sales: { label: "Offtake", key: "offtakeValue" },
        performance: { label: "Offtake", key: "offtakeValue" },
        visibility: { label: "Offtake", key: "offtakeValue" },
        inventory: { label: "DOI", key: "offtakeValue" }
    };

    const config = configMap[metricType] || { label: "Offtake", key: "offtakeValue" };
    const mainValue = config.key === "offtakeValue" ? sku.offtakeValue : (sku.kpis[config.key] || sku.offtakeValue);

    return (
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 w-full transition-all duration-300 hover:translate-y-[-4px] hover:shadow-xl hover:border-indigo-100">
            <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">{sku.skuCode}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-50 border">
                            {sku.categoryTag}
                        </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-50 border text-sky-700">
                        {sku.platform}
                    </span>
                </div>

                <div className="min-h-[40px]">
                    <div className="text-sm font-semibold truncate-2-lines line-clamp-2 leading-tight" title={sku.skuName}>
                        {sku.skuName}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{sku.packSize}</div>
                </div>

                <div className="mt-3 flex justify-between items-end text-xs">
                    <div>
                        <div className="text-slate-400 text-[10px] uppercase font-medium tracking-wider mb-0.5">
                            {config.label}
                        </div>
                        <div className="text-lg font-bold text-slate-900 leading-none">
                            {mainValue}
                        </div>
                    </div>
                    <ImpactPill value={sku.impact} />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                    {/* Secondary KPI: Always show Offtake if it's not the primary metric */}
                    {config.key !== "offtakeValue" && sku.offtakeValue && (
                        <div className="flex items-center gap-1 px-2.5 py-1 text-[10px] bg-slate-50 border rounded-full shadow-sm">
                            <span className="text-slate-500 font-medium">Offtake:</span>
                            <span className="font-bold text-slate-800 text-[11px]">
                                {sku.offtakeValue}
                            </span>
                        </div>
                    )}

                    {kpiKeys.map((key) =>
                        sku.kpis[key] ? (
                            <div
                                key={key}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] bg-white border border-slate-100 rounded-full shadow-sm"
                            >
                                <span className="text-slate-500">{KPI_LABELS[key]}:</span>
                                <span className="font-semibold text-slate-800 text-[11px]">
                                    {sku.kpis[key]?.toString().replace("%", "")}
                                    {key.toLowerCase().includes("sos") || key.toLowerCase().includes("share") ? "%" : ""}
                                </span>
                            </div>
                        ) : null
                    )}
                </div>
            </div>

            <div className="mt-4 pt-3 border-t">
                <div className="text-[11px] font-semibold mb-2">
                    Top impacted cities
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {citiesToShow.map((c) => (
                        <div key={c.city} className="p-2 border rounded-xl bg-slate-50 flex flex-col items-center text-center">
                            <div className="font-medium">{c.city}</div>
                            <div className="text-[10px] text-slate-500">{c.metric?.toString().replace("%", "")}</div>
                            <ImpactPill value={c.change} />
                        </div>
                    ))}
                </div>

                <div className="mt-2 flex justify-end">
                    <button
                        onClick={onShowDetails}
                        className="text-[12px] font-semibold text-sky-600 hover:underline"
                    >
                        More cities
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------
   BASE COMPONENT FOR BOTH VIEWS
-------------------------------------------------------*/
function SignalLabBase({ metricType, usePagination = true, data }) {
    const [signalType, setSignalType] = useState("drainer");
    const [selectedSkuForDetails, setSelectedSkuForDetails] = useState(null);
    const [rowsPerPage, setRowsPerPage] = useState(4);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // API data - initially empty to show loader
    const [skusData, setSkusData] = useState([]);
    const [isUsingApiData, setIsUsingApiData] = useState(false);
    const [loading, setLoading] = useState(!data);
    const [apiError, setApiError] = useState(null);

    // Initial load from props if available
    useEffect(() => {
        if (data) {
            setSkusData(data); // Expecting data to be formatted correctly (array of skus)
            setLoading(false);
        }
    }, [data]);

    // Reset pagination when tab or signal type changes
    useEffect(() => {
        setPage(1);
    }, [metricType, signalType]);

    // Get filters from FilterContext (from Header.jsx)
    const {
        platform,
        selectedBrand,
        selectedLocation,
        timeStart,
        timeEnd,
        compareStart,
        compareEnd,
        refreshFilters
    } = useContext(FilterContext);

    const retrySignalLab = async () => {
        refreshFilters();
        // The useEffect will trigger automatically due to filters/dates dependency
    };

    // Fetch data from API - use API data if successful, otherwise keep sample data
    useEffect(() => {
        if (data) return; // Skip fetch if data is provided

        const controller = new AbortController();
        const signal = controller.signal;
        let isMounted = true;

        const fetchSignalLabData = async () => {
            try {
                setLoading(true);
                setApiError(null);

                // Build query parameters from FilterContext
                const queryParams = new URLSearchParams({
                    platform: platform || 'All',
                    brand: selectedBrand || 'All',
                    location: selectedLocation || 'All',
                    startDate: timeStart ? timeStart.format('YYYY-MM-DD') : '',
                    endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : '',
                    compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : '',
                    compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : '',
                    type: metricType,
                    signalType: signalType,
                    page: 1, // Reset page for Top N view
                    limit: 50 // Fetch a larger sample to ensure representation of top 8
                });

                console.log(`[SignalLabVisibility] Fetching Top ${signalType}s for ${metricType} (Limit 50)`);

                const response = await axiosInstance.get(
                    `/availability-analysis/signal-lab?${queryParams}`,
                    { signal }
                );

                const data = response.data;

                if (isMounted) {
                    console.log('[SignalLabVisibility] API Response received');

                    if (data.skus && data.skus.length > 0) {
                        // Helper to parse impact string (e.g. "+5.2%" -> 5.2)
                        const parseImpact = (str) => {
                            if (!str) return 0;
                            const num = parseFloat(str.replace(/[+%]/g, ''));
                            return isNaN(num) ? 0 : num;
                        };

                        // Sort by impact locally
                        const sorted = [...data.skus].sort((a, b) => {
                            const valA = parseImpact(a.impact);
                            const valB = parseImpact(b.impact);
                            // Gainer: highest at top, Drainer: lowest (most negative) at top
                            return signalType === 'gainer' ? valB - valA : valA - valB;
                        });

                        // Take only top 8
                        const top8 = sorted.slice(0, 8);

                        setSkusData(top8);
                        setTotalCount(top8.length);
                        setIsUsingApiData(true);
                    } else if (data.skus && data.skus.length === 0) {
                        setSkusData([]);
                        setTotalCount(0);
                        setIsUsingApiData(true);
                    } else {
                        // No valid data structure, show empty state
                        setSkusData([]);
                        setTotalCount(0);
                        setIsUsingApiData(true);
                        console.log('[SignalLabVisibility] Invalid API data format');
                    }
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    console.log('[SignalLabVisibility] Fetch aborted');
                    return;
                }
                if (isMounted) {
                    console.error('[SignalLabVisibility] Error fetching API data:', err);
                    setApiError(err.message || "Failed to fetch signal lab data");
                    // If API fails, show empty state instead of sample data
                    setSkusData([]);
                    setTotalCount(0);
                    setIsUsingApiData(true);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchSignalLabData();

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [metricType, platform, selectedBrand, selectedLocation, timeStart, timeEnd, page, rowsPerPage, signalType]);

    // Implement client-side pagination for the Top 8 items
    const filtered = skusData;
    const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
    const safePage = Math.max(1, Math.min(page, totalPages));

    const startIndex = (safePage - 1) * rowsPerPage;
    const pageRows = usePagination ? skusData.slice(startIndex, startIndex + rowsPerPage) : skusData;


    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                    Signal Lab — <span className="text-indigo-600">{selectedBrand || 'All Brands'}</span>
                    <span className="text-slate-400 font-normal ml-2 text-sm">
                        ({metricType === "performance" ? "Performance Marketing" : metricType})
                    </span>
                </h2>

                <div className="relative">
                    <SegmentedSwitch
                        value={signalType}
                        onChange={setSignalType}
                        options={[
                            { value: "drainer", label: "Drainers" },
                            { value: "gainer", label: "Gainers" },
                        ]}
                    />

                    {/* Subtle Top Loader when refreshing existing data */}
                    {loading && skusData.length > 0 && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
                            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border px-3 py-1 rounded-full shadow-sm">
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-sky-600 border-r-transparent"></div>
                                <span className="text-[10px] font-medium text-slate-600 italic">Updating...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Loading State (Overlay style if data exists, otherwise full spinner) */}
            {loading && skusData.length === 0 && (
                <div className="mt-5 flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
                        <p className="mt-3 text-sm text-slate-600">Loading signal lab data...</p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {apiError && !loading && (
                <ErrorWithRefresh onRetry={retrySignalLab} message={apiError} />
            )}

            {/* No Data Found */}
            {!loading && !apiError && filtered.length === 0 && (
                <div className="mt-5 flex items-center justify-center py-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4 mx-auto">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Data Found</h3>
                    <p className="text-sm text-slate-500">
                        No {signalType === 'drainer' ? 'drainers' : 'gainers'} found for the selected filters.
                    </p>
                </div>
            )}

            {/* Data Grid - Responsive Grid layout for perfect alignment on PC screens */}
            {skusData.length > 0 && (
                <div className={`mt-6 transition-opacity duration-300 ${loading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {pageRows.map((s) => (
                            <SignalCard
                                key={s.id}
                                sku={s}
                                metricType={metricType}
                                onShowDetails={() => setSelectedSkuForDetails(s)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {usePagination && (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                    <div className="flex items-center gap-3">
                        <button
                            disabled={safePage === 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="rounded-xl border border-slate-200 px-4 py-2 disabled:opacity-30 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm active:scale-95"
                        >
                            Prev
                        </button>
                        <span className="text-slate-500 text-xs font-medium">
                            Page <b className="text-slate-900">{safePage}</b> / {totalPages}
                        </span>
                        <button
                            disabled={safePage >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="rounded-xl border border-slate-200 px-4 py-2 disabled:opacity-30 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm active:scale-95"
                        >
                            Next
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-slate-500 text-xs font-medium flex items-center gap-2">
                            Rows per page
                            <select
                                value={rowsPerPage}
                                onChange={(e) => {
                                    setPage(1);
                                    setRowsPerPage(Number(e.target.value));
                                }}
                                className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all shadow-sm cursor-pointer"
                            >
                                <option value={4}>4</option>
                                <option value={8}>8</option>
                                <option value={12}>12</option>
                                <option value={20}>20</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}


            {/* Detailed Table Overlay */}
            {selectedSkuForDetails && (
                <CityDetailedTable
                    sku={selectedSkuForDetails}
                    onClose={() => setSelectedSkuForDetails(null)}
                />
            )}
        </>
    );
}


export function SignalLabVisibility({ type, usePagination = true, data }) {
    return <SignalLabBase key={type} metricType={type} usePagination={usePagination} data={data} />;
}

