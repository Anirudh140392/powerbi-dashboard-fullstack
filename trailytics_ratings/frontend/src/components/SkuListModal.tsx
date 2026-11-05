/**
 * SkuListModal — Premium modal for SKU list drill-down
 * Replaces the inline SKU table for better performance.
 * Flow: NP/Issue/NI card click → SkuListModal → AsinIssueModal → ReviewModal
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Star,
    Search,
    TrendingUp,
    TrendingDown,
    ArrowUpDown,
    Package,
    ExternalLink,
    BarChart3,
} from 'lucide-react';
import type { HealthSku } from '../hooks/useRatingsAPI';
import AsinIssueModal from './AsinIssueModal';
import { RatingSummaryInline } from './ui/RatingSummary';
import { createRatingMetrics } from '../utils/ratingMetrics';

type SkuSort = 'latest' | 'rating_desc' | 'rating_asc' | 'trend_down' | 'count_desc';

interface SkuListModalProps {
    isOpen: boolean;
    onClose: () => void;
    skus: HealthSku[];
    bucketLabel: string;     // e.g. "Pareto"
    statusLabel: string;     // e.g. "Issue"
    statusColor: string;     // e.g. "red"
    totalRatings: number;
    avgPlatformRating: number | null;
    positiveRate: number;
    apiFilters?: Record<string, string | number | undefined>;
}

const SORT_OPTIONS: { key: SkuSort; label: string }[] = [
    { key: 'latest', label: 'Latest' },
    { key: 'rating_asc', label: 'Rating ↑' },
    { key: 'rating_desc', label: 'Rating ↓' },
    { key: 'trend_down', label: 'Trend ↓' },
    { key: 'count_desc', label: 'Count ↓' },
];

const PAGE_SIZE = 30;

const SkuListModal: React.FC<SkuListModalProps> = ({
    isOpen,
    onClose,
    skus,
    bucketLabel,
    statusLabel,
    statusColor,
    totalRatings,
    avgPlatformRating,
    positiveRate,
    apiFilters,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState<SkuSort>('latest');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [asinModalWebPid, setAsinModalWebPid] = useState<string | null>(null);

    // Reset state when modal opens (deferred to avoid sync-setState-in-effect lint)
    useEffect(() => {
        if (!isOpen) return;
        const raf = requestAnimationFrame(() => {
            setSearchQuery('');
            setSortKey('latest');
            setVisibleCount(PAGE_SIZE);
        });
        return () => cancelAnimationFrame(raf);
    }, [isOpen]);

    // Keyboard: Escape to close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !asinModalWebPid) onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, asinModalWebPid, onClose]);

    // Filter + sort
    const filteredSkus = useMemo(() => {
        let result = skus;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = skus.filter(
                s =>
                    s.product_name.toLowerCase().includes(q) ||
                    s.web_pid.toLowerCase().includes(q) ||
                    (s.category || '').toLowerCase().includes(q)
            );
        }
        return [...result].sort((a, b) => {
            switch (sortKey) {
                case 'latest': {
                    const dA = a.latest_review_date ? new Date(a.latest_review_date).getTime() : 0;
                    const dB = b.latest_review_date ? new Date(b.latest_review_date).getTime() : 0;
                    return dB - dA;
                }
                case 'rating_desc':
                    return (b.pdp_rating ?? 0) - (a.pdp_rating ?? 0);
                case 'rating_asc':
                    return (a.pdp_rating ?? 0) - (b.pdp_rating ?? 0);
                case 'trend_down': {
                    const order: Record<string, number> = { down: 0, stable: 1, up: 2 };
                    return (order[a.trend_direction] ?? 1) - (order[b.trend_direction] ?? 1);
                }
                case 'count_desc':
                    if (b.rating_count === a.rating_count) {
                        return b.total_reviews - a.total_reviews;
                    }
                    return b.rating_count - a.rating_count;
                default:
                    return 0;
            }
        });
    }, [skus, searchQuery, sortKey]);

    const visibleSkus = filteredSkus.slice(0, visibleCount);
    const hasMore = visibleCount < filteredSkus.length;

    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 200 && hasMore) {
                setVisibleCount(prev => prev + PAGE_SIZE);
            }
        },
        [hasMore]
    );

    // Rating distribution mini-bar
    const ratingStats = useMemo(() => {
        const np = skus.filter(s => s.pdp_rating !== null && s.pdp_rating >= 4.2).length;
        const ni = skus.filter(s => s.pdp_rating !== null && s.pdp_rating >= 4.0 && s.pdp_rating < 4.2).length;
        const issue = skus.filter(s => s.pdp_rating !== null && s.pdp_rating < 4.0).length;
        const noRating = skus.filter(s => s.pdp_rating === null).length;
        const total = skus.length || 1;
        return { np, ni, issue, noRating, total, npPct: (np / total) * 100, niPct: (ni / total) * 100, issuePct: (issue / total) * 100 };
    }, [skus]);

    const totalReviewCount = useMemo(
        () => skus.reduce((sum, sku) => sum + sku.total_reviews, 0),
        [skus]
    );

    const avgReviewRating = useMemo(() => {
        const weighted = skus.reduce((sum, sku) => {
            if (sku.recent_avg_rating === null || sku.recent_avg_rating === undefined || sku.total_reviews <= 0) {
                return sum;
            }
            return sum + (sku.recent_avg_rating * sku.total_reviews);
        }, 0);

        return totalReviewCount > 0 ? weighted / totalReviewCount : 0;
    }, [skus, totalReviewCount]);

    const avgMlRating = useMemo(() => {
        const weighted = skus.reduce((sum, sku) => {
            if (sku.ml_rating === null || sku.ml_rating === undefined || sku.total_reviews <= 0) {
                return sum;
            }
            return sum + (sku.ml_rating * sku.total_reviews);
        }, 0);

        return totalReviewCount > 0 ? weighted / totalReviewCount : 0;
    }, [skus, totalReviewCount]);

    return (
        <>
            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <div key="skulist-modal-root" className="fixed inset-0 z-[1400] flex items-center justify-center p-4 pointer-events-none">
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
                                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.94, y: 20 }}
                                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                                className="relative w-full max-w-4xl max-h-[88vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/60 dark:border-slate-700/60 pointer-events-auto"
                            >
                            {/* ===== HEADER ===== */}
                            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 dark:from-slate-800/50 to-transparent shrink-0">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 mb-1">
                                            <Package size={18} className="text-indigo-500 shrink-0" />
                                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                                {bucketLabel} — {statusLabel}
                                            </h2>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-${statusColor}-100 dark:bg-${statusColor}-900/20 text-${statusColor}-600 dark:text-${statusColor}-400`}>
                                                {skus.length} SKUs
                                            </span>
                                        </div>

                                        {/* KPI badges */}
                                        <RatingSummaryInline
                                            className="mt-2"
                                            metrics={createRatingMetrics({
                                                pdp_rating: avgPlatformRating,
                                                user_rating: avgReviewRating || null,
                                                ml_rating: avgMlRating || null,
                                                review_count: totalReviewCount,
                                                rating_count: totalRatings,
                                            })}
                                            compact={false}
                                            title={`${bucketLabel} ${statusLabel}`}
                                        />
                                        {positiveRate > 0 && (
                                            <div className="flex items-center gap-1 text-xs text-emerald-500 font-medium mt-2">
                                                <TrendingUp size={11} />
                                                {positiveRate}% above 4.0
                                            </div>
                                        )}

                                        {/* Rating distribution bar */}
                                        <div className="flex items-center gap-2 mt-2.5">
                                            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                                {ratingStats.npPct > 0 && (
                                                    <div className="h-full bg-emerald-400" style={{ width: `${ratingStats.npPct}%` }} title={`NP: ${ratingStats.np}`} />
                                                )}
                                                {ratingStats.niPct > 0 && (
                                                    <div className="h-full bg-blue-400" style={{ width: `${ratingStats.niPct}%` }} title={`NI: ${ratingStats.ni}`} />
                                                )}
                                                {ratingStats.issuePct > 0 && (
                                                    <div className="h-full bg-red-400" style={{ width: `${ratingStats.issuePct}%` }} title={`Issue: ${ratingStats.issue}`} />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[9px] text-slate-400 shrink-0">
                                                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> NP:{ratingStats.np}</span>
                                                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> NI:{ratingStats.ni}</span>
                                                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Issue:{ratingStats.issue}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                                    >
                                        <X size={18} className="text-slate-500" />
                                    </button>
                                </div>

                                {/* Search + Sort row */}
                                <div className="flex items-center gap-3 mt-3 flex-wrap">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by product name, ASIN, or category..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 dark:focus:border-indigo-500 text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <ArrowUpDown size={12} className="text-slate-400" />
                                        {SORT_OPTIONS.map(s => (
                                            <button
                                                key={s.key}
                                                onClick={() => setSortKey(s.key)}
                                                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${sortKey === s.key
                                                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ===== BODY: Table with infinite scroll ===== */}
                            <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
                                {filteredSkus.length === 0 ? (
                                    <div className="text-center py-20 text-slate-400">
                                        <Search size={36} className="mx-auto mb-3 opacity-40" />
                                        <p className="text-sm">No SKUs match your search</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                                <th className="text-left py-2.5 px-4 font-semibold text-slate-500 dark:text-slate-400">Product</th>
                                                <th className="text-center py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400" title="Platform listing rating (scraped from PDP)">PDP Rating</th>
                                                <th className="text-center py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400" title="Average of review ratings for the selected period">User Rating</th>
                                                <th className="text-center py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Rating Count</th>
                                                <th className="text-center py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Review Count</th>
                                                <th className="text-center py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Trend</th>
                                                <th className="text-left py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Category</th>
                                                <th className="text-center py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Link</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleSkus.map((sku, idx) => (
                                                <motion.tr
                                                    key={sku.web_pid}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: Math.min(idx * 0.015, 0.3) }}
                                                    onClick={() => setAsinModalWebPid(sku.web_pid)}
                                                    className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors group/sku"
                                                >
                                                    <td className="py-2.5 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <span 
                                                                className="font-medium text-slate-700 dark:text-slate-300 truncate block max-w-[260px]"
                                                                title={sku.product_name}
                                                            >
                                                                {sku.product_name}
                                                            </span>
                                                            <span className="opacity-0 group-hover/sku:opacity-100 transition-opacity text-[9px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-medium shrink-0 flex items-center gap-0.5">
                                                                Issues & RCA <ExternalLink size={8} />
                                                            </span>
                                                        </div>
                                                        {sku.latest_review_date && (
                                                            <span className="text-[9px] text-slate-400 mt-0.5 block">
                                                                Last review: {new Date(sku.latest_review_date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </td>
                                                    {/* Dual Rating: PDP (listing) */}
                                                    <td className="py-2.5 px-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Star
                                                                size={10}
                                                                className={`${(sku.pdp_rating ?? 0) >= 4.2
                                                                    ? 'text-amber-400 fill-amber-400'
                                                                    : (sku.pdp_rating ?? 0) < 4.0
                                                                        ? 'text-red-400 fill-red-400'
                                                                        : 'text-slate-400 fill-slate-400'
                                                                    }`}
                                                            />
                                                            <span
                                                                className={`font-bold ${(sku.pdp_rating ?? 0) >= 4.2
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : (sku.pdp_rating ?? 0) < 4.0
                                                                        ? 'text-red-600 dark:text-red-400'
                                                                        : 'text-slate-600 dark:text-slate-400'
                                                                    }`}
                                                            >
                                                                {sku.pdp_rating?.toFixed(1) ?? 'N/A'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    {/* Dual Rating: Review avg (computed) */}
                                                    <td className="py-2.5 px-3 text-center">
                                                        <span className={`font-semibold text-[11px] ${
                                                            sku.recent_avg_rating !== null
                                                                ? sku.recent_avg_rating >= 4.0
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : 'text-red-600 dark:text-red-400'
                                                                : 'text-slate-400'
                                                        }`}>
                                                            {sku.recent_avg_rating?.toFixed(2) ?? '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center font-medium text-slate-600 dark:text-slate-400">
                                                        {sku.rating_count.toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center font-medium text-slate-600 dark:text-slate-400">
                                                        {sku.total_reviews.toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        {sku.trend_direction === 'up' && (
                                                            <span className="inline-flex items-center gap-0.5 text-emerald-500 font-semibold">
                                                                <TrendingUp size={12} /> Up
                                                            </span>
                                                        )}
                                                        {sku.trend_direction === 'down' && (
                                                            <span className="inline-flex items-center gap-0.5 text-red-500 font-semibold">
                                                                <TrendingDown size={12} /> Down
                                                            </span>
                                                        )}
                                                        {sku.trend_direction === 'stable' && (
                                                            <span className="text-slate-400">Stable</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                                                        {sku.category}
                                                    </td>
                                                    {/* External CTA link */}
                                                    <td className="py-2.5 px-3 text-center">
                                                        <a
                                                            href={`https://www.amazon.in/dp/${sku.web_pid}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="inline-flex items-center gap-0.5 text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                                                            title="Open on Amazon"
                                                        >
                                                            <ExternalLink size={12} />
                                                        </a>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                                {hasMore && (
                                    <div className="flex justify-center py-4">
                                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>

                            {/* ===== FOOTER ===== */}
                            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
                                <div className="flex items-center justify-between text-xs text-slate-400">
                                    <span className="flex items-center gap-2">
                                        <BarChart3 size={12} />
                                        {filteredSkus.length !== skus.length
                                            ? `${filteredSkus.length} of ${skus.length} SKUs`
                                            : `${skus.length} SKUs`
                                        }
                                        {totalRatings > 0 && (
                                            <span className="ml-1">· {totalRatings.toLocaleString()} total ratings</span>
                                        )}
                                    </span>
                                    <span className="text-[10px]">
                                        Click any row to view Issues & RCA
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>,
            document.body
        )}

            {/* Nested: ASIN Issue Modal */}
            {asinModalWebPid && (
                <AsinIssueModal
                    isOpen={!!asinModalWebPid}
                    onClose={() => setAsinModalWebPid(null)}
                    webPid={asinModalWebPid}
                    apiFilters={apiFilters}
                />
            )}
        </>
    );
};

export default SkuListModal;
