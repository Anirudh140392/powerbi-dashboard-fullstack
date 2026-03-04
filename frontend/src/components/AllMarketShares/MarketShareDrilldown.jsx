import React, { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlidersHorizontal, Plus, Minus, Search, X } from 'lucide-react'
import { KpiFilterPanel } from '../KpiFilterPanel'

const sampleData = [
    {
        id: 'mars-wrigley',
        label: 'Mars Wrigley',
        level: 'Brand',
        metrics: { categorySize: 1250.5, mrp: 45.0, share: 15.2, mwSales: 220.5, mlSales: 310.2 },
        children: [
            {
                id: 'mands',
                label: "M&M's",
                level: 'Sub Brand',
                metrics: { categorySize: 450.2, mrp: 45.0, share: 8.5, mwSales: 120.2, mlSales: 150.7 },
                children: [
                    {
                        id: 'mands-peanut-45',
                        label: "M&M's Peanut 45g",
                        level: 'SKU',
                        metrics: { categorySize: 250.1, mrp: 45.0, share: 5.2, mwSales: 70.5, mlSales: 80.2 },
                    },
                    {
                        id: 'mands-choco-45',
                        label: "M&M's Chocolate 45g",
                        level: 'SKU',
                        metrics: { categorySize: 200.1, mrp: 45.0, share: 3.3, mwSales: 49.7, mlSales: 70.5 },
                    }
                ]
            },
            {
                id: 'snickers',
                label: "Snickers",
                level: 'Sub Brand',
                metrics: { categorySize: 800.3, mrp: 50.0, share: 6.7, mwSales: 100.3, mlSales: 159.5 },
                children: [
                    {
                        id: 'snickers-peanut-50',
                        label: "Snickers Peanut 50g",
                        level: 'SKU',
                        metrics: { categorySize: 800.3, mrp: 50.0, share: 6.7, mwSales: 100.3, mlSales: 159.5 },
                    }
                ]
            }
        ]
    },
    {
        id: 'mondelez',
        label: 'Mondelez',
        level: 'Brand',
        metrics: { categorySize: 2800.0, mrp: 80.0, share: 22.4, mwSales: 0, mlSales: 850.5 },
        children: [
            {
                id: 'dairy-milk',
                label: "Dairy Milk",
                level: 'Sub Brand',
                metrics: { categorySize: 1500.0, mrp: 80.0, share: 12.1, mwSales: 0, mlSales: 450.2 },
                children: [
                    {
                        id: 'dm-silk',
                        label: "Dairy Milk Silk",
                        level: 'SKU',
                        metrics: { categorySize: 1500.0, mrp: 80.0, share: 12.1, mwSales: 0, mlSales: 450.2 },
                    }
                ]
            }
        ]
    },
    {
        id: 'nestle',
        label: 'Nestle',
        level: 'Brand',
        metrics: { categorySize: 1850.0, mrp: 20.0, share: 14.5, mwSales: 0, mlSales: 520.1 },
        children: [
            {
                id: 'kitkat',
                label: "KitKat",
                level: 'Sub Brand',
                metrics: { categorySize: 900.0, mrp: 20.0, share: 8.2, mwSales: 0, mlSales: 250.5 },
                children: [
                    {
                        id: 'kk-4-finger',
                        label: "KitKat 4 Finger",
                        level: 'SKU',
                        metrics: { categorySize: 450.0, mrp: 20.0, share: 4.1, mwSales: 0, mlSales: 125.2 },
                    }
                ]
            }
        ]
    },
    {
        id: 'hersheys',
        label: 'Hershey\'s',
        level: 'Brand',
        metrics: { categorySize: 950.0, mrp: 35.0, share: 7.8, mwSales: 0, mlSales: 180.4 },
        children: [
            {
                id: 'kisses',
                label: "Kisses",
                level: 'Sub Brand',
                metrics: { categorySize: 400.0, mrp: 35.0, share: 3.2, mwSales: 0, mlSales: 60.1 },
                children: [
                    {
                        id: 'kisses-milk',
                        label: "Kisses Milk Chocolate",
                        level: 'SKU',
                        metrics: { categorySize: 200.0, mrp: 35.0, share: 1.5, mwSales: 0, mlSales: 30.5 },
                    }
                ]
            }
        ]
    }
];

const flattenHierarchy = (nodes, expanded) => {
    const rows = [];
    const walk = (node, depth) => {
        rows.push({
            ...node,
            depth,
            hasChildren: node.children && node.children.length > 0
        });

        if (node.children && expanded.has(node.id)) {
            node.children.forEach(child => walk(child, depth + 1));
        }
    };
    nodes.forEach(node => walk(node, 0));
    return rows;
};

