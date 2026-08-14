/**
 * ReviewModal — Shows actual reviews for a specific issue + SKU
 * Opens as a modal overlay with review list, ratings, sentiment coloring
 * Default sort: rating_asc (lowest first) with toggleable sort
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, ShieldCheck, MessageSquare, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { useReviewsByIssue, type IssueReview } from '../hooks/useRatingsAPI';

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    webPid: string | null;
    subcategory: string | null;
    productName: string;
    issueLabel?: string;
    filters?: Record<string, string | number | undefined>;
}

type ReviewSort = 'rating_asc' | 'rating_desc' | 'date';

const sortOptions: { key: ReviewSort; label: string }[] = [
    { key: 'rating_asc', label: 'Rating ↑' },
    { key: 'rating_desc', label: 'Rating ↓' },
    { key: 'date', label: 'Latest' },
];

const sentimentColors: Record<string, string> = {
    Positive: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
    Negative: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    Neutral: 'text-slate-500 bg-slate-50 dark:bg-slate-800 dark:text-slate-400',
};

const StarRating = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
            <Star
                key={i}
                size={12}
                className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}
            />
        ))}
        <span className="text-xs font-semibold ml-1 text-slate-600 dark:text-slate-400">{rating}</span>
    </div>
);

const ReviewCard = ({ review }: { review: IssueReview }) => {
    const [expanded, setExpanded] = useState(false);

    const text = review.review_text || '';
    const isLong = text.length > 200;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50 hover:shadow-md transition-shadow"
        >
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} />
                    {review.is_verified_purchase && (
                        <div className="flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full">
                            <ShieldCheck size={10} /> Verified
                        </div>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sentimentColors[review.sentiment] || sentimentColors.Neutral}`}>
                        {review.sentiment}
                    </span>
                </div>
                <div className="text-[10px] text-slate-400">
                    {review.review_date ? new Date(review.review_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                    {review.reviewer_name && <span className="ml-2">by {review.reviewer_name}</span>}
                </div>
            </div>

            {review.review_title && (
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">{review.review_title}</p>
            )}

            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isLong && !expanded ? text.slice(0, 200) + '...' : text}
            </p>

            {isLong && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-xs text-indigo-500 hover:text-indigo-600 mt-1 font-medium"
                >
                    {expanded ? 'Show less' : 'Read more'}
                </button>
            )}

            {review.specific_issue && (
                <div className="mt-2 flex items-center gap-1">
                    <MessageSquare size={10} className="text-amber-500" />
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{review.specific_issue}</span>
                </div>
            )}
            
            {/* The legacy DeBERTa "AI Re-Classification" banner was removed here: it
                only surfaced ml_sentiment / ml_issue suggestions, which are now owned
                by the in-house SetFit + gold-star sentiment and are NOT applied by
                /ml-audit/approve — so its "Accept Change" was both wrong (e.g.
                Negative→Neutral on a clearly negative review) and a no-op. Legitimate
                category/material/wattage/rating audits still live in the AI-QC Tracker. */}

        </motion.div>
    );
};

const ReviewModal = ({ isOpen, onClose, webPid, subcategory, productName, issueLabel, filters }: ReviewModalProps) => {
    const [sortKey, setSortKey] = useState<ReviewSort>('rating_asc');
    const apiSort = sortKey === 'date' ? undefined : sortKey;
    const { data: reviews, total, loading } = useReviewsByIssue(
        isOpen ? webPid : null, 
        isOpen ? subcategory : null, 
        apiSort,
        filters
    );
    const [page, setPage] = useState(0);
    const perPage = 50;

    // Keyboard: Escape to close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    return (
        <>
            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <div key="review-modal-root" className="fixed inset-0 z-[1600] pointer-events-none">
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
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                                className="absolute inset-4 md:inset-x-[10%] md:inset-y-[5%] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/50 dark:border-slate-700/50 pointer-events-auto"
                            >
                                {/* Header */}
                                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 bg-gradient-to-r from-slate-50 dark:from-slate-800/50 to-transparent flex-shrink-0">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{issueLabel || subcategory?.replace(/_/g, ' ')}</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xl">{productName}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Sort toggle */}
                                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-1.5 py-0.5">
                                                <ArrowUpDown size={11} className="text-slate-400" />
                                                {sortOptions.map(s => (
                                                    <button
                                                        key={s.key}
                                                        onClick={() => { setSortKey(s.key); setPage(0); }}
                                                        className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${sortKey === s.key
                                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                                            }`}
                                                    >
                                                        {s.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                                {total} reviews
                                            </span>
                                            <button
                                                onClick={onClose}
                                                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                <X size={18} className="text-slate-500" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {loading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                <span className="text-sm text-slate-400">Loading reviews...</span>
                                            </div>
                                        </div>
                                    ) : reviews.length === 0 ? (
                                        <div className="text-center py-20 text-slate-400">
                                            No reviews found for this issue
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {reviews.map((review) => (
                                                <ReviewCard key={review.id} review={review} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer pagination */}
                                {total > perPage && (
                                    <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between flex-shrink-0">
                                        <span className="text-xs text-slate-400">
                                            Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, total)} of {total}
                                        </span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                                disabled={page === 0}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:bg-slate-800 disabled:opacity-30 transition-colors"
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                            <button
                                                onClick={() => setPage(p => p + 1)}
                                                disabled={(page + 1) * perPage >= total}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:bg-slate-800 disabled:opacity-30 transition-colors"
                                            >
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

export default ReviewModal;
