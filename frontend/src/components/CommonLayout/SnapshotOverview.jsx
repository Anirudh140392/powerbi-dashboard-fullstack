import { motion } from 'framer-motion'
import {
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

/**
 * ComparisonCard: Internal component for SnapshotOverview to render individual KPI cards.
 */
const ComparisonCard = ({ kpi, variant = 'original' }) => {
    const isPositive = kpi.delta > 0;
    const Icon = kpi.icon;
    const trendData = kpi.trend ? kpi.trend.map((val) => ({ value: val })) : [];

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
                            {kpi.prevValue || '-'}
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
                            style={{ backgroundColor: kpi.gradient?.[0] || '#6366f1' }}
                        >
                            <Icon size={14} />
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
                    className="w-9 h-9 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200/50"
                    style={{ background: `linear-gradient(135deg, ${kpi.gradient?.[0] || '#6366f1'}, ${kpi.gradient?.[1] || '#8b5cf6'})` }}
                >
                    <Icon size={14} />
                </div>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-gray text-slate-900 tracking-tight">{kpi.value}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.subtitle || 'MTD'}</span>
            </div>

            <div className="flex items-center gap-2 mb-6">
                <div className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-0.5 ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(kpi.delta)}%
                </div>
                <span className="text-[11px] font-medium text-slate-400">{kpi.deltaLabel}</span>
            </div>

            {trendData.length > 0 && (
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
            )}
        </div>
    );
};

const SnapshotOverview = ({
    title,
    icon: Icon,
    chip,
    headerRight,
    kpis = [],
    className = ''
}) => {
    return (
        <div style={{ marginBottom: '2rem' }}>
            <motion.div
                className={`bg-white rounded-[1.5rem] shadow-sm border border-slate-100/60 ${className}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                {/* Header */}
                <div className="px-8 py-6">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-4">
                            {Icon && (
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100/50 shadow-sm shrink-0">
                                    <Icon size={20} className="text-blue-600" />
                                </div>
                            )}
                            <h2 className="text-lg font-bold text-black tracking-tight">{title}</h2>
                            {chip && (
                                <span className="px-4 py-1.2 hex-border text-[11px] font-bold text-slate-500 bg-white rounded-full border border-slate-200 uppercase tracking-wide">
                                    {chip}
                                </span>
                            )}
                        </div>

                        {headerRight && (
                            <div className="flex items-center gap-3">
                                {headerRight}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="px-8 pb-8">
                    {/* Top Row: Original Style */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-5">
                        {kpis.slice(0, 4).map((kpi, idx) => (
                            <motion.div
                                key={kpi.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <ComparisonCard kpi={kpi} variant="original" />
                            </motion.div>
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

export default SnapshotOverview
