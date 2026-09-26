/**
 * StakeholderSlider — Slide-in panel showing Issues → SKUs → Reviews for a stakeholder
 * Flow: Click stakeholder card → Slider with issues list → Expand issue → See SKUs → Click SKU → ReviewModal
 */
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Factory, ClipboardCheck, Headphones, Star,
    AlertTriangle, ChevronDown, Eye, Package, Users
} from 'lucide-react';
import { useStakeholderDetail, type StakeholderIssue, type StakeholderIssueSku } from '../hooks/useRatingsAPI';
import ReviewModal from './ReviewModal';

const stakeholderConfig: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string; accent: string }> = {
    Production: { icon: Factory, gradient: 'from-orange-500/10 via-amber-500/5 to-transparent', accent: 'text-orange-500' },
    QC: { icon: ClipboardCheck, gradient: 'from-blue-500/10 via-cyan-500/5 to-transparent', accent: 'text-blue-500' },
    'Customer Service': { icon: Headphones, gradient: 'from-emerald-500/10 via-green-500/5 to-transparent', accent: 'text-emerald-500' },
};

const DYNAMIC_THEMES = [
    { gradient: 'from-purple-500/10 via-fuchsia-500/5 to-transparent', accent: 'text-purple-500' },
    { gradient: 'from-indigo-500/10 via-blue-500/5 to-transparent', accent: 'text-indigo-500' },
    { gradient: 'from-rose-500/10 via-pink-500/5 to-transparent', accent: 'text-rose-500' },
    { gradient: 'from-teal-500/10 via-cyan-500/5 to-transparent', accent: 'text-teal-500' },
];

function getStakeholderConfig(name: string | null) {
    if (!name) return { icon: Users, gradient: 'from-gray-500/10 via-gray-400/5 to-transparent', accent: 'text-gray-500' };
    if (stakeholderConfig[name]) return stakeholderConfig[name];
    
    // Hash string to pick a theme
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const themeIdx = Math.abs(hash) % DYNAMIC_THEMES.length;
    return { icon: Users, ...DYNAMIC_THEMES[themeIdx] };
}

interface StakeholderSliderProps {
    isOpen: boolean;
    onClose: () => void;
    stakeholderName: string | null;
    filters?: {
        category?: string | null;
        pareto_status?: string | null;
        rating_bifurcation?: string | null;
        platform?: string | null;
        date_from?: string | null;
        date_to?: string | null;
        price_mode?: 'rp' | 'sp' | null;
        price_min?: number | null;
        price_max?: number | null;
        is_competitor?: string | null;
        brand?: string | null;
        sentiment_category?: string | null;
        web_pid?: string | null;
        period_months?: number | null;
    };
}

