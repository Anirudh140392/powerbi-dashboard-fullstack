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
import { Skeleton, Box } from '@mui/material'

// const ComparisonCard = ({ kpi, variant = 'original', loading = false }) => {
//     if (loading) {
//         return (
//             <div className="p-3 rounded-lg bg-white border border-slate-100 shadow-sm flex flex-col h-full bg-slate-50/20">
//                 <div className="grid grid-cols-2 gap-2 mb-3">
//                     <div className="text-center">
//                         <Skeleton variant="text" width="60%" sx={{ mx: 'auto' }} />
//                         <Skeleton variant="text" width="40%" height={30} sx={{ mx: 'auto' }} />
//                     </div>
//                     <div className="text-center">
//                         <Skeleton variant="text" width="60%" sx={{ mx: 'auto' }} />
//                         <Skeleton variant="text" width="40%" height={30} sx={{ mx: 'auto' }} />
//                     </div>
//                 </div>
//                 <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between">
//                     <Skeleton variant="circular" width={20} height={20} />
//                     <Skeleton variant="text" width="40%" />
//                 </div>
//             </div>
//         );
//     }
//     const isPositive = kpi.delta > 0;
//     const Icon = kpi.icon || Zap;
//     const trendData = kpi.trend ? kpi.trend.map((val, i) => ({ value: val })) : [];

//     if (variant === 'split') {
//         return (
//             <div
//                 className="p-3 rounded-lg bg-white border border-slate-100 shadow-sm flex flex-col h-full bg-slate-50/20"
//                 style={{ fontFamily: 'Roboto, sans-serif' }}
//             >
//                 <div className="grid grid-cols-2 gap-2 mb-3">
//                     <div className="text-center">
//                         <div className="text-[0.55rem] uppercase tracking-[0.04em] font-bold text-slate-400 mb-0.5">Previous</div>
//                         <div className="text-base font-bold text-slate-500">
//                             {kpi.prevValue || '-'}
//                         </div>
//                     </div>
//                     <div className="text-center">
//                         <div className="text-[0.55rem] uppercase tracking-[0.04em] font-bold text-slate-400 mb-0.5">Current</div>
//                         <div className="text-base font-bold text-slate-900">{kpi.value}</div>
//                     </div>
//                 </div>

//                 <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between">
//                     <div className="flex items-center gap-1">
//                         <div
//                             className="w-5 h-5 rounded flex items-center justify-center text-white shadow-sm"
//                             style={{ backgroundColor: kpi.gradient?.[0] || '#6366f1' }}
//                         >
//                             <Icon size={10} />
//                         </div>
//                         <span className="text-[0.55rem] font-bold text-slate-500 uppercase tracking-[0.04em]">{kpi.title}</span>
//                     </div>
//                     <div className={`flex items-center gap-0.5 text-[9px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
//                         {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
//                         {Math.abs(kpi.delta)}%
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div
//             className="p-6 rounded-[2rem] bg-white border border-slate-50 shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col relative overflow-hidden group"
//             style={{ fontFamily: 'Roboto, sans-serif' }}
//         >
//             <div className="flex justify-between items-start mb-4">
//                 <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-[0.04em]">{kpi.title}</span>
//                 <div
//                     className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200/50"
//                     style={{ background: `linear-gradient(135deg, ${kpi.gradient?.[0] || '#6366f1'}, ${kpi.gradient?.[1] || '#8b5cf6'})` }}
//                 >
//                     <Icon size={20} />
//                 </div>
//             </div>

//             <div className="flex items-baseline gap-2 mb-2">
//                 <span className="text-3xl font-black text-slate-900 tracking-tight">{kpi.value}</span>
//                 <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-[0.04em] ml-1">MTD</span>
//             </div>

//             <div className="flex items-center gap-2 mb-6">
//                 <div className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-0.5 ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
//                     {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
//                     {Math.abs(kpi.delta)}%
//                 </div>
//                 <span className="text-[11px] font-medium text-slate-400">{kpi.deltaLabel}</span>
//             </div>

//             <div className="absolute bottom-0 left-0 right-0 h-16 w-full -mb-1">
//                 <ResponsiveContainer width="100%" height="100%">
//                     <AreaChart data={trendData}>
//                         <defs>
//                             <linearGradient id={`gradient-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
//                                 <stop offset="0%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.15} />
//                                 <stop offset="100%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0} />
//                             </linearGradient>
//                         </defs>
//                         <Area
//                             type="monotone"
//                             dataKey="value"
//                             stroke={isPositive ? '#10b981' : '#f43f5e'}
//                             strokeWidth={2.5}
//                             fillOpacity={1}
//                             fill={`url(#gradient-${kpi.id})`}
//                             baseLine={0}
//                         />
//                     </AreaChart>
//                 </ResponsiveContainer>
//             </div>
//         </div>
//     );
// };

// const PerformanceMatrixNew = ({ data = [], loading = false }) => {
//     const kpiIconMap = {
//         'sos_new': Eye,
//         'inorganic': TrendingUp,
//         'conversion': Target,
//         'roas_new': DollarSign
//     };

//     const kpiGradientMap = {
//         'sos_new': ['#f97316', '#fb923c'],
//         'inorganic': ['#22c55e', '#4ade80'],
//         'conversion': ['#06b6d4', '#22d3ee'],
//         'roas_new': ['#eab308', '#facc15']
//     };

//     const mappedKpis = useMemo(() => {
//         if (!data || data.length === 0) return [];
//         return data.map(kpi => ({
//             id: kpi.id,
//             title: kpi.label,
//             value: kpi.value,
//             prevValue: kpi.prevValue || '-',
//             delta: parseFloat(kpi.tag) || 0,
//             deltaLabel: kpi.tag,
//             icon: kpiIconMap[kpi.id] || Zap,
//             gradient: kpiGradientMap[kpi.id] || ['#6366f1', '#8b5cf6'],
//             trend: kpi.trendData ? kpi.trendData.map(d => d.value) : []
//         }));
//     }, [data]);

//     return (
//         <div style={{ fontFamily: 'Roboto, sans-serif' }}>
//             {/* Bottom Row: Split Compare Cards */}
//             <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
//                 {loading ? (
//                     [1, 2, 3, 4].map((i) => (
//                         <ComparisonCard key={i} loading={true} variant="split" />
//                     ))
//                 ) : (
//                     mappedKpis.map((kpi, idx) => (
//                         <motion.div
//                             key={kpi.id}
//                             initial={{ opacity: 0, y: 20 }}
//                             animate={{ opacity: 1, y: 0 }}
//                             transition={{ delay: idx * 0.05 }}
//                         >
//                             <ComparisonCard kpi={kpi} variant="split" />
//                         </motion.div>
//                     ))
//                 )}
//             </div>
//         </div>
//     )
// }

// const ComparisonCard = ({ kpi, variant = 'original', loading = false }) => {
//     if (loading) {
//         return (
//             <div className="p-4 rounded-lg bg-white border border-slate-100 shadow-sm flex flex-col h-full bg-slate-50/20">
//                 <div className="grid grid-cols-2 gap-3 mb-4">
//                     {[1, 2].map(i => (
//                         <div key={i} className="text-center">
//                             <Skeleton variant="text" width="55%" sx={{ mx: 'auto' }} />
//                             <Skeleton variant="text" width="45%" height={26} sx={{ mx: 'auto' }} />
//                         </div>
//                     ))}
//                 </div>
//                 <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
//                     <Skeleton variant="circular" width={18} height={18} />
//                     <Skeleton variant="text" width="35%" />
//                 </div>
//             </div>
//         );
//     }

//     const isPositive = kpi.delta > 0;
//     const Icon = kpi.icon || Zap;
//     const trendData = kpi.trend ? kpi.trend.map(val => ({ value: val })) : [];

