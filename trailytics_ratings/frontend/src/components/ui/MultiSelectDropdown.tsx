/**
 * MultiSelectDropdown — reusable multi-checkbox dropdown with search +
 * selected chips. Used in the AlertRuleModal for Platforms / Brands /
 * Categories filters.
 *
 * Props:
 *   label, options, value, onChange, loading, placeholder
 *
 * Each option is { value, label, hint? }. value is what gets persisted;
 * label is shown. hint shows on the right of each option row (e.g. count).
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface MultiSelectOption {
    value: string;
    label: string;
    hint?: string;
    pill?: { text: string; color?: 'indigo' | 'amber' | 'rose' | 'slate' };
}

interface Props {
    label?: string;
    options: MultiSelectOption[];
    value: string[];
    onChange: (next: string[]) => void;
    loading?: boolean;
    placeholder?: string;
    /** Show "Select all / Clear" shortcut in the panel. */
    showSelectAll?: boolean;
    /** Compact mode: smaller footprint, no chip area below */
    compact?: boolean;
    /** Disable interactions */
    disabled?: boolean;
}

export function MultiSelectDropdown({
    label, options, value, onChange, loading, placeholder = 'Choose…',
    showSelectAll = true, compact = false, disabled = false,
}: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const filtered = useMemo(() => {
        if (!query.trim()) return options;
        const q = query.toLowerCase();
        return options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
    }, [options, query]);

    const toggle = (v: string) => {
        if (value.includes(v)) onChange(value.filter(x => x !== v));
        else onChange([...value, v]);
    };
    const selectAll = () => onChange(filtered.map(o => o.value));
    const clearAll = () => onChange([]);

    const valueLabels = useMemo(() => {
        const labelByValue = new Map(options.map(o => [o.value, o.label]));
        return value.map(v => ({ value: v, label: labelByValue.get(v) || v }));
    }, [value, options]);

    return (
        <div ref={ref} className="relative">
            {label && <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(v => !v)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left
                    ${disabled
                        ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                        : open
                        ? 'border-indigo-500 bg-white dark:bg-slate-800 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'}`}
            >
                <span className="flex-1 truncate text-slate-700 dark:text-slate-200">
                    {value.length === 0 ? (
                        <span className="text-slate-400">{placeholder}</span>
                    ) : value.length <= 2 ? (
                        valueLabels.map(v => v.label).join(', ')
                    ) : (
                        <>
                            {valueLabels.slice(0, 2).map(v => v.label).join(', ')}
                            <span className="text-slate-400"> +{value.length - 2} more</span>
                        </>
                    )}
                </span>
                <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-30 mt-1 w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                    {/* Search */}
                    <div className="px-2 pt-2 pb-1">
                        <div className="relative">
                            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search…"
                                autoFocus
                                className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            />
                        </div>
                    </div>

                    {/* Header — Select all / Clear */}
                    {showSelectAll && filtered.length > 0 && (
                        <div className="flex items-center justify-between px-3 py-1 text-[10px] border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500">{value.length} of {options.length} selected</span>
                            <div className="flex gap-2">
                                <button onClick={selectAll} className="text-indigo-600 dark:text-indigo-400 hover:underline">All shown</button>
                                <button onClick={clearAll} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:underline">Clear</button>
                            </div>
                        </div>
                    )}

                    {/* Options */}
                    <div className="max-h-64 overflow-y-auto py-1">
                        {loading ? (
                            <div className="px-3 py-4 flex items-center gap-2 text-xs text-slate-500">
                                <div className="w-3 h-3 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                                Loading…
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="px-3 py-4 text-xs text-slate-500 text-center">No matches.</div>
                        ) : filtered.map(opt => {
                            const checked = value.includes(opt.value);
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => toggle(opt.value)}
                                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs transition-colors
                                        ${checked
                                            ? 'bg-indigo-50/60 dark:bg-indigo-900/15 text-indigo-700 dark:text-indigo-300'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                                >
                                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0
                                        ${checked
                                            ? 'bg-indigo-600 border-indigo-600'
                                            : 'border-slate-300 dark:border-slate-600'}`}>
                                        {checked && <Check size={9} className="text-white" />}
                                    </span>
                                    <span className="flex-1 truncate">{opt.label}</span>
                                    {opt.pill && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold
                                            ${opt.pill.color === 'amber' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                : opt.pill.color === 'rose' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                                : opt.pill.color === 'indigo' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                            {opt.pill.text}
                                        </span>
                                    )}
                                    {opt.hint && <span className="text-[10px] text-slate-400 tabular-nums">{opt.hint}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Selected chips below — gives a quick remove-by-click */}
            {!compact && value.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {valueLabels.map(v => (
                        <span
                            key={v.value}
                            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold"
                        >
                            {v.label}
                            <button
                                onClick={() => toggle(v.value)}
                                className="hover:text-rose-500"
                                title="Remove"
                            >
                                <X size={9} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
