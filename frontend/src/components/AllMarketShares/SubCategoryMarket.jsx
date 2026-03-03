import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SlidersHorizontal, LineChart, ChevronLeft, ChevronRight, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/utils';

const SubCategoryMarket = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [colsPerPage, setColsPerPage] = useState(5);

    // Mock data based on the user's Brands and KPIs
    const brandsData = [
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
        },
        {
            brand: 'Amul',
            metrics: {
                marketShare: { val: 2.95, delta: -1.1, status: 'Action' },
                asp: { val: 178, delta: +0.2, status: 'Healthy' },
                overallSov: { val: 5.76, delta: -0.8, status: 'Watch' },
                paidSov: { val: 0.34, delta: -2.1, status: 'Action' }
            }
        }
    ];

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
            {/* Header: Platform KPI Matrix style */}
            <div className="px-6 py-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Platform KPI Matrix</h2>
                    <p className="text-[13px] text-slate-500 mt-0.5">Hover on any value to see trend sparkline.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                        <SlidersHorizontal size={14} className="text-slate-500" />
                        <span>Filters</span>
                    </button>
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

            {/* Matrix Table: Brands as Rows, KPIs as Columns with Pill UI */}
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
                                        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                                            {kpi.label}
                                        </span>
                                        <LineChart size={14} className="text-slate-300" />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {brandsData.map((brandInfo, bIdx) => (
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
                                            <div className="flex justify-center">
                                                {/* Pill UI from "Second Image" */}
                                                <div className={cn(
                                                    "inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all duration-300",
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
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer matching Matrix UI footer exactly */}
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
