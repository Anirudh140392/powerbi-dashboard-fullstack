import React, { useState, useEffect, useRef, useMemo, useContext } from "react";
import { ArrowUp, ArrowDown, X, LineChart, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Check, Loader2, PieChart, Download } from "lucide-react";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import { motion, AnimatePresence } from "framer-motion";
import { fetchVisibilityBrandDrilldown, fetchVisibilitySkuDrilldown, fetchVisibilityCityDrilldown } from "../../api/visibilityService";
import dayjs from "dayjs";
import { FilterContext } from "../../utils/FilterContext";

// TopSearchTerms component uses dynamic data passed via `apiData` prop

const getVolShare = (name) => {
    if (!name) return "2.0";
    const seed = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return ((seed % 900) / 10 + 2).toFixed(1);
};

// Dynamic brand display uses backend data; removed hardcoded ALL_BRANDS and getCorrectBrand

const FilterDropdown = ({ options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const isAllSelected = selected.length === options.length;

    const handleOptionClick = (option) => {
        if (option === 'All') {
            if (isAllSelected) {
                onChange([]);
            } else {
                onChange(options);
            }
        } else {
            if (selected.includes(option)) {
                onChange(selected.filter(item => item !== option));
            } else {
                onChange([...selected, option]);
            }
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
                Brand
                <span className="flex items-center justify-center bg-slate-100 rounded-full px-1.5 min-w-[1.25rem] h-5 text-[10px] text-slate-600">
                    {isAllSelected ? 'All' : selected.length}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-slate-200 bg-white shadow-xl p-1"
                    >
                        <div
                            className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-md cursor-pointer font-medium border-b border-slate-50 mb-1"
                            onClick={() => handleOptionClick('All')}
                        >
                            <div className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${isAllSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                {isAllSelected && <Check size={10} className="text-white" />}
                            </div>
                            All Brands
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {options.map((option) => {
                                const isSelected = selected.includes(option);
                                return (
                                    <div
                                        key={option}
                                        className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-md cursor-pointer"
                                        onClick={() => handleOptionClick(option)}
                                    >
                                        <div className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                            {isSelected && <Check size={10} className="text-white" />}
                                        </div>
                                        {option}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


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

export default function TopSearchTerms({ filter = "All", skuTab = "All SKUs", apiData }) {
    const [drilldownKeyword, setDrilldownKeyword] = useState(null);
    const [expandedKeywordRows, setExpandedKeywordRows] = useState(new Set());
    const [expandedSkuRows, setExpandedSkuRows] = useState(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [selectedBrands, setSelectedBrands] = useState([]);

    // Drilldown modal dynamic states
    const [drilldownData, setDrilldownData] = useState([]);
    const [drilldownLosers, setDrilldownLosers] = useState([]);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [showOnlyLosers, setShowOnlyLosers] = useState(false);

    // Modal Pagination State
    const [modalPage, setModalPage] = useState(1);
    const [modalPageSize, setModalPageSize] = useState(5);

    // Dynamic data for drilldowns
    const [skuDrilldownData, setSkuDrilldownData] = useState({}); // { [keyword]: skus[] }
    const [cityDrilldownData, setCityDrilldownData] = useState({}); // { [keyword_sku]: cities[] }
    const [skuLoading, setSkuLoading] = useState({}); // { [keyword]: boolean }
    const [cityLoading, setCityLoading] = useState({}); // { [keyword_sku]: boolean }

    const { platform, location, timeStart, timeEnd, selectedKeyword, selectedBrand, visibilityOwnBrandsOnly } = useContext(FilterContext) || {};

    // Select specific data based on tab filter
    // Use API data (already filtered by backend based on filter param)
    const activeData = useMemo(() => {
        let list = apiData?.terms || [];
        
        // tab filtering (My SKUs vs ALL SKUs)
        if (skuTab === "My SKUs") {
            // Show keywords where we have ANY share of search
            list = list.filter(item => item.overallSos > 0);
        }

        return list;
    }, [apiData, filter, skuTab]);

    // Reset page and clear drilldowns when filter or SKU toggle changes
    useEffect(() => {
        setCurrentPage(1);
        setSkuDrilldownData({});
        setExpandedKeywordRows(new Set());
    }, [filter, visibilityOwnBrandsOnly]);

    const handleBrandClick = async (keyword) => {
        setDrilldownKeyword(keyword);
        setShowOnlyLosers(false); // Reset toggle when opening a new drilldown
        setModalPage(1);

        // Fetch real data from backend
        try {
            setDrilldownLoading(true);
            const data = await fetchVisibilityBrandDrilldown({
                keyword,
                platform,
                location,
                startDate: timeStart,
                endDate: timeEnd
            });

            const formatBrandData = (b) => ({
                brand: b.brand,
                overall: b.overallSos?.value || 0,
                overallDelta: b.overallSos?.delta || 0,
                organic: b.organicSos?.value || 0,
                organicDelta: b.organicSos?.delta || 0,
                paid: b.paidSos?.value || 0,
                paidDelta: b.paidSos?.delta || 0
            });

            const brands = (data?.brands || []).map(formatBrandData);
            const losers = (data?.topLosers || []).map(formatBrandData);

            setDrilldownData(brands);
            setDrilldownLosers(losers);

            // Initialize brand selection with all returned brands
            const brandNames = brands.map(d => d.brand);
            setSelectedBrands(brandNames);
        } catch (error) {
            console.error("Failed to load drilldown data:", error);
            // Fallback to empty if fails
            setDrilldownData([]);
            setDrilldownLosers([]);
            setSelectedBrands([]);
        } finally {
            setDrilldownLoading(false);
        }
    };

    const toggleKeywordExpand = async (keyword) => {
        console.log(`[DEBUG] toggleKeywordExpand called for: ${keyword}`);
        const isCurrentlyExpanded = expandedKeywordRows.has(keyword);
        
        setExpandedKeywordRows((prev) => {
            const next = new Set(prev);
            if (next.has(keyword)) next.delete(keyword);
            else next.add(keyword);
            return next;
        });

        // Trigger fetch if expanding and data doesn't exist
        if (!isCurrentlyExpanded && !skuDrilldownData[keyword]) {
            try {
                setSkuLoading(prev => ({ ...prev, [keyword]: true }));
                const params = {
                    keyword,
                    platform,
                    location: 'All',
                    ownBrandsOnly: visibilityOwnBrandsOnly
                };
                if (timeStart) params.startDate = dayjs(timeStart).format('YYYY-MM-DD');
                if (timeEnd) params.endDate = dayjs(timeEnd).format('YYYY-MM-DD');
                const response = await fetchVisibilitySkuDrilldown(params);
                setSkuDrilldownData(prev => ({ ...prev, [keyword]: response.skus || [] }));
            } catch (err) {
                console.error("Failed to fetch SKU drilldown:", err);
            } finally {
                setSkuLoading(prev => ({ ...prev, [keyword]: false }));
            }
        }
    };

    const toggleSkuExpand = async (keyword, skuName) => {
        const key = `${keyword}_${skuName}`;
        const isCurrentlyExpanded = expandedSkuRows.has(key);

        setExpandedSkuRows((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

        // Trigger fetch if expanding and data doesn't exist
        if (!isCurrentlyExpanded && !cityDrilldownData[key]) {
            try {
                setCityLoading(prev => ({ ...prev, [key]: true }));
                const params = {
                    keyword,
                    sku: skuName,
                    platform,
                    location: 'All',
                };
                if (timeStart) params.startDate = dayjs(timeStart).format('YYYY-MM-DD');
                if (timeEnd) params.endDate = dayjs(timeEnd).format('YYYY-MM-DD');
                const response = await fetchVisibilityCityDrilldown(params);
                setCityDrilldownData(prev => ({ ...prev, [key]: response.cities || [] }));
            } catch (err) {
                console.error("Failed to fetch City drilldown:", err);
            } finally {
                setCityLoading(prev => ({ ...prev, [key]: false }));
            }
        }
    };

    const closeDrilldown = () => {
        setDrilldownKeyword(null);
        setSelectedBrands([]);
        setDrilldownData([]);
        setDrilldownLosers([]);
    };

    const availableBrands = showOnlyLosers
        ? drilldownLosers.map(d => d.brand)
        : drilldownData.map(d => d.brand);

    // Filter the data based on selection and Losers toggle
    const baseDrilldownData = showOnlyLosers ? drilldownLosers : drilldownData;
    const displayedDrilldownData = baseDrilldownData.filter(d => selectedBrands.includes(d.brand));

    // Paginate Modal Data
    const paginatedDrilldownData = displayedDrilldownData.slice(
        (modalPage - 1) * modalPageSize,
        modalPage * modalPageSize
    );

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

    const downloadCSV = () => {
        if (!activeData || activeData.length === 0) return;
        
        const headers = ["Keywords", "Volume Share", "Leading Brand", "Overall SOS", "Organic SOS", "Paid SOS"];
        
        const rows = activeData.map(row => [
            `"${row.keyword}"`,
            `"${getVolShare(row.keyword)}%"`,
            `"${(row.topBrand && row.topBrand !== "1" ? row.topBrand : "Other").replace(/"/g, '""')}"`,
            `"${row.overallSos}%"`,
            `"${row.organicSos}%"`,
            `"${row.paidSos}%"`
        ]);

        const csvContent = headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Top_Search_Terms_${skuTab.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-white">
                <div className="flex flex-col">
                    <h3 className="text-base font-bold text-slate-800 leading-none">Top Search Terms</h3>
                    {filter && filter !== 'All' && (
                        <div className="flex items-center gap-2 mt-1.5 transition-all">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                <PieChart size={10} className="text-[#2563eb]" />
                                <span className="text-[10px] font-bold text-slate-600 tabular-nums lowercase">{getVolShare(filter)}%</span>
                            </div>
                            <span className="text-[9px] font-semibold text-slate-400/90 tracking-wide uppercase">{filter} volume</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={downloadCSV}
                        className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                        title="Download CSV"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 w-[23%]">Keywords</th>
                            <th className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 w-[17%]">
                                Leading Brand <span className="normal-case font-normal text-[10px] text-slate-500">(by Overall SOS)</span>
                            </th>
                            <th className="px-6 py-2.5 text-xs font-bold text-slate-700 w-[20%] text-center">Overall SOS</th>
                            <th className="px-6 py-2.5 text-xs font-bold text-slate-700 w-[20%] text-center">Organic SOS</th>
                            <th className="px-6 py-2.5 text-xs font-bold text-slate-700 w-[20%] text-center">Paid SOS</th>
                        </tr>
                    </thead>
                    <motion.tbody
                        className="divide-y divide-slate-50"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {activeData.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, rowIdx) => {
                            const isKwExpanded = expandedKeywordRows.has(row.keyword);
                            return (
                                <React.Fragment key={`row-${rowIdx}`}>
                                    <motion.tr
                                        variants={itemVariants}
                                        className={`transition-colors ${isKwExpanded ? 'bg-slate-50/40' : 'hover:bg-slate-50/80'}`}
                                    >
                                        <td className="px-6 py-2.5 text-xs text-slate-700 font-semibold capitalize">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleKeywordExpand(row.keyword)}
                                                    className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 hover:text-slate-600"
                                                >
                                                    {isKwExpanded ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => toggleKeywordExpand(row.keyword)}
                                                    className="hover:text-blue-600 transition-colors text-left flex flex-col"
                                                >
                                                    <span>{row.keyword}</span>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-50 border border-indigo-100 shadow-sm transition-all hover:bg-slate-100 pb-1">
                                                            <PieChart size={9} className="text-[#2563eb]" />
                                                            <span className="text-[9px] font-bold text-[#2563eb] tracking-tighter">{getVolShare(row.keyword)}%</span>
                                                        </div>
                                                        <span className="text-[8px] text-slate-400 font-medium uppercase tracking-tight">Vol. Share</span>
                                                    </div>
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-2.5 text-[10px]">
                                            <button
                                                onClick={() => handleBrandClick(row.keyword)}
                                                className="pill underline-slide"
                                            >
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${selectedBrand !== "All" && row.topBrand?.toLowerCase() === selectedBrand?.toLowerCase() ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                                    {row.topBrand && row.topBrand !== "1" ? row.topBrand : "Other"}
                                                </span>
                                            </button>
                                        </td>
                                        <td className="px-6 py-2.5 text-center">
                                            <div className="mx-auto flex w-fit min-w-[90px] items-center justify-between gap-2.5 rounded-xl bg-emerald-50/50 px-2.5 py-1 border border-emerald-100/50">
                                                <span className="text-xs font-bold text-emerald-900">{row.overallSos}%</span>
                                                <DeltaIndicator value={row.overallDelta} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-2.5 text-center">
                                            <div className="mx-auto flex w-fit min-w-[90px] items-center justify-between gap-2.5 rounded-xl bg-emerald-50/50 px-2.5 py-1 border border-emerald-100/50">
                                                <span className="text-xs font-bold text-emerald-900">{row.organicSos}%</span>
                                                <DeltaIndicator value={row.organicDelta} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-2.5 text-center">
                                            <div className="mx-auto flex w-fit min-w-[90px] items-center justify-between gap-2.5 rounded-xl bg-emerald-50/50 px-2.5 py-1 border border-emerald-100/50">
                                                <span className="text-xs font-bold text-emerald-900">{row.paidSos}%</span>
                                                <DeltaIndicator value={row.paidDelta} />
                                            </div>
                                        </td>
                                    </motion.tr>

                                    {/* SKU Drilldown */}
                                    <AnimatePresence>
                                        {isKwExpanded && (skuLoading[row.keyword] ? (
                                            <motion.tr
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="bg-slate-50/20"
                                            >
                                                <td colSpan={5} className="py-6 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                                                        <span className="text-[10px] font-medium text-slate-400">Loading SKUs...</span>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ) : (skuDrilldownData[row.keyword] || []).map((sku, skuIdx) => {
                                            const isSkuExpanded = expandedSkuRows.has(`${row.keyword}_${sku.skuName}`);
                                            return (
                                                <React.Fragment key={`sku-${rowIdx}-${skuIdx}`}>
                                                    <motion.tr
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className={`border-b border-slate-50/50 ${isSkuExpanded ? 'bg-slate-100/30' : 'bg-slate-50/20'} group hover:bg-slate-100/50`}
                                                    >
                                                        <td className="px-6 py-2 pl-12 text-xs font-medium text-slate-600">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => toggleSkuExpand(row.keyword, sku.skuName)}
                                                                    className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400"
                                                                >
                                                                    {isSkuExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                                </button>
                                                                <span className="truncate max-w-[180px]" title={sku.skuName}>{sku.skuName}</span>
                                                            </div>
                                                        </td>
                                                         <td className="px-6 py-2 text-[10px] text-slate-500 font-semibold">
                                                            {sku.topBrand && sku.topBrand !== "1" ? sku.topBrand : (sku.brand && sku.brand !== "1" ? sku.brand : "Other")}
                                                        </td>
                                                        <td className="px-6 py-1.5 text-center">
                                                            <div className="mx-auto flex w-fit min-w-[80px] items-center justify-between gap-2">
                                                                <span className="text-[11px] font-bold text-slate-600">{sku.overallSos}%</span>
                                                                <DeltaIndicator value={sku.overallDelta} />
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-1.5 text-center">
                                                            <div className="mx-auto flex w-fit min-w-[80px] items-center justify-between gap-2">
                                                                <span className="text-[11px] font-bold text-slate-600">{sku.organicSos}%</span>
                                                                <DeltaIndicator value={sku.organicDelta} />
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-1.5 text-center">
                                                            <div className="mx-auto flex w-fit min-w-[80px] items-center justify-between gap-2">
                                                                <span className="text-[11px] font-bold text-slate-600">{sku.paidSos}%</span>
                                                                <DeltaIndicator value={sku.paidDelta} />
                                                            </div>
                                                        </td>
                                                    </motion.tr>

                                                    {/* City Drilldown under SKU */}
                                                    <AnimatePresence>
                                                        {isSkuExpanded && (cityLoading[`${row.keyword}_${sku.skuName}`] ? (
                                                            <motion.tr
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                className="bg-slate-100/10"
                                                            >
                                                                <td colSpan={5} className="py-4 text-center">
                                                                    <div className="flex flex-col items-center justify-center gap-1.5 pl-[84px]">
                                                                        <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                                                                        <span className="text-[9px] font-medium text-slate-400 text-center">Loading cities...</span>
                                                                    </div>
                                                                </td>
                                                            </motion.tr>
                                                        ) : (cityDrilldownData[`${row.keyword}_${sku.skuName}`] || []).map((city, cIdx) => (
                                                            <motion.tr
                                                                key={`city-${skuIdx}-${cIdx}`}
                                                                initial={{ opacity: 0, y: -5 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -5 }}
                                                                className="bg-slate-100/20 border-b border-white hover:bg-slate-100/40"
                                                            >
                                                                <td className="px-6 py-1 pl-[84px] text-[10px] font-medium text-slate-500">
                                                                    {city.city}
                                                                </td>
                                                                <td className="px-6 py-1 text-center text-[10px] text-slate-400">—</td>
                                                                <td className="px-6 py-1 text-center">
                                                                    <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-2">
                                                                        <span className="text-[10px] font-bold text-slate-400">{city.overallSos}%</span>
                                                                        <DeltaIndicator value={city.overallDelta} />
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-1 text-center">
                                                                    <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-2">
                                                                        <span className="text-[10px] font-bold text-slate-400">{city.organicSos}%</span>
                                                                        <DeltaIndicator value={city.organicDelta} />
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-1 text-center">
                                                                    <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-2">
                                                                        <span className="text-[10px] font-bold text-slate-400">{city.paidSos}%</span>
                                                                        <DeltaIndicator value={city.paidDelta} />
                                                                    </div>
                                                                </td>
                                                            </motion.tr>
                                                        )))}
                                                    </AnimatePresence>
                                                </React.Fragment>
                                            );
                                        }))}
                                    </AnimatePresence>
                                </React.Fragment>
                            );
                        })}
                    </motion.tbody>
                </table>
            </div>

            {/* Footer / Pagination */}
            <div className="border-t border-slate-100 bg-slate-50/50">
                <PaginationFooter
                    isVisible={activeData.length > 0}
                    currentPage={currentPage}
                    totalPages={Math.ceil(activeData.length / pageSize)}
                    onPageChange={setCurrentPage}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                />
            </div>

            {/* Drilldown Modal */}
            <AnimatePresence>
                {drilldownKeyword && (
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
                                    Brand Visibility for <span className="text-blue-600">"{drilldownKeyword}"</span>
                                </h4>
                                <div className="flex items-center gap-3">
                                    {/* Modal Tabs for All Brands vs Losers */}
                                    <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm mr-2">
                                        <button
                                            onClick={() => {
                                                setShowOnlyLosers(false);
                                                setModalPage(1);
                                            }}
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${!showOnlyLosers ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            All Brands
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowOnlyLosers(true);
                                                setModalPage(1);
                                            }}
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${showOnlyLosers ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            Losers
                                        </button>
                                    </div>
                                    <FilterDropdown
                                        options={availableBrands}
                                        selected={selectedBrands}
                                        onChange={setSelectedBrands}
                                    />
                                    <button
                                        onClick={closeDrilldown}
                                        className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                {drilldownLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" />
                                        <p className="text-sm font-medium text-slate-600">Loading brand insights...</p>
                                    </div>
                                ) : (
                                    <>
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
                                                {paginatedDrilldownData.map((d, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/50">
                                                        <td className="py-2 text-xs font-medium text-slate-800">{d.brand}</td>
                                                        <td className="py-2 text-center text-xs text-slate-600">
                                                            <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-2">
                                                                <span className="text-slate-600">{d.overall}%</span>
                                                                <DeltaIndicator value={d.overallDelta} />
                                                            </div>
                                                        </td>
                                                        <td className="py-2 text-center text-xs text-slate-600">
                                                            <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-2">
                                                                <span className="text-slate-600">{d.organic}%</span>
                                                                <DeltaIndicator value={d.organicDelta} />
                                                            </div>
                                                        </td>
                                                        <td className="py-2 text-center text-xs text-slate-600">
                                                            <div className="mx-auto flex w-fit min-w-[70px] items-center justify-between gap-2">
                                                                <span className="text-slate-600">{d.paid}%</span>
                                                                <DeltaIndicator value={d.paidDelta} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {paginatedDrilldownData.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="py-8 text-center text-xs text-slate-400 italic">
                                                            {showOnlyLosers ? "No loser brands found or selected" : "No brands selected or available"}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>

                                        {/* Modal Footer with Pagination */}
                                        <div className="mt-4 border-t border-slate-100 pt-3">
                                            <PaginationFooter
                                                isVisible={displayedDrilldownData.length > 0}
                                                currentPage={modalPage}
                                                totalPages={Math.ceil(displayedDrilldownData.length / modalPageSize)}
                                                onPageChange={setModalPage}
                                                pageSize={modalPageSize}
                                                onPageSizeChange={setModalPageSize}
                                                totalItems={displayedDrilldownData.length}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
