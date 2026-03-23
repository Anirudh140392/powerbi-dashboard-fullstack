import React, { useState, useMemo, useContext } from "react";
import { FilterContext } from "../../utils/FilterContext";
import { motion, AnimatePresence } from "framer-motion";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function SKUVisibilityTable({ activeTab, setActiveTab, apiData }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [expandedSkus, setExpandedSkus] = useState(new Set());

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

    const skuData = useMemo(() => {
        let allItems = apiData?.terms || [];

        // Apply tab filtering Client-side if "My SKUs" vs "ALL SKUs" is clicked
        if (activeTab === "My SKUs") {
            // Simplified match: If standard case-insensitive brand includes the target
            // In a real app, you might map this more robustly
            allItems = allItems.filter(item =>
                item.topBrand?.toLowerCase().includes(brandName.toLowerCase()) ||
                item.topBrand === brandName
            );
        }

        return allItems;
    }, [apiData, activeTab, brandName]);


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
                                <th className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 w-[14%] border-r border-slate-100/50">Leading Brand</th>
                            )}
                            <th className="px-6 py-2.5 text-xs font-bold text-center text-slate-700 w-[16%] border-r border-slate-100/50">
                                Paid most viewed rank
                            </th>
                            <th className="px-6 py-2.5 text-xs font-bold text-center text-slate-700 w-[16%] border-r border-slate-100/50">
                                Organic most viewed rank
                            </th>
                            <th className="px-6 py-2.5 text-xs font-bold text-center text-slate-700 w-[16%]">
                                Overall most viewed rank
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
                                                <span className="text-[10px] text-slate-400 font-normal">({row.keywords?.length || 0} keywords)</span>
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
                                        {isExpanded && row.keywords?.map((kw, kwIdx) => (
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
                                                <td className="px-6 py-2 text-center text-[10px] font-bold text-slate-500">
                                                    {kw.paidData?.rank || 0}
                                                </td>
                                                <td className="px-6 py-2 text-center text-[10px] font-bold text-slate-500">
                                                    {kw.organicData?.rank || 0}
                                                </td>
                                                <td className="px-6 py-2 text-center text-[10px] font-bold text-slate-500">
                                                    {kw.overallData?.rank || 0}
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
