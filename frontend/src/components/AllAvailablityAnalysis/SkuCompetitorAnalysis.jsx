import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import { cn } from '../../lib/utils';

// ========================================
// MOCK DATA (As per Image)
// ========================================
const SKU_COMPETITOR_DATA = [
    {
        id: 'sku1',
        brandInitial: 'K',
        name: 'Kwality Walls Cornetto Double Chocolat...',
        info: '105 ml • MRP ₹35',
        yourEcp: 35,
        competitorsCount: 3,
        avgDelta: 40,
        competitors: [
            {
                id: 'c1',
                platform: 'Blinkit',
                brand: 'Baskin Robbins',
                product: 'Baskin Robbins Bavarian Choc...',
                productInfo: '110 ml',
                theirEcp: 85,
                delta: 50
            },
            {
                id: 'c2',
                platform: 'Blinkit',
                brand: 'Havmor',
                product: 'Havmor Dark Chocolate Ice Cr...',
                productInfo: '110 ml',
                theirEcp: 50,
                delta: 15
            },
            {
                id: 'c3',
                platform: 'Blinkit',
                brand: 'Havmor World',
                product: 'Havmor World Double Belgian ...',
                productInfo: '150 ml',
                theirEcp: 90,
                delta: 55
            }
        ]
    },
    {
        id: 'sku2',
        brandInitial: 'K',
        name: 'Kwality Walls Cornetto Strawberry Vanilla',
        info: '105 ml • MRP ₹38',
        yourEcp: 35,
        competitorsCount: 1,
        avgDelta: 6,
        competitors: [
            {
                id: 'c4',
                platform: 'Zepto',
                brand: 'Amul',
                product: 'Amul Epic Choco Almond Stick',
                productInfo: '80 ml',
                theirEcp: 41,
                delta: 6
            }
        ]
    },
    {
        id: 'sku3',
        brandInitial: 'K',
        name: 'Kwality Walls Choco Brownie Fudge Fro...',
        info: '100 ml • MRP ₹51',
        yourEcp: 45,
        competitorsCount: 1,
        avgDelta: -19,
        competitors: [
            {
                id: 'c5',
                platform: 'Instamart',
                brand: 'Mother Dairy',
                product: 'Mother Dairy Absolute Choco ...',
                productInfo: '100 ml',
                theirEcp: 26,
                delta: -19
            }
        ]
    }
];

// ========================================
// HELPER COMPONENTS
// ========================================

const PlatformBadge = ({ platform }) => {
    const colors = {
        'Blinkit': 'bg-[#FFCE00] text-black',
        'Zepto': 'bg-[#8B5CF6] text-white',
        'Instamart': 'bg-[#FC8019] text-white'
    };
    return (
        <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight",
            colors[platform] || 'bg-slate-200 text-slate-600'
        )}>
            {platform}
        </span>
    );
};

const MetricPills = ({ active, onChange }) => {
    const options = ['ECP', 'Discount', 'RPI'];
    return (
        <div className="flex bg-slate-100 p-1 rounded-xl">
            {options.map(opt => (
                <button
                    key={opt}
                    onClick={() => onChange(opt)}
                    className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                        active === opt ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    {opt}
                </button>
            ))}
        </div>
    );
};

// ========================================
// MAIN COMPONENT
// ========================================

