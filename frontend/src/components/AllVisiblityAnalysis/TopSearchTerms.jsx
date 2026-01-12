import React, { useState, useEffect, useRef } from "react";
import { ArrowUp, ArrowDown, X, LineChart, TrendingUp, TrendingDown, Minus, ChevronDown, Check } from "lucide-react";
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


const DeltaIndicator = ({ value, isPosition = false }) => {
    const num = Number(value || 0);
    const absValue = Math.abs(num).toFixed(1);

    if (isPosition) {
        return (
            <span className="inline-flex items-center gap-[1px] rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 h-[18px] leading-none">
                Pos: {num || '–'}
            </span>
        );
    }

    if (num > 0) {
        return (
            <span className="inline-flex items-center gap-[1px] rounded-full border border-emerald-200 bg-emerald-50 px-1 py-0.5 text-[10px] font-medium text-emerald-700 h-[18px] leading-none">
                <TrendingUp size={10} />
                {absValue}
            </span>
        );
    }

    if (num < 0) {
        return (
            <span className="inline-flex items-center gap-[1px] rounded-full border border-rose-200 bg-rose-50 px-1 py-0.5 text-[10px] font-medium text-rose-700 h-[18px] leading-none">
                <TrendingDown size={10} />
                {absValue}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-[1px] rounded-full border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] font-medium text-slate-600 h-[18px] leading-none">
            <Minus size={10} />
            {absValue}
        </span>
    );
};

export default function TopSearchTerms({ filter = "All", data = null, loading = false, filters = {} }) {
    const [selectedKeyword, setSelectedKeyword] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedBrands, setSelectedBrands] = useState([]);
    const [drilldownData, setDrilldownData] = useState([]);
    const [topLosers, setTopLosers] = useState([]);
    const [modalLoading, setModalLoading] = useState(false);

    useEffect(() => {
        if (!selectedKeyword) return;

        const fetchDrilldown = async () => {
            setModalLoading(true);
            try {
                const params = new URLSearchParams({
                    keyword: selectedKeyword,
                    platform: filters?.platform || 'All',
                    location: filters?.location || 'All',
                    startDate: filters?.startDate || '',
                    endDate: filters?.endDate || ''
                }).toString();

                const res = await fetch(`/api/visibility-analysis/brand-drilldown?${params}`);
                const result = await res.json();

                setDrilldownData(result.brands || []);
                setTopLosers(result.topLosers || []);

                // Select all brands by default on fresh fetch
                const allBrands = (result.brands || []).map(b => b.brand);
                setSelectedBrands(allBrands);
            } catch (err) {
                console.error('Error fetching brand drilldown:', err);
            } finally {
                setModalLoading(false);
            }
        };

        fetchDrilldown();
    }, [selectedKeyword, filters]);

    // Use API data if provided
    const displayData = data || [];

    const handleBrandClick = (keyword) => {
        setSelectedKeyword(keyword);
    };

    const closeDrilldown = () => {
        setSelectedKeyword(null);
        setSelectedBrands([]);
        setDrilldownData([]);
        setTopLosers([]);
    };

    const availableBrands = drilldownData.map(d => d.brand);
    const displayedDrilldownData = drilldownData.filter(d => selectedBrands.includes(d.brand));

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    if (loading && !displayData.length) {
        return (
            <div className="w-full h-64 flex items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
                    <p className="text-sm text-slate-500 font-medium">Loading top search terms...</p>
                </div>
            </div>
        );
    }

    if (!displayData.length) {
        return (
            <div className="w-full h-64 flex items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-400 italic">No search terms found for the selected filters</p>
            </div>
        );
    }

    return (
        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white/50">
                <div className="flex items-center gap-2">
                    <TrendingUp className="text-blue-600" size={20} />
                    <h3 className="text-lg font-bold text-slate-800">Top Search Terms</h3>
                </div>
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                    Showing top {displayData.length} keywords
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 w-[20%]">Keywords</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 w-[15%]">
                                Leading Brand <span className="normal-case font-medium text-[10px] text-slate-400 block mt-0.5">(by Overall Share of Search)</span>
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 w-[20%] text-center uppercase">Overall Share of Search</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 w-[20%] text-center uppercase">Organic Share of Search</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 w-[20%] text-center uppercase">Paid Share of Search</th>
                        </tr>
                    </thead>
                    <motion.tbody
                        className="divide-y divide-slate-100"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {displayData.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, idx) => (
                            <motion.tr
                                key={idx}
                                variants={itemVariants}
                                className="hover:bg-blue-50/20 transition-colors group border-b border-slate-50 last:border-0"
                            >
                                <td className="px-6 py-4 text-xs text-slate-700 font-bold capitalize">
                                    {row.keyword}
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleBrandClick(row.keyword)}
                                        className="text-[11px] font-bold text-slate-700 bg-slate-100/50 group-hover:bg-blue-50 px-2 py-1 rounded border border-slate-200/50 transition-all hover:border-blue-200"
                                    >
                                        {row.topBrand}
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="mx-auto flex w-fit items-center gap-2">
                                        <span className="text-[13px] font-black text-slate-900">{row.overallSos}%</span>
                                        <span className="text-[11px] font-bold text-slate-400">({row.overallPos})</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="mx-auto flex w-fit items-center gap-2">
                                        <span className="text-[13px] font-black text-slate-900">{row.organicSos}%</span>
                                        <span className="text-[11px] font-bold text-slate-400">({row.organicPos})</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="mx-auto flex w-fit items-center gap-2">
                                        <span className="text-[13px] font-black text-slate-900">{row.paidSos}%</span>
                                        <span className="text-[11px] font-bold text-slate-400">({row.paidPos})</span>
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
                    isVisible={displayData.length > pageSize}
                    currentPage={currentPage}
                    totalPages={Math.ceil(displayData.length / pageSize)}
                    onPageChange={setCurrentPage}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                />
            </div>

            {/* Drilldown Modal (Kept as is but updated for better UI) */}
            <AnimatePresence>
                {selectedKeyword && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                <div>
                                    <h4 className="text-base font-bold text-slate-800">
                                        Brand Visibility Analysis
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-0.5">Keyword: <span className="text-blue-600 font-semibold">"{selectedKeyword}"</span></p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <FilterDropdown
                                        options={availableBrands}
                                        selected={selectedBrands}
                                        onChange={setSelectedBrands}
                                    />
                                    <button
                                        onClick={closeDrilldown}
                                        className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6">
                                {modalLoading ? (
                                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
                                        <p className="text-sm text-slate-500 font-medium">Crunching brand data...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Top Losers Section */}
                                        {topLosers.length > 0 && (
                                            <div className="mb-6 rounded-xl bg-rose-50 border border-rose-100 p-4">
                                                <h5 className="text-[10px] font-bold text-rose-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <TrendingDown size={14} className="text-rose-600" />
                                                    Top Loser Brands (by Overall Share)
                                                </h5>
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                    {topLosers.map((loser, idx) => (
                                                        <div key={idx} className="bg-white rounded-lg p-2.5 shadow-sm border border-rose-100 flex flex-col gap-1 transition-transform hover:scale-[1.02]">
                                                            <span className="text-[11px] font-bold text-slate-700 truncate">{loser.brand}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[12px] font-black text-rose-600">
                                                                    {loser.delta >= 0 ? '+' : ''}{loser.delta}%
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 font-medium">vs prev</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-slate-100 text-[11px] text-slate-400 uppercase tracking-widest font-bold">
                                                    <th className="pb-3">Brand</th>
                                                    <th className="pb-3 text-center">Overall Sos</th>
                                                    <th className="pb-3 text-center">Delta</th>
                                                    <th className="pb-3 text-center">Organic Sos</th>
                                                    <th className="pb-3 text-center">Paid Sos</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {displayedDrilldownData.map((d, i) => {
                                                    const isLoser = d.delta < 0;
                                                    return (
                                                        <tr key={i} className={`hover:bg-slate-50 transition-colors ${isLoser ? 'bg-rose-50/20' : ''}`}>
                                                            <td className="py-3 text-xs font-bold text-slate-700">
                                                                <div className="flex items-center gap-2">
                                                                    {isLoser && <TrendingDown size={12} className="text-rose-500" />}
                                                                    {d.brand}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 text-center">
                                                                <span className="text-xs font-bold text-slate-900 bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                                                                    {d.overall}%
                                                                </span>
                                                            </td>
                                                            <td className="py-3 text-center">
                                                                <DeltaIndicator value={d.delta} />
                                                            </td>
                                                            <td className="py-3 text-center text-xs text-slate-600 font-medium">{d.organic}%</td>
                                                            <td className="py-3 text-center text-xs text-slate-600 font-medium">{d.paid}%</td>
                                                        </tr>
                                                    );
                                                })}
                                                {displayedDrilldownData.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="py-12 text-center text-sm text-slate-400 italic">
                                                            No brands selected for comparison
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
