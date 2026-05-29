import React, { useState, useMemo, useContext, useEffect, useCallback } from "react";
import { FilterContext } from "../../utils/FilterContext";
import CityDetailedTable from "./CityDetailedTable";
import { KpiFilterPanel } from "../KpiFilterPanel";
import { fetchVisibilitySignals } from "../../api/signalLabService";
import {
    X,
    SlidersHorizontal,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    Download,
    Zap,
    TrendingUp,
    Package,
    MapPin,
    AlertCircle,
    RefreshCw,
    Info
} from "lucide-react";

const ErrorWithRefresh = ({ onRetry, message }) => (
    <div className="flex flex-col items-center justify-center py-12 px-3 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-3">
            <AlertCircle size={32} className="text-rose-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">
            API Reference Error
        </h3>
        <p className="text-sm text-slate-500 mb-4 max-w-[300px]">
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
    "adSos",
    "organicSos",
    "overallSos",
    "weightedOsa",
];

const availabilityKpiOrder = [
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
    "soh",
    "doi",
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
    weightedOsa: "Wt. OSA",
    potentialSalesLoss: "Potential Sales Loss",
    fillrate: "Fillrate",
    offtakeShare: "MS (Offtake Share)",

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
function ImpactPill({ value, theme }) {
    const isPositive = value?.trim().startsWith("+");
    const isNegative = value?.trim().startsWith("-");

    let classes =
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border shadow-sm ";

    if (theme === 'drainer') {
        classes += "bg-rose-50 text-rose-700 border-rose-200";
    } else if (theme === 'gainer') {
        classes += "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else {
        if (isPositive) classes += "bg-emerald-50 text-emerald-700 border-emerald-200";
        else if (isNegative) classes += "bg-rose-50 text-rose-700 border-rose-200";
        else classes += "bg-slate-100 text-slate-700 border-slate-200";
    }

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
        categoryTag: "Tub",
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
    {
        id: "VIS-D05",
        type: "drainer",
        metricType: "visibility",
        skuCode: "KW V05",
        skuName: "Choco Crunch Cone",
        packSize: "110 ml",
        platform: "Zepto",
        categoryTag: "Cone",
        offtakeValue: "₹ 2.1 lac",
        impact: "-4.2%",
        kpis: {
            adPosition: "5",
            adSos: "6.8%",
            organicPosition: "30",
            overallSos: "5.2%",
            volumeShare: "3.9%",
            organicSos: "2.8%",
        },
        topCities: [
            { city: "Mumbai", metric: "Ad Sos 5.1%", change: "-2.4%" },
            { city: "Pune", metric: "Overall Sos 4.8%", change: "-1.9%" },
        ],
    },
    {
        id: "VIS-D10",
        type: "drainer",
        metricType: "visibility",
        skuCode: "KW V10",
        skuName: "Vanilla Tub 1L",
        packSize: "1 L",
        platform: "Instamart",
        categoryTag: "Tub",
        offtakeValue: "₹ 1.8 lac",
        impact: "-3.5%",
        kpis: {
            adPosition: "7",
            adSos: "5.1%",
            organicPosition: "35",
            overallSos: "4.8%",
            volumeShare: "3.2%",
            organicSos: "2.1%",
        },
        topCities: [
            { city: "Delhi", metric: "Overall Sos 4.2%", change: "-2.1%" },
            { city: "Lucknow", metric: "Ad Sos 3.8%", change: "-1.5%" },
        ],
    },
    {
        id: "VIS-G05",
        type: "gainer",
        metricType: "visibility",
        skuCode: "KW V11",
        skuName: "Premium Dark Choco",
        packSize: "90 ml",
        platform: "Zepto",
        categoryTag: "Stick",
        offtakeValue: "₹ 4.5 lac",
        impact: "+5.5%",
        kpis: {
            adPosition: "1",
            adSos: "25.2%",
            organicPosition: "5",
            overallSos: "15.8%",
            volumeShare: "12.4%",
            organicSos: "10.2%",
        },
        topCities: [
            { city: "Mumbai", metric: "Ad Sos 28.4%", change: "+6.2%" },
            { city: "Pune", metric: "Volume Share 14.1%", change: "+3.8%" },
        ],
    },
    {
        id: "VIS-G06",
        type: "gainer",
        metricType: "visibility",
        skuCode: "KW V12",
        skuName: "Cotton Candy Cup",
        packSize: "80 ml",
        platform: "Instamart",
        categoryTag: "Cup",
        offtakeValue: "₹ 3.2 lac",
        impact: "+4.1%",
        kpis: {
            adPosition: "2",
            adSos: "19.8%",
            organicPosition: "12",
            overallSos: "11.5%",
            volumeShare: "9.2%",
            organicSos: "7.5%",
        },
        topCities: [
            { city: "Bangalore", metric: "Overall Sos 13.2%", change: "+4.2%" },
            { city: "Chennai", metric: "Ad Sos 21.5%", change: "+3.1%" },
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
            { city: "Hyderabad", metric: "Fillrate 99.1%", change: "+2.8%", weightage: "18.2%" },
            { city: "Vizag", metric: "OSA 98.8%", change: "+2.1%", weightage: "12.4%" },
            { city: "Mumbai", metric: "Assortment 99%", change: "+2.7%", weightage: "15.1%" },
            { city: "Pune", metric: "OSA 97.5%", change: "+1.5%", weightage: "10.8%" },
        ],
        offtakeShare: "8.4%",
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
    {
        id: "AVL-G-DEF",
        type: "gainer",
        metricType: "availability",
        skuCode: "KW AG01-DEF",
        skuName: "Magnum Truffle (Gainer)",
        packSize: "80 ml",
        platform: "Blinkit",
        categoryTag: "Tub",
        offtakeValue: "₹ 5.2 lac",
        impact: "+6.8%",
        kpis: {
            soh: "5.2 days",
            doi: "18.5",
            weightedOsa: "98.2%",
        },
        topCities: [
            { city: "Delhi", metric: "OSA 98.1%", change: "+4.2%" },
            { city: "Mumbai", metric: "Fillrate 98.5%", change: "+3.1%" },
        ],
    },
    {
        id: "AVL-G-DEF2",
        type: "gainer",
        metricType: "availability",
        skuCode: "KW AG02-DEF",
        skuName: "Cornetto Oreo (Gainer)",
        packSize: "110 ml",
        platform: "Blinkit",
        categoryTag: "Cassata",
        offtakeValue: "₹ 4.8 lac",
        impact: "+5.1%",
        kpis: {
            soh: "4.8 days",
            doi: "16.2",
            weightedOsa: "96.5%",
        },
        topCities: [
            { city: "Delhi", metric: "OSA 97.4%", change: "+3.8%" },
            { city: "Bangalore", metric: "Assortment 98%", change: "+2.5%" },
        ],
    },
    {
        id: "AVL-D05",
        type: "drainer",
        metricType: "availability",
        skuCode: "KW A05",
        skuName: "Pineapple Cup",
        packSize: "100 ml",
        platform: "Zepto",
        categoryTag: "Cup",
        offtakeValue: "₹ 2.4 lac",
        impact: "-3.1%",
        kpis: {
            soh: "1.5 days",
            doi: "6.8",
            weightedOsa: "74.2%",
        },
        topCities: [
            { city: "Ahmedabad", metric: "OSA 70.2%", change: "-4.1%" },
            { city: "Surat", metric: "Stock out 2.8 d", change: "-2.5%" },
        ],
    },
    {
        id: "AVL-D06",
        type: "drainer",
        metricType: "availability",
        skuCode: "KW A06",
        skuName: "Coffee Stick",
        packSize: "60 ml",
        platform: "Instamart",
        categoryTag: "Stick",
        offtakeValue: "₹ 1.9 lac",
        impact: "-2.5%",
        kpis: {
            soh: "2.2 days",
            doi: "8.1",
            weightedOsa: "81.5%",
        },
        topCities: [
            { city: "Kolkata", metric: "OSA 78.4%", change: "-3.2%" },
            { city: "Patna", metric: "Fillrate 80.1%", change: "-2.1%" },
        ],
    },
    {
        id: "AVL-G05",
        type: "gainer",
        metricType: "availability",
        skuCode: "KW AG05",
        skuName: "Rocky Road Tub",
        packSize: "750 ml",
        platform: "Zepto",
        categoryTag: "Tub",
        offtakeValue: "₹ 5.1 lac",
        impact: "+6.2%",
        kpis: {
            soh: "5.5 days",
            doi: "18.2",
            weightedOsa: "98.9%",
        },
        topCities: [
            { city: "Ahmedabad", metric: "OSA 99.5%", change: "+4.2%" },
            { city: "Baroda", metric: "Fillrate 99.8%", change: "+3.5%" },
        ],
    },
    {
        id: "AVL-G06",
        type: "gainer",
        metricType: "availability",
        skuCode: "KW AG06",
        skuName: "Fruit Pop Stick",
        packSize: "45 ml",
        platform: "Instamart",
        categoryTag: "Stick",
        offtakeValue: "₹ 3.8 lac",
        impact: "+4.7%",
        kpis: {
            soh: "4.9 days",
            doi: "16.4",
            weightedOsa: "97.1%",
        },
        topCities: [
            { city: "Hyderabad", metric: "Assortment 98%", change: "+3.1%" },
            { city: "Vizag", metric: "OSA 98.2%", change: "+2.4%" },
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
            { city: "Mumbai", metric: "Offtakes ₹ 2.1 lac", change: "-2.1%" },
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
            { city: "Delhi", metric: "Offtakes ₹ 1.9 lac", change: "-1.8%" },
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
            { city: "Chennai", metric: "Offtakes ₹ 1.2 lac", change: "-2.0%" },
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
            { city: "Bangalore", metric: "Offtakes ₹ 1.1 lac", change: "-1.7%" },
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
            { city: "Hyderabad", metric: "Offtakes ₹ 2.6 lac", change: "+2.9%" },
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
            { city: "Delhi", metric: "Offtakes ₹ 2.2 lac", change: "+1.7%" },
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
            { city: "Mumbai", metric: "Offtakes ₹ 1.8 lac", change: "+2.4%" },
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
            { city: "Pune", metric: "Offtakes ₹ 1.5 lac", change: "+2.0%" },
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
// Skeleton card for loading state
const SkeletonCard = () => (
    <div className="flex-none flex flex-col justify-between rounded-2xl border border-slate-100 bg-white shadow-sm px-4 py-3 w-[260px] animate-pulse">
        <div className="flex justify-between items-start">
            <div className="w-full">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
            </div>
            <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
        </div>
        <div className="mt-4 flex gap-4">
            <div className="flex-1 h-8 bg-slate-100 rounded-xl"></div>
            <div className="flex-1 h-8 bg-slate-100 rounded-xl"></div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-50">
            <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
            <div className="flex justify-between">
                <div className="h-3 bg-slate-100 rounded w-1/4"></div>
                <div className="h-3 bg-slate-100 rounded w-1/4"></div>
            </div>
        </div>
    </div>
);

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

    const PRIMARY_METRICS = {
        visibility: { label: "Overall Sos", key: "overallSos" },
        availability: { label: "Overall OSA", key: "weightedOsa" }
    };

    const primary = PRIMARY_METRICS[metricType] || { label: "Offtakes", key: "offtakeValue" };
    // Fallback to offtakeValue if the key is not in kpis (though it should be for our mapped types)
    const primaryValue = primary.key === "offtakeValue" ? sku.offtakeValue : (sku.kpis[primary.key] || sku.offtakeValue);

    return (
        <div className="flex-none flex flex-col justify-between rounded-2xl border border-slate-200 bg-white shadow px-4 py-3 w-[260px] capitalize">
            <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-50 border">
                            {sku.categoryTag}
                        </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-50 border text-sky-700">
                        {sku.platform}
                    </span>
                </div>

                <div>
                    {sku.groupBy === 'brand' && (
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Brand</div>
                    )}
                    <div className="text-sm font-semibold line-clamp-2" title={sku.skuName}>{sku.skuName}</div>
                    {sku.packSize && sku.packSize !== '-' && (
                        <div className="text-xs text-slate-500">{sku.packSize}</div>
                    )}
                </div>

                <div className="mt-3 flex justify-between items-end text-xs">
                    <div>
                        <div className="text-slate-400">
                            {metricType === "inventory" ? "DOI" : "Offtakes"}
                        </div>
                        <div className="text-base font-semibold">
                            {metricType === "inventory" ? (sku.kpis?.doi || '-') : sku.offtakeValue}
                        </div>
                    </div>
                    <ImpactPill value={sku.impact} theme={sku.type} />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                    {kpiKeys.map((key) =>
                        sku.kpis[key] ? (
                            <div
                                key={key}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] bg-slate-50 border rounded-full"
                            >
                                <span className="text-slate-500">{KPI_LABELS[key]}:</span>
                                <span className="font-semibold text-slate-800 text-[11px]">
                                    {sku.kpis[key]?.toString().replace("%", "")}
                                </span>
                            </div>
                        ) : null
                    )}

                    {sku.offtakeShare && (
                        <div className="flex items-center gap-1 px-2.5 py-1 text-[10px] bg-slate-50 border rounded-full">
                            <span className="text-slate-500">Offtake Share :</span>
                            <span className="font-semibold text-slate-800 text-[11px]">{sku.offtakeShare}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 pt-3 border-t">
                <div className="text-[11px] font-semibold mb-2">
                    Top Impacted Cities
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {sku.topCities?.slice(0, 2).map((c) => (
                        <div key={c.city} className="p-1.5 border rounded-xl bg-slate-50/50 flex flex-col items-center text-center">
                            <div className="font-semibold text-slate-700 text-[10px] truncate w-full px-1" title={c.city}>
                                {c.city}
                            </div>
                            <div className="text-[9px] text-slate-500 my-0.5 leading-tight">
                                {c.metric?.toString().replace("%", "")}
                            </div>
                            <ImpactPill value={c.change} theme={sku.type} />
                        </div>
                    ))}
                </div>

                <div className="mt-3 flex items-center justify-end">
                    <button
                        onClick={onShowDetails}
                        className="text-[10px] font-bold text-sky-600 hover:text-sky-700 underline underline-offset-2 flex items-center gap-0.5 transition-all active:scale-95"
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
function SignalLabBase({ metricType, usePagination = true, loading = false }) {
    const [signalType, setSignalType] = useState("drainer");
    const [selectedSkuForDetails, setSelectedSkuForDetails] = useState(null);
    const [isInternalLoading, setIsInternalLoading] = useState(true);

    const isLoading = isInternalLoading || loading;

    const {
        platform: globalPlatform,
        selectedCategory,
        selectedLocation,
        selectedBrand,
        selectedChannel,
        timeStart,
        timeEnd,
        selectedKeyword
    } = useContext(FilterContext);

    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [page, setPage] = useState(1);

    // State for real API data
    const [apiSkus, setApiSkus] = useState(null); // null = not fetched yet
    const [totalCount, setTotalCount] = useState(0);
    const [apiError, setApiError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    // Fetch real data from backend API
    useEffect(() => {
        let cancelled = false;
        setIsInternalLoading(true);
        setApiError(null);
        setPage(1); // Reset to page 1 on filter change

        const fetchSignalLab = async () => {
            try {
                const token = sessionStorage.getItem('token');
                const params = new URLSearchParams();
                params.append('type', metricType);
                params.append('signalType', signalType);
                params.append('page', '1');
                params.append('limit', String(rowsPerPage));

                if (globalPlatform && globalPlatform !== 'All') {
                    if (Array.isArray(globalPlatform)) {
                        params.append('platform', globalPlatform.join(','));
                    } else {
                        params.append('platform', globalPlatform);
                    }
                }
                if (selectedLocation && selectedLocation !== 'All') {
                    if (Array.isArray(selectedLocation)) {
                        params.append('location', selectedLocation.map(l => l.toLowerCase()).join(','));
                    } else {
                        params.append('location', selectedLocation.toLowerCase());
                    }
                }
                if (selectedBrand && selectedBrand !== 'All') {
                    if (Array.isArray(selectedBrand)) {
                        params.append('brand', selectedBrand.join(','));
                    } else {
                        params.append('brand', selectedBrand);
                    }
                }
                if (selectedChannel && selectedChannel !== 'All') {
                    params.append('channel', selectedChannel);
                }
                if (selectedCategory && selectedCategory !== 'All') {
                    if (Array.isArray(selectedCategory)) {
                        params.append('category', selectedCategory.join(','));
                    } else {
                        params.append('category', selectedCategory);
                    }
                }
                if (timeStart) params.append('startDate', typeof timeStart === 'string' ? timeStart : timeStart.format('YYYY-MM-DD'));
                if (timeEnd) params.append('endDate', typeof timeEnd === 'string' ? timeEnd : timeEnd.format('YYYY-MM-DD'));
                if (selectedKeyword && selectedKeyword !== 'All') params.append('keyword', selectedKeyword);

                // Group by brand for visibility, otherwise group by SKU
                const groupByValue = (metricType === 'visibility') ? 'brand' : 'sku';
                params.append('groupBy', groupByValue);

                const res = await fetch(`/api/availability-analysis/signal-lab?${params.toString()}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                if (!cancelled) {
                    setApiSkus(data.skus || []);
                    setTotalCount(data.totalCount || 0);
                }
            } catch (err) {
                console.error('[SignalLab] API error, falling back to sample data:', err);
                if (!cancelled) {
                    setApiError(err.message);
                    // Fallback to filtered SAMPLE_SKUS
                    const fallback = SAMPLE_SKUS.filter(s => s.metricType === metricType && s.type === signalType);
                    setApiSkus(fallback);
                    setTotalCount(fallback.length);
                }
            } finally {
                if (!cancelled) setIsInternalLoading(false);
            }
        };

        fetchSignalLab();
        return () => { cancelled = true; };
    }, [metricType, signalType, globalPlatform, selectedCategory, selectedLocation, selectedBrand, selectedChannel, timeStart, timeEnd, selectedKeyword, retryCount]);

    // Fetch when page or rowsPerPage changes (server-side pagination)
    useEffect(() => {
        // Skip initial render (handled by the filter useEffect above)
        if (apiSkus === null) return;

        let cancelled = false;
        setIsInternalLoading(true);

        const fetchPage = async () => {
            try {
                const token = sessionStorage.getItem('token');
                const params = new URLSearchParams();
                params.append('type', metricType);
                params.append('signalType', signalType);
                params.append('page', String(page));
                params.append('limit', String(rowsPerPage));

                if (globalPlatform && globalPlatform !== 'All') {
                    if (Array.isArray(globalPlatform)) {
                        params.append('platform', globalPlatform.join(','));
                    } else {
                        params.append('platform', globalPlatform);
                    }
                }
                if (selectedLocation && selectedLocation !== 'All') {
                    if (Array.isArray(selectedLocation)) {
                        params.append('location', selectedLocation.map(l => l.toLowerCase()).join(','));
                    } else {
                        params.append('location', selectedLocation.toLowerCase());
                    }
                }
                if (selectedBrand && selectedBrand !== 'All') {
                    if (Array.isArray(selectedBrand)) {
                        params.append('brand', selectedBrand.join(','));
                    } else {
                        params.append('brand', selectedBrand);
                    }
                }
                if (selectedChannel && selectedChannel !== 'All') {
                    params.append('channel', selectedChannel);
                }
                if (selectedCategory && selectedCategory !== 'All') {
                    if (Array.isArray(selectedCategory)) {
                        params.append('category', selectedCategory.join(','));
                    } else {
                        params.append('category', selectedCategory);
                    }
                }
                if (timeStart) params.append('startDate', typeof timeStart === 'string' ? timeStart : timeStart.format('YYYY-MM-DD'));
                if (timeEnd) params.append('endDate', typeof timeEnd === 'string' ? timeEnd : timeEnd.format('YYYY-MM-DD'));
                if (selectedKeyword && selectedKeyword !== 'All') params.append('keyword', selectedKeyword);
                // Group by brand for visibility, otherwise group by SKU (same logic as initial fetch)
                const groupByValue = (metricType === 'visibility') ? 'brand' : 'sku';
                params.append('groupBy', groupByValue);

                const res = await fetch(`/api/availability-analysis/signal-lab?${params.toString()}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                if (!cancelled) {
                    setApiSkus(data.skus || []);
                    setTotalCount(data.totalCount || 0);
                }
            } catch (err) {
                console.error('[SignalLab] Pagination fetch error:', err);
            } finally {
                if (!cancelled) setIsInternalLoading(false);
            }
        };

        fetchPage();
        return () => { cancelled = true; };
    }, [page, rowsPerPage, selectedKeyword, retryCount]);

    const filtered = apiSkus || [];
    const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
    const safePage = Math.max(1, Math.min(page, totalPages));

    // For API data, pagination is server-side so pageRows = filtered directly
    const pageRows = useMemo(() => {
        return filtered;
    }, [filtered]);


    return (
        <>
            <div className="flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-lg font-semibold capitalize flex items-center gap-2">
                    Signal Lab - {(() => { try { const u = JSON.parse(sessionStorage.getItem('user')); return u?.dbName ? u.dbName.charAt(0).toUpperCase() + u.dbName.slice(1) : 'Brand'; } catch { return 'Brand'; } })()} ({metricType === "performance" ? "Performance Marketing" : metricType})
                    <div className="group relative cursor-help">
                        <Info size={16} className="text-slate-400 hover:text-sky-500 transition-colors" />
                        <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 font-normal normal-case leading-relaxed">
                            <div className="font-bold mb-1 border-b border-white/10 pb-1">Signal Logic</div>
                            Gainers and Drainers are calculated based on a minimum <b>5% increment or decrement</b> in OSA (On-Shelf Availability) compared to the previous period.
                        </div>
                    </div>
                </h2>

                <SegmentedSwitch
                    value={signalType}
                    onChange={setSignalType}
                    options={[
                        { value: "drainer", label: "Drainers" },
                        { value: "gainer", label: "Gainers" },
                    ]}
                />
            </div>

            <div className="mt-5 min-h-[400px]">
                {isLoading ? (
                    <div className="flex overflow-x-auto gap-4 items-start pb-4 snap-x">
                        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="snap-start"><SkeletonCard /></div>)}
                    </div>
                ) : apiError ? (
                    <ErrorWithRefresh onRetry={() => {
                        setRetryCount(c => c + 1);
                    }} message={apiError} />
                ) : filtered.length > 0 ? (
                    <div className="flex overflow-x-auto gap-4 items-stretch border-b border-t py-4 snap-x custom-scrollbar">
                        {pageRows.map((s) => (
                            <div key={s.id} className="snap-start">
                                <SignalCard
                                    sku={s}
                                    metricType={metricType}
                                    onShowDetails={() => setSelectedSkuForDetails(s)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                        <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                            <Zap className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium">No results found for current filters</p>
                        <p className="text-slate-400 text-xs mt-1">Try adjusting your global or signal selections</p>
                    </div>
                )}
            </div>

            {usePagination && (
                <div className="mt-6 flex items-center justify-between text-[11px] px-4 py-3 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                        <button
                            disabled={safePage === 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-40 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                        >
                            Prev
                        </button>

                        <span className="text-slate-600">
                            Page <b className="text-slate-900">{safePage}</b> / {totalPages}
                        </span>

                        <button
                            disabled={safePage >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-40 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                        >
                            Next
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-slate-600">
                            Rows/page
                            <select
                                value={rowsPerPage}
                                onChange={(e) => {
                                    setPage(1);
                                    setRowsPerPage(Number(e.target.value));
                                }}
                                className="ml-1 rounded-full border border-slate-200 px-2 py-1 bg-white outline-none focus:border-slate-400 text-slate-700"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={15}>15</option>
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


export function SignalLabVisibility({ type, usePagination = true, loading = false }) {
    return <SignalLabBase metricType={type} usePagination={usePagination} loading={loading} />;
}