//     /* -------- SPLIT VARIANT -------- */
//     if (variant === 'split') {
//         return (
//             <div className="p-4 rounded-lg bg-white border border-slate-100 shadow-sm flex flex-col h-full bg-slate-50/20 font-['Roboto']">
//                 <div className="grid grid-cols-2 gap-3 mb-4">
//                     <div className="text-center">
//                         <div className="text-[10px] uppercase tracking-[0.04em] font-bold text-slate-400 mb-1">
//                             Previous
//                         </div>
//                         <div className="text-[15px] font-bold text-slate-500">
//                             {kpi.prevValue || '-'}
//                         </div>
//                     </div>
//                     <div className="text-center">
//                         <div className="text-[10px] uppercase tracking-[0.04em] font-bold text-slate-400 mb-1">
//                             Current
//                         </div>
//                         <div className="text-[15px] font-bold text-slate-900">
//                             {kpi.value}
//                         </div>
//                     </div>
//                 </div>

//                 <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
//                     <div className="flex items-center gap-2">
//                         <div
//                             className="w-5 h-5 rounded flex items-center justify-center text-white shadow-sm"
//                             style={{ backgroundColor: kpi.gradient?.[0] || '#6366f1' }}
//                         >
//                             <Icon size={11} />
//                         </div>
//                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.04em]">
//                             {kpi.title}
//                         </span>
//                     </div>

//                     <div className={`flex items-center gap-1 text-[10px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
//                         {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
//                         {Math.abs(kpi.delta)}%
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     /* -------- ORIGINAL VARIANT -------- */
//     return (
//         <div
//             className="p-5 rounded-[2rem] bg-white border border-slate-50 shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col relative overflow-hidden group font-['Roboto']"
//         >
//             <div className="flex justify-between items-start mb-4">
//                 <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.04em]">
//                     {kpi.title}
//                 </span>
//                 <div
//                     className="w-9 h-9 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200/50"
//                     style={{ background: `linear-gradient(135deg, ${kpi.gradient?.[0] || '#6366f1'}, ${kpi.gradient?.[1] || '#8b5cf6'})` }}
//                 >
//                     <Icon size={18} />
//                 </div>
//             </div>

//             <div className="flex items-baseline gap-2 mb-3">
//                 <span className="text-[28px] font-black text-slate-900 tracking-tight">
//                     {kpi.value}
//                 </span>
//                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.04em]">
//                     MTD
//                 </span>
//             </div>

//             <div className="flex items-center gap-2 mb-6">
//                 <div className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
//                     {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
//                     {Math.abs(kpi.delta)}%
//                 </div>
//                 <span className="text-[11px] font-medium text-slate-400">
//                     {kpi.deltaLabel}
//                 </span>
//             </div>

