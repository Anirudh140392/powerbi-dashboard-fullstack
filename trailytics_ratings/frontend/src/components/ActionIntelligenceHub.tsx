/**
 * Action Intelligence Hub — Enterprise Review Command Center.
 *
 * Three sections (Impact Simulator + Forecast were dropped — both were
 * client-side heuristics with no real model behind them, and a client
 * asking "where does the 4.3 prediction come from?" had no good answer):
 *   1. Action Board       — open issues by severity, with status persistence
 *   2. Stakeholder Briefs — CEO / Production / QC / CS digests
 *   3. Highlights         — star reviews + red flags + competitor mentions
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, TrendingUp, Star, Users,
    Target, Flame, CheckCircle2, Clock, Circle,
    ArrowUpRight, ArrowDownRight, MessageSquare, Sparkles, Eye, ThumbsUp
} from 'lucide-react';
import type { Review } from '../types';
import { useStakeholderMappings, useIssueStatuses, type IssueStatus } from '../hooks/useExplorerData';

const TAB_CONFIG = [
    { key: 'actions' as const, label: 'Action Board', icon: Target, emoji: '🎯' },
    { key: 'stakeholders' as const, label: 'Stakeholder Briefs', icon: Users, emoji: '👥' },
    { key: 'highlights' as const, label: 'Highlights', icon: Star, emoji: '⭐' },
] as const;

type TabKey = typeof TAB_CONFIG[number]['key'];

interface ActionIssue {
    id: string;
    subcategory: string;
    category: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    stakeholder: string;
    reviewCount: number;
    negativeCount: number;
    negativePct: number;
    trendDelta: number;
    trend: 'rising' | 'falling' | 'stable';
    affectedProducts: string[];
    sampleVerbatims: { text: string; rating: number; date: string }[];
    impactRating: number; // how much fixing this would improve avg rating
}

interface Props {
    reviews: Review[];
    competitorReviews?: Review[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ActionIntelligenceHub: React.FC<Props> = ({ reviews, competitorReviews: _competitorReviews = [] }) => {
    const [activeTab, setActiveTab] = useState<TabKey>('actions');
    const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
    const [stakeholderFilter, setStakeholderFilter] = useState<string>('all');

    // Live stakeholder routing pulled from /api/ratings/stakeholder-mappings —
    // single source of truth shared with the Stakeholder Slider on Overview.
    const { stakeholders, routeOf } = useStakeholderMappings();
    // Issue-triage state persisted to ratings.issue_statuses table (was
    // localStorage-only — invisible to teammates and lost on cache clear).
    const { statuses: issueStatuses, updateStatus } = useIssueStatuses();

    // ========================================================================
    // CORE DATA: Auto-generated action issues
    // ========================================================================
    const actionIssues = useMemo((): ActionIssue[] => {
        const now = new Date();
        const threeMonthsAgo = new Date(now); threeMonthsAgo.setMonth(now.getMonth() - 3);
        const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 6);

        // Group by subcategory
        const groups: Record<string, Review[]> = {};
        reviews.forEach(r => {
            const key = r.subcategory || r.sentimentCategory || 'General';
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });

        return Object.entries(groups)
            .filter(([, revs]) => revs.length >= 5)
            .map(([subcat, revs]) => {
                const category = revs[0]?.sentimentCategory || 'General';
                const negatives = revs.filter(r => r.sentiment === 'Negative');
                const negativePct = (negatives.length / revs.length) * 100;

                // Trend: compare recent 3M vs prior 3M
                const recent = revs.filter(r => new Date(r.date) >= threeMonthsAgo);
                const older = revs.filter(r => { const d = new Date(r.date); return d >= sixMonthsAgo && d < threeMonthsAgo; });
                const recentNegPct = recent.length > 0 ? (recent.filter(r => r.sentiment === 'Negative').length / recent.length) * 100 : 0;
                const olderNegPct = older.length > 0 ? (older.filter(r => r.sentiment === 'Negative').length / older.length) * 100 : 0;
                const trendDelta = recentNegPct - olderNegPct;
                const trend: ActionIssue['trend'] = trendDelta > 5 ? 'rising' : trendDelta < -5 ? 'falling' : 'stable';

                // Severity
                let severity: ActionIssue['severity'] = 'low';
                if (negativePct > 40 && trend === 'rising') severity = 'critical';
                else if (negativePct > 30 || (negativePct > 20 && trend === 'rising')) severity = 'high';
                else if (negativePct > 15) severity = 'medium';

                // Stakeholder routing — uses live DB-backed mapping by sentiment
                // subcategory (not the broader sentimentCategory). The DB already
                // routes Build_Quality → Production, Cheap_Quality → Production, etc.
                const stakeholder = routeOf(subcat);

                // Affected products
                const prodMap: Record<string, number> = {};
                negatives.forEach(r => { if (r.product) prodMap[r.product] = (prodMap[r.product] || 0) + 1; });
                const affectedProducts = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p]) => p);

                // Sample verbatims (worst reviews)
                const sampleVerbatims = negatives
                    .sort((a, b) => a.rating - b.rating)
                    .slice(0, 3)
                    .map(r => ({ text: r.text.slice(0, 200), rating: r.rating, date: r.date }));

                // Impact: how much removing these negatives would improve avg rating
                const totalRatingSum = reviews.reduce((s, r) => s + r.rating, 0);
                const negRatingSum = negatives.reduce((s, r) => s + r.rating, 0);
                const remainingCount = reviews.length - negatives.length;
                const currentAvg = reviews.length > 0 ? totalRatingSum / reviews.length : 0;
                const fixedAvg = remainingCount > 0 ? (totalRatingSum - negRatingSum + negatives.length * 4.5) / reviews.length : currentAvg;
                const impactRating = fixedAvg - currentAvg;

                return {
                    id: `issue-${subcat.replace(/\s/g, '-').toLowerCase()}`,
                    subcategory: subcat.replace(/_/g, ' '),
                    category: String(category),
                    severity, stakeholder, reviewCount: revs.length,
                    negativeCount: negatives.length, negativePct,
                    trendDelta: Math.round(trendDelta), trend,
                    affectedProducts, sampleVerbatims, impactRating,
                };
            })
            .filter(i => i.negativePct > 10)
            .sort((a, b) => {
                const sev = { critical: 4, high: 3, medium: 2, low: 1 };
                return sev[b.severity] - sev[a.severity] || b.impactRating - a.impactRating;
            });
        // Re-route when stakeholder mappings finish loading so the empty initial
        // render is replaced with the real DB routing on the next paint.
    }, [reviews, routeOf]);

    // ========================================================================
    // KEY METRICS
    // ========================================================================
    const metrics = useMemo(() => {
        const total = reviews.length;
        const pos = reviews.filter(r => r.sentiment === 'Positive').length;
        const neg = reviews.filter(r => r.sentiment === 'Negative').length;
        const avgRating = total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
        const nps = total > 0 ? Math.round(((pos - neg) / total) * 100) : 0;
        const openIssues = actionIssues.filter(i => (issueStatuses[i.id] || 'open') === 'open').length;
        const criticalCount = actionIssues.filter(i => i.severity === 'critical').length;
        return { total, pos, neg, avgRating, nps, openIssues, criticalCount };
    }, [reviews, actionIssues, issueStatuses]);

    // ========================================================================
    // REVIEW HIGHLIGHTS
    // ========================================================================
    const highlights = useMemo(() => {
        const sorted = [...reviews].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const stars = sorted.filter(r => r.rating >= 5 && r.text.length > 50).slice(0, 5);
        const redFlags = sorted.filter(r => r.rating <= 2 && r.text.length > 50).slice(0, 5);
        const compIntel = sorted.filter(r => r.competitorMentions && r.competitorMentions.length > 0).slice(0, 5);
        return { stars, redFlags, compIntel };
    }, [reviews]);

    // ========================================================================
    // FILTERED ISSUES
    // ========================================================================
    const filteredIssues = useMemo(() => {
        return actionIssues.filter(issue => {
            const status = issueStatuses[issue.id] || 'open';
            if (statusFilter !== 'all' && status !== statusFilter) return false;
            if (stakeholderFilter !== 'all' && issue.stakeholder !== stakeholderFilter) return false;
            return true;
        });
    }, [actionIssues, issueStatuses, statusFilter, stakeholderFilter]);

    // ========================================================================
    // HELPERS
    // ========================================================================
    const severityConfig = {
        critical: { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', pill: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' },
        high: { bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', pill: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' },
        medium: { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', pill: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' },
        low: { bg: 'bg-slate-400', text: 'text-slate-500', pill: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
    };

    const statusConfig = {
        open: { icon: Circle, label: 'Open', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/15' },
        in_progress: { icon: Clock, label: 'In Progress', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/15' },
        resolved: { icon: CheckCircle2, label: 'Resolved', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/15' },
    };

    const statusCycle: IssueStatus[] = ['open', 'in_progress', 'resolved'];
    const cycleStatus = (id: string) => {
        const current = issueStatuses[id] || 'open';
        const next = statusCycle[(statusCycle.indexOf(current) + 1) % statusCycle.length];
        updateStatus(id, next);
    };

    // ========================================================================
    // RENDER
    // ========================================================================
    return (
        <div className="space-y-5">
            {/* Header Metrics Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Open Issues', value: metrics.openIssues, icon: Target, color: 'text-red-500', sub: `${metrics.criticalCount} critical` },
{ label: 'User Rating', value: metrics.avgRating.toFixed(2) + '★', icon: Star, color: 'text-amber-500', sub: `${metrics.total.toLocaleString()} reviews` },
                    { label: 'NPS Score', value: metrics.nps, icon: TrendingUp, color: metrics.nps >= 0 ? 'text-emerald-500' : 'text-red-500', sub: 'Net Sentiment' },
                    { label: 'Positive Rate', value: `${metrics.total > 0 ? Math.round((metrics.pos / metrics.total) * 100) : 0}%`, icon: ThumbsUp, color: 'text-emerald-500', sub: `${metrics.pos.toLocaleString()} positive` },
                ].map(m => (
                    <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="card p-4 flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-800 ${m.color}`}><m.icon size={18} /></div>
                        <div>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{m.value}</p>
                            <p className="text-[10px] text-slate-400">{m.label} · {m.sub}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/40 dark:border-slate-700/40 overflow-x-auto">
                {TAB_CONFIG.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${activeTab === tab.key
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}>
                        <span>{tab.emoji}</span> {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                {/* ============ TAB 1: ACTION BOARD ============ */}
                {activeTab === 'actions' && (
                    <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        {/* Filters */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                                {(['all', 'open', 'in_progress', 'resolved'] as const).map(s => (
                                    <button key={s} onClick={() => setStatusFilter(s)}
                                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${statusFilter === s ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                            }`}>
                                        {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg overflow-x-auto">
                                <button onClick={() => setStakeholderFilter('all')}
                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all shrink-0 ${stakeholderFilter === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'
                                        }`}>All Teams</button>
                                {stakeholders.map(s => (
                                    <button key={s.key} onClick={() => setStakeholderFilter(s.key)}
                                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all shrink-0 ${stakeholderFilter === s.key ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'
                                            }`}>{s.label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Issue Cards */}
                        {filteredIssues.map((issue, idx) => {
                            const sev = severityConfig[issue.severity];
                            const status = issueStatuses[issue.id] || 'open';
                            const stCfg = statusConfig[status];
                            const StIcon = stCfg.icon;
                            const stakeholder = stakeholders.find(s => s.key === issue.stakeholder);

                            return (
                                <motion.div key={issue.id}
                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                                    className={`card p-5 border-l-4 ${issue.severity === 'critical' ? 'border-red-500' : issue.severity === 'high' ? 'border-orange-500' : issue.severity === 'medium' ? 'border-amber-500' : 'border-slate-300'} ${status === 'resolved' ? 'opacity-60' : ''}`}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{issue.subcategory}</h4>
                                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${sev.pill}`}>{issue.severity}</span>
                                                {issue.trend === 'rising' && <span className="text-[9px] font-semibold text-red-500 flex items-center gap-0.5"><ArrowUpRight size={10} />Rising</span>}
                                                {issue.trend === 'falling' && <span className="text-[9px] font-semibold text-emerald-500 flex items-center gap-0.5"><ArrowDownRight size={10} />Cooling</span>}
                                            </div>
                                            <p className="text-[11px] text-slate-400">
                                                {issue.category} · {issue.negativeCount} negative of {issue.reviewCount} reviews · {Math.round(issue.negativePct)}% complaint rate
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {stakeholder && (
                                                <span className={`text-[9px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 ${stakeholder.color}`}>
                                                    <stakeholder.icon size={10} /> {stakeholder.label}
                                                </span>
                                            )}
                                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => cycleStatus(issue.id)}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold ${stCfg.bg} ${stCfg.color} border border-current/10`}>
                                                <StIcon size={11} /> {stCfg.label}
                                            </motion.button>
                                        </div>
                                    </div>

                                    {/* Affected Products */}
                                    {issue.affectedProducts.length > 0 && (
                                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                                            <span className="text-[9px] text-slate-400 font-medium">Affected:</span>
                                            {issue.affectedProducts.slice(0, 3).map(p => (
                                                <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{p}</span>
                                            ))}
                                            {issue.affectedProducts.length > 3 && <span className="text-[9px] text-slate-400">+{issue.affectedProducts.length - 3} more</span>}
                                        </div>
                                    )}

                                    {/* Impact + Verbatims */}
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/15 rounded-xl">
                                            <Sparkles size={12} className="text-indigo-500" />
                                            <span className="text-[10px] text-slate-600 dark:text-slate-400">Fix impact:</span>
                                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">+{issue.impactRating.toFixed(2)}★</span>
                                        </div>
                                        {issue.sampleVerbatims.length > 0 && (
                                            <div className="flex-1 text-[10px] text-slate-400 italic truncate border-l border-slate-200 dark:border-slate-700 pl-3">
                                                "{issue.sampleVerbatims[0].text.slice(0, 120)}..."
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                        {filteredIssues.length === 0 && (
                            <div className="text-center py-12 text-sm text-slate-400">
                                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                                No issues match the current filters
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ============ TAB 2: STAKEHOLDER BRIEFS ============ */}
                {activeTab === 'stakeholders' && (
                    <motion.div key="stakeholders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* CEO Brief */}
                        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                            className="card p-5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-indigo-200/40 dark:border-indigo-800/40 md:col-span-2">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-indigo-500/15 rounded-xl"><Eye size={18} className="text-indigo-500" /></div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">CEO / VP Brief</h3>
                                    <p className="text-[10px] text-slate-400">30-second executive summary</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wider">✅ Wins</p>
                                    <ul className="space-y-1.5">
                                        {actionIssues.filter(i => i.trend === 'falling').slice(0, 3).map(i => (
                                            <li key={i.id} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                                <ThumbsUp size={10} className="text-emerald-500 mt-0.5 shrink-0" />
                                                <span><strong>{i.subcategory}</strong> complaints down {Math.abs(i.trendDelta)}%</span>
                                            </li>
                                        ))}
                                        {actionIssues.filter(i => i.trend === 'falling').length === 0 && (
                                            <li className="text-xs text-slate-400">No significant improvements detected</li>
                                        )}
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 mb-2 uppercase tracking-wider">🚨 Risks</p>
                                    <ul className="space-y-1.5">
                                        {actionIssues.filter(i => i.severity === 'critical' || i.severity === 'high').slice(0, 3).map(i => (
                                            <li key={i.id} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                                <AlertTriangle size={10} className="text-red-500 mt-0.5 shrink-0" />
                                                <span><strong>{i.subcategory}</strong> — {Math.round(i.negativePct)}% complaint rate</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-wider">📊 KPIs</p>
                                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
<p>User Rating: <strong>{metrics.avgRating.toFixed(2)}★</strong></p>
                                        <p>NPS: <strong className={metrics.nps >= 0 ? 'text-emerald-600' : 'text-red-600'}>{metrics.nps}</strong></p>
                                        <p>Open Issues: <strong className="text-red-600">{metrics.openIssues}</strong></p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Department briefs */}
                        {stakeholders.map((dept, idx) => {
                            const deptIssues = actionIssues.filter(i => i.stakeholder === dept.key);
                            const DIcon = dept.icon;
                            return (
                                <motion.div key={dept.key} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (idx + 1) * 0.08 }}
                                    className="card p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <DIcon size={16} className={dept.color} />
                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{dept.label}</h4>
                                        <span className="ml-auto text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-semibold">
                                            {deptIssues.length} issues
                                        </span>
                                    </div>
                                    {deptIssues.length > 0 ? (
                                        <ul className="space-y-2">
                                            {deptIssues.slice(0, 4).map(issue => (
                                                <li key={issue.id} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${severityConfig[issue.severity].bg}`} />
                                                    <div>
                                                        <span className="font-medium text-slate-700 dark:text-slate-300">{issue.subcategory}</span>
                                                        <span className="text-slate-400"> — {issue.negativeCount} complaints ({Math.round(issue.negativePct)}%)</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-xs text-emerald-500 flex items-center gap-1.5"><CheckCircle2 size={12} /> No issues assigned</p>
                                    )}
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* ============ TAB 4: REVIEW HIGHLIGHTS ============ */}
                {activeTab === 'highlights' && (
                    <motion.div key="highlights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        {/* Star Reviews */}
                        <div className="card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Star className="text-amber-500" size={18} fill="currentColor" />
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">⭐ Star Reviews — Best for Marketing</h3>
                            </div>
                            <div className="space-y-3">
                                {highlights.stars.map((r, i) => (
                                    <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                                        className="p-3 bg-emerald-50/60 dark:bg-emerald-900/10 rounded-xl border border-emerald-200/40 dark:border-emerald-800/30">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="flex gap-0.5">{Array.from({ length: r.rating }, (_, j) => <Star key={j} size={10} fill="#f59e0b" className="text-amber-500" />)}</div>
                                            <span className="text-[9px] text-slate-400">{new Date(r.date).toLocaleDateString()}</span>
                                            <span className="text-[9px] text-slate-400 truncate max-w-[200px] ml-auto">{r.product}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">"{r.text}"</p>
                                    </motion.div>
                                ))}
                                {highlights.stars.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No star reviews found</p>}
                            </div>
                        </div>

                        {/* Red Flags */}
                        <div className="card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Flame className="text-red-500" size={18} />
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">🚩 Red Flags — Needs Immediate Attention</h3>
                            </div>
                            <div className="space-y-3">
                                {highlights.redFlags.map((r, i) => (
                                    <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                                        className="p-3 bg-red-50/60 dark:bg-red-900/10 rounded-xl border border-red-200/40 dark:border-red-800/30">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="flex gap-0.5">{Array.from({ length: r.rating }, (_, j) => <Star key={j} size={10} fill="#ef4444" className="text-red-400" />)}</div>
                                            <span className="text-[9px] text-slate-400">{new Date(r.date).toLocaleDateString()}</span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/20 text-red-600 font-medium">{r.sentimentCategory}</span>
                                            <span className="text-[9px] text-slate-400 truncate max-w-[200px] ml-auto">{r.product}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">"{r.text}"</p>
                                    </motion.div>
                                ))}
                                {highlights.redFlags.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No red flags — great quality!</p>}
                            </div>
                        </div>

                        {/* Competitor Intel */}
                        {highlights.compIntel.length > 0 && (
                            <div className="card p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <MessageSquare className="text-indigo-500" size={18} />
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">🔍 Competitor Mentions</h3>
                                </div>
                                <div className="space-y-3">
                                    {highlights.compIntel.map((r, i) => (
                                        <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                                            className="p-3 bg-indigo-50/60 dark:bg-indigo-900/10 rounded-xl border border-indigo-200/40 dark:border-indigo-800/30">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="flex gap-0.5">{Array.from({ length: r.rating }, (_, j) => <Star key={j} size={10} fill="#6366f1" className="text-indigo-400" />)}</div>
                                                <span className="text-[9px] text-slate-400">{new Date(r.date).toLocaleDateString()}</span>
                                                {r.competitorMentions?.map(cm => (
                                                    <span key={cm.brand} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${cm.isFavorable ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-100 dark:bg-red-900/20 text-red-600'}`}>
                                                        vs {cm.brand} {cm.isFavorable ? '✓ We win' : '✗ They win'}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">"{r.text}"</p>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
};

export default ActionIntelligenceHub;
