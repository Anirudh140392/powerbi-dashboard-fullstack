/**
 * StakeholderSlider — Slide-in panel showing Issues → SKUs → Reviews for a stakeholder
 * Flow: Click stakeholder card → Slider with issues list → Expand issue → See SKUs → Click SKU → ReviewModal
 */
import { useState } from 'react';
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
        sentiment_category?: string | null;
    };
}

const StakeholderSlider = ({ isOpen, onClose, stakeholderName, filters }: StakeholderSliderProps) => {
    const { data: issues, uniqueSkuCount, loading } = useStakeholderDetail(isOpen ? stakeholderName : null, filters);
    const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
    const [reviewModal, setReviewModal] = useState<{
        webPid: string; subcategory: string; productName: string; issueLabel: string;
    } | null>(null);

    const config = getStakeholderConfig(stakeholderName);
    const IconComponent = config.icon;

    const totalNegative = issues.reduce((s, i) => s + i.negativeCount, 0);
    const totalSkus = uniqueSkuCount;

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
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                                className="absolute right-0 top-0 bottom-0 w-full md:w-[600px] lg:w-[720px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200/50 dark:border-slate-700/50 pointer-events-auto"
                            >
                                {/* Header */}
                                <div className={`px-6 py-5 border-b border-slate-200 dark:border-slate-700/50 bg-gradient-to-r ${config.gradient} flex-shrink-0`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 shadow-sm ${config.accent}`}>
                                                <IconComponent size={22} />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{stakeholderName}</h2>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {issues.length} issues • {totalSkus.toLocaleString()} SKUs • {totalNegative.toLocaleString()} negative reviews
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <X size={20} className="text-slate-500" />
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
                    date_from: filters?.date_from,
                    date_to: filters?.date_to,
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

const IssueRow = ({ issue, index, isExpanded, onToggle, onViewReviews }: IssueRowProps) => (
    <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className="rounded-xl border border-slate-200/60 dark:border-slate-700/50 bg-white dark:bg-slate-800/60 overflow-hidden hover:shadow-md transition-shadow"
    >
        {/* Issue summary row */}
        <div
            className="p-3.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
            onClick={onToggle}
        >
            {/* Issue indicator */}
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-red-50 dark:bg-red-900/20 flex flex-col items-center justify-center">
                <AlertTriangle size={14} className="text-red-500" />
                <span className="text-[9px] font-bold text-red-500 leading-tight">{issue.negativeCount}</span>
            </div>

            {/* Issue info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{issue.label}</p>
                <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Package size={9} /> {issue.skuCount} SKUs
                    </span>
                    <span className="text-[10px] text-slate-400">
                        {issue.totalCount.toLocaleString()} total reviews
                    </span>
                </div>
            </div>

            {/* Negative % pill */}
            <div className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-red-500">
                {((issue.negativeCount / Math.max(issue.totalCount, 1)) * 100).toFixed(0)}% neg
            </div>

            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="flex-shrink-0">
                <ChevronDown size={14} className="text-slate-400" />
            </motion.div>
        </div>

        {/* Expanded SKU list */}
        <AnimatePresence>
            {isExpanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-100 dark:border-slate-700/30"
                >
                    <div className="p-3 space-y-1.5">
                        {issue.skus.map((sku, i) => (
                            <motion.div
                                key={sku.web_pid}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 group hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer"
                                onClick={() => onViewReviews(sku)}
                            >
                                {/* Rating badge */}
                                <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex flex-col items-center justify-center
                                    ${(sku.pdp_rating || 0) >= 4.0
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                                        : (sku.pdp_rating || 0) >= 3.0
                                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                                            : 'bg-red-50 dark:bg-red-900/20 text-red-600'
                                    }`}
                                >
                                    <Star size={8} className="fill-current" />
                                    <span className="text-[10px] font-bold leading-tight">{sku.pdp_rating?.toFixed(1) || 'N/A'}</span>
                                </div>

                                {/* SKU info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{sku.product_name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-red-500 font-semibold">{sku.negCount} neg</span>
                                        <span className="text-[9px] text-slate-400">/ {sku.totalCount} total</span>
                                    </div>
                                </div>

                                {/* View reviews button */}
                                <button
                                    className="flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-500"
                                    title="View reviews"
                                >
                                    <Eye size={13} />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </motion.div>
);

export default StakeholderSlider;