export default function SkuCompetitorAnalysis() {
    const [expandedRows, setExpandedRows] = useState(['sku1']);
    const [activeMetric, setActiveMetric] = useState('ECP');

    const toggleRow = (id) => {
        setExpandedRows(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    const expandAll = () => setExpandedRows(SKU_COMPETITOR_DATA.map(d => d.id));
    const collapseAll = () => setExpandedRows([]);

    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] overflow-hidden font-sans mt-8">
            {/* Header Area */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <h2 className="text-xl font-bold text-[#1E293B]">SKU Competitor Analysis</h2>
                    <span className="px-3 py-1 bg-slate-50 text-slate-400 text-xs font-semibold rounded-full border border-slate-100">
                        3 SKUs • 5 comparisons
                    </span>
                    <MetricPills active={activeMetric} onChange={setActiveMetric} />
                </div>

                <div className="flex items-center gap-6">
                    <button onClick={expandAll} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">Expand All</button>
                    <button onClick={collapseAll} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">Collapse All</button>
                </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="text-left bg-slate-50/30">
                            <th className="pl-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-16"></th>
                            <th className="px-4 py-5 text-[11px] font-bold text-[#2B579A] uppercase tracking-widest">Your SKU</th>
                            <th className="px-4 py-5 text-[11px] font-bold text-[#2B579A] uppercase tracking-widest text-center">Your ECP</th>
                            <th className="px-4 py-5 text-[11px] font-bold text-[#2B579A] uppercase tracking-widest text-center">Competitors</th>
                            <th className="pr-8 py-5 text-[11px] font-bold text-[#2B579A] uppercase tracking-widest text-right">Avg Δ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {SKU_COMPETITOR_DATA.map(sku => {
                            const isExpanded = expandedRows.includes(sku.id);
                            return (
                                <React.Fragment key={sku.id}>
                                    <tr
                                        onClick={() => toggleRow(sku.id)}
                                        className={cn(
                                            "cursor-pointer transition-colors duration-200",
                                            isExpanded ? "bg-blue-50/30" : "hover:bg-slate-50/50 border-b border-slate-50"
                                        )}
                                    >
                                        <td className="pl-8 py-4">
                                            <div className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")}>
                                                <ChevronDown size={20} className="text-slate-300" />
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
                                                    {sku.brandInitial}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{sku.name}</div>
                                                    <div className="text-[11px] text-slate-400 font-medium">{sku.info}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-lg font-bold text-blue-600 tracking-tight">₹{sku.yourEcp}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="bg-slate-100 text-slate-500 font-bold text-[10px] px-3 py-1 rounded-full uppercase">
                                                {sku.competitorsCount} brands
                                            </span>
                                        </td>
                                        <td className="pr-8 py-4 text-right">
                                            <span className={cn(
                                                "text-sm font-bold",
                                                sku.avgDelta >= 0 ? "text-emerald-500" : "text-rose-500"
                                            )}>
                                                {sku.avgDelta >= 0 ? '+' : ''}₹{Math.abs(sku.avgDelta)}
                                            </span>
                                        </td>
                                    </tr>

                                    {/* Expanded Detail */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.tr
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-white border-b border-slate-100"
                                            >
                                                <td colSpan={5} className="px-8 py-6">
                                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                                        <table className="w-full table-fixed">
                                                            <thead>
                                                                <tr className="bg-slate-50/50">
                                                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left w-[12%]">Platform</th>
                                                                    <th className="px-6 py-3 text-[10px] font-bold text-[#E65F17] uppercase tracking-wider text-left w-[25%]">Competitor Brand</th>
                                                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left w-[35%]">Product</th>
                                                                    <th className="px-6 py-3 text-[10px] font-bold text-[#E65F17] uppercase tracking-wider text-right w-[14%]">Their ECP</th>
                                                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right w-[14%]">Δ ECP</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {sku.competitors.map(comp => (
                                                                    <tr key={comp.id} className="hover:bg-slate-50/30 transition-colors">
                                                                        <td className="px-6 py-4">
                                                                            <PlatformBadge platform={comp.platform} />
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <span className="text-sm font-bold text-[#FC8019]">{comp.brand}</span>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <div className="text-sm font-bold text-slate-700">{comp.product}</div>
                                                                            <div className="text-[10px] text-slate-400 font-medium">{comp.productInfo}</div>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right">
                                                                            <span className="text-base font-black text-[#FC8019] tracking-tight">₹{comp.theirEcp}</span>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right">
                                                                            <span className={cn(
                                                                                "text-sm font-bold",
                                                                                comp.delta >= 0 ? "text-emerald-500" : "text-rose-500"
                                                                            )}>
                                                                                {comp.delta >= 0 ? '+' : ''}₹{Math.abs(comp.delta)}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer Notice */}
            <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center gap-2">
                <Lightbulb size={14} className="text-amber-500 fill-amber-100" />
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                    Positive Δ = Competitor is more expensive than you <span className="text-slate-300 font-medium">(your advantage)</span>
                </p>
            </div>
        </div>
    );
}