const MarketShareDrilldown = () => {
    const [expandedRows, setExpandedRows] = useState(new Set([]));
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    // Filter state
    const [filters, setFilters] = useState({
        brand: null,
        subBrand: null,
        sku: null
    });

    const [popupFilters, setPopupFilters] = useState({
        brand: [],
        subBrand: [],
        sku: []
    });

    const toggleRow = (id) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const flatRows = useMemo(() => flattenHierarchy(sampleData, expandedRows), [expandedRows]);

    const formatValue = (val, kpi) => {
        if (val === null || val === undefined) return '-';
        if (kpi === 'mrp') return `₹ ${val.toLocaleString()}`;
        if (kpi === 'share') return `${val.toFixed(1)}%`;
        if (kpi === 'categorySize' || kpi === 'mwSales' || kpi === 'mlSales') return `${val.toFixed(1)}`;
        return val;
    };

    const getHeatmapColor = (kpi, value) => {
        if (value === undefined || value === null) return {};

        // Example logic for color-coding market values
        if (kpi === 'share') {
            if (value >= 15) return { backgroundColor: 'rgba(22, 163, 74, 0.12)', color: '#166534' }; // Healthy
            if (value >= 10) return { backgroundColor: 'rgba(234, 179, 8, 0.12)', color: '#854d0e' }; // Watch
            return { backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#991b1b' }; // Action
        }

        if (kpi === 'categorySize') {
            if (value >= 1000) return { backgroundColor: 'rgba(234, 179, 8, 0.12)', color: '#854d0e' };
            return { backgroundColor: 'rgba(234, 179, 8, 0.05)', color: '#64748b' };
        }

        return { backgroundColor: 'rgba(234, 179, 8, 0.12)', color: '#854d0e' };
    };

    const filterOptions = [
        { id: "brand", label: "Brand", options: sampleData.map(d => ({ id: d.id, label: d.label })) },
        { id: "subBrand", label: "Sub Brand", options: sampleData.flatMap(d => d.children || []).map(d => ({ id: d.id, label: d.label })) },
        { id: "sku", label: "SKU", options: sampleData.flatMap(d => d.children || []).flatMap(d => d.children || []).map(d => ({ id: d.id, label: d.label })) },
    ];

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-6">
            {/* Header section matching Image 1 */}
            <div className="px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Drilldown Table</h2>
                    <p className="text-[13px] text-slate-500 mt-0.5">Hierarchical drilldown with KPI heatmap visualization.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowFilterPanel(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <SlidersHorizontal size={14} className="text-slate-500" />
                        <span>Filters</span>
                    </button>
                    <div className="h-6 w-px bg-slate-200 mx-1"></div>
                    <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Healthy
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Watch
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Action
                        </span>
                    </div>
                </div>
            </div>

            <div className="px-6 pb-6">
                <div className="text-[12px] text-slate-400 mb-4 font-medium">
                    Brand → Sub Brand → SKU
                </div>

                <div className="overflow-x-auto no-scrollbar">
                    <div className="inline-block min-w-full align-middle">
                        <table className="min-w-full border-collapse table-auto">
                            <thead>
                                <tr className="text-center text-[13px] font-bold text-slate-900 border-b border-slate-100">
                                    <th className="px-6 py-4 text-left min-w-[320px] max-w-[400px]" style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: 'white' }}>Entity Name</th>
                                    <th className="px-6 py-4  whitespace-nowrap">Market Share %</th>
                                    <th className="px-6 py-4  whitespace-nowrap">MRP</th>
                                </tr>
                                <tr className="text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-50/20">
                                    <th className="px-6 py-1.5 border-b border-slate-100" style={{ position: 'sticky', left: 0, zIndex: 10 }}></th>
                                    <th className="px-6 py-1.5 border-b border-slate-100">ALL</th>
                                    <th className="px-6 py-1.5 border-b border-slate-100">ALL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flatRows.map((row) => (
                                    <motion.tr
                                        key={row.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50"
                                    >
                                        <td
                                            className="py-4 px-6 z-10 transition-colors duration-200"
                                            style={{
                                                paddingLeft: `${row.depth * 32 + 24}px`,
                                                position: 'sticky',
                                                left: 0,
                                                backgroundColor: 'white',
                                                transition: 'background-color 0.2s'
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                {row.hasChildren ? (
                                                    <button
                                                        onClick={() => toggleRow(row.id)}
                                                        className="w-5 h-5 rounded border border-slate-200 bg-white text-slate-400 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
                                                    >
                                                        {expandedRows.has(row.id) ? <Minus size={12} /> : <Plus size={12} />}
                                                    </button>
                                                ) : (
                                                    <div className="w-5 h-5 flex items-center justify-center">
                                                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                                    </div>
                                                )}
                                                <span className={`text-[14px] font-bold whitespace-nowrap ${row.depth === 0 ? 'text-slate-900' : 'text-slate-700'}`}>
                                                    {row.label}
                                                </span>
                                            </div>
                                        </td>

                                        {['share', 'mrp'].map(kpi => (
                                            <td key={kpi} className="py-4 px-6 text-center align-middle">
                                                <div className="flex items-center justify-center h-full w-full">
                                                    <span
                                                        className="inline-flex items-center justify-center min-w-[3.5rem] px-2.5 py-0.5 rounded text-[11px] font-bold transition-all duration-300"
                                                        style={getHeatmapColor(kpi, row.metrics[kpi])}
                                                    >
                                                        {formatValue(row.metrics[kpi], kpi)}
                                                    </span>
                                                </div>
                                            </td>
                                        ))}
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Advanced Filters Modal matching Image 2 */}
                {showFilterPanel && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
                        <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Advanced Filters</h2>
                                    <p className="text-[13px] text-slate-500">Configure data visibility and rules</p>
                                </div>
                                <button
                                    onClick={() => setShowFilterPanel(false)}
                                    className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Panel Content */}
                            <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 py-4">
                                <KpiFilterPanel
                                    sectionConfig={filterOptions}
                                    sectionValues={popupFilters}
                                    onSectionChange={(sectionId, vals) => {
                                        setPopupFilters(prev => ({
                                            ...prev,
                                            [sectionId]: vals,
                                        }))
                                    }}
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                                <button
                                    onClick={() => setShowFilterPanel(false)}
                                    className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setFilters({
                                            brand: popupFilters.brand?.length > 0 ? popupFilters.brand[0] : null,
                                            subBrand: popupFilters.subBrand?.length > 0 ? popupFilters.subBrand[0] : null,
                                            sku: popupFilters.sku?.length > 0 ? popupFilters.sku[0] : null
                                        });
                                        setShowFilterPanel(false);
                                    }}
                                    className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-200/50 transition-all active:scale-95"
                                >
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarketShareDrilldown;