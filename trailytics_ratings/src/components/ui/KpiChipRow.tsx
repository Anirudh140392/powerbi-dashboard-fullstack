import React from 'react';
import { Star, MessageSquare, BarChart3 } from 'lucide-react';

export interface KpiChipItem {
    label: string;
    value: string;
    tone?: 'amber' | 'emerald' | 'indigo' | 'slate';
    icon?: 'star' | 'reviews' | 'ratings';
}

const toneClasses: Record<NonNullable<KpiChipItem['tone']>, string> = {
    amber: 'border-amber-200/70 bg-amber-50/80 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
    emerald: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300',
    indigo: 'border-indigo-200/70 bg-indigo-50/80 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300',
    slate: 'border-slate-200/70 bg-slate-50/80 text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200',
};

function MetricIcon({ icon }: { icon?: KpiChipItem['icon'] }) {
    if (icon === 'star') {
        return <Star size={11} className="fill-current" />;
    }
    if (icon === 'reviews') {
        return <MessageSquare size={11} />;
    }
    if (icon === 'ratings') {
        return <BarChart3 size={11} />;
    }
    return null;
}

const KpiChipRow: React.FC<{
    items: KpiChipItem[];
    className?: string;
}> = ({ items, className = '' }) => (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
        {items.map(item => (
            <div
                key={item.label}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClasses[item.tone || 'slate']}`}
            >
                <MetricIcon icon={item.icon} />
                <span className="opacity-75">{item.label}</span>
                <span className="font-semibold opacity-100">{item.value}</span>
            </div>
        ))}
    </div>
);

export default KpiChipRow;
