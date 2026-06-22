import React, { useMemo } from 'react';
import { TrendingUp, AlertTriangle, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Review } from '../types';

interface InsightsPanelProps {
    reviews: Review[];
    onCharacteristicClick?: (characteristic: string) => void;
}

interface CharacteristicInsight {
    characteristic: string;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
    score: number;
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({ reviews, onCharacteristicClick }) => {
    const insights = useMemo(() => {
        const charMap: Record<string, { positive: number; negative: number; neutral: number }> = {};

        reviews.forEach((review) => {
            // Use sentimentCategory (8-category classification) instead of characteristics
            const category = review.sentimentCategory || 'General';
            const key = category.toLowerCase().trim();

            if (!charMap[key]) {
                charMap[key] = { positive: 0, negative: 0, neutral: 0 };
            }

            const sentiment = review.sentiment?.toUpperCase() === 'POSITIVE' ? 'Positive' :
                review.sentiment?.toUpperCase() === 'NEGATIVE' ? 'Negative' : 'Neutral';

            if (sentiment === 'Positive') charMap[key].positive++;
            else if (sentiment === 'Negative') charMap[key].negative++;
            else charMap[key].neutral++;
        });

        const all: CharacteristicInsight[] = Object.entries(charMap)
            .filter(([, counts]) => counts.positive + counts.negative + counts.neutral >= 10)
            .map(([characteristic, counts]) => {
                const total = counts.positive + counts.negative + counts.neutral;
                const score = total > 0 ? counts.negative / total : 0;
                return { characteristic, ...counts, total, score };
            });

        const painPoints = [...all]
            .filter(c => c.negative >= 5)
            .sort((a, b) => b.score - a.score || b.negative - a.negative)
            .slice(0, 5);

        const strengths = [...all]
            .filter(c => c.positive >= 5)
            .sort((a, b) => (b.positive / b.total) - (a.positive / a.total) || b.positive - a.positive)
            .slice(0, 5);

        const trending = [...all]
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        return { painPoints, strengths, trending };
    }, [reviews]);

    const handleClick = (characteristic: string) => {
        if (onCharacteristicClick) {
            onCharacteristicClick(characteristic);
        }
    };

    const itemClassName = onCharacteristicClick
        ? "flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 -mx-2 rounded-lg transition-colors"
        : "flex items-center justify-between group";

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pain Points */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card p-5 border-l-4 border-red-500"
            >
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg">
                        <AlertTriangle className="text-red-500" size={20} />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">🔴 Pain Points</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">Characteristics with highest negative sentiment</p>
                <ul className="space-y-3">
                    {insights.painPoints.length === 0 ? (
                        <li className="text-sm text-slate-400">No significant pain points found</li>
                    ) : (
                        insights.painPoints.map((item, i) => (
                            <li
                                key={item.characteristic}
                                className={itemClassName}
                                onClick={() => handleClick(item.characteristic)}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-red-500 w-5">{i + 1}.</span>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize truncate max-w-[120px]">
                                        {item.characteristic}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                                        {item.negative} bad
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {(item.score * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </motion.div>

            {/* Strengths */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card p-5 border-l-4 border-green-500"
            >
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg">
                        <ThumbsUp className="text-green-500" size={20} />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">🟢 Strengths</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">Characteristics with highest positive sentiment</p>
                <ul className="space-y-3">
                    {insights.strengths.length === 0 ? (
                        <li className="text-sm text-slate-400">No significant strengths found</li>
                    ) : (
                        insights.strengths.map((item, i) => {
                            const positiveRate = item.total > 0 ? item.positive / item.total : 0;
                            return (
                                <li
                                    key={item.characteristic}
                                    className={itemClassName}
                                    onClick={() => handleClick(item.characteristic)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-green-500 w-5">{i + 1}.</span>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize truncate max-w-[120px]">
                                            {item.characteristic}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                                            {item.positive} good
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {(positiveRate * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </li>
                            );
                        })
                    )}
                </ul>
            </motion.div>

            {/* Trending / Most Discussed */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card p-5 border-l-4 border-indigo-500"
            >
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
                        <TrendingUp className="text-indigo-500" size={20} />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">📊 Most Discussed</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">Characteristics with highest mention count</p>
                <ul className="space-y-3">
                    {insights.trending.length === 0 ? (
                        <li className="text-sm text-slate-400">No data available</li>
                    ) : (
                        insights.trending.map((item, i) => (
                            <li
                                key={item.characteristic}
                                className={itemClassName}
                                onClick={() => handleClick(item.characteristic)}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-indigo-500 w-5">{i + 1}.</span>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize truncate max-w-[120px]">
                                        {item.characteristic}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="flex items-center gap-1 text-green-500">
                                        <ThumbsUp size={12} /> {item.positive}
                                    </span>
                                    <span className="flex items-center gap-1 text-red-500">
                                        <ThumbsDown size={12} /> {item.negative}
                                    </span>
                                    <span className="flex items-center gap-1 text-slate-400">
                                        <Minus size={12} /> {item.neutral}
                                    </span>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </motion.div>
        </div>
    );
};

export default InsightsPanel;
