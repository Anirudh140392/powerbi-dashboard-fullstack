import React, { useState, useRef, useEffect, useContext } from 'react';
import { Skeleton } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FilterContext } from '../../utils/FilterContext';
import axiosInstance from '../../api/axiosInstance';

/* ── Sparkline helpers ── */
const generateSparkData = (currentVal, delta, seed = 0) => {
    const points = [];
    const base = currentVal - Math.abs(delta) * 3;
    for (let i = 0; i < 7; i++) {
        const noise = Math.sin(seed * 13.7 + i * 2.3) * Math.abs(delta) * 1.5;
        points.push(Math.max(0, base + (delta * i / 6) + noise));
    }
    return points;
};

const MiniSparkline = ({ data, color = '#3b82f6', width = 100, height = 32 }) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = 2;

    const points = data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (width - pad * 2);
        const y = height - pad - ((v - min) / range) * (height - pad * 2);
        return `${x},${y}`;
    });

    const fillPoints = [`${pad},${height - pad}`, ...points, `${width - pad},${height - pad}`].join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible">
            <polygon points={fillPoints} fill={color} opacity={0.1} />
            <polyline
                points={points.join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Last point dot */}
            {(() => {
                const lastPt = points[points.length - 1].split(',');
                return <circle cx={lastPt[0]} cy={lastPt[1]} r={2.5} fill={color} />;
            })()}
        </svg>
    );
};

const SparklineCell = ({ data, kpiId, children }) => {
    const [hovered, setHovered] = useState(false);
    const sparkData = generateSparkData(data.val, data.delta, data.val * 7.3 + (kpiId === 'asp' ? 100 : 0));
    const sparkColor = data.delta >= 0 ? '#10b981' : '#f43f5e';
    const labels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'];

    return (
        <div
            className="relative flex justify-center"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {children}
            <AnimatePresence>
                {hovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full mb-2 z-50 bg-white rounded-xl border border-slate-200 shadow-xl px-3 py-2.5 pointer-events-none"
                        style={{ minWidth: 140 }}
                    >
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">7-Week Trend</div>
                        <MiniSparkline data={sparkData} color={sparkColor} width={110} height={30} />
                        <div className="flex justify-between mt-1">
                            {labels.filter((_, i) => i % 2 === 0).map(l => (
                                <span key={l} className="text-[8px] text-slate-400 font-medium">{l}</span>
                            ))}
                        </div>
                        {/* Tooltip arrow */}
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white border-b border-r border-slate-200 rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const SubCategoryMarket = ({ loading: parentLoading }) => {
    const [colsPerPage, setColsPerPage] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedSubCat, setSelectedSubCat] = useState([]); // Array for multi-select
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Backend data state
    const [subCategories, setSubCategories] = useState([]);
    const [brandsData, setBrandsData] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

    // Get filters from context
    const {
        platform,
        selectedCategory,
        selectedLocation,
        timeStart,
        timeEnd,
        compareStart,
        compareEnd,
    } = useContext(FilterContext);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset selectedSubCat when global category changes to ensure we fetch relevant data
    useEffect(() => {
        setSelectedSubCat([]);
    }, [selectedCategory]);

    // Fetch sub-category KPI data from backend
    useEffect(() => {
        const fetchSubCategoryKpi = async () => {
            setDataLoading(true);
            try {
                const params = {
                    platform: platform === 'All' ? undefined : (Array.isArray(platform) ? platform.join(",") : platform),
                    category: selectedCategory === 'All' ? undefined : (Array.isArray(selectedCategory) ? selectedCategory.join(",") : selectedCategory),
                    location: undefined, // Enforced isolation from global location filter
                    startDate: timeStart ? timeStart.format("YYYY-MM-DD") : undefined,
                    endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : undefined,
                    compareStartDate: compareStart ? compareStart.format("YYYY-MM-DD") : undefined,
                    compareEndDate: compareEnd ? compareEnd.format("YYYY-MM-DD") : undefined,
                    subCategory: selectedSubCat.length > 0 ? selectedSubCat.join(",") : undefined,
                };

                const response = await axiosInstance.get('/market-share/sub-category-kpi', { params });
                console.log("Sub-Category KPI Data:", response.data);

                if (response.data) {
                    const { subCategories: cats, brands, selectedSubCategory } = response.data;
                    if (cats && cats.length > 0) {
                        setSubCategories(cats);
                    }
                    if (brands) {
                        setBrandsData(brands);
                    }
                    // Set default selected sub-category on first load if none selected
                    if (selectedSubCat.length === 0 && selectedSubCategory) {
                        setSelectedSubCat(Array.isArray(selectedSubCategory) ? selectedSubCategory : [selectedSubCategory]);
                    }
                }
            } catch (error) {
                console.error("Error fetching Sub-Category KPI data:", error);
            } finally {
                setDataLoading(false);
            }
        };

        fetchSubCategoryKpi();
    }, [platform, selectedCategory, selectedLocation, timeStart, timeEnd, compareStart, compareEnd, selectedSubCat]);

    const loading = parentLoading || dataLoading;

    // Reset pagination when data updates or colsPerPage changes
    useEffect(() => {
        setCurrentPage(1);
    }, [brandsData, colsPerPage]);

    const totalPages = Math.max(1, Math.ceil(brandsData.length / colsPerPage));
    const currentData = brandsData.slice((currentPage - 1) * colsPerPage, currentPage * colsPerPage);

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const kpiColumns = [
        { id: 'marketShare', label: 'Market Share %' },
        { id: 'overallSov', label: 'Overall Share of Visibility' },
        { id: 'paidSov', label: 'Paid Share of Visibility' }
    ];

    const getStatusStyles = (status) => {
        switch (status) {
            case 'Healthy': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'Watch': return 'bg-orange-50 text-orange-700 border-orange-100';
            case 'Action': return 'bg-rose-50 text-rose-700 border-rose-100';
            default: return 'bg-slate-50 text-slate-700 border-slate-100';
        }
    };

    const formatValue = (val, id) => {
        return `${val.toFixed(2)}%`;
    };

    // Toggle multi-select category
    const toggleCategory = (cat) => {
        setSelectedSubCat(prev => {
            if (prev.includes(cat)) {
                return prev.filter(c => c !== cat);
            } else {
                return [...prev, cat];
            }
        });
    };

    return (
        <motion.div
            className="bg-white rounded-3xl shadow-sm border border-slate-200 mt-6 overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {/* Header */}
            <div className="px-6 py-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">KPI Matrix</h2>
                    <p className="text-[13px] text-slate-500 mt-0.5">Hover on any value to see trend sparkline.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border shadow-sm",
                                isDropdownOpen
                                    ? "bg-slate-900 text-white border-slate-900 shadow-lg"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:shadow-md"
                            )}
                        >
                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">Category:</span>
                            <span className="max-w-[150px] truncate">
                                {selectedSubCat.length === 0 ? 'Select' :
                                    selectedSubCat.length === 1 ? selectedSubCat[0] :
                                        `${selectedSubCat[0]} +${selectedSubCat.length - 1}`}
                            </span>
                            <ChevronDown
                                size={14}
                                className={cn(
                                    "transition-transform duration-200",
                                    isDropdownOpen && "rotate-180"
                                )}
                            />
                        </button>

                        <AnimatePresence>
                            {isDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto"
                                >
                                    <div className="p-1.5">
                                        {subCategories.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => {
                                                    toggleCategory(cat);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-all duration-150",
                                                    selectedSubCat.includes(cat)
                                                        ? "bg-slate-900 text-white"
                                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                )}
                                            >
                                                <span>{cat}</span>
                                                {selectedSubCat.includes(cat) && (
                                                    <Check size={14} className="text-emerald-400" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1"></div>
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Healthy
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Watch
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Action
                        </span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50/10">
                            <th className="px-8 py-3 text-left text-[11px] font-extrabold text-slate-900 uppercase tracking-widest border-b border-slate-100 sticky left-0 bg-white z-20 min-w-[200px]">
                                Brand
                            </th>
                            {kpiColumns.map(kpi => (
                                <th key={kpi.id} className="px-6 py-3 border-b border-slate-100 min-w-[220px]">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">
                                            {kpi.label}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={"skeleton-" + i} className="border-b border-slate-50">
                                    <td className="px-8 py-4 sticky left-0 bg-white z-10"><Skeleton variant="text" width="60%" /></td>
                                    <td className="px-6 py-4"><Skeleton variant="rounded" height={32} /></td>
                                    <td className="px-6 py-4"><Skeleton variant="rounded" height={32} /></td>
                                    <td className="px-6 py-4"><Skeleton variant="rounded" height={32} /></td>
                                </tr>
                            ))
                        ) : currentData.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-12 text-center text-slate-400 text-sm">
                                    No data available for the selected filters.
                                </td>
                            </tr>
                        ) : (
                            currentData.map((brandInfo) => (
                                <tr key={brandInfo.brand} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0 font-roboto">
                                    <td className="px-8 py-4 sticky left-0 bg-white z-10 group-hover:bg-slate-50/50 transition-colors border-r border-slate-50/50">
                                        <span className="text-[11px] font-extrabold text-slate-900 tracking-widest uppercase">
                                            {brandInfo.brand}
                                        </span>
                                    </td>
                                    {kpiColumns.map(kpi => {
                                        const data = brandInfo.metrics[kpi.id];
                                        return (
                                            <td key={kpi.id} className="px-6 py-4 border-l border-slate-50/30">
                                                <SparklineCell data={data} kpiId={kpi.id}>
                                                    <div className={cn(
                                                        "inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all duration-300 cursor-default",
                                                        getStatusStyles(data.status)
                                                    )}>
                                                        <span className="text-[11px] font-extrabold tracking-tight">
                                                            {formatValue(data.val, kpi.id)}
                                                        </span>
                                                        <div className="flex items-center gap-1 opacity-80">
                                                            {data.delta >= 0 ?
                                                                <TrendingUp size={10} className="text-emerald-500" /> :
                                                                <TrendingDown size={10} className="text-rose-500" />
                                                            }
                                                            <span className="text-[9px] font-bold">
                                                                {data.delta >= 0 ? '+' : ''}{data.delta}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </SparklineCell>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="px-6 py-5 flex items-center justify-between border-t border-slate-100 bg-white shadow-[0_-4px_20px_-12px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
                            className="p-1 text-slate-300 hover:text-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-[13px] font-bold text-slate-400">
                            Page <span className="text-slate-900">{currentPage}</span> / {totalPages}
                        </span>
                        <button 
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                            className="p-1 text-slate-300 hover:text-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Cols/page</span>
                    <select
                        value={colsPerPage}
                        onChange={(e) => setColsPerPage(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-400/50"
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                    </select>
                </div>
            </div>
        </motion.div>
    );
};

export default SubCategoryMarket;
