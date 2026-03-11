import React, { useState, useEffect, useRef, useMemo, useContext } from "react";
import { ArrowUp, ArrowDown, X, LineChart, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Check, Loader2 } from "lucide-react";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import { motion, AnimatePresence } from "framer-motion";
import { fetchVisibilityBrandDrilldown } from "../../api/visibilityService";
import { FilterContext } from "../../utils/FilterContext";

// TopSearchTerms component uses dynamic data passed via `apiData` prop

const getCityData = (row) => {
    const cities = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Pune"];
    const seed = row.keyword.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    return cities.map((city, idx) => {
        // Deterministic variation based on seed and index
        const v1 = ((seed * (idx + 1)) % 40) / 10 - 2; // -2 to 2
        const v2 = ((seed * (idx + 2)) % 30) / 10 - 1.5; // -1.5 to 1.5
        const v3 = ((seed * (idx + 3)) % 25) / 10 - 1.25; // -1.25 to 1.25

        return {
            city,
            overallSos: (Math.max(2, parseFloat(row.overallSos) + v1)).toFixed(1),
            overallDelta: (parseFloat(row.overallDelta) + v1 / 2).toFixed(1),
            organicSos: (Math.max(1, parseFloat(row.organicSos) + v2)).toFixed(1),
            organicDelta: (parseFloat(row.organicDelta) + v2 / 2).toFixed(1),
            paidSos: (Math.max(0, parseFloat(row.paidSos) + v3)).toFixed(1),
            paidDelta: (parseFloat(row.paidDelta) + v3 / 2).toFixed(1),
        };
    });
};

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

export default function TopSearchTerms({ filter = "All", apiData }) {
    const [drilldownKeyword, setDrilldownKeyword] = useState(null);
    const [expandedCityRows, setExpandedCityRows] = useState(new Set());
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

    const { platform, location, timeStart, timeEnd, selectedKeyword } = useContext(FilterContext) || {};

    // Select specific data based on tab filter
    // Use API data (already filtered by backend based on filter param)
    const activeData = useMemo(() => {
        return apiData?.terms || [];
    }, [apiData]);

    // Reset page when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filter]);

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

    const toggleCityDrilldown = (keyword) => {
        setExpandedCityRows((prev) => {
            const next = new Set(prev);
            if (next.has(keyword)) {
                next.delete(keyword);
            } else {
                next.add(keyword);
            }
            return next;
        });
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
                        {activeData.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, idx) => {
                            const isExpanded = expandedCityRows.has(row.keyword);
                            return (
                                <React.Fragment key={idx}>
                                    <motion.tr
                                        variants={itemVariants}
                                        className={`transition-colors ${isExpanded ? 'bg-slate-50/40' : 'hover:bg-slate-50/80'}`}
                                    >
                                        <td className="px-6 py-2.5 text-xs text-slate-700 font-semibold capitalize">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleCityDrilldown(row.keyword)}
                                                    className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 hover:text-slate-600"
                                                >
                                                    {isExpanded ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => toggleCityDrilldown(row.keyword)}
                                                    className="hover:text-blue-600 transition-colors text-left"
                                                >
                                                    {row.keyword}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-2.5 text-[10px]">
                                            <motion.button
                                                onClick={() => handleBrandClick(row.keyword)}
                                                whileTap={{ scale: 0.95 }}
                                                className="pill underline-slide"
                                            >
                                                {row.topBrand}
                                            </motion.button>
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

                                    {/* Inline City Drilldown Rows */}
                                    <AnimatePresence>
                                        {isExpanded && getCityData(row).map((city, cIdx) => (
                                            <motion.tr
                                                key={`city-${cIdx}`}
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -5 }}
                                                className="bg-slate-50/30 border-b border-white"
                                            >
                                                <td className="px-6 py-1.5 pl-[52px] text-[11px] font-medium text-slate-500">
                                                    {city.city}
                                                </td>
                                                <td className="px-6 py-1.5 text-center text-[11px] text-slate-400">
                                                    —
                                                </td>
                                                <td className="px-6 py-1.5 text-center">
                                                    <div className="mx-auto flex w-fit min-w-[80px] items-center justify-between gap-2">
                                                        <span className="text-[11px] font-bold text-slate-600">{city.overallSos}%</span>
                                                        <DeltaIndicator value={city.overallDelta} />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-1.5 text-center">
                                                    <div className="mx-auto flex w-fit min-w-[80px] items-center justify-between gap-2">
                                                        <span className="text-[11px] font-bold text-slate-600">{city.organicSos}%</span>
                                                        <DeltaIndicator value={city.organicDelta} />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-1.5 text-center">
                                                    <div className="mx-auto flex w-fit min-w-[80px] items-center justify-between gap-2">
                                                        <span className="text-[11px] font-bold text-slate-600">{city.paidSos}%</span>
                                                        <DeltaIndicator value={city.paidDelta} />
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
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
