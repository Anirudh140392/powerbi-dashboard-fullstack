import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

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

/* ── Sub-category → brand data mapping ── */
const subCategoryBrands = {
    Candies: [
        {
            brand: 'Cadbury',
            metrics: {
                marketShare: { val: 35.17, delta: -1.6, status: 'Action' },
                asp: { val: 141, delta: +4.2, status: 'Healthy' },
                overallSov: { val: 26.65, delta: -3.1, status: 'Watch' },
                paidSov: { val: 9.92, delta: +1.5, status: 'Healthy' }
            }
        },
        {
            brand: 'Ferrero',
            metrics: {
                marketShare: { val: 24.27, delta: +1.5, status: 'Healthy' },
                asp: { val: 766, delta: -0.1, status: 'Watch' },
                overallSov: { val: 2.84, delta: -4.4, status: 'Action' },
                paidSov: { val: 4.63, delta: -0.1, status: 'Watch' }
            }
        },
        {
            brand: 'Lindt',
            metrics: {
                marketShare: { val: 6.48, delta: -4.9, status: 'Action' },
                asp: { val: 685, delta: -1.2, status: 'Watch' },
                overallSov: { val: 0.07, delta: -0.5, status: 'Action' },
                paidSov: { val: 0.00, delta: -0.0, status: 'Watch' }
            }
        },
        {
            brand: 'Nestle',
            metrics: {
                marketShare: { val: 5.23, delta: -0.2, status: 'Watch' },
                asp: { val: 96, delta: +1.6, status: 'Healthy' },
                overallSov: { val: 9.58, delta: -0.2, status: 'Watch' },
                paidSov: { val: 3.78, delta: -7.1, status: 'Action' }
            }
        },
        {
            brand: 'Mars',
            metrics: {
                marketShare: { val: 3.13, delta: -2.2, status: 'Action' },
                asp: { val: 99, delta: +4.8, status: 'Healthy' },
                overallSov: { val: 11.60, delta: +4.8, status: 'Healthy' },
                paidSov: { val: 13.15, delta: -7.1, status: 'Action' }
            }
        }
    ],
    'Filled Bars': [
        {
            brand: 'Snickers',
            metrics: {
                marketShare: { val: 28.45, delta: +2.3, status: 'Healthy' },
                asp: { val: 55, delta: +1.1, status: 'Healthy' },
                overallSov: { val: 18.20, delta: +3.5, status: 'Healthy' },
                paidSov: { val: 12.40, delta: +0.8, status: 'Healthy' }
            }
        },
        {
            brand: 'KitKat',
            metrics: {
                marketShare: { val: 22.10, delta: -0.5, status: 'Watch' },
                asp: { val: 42, delta: +2.0, status: 'Healthy' },
                overallSov: { val: 15.70, delta: -1.2, status: 'Watch' },
                paidSov: { val: 8.90, delta: -2.3, status: 'Action' }
            }
        },
        {
            brand: 'Twix',
            metrics: {
                marketShare: { val: 12.80, delta: -1.8, status: 'Action' },
                asp: { val: 65, delta: +0.5, status: 'Healthy' },
                overallSov: { val: 7.35, delta: -0.9, status: 'Watch' },
                paidSov: { val: 5.20, delta: +1.1, status: 'Healthy' }
            }
        },
        {
            brand: 'Bounty',
            metrics: {
                marketShare: { val: 8.55, delta: +0.7, status: 'Healthy' },
                asp: { val: 70, delta: -0.3, status: 'Watch' },
                overallSov: { val: 4.10, delta: -2.1, status: 'Action' },
                paidSov: { val: 3.65, delta: +0.4, status: 'Healthy' }
            }
        },
        {
            brand: 'Milky Way',
            metrics: {
                marketShare: { val: 5.30, delta: -3.1, status: 'Action' },
                asp: { val: 38, delta: +1.8, status: 'Healthy' },
                overallSov: { val: 2.90, delta: -0.6, status: 'Watch' },
                paidSov: { val: 1.80, delta: -1.5, status: 'Action' }
            }
        }
    ],
    Gums: [
        {
            brand: 'Orbit',
            metrics: {
                marketShare: { val: 32.60, delta: +1.2, status: 'Healthy' },
                asp: { val: 30, delta: +0.8, status: 'Healthy' },
                overallSov: { val: 22.40, delta: +2.1, status: 'Healthy' },
                paidSov: { val: 14.50, delta: +1.7, status: 'Healthy' }
            }
        },
        {
            brand: 'Mentos',
            metrics: {
                marketShare: { val: 18.90, delta: -0.3, status: 'Watch' },
                asp: { val: 25, delta: +1.5, status: 'Healthy' },
                overallSov: { val: 12.80, delta: -1.0, status: 'Watch' },
                paidSov: { val: 6.20, delta: -2.8, status: 'Action' }
            }
        },
        {
            brand: 'Center Fresh',
            metrics: {
                marketShare: { val: 14.25, delta: -2.5, status: 'Action' },
                asp: { val: 10, delta: +0.2, status: 'Healthy' },
                overallSov: { val: 8.60, delta: -0.4, status: 'Watch' },
                paidSov: { val: 4.30, delta: +0.9, status: 'Healthy' }
            }
        },
        {
            brand: 'Happydent',
            metrics: {
                marketShare: { val: 10.40, delta: +0.6, status: 'Healthy' },
                asp: { val: 15, delta: -0.1, status: 'Watch' },
                overallSov: { val: 5.90, delta: +1.3, status: 'Healthy' },
                paidSov: { val: 2.70, delta: -1.2, status: 'Action' }
            }
        },
        {
            brand: 'Boomer',
            metrics: {
                marketShare: { val: 7.15, delta: -1.8, status: 'Action' },
                asp: { val: 5, delta: +0.3, status: 'Healthy' },
                overallSov: { val: 3.40, delta: -0.7, status: 'Watch' },
                paidSov: { val: 1.10, delta: -0.5, status: 'Watch' }
            }
        }
    ],
    'Gift Packs': [
        {
            brand: 'Cadbury Celebrations',
            metrics: {
                marketShare: { val: 42.30, delta: +3.5, status: 'Healthy' },
                asp: { val: 350, delta: +2.0, status: 'Healthy' },
                overallSov: { val: 30.10, delta: +4.2, status: 'Healthy' },
                paidSov: { val: 18.70, delta: +2.8, status: 'Healthy' }
            }
        },
        {
            brand: 'Ferrero Rocher',
            metrics: {
                marketShare: { val: 22.80, delta: -0.8, status: 'Watch' },
                asp: { val: 650, delta: +1.1, status: 'Healthy' },
                overallSov: { val: 14.50, delta: -1.5, status: 'Watch' },
                paidSov: { val: 9.30, delta: +0.3, status: 'Healthy' }
            }
        },
        {
            brand: 'Toblerone',
            metrics: {
                marketShare: { val: 11.45, delta: -2.1, status: 'Action' },
                asp: { val: 480, delta: -0.5, status: 'Watch' },
                overallSov: { val: 6.20, delta: -1.8, status: 'Action' },
                paidSov: { val: 3.90, delta: -0.7, status: 'Watch' }
            }
        },
        {
            brand: 'Lindt Box',
            metrics: {
                marketShare: { val: 8.90, delta: +0.4, status: 'Healthy' },
                asp: { val: 900, delta: +3.2, status: 'Healthy' },
                overallSov: { val: 3.80, delta: +0.6, status: 'Healthy' },
                paidSov: { val: 2.50, delta: -1.0, status: 'Watch' }
            }
        },
        {
            brand: 'Mars Assorted',
            metrics: {
                marketShare: { val: 5.60, delta: -1.3, status: 'Action' },
                asp: { val: 280, delta: +0.9, status: 'Healthy' },
                overallSov: { val: 2.10, delta: -0.4, status: 'Watch' },
                paidSov: { val: 1.40, delta: -2.5, status: 'Action' }
            }
        }
    ],
    Others: [
        {
            brand: 'Amul',
            metrics: {
                marketShare: { val: 18.70, delta: -1.1, status: 'Watch' },
                asp: { val: 178, delta: +0.2, status: 'Healthy' },
                overallSov: { val: 10.50, delta: -0.8, status: 'Watch' },
                paidSov: { val: 4.20, delta: -2.1, status: 'Action' }
            }
        },
        {
            brand: 'Parle',
            metrics: {
                marketShare: { val: 14.30, delta: +0.9, status: 'Healthy' },
                asp: { val: 20, delta: +1.4, status: 'Healthy' },
                overallSov: { val: 8.90, delta: +2.3, status: 'Healthy' },
                paidSov: { val: 5.60, delta: +0.7, status: 'Healthy' }
            }
        },
        {
            brand: 'ITC',
            metrics: {
                marketShare: { val: 10.80, delta: -2.4, status: 'Action' },
                asp: { val: 45, delta: +0.5, status: 'Healthy' },
                overallSov: { val: 6.30, delta: -1.6, status: 'Action' },
                paidSov: { val: 3.10, delta: -0.9, status: 'Watch' }
            }
        },
        {
            brand: 'Britannia',
            metrics: {
                marketShare: { val: 8.25, delta: +0.3, status: 'Healthy' },
                asp: { val: 60, delta: -0.2, status: 'Watch' },
                overallSov: { val: 4.70, delta: +0.8, status: 'Healthy' },
                paidSov: { val: 2.40, delta: -1.3, status: 'Action' }
            }
        },
        {
            brand: 'Haldirams',
            metrics: {
                marketShare: { val: 6.50, delta: -0.7, status: 'Watch' },
                asp: { val: 120, delta: +2.1, status: 'Healthy' },
                overallSov: { val: 3.20, delta: -0.3, status: 'Watch' },
                paidSov: { val: 1.80, delta: +0.2, status: 'Healthy' }
            }
        }
    ]
};

