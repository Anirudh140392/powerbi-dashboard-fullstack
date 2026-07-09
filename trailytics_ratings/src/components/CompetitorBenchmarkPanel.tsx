/**
 * CompetitorBenchmarkPanel Component  
 * 75% width slide-out panel for detailed SKU-to-SKU competitor comparison
 */
import React, { useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Target, Award, AlertTriangle, ChevronRight, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Review } from '../types';
import { useBenchmarkData, useCompanyConfig, useBrandConfig } from '../hooks/useRatingsAPI';

interface CompetitorBenchmarkPanelProps {
    isOpen: boolean;
    onClose: () => void;
    selectedProduct: string | null;
    reviews: Review[]; // These are the 'Prestige/Own' reviews
    competitorReviews?: Review[];
}

interface GapAnalysis {
    characteristic: string;
    ourScore: number;
    competitorAvg: number;
    gap: number;
    isWinning: boolean;
    priority: 'critical' | 'improvement' | 'maintain';
}

const CompetitorBenchmarkPanel: React.FC<CompetitorBenchmarkPanelProps> = ({
    isOpen,
    onClose,
    selectedProduct,
    reviews,
    competitorReviews = []
}) => {
    const { config } = useCompanyConfig();
    const { getColor, ownBrand } = useBrandConfig();
    
    // Determine product category
    const productCategory = useMemo(() => {
        const scopedReviews = reviews.filter(r => !selectedProduct || r.product === selectedProduct || r.productName === selectedProduct);
        return scopedReviews.find(r => r.category)?.category || reviews.find(r => r.category)?.category;
    }, [selectedProduct, reviews]);

    const { benchmarks, loading: benchLoading } = useBenchmarkData(productCategory || undefined);

    // Calculate Our Brand metrics from benchmarks
    const ourMetrics = useMemo(() => {
        const ourRow = benchmarks.find(b => !b.is_competitor);
        if (!ourRow) return null;
        
        const pos = parseInt(ourRow.positive_count) || 0;
        const total = parseInt(ourRow.total_reviews) || 0;
        return {
            avgRating: parseFloat(ourRow.avg_rating),
            totalReviews: total,
            sentimentScore: total > 0 ? Math.round((pos / total) * 100) : 0
        };
    }, [benchmarks]);

    // Market Average (Competitors only) — REVIEW-COUNT-WEIGHTED so a 5-review
    // brand doesn't count the same as a 5,000-review brand. Our own "score" is a
    // per-review average, so an unweighted mean of competitor averages made the
    // "Gap vs Market" an apples-to-oranges comparison.
    const marketAvg = useMemo(() => {
        const comps = benchmarks.filter(b => b.is_competitor);
        if (comps.length === 0) return null;
        let weighted = 0, weight = 0;
        for (const c of comps) {
            const n = parseInt(c.total_reviews) || 0;
            const r = parseFloat(c.avg_rating);
            if (n > 0 && !isNaN(r)) { weighted += r * n; weight += n; }
        }
        if (weight === 0) return null;
        return Math.round((weighted / weight) * 10) / 10;
    }, [benchmarks]);

    // Gap analysis using real category scores from benchmarks
    const gapAnalysis = useMemo((): GapAnalysis[] => {
        const ourRow = benchmarks.find(b => !b.is_competitor);
        const comps = benchmarks.filter(b => b.is_competitor);
        if (!ourRow || !ourRow.category_scores || comps.length === 0) return [];

        const gaps: GapAnalysis[] = [];
        const categories = Object.keys(ourRow.category_scores).filter(c => c !== 'General');

        categories.forEach(char => {
            const ourCat = ourRow.category_scores![char];
            const ourScore = ourCat && ourCat.total > 0 ? Math.round((ourCat.positive / ourCat.total) * 100) : 0;
            
            // Calc competitor average for this category
            let compScoreSum = 0;
            let compCount = 0;
            comps.forEach(c => {
                if (c.category_scores && c.category_scores[char]) {
                    const cat = c.category_scores[char];
                    if (cat.total > 0) {
                        compScoreSum += (cat.positive / cat.total) * 100;
                        compCount++;
                    }
                }
            });
            const competitorAvg = compCount > 0 ? Math.round(compScoreSum / compCount) : 0;
            
            if (ourScore > 0 && competitorAvg > 0) {
                const gap = ourScore - competitorAvg;
                gaps.push({
                    characteristic: char,
                    ourScore,
                    competitorAvg,
                    gap,
                    isWinning: gap >= 0,
                    priority: gap < -10 ? 'critical' : gap < 0 ? 'improvement' : 'maintain'
                });
            }
        });

        return gaps.sort((a, b) => a.gap - b.gap); // Sort by gap (worst first)
    }, [benchmarks]);

    // Action recommendations
    const recommendations = useMemo(() => {
        const recs: string[] = [];

        gapAnalysis.filter(g => g.priority === 'critical').forEach(g => {
            recs.push(`🚨 Critical: Address ${g.characteristic} gap (${g.gap} pts behind competition)`);
        });

        gapAnalysis.filter(g => g.priority === 'improvement').forEach(g => {
            recs.push(`⚠️ Improve: Enhance ${g.characteristic} to match competitors (${Math.abs(g.gap)} pts gap)`);
        });

        gapAnalysis.filter(g => g.isWinning && g.gap > 10).slice(0, 2).forEach(g => {
            recs.push(`✅ Leverage: Highlight ${g.characteristic} strength (+${g.gap} pts lead)`);
        });

        if (recs.length === 0) {
            recs.push("No critical gaps detected. Maintain current product standards.");
        }

        return recs;
    }, [gapAnalysis]);

    const competitors = benchmarks.filter(b => b.is_competitor);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-[1300]"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-full md:w-3/4 bg-white dark:bg-slate-900 shadow-2xl z-[1400] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Target className="text-indigo-500" /> Competitor Benchmark
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {selectedProduct || productCategory || 'Unresolved Category'} vs Market
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="text-slate-500" size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Overall Comparison Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Our Score */}
                                <div className="card p-4 border-l-4" style={{ borderColor: config.brand_color }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Award size={20} style={{ color: config.brand_color }} />
                                        <h3 className="font-bold text-slate-700 dark:text-slate-200">{ownBrand || config.brand_name}</h3>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold" style={{ color: config.brand_color }}>{ourMetrics ? ourMetrics.avgRating : '-'}</span>
                                        {ourMetrics && <Star className="text-yellow-500 fill-yellow-500" size={16} />}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {ourMetrics ? `${ourMetrics.totalReviews.toLocaleString()} reviews • ${ourMetrics.sentimentScore}% positive` : 'No own-brand benchmark row for this scope'}
                                    </p>
                                </div>

                                {/* Market Average */}
                                <div className="card p-4 border-l-4 border-orange-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Target className="text-orange-500" size={20} />
                                        <h3 className="font-bold text-slate-700 dark:text-slate-200">Market Avg</h3>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-orange-500">{marketAvg ?? "-"}</span>
                                        {marketAvg !== null && marketAvg > 0 && <Star className="text-yellow-500 fill-yellow-500" size={16} />}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Across {competitors.length} competitor brands
                                    </p>
                                </div>

                                {/* Gap Indicator */}
                                <div className={`card p-4 border-l-4 ${ourMetrics && marketAvg !== null && ourMetrics.avgRating >= marketAvg ? 'border-green-500' : 'border-red-500'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {ourMetrics && marketAvg !== null && ourMetrics.avgRating >= marketAvg ? (
                                            <TrendingUp className="text-green-500" size={20} />
                                        ) : (
                                            <TrendingDown className="text-red-500" size={20} />
                                        )}
                                        <h3 className="font-bold text-slate-700 dark:text-slate-200">Gap</h3>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-3xl font-bold ${ourMetrics && marketAvg !== null && ourMetrics.avgRating >= marketAvg ? 'text-green-500' : 'text-red-500'}`}>
                                            {ourMetrics && marketAvg !== null ? `${ourMetrics.avgRating >= marketAvg ? '+' : ''}${(ourMetrics.avgRating - marketAvg).toFixed(1)}` : '-'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {ourMetrics && marketAvg !== null ? (ourMetrics.avgRating >= marketAvg ? 'Above market' : 'Below market') : 'No comparable market benchmark'}
                                    </p>
                                </div>
                            </div>

                            {/* Competitor Products Table */}
                            <div className="card p-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <Target size={18} />
                                    Mapped Competitor Brands ({productCategory || 'Unresolved Category'})
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                                <th className="text-left py-2 px-3 font-medium text-slate-500">Brand</th>
                                                <th className="text-center py-2 px-3 font-medium text-slate-500">Rating</th>
                                                <th className="text-center py-2 px-3 font-medium text-slate-500">Reviews</th>
                                                <th className="text-right py-2 px-3 font-medium text-slate-500">vs {ownBrand || config.brand_name}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {benchLoading ? (
                                                <tr><td colSpan={4} className="text-center py-4 text-slate-500">Loading benchmark data...</td></tr>
                                            ) : competitors.length === 0 ? (
                                                <tr><td colSpan={4} className="text-center py-4 text-slate-500">{productCategory ? `No competitor reviews found for ${productCategory}` : 'Product category could not be resolved from current review data.'}</td></tr>
                                            ) : (
                                                competitors.map(comp => {
                                                    const rating = parseFloat(comp.avg_rating);
                                                    const ratingDiff = ourMetrics ? rating - ourMetrics.avgRating : null;
                                                    return (
                                                        <tr key={comp.brand} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                            <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColor(comp.brand) }} />
                                                                    {comp.brand}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                <span className="inline-flex items-center gap-1">
                                                                    {comp.avg_rating}
                                                                    <Star className="text-yellow-500 fill-yellow-500" size={12} />
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">
                                                                {parseInt(comp.total_reviews).toLocaleString()}
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <span className={`inline-flex items-center gap-1 text-sm font-medium ${ratingDiff !== null && ratingDiff <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                    {ratingDiff !== null && (ratingDiff <= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
                                                                    {ratingDiff !== null ? `${ratingDiff > 0 ? '+' : ''}${ratingDiff.toFixed(1)}` : '-'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Gap Analysis */}
                            <div className="card p-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <AlertTriangle size={18} />
                                    Sentiment Gap Analysis by Characteristic
                                </h3>
                                <div className="space-y-3">
                                    {gapAnalysis.length === 0 ? (
                                        <p className="text-sm text-slate-500 text-center py-4">Insufficient data for categorical gap analysis in this category.</p>
                                    ) : gapAnalysis.map(gap => (
                                        <div key={gap.characteristic} className="flex items-center gap-4">
                                            <span className="w-28 text-sm font-medium text-slate-600 dark:text-slate-400">
                                                {gap.characteristic}
                                            </span>
                                            <div className="flex-1 flex items-center gap-2">
                                                {/* Gap bar visualization */}
                                                <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded-full relative overflow-hidden">
                                                    {/* Center line */}
                                                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300 dark:bg-slate-600 z-10" />
                                                    {/* Gap bar */}
                                                    <div
                                                        className={`absolute top-1 bottom-1 rounded-full ${gap.isWinning ? 'bg-green-500' : 'bg-red-500'}`}
                                                        style={{
                                                            left: gap.isWinning ? '50%' : `${50 + gap.gap}%`,
                                                            width: `${Math.abs(gap.gap)}%`,
                                                            maxWidth: '50%'
                                                        }}
                                                    />
                                                </div>
                                                <span className={`w-16 text-right text-sm font-bold ${gap.isWinning ? 'text-green-500' : 'text-red-500'}`}>
                                                    {gap.gap > 0 ? '+' : ''}{gap.gap} %
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* AI Recommendations */}
                            <div className="card p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    💡 Action Recommendations
                                </h3>
                                <ul className="space-y-2">
                                    {recommendations.map((rec, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                                            <ChevronRight className="shrink-0 mt-0.5 text-indigo-500" size={16} />
                                            {rec}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Recent Competitor Reviews */}
                            <div className="card p-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    💬 Recent Competitor Reviews
                                </h3>
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {competitorReviews.length === 0 ? (
                                        <p className="text-sm text-slate-500 text-center py-4">No recent competitor reviews loaded.</p>
                                    ) : competitorReviews
                                        .filter(r => r.category === productCategory)
                                        .slice(0, 10)
                                        .map(review => (
                                            <div
                                                key={review.id}
                                                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(review.brand || '') }} />
                                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                                            {review.brand}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${review.sentiment === 'Positive' ? 'bg-green-100 text-green-600 dark:bg-green-500/20' :
                                                            review.sentiment === 'Negative' ? 'bg-red-100 text-red-600 dark:bg-red-500/20' :
                                                                'bg-slate-100 text-slate-600 dark:bg-slate-500/20'
                                                            }`}>
                                                            {review.sentiment}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-sm">
                                                            {review.rating}
                                                            <Star className="text-yellow-500 fill-yellow-500" size={12} />
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                                    "{review.text}"
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">{review.date}</p>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default CompetitorBenchmarkPanel;
