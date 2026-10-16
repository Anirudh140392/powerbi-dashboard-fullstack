/**
 * AsinIssueModal — Modal showing issue types + RCA for a specific ASIN/product
 * Opens when user clicks an ASIN row in the SKU drill-down table.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Star,
    AlertTriangle,
    ShieldAlert,
    BarChart3,
    ChevronDown,
    ExternalLink,
    Package,
    Loader2,
} from 'lucide-react';
import { useAsinIssues } from '../hooks/useRatingsAPI';
import ReviewModal from './ReviewModal';
import { RatingSummaryInline } from './ui/RatingSummary';
import { createRatingMetrics } from '../utils/ratingMetrics';

interface AsinIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    webPid: string | null;
    apiFilters?: Record<string, string | number | undefined>;
}

const AsinIssueModal: React.FC<AsinIssueModalProps> = ({ isOpen, onClose, webPid, apiFilters }) => {
    const { data, loading } = useAsinIssues(isOpen ? webPid : null, apiFilters);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [reviewModal, setReviewModal] = useState<{ webPid: string; subcategory: string; productName: string } | null>(null);

    // Group issues by issueCategory for hierarchical display
    const groupedIssues = React.useMemo(() => {
        if (!data?.issues) return [];
        const groups: Record<string, typeof data.issues> = {};
        data.issues.forEach(issue => {
            const cat = issue.issueCategory;
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(issue);
        });
        return Object.entries(groups)
            .map(([category, issues]) => ({
                category,
                totalNegative: issues.reduce((s, i) => s + i.negativeCount, 0),
                totalCount: issues.reduce((s, i) => s + i.totalCount, 0),
                issues: issues.filter(i => i.negativeCount > 0).sort((a, b) => b.negativeCount - a.negativeCount),
            }))
            .filter(g => g.totalNegative > 0)
            .sort((a, b) => b.totalNegative - a.totalNegative);
    }, [data]);

    const maxNegative = React.useMemo(() => {
        if (!data?.issues?.length) return 1;
        return Math.max(...data.issues.map(i => i.negativeCount), 1);
    }, [data]);

    // Set first category as expanded by default when data loads
    React.useEffect(() => {
        if (isOpen && groupedIssues.length > 0 && expandedCategory === null) {
            setExpandedCategory(groupedIssues[0].category);
        }
    }, [isOpen, groupedIssues, expandedCategory]);

    // Reset state when modal closes
    React.useEffect(() => {
        if (!isOpen) {
            setExpandedCategory(null);
            setReviewModal(null);
        }
    }, [isOpen]);

    const renderDistributionChart = (dist: Record<string, number> | undefined, textColor: string, barColor: string) => {
        if (!dist) return <div className="text-xs text-center text-slate-400 py-4">No data</div>;
        const total = Object.values(dist).reduce((a, b) => a + (b || 0), 0);
        if (total === 0) return <div className="text-xs text-center text-slate-400 py-4">No data</div>;
        
        return (
            <div className="space-y-1.5">
                {[5, 4, 3, 2, 1].map(star => {
                    const count = dist[star.toString()] || 0;
                    const pct = (count / total) * 100;
                    return (
                        <div key={star} className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-0.5 w-6 shrink-0 font-medium text-slate-500">
                                <span>{star}</span><Star size={8} className={`${textColor} fill-current`} />
                            </div>
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${pct}%` }} 
                                    transition={{ duration: 0.8 }}
                                    className={`h-full ${barColor}`} 
                                />
                            </div>
                            <div className="w-8 shrink-0 text-right text-slate-400 font-mono text-[10px]">{Math.round(pct)}%</div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <>
            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <div key="asin-modal-root" className="fixed inset-0 z-[1500] flex items-center justify-center p-4 pointer-events-none">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm pointer-events-auto"
                                onClick={onClose}
                            />
                            {/* Modal */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92, y: 30 }}
                                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                                className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/60 dark:border-slate-700/60 pointer-events-auto"
                            >
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 dark:from-slate-800/50 to-transparent shrink-0">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <ShieldAlert size={18} className="text-indigo-500 shrink-0" />
                                            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                                                Issue Analysis
                                            </h2>
                                        </div>
                                        {data && (
                                            <p className="text-sm text-slate-600 dark:text-slate-300 truncate mt-1">
                                                {data.productName}
                                            </p>
                                        )}
                                        {data && (
                                            <div className="mt-2 flex items-center gap-3 flex-wrap">
                                                <RatingSummaryInline
                                                    metrics={createRatingMetrics({
                                                        pdp_rating: data.pdpRating,
                                                        user_rating: data.userRating ?? null,
                                                        ml_rating: data.mlRating ?? null,
                                                        review_count: data.totalReviews,
                                                        rating_count: data.ratingCount,
                                                    })}
                                                    title={data.productName}
                                                />
                                                <a href={`https://www.amazon.in/dp/${data.webPid}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-500 px-2 py-0.5 rounded-full font-mono transition-colors">
                                                    {data.webPid} <ExternalLink size={10} />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                                    >
                                        <X size={18} className="text-slate-500" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                            <Loader2 size={28} className="text-indigo-500" />
                                        </motion.div>
                                        <p className="text-sm text-slate-400">Analyzing issues...</p>
                                    </div>
                                ) : !data || data.issues.length === 0 ? (
                                    <div className="text-center py-20 text-slate-400">
                                        <Package size={40} className="mx-auto mb-3 opacity-40" />
                                        <p className="text-sm">No classified issues for this product</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Fake Review / Discrepancy Flag */}
                                        {data.discrepancyFlag && (
                                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 p-3 rounded-r-lg flex items-start gap-3">
                                                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="text-sm font-bold text-red-800 dark:text-red-400">Potential Manipulation Detected - High Discrepancy</h4>
                                                    <p className="text-xs text-red-600 dark:text-red-300">Platform ratings are artificially elevated compared to AI-analyzed review sentiment. Proceed with caution.</p>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Reality Gap Analyis UI */}
                                        {(data.platformDistribution || data.aiDistribution) && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 bg-white dark:bg-slate-800/40 p-4 border border-slate-200/60 dark:border-slate-700/40 rounded-xl">
                                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                                                    Reality Gap Analysis
                                                </h3>
                                                <div className="grid grid-cols-2 gap-6">
                                                    {/* Platform Chart */}
                                                    <div>
                                                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 text-center">PDP Rating Distribution</h4>
                                                        {renderDistributionChart(data.platformDistribution, 'text-amber-500', 'bg-gradient-to-r from-amber-400 to-amber-500')}
                                                    </div>
                                                    {/* AI Chart */}
                                                    <div>
                            <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 text-center">User Rating Distribution</h4>
                                                        {renderDistributionChart(data.aiDistribution, 'text-indigo-500', 'bg-gradient-to-r from-indigo-400 to-indigo-500')}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Issue Category Groups */}
                                        {groupedIssues.map((group, gIdx) => (
                                            <motion.div
                                                key={group.category}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: gIdx * 0.06 }}
                                                className="border border-slate-200/60 dark:border-slate-700/40 rounded-xl overflow-hidden"
                                            >
                                                {/* Category header */}
                                                <button
                                                    onClick={() => setExpandedCategory(expandedCategory === group.category ? null : group.category)}
                                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <BarChart3 size={14} className="text-indigo-500" />
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                            {group.category}
                                                        </span>
                                                        <span className="text-[10px] bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-semibold">
                                                            {group.totalNegative} negative
                                                        </span>
                                                    </div>
                                                    <motion.div animate={{ rotate: expandedCategory === group.category ? 180 : 0 }}>
                                                        <ChevronDown size={14} className="text-slate-400" />
                                                    </motion.div>
                                                </button>

                                                {/* Issue rows */}
                                                <AnimatePresence initial={false}>
                                                    {expandedCategory === group.category && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                                {group.issues.map((issue, iIdx) => (
                                                                    <motion.div
                                                                        key={`${issue.issueTypeRaw}-${issue.rca}`}
                                                                        initial={{ opacity: 0 }}
                                                                        animate={{ opacity: 1 }}
                                                                        transition={{ delay: iIdx * 0.03 }}
                                                                        onClick={() => {
                                                                            if (data && issue.issueTypeRaw) {
                                                                                setReviewModal({
                                                                                    webPid: data.webPid,
                                                                                    subcategory: issue.issueTypeRaw,
                                                                                    productName: data.productName,
                                                                                });
                                                                            }
                                                                        }}
                                                                        className="px-4 py-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors group/row"
                                                                    >
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                                                        {issue.issueType}
                                                                                    </span>
                                                                                    {issue.rca && issue.rca !== 'Not classified' && (
                                                                                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                                                                                            RCA: {issue.rca}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                {/* Bar visualization */}
                                                                                <div className="mt-1.5 flex items-center gap-2">
                                                                                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                                        <div className="h-full flex rounded-full overflow-hidden">
                                                                                            <motion.div
                                                                                                initial={{ width: 0 }}
                                                                                                animate={{ width: `${(issue.negativeCount / maxNegative) * 100}%` }}
                                                                                                transition={{ duration: 0.6, delay: iIdx * 0.03 }}
                                                                                                className="bg-gradient-to-r from-red-400 to-red-500"
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                                        <span className="text-xs font-semibold text-red-500">
                                                                                            {issue.negativeCount}
                                                                                        </span>
                                                                                        <span className="text-[10px] text-slate-400">
                                                                                            / {group.totalNegative}
                                                                                        </span>
                                                                                        <span className="text-[10px] text-slate-400">
                                                                                            ({group.totalNegative > 0 ? Math.round((issue.negativeCount / group.totalNegative) * 100) : 0}%)
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Rating + view hint */}
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                <span className="flex items-center gap-0.5 text-xs">
                                                                                    <Star size={10} className={`${issue.avgRating >= 4.0 ? 'fill-amber-400 text-amber-400' : issue.avgRating < 3.0 ? 'fill-red-400 text-red-400' : 'fill-slate-400 text-slate-400'}`} />
                                                                                    <span className="text-slate-500">{issue.avgRating.toFixed(1)}</span>
                                                                                </span>
                                                                                <div className="opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-0.5 text-indigo-500">
                                                                                    <span className="text-[9px] font-medium">Reviews</span>
                                                                                    <ExternalLink size={10} />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer summary */}
                            {data && data.issues.length > 0 && (
                                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span>
                                            {data.issues.length} issue types across {groupedIssues.length} categories
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <AlertTriangle size={10} className="text-red-400" />
                                            {data.issues.reduce((s, i) => s + i.negativeCount, 0)} total negative mentions
                                        </span>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>,
            document.body
        )}

            {/* Nested Review Modal */}
            {reviewModal && (
                <ReviewModal
                    isOpen={!!reviewModal}
                    onClose={() => setReviewModal(null)}
                    webPid={reviewModal.webPid}
                    subcategory={reviewModal.subcategory}
                    productName={reviewModal.productName}
                    filters={apiFilters}
                />
            )}
        </>
    );
};

export default AsinIssueModal;
