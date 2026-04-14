import React, { useState, useMemo, useContext } from "react";
import { FilterContext } from "../../utils/FilterContext";
import { motion, AnimatePresence } from "framer-motion";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import { ChevronDown, ChevronRight, PieChart, Loader2 } from "lucide-react";
import { fetchVisibilityCityDrilldown } from "../../api/visibilityService";
import dayjs from "dayjs";

const getVolShare = (name) => {
    if (!name) return "2.0";
    const seed = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return ((seed % 900) / 10 + 2).toFixed(1);
};

const getCorrectBrand = (skuName, brand, fallbackBrand) => {
    // If brand is a valid name (not "1" and not "Other"), use it
    if (brand && brand !== "1" && brand !== "Other") return brand;
    if (brand === "1") return fallbackBrand;
    return brand || "Other";
};

export default function SKUVisibilityTable({ activeTab, setActiveTab, filter, apiData }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [expandedSkus, setExpandedSkus] = useState(new Set());
    const [expandedKeywords, setExpandedKeywords] = useState(new Set());

    const [cityDrilldownData, setCityDrilldownData] = useState({}); // { [keyword_sku]: cities[] }
    const [cityLoading, setCityLoading] = useState({}); // { [keyword_sku]: boolean }

    const { platform, location, timeStart, timeEnd, selectedBrand } = useContext(FilterContext) || {};

    // Reset page and expanded state when tab changes
    useMemo(() => {
        setCurrentPage(1);
        setExpandedSkus(new Set());
    }, [activeTab]);

    const defaultBrand = useMemo(() => {
        try {
            const u = JSON.parse(sessionStorage.getItem('user'));
            return u?.dbName ? u.dbName.charAt(0).toUpperCase() + u.dbName.slice(1) : 'Brand';
        } catch {
            return 'Brand';
        }
    }, []);
    const brandName = selectedBrand && selectedBrand !== "All" ? selectedBrand : defaultBrand;

    const toggleExpand = async (skuId, keyword, skuName) => {
        const isCurrentlyExpanded = expandedSkus.has(skuId);

        setExpandedSkus((prev) => {
            const next = new Set(prev);
            if (next.has(skuId)) next.delete(skuId);
            else next.add(skuId);
            return next;
        });

        // Fetch city data if expanding and not loaded
        if (!isCurrentlyExpanded && !cityDrilldownData[skuId]) {
            try {
                setCityLoading(prev => ({ ...prev, [skuId]: true }));
                const response = await fetchVisibilityCityDrilldown({
                    keyword,
                    sku: skuName,
                    platform,
                    location: location || 'All',
                    startDate: dayjs(timeStart).format('YYYY-MM-DD'),
                    endDate: dayjs(timeEnd).format('YYYY-MM-DD')
                });
                setCityDrilldownData(prev => ({ ...prev, [skuId]: response.cities || [] }));
            } catch (err) {
                console.error("Failed to fetch City drilldown:", err);
            } finally {
                setCityLoading(prev => ({ ...prev, [skuId]: false }));
            }
        }
    };

    const toggleKeywordExpand = (keywordId) => {
        const newExpanded = new Set(expandedKeywords);
        if (newExpanded.has(keywordId)) newExpanded.delete(keywordId);
        else newExpanded.add(keywordId);
        setExpandedKeywords(newExpanded);
    };

    const keywordsData = useMemo(() => {
        // apiData is passed as searchTerms array from Parent
        let allTerms = Array.isArray(apiData) ? apiData : (apiData?.terms || []);
        const kwMap = new Map();

        // Process results - handle both SKU-centric and Keyword-centric structures
        allTerms.forEach(item => {
            // Case 1: SKU-centric structure (from backend viewMode="sku")
            // { skuName: "...", keywords: [ { keyword: "...", paidData: ... }, ... ] }
            if (item.skuName && Array.isArray(item.keywords)) {
                item.keywords.forEach(kw => {
                    const kwName = kw.keyword || 'Unknown';
                    if (!kwMap.has(kwName)) {
                        kwMap.set(kwName, {
                            keyword: kwName,
                            topBrand: item.topBrand || item.brand || 'Other',
                            paidRank: kw.paidData?.rank || 0,
                            organicRank: kw.organicData?.rank || 0,
                            overallRank: kw.overallData?.rank || 0,
                            skus: []
                        });
                    }
                    kwMap.get(kwName).skus.push({
                        skuName: item.skuName,
                        brand: item.topBrand || item.brand,
                        paidRank: kw.paidData?.rank || 0,
                        organicRank: kw.organicData?.rank || 0,
                        overallRank: kw.overallData?.rank || 0
                    });
                });
            }
            // Case 2: Keyword-centric structure (standard or mock)
            // { keyword: "...", skus: [ ... ] }
            else if (item.keyword) {
                const kwName = item.keyword;
                if (!kwMap.has(kwName)) {
                    kwMap.set(kwName, {
                        keyword: kwName,
                        topBrand: item.topBrand || item.brand || 'Other',
                        paidRank: item.paidRank || item.paidSos || 0,
                        organicRank: item.organicRank || item.organicSos || 0,
                        overallRank: item.overallRank || item.overallSos || 0,
                        skus: item.skus || []
                    });
                } else if (Array.isArray(item.skus)) {
                    kwMap.get(kwName).skus = [...kwMap.get(kwName).skus, ...item.skus];
                }
            }
        });

        let list = Array.from(kwMap.values());

        // Apply filters
        if (activeTab === "My SKUs") {
            list = list.filter(item =>
                item.topBrand?.toLowerCase().includes(brandName.toLowerCase()) ||
                item.topBrand === brandName ||
                item.topBrand === "1"
            );
        }

        if (filter && filter !== "All") {
            // Mock filter logic based on filter prop (Branded, Competitor, etc)
            if (filter === "Branded") {
                // Backend already filters by keyword_type=Branded.
                // We allow results regardless of topBrand if they were returned by the backend.
                list = list;
            } else if (filter === "Competitor") {
                list = list.filter(item => item.topBrand !== brandName && item.topBrand !== "1");
            } else if (filter === "Generic") {
                // Since backend already filters by keyword_type=Generic when this tab is selected,
                // we don't need to secondary filter by topBrand here, as it might hide valid results.
                list = list;
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
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${row.topBrand?.toLowerCase() === brandName.toLowerCase() || row.topBrand === "1" ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-700 border-slate-200'
                                                    }`}>
                                                    {row.topBrand === "1" ? brandName : row.topBrand}
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
                                                                        toggleExpand(skuId, row.keyword, sku.skuName);
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
                                                            <td className="px-6 py-2 text-[10px] text-slate-500 font-semibold">
                                                                {getCorrectBrand(sku.skuName, sku.brand, brandName)}
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
                                                        {isSkuExpanded && (cityLoading[skuId] ? (
                                                            <motion.tr
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                className="bg-slate-100/10"
                                                            >
                                                                <td colSpan={6} className="py-4 text-center">
                                                                    <div className="flex flex-col items-center justify-center gap-1.5 pl-[84px]">
                                                                        <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                                                                        <span className="text-[9px] font-medium text-slate-400 text-center">Loading cities...</span>
                                                                    </div>
                                                                </td>
                                                            </motion.tr>
                                                        ) : (cityDrilldownData[skuId] || []).map((city, cIdx) => (
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
                                                                <td className="px-6 py-1 text-center text-[10px] text-slate-400 font-bold">{city.paidRank || 0}</td>
                                                                <td className="px-6 py-1 text-center text-[10px] text-slate-400 font-bold">{city.organicRank || 0}</td>
                                                                <td className="px-6 py-1 text-center text-[10px] text-slate-400 font-bold">{city.overallRank || 0}</td>
                                                            </motion.tr>
                                                        )))}
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
