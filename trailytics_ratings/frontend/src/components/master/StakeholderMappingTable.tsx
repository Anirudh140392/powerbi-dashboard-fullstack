import React, { useState, useEffect } from 'react';
import { Search, Loader2, Factory, ClipboardCheck, Headphones, HelpCircle, AlertCircle } from 'lucide-react';
import { useIssuesBreakdown, type NlpIssue } from '../../hooks/useRatingsAPI';
import { resolveCompanyId } from '../../utils/tenant';
import { authenticatedFetch, buildAuthHeaders } from '../../utils/auth';

const STAKEHOLDER_OPTIONS = ['Production', 'QC', 'Customer Service'] as const;

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    Production: Factory,
    QC: ClipboardCheck,
    'Customer Service': Headphones,
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const StakeholderMappingTable: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const { data: issues, loading } = useIssuesBreakdown();

    // Local edit overlay: subcategory -> stakeholder (pending or just-saved)
    const [overrides, setOverrides] = useState<Map<string, string | null>>(new Map());
    const [saveState, setSaveState] = useState<Map<string, SaveState>>(new Map());

    // Reset overrides when fresh data arrives (so server is the source of truth on reload)
    useEffect(() => {
        setOverrides(new Map());
        setSaveState(new Map());
    }, [issues]);

    const backendUrl = (import.meta.env.VITE_RATINGS_API_URL || import.meta.env.VITE_API_URL) || '';

    const setOverride = (subcat: string, value: string | null) => {
        setOverrides((m) => new Map(m).set(subcat, value));
    };
    const setStatus = (subcat: string, value: SaveState) => {
        setSaveState((m) => new Map(m).set(subcat, value));
    };

    const handleChange = async (issue: NlpIssue, next: string) => {
        const newStakeholder = next === '' ? null : next;
        const prev = overrides.get(issue.subcategory) ?? issue.stakeholder;
        setOverride(issue.subcategory, newStakeholder);
        setStatus(issue.subcategory, 'saving');
        try {
            const companyId = resolveCompanyId();
            const res = await authenticatedFetch(`${backendUrl}/api/ratings/stakeholder-mappings?company_id=${companyId}`, {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify({
                    sentiment_subcategory: issue.subcategory,
                    stakeholder: newStakeholder,
                    display_label: issue.label,
                }),
            }, companyId);
            if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
            setStatus(issue.subcategory, 'saved');
            setTimeout(() => setStatus(issue.subcategory, 'idle'), 1500);
        } catch (e) {
            console.error('Stakeholder save failed', e);
            setOverride(issue.subcategory, prev);
            setStatus(issue.subcategory, 'error');
        }
    };

    const filteredIssues = issues.filter(issue =>
        issue.subcategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (issue.stakeholder && issue.stakeholder.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="flex flex-col h-full min-w-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">NLP → Stakeholder Matrix</h3>
                    <p className="text-sm text-slate-500">Maps AI-extracted review issues to internal departments. Changes save automatically.</p>
                </div>
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Find Subcategory..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 relative">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 size={32} className="animate-spin mb-4 text-indigo-500" />
                        <p>Loading Issue categories...</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase tracking-wider backdrop-blur-md sticky top-0 bg-white/90 dark:bg-slate-900/90 z-10">
                                <th className="py-3 px-4">Raw Subcategory (NLP Output)</th>
                                <th className="py-3 px-4">Display Label</th>
                                <th className="py-3 px-4 w-64">Assigned Department</th>
                                <th className="py-3 px-4 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {filteredIssues.map((issue, idx) => {
                                const current = overrides.has(issue.subcategory) ? overrides.get(issue.subcategory) : issue.stakeholder;
                                const status = saveState.get(issue.subcategory) || 'idle';
                                const Icon = current && current in iconMap ? iconMap[current] : HelpCircle;

                                return (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition group">
                                        <td className="py-2 px-4 font-mono text-[9px] text-slate-600 dark:text-slate-400">
                                            {issue.subcategory}
                                        </td>
                                        <td className="py-2 px-4 font-medium text-xs text-slate-900 dark:text-slate-100">
                                            {issue.label}
                                        </td>
                                        <td className="py-2 px-4">
                                            <div className="flex items-center gap-2">
                                                <Icon size={14} className={current ? 'text-indigo-500' : 'text-slate-400'} />
                                                <select
                                                    value={current || ''}
                                                    onChange={(e) => handleChange(issue, e.target.value)}
                                                    disabled={status === 'saving'}
                                                    className={`text-xs bg-white dark:bg-slate-800 border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60 ${
                                                        status === 'error'
                                                            ? 'border-rose-300 dark:border-rose-700'
                                                            : 'border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    <option value="">— Unassigned —</option>
                                                    {STAKEHOLDER_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                    {/* If existing value is custom (not in standard list), preserve it */}
                                                    {current && !STAKEHOLDER_OPTIONS.includes(current as typeof STAKEHOLDER_OPTIONS[number]) && (
                                                        <option value={current}>{current}</option>
                                                    )}
                                                </select>
                                            </div>
                                        </td>
                                        <td className="py-2 px-2 text-right">
                                            {status === 'saving' && <Loader2 size={12} className="animate-spin text-indigo-500 inline" />}
                                            {status === 'saved' && <span className="text-emerald-500 text-[10px] font-bold">✓</span>}
                                            {status === 'error' && <AlertCircle size={12} className="text-rose-500 inline" />}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default StakeholderMappingTable;
