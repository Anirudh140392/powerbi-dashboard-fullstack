import React, { useState } from "react";

/* ------------------------------------------------------
   KPI ORDER CONFIG
-------------------------------------------------------*/
const visibilityKpiOrder = [
    "adPosition",
    "adSov",
    "organicPosition",
    "overallSov",
    "volumeShare",
    "organicSov",
];

const availabilityKpiOrder = [
    "assortment",
    "soh",
    "doi",
    "stockoutRisk",
    "weightedOsa",
    "potentialSalesLoss",
    "fillrate",
];

/* ------------------------------------------------------
   KPI LABELS
-------------------------------------------------------*/
const KPI_LABELS = {
    adPosition: "Ad Pos.",
    adSov: "Ad SOV",
    organicPosition: "Organic Pos.",
    overallSov: "Overall SOV",
    volumeShare: "Volume Share",
    organicSov: "Organic SOV",

    assortment: "Assortment",
    soh: "SOH",
    doi: "DOI",
    stockoutRisk: "Stock-out Risk",
    weightedOsa: "Weighted OSA",
    potentialSalesLoss: "Potential Sales Loss",
    fillrate: "Fillrate",
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
   FULL SAMPLE DATA (20 SKUs)
-------------------------------------------------------*/
const SAMPLE_SKUS = [
    /* --------------------------------------------------
       VISIBILITY — DRAINERS (5)
    -------------------------------------------------- */
    {
        id: "KW-V-D01",
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
            adSov: "14.5%",
            organicPosition: "18",
            overallSov: "9.8%",
            volumeShare: "8.2%",
            organicSov: "6.7%",
        },
        topCities: [
            { city: "Delhi", metric: "Overall SOV 7.2%", change: "-3.4%" },
            { city: "Gurgaon", metric: "Volume Share 6.8%", change: "-2.1%" },
        ],
    },
    {
        id: "KW-V-D02",
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
            adSov: "8.9%",
            organicPosition: "22",
            overallSov: "7.4%",
            volumeShare: "5.3%",
            organicSov: "4.1%",
        },
        topCities: [
            { city: "Mumbai", metric: "Ad SOV 6.2%", change: "-2.7%" },
            { city: "Thane", metric: "Organic SOV 3.2%", change: "-1.9%" },
        ],
    },
    {
        id: "KW-V-D03",
        type: "drainer",
        metricType: "visibility",
        skuCode: "KW V03",
        skuName: "Magnum Almond",
        packSize: "80 ml",
        platform: "Instamart",
        categoryTag: "Stick",
        offtakeValue: "₹ 3.1 lac",
        impact: "-5.4%",
        kpis: {
            adPosition: "5",
            adSov: "7.1%",
            organicPosition: "25",
            overallSov: "6.5%",
            volumeShare: "4.9%",
            organicSov: "3.7%",
        },
        topCities: [
            { city: "Pune", metric: "Ad SOV 5.1%", change: "-2.3%" },
            { city: "Nashik", metric: "Organic Pos. 24", change: "-1.8%" },
        ],
    },
    {
        id: "KW-V-D04",
        type: "drainer",
        metricType: "visibility",
        skuCode: "KW V04",
        skuName: "Feast Chocolate Bar",
        packSize: "90 ml",
        platform: "Blinkit",
        categoryTag: "Stick",
        offtakeValue: "₹ 2.6 lac",
        impact: "-3.8%",
        kpis: {
            adPosition: "6",
            adSov: "6.5%",
            organicPosition: "21",
            overallSov: "7.2%",
            volumeShare: "4.7%",
            organicSov: "3.8%",
        },
        topCities: [
            { city: "Bangalore", metric: "Overall SOV 6.1%", change: "-1.9%" },
            { city: "Hyderabad", metric: "Ad SOV 5.7%", change: "-2.2%" },
        ],
    },
    {
        id: "KW-V-D05",
        type: "drainer",
        metricType: "visibility",
        skuCode: "KW V05",
        skuName: "Chocobar Classic",
        packSize: "60 ml",
        platform: "Zepto",
        categoryTag: "Stick",
        offtakeValue: "₹ 3.0 lac",
        impact: "-4.1%",
        kpis: {
            adPosition: "7",
            adSov: "5.9%",
            organicPosition: "23",
            overallSov: "6.8%",
            volumeShare: "4.4%",
            organicSov: "3.1%",
        },
        topCities: [
            { city: "Chennai", metric: "Volume Share 4.2%", change: "-1.5%" },
            { city: "Coimbatore", metric: "Organic SOV 3.0%", change: "-1.8%" },
        ],
    },

    /* --------------------------------------------------
       VISIBILITY — GAINERS (5)
    -------------------------------------------------- */
    {
        id: "KW-V-G01",
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
            adSov: "29.4%",
            organicPosition: "4",
            overallSov: "18.6%",
            volumeShare: "15.2%",
            organicSov: "12.3%",
        },
        topCities: [
            { city: "Bangalore", metric: "Ad SOV 34.1%", change: "+9.3%" },
            { city: "Hyderabad", metric: "Volume Share 17.5%", change: "+5.1%" },
        ],
    },
    {
        id: "KW-V-G02",
        type: "gainer",
        metricType: "visibility",
        skuCode: "KW V07",
        skuName: "Feast Chocolate Bar",
        packSize: "90 ml",
        platform: "Instamart",
        categoryTag: "Stick",
        offtakeValue: "₹ 3.9 lac",
        impact: "+5.1%",
        kpis: {
            adPosition: "2",
            adSov: "22.7%",
            organicPosition: "7",
            overallSov: "13.9%",
            volumeShare: "11.4%",
            organicSov: "9.6%",
        },
        topCities: [
            { city: "Pune", metric: "Overall SOV 16.2%", change: "+4.2%" },
            { city: "Navi Mumbai", metric: "Ad SOV 21.5%", change: "+3.7%" },
        ],
    },
    {
        id: "KW-V-G03",
        type: "gainer",
        metricType: "visibility",
        skuCode: "KW V08",
        skuName: "Cornetto Butterscotch",
        packSize: "135 ml",
        platform: "Zepto",
        categoryTag: "Cone",
        offtakeValue: "₹ 4.1 lac",
        impact: "+6.3%",
        kpis: {
            adPosition: "1",
            adSov: "18.1%",
            organicPosition: "6",
            overallSov: "14.7%",
            volumeShare: "12.3%",
            organicSov: "10.1%",
        },
        topCities: [
            { city: "Delhi", metric: "Ad SOV 20.2%", change: "+5.2%" },
            { city: "Gurgaon", metric: "Organic SOV 11.1%", change: "+3.2%" },
        ],
    },
    {
        id: "KW-V-G04",
        type: "gainer",
        metricType: "visibility",
        skuCode: "KW V09",
        skuName: "Choco Fudge Cup",
        packSize: "100 ml",
        platform: "Blinkit",
        categoryTag: "Cup",
        offtakeValue: "₹ 3.6 lac",
        impact: "+4.7%",
        kpis: {
            adPosition: "3",
            adSov: "15.4%",
            organicPosition: "9",
            overallSov: "12.2%",
            volumeShare: "9.8%",
            organicSov: "8.7%",
        },
        topCities: [
            { city: "Lucknow", metric: "Volume Share 10.4%", change: "+2.8%" },
            { city: "Kanpur", metric: "Ad SOV 14.8%", change: "+2.1%" },
        ],
    },
    {
        id: "KW-V-G05",
        type: "gainer",
        metricType: "visibility",
        skuCode: "KW V10",
        skuName: "Strawberry Cup",
        packSize: "100 ml",
        platform: "Instamart",
        categoryTag: "Cup",
        offtakeValue: "₹ 3.3 lac",
        impact: "+3.9%",
        kpis: {
            adPosition: "4",
            adSov: "13.8%",
            organicPosition: "11",
            overallSov: "10.9%",
            volumeShare: "8.9%",
            organicSov: "7.5%",
        },
        topCities: [
            { city: "Chennai", metric: "Overall SOV 11.8%", change: "+2.5%" },
            { city: "Coimbatore", metric: "Volume Share 9.1%", change: "+1.8%" },
        ],
    },

    /* --------------------------------------------------
   AVAILABILITY — DRAINERS (5)
-------------------------------------------------- */
{
    id: "KW-A-D01",
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
    id: "KW-A-D02",
    type: "drainer",
    metricType: "availability",
    skuCode: "KW A02",
    skuName: "Party Pack Mango",
    packSize: "1.3 L",
    platform: "Flipkart",
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
    id: "KW-A-D03",
    type: "drainer",
    metricType: "availability",
    skuCode: "KW A03",
    skuName: "Kulfi Assorted Box",
    packSize: "10 sticks",
    platform: "Instamart",
    categoryTag: "Box",
    offtakeValue: "₹ 3.2 lac",
    impact: "-3.3%",
    kpis: {
        soh: "1.5 days",
        doi: "6.7",
        weightedOsa: "78.4%",
    },
    topCities: [
        { city: "Jaipur", metric: "OSA 77.1%", change: "-2.7%" },
        { city: "Udaipur", metric: "Fillrate 85.4%", change: "-2.0%" },
    ],
},
{
    id: "KW-A-D04",
    type: "drainer",
    metricType: "availability",
    skuCode: "KW A04",
    skuName: "Summer Special Mango Bar",
    packSize: "65 ml",
    platform: "Blinkit",
    categoryTag: "Stick",
    offtakeValue: "₹ 2.9 lac",
    impact: "-4.6%",
    kpis: {
        soh: "1.7 days",
        doi: "8.1",
        weightedOsa: "81.3%",
    },
    topCities: [
        { city: "Delhi", metric: "OSA 80.1%", change: "-3.4%" },
        { city: "Gurgaon", metric: "Fillrate 86.7%", change: "-2.3%" },
    ],
},
{
    id: "KW-A-D05",
    type: "drainer",
    metricType: "availability",
    skuCode: "KW A05",
    skuName: "Mini Cup Strawberry",
    packSize: "85 ml",
    platform: "Zepto",
    categoryTag: "Cup",
    offtakeValue: "₹ 2.5 lac",
    impact: "-2.9%",
    kpis: {
        soh: "1.2 days",
        doi: "5.9",
        weightedOsa: "83.1%",
    },
    topCities: [
        { city: "Ahmedabad", metric: "OSA 81.3%", change: "-2.1%" },
        { city: "Surat", metric: "Fillrate 85.9%", change: "-1.8%" },
    ],
},

