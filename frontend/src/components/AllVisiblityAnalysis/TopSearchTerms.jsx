import React, { useState } from "react";
import { ArrowUp, ArrowDown, X, LineChart, TrendingUp, TrendingDown, Minus } from "lucide-react";

// Mock Data focused on "Kwality Walls"
const MOCK_DATA = [
    {
        keyword: "ice cream",
        topBrand: "KWALITY WALLS",
        searchVolume: 12500,
        overallSov: 65,
        overallDelta: -3.1,
        organicSov: 45,
        organicDelta: -4.5,
        paidSov: 20,
        paidDelta: 0.0,
    },
    {
        keyword: "cornetto",
        topBrand: "KWALITY WALLS",
        searchVolume: 8200,
        overallSov: 88,
        overallDelta: 0.9,
        organicSov: 55,
        organicDelta: 2.4,
        paidSov: 33,
        paidDelta: -0.9,
    },
    {
        keyword: "chocolate ice cream",
        topBrand: "KWALITY WALLS",
        searchVolume: 5600,
        overallSov: 42,
        overallDelta: -0.5,
        organicSov: 30,
        organicDelta: -0.8,
        paidSov: 12,
        paidDelta: 0.0,
    },
    {
        keyword: "vanilla tub",
        topBrand: "AMUL",
        searchVolume: 4100,
        overallSov: 15,
        overallDelta: -1.4,
        organicSov: 10,
        organicDelta: -2.0,
        paidSov: 5,
        paidDelta: 0.0,
    },
    {
        keyword: "strawberry cone",
        topBrand: "KWALITY WALLS",
        searchVolume: 3500,
        overallSov: 72,
        overallDelta: -1.0,
        organicSov: 40,
        organicDelta: -1.5,
        paidSov: 32,
        paidDelta: 0.0,
    },
    {
        keyword: "family pack ice cream",
        topBrand: "KWALITY WALLS",
        searchVolume: 3200,
        overallSov: 55,
        overallDelta: -1.0,
        organicSov: 35,
        organicDelta: -0.2,
        paidSov: 20,
        paidDelta: -0.2,
    },
    {
        keyword: "magnum",
        topBrand: "KWALITY WALLS",
        searchVolume: 2900,
        overallSov: 92,
        overallDelta: -2.7,
        organicSov: 60,
        organicDelta: -4.0,
        paidSov: 32,
        paidDelta: 0.0,
    },
    {
        keyword: "cup ice cream",
        topBrand: "MOTHER DAIRY",
        searchVolume: 2400,
        overallSov: 25,
        overallDelta: 2.5,
        organicSov: 15,
        organicDelta: 3.7,
        paidSov: 10,
        paidDelta: -1.0,
    },
    {
        keyword: "chocobar",
        topBrand: "KWALITY WALLS",
        searchVolume: 2100,
        overallSov: 60,
        overallDelta: -4.4,
        organicSov: 45,
        organicDelta: -2.8,
        paidSov: 15,
        paidDelta: -3.6,
    },
    {
        keyword: "mango duets",
        topBrand: "KWALITY WALLS",
        searchVolume: 1800,
        overallSov: 48,
        overallDelta: -0.8,
        organicSov: 30,
        organicDelta: -1.0,
        paidSov: 18,
        paidDelta: 0.0,
    },
    {
        keyword: "butterscotch tub",
        topBrand: "AMUL",
        searchVolume: 1600,
        overallSov: 12,
        overallDelta: -0.1,
        organicSov: 8,
        organicDelta: 0.0,
        paidSov: 4,
        paidDelta: 0.0,
    },
    {
        keyword: "kulfi",
        topBrand: "KWALITY WALLS",
        searchVolume: 1500,
        overallSov: 35,
        overallDelta: -0.6,
        organicSov: 25,
        organicDelta: -1.1,
        paidSov: 10,
        paidDelta: 0.0,
    },
];

// Mock Data for Drilldown (Competitors for a keyword)
const getCompetitorData = (keyword) => [
    { brand: "Kwality Walls", overall: 45, organic: 30, paid: 15 },
    { brand: "Amul", overall: 25, organic: 20, paid: 5 },
    { brand: "Mother Dairy", overall: 15, organic: 10, paid: 5 },
    { brand: "Vadilal", overall: 10, organic: 8, paid: 2 },
    { brand: "Havmor", overall: 5, organic: 5, paid: 0 },
];

