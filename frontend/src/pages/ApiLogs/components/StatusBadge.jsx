import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, HelpCircle } from 'lucide-react';

export default function StatusBadge({ status }) {
    const s = String(status || '').toLowerCase();

    if (s === 'success') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Success
            </span>
        );
    }

    if (s === 'slow') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Slow
            </span>
        );
    }

    if (s === 'failed') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Failed
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            {status || 'Unknown'}
        </span>
    );
}