/* --------------------------------------------------
   AVAILABILITY — GAINERS (5)
-------------------------------------------------- */
{
    id: "KW-A-G01",
    type: "gainer",
    metricType: "availability",
    skuCode: "KW AG01",
    skuName: "Choco Brownie Fudge",
    packSize: "500 ml",
    platform: "Zepto",
    categoryTag: "Tub",
    offtakeValue: "₹ 4.2 lac",
    impact: "+6.9%",
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
    id: "KW-A-G02",
    type: "gainer",
    metricType: "availability",
    skuCode: "KW AG02",
    skuName: "Chocobar Mini Multi Pack",
    packSize: "6 x 45 ml",
    platform: "Instamart",
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
    id: "KW-A-G03",
    type: "gainer",
    metricType: "availability",
    skuCode: "KW AG03",
    skuName: "Butterscotch Family Tub",
    packSize: "1.2 L",
    platform: "Blinkit",
    categoryTag: "Tub",
    offtakeValue: "₹ 4.4 lac",
    impact: "+5.1%",
    kpis: {
        soh: "4.9 days",
        doi: "16.4",
        weightedOsa: "97.9%",
    },
    topCities: [
        { city: "Hyderabad", metric: "Fillrate 99.1%", change: "+2.8%" },
        { city: "Vizag", metric: "OSA 98.8%", change: "+2.1%" },
    ],
},
{
    id: "KW-A-G04",
    type: "gainer",
    metricType: "availability",
    skuCode: "KW AG04",
    skuName: "Chocolate Brick Pack",
    packSize: "750 ml",
    platform: "Zepto",
    categoryTag: "Brick",
    offtakeValue: "₹ 3.5 lac",
    impact: "+3.6%",
    kpis: {
        soh: "4.3 days",
        doi: "15.1",
        weightedOsa: "96.7%",
    },
    topCities: [
        { city: "Delhi", metric: "OSA 97.7%", change: "+1.9%" },
        { city: "Pune", metric: "Fillrate 98.3%", change: "+1.4%" },
    ],
},
{
    id: "KW-A-G05",
    type: "gainer",
    metricType: "availability",
    skuCode: "KW AG05",
    skuName: "Kesar Pista Cup",
    packSize: "85 ml",
    platform: "Instamart",
    categoryTag: "Cup",
    offtakeValue: "₹ 3.2 lac",
    impact: "+3.1%",
    kpis: {
        soh: "3.8 days",
        doi: "14.2",
        weightedOsa: "97.3%",
    },
    topCities: [
        { city: "Chennai", metric: "OSA 98.6%", change: "+1.6%" },
        { city: "Coimbatore", metric: "Fillrate 98.1%", change: "+1.2%" },
    ],
},

];

/* ------------------------------------------------------
   SIGNAL CARD UI
-------------------------------------------------------*/
function SignalCard({ sku, metricType }) {
    const kpiKeys =
        metricType === "visibility" ? visibilityKpiOrder : availabilityKpiOrder;

    return (
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white shadow px-4 py-3 min-w-[280px] max-w-[280px]">
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

                <div>
                    <div className="text-sm font-semibold">{sku.skuName}</div>
                    <div className="text-xs text-slate-500">{sku.packSize}</div>
                </div>

                <div className="mt-3 flex justify-between text-xs">
                    <div>
                        <div className="text-slate-400">Offtake</div>
                        <div className="text-base font-semibold">{sku.offtakeValue}</div>
                    </div>
                    <ImpactPill value={sku.impact} />
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
                                    {sku.kpis[key]}
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
                    {sku.topCities.map((c) => (
                        <div key={c.city} className="p-2 border rounded-xl bg-slate-50">
                            <div className="font-medium">{c.city}</div>
                            <div className="text-[10px] text-slate-500">{c.metric}</div>
                            <ImpactPill value={c.change} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------
   BASE COMPONENT FOR BOTH VIEWS
-------------------------------------------------------*/
function SignalLabBase({ metricType }) {
    const [signalType, setSignalType] = useState("drainer");

    const filtered = SAMPLE_SKUS.filter(
        (sku) => sku.metricType === metricType && sku.type === signalType
    );

    return (
        <div className="w-full bg-slate-50 py-6 px-1">
            <div className="mx-auto max-w-7xl bg-white border rounded-3xl px-6 py-5 shadow">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <h2 className="text-lg font-semibold">
                        Signal Lab — Kwality Wall&apos;s ({metricType})
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

                <div className="mt-5 overflow-x-auto">
                    <div className="flex gap-4 min-w-max">
                        {filtered.map((s) => (
                            <SignalCard key={s.id} sku={s} metricType={metricType} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}


export function SignalLabVisibility({ type }) {
    return <SignalLabBase metricType={type} />;
}