const DeltaIndicator = ({ value }) => {
    const num = Number(value || 0);
    const absValue = Math.abs(num).toFixed(1); // Removed % as per screenshot

    if (num > 0) {
        return (
            <span className="inline-flex items-center gap-[1px] rounded-full border border-emerald-200 bg-emerald-50 px-0.5 py-0 text-[9px] font-medium text-emerald-700 h-[13px] leading-none">
                <TrendingUp size={8} />
                {absValue}
            </span>
        );
    }

    if (num < 0) {
        return (
            <span className="inline-flex items-center gap-[1px] rounded-full border border-rose-200 bg-rose-50 px-0.5 py-0 text-[9px] font-medium text-rose-700 h-[13px] leading-none">
                <TrendingDown size={8} />
                {absValue}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-[1px] rounded-full border border-slate-200 bg-slate-50 px-0.5 py-0 text-[9px] font-medium text-slate-600 h-[13px] leading-none">
            <Minus size={8} />
            {absValue}
        </span>
    );
};

export default function TopSearchTerms() {
    const [filter, setFilter] = useState("All");
    const [selectedKeyword, setSelectedKeyword] = useState(null);

    const handleBrandClick = (keyword) => {
        setSelectedKeyword(keyword);
    };

    const closeDrilldown = () => {
        setSelectedKeyword(null);
    };

    const drilldownData = selectedKeyword ? getCompetitorData(selectedKeyword) : [];

    return (
        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-white">
                <h3 className="text-base font-bold text-slate-800">Top Search Terms</h3>

                <div className="flex items-center gap-4">
                    {/* Tabs */}
                    <div className="flex gap-2 bg-gray-100 border border-slate-300 rounded-full p-1 w-max">
                        {["All", "Branded", "Competitor", "Generic"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setFilter(tab)}
                                className={`px-4 py-1.5 text-sm rounded-full transition-all ${filter === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* TopN Dropdown Placeholder */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <span>TopN for SOV:</span>
                        <select className="border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer">
                            <option>Top 20</option>
                            <option>Top 50</option>
                            <option>Top 100</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-2.5 text-xs font-bold text-slate-700 w-[20%]">Keywords</th>
                            <th className="px-6 py-2.5 text-xs font-bold text-slate-700 w-[15%]">
                                Top Brand <span className="text-[9px] font-normal text-slate-500">(by Overall Share of Visibility)</span>
                            </th>
                            <th className="px-6 py-2.5 text-xs font-bold text-slate-700 w-[25%] text-center">Overall Share of Visibility</th>
                            <th className="px-1 py-2.5 text-xs font-bold text-slate-700 w-[5%] text-center"><LineChart className="h-3 w-3 inline" /></th>
                            <th className="px-6 py-2.5 text-xs font-bold text-slate-700 w-[25%] text-center">Organic Share of Visibility</th>
                            <th className="px-1 py-2.5 text-xs font-bold text-slate-700 w-[5%] text-center"><LineChart className="h-3 w-3 inline" /></th>
                            <th className="px-6 py-2.5 text-xs font-bold text-slate-700 w-[15%] text-center">Paid Share of Visibility</th>
                            <th className="px-1 py-2.5 text-xs font-bold text-slate-700 w-[5%] text-center"><LineChart className="h-3 w-3 inline" /></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {MOCK_DATA.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-2 text-[11px] text-slate-700 font-medium">
                                    {row.keyword}
                                </td>
                                <td className="px-6 py-2 text-[10px]">
                                    <button
                                        onClick={() => handleBrandClick(row.keyword)}
                                        className="px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer"
                                    >
                                        {row.topBrand}
                                    </button>
                                </td>
                                <td className="px-6 py-2 text-center text-[11px] text-slate-700">
                                    {row.overallSov}%
                                </td>
                                <td className="px-1 py-2 text-center">
                                    <DeltaIndicator value={row.overallDelta} />
                                </td>
                                <td className="px-6 py-2 text-center text-[11px] text-slate-700">
                                    {row.organicSov}%
                                </td>
                                <td className="px-1 py-2 text-center">
                                    <DeltaIndicator value={row.organicDelta} />
                                </td>
                                <td className="px-6 py-2 text-center text-[11px] text-slate-700">
                                    {row.paidSov}%
                                </td>
                                <td className="px-1 py-2 text-center">
                                    <DeltaIndicator value={row.paidDelta} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer / Pagination */}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <button className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                        Prev
                    </button>
                    <div className="text-xs text-slate-600 font-medium">
                        Page 1 / 3
                    </div>
                    <button className="text-xs text-slate-600 hover:text-slate-800 transition-colors">
                        Next
                    </button>
                </div>
                <div className="text-xs text-slate-400">Showing top 12 terms</div>
            </div>

            {/* Drilldown Modal */}
            {selectedKeyword && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px]">
                    <div className="w-[90%] max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden ring-1 ring-slate-900/5">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <h4 className="text-sm font-semibold text-slate-800">
                                Brand Visibility for <span className="text-blue-600">"{selectedKeyword}"</span>
                            </h4>
                            <button
                                onClick={closeDrilldown}
                                className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-4">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[11px] text-slate-500 uppercase tracking-wider">
                                        <th className="pb-2 font-semibold">Brand</th>
                                        <th className="pb-2 font-semibold text-right">Overall SOV</th>
                                        <th className="pb-2 font-semibold text-right">Organic SOV</th>
                                        <th className="pb-2 font-semibold text-right">Paid SOV</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {drilldownData.map((d, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50">
                                            <td className="py-2 text-xs font-medium text-slate-800">{d.brand}</td>
                                            <td className="py-2 text-right text-xs text-slate-600">{d.overall}%</td>
                                            <td className="py-2 text-right text-xs text-slate-600">{d.organic}%</td>
                                            <td className="py-2 text-right text-xs text-slate-600">{d.paid}%</td>
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
