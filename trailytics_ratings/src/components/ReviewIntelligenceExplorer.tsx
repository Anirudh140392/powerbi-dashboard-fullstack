/**
 * ReviewIntelligenceExplorer — Premium Review Tab
 * 
 * Features:
 * 1. AI Summary Strip — auto-generated insights at the top
 * 2. Review Timeline Heatmap — GitHub-style contribution map
 * 3. Quick Filter Chips — one-tap sentiment/category filters
 * 4. Smart Search — full-text search with highlighted results
 * 5. Review Wall — cards with sentiment glow borders
 * 6. Interactive Word Cloud — animated bubble keywords
 * 7. Competitor Comparison Toggle
 * 8. Voice of Customer Summary
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Star, Flame, CheckCircle,
    Package, TrendingUp, TrendingDown,
    X,
    ThumbsUp, ThumbsDown, Hash, Sparkles,
    GitCompareArrows, Calendar, ArrowRight
} from 'lucide-react';
import type { Review } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface Props {
    reviews: Review[];
    competitorReviews?: Array<{
        date: string; brand?: string; rating: number; sentiment?: string;
        sentimentCategory?: string; subcategory?: string; product?: string;
        productName?: string; text?: string;
    }>;
}

type QuickFilter =
    | 'all' | '1star' | '2star' | '3star' | '4star' | '5star'
    | 'positive' | 'negative' | 'neutral'
    | 'quality' | 'performance' | 'value' | 'delivery';

interface InsightCard {
    icon: React.ReactNode;
    text: string;
    type: 'positive' | 'negative' | 'neutral' | 'info';
}

// ============================================================================
// FILTER CHIP CONFIG
// ============================================================================

const QUICK_FILTERS: { key: QuickFilter; label: string; group: string }[] = [
    { key: 'all', label: 'All Reviews', group: 'general' },
    { key: 'positive', label: '✅ Happy', group: 'sentiment' },
    { key: 'negative', label: '🔥 Issues', group: 'sentiment' },
    { key: 'neutral', label: '😐 Neutral', group: 'sentiment' },
    { key: '5star', label: '⭐ 5 Stars', group: 'rating' },
    { key: '4star', label: '⭐ 4 Stars', group: 'rating' },
    { key: '3star', label: '⭐ 3 Stars', group: 'rating' },
    { key: '2star', label: '⭐ 2 Stars', group: 'rating' },
    { key: '1star', label: '⭐ 1 Star', group: 'rating' },
    { key: 'quality', label: '⚡ Quality', group: 'category' },
    { key: 'performance', label: '🎯 Performance', group: 'category' },
    { key: 'value', label: '💰 Value', group: 'category' },
    { key: 'delivery', label: '📦 Delivery', group: 'category' },
];

// ============================================================================
// HIGHLIGHT UTILITY
// ============================================================================

function highlightText(text: string, query: string): React.ReactNode {
    if (!query || query.length < 2) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 text-yellow-900 dark:text-yellow-200 rounded px-0.5">{part}</mark>
            : part
    );
}

// ============================================================================
// AUTO-INSIGHT GENERATOR
// ============================================================================

function generateInsights(reviews: Review[]): InsightCard[] {
    if (reviews.length === 0) return [];
    const insights: InsightCard[] = [];

    const positiveCount = reviews.filter(r => r.sentiment === 'Positive').length;
    const positiveRate = Math.round((positiveCount / reviews.length) * 100);

    if (positiveRate >= 70) {
        insights.push({ icon: <ThumbsUp size={14} />, text: `${positiveRate}% positive sentiment — customers are largely satisfied`, type: 'positive' });
    } else if (positiveRate < 40) {
        insights.push({ icon: <ThumbsDown size={14} />, text: `Only ${positiveRate}% positive — significant customer concerns detected`, type: 'negative' });
    }

    const qualityReviews = reviews.filter(r => String(r.sentimentCategory) === 'Quality');
    if (qualityReviews.length > 0) {
        const qualityNeg = qualityReviews.filter(r => r.sentiment === 'Negative').length;
        const qualityNegRate = Math.round((qualityNeg / qualityReviews.length) * 100);
        if (qualityNegRate > 40) {
            insights.push({ icon: <Flame size={14} />, text: `${qualityNegRate}% of quality reviews are negative — requires attention`, type: 'negative' });
        }
    }

    const productMap = new Map<string, number>();
    reviews.forEach(r => productMap.set(r.product, (productMap.get(r.product) || 0) + 1));
    const topProduct = Array.from(productMap.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topProduct) {
        insights.push({ icon: <Package size={14} />, text: `Most discussed: ${topProduct[0].slice(0, 50)} (${topProduct[1]} reviews)`, type: 'info' });
    }

    const oneStar = reviews.filter(r => r.rating === 1).length;
    const oneStarRate = Math.round((oneStar / reviews.length) * 100);
    if (oneStarRate > 15) {
        insights.push({ icon: <TrendingDown size={14} />, text: `${oneStarRate}% of reviews are 1-star — investigate root causes`, type: 'negative' });
    }

    return insights;
}

// ============================================================================
// VOICE OF CUSTOMER SUMMARY
// ============================================================================

function generateVoCSummary(reviews: Review[]): { painPoints: string[]; praises: string[] } {
    if (reviews.length === 0) return { painPoints: [], praises: [] };

    const negReviews = reviews.filter(r => r.sentiment === 'Negative');
    const posReviews = reviews.filter(r => r.sentiment === 'Positive');

    // Count subcategories for pain points
    const negSubcats = new Map<string, number>();
    negReviews.forEach(r => {
        const sub = r.subcategory || r.sentimentCategory || 'General';
        negSubcats.set(sub, (negSubcats.get(sub) || 0) + 1);
    });
    const painPoints = Array.from(negSubcats.entries())
        .filter(([key]) => key !== 'General' && key !== 'General Feedback')
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, count]) => `${cat.replace(/_/g, ' ')} (${count} complaints)`);

    // Count subcategories for praises
    const posSubcats = new Map<string, number>();
    posReviews.forEach(r => {
        const sub = r.subcategory || r.sentimentCategory || 'General';
        posSubcats.set(sub, (posSubcats.get(sub) || 0) + 1);
    });
    const praises = Array.from(posSubcats.entries())
        .filter(([key]) => key !== 'General' && key !== 'General Feedback')
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, count]) => `${cat.replace(/_/g, ' ')} (${count} positive mentions)`);

    return { painPoints, praises };
}

// ============================================================================
// TIMELINE HEATMAP COMPONENT
// ============================================================================

const TimelineHeatmap: React.FC<{ reviews: Review[] }> = ({ reviews }) => {
    const monthlyData = useMemo(() => {
        const monthMap = new Map<string, { total: number; positive: number; negative: number }>();

        reviews.forEach(r => {
            if (!r.date) return;
            const d = new Date(r.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const existing = monthMap.get(key) || { total: 0, positive: 0, negative: 0 };
            existing.total++;
            if (r.sentiment === 'Positive') existing.positive++;
            else if (r.sentiment === 'Negative') existing.negative++;
            monthMap.set(key, existing);
        });

        return Array.from(monthMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-18); // Last 18 months
    }, [reviews]);

    if (monthlyData.length === 0) return null;
    const maxTotal = Math.max(...monthlyData.map(([, d]) => d.total));

    return (
        <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/40 dark:border-slate-700/40 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-slate-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Review Timeline</h3>
            </div>
            <div className="flex gap-1 items-end h-14">
                {monthlyData.map(([month, data], i) => {
                    const barHeight = maxTotal > 0 ? (data.total / maxTotal) * 100 : 0;
                    const sentimentRatio = data.total > 0 ? data.positive / data.total : 0.5;
                    const color = sentimentRatio >= 0.6 ? 'bg-emerald-400 dark:bg-emerald-500'
                        : sentimentRatio >= 0.4 ? 'bg-amber-400 dark:bg-amber-500'
                            : 'bg-rose-400 dark:bg-rose-500';

                    return (
                        <div key={month} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${barHeight}%` }}
                                transition={{ delay: i * 0.03, duration: 0.4 }}
                                className={`w-full rounded-t ${color} min-h-[2px] cursor-pointer hover:opacity-80 transition-opacity`}
                                title={`${month}: ${data.total} reviews (${data.positive} pos, ${data.negative} neg)`}
                            />
                            {i % 3 === 0 && (
                                <span className="text-[7px] text-slate-400">{month.split('-')[1]}/{month.split('-')[0].slice(2)}</span>
                            )}

                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                                <div className="bg-slate-900 dark:bg-slate-700 text-white text-[9px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                    {month}: {data.total} reviews • {data.positive}↑ {data.negative}↓
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-400">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-emerald-400" /> &gt;60% positive</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-amber-400" /> 40-60%</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-rose-400" /> &lt;40% positive</div>
            </div>
        </div>
    );
};

// ============================================================================
// WORD CLOUD COMPONENT (Bubble Layout)
// ============================================================================

const WordCloudBubbles: React.FC<{ keywords: [string, number][]; onKeywordClick: (kw: string) => void; activeKeyword?: string }> = ({ keywords, onKeywordClick, activeKeyword }) => {
    if (keywords.length === 0) return null;
    const maxCount = Math.max(...keywords.map(([, c]) => c));

    const COLORS = [
        'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-200/40 dark:border-indigo-700/40',
        'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-200/40 dark:border-purple-700/40',
        'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200/40 dark:border-emerald-700/40',
        'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-200/40 dark:border-amber-700/40',
        'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-200/40 dark:border-rose-700/40',
        'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-200/40 dark:border-cyan-700/40',
    ];

    return (
        <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/40 dark:border-slate-700/40 p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                <Sparkles size={12} /> Keyword Cloud
            </h3>
            <div className="flex flex-wrap gap-1.5">
                {keywords.map(([kw, count], i) => {
                    const scale = 0.7 + (count / maxCount) * 0.6;
                    const isActive = activeKeyword === kw;
                    return (
                        <motion.button
                            key={kw}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.02, type: 'spring', stiffness: 400 }}
                            whileHover={{ scale: scale * 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onKeywordClick(kw)}
                            className={`inline-flex items-center gap-1 rounded-full border transition-all cursor-pointer
                                ${isActive
                                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                                    : COLORS[i % COLORS.length]
                                }`}
                            style={{
                                fontSize: `${Math.max(9, Math.min(13, 9 + (count / maxCount) * 4))}px`,
                                padding: `${3 + (count / maxCount) * 3}px ${6 + (count / maxCount) * 4}px`,
                            }}
                        >
                            <span className="font-semibold">{kw}</span>
                            <span className={isActive ? 'text-white/70' : 'opacity-50'}>{count}</span>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================================
// SENTIMENT SPARKLINE
// ============================================================================

const SentimentSparkline: React.FC<{ reviews: Review[] }> = ({ reviews }) => {
    const data = useMemo(() => {
        const monthMap = new Map<string, { pos: number; total: number }>();
        reviews.forEach(r => {
            if (!r.date) return;
            const d = new Date(r.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const existing = monthMap.get(key) || { pos: 0, total: 0 };
            existing.total++;
            if (r.sentiment === 'Positive') existing.pos++;
            monthMap.set(key, existing);
        });

        return Array.from(monthMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-12)
            .map(([, v]) => v.total > 0 ? Math.round((v.pos / v.total) * 100) : 50);
    }, [reviews]);

    if (data.length < 2) return null;
    const w = 160;
    const h = 40;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * (h - 8) - 4;
        return `${x},${y}`;
    }).join(' ');

    // Area fill
    const areaPoints = `0,${h} ${points} ${w},${h}`;

    return (
        <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/40 dark:border-slate-700/40 p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                <TrendingUp size={12} /> Sentiment Trend
            </h3>
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">12-month positive rate trend</span>
                <span className="text-xs font-bold text-indigo-500">{data[data.length - 1]}%</span>
            </div>
            <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible">
                <defs>
                    <linearGradient id="sentimentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polygon points={areaPoints} fill="url(#sentimentGrad)" />
                <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {/* End dot */}
                <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * (h - 8) - 4} r="3" fill="#6366f1" />
            </svg>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ReviewIntelligenceExplorer: React.FC<Props> = ({ reviews, competitorReviews = [] }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<QuickFilter>('all');
    const [sortBy, setSortBy] = useState<'date' | 'rating_asc' | 'rating_desc'>('date');
    const [expandedReview, setExpandedReview] = useState<string | number | null>(null);
    const [showCount, setShowCount] = useState(30);
    const [showCompetitor, setShowCompetitor] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Combined reviews when comparison is on
    const sourceReviews = useMemo(() => {
        if (!showCompetitor) return reviews;
        const compAsReview = competitorReviews.map((r, i) => ({
            id: `comp-${i}`,
            date: r.date,
            rating: r.rating,
            sentiment: r.sentiment?.toUpperCase() === 'POSITIVE' ? 'Positive' :
                r.sentiment?.toUpperCase() === 'NEGATIVE' ? 'Negative' : 'Neutral',
            sentimentCategory: r.sentimentCategory || '',
            subcategory: r.subcategory || '',
            product: r.productName || r.product || 'Unknown',
            text: r.text || '',
            characteristics: [] as string[],
            brand: r.brand || 'Competitor',
        }));
        return [...reviews.map(r => ({ ...r, brand: 'Prestige' })), ...compAsReview] as Array<Review & { brand?: string }>;
    }, [reviews, competitorReviews, showCompetitor]);

    // Filter reviews
    const filteredReviews = useMemo(() => {
        let result = [...sourceReviews];

        if (searchQuery.length >= 2) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.text?.toLowerCase().includes(q) ||
                r.product?.toLowerCase().includes(q) ||
                (r.characteristics || []).some(c => c.toLowerCase().includes(q))
            );
        }

        switch (activeFilter) {
            case 'positive': result = result.filter(r => r.sentiment === 'Positive'); break;
            case 'negative': result = result.filter(r => r.sentiment === 'Negative'); break;
            case 'neutral': result = result.filter(r => r.sentiment === 'Neutral'); break;
            case '1star': result = result.filter(r => r.rating === 1); break;
            case '2star': result = result.filter(r => r.rating === 2); break;
            case '3star': result = result.filter(r => r.rating === 3); break;
            case '4star': result = result.filter(r => r.rating === 4); break;
            case '5star': result = result.filter(r => r.rating === 5); break;
            case 'quality': result = result.filter(r => String(r.sentimentCategory) === 'Quality'); break;
            case 'performance': result = result.filter(r => String(r.sentimentCategory) === 'Performance'); break;
            case 'value': result = result.filter(r => String(r.sentimentCategory) === 'Value'); break;
            case 'delivery': result = result.filter(r => String(r.sentimentCategory) === 'Delivery'); break;
        }

        switch (sortBy) {
            case 'date': result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); break;
            case 'rating_asc': result.sort((a, b) => a.rating - b.rating); break;
            case 'rating_desc': result.sort((a, b) => b.rating - a.rating); break;
        }

        return result;
    }, [sourceReviews, searchQuery, activeFilter, sortBy]);

    // AI Insights
    const insights = useMemo(() => generateInsights(reviews), [reviews]);

    // Voice of Customer
    const vocSummary = useMemo(() => generateVoCSummary(reviews), [reviews]);

    // Stats
    const stats = useMemo(() => {
        const total = filteredReviews.length;
        const positive = filteredReviews.filter(r => r.sentiment === 'Positive').length;
        const negative = filteredReviews.filter(r => r.sentiment === 'Negative').length;
        const neutral = total - positive - negative;

        const ratingDist = [0, 0, 0, 0, 0];
        filteredReviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) ratingDist[r.rating - 1]++; });

        const kwMap = new Map<string, number>();
        filteredReviews.forEach(r => {
            (r.characteristics || []).forEach(c => kwMap.set(c, (kwMap.get(c) || 0) + 1));
        });
        const topKeywords = Array.from(kwMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);

        const prodMap = new Map<string, { count: number; totalRating: number }>();
        filteredReviews.forEach(r => {
            const existing = prodMap.get(r.product) || { count: 0, totalRating: 0 };
            prodMap.set(r.product, { count: existing.count + 1, totalRating: existing.totalRating + r.rating });
        });
        const topProducts = Array.from(prodMap.entries())
            .map(([product, d]) => ({ product, count: d.count, avgRating: Math.round((d.totalRating / d.count) * 10) / 10 }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        return { total, positive, negative, neutral, ratingDist, topKeywords, topProducts };
    }, [filteredReviews]);

    const handleLoadMore = useCallback(() => {
        setShowCount(prev => prev + 30);
    }, []);

    const handleKeywordClick = (kw: string) => {
        setSearchQuery(prev => prev === kw ? '' : kw);
        setShowCount(30);
    };

    const getCardStyle = (sentiment: string) => {
        switch (sentiment) {
            case 'Positive': return 'border-emerald-300/50 dark:border-emerald-700/40 hover:border-emerald-400/70 dark:hover:border-emerald-600/60 hover:shadow-emerald-500/10';
            case 'Negative': return 'border-rose-300/50 dark:border-rose-700/40 hover:border-rose-400/70 dark:hover:border-rose-600/60 hover:shadow-rose-500/10';
            default: return 'border-slate-200/60 dark:border-slate-700/40 hover:border-slate-300/70 dark:hover:border-slate-600/60';
        }
    };

    const insightTypeColors: Record<string, string> = {
        positive: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40',
        negative: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/40',
        neutral: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40',
        info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/40',
    };

    return (
        <div className="space-y-4">
            {/* ===== VOICE OF CUSTOMER SUMMARY ===== */}
            {(vocSummary.painPoints.length > 0 || vocSummary.praises.length > 0) && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 backdrop-blur-sm border border-indigo-200/30 dark:border-indigo-800/30 p-4"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={16} className="text-indigo-500" />
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Voice of Customer</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mb-1.5 flex items-center gap-1">
                                <Flame size={11} /> Top Pain Points
                            </h4>
                            <ul className="space-y-1">
                                {vocSummary.painPoints.map((point, i) => (
                                    <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                        <span className="text-rose-400 mt-0.5">•</span>
                                        <span className="capitalize">{point}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                                <CheckCircle size={11} /> Top Praise Themes
                            </h4>
                            <ul className="space-y-1">
                                {vocSummary.praises.map((praise, i) => (
                                    <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                        <span className="text-emerald-400 mt-0.5">•</span>
                                        <span className="capitalize">{praise}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* ===== AI INSIGHT STRIP ===== */}
            {insights.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                    {insights.map((insight, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium 
                                whitespace-nowrap border backdrop-blur-sm shrink-0
                                ${insightTypeColors[insight.type]}`}
                        >
                            {insight.icon}
                            <span>{insight.text}</span>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* ===== SEARCH + SORT + COMPETITOR TOGGLE ===== */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[250px]">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setShowCount(30); }}
                        placeholder="Search reviews, products, keywords..."
                        className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm
                            border border-slate-200/60 dark:border-slate-700/60
                            text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400
                            focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40
                            shadow-sm transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                            <X size={14} className="text-slate-400" />
                        </button>
                    )}
                </div>

                {/* Sort */}
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="px-4 py-3 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm
                        border border-slate-200/60 dark:border-slate-700/60
                        text-xs font-medium text-slate-700 dark:text-slate-300
                        focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                    <option value="date">Newest First</option>
                    <option value="rating_desc">Highest Rating</option>
                    <option value="rating_asc">Lowest Rating</option>
                </select>

                {/* Competitor Toggle */}
                {competitorReviews.length > 0 && (
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowCompetitor(!showCompetitor)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border ${showCompetitor
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-purple-500 shadow-md shadow-purple-500/20'
                            : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-700'
                            }`}
                    >
                        <GitCompareArrows size={14} />
                        {showCompetitor ? 'Hide Competitors' : 'Compare Competitors'}
                    </motion.button>
                )}

                {/* Count */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    <Hash size={12} />
                    <span><strong className="text-slate-700 dark:text-slate-200">{filteredReviews.length.toLocaleString()}</strong> reviews</span>
                </div>
            </div>

            {/* ===== QUICK FILTER CHIPS ===== */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {QUICK_FILTERS.map(filter => (
                    <motion.button
                        key={filter.key}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setActiveFilter(filter.key); setShowCount(30); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200
                            ${activeFilter === filter.key
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                                : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 border border-slate-200/40 dark:border-slate-700/40'
                            }`}
                    >
                        {filter.label}
                    </motion.button>
                ))}
            </div>

            {/* ===== MAIN GRID: Reviews + Sidebar ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* --- Review Wall (3 cols) --- */}
                <div className="lg:col-span-3 space-y-3" ref={scrollRef}>
                    <AnimatePresence mode="popLayout">
                        {filteredReviews.slice(0, showCount).map((review, i) => {
                            const isExpanded = expandedReview === review.id;
                            const reviewBrand = (review as Review & { brand?: string }).brand;
                            const isCompetitorReview = reviewBrand && reviewBrand !== 'Prestige';

                            return (
                                <motion.div
                                    key={review.id}
                                    layout
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                                    onClick={() => setExpandedReview(isExpanded ? null : review.id)}
                                    className={`cursor-pointer rounded-2xl backdrop-blur-sm
                                        border p-4 shadow-sm hover:shadow-lg transition-all duration-300
                                        ${isCompetitorReview
                                            ? 'bg-purple-50/50 dark:bg-purple-900/10 border-purple-200/50 dark:border-purple-700/40'
                                            : 'bg-white/70 dark:bg-slate-800/70'
                                        } ${getCardStyle(review.sentiment)}`}
                                >
                                    {/* Header row */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {isCompetitorReview && (
                                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                                    {reviewBrand}
                                                </span>
                                            )}
                                            <div className="flex items-center gap-0.5">
                                                {Array.from({ length: 5 }).map((_, j) => (
                                                    <Star key={j} size={12}
                                                        className={j < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}
                                                    />
                                                ))}
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${review.sentiment === 'Positive' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                : review.sentiment === 'Negative' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                {review.sentiment}
                                            </span>
                                            {review.sentimentCategory && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium 
                                                    bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                                                    {String(review.sentimentCategory)}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(review.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>

                                    {/* Review text */}
                                    <p className={`text-sm text-slate-700 dark:text-slate-300 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                                        {highlightText(review.text || '', searchQuery)}
                                    </p>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-500 truncate max-w-[300px] font-medium">
                                            📦 {review.product}
                                        </span>
                                        <div className="flex gap-1 flex-wrap justify-end">
                                            {(review.characteristics || []).slice(0, isExpanded ? 10 : 3).map(c => (
                                                <span key={c} className="px-1.5 py-0.5 text-[9px] rounded-md 
                                                    bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 space-y-2"
                                        >
                                            {review.classificationReasoning && (
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">AI Classification: </span>
                                                    {review.classificationReasoning}
                                                </div>
                                            )}
                                            {review.subcategory && (
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">Subcategory: </span>
                                                    {review.subcategory}
                                                </div>
                                            )}
                                            {review.sentimentConfidence && (
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">Confidence: </span>
                                                    {Math.round(review.sentimentConfidence * 100)}%
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Load more */}
                    {showCount < filteredReviews.length && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleLoadMore}
                            className="w-full py-3 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm
                                border border-slate-200/40 dark:border-slate-700/40 text-sm font-medium
                                text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <ArrowRight size={14} />
                            Load More ({filteredReviews.length - showCount} remaining)
                        </motion.button>
                    )}

                    {filteredReviews.length === 0 && (
                        <div className="text-center py-16">
                            <Search size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No reviews match your filters</p>
                            <button
                                onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
                                className="text-indigo-500 text-xs mt-2 hover:underline"
                            >
                                Clear all filters
                            </button>
                        </div>
                    )}
                </div>

                {/* --- Sidebar Stats (1 col) --- */}
                <div className="space-y-4">
                    {/* Sentiment Distribution */}
                    <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/40 dark:border-slate-700/40 p-4 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Sentiment Split</h3>
                        <div className="space-y-2">
                            {[
                                { label: 'Positive', count: stats.positive, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
                                { label: 'Neutral', count: stats.neutral, color: 'bg-amber-400', textColor: 'text-amber-600 dark:text-amber-400' },
                                { label: 'Negative', count: stats.negative, color: 'bg-rose-500', textColor: 'text-rose-600 dark:text-rose-400' },
                            ].map(item => (
                                <div key={item.label}>
                                    <div className="flex justify-between text-[11px] mb-0.5">
                                        <span className={`font-semibold ${item.textColor}`}>{item.label}</span>
                                        <span className="text-slate-500">{stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0}%</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${stats.total > 0 ? (item.count / stats.total) * 100 : 0}%` }}
                                            transition={{ duration: 0.6, delay: 0.2 }}
                                            className={`h-full rounded-full ${item.color}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rating Distribution */}
                    <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/40 dark:border-slate-700/40 p-4 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Rating Distribution</h3>
                        <div className="space-y-1.5">
                            {[5, 4, 3, 2, 1].map(star => {
                                const count = stats.ratingDist[star - 1];
                                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                                return (
                                    <div key={star} className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-500 w-8">{star}★</span>
                                        <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.6, delay: 0.1 * (6 - star) }}
                                                className={`h-full rounded-full ${star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                            />
                                        </div>
                                        <span className="text-[10px] text-slate-400 w-10 text-right">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Timeline Heatmap */}
                    <TimelineHeatmap reviews={reviews} />

                    {/* Sentiment Sparkline */}
                    <SentimentSparkline reviews={reviews} />

                    {/* Word Cloud */}
                    <WordCloudBubbles
                        keywords={stats.topKeywords}
                        onKeywordClick={handleKeywordClick}
                        activeKeyword={searchQuery}
                    />

                    {/* Top Products */}
                    {stats.topProducts.length > 0 && (
                        <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/40 dark:border-slate-700/40 p-4 shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Top Products</h3>
                            <div className="space-y-2">
                                {stats.topProducts.map((prod) => (
                                    <div key={prod.product}
                                        className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                                                {prod.product}
                                            </p>
                                            <p className="text-[10px] text-slate-400">{prod.count} reviews</p>
                                        </div>
                                        <div className="flex items-center gap-0.5 text-[11px] text-amber-500 font-semibold shrink-0 ml-2">
                                            <Star size={10} fill="currentColor" />
                                            {prod.avgRating}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReviewIntelligenceExplorer;
