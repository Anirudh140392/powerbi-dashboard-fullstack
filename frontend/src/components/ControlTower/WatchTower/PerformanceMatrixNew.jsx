import { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
    TrendingUp,
    DollarSign,
    BarChart3,
    Zap,
    Percent,
    PieChart,
    Eye,
    ShoppingCart,
    Layers,
    Target,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

const ComparisonCard = ({ kpi, variant = 'original' }) => {
    const isPositive = kpi.delta > 0;
    const Icon = kpi.icon;
    const trendData = kpi.trend.map((val, i) => ({ value: val }));

    if (variant === 'split') {
        return (
            <div
                className="p-5 rounded-[1.5rem] bg-white border border-slate-100 shadow-sm flex flex-col h-full bg-slate-50/20"
                style={{ fontFamily: 'Roboto, sans-serif' }}
            >
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Previous</div>
                        <div className="text-xl font-bold text-slate-500">
                            {kpi.id === 'sos' ? '25.3%' : kpi.id === 'inorg' ? '10.4%' : kpi.id === 'conversion' ? '0.8%' : '1.7x'}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Current</div>
                        <div className="text-xl font-bold text-slate-900">{kpi.value}</div>
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm"
                            style={{ backgroundColor: kpi.gradient[0] }}
                        >
                            <Icon size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{kpi.title}</span>
                    </div>
                    <div className={`flex items-center gap-0.5 text-xs font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(kpi.delta)}%
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="p-6 rounded-[2rem] bg-white border border-slate-50 shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col relative overflow-hidden group"
            style={{ fontFamily: 'Roboto, sans-serif' }}
        >
            <div className="flex justify-between items-start mb-4">
                <span className="text-sm font-semibold text-slate-500">{kpi.title}</span>
                <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200/50"
                    style={{ background: `linear-gradient(135deg, ${kpi.gradient[0]}, ${kpi.gradient[1]})` }}
                >
                    <Icon size={20} />
                </div>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{kpi.value}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MTD</span>
            </div>

            <div className="flex items-center gap-2 mb-6">
                <div className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-0.5 ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(kpi.delta)}%
                </div>
                <span className="text-[11px] font-medium text-slate-400">{kpi.deltaLabel}</span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-16 w-full -mb-1">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                        <defs>
                            <linearGradient id={`gradient-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.15} />
                                <stop offset="100%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={isPositive ? '#10b981' : '#f43f5e'}
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill={`url(#gradient-${kpi.id})`}
                            baseLine={0}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const PerformanceMatrixNew = () => {
    const SectionWrapper = ({
        title,
        icon: Icon,
        children,
        className = '',
        chip,
        headerRight
    }) => {
        return (
            <motion.div
                className={`bg-white rounded-[1.5rem] shadow-sm border border-slate-100/60 ${className}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                {/* Header */}
                <div className="px-8 py-6">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        {/* Left: Icon + Title + Chip */}
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <Icon size={20} className="text-blue-500" />
                            </div>
                            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{title}</h2>
                            {chip && (
                                <span className="px-4 py-1.2 hex-border text-[11px] font-bold text-slate-500 bg-white rounded-full border border-slate-200 uppercase tracking-wide">
                                    {chip}
                                </span>
                            )}
                        </div>

                        {/* Right: Custom Actions */}
                        {headerRight && (
                            <div className="flex items-center gap-3">
                                {headerRight}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="px-8 pb-8">
                    {children}
                </div>
            </motion.div>
        )
    }

    const COMPARISON_KPIS = [
        { id: 'offtake', title: 'Offtake', value: '₹14.8Cr', delta: 15.9, deltaLabel: '+₹89.3L', icon: ShoppingCart, gradient: ['#6366f1', '#8b5cf6'], trend: [30, 35, 32, 45, 50, 48, 55, 60, 58, 65, 70, 75] },
        { id: 'availability', title: 'Availability', value: '96.8%', delta: 1.8, deltaLabel: '+1.7 pts', icon: Layers, gradient: ['#14b8a6', '#06b6d4'], trend: [85, 87, 86, 88, 90, 89, 92, 94, 93, 95, 96, 97] },
        { id: 'promo', title: 'Promo Spends', value: '5.21%', delta: -0.7, deltaLabel: '-0.04 pts', icon: Percent, gradient: ['#f43f5e', '#ec4899'], trend: [6.2, 6.0, 5.8, 5.5, 5.3, 5.4, 5.2, 5.1, 5.3, 5.2, 5.2, 5.2] },
        { id: 'market', title: 'Market Share', value: '24.3%', delta: 3.9, deltaLabel: '+0.92 pts', icon: PieChart, gradient: ['#8b5cf6', '#a855f7'], trend: [20, 21, 21.5, 22, 22.5, 23, 23.2, 23.5, 23.8, 24, 24.2, 24.3] },
        { id: 'sos', title: 'Share of Search', value: '25%', delta: -1.3, deltaLabel: '-0.4 pts', icon: Eye, gradient: ['#f97316', '#fb923c'], trend: [28, 27, 26.5, 26, 25.5, 25.8, 25.3, 25.1, 25.4, 25.2, 25.1, 25] },
        { id: 'inorg', title: 'Inorganic Sales', value: '11%', delta: 5.4, deltaLabel: '+1.2%', icon: TrendingUp, gradient: ['#22c55e', '#4ade80'], trend: [8, 8.5, 9, 9.2, 9.5, 10, 10.2, 10.5, 10.8, 11, 10.8, 11] },
        { id: 'conversion', title: 'Conversion', value: '1%', delta: 28, deltaLabel: '+0.2%', icon: Target, gradient: ['#06b6d4', '#22d3ee'], trend: [0.7, 0.72, 0.75, 0.78, 0.82, 0.85, 0.88, 0.9, 0.92, 0.95, 0.98, 1.0] },
        { id: 'roas', title: 'ROAS', value: '2x', delta: 16.5, deltaLabel: '+0.3x', icon: DollarSign, gradient: ['#eab308', '#facc15'], trend: [1.5, 1.55, 1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 1.92, 1.95, 2.0] },
    ]
    return (
        <div>
            {/* SECTION 1: Comparison Cards (Top) - Wrapped in PowerBI Container */}


            {/* Bottom Row: Split Compare Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {COMPARISON_KPIS.slice(4, 8).map((kpi, idx) => (
                    <motion.div
                        key={kpi.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (idx + 4) * 0.05 }}
                    >
                        <ComparisonCard kpi={kpi} variant="split" />
                    </motion.div>
                ))}
            </div>
        </div>
    )
}

export default PerformanceMatrixNew