const subCategories = Object.keys(subCategoryBrands);

const SubCategoryMarket = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [colsPerPage, setColsPerPage] = useState(5);
    const [selectedSubCat, setSelectedSubCat] = useState('Candies');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

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

    const brandsData = subCategoryBrands[selectedSubCat] || [];

    const kpiColumns = [
        { id: 'marketShare', label: 'Market Share %' },
        { id: 'asp', label: 'Average Selling Price' },
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
        if (id === 'asp') return val.toLocaleString();
        return `${val.toFixed(2)}%`;
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
                    {/* Sub-Category Dropdown */}
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
                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">Sub-Category:</span>
                            <span>{selectedSubCat}</span>
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
                                    className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden"
                                >
                                    <div className="p-1.5">
                                        {subCategories.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => {
                                                    setSelectedSubCat(cat);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-all duration-150",
                                                    selectedSubCat === cat
                                                        ? "bg-slate-900 text-white"
                                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                )}
                                            >
                                                <span>{cat}</span>
                                                {selectedSubCat === cat && (
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

            {/* Matrix Table */}
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
                        {brandsData.map((brandInfo) => (
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
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-5 flex items-center justify-between border-t border-slate-100 bg-white shadow-[0_-4px_20px_-12px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                        <button className="p-1 text-slate-300 hover:text-slate-500 transition-colors"><ChevronLeft size={18} /></button>
                        <span className="text-[13px] font-bold text-slate-400">
                            Page <span className="text-slate-900">1</span> / 1
                        </span>
                        <button className="p-1 text-slate-300 hover:text-slate-500 transition-colors"><ChevronRight size={18} /></button>
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
