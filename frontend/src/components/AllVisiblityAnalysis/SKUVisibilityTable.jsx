import React, { useState, useMemo, useContext } from "react";
import { FilterContext } from "../../utils/FilterContext";
import { motion, AnimatePresence } from "framer-motion";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from "lucide-react";
import dayjs from "dayjs";

const DeltaIndicator = ({ value }) => {
    const num = Number(value || 0);
    const absValue = Math.abs(num).toFixed(1);

    if (num > 0) {
        return (
            <span className="inline-flex items-center gap-[1px] rounded-full border border-emerald-200 bg-emerald-50 px-1 py-0.5 text-[9px] font-medium text-emerald-700 h-[14px] leading-none">
                <TrendingUp size={8} />
                {absValue}
            </span>
        );
    }

    if (num < 0) {
        return (
            <span className="inline-flex items-center gap-[1px] rounded-full border border-rose-200 bg-rose-50 px-1 py-0.5 text-[9px] font-medium text-rose-700 h-[14px] leading-none">
                <TrendingDown size={8} />
                {absValue}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-[1px] rounded-full border border-slate-200 bg-slate-50 px-1 py-0.5 text-[9px] font-medium text-slate-600 h-[14px] leading-none">
            <Minus size={8} />
            {absValue}
        </span>
    );
};

export default function SKUVisibilityTable({ activeTab, setActiveTab }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [expandedSkus, setExpandedSkus] = useState(new Set());

    // Reset page and expanded state when tab changes
    useMemo(() => {
        setCurrentPage(1);
        setExpandedSkus(new Set());
    }, [activeTab]);

    const { timeStart, timeEnd, selectedBrand } = useContext(FilterContext) || {};

    const brandName = selectedBrand && selectedBrand !== "All" ? selectedBrand : "Mars";

    const baseSkus = [
        "Snickers Peanut", "Twix Chocolate", "Galaxy Milk", "Bounty Bar", "M&M's Chocolate",
        "Orbit Gum", "Skittles Fruits", "Galaxy Flutes", "Snickers Almond", "Mars Caramel"
    ];

    const competitionSkus = [
        "Dairy Milk Silk", "KitKat Chunky", "Ferrero Rocher", "Nestle Munch", "5 Star 3D",
        "Amul Dark Choco", "Hershey's Kisses", "Nutella B-ready", "Lindt Excellence", "Milkybar"
    ];

    const toggleExpand = (skuName) => {
        const newExpanded = new Set(expandedSkus);
        if (newExpanded.has(skuName)) newExpanded.delete(skuName);
        else newExpanded.add(skuName);
        setExpandedSkus(newExpanded);
    };

    const skuData = useMemo(() => {
        const seedValue = timeStart ? dayjs(timeStart).valueOf() : 1;
        
        let allItems = [];
        
        const getCompetitorBrand = (sku) => {
            const mapping = {
                "Dairy Milk Silk": "Cadbury",
                "KitKat Chunky": "Nestle",
                "Ferrero Rocher": "Ferrero",
                "Nestle Munch": "Nestle",
                "5 Star 3D": "Cadbury",
                "Amul Dark Choco": "Amul",
                "Hershey's Kisses": "Hershey's",
                "Nutella B-ready": "Ferrero",
                "Lindt Excellence": "Lindt",
                "Milkybar": "Nestle"
            };
            return mapping[sku] || "Competitor";
        };

        const generateData = (skuList, isCompetitor) => {
            return skuList.map((sku, index) => {
                const rowSeed = (seedValue + index * 13 + (isCompetitor ? 100 : 0)) % 100;
                
                const adRank = (2 + (rowSeed % 8)).toFixed(0);
                const adRankDelta = ((rowSeed % 4) - 2).toFixed(0);

                const organicSos = (18 + ((rowSeed + 3) % 25) + (isCompetitor ? -3 : 0)).toFixed(1);
                const organicDelta = (((rowSeed + 2) % 12) - 5.5).toFixed(1);

                const overallSos = (17 + ((rowSeed + 5) % 22) + (isCompetitor ? -4 : 0)).toFixed(1);
                const overallDelta = (((rowSeed + 8) % 11) - 5).toFixed(1);

                const overallRank = (5 + (rowSeed % 15)).toFixed(0);
                const overallRankDelta = ((rowSeed % 6) - 3).toFixed(0);

                const keywords = ["buy " + sku.toLowerCase(), sku.toLowerCase() + " online", "best " + sku.toLowerCase()].map((kw, idx) => {
                    const kwSeed = rowSeed + idx * 7;
                    return {
                        keyword: kw,
                        adRankData: { rank: (2 + (kwSeed % 12)).toFixed(0), delta: ((kwSeed % 6) - 2.5).toFixed(0) },
                        organicData: { sos: (10 + (kwSeed % 15)).toFixed(1), delta: ((kwSeed % 8) - 3.5).toFixed(1) },
                        overallData: { sos: (9 + (kwSeed % 14)).toFixed(1), delta: ((kwSeed % 7) - 3).toFixed(1) },
                        overallRankData: { rank: (5 + (kwSeed % 18)).toFixed(0), delta: ((kwSeed % 10) - 4.5).toFixed(0) },
                    };
                });

                return {
                    skuName: sku,
                    brand: isCompetitor ? getCompetitorBrand(sku) : brandName,
                    adRankData: { rank: adRank, delta: adRankDelta },
                    organicData: { sos: organicSos, delta: organicDelta },
                    overallData: { sos: overallSos, delta: overallDelta },
                    overallRankData: { rank: overallRank, delta: overallRankDelta },
                    keywords,
                    isCompetitor
                };
            });
        };

        if (activeTab === "My SKUs") {
            allItems = generateData(baseSkus, false);
        } else {
            const mySkusData = generateData(baseSkus, false);
            const compSkusData = generateData(competitionSkus, true);
            // Mix them up a bit deterministically
            allItems = [...mySkusData, ...compSkusData].sort((a, b) => {
                const nameA = a.skuName.toLowerCase();
                const nameB = b.skuName.toLowerCase();
                return nameA.localeCompare(nameB);
            });
        }

        return allItems;
    }, [activeTab, timeStart, timeEnd, brandName]);

    const paginatedData = skuData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05, delayChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 12 } }
    };

    return (
        <div className="w-full bg-white relative">
            {/* Tabs moved to parent container */}

            <div className="overflow-x-auto rounded-t-xl border border-slate-100">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 w-[22%] border-r border-slate-100/50">SKU Name</th>
                            {activeTab === "ALL SKUs" && (
                                <th className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 w-[14%] border-r border-slate-100/50">Brand</th>
                            )}
                            <th className="px-6 py-2.5 text-xs font-bold text-center text-slate-700 w-[16%] border-r border-slate-100/50">
                                Ad Most viewed rank
                            </th>
                            <th className="px-6 py-2.5 text-xs font-bold text-center text-slate-700 w-[16%] border-r border-slate-100/50">
                                Organic Most viewed rank
                            </th>
                            <th className="px-6 py-2.5 text-xs font-bold text-center text-slate-700 w-[16%]">
                                Overall Most viewed rank
                            </th>
                        </tr>
                    </thead>
                    <motion.tbody
                        className="divide-y divide-slate-100"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {paginatedData.map((row, idx) => {
                            const isExpanded = expandedSkus.has(row.skuName);

                            return (
                                <React.Fragment key={`${activeTab}-${idx}`}>
                                    <motion.tr 
                                        variants={itemVariants} 
                                        className={`transition-colors cursor-pointer ${isExpanded ? 'bg-sky-50/20' : 'hover:bg-slate-50/80'}`}
                                        onClick={() => toggleExpand(row.skuName)}
                                    >
                                        <td className="px-6 py-3 text-xs text-slate-700 font-semibold truncate flex items-center gap-2" title={row.skuName}>
                                            <div className="flex items-center justify-center min-w-[16px] min-h-[16px]">
                                                {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span>{row.skuName}</span>
                                                <span className="text-[10px] text-slate-400 font-normal">({row.keywords.length} keywords)</span>
                                            </div>
                                        </td>
                                        {activeTab === "ALL SKUs" && (
                                            <td className="px-6 py-3 text-xs text-slate-500 truncate" title={row.brand}>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${row.isCompetitor ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                    {row.brand}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-3 w-[16%] text-center">
                                            <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-1.5 rounded-xl bg-emerald-50/50 px-2 py-1 border border-emerald-100/50">
                                                <span className="text-[11px] font-bold text-emerald-900">{row.adRankData.rank}</span>
                                                <DeltaIndicator value={row.adRankData.delta} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 w-[16%] text-center">
                                            <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-1.5 rounded-xl bg-emerald-50/50 px-2 py-1 border border-emerald-100/50">
                                                <span className="text-[11px] font-bold text-emerald-900">{row.organicData.sos}</span>
                                                <DeltaIndicator value={row.organicData.delta} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 w-[16%] text-center">
                                            <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-1.5 rounded-xl bg-emerald-50/50 px-2 py-1 border border-emerald-100/50">
                                                <span className="text-[11px] font-bold text-emerald-900">{row.overallData.sos}</span>
                                                <DeltaIndicator value={row.overallData.delta} />
                                            </div>
                                        </td>
                                      
                                    </motion.tr>

                                    <AnimatePresence>
                                        {isExpanded && row.keywords.map((kw, kwIdx) => (
                                            <motion.tr
                                                key={`kw-${row.skuName}-${kwIdx}`}
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -5 }}
                                                className="bg-slate-50/40 border-b border-white hover:bg-slate-100/50 transition-colors"
                                            >
                                                <td className="px-6 py-2 pb-2 pl-[52px] text-[11px] font-medium text-slate-500 truncate" title={kw.keyword}>
                                                    {kw.keyword}
                                                </td>
                                                {activeTab === "ALL SKUs" && (
                                                    <td className="px-6 py-2 text-center text-[11px] text-slate-400">
                                                        —
                                                    </td>
                                                )}
                                                <td className="px-6 py-2">
                                                    <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-1.5 rounded-xl bg-slate-50/50 px-2 py-0.5 border border-slate-100/50">
                                                        <span className="text-[10px] font-bold text-slate-600">{kw.adRankData.rank}</span>
                                                        <DeltaIndicator value={kw.adRankData.delta} />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-2">
                                                    <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-1.5 rounded-xl bg-slate-50/50 px-2 py-0.5 border border-slate-100/50">
                                                        <span className="text-[10px] font-bold text-slate-600">{kw.organicData.sos}</span>
                                                        <DeltaIndicator value={kw.organicData.delta} />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-2">
                                                    <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-1.5 rounded-xl bg-slate-50/50 px-2 py-0.5 border border-slate-100/50">
                                                        <span className="text-[10px] font-bold text-slate-600">{kw.overallData.sos}</span>
                                                        <DeltaIndicator value={kw.overallData.delta} />
                                                    </div>
                                                </td>
                                              
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </React.Fragment>
                            );
                        })}
                        {paginatedData.length === 0 && (
                            <tr>
                                <td colSpan={activeTab === "ALL SKUs" ? 6 : 5} className="py-8 text-center text-xs text-slate-400 italic">
                                    No SKU data available for the selected filters
                                </td>
                            </tr>
                        )}
                    </motion.tbody>
                </table>
            </div>

            <div className="border border-t-0 border-slate-100 bg-slate-50/50 rounded-b-xl">
                <PaginationFooter
                    isVisible={skuData.length > 0}
                    currentPage={currentPage}
                    totalPages={Math.ceil(skuData.length / pageSize)}
                    onPageChange={setCurrentPage}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}
