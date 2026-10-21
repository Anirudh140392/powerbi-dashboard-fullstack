import React from 'react';
import { 
    Activity, 
    CheckCircle2, 
    AlertTriangle, 
    Clock, 
    Percent, 
    Gauge 
} from 'lucide-react';
import { Skeleton } from '@mui/material';

export default function SummaryCards({ summary, loading }) {
    const cards = [
        {
            title: "Total APIs Tested",
            value: summary?.totalApis ?? 0,
            subtitle: "All monitored endpoints",
            icon: Activity,
            color: "text-blue-600",
            bg: "bg-blue-50/70 border-blue-100",
            iconBg: "bg-blue-100 text-blue-600",
        },
        {
            title: "Success",
            value: summary?.successCount ?? 0,
            subtitle: "2xx within latency limit",
            icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-50/70 border-emerald-100",
            iconBg: "bg-emerald-100 text-emerald-600",
        },
        {
            title: "Failed",
            value: summary?.failedCount ?? 0,
            subtitle: "Non-2xx, timeout or error",
            icon: AlertTriangle,
            color: "text-rose-600",
            bg: "bg-rose-50/70 border-rose-100",
            iconBg: "bg-rose-100 text-rose-600",
        },
        {
            title: "Slow (> 5000ms)",
            value: summary?.slowCount ?? 0,
            subtitle: "2xx exceeding SLA limit",
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50/70 border-amber-100",
            iconBg: "bg-amber-100 text-amber-600",
        },
        {
            title: "Success Rate",
            value: `${summary?.successRate ?? 0}%`,
            subtitle: "Successful API ratio",
            icon: Percent,
            color: (summary?.successRate ?? 0) >= 90 ? "text-emerald-600" : (summary?.successRate ?? 0) >= 75 ? "text-amber-600" : "text-rose-600",
            bg: "bg-indigo-50/70 border-indigo-100",
            iconBg: "bg-indigo-100 text-indigo-600",
        },
        {
            title: "Avg Response Time",
            value: summary?.avgResponseTimeMs ? `${Math.round(summary.avgResponseTimeMs)} ms` : "0 ms",
            subtitle: "Mean end-to-end latency",
            icon: Gauge,
            color: (summary?.avgResponseTimeMs ?? 0) < 1500 ? "text-emerald-600" : (summary?.avgResponseTimeMs ?? 0) < 4000 ? "text-amber-600" : "text-rose-600",
            bg: "bg-purple-50/70 border-purple-100",
            iconBg: "bg-purple-100 text-purple-600",
        },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {cards.map((c, idx) => {
                const IconComponent = c.icon;
                return (
                    <div 
                        key={idx}
                        className={`p-4 rounded-xl border transition-all duration-200 hover:shadow-md bg-white/80 backdrop-blur-sm ${c.bg}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider truncate">
                                {c.title}
                            </span>
                            <div className={`p-1.5 rounded-lg ${c.iconBg}`}>
                                <IconComponent className="w-4 h-4" />
                            </div>
                        </div>

                        {loading ? (
                            <Skeleton variant="text" width={60} height={36} />
                        ) : (
                            <div className={`text-2xl font-bold tracking-tight ${c.color}`}>
                                {c.value}
                            </div>
                        )}

                        <div className="text-[11px] text-slate-400 mt-1 truncate">
                            {c.subtitle}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
