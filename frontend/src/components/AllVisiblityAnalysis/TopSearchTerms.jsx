import React, { useState } from "react";
import { ArrowUp, ArrowDown, X, LineChart, TrendingUp, TrendingDown, Minus } from "lucide-react";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import { motion, AnimatePresence } from "framer-motion";

// Mock Data focused on "Kwality Walls"
const MOCK_DATA = [
    {
        keyword: "ice cream",
        topBrand: "KWALITY WALLS",
        searchVolume: 12500,
        overallSos: 65,
        overallDelta: -3.1,
        organicSos: 45,
        organicDelta: -4.5,
        paidSos: 20,
        paidDelta: 0.0,
    },
    {
        keyword: "cornetto",
        topBrand: "KWALITY WALLS",
        searchVolume: 8200,
        overallSos: 88,
        overallDelta: 0.9,
        organicSos: 55,
        organicDelta: 2.4,
        paidSos: 33,
        paidDelta: -0.9,
    },
    {
        keyword: "chocolate ice cream",
        topBrand: "KWALITY WALLS",
        searchVolume: 5600,
        overallSos: 42,
        overallDelta: -0.5,
        organicSos: 30,
        organicDelta: -0.8,
        paidSos: 12,
        paidDelta: 0.0,
    },
    {
        keyword: "vanilla tub",
        topBrand: "AMUL",
        searchVolume: 4100,
        overallSos: 15,
        overallDelta: -1.4,
        organicSos: 10,
        organicDelta: -2.0,
        paidSos: 5,
        paidDelta: 0.0,
    },
    {
        keyword: "strawberry cone",
        topBrand: "KWALITY WALLS",
        searchVolume: 3500,
        overallSos: 72,
        overallDelta: -1.0,
        organicSos: 40,
        organicDelta: -1.5,
        paidSos: 32,
        paidDelta: 0.0,
    },
    {
        keyword: "family pack ice cream",
        topBrand: "KWALITY WALLS",
        searchVolume: 3200,
        overallSos: 55,
        overallDelta: -1.0,
        organicSos: 35,
        organicDelta: -0.2,
        paidSos: 20,
        paidDelta: -0.2,
    },
    {
        keyword: "magnum",
        topBrand: "KWALITY WALLS",
        searchVolume: 2900,
        overallSos: 92,
        overallDelta: -2.7,
        organicSos: 60,
        organicDelta: -4.0,
        paidSos: 32,
        paidDelta: 0.0,
    },
    {
        keyword: "cup ice cream",
        topBrand: "MOTHER DAIRY",
        searchVolume: 2400,
        overallSos: 25,
        overallDelta: 2.5,
        organicSos: 15,
        organicDelta: 3.7,
        paidSos: 10,
        paidDelta: -1.0,
    },
    {
        keyword: "chocobar",
        topBrand: "KWALITY WALLS",
        searchVolume: 2100,
        overallSos: 60,
        overallDelta: -4.4,
        organicSos: 45,
        organicDelta: -2.8,
        paidSos: 15,
        paidDelta: -3.6,
    },
    {
        keyword: "mango duets",
        topBrand: "KWALITY WALLS",
        searchVolume: 1800,
        overallSos: 48,
        overallDelta: -0.8,
        organicSos: 30,
        organicDelta: -1.0,
        paidSos: 18,
        paidDelta: 0.0,
    },
    {
        keyword: "butterscotch tub",
        topBrand: "AMUL",
        searchVolume: 1600,
        overallSos: 12,
        overallDelta: -0.1,
        organicSos: 8,
        organicDelta: 0.0,
        paidSos: 4,
        paidDelta: 0.0,
    },
    {
        keyword: "kulfi",
        topBrand: "KWALITY WALLS",
        searchVolume: 1500,
        overallSos: 35,
        overallDelta: -0.6,
        organicSos: 25,
        organicDelta: -1.1,
        paidSos: 10,
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

export default function TopSearchTerms({ filter = "All" }) {
    const [selectedKeyword, setSelectedKeyword] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    const handleBrandClick = (keyword) => {
        setSelectedKeyword(keyword);
    };

    const closeDrilldown = () => {
        setSelectedKeyword(null);
    };

    const drilldownData = selectedKeyword ? getCompetitorData(selectedKeyword) : [];

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
                delayChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 12 } }
    };

    const modalVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1, transition: { type: "spring", duration: 0.3 } },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
    };

    return (
        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-white">
                <h3 className="text-base font-bold text-slate-800">Top Search Terms</h3>

                <div className="flex items-center gap-4">
                    {/* Tabs */}



                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 w-[20%]">Keywords</th>
                            <th className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 w-[15%]">
                                Leading Brand <span className="normal-case font-normal text-xs text-slate-700">(by Overall Share of Search)</span>
                            </th>
                            <th className="px-6 py-2.5 text-xs font-bold text-slate-700 w-[20%] text-center">Overall Share of Search</th>
                            <th className="px-6 py-2.5 text-xs font-bold text-slate-700 w-[20%] text-center">Organic Share of Search</th>
                            <th className="px-6 py-2.5 text-xs font-bold text-slate-700 w-[20%] text-center">Paid Share of Search</th>
                        </tr>
                    </thead>
                    <motion.tbody
                        className="divide-y divide-slate-50"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {MOCK_DATA.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, idx) => (
                            <motion.tr
                                key={idx}
                                variants={itemVariants}
                                className="hover:bg-slate-50/80 transition-colors"
                            >
                                <td className="px-6 py-2 text-xs text-slate-700 font-semibold capitalize">
                                    {row.keyword}
                                </td>
                                <td className="px-6 py-2 text-[10px]">
                                    <motion.button
                                        onClick={() => handleBrandClick(row.keyword)}
                                        whileTap={{ scale: 0.95 }}
                                        className="pill underline-slide"
                                    >
                                        {row.topBrand}
                                    </motion.button>
                                </td>
                                <td className="px-6 py-2 text-center text-[11px] text-slate-700">
                                    <div className="mx-auto flex w-fit min-w-[100px] items-center justify-between gap-3 rounded-xl bg-[#F0FDF4] px-3 py-1.5 border border-emerald-100/50">
                                        <span className="text-xs font-bold text-emerald-900">{row.overallSos}%</span>
                                        <DeltaIndicator value={row.overallDelta} />
                                    </div>
                                </td>
                                <td className="px-6 py-2 text-center text-[11px] text-slate-700">
                                    <div className="mx-auto flex w-fit min-w-[100px] items-center justify-between gap-3 rounded-xl bg-[#F0FDF4] px-3 py-1.5 border border-emerald-100/50">
                                        <span className="text-xs font-bold text-emerald-900">{row.organicSos}%</span>
                                        <DeltaIndicator value={row.organicDelta} />
                                    </div>
                                </td>
                                <td className="px-6 py-2 text-center text-[11px] text-slate-700">
                                    <div className="mx-auto flex w-fit min-w-[100px] items-center justify-between gap-3 rounded-xl bg-[#F0FDF4] px-3 py-1.5 border border-emerald-100/50">
                                        <span className="text-xs font-bold text-emerald-900">{row.paidSos}%</span>
                                        <DeltaIndicator value={row.paidDelta} />
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </motion.tbody>
                </table>
            </div>

            {/* Footer / Pagination */}
            <div className="border-t border-slate-100 bg-slate-50/50">
                <PaginationFooter
                    isVisible={MOCK_DATA.length > 3}
                    currentPage={currentPage}
                    totalPages={Math.ceil(MOCK_DATA.length / pageSize)}
                    onPageChange={setCurrentPage}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                />
            </div>

            {/* Drilldown Modal */}
            <AnimatePresence>
                {selectedKeyword && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px]"
                    >
                        <motion.div
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-[90%] max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden ring-1 ring-slate-900/5"
                        >
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
                                            <th className="pb-2 font-semibold text-center">Overall Sos</th>
                                            <th className="pb-2 font-semibold text-center">Organic Sos</th>
                                            <th className="pb-2 font-semibold text-center">Paid Sos</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {drilldownData.map((d, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50">
                                                <td className="py-2 text-xs font-medium text-slate-800">{d.brand}</td>
                                                <td className="py-2 text-center text-xs text-slate-600">{d.overall}%</td>
                                                <td className="py-2 text-center text-xs text-slate-600">{d.organic}%</td>
                                                <td className="py-2 text-center text-xs text-slate-600">{d.paid}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
