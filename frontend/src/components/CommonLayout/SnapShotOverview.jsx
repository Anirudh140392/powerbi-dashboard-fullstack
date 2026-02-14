import { motion } from 'framer-motion'
import {
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { cn } from '../../lib/utils'
import { Skeleton, Box } from '@mui/material'
import PerformanceMatrixNew from '../ControlTower/WatchTower/PerformanceMatrixNew';

/**
 * ComparisonCard: Internal component for SnapshotOverview to render individual KPI cards.
 */
// const ComparisonCard = ({ kpi, variant = 'original', loading = false }) => {
//     if (loading) {
//         return (
//             <div className="p-4 rounded-xl bg-white border border-slate-50 shadow-sm h-full flex flex-col relative overflow-hidden group">
//                 <div className="flex justify-between items-start mb-3">
//                     <Skeleton variant="text" width="40%" height={15} />
//                 </div>
//                 <div className="flex items-baseline justify-between gap-1 mb-1.5">
//                     <div className="flex items-baseline gap-1">
//                         <Skeleton variant="text" width={60} height={30} />
//                         <Skeleton variant="text" width={20} height={12} />
//                     </div>
//                     <Skeleton variant="rectangular" width={40} height={18} sx={{ borderRadius: '6px' }} />
//                 </div>
//                 <div className="absolute bottom-0 left-0 right-0 h-12 w-full -mb-1">
//                     <Skeleton variant="rectangular" width="100%" height="100%" />
//                 </div>
//             </div>
//         );
//     }

//     const Icon = kpi.icon || BarChart2;
//     const isPositive = kpi.delta > 0;
//     const trendData = kpi.trend ? kpi.trend.map((val) => ({ value: val })) : [];

//     // Coming Soon state for premium UI look
//     if (kpi.isComingSoon) {
//         return (
//             <div
//                 className="p-4 rounded-xl bg-slate-50/50 border border-dashed border-slate-200 shadow-sm h-full flex flex-col relative overflow-hidden group select-none"
//                 style={{ fontFamily: 'Roboto, sans-serif', minHeight: '120px' }}
//             >
//                 <div className="flex justify-between items-start mb-2">
//                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.04em]">{kpi.title}</span>
//                     <div className="px-2 py-0.5 rounded-full bg-blue-50/50 border border-blue-100 text-[8px] font-bold text-blue-500 uppercase tracking-widest">
//                         Coming Soon
//                     </div>
//                 </div>

//                 <div className="flex flex-col items-center justify-center py-0 flex-1">
//                     <motion.div
//                         className="w-10 h-7 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-1.5"
//                         initial={{ opacity: 0.8 }}
//                         whileHover={{ scale: 1.05 }}
//                     >
//                         <Icon size={16} className="text-slate-300" strokeWidth={1.5} />
//                     </motion.div>
//                     <div className="h-1 w-8 bg-slate-100 rounded-full overflow-hidden relative">
//                         <motion.div
//                             className="absolute top-0 left-0 h-full bg-blue-400"
//                             initial={{ width: "30%" }}
//                             animate={{ left: "100%", width: "0%" }}
//                             transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
//                         />
//                     </div>
//                 </div>

//                 <div className="mt-auto pt-1 border-t border-slate-100/50">
//                     <span className="text-[9px] font-medium text-slate-400 italic">Advanced analytics in progress</span>
//                 </div>
//             </div>
//         );
//     }

//     if (variant === 'split') {
//         return (
//             <div
//                 className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm flex flex-col h-full bg-slate-50/20"
//                 style={{ fontFamily: 'Roboto, sans-serif' }}
//             >
//                 <div className="grid grid-cols-2 gap-3 mb-4">
//                     <div className="text-center">
//                         <div className="text-[0.6rem] uppercase tracking-[0.04em] font-bold text-slate-400 mb-1">Previous</div>
//                         <div className="text-lg font-bold text-slate-500">
//                             {kpi.prevValue || '-'}
//                         </div>
//                     </div>
//                     <div className="text-center">
//                         <div className="text-[0.6rem] uppercase tracking-[0.04em] font-bold text-slate-400 mb-1">Current</div>
//                         <div className="text-lg font-bold text-slate-900">{kpi.value}</div>
//                     </div>
//                 </div>

//                 <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
//                     <div className="flex items-center gap-1.5">
//                         <div
//                             className="w-5 h-5 rounded-md flex items-center justify-center text-white shadow-sm"
//                             style={{ backgroundColor: kpi.gradient?.[0] || '#6366f1' }}
//                         >
//                             <Icon size={10} />
//                         </div>
//                         <span className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-[0.04em]">{kpi.title}</span>
//                     </div>
//                     <div className={`flex items-center gap-0.5 text-[10px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
//                         {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
//                         {Math.abs(kpi.delta)}%
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div
//             className="p-4 rounded-xl bg-white border border-slate-50 shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col relative overflow-hidden group"
//             style={{ fontFamily: 'Roboto, sans-serif' }}
//         >
//             <div className="flex justify-between items-start mb-3">
//                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.04em]">{kpi.title}</span>
//                 {/* <div
//                     className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-md"
//                     style={{ background: `linear-gradient(135deg, ${kpi.gradient?.[0] || '#6366f1'}, ${kpi.gradient?.[1] || '#8b5cf6'})` }}
//                 >
//                     <Icon size={12} />
//                 </div> */}
//             </div>

//             <div className="flex items-baseline justify-between gap-1 mb-1.5">
//                 <div className="flex items-baseline gap-1">
//                     <span className="text-xl font-bold text-slate-900 tracking-tight">{kpi.value}</span>
//                     <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{kpi.subtitle || 'MTD'}</span>
//                 </div>
//                 <div className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-0.5 ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
//                     {isPositive ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
//                     {Math.abs(kpi.delta)}%
//                 </div>
//             </div>

//             <div className="flex items-center gap-5 mb-8">
//                 {/* <div className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-0.5 ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
//                     {isPositive ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
//                     {Math.abs(kpi.delta)}%
//                 </div>
//                 <span className="text-[9px] font-medium text-slate-400">{kpi.deltaLabel}</span> */}
//             </div>

//             {trendData.length > 0 && (
//                 <div className="absolute bottom-0 left-0 right-0 h-12 w-full -mb-1">
//                     <ResponsiveContainer width="100%" height="100%">
//                         <AreaChart data={trendData}>
//                             <defs>
//                                 <linearGradient id={`gradient-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
//                                     <stop offset="0%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.15} />
//                                     <stop offset="100%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0} />
//                                 </linearGradient>
//                             </defs>
//                             <Area
//                                 type="monotone"
//                                 dataKey="value"
//                                 stroke={isPositive ? '#10b981' : '#f43f5e'}
//                                 strokeWidth={2}
//                                 fillOpacity={1}
//                                 fill={`url(#gradient-${kpi.id})`}
//                                 baseLine={0}
//                             />
//                         </AreaChart>
//                     </ResponsiveContainer>
//                 </div>
//             )}
//         </div>
//     );
// };

// 🔹 ONLY FORMATTING CHANGES — LOGIC UNTOUCHED

const ComparisonCard = ({ kpi, variant = 'original', loading = false }) => {
    if (loading) {
        return (
            <div className="p-5 rounded-xl bg-white border border-slate-100 shadow-sm h-full flex flex-col relative overflow-hidden">
                <Skeleton variant="text" width="45%" height={14} />
                <div className="mt-2 flex items-baseline justify-between">
                    <Skeleton variant="text" width={90} height={32} />
                    <Skeleton variant="rectangular" width={44} height={20} sx={{ borderRadius: 6 }} />
                </div>
                <div className="absolute bottom-0 inset-x-0 h-12">
                    <Skeleton variant="rectangular" width="100%" height="100%" />
                </div>
            </div>
        )
    }

    const Icon = kpi.icon
    const isPositive = kpi.delta > 0
    const trendData = kpi.trend?.map(v => ({ value: v })) || []

    // Coming Soon state with icon instead of text
    if (kpi.isComingSoon) {
        return (
            <div className="py-5 px-5 rounded-xl bg-slate-50/50 border border-dashed border-slate-200 shadow-sm h-full flex flex-col relative overflow-hidden">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-3">
                    {kpi.title}
                </span>

                <div className="flex-1 flex flex-col items-center justify-center py-0">
                    <motion.div
                        className="w-5 h-5 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-3"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                        {Icon && <Icon size={24} className="text-slate-300" strokeWidth={1.5} />}
                    </motion.div>
                    <div className="px-3 py-1 rounded-full bg-blue-50/70 border border-blue-100 text-[7px] font-bold text-blue-500 uppercase tracking-widest">
                        Coming Soon
                    </div>
                </div>
            </div>
        )
    }

    if (variant === 'split') {
        return (
            <div className="p-5 rounded-xl bg-white border border-slate-100 shadow-sm flex flex-col h-full">
                <div className="grid grid-cols-2 gap-4 mb-4">
                    {['Previous', 'Current'].map((label, i) => (
                        <div key={label} className="text-center">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-1">
                                {label}
                            </div>
                            <div className={`text-lg font-semibold ${i ? 'text-slate-900' : 'text-slate-500'}`}>
                                {i ? kpi.value : kpi.prevValue || '-'}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        {kpi.title}
                    </span>
                    <div className={`flex items-center gap-1 text-[11px] font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(kpi.delta)}%
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition h-full flex flex-col relative overflow-hidden">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-3">
                {kpi.title}
            </span>

            <div className="flex items-end justify-between flex-wrap gap-y-2 mb-6">
                <div className="flex items-end gap-1 flex-wrap">
                    <span className="text-[26px] font-bold text-slate-900 tracking-tight">
                        {kpi.value}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                        {kpi.subtitle || 'MTD'}
                    </span>
                </div>

                <div className={`px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 ${isPositive
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-600'
                    }`}
                >
                    {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(kpi.delta)}%
                </div>
            </div>

            {trendData.length > 0 && (
                <div className="absolute bottom-0 inset-x-0 h-12">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id={`gradient-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopOpacity={0.18} stopColor={isPositive ? '#10b981' : '#f43f5e'} />
                                    <stop offset="100%" stopOpacity={0} stopColor={isPositive ? '#10b981' : '#f43f5e'} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={isPositive ? '#10b981' : '#f43f5e'}
                                strokeWidth={2}
                                fill={`url(#gradient-${kpi.id})`}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}


const SnapshotOverview = ({
    title,
    icon: Icon,
    chip,
    headerRight,
    kpis = [],
    className = '',
    performanceData = [],
    performanceLoading = false,
    loading = false
}) => {
    return (
        <div style={{ marginBottom: '1rem', fontFamily: 'Roboto, sans-serif' }}>
            <motion.div
                className={`bg-white rounded-[1rem] shadow-sm border border-slate-100/60 ${className}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                {/* Header */}
                <div className="px-5 py-1">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-4">
                            {Icon && (
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100/50 shadow-sm shrink-0">
                                    <Icon size={20} className="text-blue-600" />
                                </div>
                            )}
                            <h2 className="text-[1.25rem] font-bold text-black tracking-tight">{title}</h2>
                            {chip && (
                                <span className="px-4 py-1.2 hex-border text-[0.65rem] font-bold text-slate-500 bg-white rounded-full border border-slate-200 uppercase tracking-[0.04em]" style={{ fontFamily: 'Roboto, sans-serif' }}>
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
                <div className="px-4 pb-2">
                    {/* Top Row: Original Style */}
                    <div className={cn(
                        "grid gap-3",
                        kpis.length === 3
                            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                    )}>
                        {loading ? (
                            [1, 2, 3, 4].map((i) => (
                                <ComparisonCard key={i} loading={true} />
                            ))
                        ) : (
                            kpis.slice(0, 4).map((kpi, idx) => (
                                <motion.div
                                    key={kpi.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="min-w-0"
                                >
                                    <ComparisonCard kpi={kpi} variant="original" />
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
                {title === 'Watchtower Overview' && (
                    <div className="px-4 pb-4">
                        <PerformanceMatrixNew data={performanceData} loading={performanceLoading} />
                    </div>
                )}
            </motion.div>
        </div>
    )
}

export default SnapshotOverview