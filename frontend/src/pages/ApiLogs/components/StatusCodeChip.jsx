import React from 'react';

export default function StatusCodeChip({ code }) {
    const num = Number(code) || 0;

    let style = "bg-slate-100 text-slate-700 border-slate-300";
    let label = num === 0 ? "TIMEOUT / 0" : String(num);

    if (num >= 200 && num < 300) {
        style = "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold";
    } else if (num >= 300 && num < 400) {
        style = "bg-sky-50 text-sky-700 border-sky-200 font-medium";
    } else if (num >= 400 && num < 500) {
        style = "bg-amber-50 text-amber-700 border-amber-200 font-semibold";
    } else if (num >= 500) {
        style = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
    }

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-mono tracking-wide ${style}`}>
            {label}
        </span>
    );
}
