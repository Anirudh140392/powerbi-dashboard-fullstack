import React, { useState, useMemo, useContext } from "react";
import { FilterContext } from "../../utils/FilterContext";
import { motion, AnimatePresence } from "framer-motion";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import { ChevronDown, ChevronRight, PieChart } from "lucide-react";

export default function SKUVisibilityTable({ activeTab, setActiveTab, filter, apiData }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [expandedSkus, setExpandedSkus] = useState(new Set());
    const [expandedKeywords, setExpandedKeywords] = useState(new Set());

    const getVolShare = (name) => {
        const seed = (name || "").split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return ((seed % 900) / 10 + 2).toFixed(1); // 2% to 92%
    };

    const getCityData = (keyword, skuName) => {
        const cities = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Pune"];
        const seed = (keyword + skuName).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return cities.map((city, idx) => ({
            city,
            paid: ((seed * (idx + 1)) % 100) + 1,
            organic: ((seed * (idx + 2)) % 100) + 1,
            overall: ((seed * (idx + 3)) % 100) + 1
        }));
    };

    // Reset page and expanded state when tab changes
    useMemo(() => {
        setCurrentPage(1);
        setExpandedSkus(new Set());
    }, [activeTab]);

    const { selectedBrand } = useContext(FilterContext) || {};
    const defaultBrand = useMemo(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user'));
            return u?.dbName ? u.dbName.charAt(0).toUpperCase() + u.dbName.slice(1) : 'Brand';
        } catch {
            return 'Brand';
        }
    }, []);
    const brandName = selectedBrand && selectedBrand !== "All" ? selectedBrand : defaultBrand;

    const toggleExpand = (skuName) => {
        const newExpanded = new Set(expandedSkus);
        if (newExpanded.has(skuName)) newExpanded.delete(skuName);
        else newExpanded.add(skuName);
        setExpandedSkus(newExpanded);
    };

    const toggleKeywordExpand = (keywordId) => {
        const newExpanded = new Set(expandedKeywords);
        if (newExpanded.has(keywordId)) newExpanded.delete(keywordId);
        else newExpanded.add(keywordId);
        setExpandedKeywords(newExpanded);
    };

    const keywordsData = useMemo(() => {
        let allTerms = apiData?.terms || [];
        const kwMap = new Map();

        // Flatten to keywords
        allTerms.forEach(sku => {
            const skuKeywords = sku.keywords || [];
            skuKeywords.forEach(kw => {
                if (!kwMap.has(kw.keyword)) {
                    kwMap.set(kw.keyword, {
                        keyword: kw.keyword,
                        topBrand: sku.topBrand, // Placeholder
                        paidRank: kw.paidData?.rank || 0,
                        organicRank: kw.organicData?.rank || 0,
                        overallRank: kw.overallData?.rank || 0,
                        skus: []
                    });
                }
                kwMap.get(kw.keyword).skus.push({
                    skuName: sku.skuName,
                    brand: sku.topBrand,
                    paidRank: kw.paidData?.rank || 0,
                    organicRank: kw.organicData?.rank || 0,
                    overallRank: kw.overallData?.rank || 0
                });
            });
        });

        let list = Array.from(kwMap.values());

        // Apply filters
        if (activeTab === "My SKUs") {
            list = list.filter(item =>
                item.topBrand?.toLowerCase().includes(brandName.toLowerCase()) ||
                item.topBrand === brandName
            );
        }

        if (filter && filter !== "All") {
            // Mock filter logic based on filter prop (Branded, Competitor, etc)
            if (filter === "Branded") {
                list = list.filter(item => item.topBrand === brandName);
            } else if (filter === "Competitor") {
                const exComps = list.filter(item => item.topBrand !== brandName);
                if (exComps.length === 0) {
                    // Inject hardcoded competitor data
                    list = [
                        {
                            keyword: "Cadbury Dairy Milk", topBrand: "Cadbury", paidRank: 1, organicRank: 2, overallRank: 1,
                            skus: [{ skuName: "Dairy Milk 100g", brand: "Cadbury", paidRank: 1, organicRank: 2, overallRank: 1 }]
                        },
                        {
                            keyword: "Nestle KitKat", topBrand: "Nestle", paidRank: 3, organicRank: 1, overallRank: 2,
                            skus: [{ skuName: "KitKat 4-Finger", brand: "Nestle", paidRank: 3, organicRank: 1, overallRank: 2 }]
                        },
                        {
                            keyword: "Ferrero Rocher T16", topBrand: "Ferrero", paidRank: 2, organicRank: 5, overallRank: 3,
                            skus: [{ skuName: "Ferrero Rocher T16 Pouch", brand: "Ferrero", paidRank: 2, organicRank: 5, overallRank: 3 }]
                        },
                        {
                          keyword: "Amul Dark", topBrand: "Amul", paidRank: 0, organicRank: 7, overallRank: 7,
                          skus: [{ skuName: "Amul Dark 50% Cocoa", brand: "Amul", paidRank: 0, organicRank: 7, overallRank: 7 }]
                        }
                    ];
                } else {
                    list = exComps;
                }
            } else if (filter === "Generic") {
                list = list.filter(item => !item.topBrand || item.topBrand === "Generic");
            }
        }

        return list;
    }, [apiData, activeTab, brandName, filter]);


    const paginatedData = keywordsData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
                            <th className="px-6 py-3 border-r border-slate-100/50">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Keyword</span>
                                    {filter && filter !== 'All' && (
                                        <div className="flex items-center gap-1.5 mt-1.5 transition-all">
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200/60 shadow-sm">
                                                <PieChart size={10} className="text-[#2563eb]" />
                                                <span className="text-[9px] font-bold text-slate-600">{getVolShare(filter)}%</span>
                                            </div>
                                            <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-tight">{filter} Category Share</span>
                                        </div>
                                    )}
                                </div>
                            </th>
                            {activeTab === "ALL SKUs" && (
                                <th className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 w-[14%] border-r border-slate-100/50">Leading Brand</th>
                            )}
                            <th className="px-6 py-2.5 text-xs font-bold text-center text-slate-700 w-[16%] border-r border-slate-100/50">
                                Paid Rank
                            </th>
                            <th className="px-6 py-2.5 text-xs font-bold text-center text-slate-700 w-[16%] border-r border-slate-100/50">
                                Organic Rank
                            </th>
                            <th className="px-6 py-2.5 text-xs font-bold text-center text-slate-700 w-[16%]">
                                Overall Rank
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
                            const isExpanded = expandedKeywords.has(row.keyword);

                            return (
                                <React.Fragment key={`${activeTab}-${idx}`}>
                                    <motion.tr
                                        variants={itemVariants}
                                        className={`transition-colors cursor-pointer ${isExpanded ? 'bg-sky-50/20' : 'hover:bg-slate-50/80'}`}
                                        onClick={() => toggleKeywordExpand(row.keyword)}
                                    >
                                        <td className="px-6 py-3 text-xs text-slate-700 font-semibold truncate flex items-center gap-2" title={row.keyword}>
                                            <div className="flex items-center justify-center min-w-[16px] min-h-[16px]">
                                                {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span>{row.keyword}</span>
                                                <div className="flex items-center gap-1.5 transition-all">
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-50 border border-indigo-100 shadow-sm transition-all hover:bg-slate-100">
                                                        <PieChart size={9} className="text-[#2563eb]" />
                                                        <span className="text-[9px] font-bold text-[#2563eb] tracking-tighter">{getVolShare(row.keyword)}%</span>
                                                    </div>
                                                    <span className="text-[8px] text-slate-400 font-medium uppercase tracking-tighter">Vol. Share</span>
                                                </div>
                                            </div>
                                        </td>
                                        {activeTab === "ALL SKUs" && (
                                            <td className="px-6 py-3 text-xs text-slate-500 truncate" title={row.topBrand}>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${row.topBrand?.toLowerCase() === brandName.toLowerCase() ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-700 border-slate-200'
                                                    }`}>
                                                    {row.topBrand}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-3 w-[16%] text-center text-[11px] font-bold text-slate-700">
                                            {row.paidRank}
                                        </td>
                                        <td className="px-6 py-3 w-[16%] text-center text-[11px] font-bold text-slate-700">
                                            {row.organicRank}
                                        </td>
                                        <td className="px-6 py-3 w-[16%] text-center text-[11px] font-bold text-slate-700">
                                            {row.overallRank}
                                        </td>
                                    </motion.tr>

                                    <AnimatePresence>
                                        {isExpanded && row.skus?.map((sku, skuIdx) => {
                                            const skuId = `${row.keyword}-${sku.skuName}`;
                                            const isSkuExpanded = expandedSkus.has(skuId);
                                            return (
                                                <React.Fragment key={skuId}>
                                                    <motion.tr
                                                        initial={{ opacity: 0, y: -5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -5 }}
                                                        className="bg-slate-50/40 border-b border-white hover:bg-slate-100/50 transition-colors"
                                                    >
                                                        <td className="px-6 py-2 pb-2 pl-[52px] text-[11px] font-medium text-slate-500 truncate" title={sku.skuName}>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleExpand(skuId);
                                                                    }}
                                                                    className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 hover:text-slate-600"
                                                                >
                                                                    {isSkuExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                                </button>
                                                                <div className="flex flex-col gap-1">
                                                                    <span>{sku.skuName}</span>
                                                                    <div className="flex items-center gap-1.5 opacity-90 scale-95 origin-left">
                                                                        <div className="flex items-center gap-1 px-1 py-0.5 rounded bg-slate-50 border border-indigo-100 shadow-sm">
                                                                            <PieChart size={8} className="text-[#2563eb]" />
                                                                            <span className="text-[8px] font-bold text-[#2563eb]">{getVolShare(sku.skuName)}%</span>
                                                                        </div>
                                                                        <span className="text-[7px] text-slate-400 font-semibold uppercase">Product Share</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {activeTab === "ALL SKUs" && (
                                                            <td className="px-6 py-2 text-center text-[11px] text-slate-400">
                                                                {sku.brand}
                                                            </td>
                                                        )}
                                                        <td className="px-6 py-2 text-center text-[10px] font-bold text-slate-500">
                                                            {sku.paidRank}
                                                        </td>
                                                        <td className="px-6 py-2 text-center text-[10px] font-bold text-slate-500">
                                                            {sku.organicRank}
                                                        </td>
                                                        <td className="px-6 py-2 text-center text-[10px] font-bold text-slate-500">
                                                            {sku.overallRank}
                                                        </td>
                                                    </motion.tr>

                                                    <AnimatePresence>
                                                        {isSkuExpanded && getCityData(row.keyword, sku.skuName).map((city, cIdx) => (
                                                            <motion.tr
                                                                key={`city-${skuId}-${cIdx}`}
                                                                initial={{ opacity: 0, y: -3 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -3 }}
                                                                className="bg-slate-100/30 border-b border-white/50"
                                                            >
                                                                <td className="px-6 py-1 pl-[84px] text-[10px] font-medium text-slate-400 italic font-mono">
                                                                    {city.city}
                                                                </td>
                                                                {activeTab === "ALL SKUs" && (
                                                                    <td className="px-6 py-1 text-center text-[10px] text-slate-300">—</td>
                                                                )}
                                                                <td className="px-6 py-1 text-center text-[10px] text-slate-400">{city.paid}</td>
                                                                <td className="px-6 py-1 text-center text-[10px] text-slate-400">{city.organic}</td>
                                                                <td className="px-6 py-1 text-center text-[10px] text-slate-400">{city.overall}</td>
                                                            </motion.tr>
                                                        ))}
                                                    </AnimatePresence>
                                                </React.Fragment>
                                            );
                                        })}
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
                    isVisible={keywordsData.length > 0}
                    currentPage={currentPage}
                    totalPages={Math.ceil(keywordsData.length / pageSize)}
                    onPageChange={setCurrentPage}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}