//             <div className="absolute bottom-0 left-0 right-0 h-14">
//                 <ResponsiveContainer width="100%" height="100%">
//                     <AreaChart data={trendData}>
//                         <defs>
//                             <linearGradient id={`gradient-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
//                                 <stop offset="0%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.15} />
//                                 <stop offset="100%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0} />
//                             </linearGradient>
//                         </defs>
//                         <Area
//                             type="monotone"
//                             dataKey="value"
//                             stroke={isPositive ? '#10b981' : '#f43f5e'}
//                             strokeWidth={2.5}
//                             fill={`url(#gradient-${kpi.id})`}
//                         />
//                     </AreaChart>
//                 </ResponsiveContainer>
//             </div>
//         </div>
//     );
// };
const ComparisonCard = ({ kpi, variant = 'original', loading = false }) => {
    if (loading) {
        return (
            <div
                className="p-4 rounded-lg bg-white border border-slate-100 shadow-sm flex flex-col h-full bg-slate-50/20"
                style={{ fontFamily: 'Roboto, sans-serif' }}
            >
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {[1, 2].map(i => (
                        <div key={i} className="text-center">
                            <Skeleton variant="text" width="55%" sx={{ mx: 'auto' }} />
                            <Skeleton variant="text" width="45%" height={26} sx={{ mx: 'auto' }} />
                        </div>
                    ))}
                </div>
                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Skeleton variant="circular" width={18} height={18} />
                    <Skeleton variant="text" width="35%" />
                </div>
            </div>
        );
    }

    const isPositive = kpi.delta > 0;
    const Icon = kpi.icon || Zap;
    const trendData = kpi.trend ? kpi.trend.map(val => ({ value: val })) : [];

    /* -------- SPLIT VARIANT -------- */
    if (variant === 'split') {
        return (
            <div
                className="p-4 rounded-lg bg-white border border-slate-100 shadow-sm flex flex-col h-full bg-slate-50/20"
                style={{ fontFamily: 'Roboto, sans-serif' }}
            >
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-[0.04em] font-bold text-slate-400 mb-1">
                            Previous
                        </div>
                        <div className="text-[15px] font-bold text-slate-500">
                            {kpi.prevValue || '-'}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-[0.04em] font-bold text-slate-400 mb-1">
                            Current
                        </div>
                        <div className="text-[15px] font-bold text-slate-900">
                            {kpi.value}
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-5 h-5 rounded flex items-center justify-center text-white shadow-sm"
                            style={{ backgroundColor: kpi.gradient?.[0] || '#6366f1' }}
                        >
                            <Icon size={11} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.04em]">
                            {kpi.title}
                        </span>
                    </div>

                    <div className={`flex items-center gap-1 text-[10px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {Math.abs(kpi.delta)}%
                    </div>
                </div>
            </div>
        );
    }

    /* -------- ORIGINAL VARIANT -------- */
    return (
        <div
            className="p-5 rounded-[2rem] bg-white border border-slate-50 shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col relative overflow-hidden group"
            style={{ fontFamily: 'Roboto, sans-serif' }}
        >
            <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.04em]">
                    {kpi.title}
                </span>
                <div
                    className="w-9 h-9 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200/50"
                    style={{ background: `linear-gradient(135deg, ${kpi.gradient?.[0] || '#6366f1'}, ${kpi.gradient?.[1] || '#8b5cf6'})` }}
                >
                    <Icon size={18} />
                </div>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
                <span className="text-[28px] font-black text-slate-900 tracking-tight">
                    {kpi.value}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.04em]">
                    MTD
                </span>
            </div>

            <div className="flex items-center gap-2 mb-6">
                <div className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(kpi.delta)}%
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                    {kpi.deltaLabel}
                </span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-14">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={isPositive ? '#10b981' : '#f43f5e'}
                            strokeWidth={2.5}
                            fill={`url(#gradient-${kpi.id})`}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};


const PerformanceMatrixNew = ({ data = [], loading = false }) => {
    const kpiIconMap = {
        sos_new: Eye,
        inorganic: TrendingUp,
        conversion: Target,
        roas_new: DollarSign
    };

    const kpiGradientMap = {
        sos_new: ['#f97316', '#fb923c'],
        inorganic: ['#22c55e', '#4ade80'],
        conversion: ['#06b6d4', '#22d3ee'],
        roas_new: ['#eab308', '#facc15']
    };

    const mappedKpis = useMemo(() => {
        if (!data?.length) return [];
        return data.map(kpi => ({
            id: kpi.id,
            title: kpi.label,
            value: kpi.value,
            prevValue: kpi.prevValue || '-',
            delta: parseFloat(kpi.tag) || 0,
            deltaLabel: kpi.tag,
            icon: kpiIconMap[kpi.id] || Zap,
            gradient: kpiGradientMap[kpi.id] || ['#64748b', '#94a3b8'],
            trend: kpi.trendData ? kpi.trendData.map(d => d.value) : []
        }));
    }, [data]);

    return (
        <div className="font-['Roboto']">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {loading
                    ? [1, 2, 3, 4].map(i => (
                        <ComparisonCard
                            key={i}
                            loading
                            variant="split"
                        />
                    ))
                    : mappedKpis.map((kpi, idx) => (
                        <motion.div
                            key={kpi.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="h-full"
                        >
                            <ComparisonCard
                                kpi={kpi}
                                variant="split"
                            />
                        </motion.div>
                    ))
                }
            </div>
        </div>
    );
};



export default PerformanceMatrixNew