import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, XCircle, BrainCircuit, Loader2, ListChecks, Filter } from 'lucide-react';
import { resolveCompanyId } from '../../utils/tenant';
import { authenticatedFetch, buildAuthHeaders } from '../../utils/auth';

interface MLAuditRecord {
    id: string;
    review_id: string;
    product_name: string;
    review_text: string;
    original_rating: number;
    
    original_category: string | null;
    rules_category: string | null;
    ml_category: string | null;
    
    original_sentiment: string | null;
    ml_sentiment: string | null;
    
    original_issue: string | null;
    ml_issue: string | null;
    
    original_material: string | null;
    rules_material: string | null;
    ml_material: string | null;
    original_wattage: string | null;
    rules_wattage: string | null;
    ml_wattage: string | null;
    
    ml_inferred_rating: number | null;
    ml_issue_category: string | null;
    ml_issue_subcategory: string | null;
    
    ml_confidence_score: number;
    audit_date: string;
}

const QualityControlPanel: React.FC = () => {
    const [audits, setAudits] = useState<MLAuditRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(false);
    const [actioning, setActioning] = useState<string | null>(null);

    const backendUrl = import.meta.env.VITE_API_URL || '';
    
    const fetchAudits = React.useCallback(async () => {
        setLoading(true);
        try {
            const companyId = resolveCompanyId();
            const res = await authenticatedFetch(`${backendUrl}/api/ml-audit/pending?company_id=${companyId}`, {}, companyId);
            if (res.ok) {
                const data = await res.json();
                setAudits(data.audits || []);
            }
        } catch (err) {
            console.error('Failed to fetch ML audits', err);
        } finally {
            setLoading(false);
        }
    }, [backendUrl]);

    useEffect(() => {
        fetchAudits();
        // Poll on a fixed interval regardless of list state. The previous
        // implementation gated polling on `audits.length === 0` and depended
        // on it, which (a) stopped polling once any audit appeared and (b)
        // churned intervals on every list change.
        const interval = setInterval(fetchAudits, 15000);
        return () => clearInterval(interval);
    }, [fetchAudits]);

    const handleTriggerAudit = async () => {
        setTriggering(true);
        try {
            const companyId = resolveCompanyId();
            await authenticatedFetch(`${backendUrl}/api/ml/jobs/spawn?company_id=${companyId}`, {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify({ jobName: 'Gemini Audit' }),
            }, companyId);
            // Let the background script run, and poll after 5s
            setTimeout(fetchAudits, 5000);
        } catch (e) {
            console.error(e);
        } finally {
            setTriggering(false);
        }
    };

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        setActioning(id);
        try {
            const companyId = resolveCompanyId();
            await authenticatedFetch(`${backendUrl}/api/ml-audit/${action}?company_id=${companyId}`, {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify({ audit_ids: [id] })
            }, companyId);
            // Remove locally to feel instant
            setAudits(prev => prev.filter(a => a.id !== id));
        } catch (e) {
            console.error(e);
        } finally {
            setActioning(null);
        }
    };

    const handleApproveAll = async () => {
        if (!window.confirm(`Are you sure you want to approve ${audits.length} AI modifications to production?`)) return;
        setActioning('all');
        try {
            const ids = audits.map(a => a.id);
            const companyId = resolveCompanyId();
            await authenticatedFetch(`${backendUrl}/api/ml-audit/approve?company_id=${companyId}`, {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify({ audit_ids: ids })
            }, companyId);
            setAudits([]);
        } catch (e) {
            console.error(e);
        } finally {
            setActioning(null);
        }
    };

    return (
        <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-900/50">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-700/60 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center gap-2">
                            <BrainCircuit className="text-indigo-500" size={24} />
                            Master Data QC 
                            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">
                                AI Auditing
                            </span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Review AI predictions and approve data syncs to the Master Database.</p>
                    </div>
                    
                    <div className="flex gap-3">
                        <button
                            onClick={handleTriggerAudit}
                            disabled={triggering}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-medium transition-all text-sm relative group overflow-hidden border border-indigo-200 disabled:opacity-50"
                        >
                            {triggering ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                            Sync ML (Next 100)
                        </button>
                        
                        {audits.length > 0 && (
                            <button
                                onClick={handleApproveAll}
                                disabled={actioning === 'all'}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-all text-sm shadow-md shadow-emerald-500/20 disabled:opacity-50"
                            >
                                {actioning === 'all' ? <Loader2 size={16} className="animate-spin" /> : <ListChecks size={16} />}
                                Approve All ({audits.length})
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="p-4 space-y-4">
                {loading && audits.length === 0 ? (
                    <div className="flex items-center justify-center p-12 text-slate-400">
                        <Loader2 className="animate-spin mr-2" /> Initializing AI Verifications...
                    </div>
                ) : audits.length === 0 ? (
                    <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                        <BrainCircuit size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">0 Pending Discrepancies</h3>
                        <p className="text-slate-500 mt-2 text-sm max-w-sm mx-auto">
                            The AI engine has fully audited your master records and found no unresolved gaps. Everything is perfectly optimized. 
                        </p>
                        <button onClick={handleTriggerAudit} className="mt-6 text-indigo-500 font-medium hover:underline text-sm inline-flex items-center">
                            Force Next AI Cycle <Play size={14} className="ml-1" />
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 overflow-x-auto pb-2">
                        {audits.map(audit => (
                            <div key={audit.id} className="min-w-[750px] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm group hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        
                                        {/* Meta */}
                                        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500 mb-2">
                                            <span className="flex items-center gap-1"><Filter size={12}/> Confidence {audit.ml_confidence_score}%</span>
                                            <span>•</span>
                                            <span>⭐ {audit.original_rating} Star</span>
                                        </div>
                                        
                                        {/* Product & Text */}
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate pr-4">
                                            {audit.product_name}
                                        </h4>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 mb-4 italic pl-3 border-l-2 border-indigo-200 dark:border-indigo-800">
                                            "{audit.review_text}"
                                        </p>
                                        
                                        {/* Discrepancy Grids */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            
                                            {/* Rating Diff — Postgres numerics come back as strings, so the user
                                                rating is "5.0" and the AI rating is "5". Strict !== treats those as
                                                different and renders a confusing "5.0 -> 5" diff. Compare numerically
                                                and format both sides the same way. */}
                                            {audit.ml_inferred_rating !== null && audit.original_rating !== null
                                             && Math.abs(Number(audit.ml_inferred_rating) - Number(audit.original_rating)) >= 0.5 && (
                                                <div className="p-3 rounded-lg bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30">
                                                    <div className="text-[10px] uppercase font-bold text-yellow-600 dark:text-yellow-400 mb-1">Inferred Rating</div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="line-through text-slate-400">{Number(audit.original_rating).toFixed(1)}★ (User)</span>
                                                        <span className="text-slate-300">→</span>
                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{Number(audit.ml_inferred_rating).toFixed(1)}★ (AI)</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Sentiment Diff */}
                                            {audit.original_sentiment !== audit.ml_sentiment && (
                                                <div className="p-3 rounded-lg bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
                                                    <div className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 mb-1">Sentiment Shift</div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="line-through text-slate-400">{audit.original_sentiment || 'None'}</span>
                                                        <span className="text-slate-300">→</span>
                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{audit.ml_sentiment}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Specific Spec Diff (Material or Wattage) */}
                                            {(audit.ml_material || audit.ml_wattage) && (
                                                <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                                                    <div className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 mb-1">Specification Extracted</div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="line-through text-slate-400">{audit.original_material || audit.original_wattage || 'None'}</span>
                                                        <span className="text-slate-300">→</span>
                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{audit.ml_material || audit.ml_wattage}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Issue Diff */}
                                            {(audit.original_issue !== audit.ml_issue || audit.ml_issue_category) && (
                                                <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                                                    <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 mb-1">Issue Taxonomy</div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="line-through text-slate-400 truncate max-w-[120px]">{audit.original_issue || 'None'}</span>
                                                        <span className="text-slate-300">→</span>
                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[150px]">
                                                            {audit.ml_issue_category ? `${audit.ml_issue_category}/${audit.ml_issue_subcategory}` : audit.ml_issue}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Category Diff */}
                                            {audit.original_category !== audit.ml_category && audit.original_category !== audit.rules_category && audit.ml_category && (
                                                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                                                    <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-1">Category Realignment</div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="line-through text-slate-400 truncate max-w-[120px]">{audit.original_category || audit.rules_category}</span>
                                                        <span className="text-slate-300">→</span>
                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[150px]">{audit.ml_category}</span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                        </div>
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className="flex flex-col gap-2 flex-shrink-0">
                                        <button 
                                            onClick={() => handleAction(audit.id, 'approve')}
                                            disabled={actioning === audit.id}
                                            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-400 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                                        >
                                            {actioning === audit.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                            Accept AI
                                        </button>
                                        <button 
                                            onClick={() => handleAction(audit.id, 'reject')}
                                            disabled={actioning === audit.id}
                                            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                                        >
                                            <XCircle size={16} />
                                            Keep Ori.
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QualityControlPanel;
