import React, { useState, useEffect, useCallback } from 'react';
import { Edit3, Trash2, Plus, Loader2, X, Check, AlertCircle } from 'lucide-react';
import { resolveCompanyId } from '../../utils/tenant';
import { authenticatedFetch, buildAuthHeaders } from '../../utils/auth';

interface DBRule {
    id: number | null;        // null for an unsaved new row
    category: string;
    include_keywords: string[];
    exclude_keywords: string[];
    priority: number;
    _editing?: boolean;
    _saving?: boolean;
    _error?: string | null;
    _draft?: {
        category: string;
        include_keywords: string;
        exclude_keywords: string;
        priority: string;
    };
}

const splitKeywords = (raw: string): string[] =>
    raw.split(',').map(s => s.trim()).filter(Boolean);

const CategoryExtractionRules: React.FC = () => {
    const [rules, setRules] = useState<DBRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const backendUrl = (import.meta.env.VITE_RATINGS_API_URL || import.meta.env.VITE_API_URL) || '';

    const fetchRules = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const companyId = resolveCompanyId();
            const res = await authenticatedFetch(
                `${backendUrl}/api/ratings/category-rules?company_id=${companyId}`,
                {},
                companyId,
            );
            if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
            const json = await res.json();
            setRules((json.rules || []).map((r: DBRule) => ({ ...r, _editing: false })));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load rules');
        } finally {
            setLoading(false);
        }
    }, [backendUrl]);

    useEffect(() => { fetchRules(); }, [fetchRules]);

    const startEdit = (idx: number) => {
        setRules(prev => prev.map((r, i) => i === idx ? {
            ...r,
            _editing: true,
            _error: null,
            _draft: {
                category: r.category,
                include_keywords: r.include_keywords.join(', '),
                exclude_keywords: r.exclude_keywords.join(', '),
                priority: String(r.priority),
            },
        } : r));
    };

    const cancelEdit = (idx: number) => {
        setRules(prev => {
            // If it's a brand-new unsaved row (id=null), drop it; else just exit edit mode.
            if (prev[idx].id == null) return prev.filter((_, i) => i !== idx);
            return prev.map((r, i) => i === idx ? { ...r, _editing: false, _error: null, _draft: undefined } : r);
        });
    };

    const updateDraft = (idx: number, field: keyof NonNullable<DBRule['_draft']>, value: string) => {
        setRules(prev => prev.map((r, i) => i === idx && r._draft
            ? { ...r, _draft: { ...r._draft, [field]: value } }
            : r));
    };

    const saveRow = async (idx: number) => {
        const row = rules[idx];
        if (!row._draft) return;
        const draft = row._draft;
        const category = draft.category.trim();
        if (!category) {
            setRules(prev => prev.map((r, i) => i === idx ? { ...r, _error: 'Category name is required' } : r));
            return;
        }
        const payload = {
            category,
            include_keywords: splitKeywords(draft.include_keywords),
            exclude_keywords: splitKeywords(draft.exclude_keywords),
            priority: parseInt(draft.priority, 10) || 0,
        };
        setRules(prev => prev.map((r, i) => i === idx ? { ...r, _saving: true, _error: null } : r));
        try {
            const companyId = resolveCompanyId();
            const isNew = row.id == null;
            const url = isNew
                ? `${backendUrl}/api/ratings/category-rules?company_id=${companyId}`
                : `${backendUrl}/api/ratings/category-rules/${row.id}?company_id=${companyId}`;
            const res = await authenticatedFetch(url, {
                method: isNew ? 'POST' : 'PUT',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify(payload),
            }, companyId);
            if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
            await fetchRules();
        } catch (e) {
            setRules(prev => prev.map((r, i) => i === idx ? {
                ...r, _saving: false, _error: e instanceof Error ? e.message : 'Save failed',
            } : r));
        }
    };

    const deleteRow = async (idx: number) => {
        const row = rules[idx];
        if (row.id == null) { cancelEdit(idx); return; }
        if (!window.confirm(`Delete rule for "${row.category}"?`)) return;
        try {
            const companyId = resolveCompanyId();
            const res = await authenticatedFetch(
                `${backendUrl}/api/ratings/category-rules/${row.id}?company_id=${companyId}`,
                { method: 'DELETE' },
                companyId,
            );
            if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
            await fetchRules();
        } catch (e) {
            alert(`Delete failed: ${e instanceof Error ? e.message : e}`);
        }
    };

    const addNew = () => {
        setRules(prev => [
            {
                id: null,
                category: '',
                include_keywords: [],
                exclude_keywords: [],
                priority: 0,
                _editing: true,
                _draft: { category: '', include_keywords: '', exclude_keywords: '', priority: '0' },
            },
            ...prev,
        ]);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl m-4 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Product Category Matrix</h3>
                    <p className="text-sm text-slate-500">Keyword rules driving category classification. Lower priority runs first.</p>
                </div>
                <button
                    onClick={addNew}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
                >
                    <Plus size={16} /> New Rule
                </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
                {error && (
                    <div className="mb-3 flex items-center gap-2 text-rose-500 text-sm">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-white/90 dark:bg-slate-900/90 z-10">
                            <th className="py-3 px-4 w-1/5">Master Category</th>
                            <th className="py-3 px-4">Include Keywords</th>
                            <th className="py-3 px-4">Exclude Keywords</th>
                            <th className="py-3 px-4 w-16">Priority</th>
                            <th className="py-3 px-4 w-24 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {loading ? (
                            <tr><td colSpan={5} className="py-10 text-center text-slate-400">
                                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                                Loading extraction rules...
                            </td></tr>
                        ) : rules.length === 0 ? (
                            <tr><td colSpan={5} className="py-10 text-center text-slate-400">
                                No category rules yet. Click "New Rule" to add one.
                            </td></tr>
                        ) : rules.map((rule, idx) => (
                            <tr key={rule.id ?? `new-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                                {rule._editing && rule._draft ? (
                                    <>
                                        <td className="py-2 px-4">
                                            <input
                                                type="text"
                                                value={rule._draft.category}
                                                placeholder="e.g. Pressure Cooker"
                                                onChange={(e) => updateDraft(idx, 'category', e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                            />
                                        </td>
                                        <td className="py-2 px-4">
                                            <input
                                                type="text"
                                                value={rule._draft.include_keywords}
                                                placeholder="comma, separated, keywords"
                                                onChange={(e) => updateDraft(idx, 'include_keywords', e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                            />
                                        </td>
                                        <td className="py-2 px-4">
                                            <input
                                                type="text"
                                                value={rule._draft.exclude_keywords}
                                                placeholder="comma, separated"
                                                onChange={(e) => updateDraft(idx, 'exclude_keywords', e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                            />
                                        </td>
                                        <td className="py-2 px-4">
                                            <input
                                                type="number"
                                                value={rule._draft.priority}
                                                onChange={(e) => updateDraft(idx, 'priority', e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                            />
                                        </td>
                                        <td className="py-2 px-2">
                                            <div className="flex items-center justify-end gap-1">
                                                {rule._error && (
                                                    <span title={rule._error} className="inline-flex">
                                                        <AlertCircle size={14} className="text-rose-500" />
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => saveRow(idx)}
                                                    disabled={rule._saving}
                                                    title="Save"
                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded disabled:opacity-50"
                                                >
                                                    {rule._saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                </button>
                                                <button
                                                    onClick={() => cancelEdit(idx)}
                                                    title="Cancel"
                                                    className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="py-4 px-4">
                                            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{rule.category}</span>
                                        </td>
                                        <td className="py-4 px-4 max-w-xs">
                                            <div className="flex flex-wrap gap-1.5">
                                                {rule.include_keywords.map((k, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 rounded-md text-xs">{k}</span>
                                                ))}
                                                {rule.include_keywords.length === 0 && <span className="text-xs text-slate-400 italic">None</span>}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 max-w-xs">
                                            <div className="flex flex-wrap gap-1.5">
                                                {rule.exclude_keywords && rule.exclude_keywords.length > 0
                                                    ? rule.exclude_keywords.map((k, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-md text-xs">{k}</span>
                                                    ))
                                                    : <span className="text-xs text-slate-400 italic">None</span>}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-sm text-slate-500">{rule.priority}</td>
                                        <td className="py-4 px-2 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => startEdit(idx)}
                                                    title="Edit"
                                                    className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => deleteRow(idx)}
                                                    title="Delete"
                                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CategoryExtractionRules;