const StakeholderSlider = ({ isOpen, onClose, stakeholderName, filters }: StakeholderSliderProps) => {
    const { data: issues, loading } = useStakeholderDetail(isOpen ? stakeholderName : null, filters);
    const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
    const [reviewModal, setReviewModal] = useState<{
        webPid: string; subcategory: string; productName: string; issueLabel: string;
    } | null>(null);

    const config = getStakeholderConfig(stakeholderName);
    const IconComponent = config.icon;

    const totalNegative = issues.reduce((s, i) => s + i.negativeCount, 0);

    const totalSkus = useMemo(() => {
        let count = 0;
        issues.forEach(issue => {
            issue.skus.forEach(sku => {
                if (sku.negCount > 0) {
                    count++;
                }
            });
        });
        return count;
    }, [issues]);

    return (
        <>
            {createPortal(
                <AnimatePresence>
                    {isOpen && stakeholderName && (
                        <div key="stakeholder-slider-root" className="fixed inset-0 z-[1300] pointer-events-none">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm pointer-events-auto"
                                onClick={onClose}
                            />

                            {/* Slider Panel */}
                            <motion.div
                                initial={{ x: '100%', opacity: 0.5 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: '100%', opacity: 0 }}
                                transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                                className="absolute right-0 top-0 bottom-0 w-full md:w-[600px] lg:w-[720px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.15)] flex flex-col border-l border-white/20 dark:border-slate-700/50 pointer-events-auto"
                            >
                                {/* Header */}
                                <div className={`px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-br ${config.gradient} flex-shrink-0 relative overflow-hidden`}>
                                    <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                                    <div className="relative flex items-center justify-between z-10">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-2xl bg-white/90 dark:bg-slate-800/90 shadow-[0_4px_12px_rgba(0,0,0,0.05)] backdrop-blur-sm ${config.accent}`}>
                                                <IconComponent size={24} strokeWidth={2.5} />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{stakeholderName}</h2>
                                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded-md bg-white/60 dark:bg-slate-800/60 shadow-sm text-slate-700 dark:text-slate-200">{issues.length} issues</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                    <span className="px-2 py-0.5 rounded-md bg-white/60 dark:bg-slate-800/60 shadow-sm text-slate-700 dark:text-slate-200">{totalSkus.toLocaleString()} SKUs</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                    <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 shadow-sm">{totalNegative.toLocaleString()} negative reviews</span>
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className="p-2.5 rounded-full bg-white/50 hover:bg-white dark:bg-slate-800/50 dark:hover:bg-slate-800 shadow-sm hover:shadow transition-all duration-200 group"
                                        >
                                            <X size={20} className="text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors" />
                                        </button>
                                    </div>
                                </div>

                                {/* Content — Issue list */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                    {loading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                <span className="text-sm text-slate-400">Loading stakeholder data...</span>
                                            </div>
                                        </div>
                                    ) : issues.length === 0 ? (
                                        <div className="text-center py-20 text-slate-400">
                                            No issues found for this stakeholder
                                        </div>
                                    ) : (
                                        issues.map((issue, idx) => (
                                            <IssueRow
                                                key={issue.subcategory}
                                                issue={issue}
                                                index={idx}
                                                isExpanded={expandedIssue === issue.subcategory}
                                                onToggle={() => setExpandedIssue(expandedIssue === issue.subcategory ? null : issue.subcategory)}
                                                onViewReviews={(sku) => setReviewModal({
                                                    webPid: sku.web_pid,
                                                    subcategory: issue.subcategory,
                                                    productName: sku.product_name,
                                                    issueLabel: issue.label,
                                                })}
                                                accentColor={config.accent}
                                            />
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Review Modal */}
            <ReviewModal
                isOpen={!!reviewModal}
                onClose={() => setReviewModal(null)}
                webPid={reviewModal?.webPid || null}
                subcategory={reviewModal?.subcategory || null}
                productName={reviewModal?.productName || ''}
                issueLabel={reviewModal?.issueLabel || ''}
                filters={{
                    date_from: filters?.date_from || undefined,
                    date_to: filters?.date_to || undefined,
                }}
            />
        </>
    );
};

// Issue row — top-level item in the slider, expandable to show SKUs
interface IssueRowProps {
    issue: StakeholderIssue;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
    onViewReviews: (sku: StakeholderIssueSku) => void;
    accentColor: string;
}

const IssueRow = ({ issue, index, isExpanded, onToggle, onViewReviews }: IssueRowProps) => {
    const filteredSkus = issue.skus.filter(sku => sku.negCount > 0);
    
    return (
    <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 24 }}
        className={`rounded-2xl border transition-all duration-300 bg-white dark:bg-slate-800 overflow-hidden ${
            isExpanded 
                ? 'border-indigo-200 dark:border-indigo-500/30 shadow-[0_8px_30px_-12px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/10' 
                : 'border-slate-200/60 dark:border-slate-700/50 hover:border-slate-300 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]'
        }`}
    >
        {/* Issue summary row */}
        <div
            className={`p-4 flex items-center gap-4 cursor-pointer transition-colors duration-300 ${
                isExpanded ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/80'
            }`}
            onClick={onToggle}
        >
            {/* Issue indicator */}
            <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${
                isExpanded 
                    ? 'bg-red-500 text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)]' 
                    : 'bg-red-50 dark:bg-red-900/20 text-red-500 group-hover:bg-red-100'
            }`}>
                <AlertTriangle size={16} className={isExpanded ? "text-white" : "text-red-500"} strokeWidth={isExpanded ? 2.5 : 2} />
                <span className={`text-[10px] font-extrabold leading-tight mt-0.5 ${isExpanded ? "text-white" : "text-red-500"}`}>{issue.negativeCount}</span>
            </div>

            {/* Issue info */}
            <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate tracking-tight">{issue.label}</p>
                <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <Package size={10} className="opacity-70" /> {filteredSkus.length} SKUs
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                        {issue.totalCount.toLocaleString()} total reviews
                    </span>
                </div>
            </div>

            <motion.div 
                animate={{ rotate: isExpanded ? 180 : 0 }} 
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ml-1 transition-colors ${
                    isExpanded ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
            >
                <ChevronDown size={16} strokeWidth={2.5} />
            </motion.div>
        </div>

        {/* Expanded SKU list */}
        <AnimatePresence>
            {isExpanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden border-t border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-slate-900/20"
                >
                    <div className="p-4 space-y-2">
                        {filteredSkus.map((sku, i) => (
                            <motion.div
                                key={sku.web_pid}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03, duration: 0.2 }}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/40 dark:border-slate-700/40 group hover:border-indigo-200 dark:hover:border-indigo-700/50 hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
                                onClick={() => onViewReviews(sku)}
                            >
                                {/* Rating badge */}
                                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center shadow-inner
                                    ${(sku.issue_rating || 0) >= 4.0
                                        ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20 text-emerald-600 border border-emerald-200/50'
                                        : (sku.issue_rating || 0) >= 3.0
                                            ? 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 text-amber-600 border border-amber-200/50'
                                            : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 text-red-600 border border-red-200/50'
                                    }`}
                                    title="Average rating for this issue"
                                >
                                    <Star size={10} className="fill-current mb-0.5 opacity-80" />
                                    <span className="text-[11px] font-extrabold leading-none tracking-tight">{sku.issue_rating?.toFixed(1) || 'N/A'}</span>
                                </div>

                                {/* SKU info */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{sku.product_name}</p>
                                    <div className="flex items-center gap-2.5 mt-1">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-red-500"></span> {sku.negCount} negative reviews
                                        </span>
                                    </div>
                                </div>

                                {/* View reviews button */}
                                <button
                                    className="flex-shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                    title="View reviews"
                                >
                                    <Eye size={14} strokeWidth={2.5} />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </motion.div>
    );
};

export default StakeholderSlider;
