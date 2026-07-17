import React, { useState } from 'react';
import { MessageSquare, TrendingUp, TrendingDown, ChevronRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CompetitorMention } from '../types';
import { useCompetitorMentions } from '../hooks/useCompetitorMentions';

interface VerbatimMentionsCardProps {
    // Kept for backwards compatibility — server-side scanner now reads from
    // ratings.competitor_mentions, not the rendered review slice.
    reviews?: unknown[];
    onMentionClick?: (mention: CompetitorMention) => void;
    maxMentions?: number;
    /** Optional filters (forwarded to the server endpoint) */
    platform?: string;
    dateFrom?: string;
    dateTo?: string;
}

const VerbatimMentionsCard: React.FC<VerbatimMentionsCardProps> = ({
    onMentionClick,
    maxMentions = 5,
    platform,
    dateFrom,
    dateTo,
}) => {
    const [showAll, setShowAll] = useState(false);
    const { data, loading, error } = useCompetitorMentions({
        platform, dateFrom, dateTo,
        limit: 200,
    });

    const mentions = data?.sample ?? [];
    const topBrands = (data?.byBrand ?? []).slice(0, 5);
    const total = data?.total ?? 0;

    const displayedMentions = showAll ? mentions : mentions.slice(0, maxMentions);

    const getSentimentColor = (sentiment: string) => {
        switch (sentiment) {
            case 'Positive': return 'text-green-500 bg-green-100 dark:bg-green-500/20';
            case 'Negative': return 'text-red-500 bg-red-100 dark:bg-red-500/20';
            default: return 'text-slate-500 bg-slate-100 dark:bg-slate-500/20';
        }
    };

    const getFavorableIndicator = (isFavorable: boolean) =>
        isFavorable ? <TrendingUp className="text-green-500" size={14} /> : <TrendingDown className="text-red-500" size={14} />;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-5 border-l-4 border-purple-500"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
                        <MessageSquare className="text-purple-500" size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">🎯 Competitor Mentions</h3>
                        <p className="text-xs text-slate-500">Brands mentioned across all reviews (server-side scan)</p>
                    </div>
                </div>
                <span className="text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-600 px-2 py-1 rounded-full">
                    {loading ? '…' : `${total.toLocaleString()} mentions`}
                </span>
            </div>

            {error && (
                <p className="text-xs text-red-500 mb-3">Failed to load mentions: {error}</p>
            )}

            {topBrands.length > 0 && (
                <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-2">
                    {topBrands.map(b => (
                        <div key={b.brand} className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{b.brand}</p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                                <span className="text-lg font-bold text-purple-600">{b.total}</span>
                                {b.favorableRate > 0.5 ? (
                                    <TrendingUp className="text-green-500" size={12} />
                                ) : b.favorableRate < 0.5 && b.total > 1 ? (
                                    <TrendingDown className="text-red-500" size={12} />
                                ) : null}
                            </div>
                            <p className="text-xs text-slate-400">{Math.round(b.favorableRate * 100)}% favorable</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="space-y-3">
                <AnimatePresence>
                    {loading ? (
                        <p className="text-sm text-slate-400">Loading…</p>
                    ) : displayedMentions.length === 0 ? (
                        <p className="text-sm text-slate-400">No competitor mentions detected for this scope</p>
                    ) : (
                        displayedMentions.map((mention, idx) => (
                            <motion.div
                                key={mention.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ delay: idx * 0.05 }}
                                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                                onClick={() => onMentionClick?.({
                                    brand: mention.brand,
                                    context: mention.context,
                                    sentiment: mention.sentiment,
                                    reviewId: mention.reviewId,
                                    reviewText: mention.context,
                                    reviewDate: mention.reviewDate ?? '',
                                    isFavorable: mention.isFavorable,
                                })}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-purple-600 dark:text-purple-400">
                                                {mention.brand}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${getSentimentColor(mention.sentiment)}`}>
                                                {mention.sentiment}
                                            </span>
                                            {getFavorableIndicator(mention.isFavorable)}
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                            "{mention.context}"
                                        </p>
                                        {mention.reviewDate && (
                                            <p className="text-xs text-slate-400 mt-1">
                                                {new Date(mention.reviewDate).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight className="text-slate-400 shrink-0" size={16} />
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {mentions.length > maxMentions && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="mt-4 w-full py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                    {showAll ? 'Show Less' : `Show All ${mentions.length} Mentions`}
                    <ExternalLink size={14} />
                </button>
            )}
        </motion.div>
    );
};

export default VerbatimMentionsCard;
