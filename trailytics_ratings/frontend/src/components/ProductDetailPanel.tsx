import React, { useMemo, useState } from 'react';
import {
    X,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Target,
    ThumbsUp,
    ThumbsDown,
    Minus,
    Star,
    Package,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    CheckCircle,
    ArrowUpRight,
    ArrowDownRight,
    ChevronLeft,
    ChevronRight,
    MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Review } from '../types';

interface ProductDetailPanelProps {
    productName: string | null;
    reviews: Review[];
    onClose: () => void;
    productHealthInfo?: ProductHealthItem;
    trendPeriodMonths?: number;
    dateFrom?: string;
    dateTo?: string;
}

interface ProductSKU {
    product: string;
    total: number;
    negative: number;
    positive: number;
    neutral: number;
    avgRating: number;
    negativeRate: number;
    positiveRate: number;
    trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
    recentNegRate: number;
    olderNegRate: number;
    sampleReview: string;
}

interface SubcategoryData {
    subcategory: string;
    total: number;
    negative: number;
    negativeRate: number;
    topProduct: string;
    topProductNegRate: number;
}

import type { ProductHealthItem } from '../hooks/useRatingsAPI';
const ProductDetailPanel: React.FC<ProductDetailPanelProps> = ({
    productName,
    reviews,
    onClose,
    productHealthInfo
}) => {
    const [showReviewTimeline, setShowReviewTimeline] = useState(false);
    const [productSortBy, setProductSortBy] = useState<'mentions' | 'negRate' | 'rating'>('mentions');
    const [productSortDir, setProductSortDir] = useState<'asc' | 'desc'>('desc');
    const [skuPage, setSkuPage] = useState(1);
    const [reviewPage, setReviewPage] = useState(1);
    const SKU_PAGE_SIZE = 8;
    const REVIEW_PAGE_SIZE = 10;

    React.useEffect(() => {
        setSkuPage(1);
        setReviewPage(1);
    }, [productName]);

    // Filter reviews containing this sentiment category OR subcategory
    const relevantReviews = useMemo(() => {
        if (!productName) return [];

        // 1) Filter by productName (looser match to account for slight variations)
        let filtered = reviews.filter(r => {
            if (!r.product) return false;
            const current = r.product.toLowerCase().trim();
            const target = productName.toLowerCase().trim();
            
            // Try exact match first
            if (current === target) return true;
            
            // If the target is quite long, see if it's contained (or contains)
            if (current.includes(target) || target.includes(current)) return true;
            
            // Check if they share at least the first 80 characters (handle truncation)
            if (current.substring(0, 80) === target.substring(0, 80)) return true;
            
            return false;
        });

        return filtered;
    }, [productName, reviews]);

    // Sentiment breakdown
    const sentimentBreakdown = useMemo(() => {
        if (productHealthInfo) {
            const total = productHealthInfo.totalMentions;
            const positive = Math.round(total * productHealthInfo.positiveRate);
            const negative = Math.round(total * productHealthInfo.negativeRate);
            const neutral = total - positive - negative;
            return {
                positive,
                negative,
                neutral,
                total,
                positiveRate: (productHealthInfo.positiveRate * 100).toFixed(1),
                negativeRate: (productHealthInfo.negativeRate * 100).toFixed(1),
                neutralRate: ((1 - productHealthInfo.positiveRate - productHealthInfo.negativeRate) * 100).toFixed(1),
                healthScore: productHealthInfo.healthScore
            };
        }

        const positive = relevantReviews.filter(r => r.sentiment?.toUpperCase() === 'POSITIVE').length;
        const negative = relevantReviews.filter(r => r.sentiment?.toUpperCase() === 'NEGATIVE').length;
        const neutral = relevantReviews.filter(r => r.sentiment?.toUpperCase() === 'NEUTRAL').length;
        const total = relevantReviews.length;

        return {
            positive,
            negative,
            neutral,
            total,
            positiveRate: total > 0 ? (positive / total * 100).toFixed(1) : '0',
            negativeRate: total > 0 ? (negative / total * 100).toFixed(1) : '0',
            neutralRate: total > 0 ? (neutral / total * 100).toFixed(1) : '0',
            healthScore: total > 0 ? Math.round(((positive - negative) / total) * 50) + 50 : 50
        };
    }, [relevantReviews, productHealthInfo]);

    // Trend direction
    const trendDirection = useMemo(() => {
        if (productHealthInfo && productHealthInfo.trend) {
            return productHealthInfo.trend;
        }

        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const recent = relevantReviews.filter(r => new Date(r.date) >= sixMonthsAgo);
        const older = relevantReviews.filter(r => {
            const d = new Date(r.date);
            return d >= twelveMonthsAgo && d < sixMonthsAgo;
        });

        if (recent.length < 5 || older.length < 5) return 'stable';

        const recentNeg = recent.filter(r => r.sentiment?.toUpperCase() === 'NEGATIVE').length / recent.length;
        const olderNeg = older.filter(r => r.sentiment?.toUpperCase() === 'NEGATIVE').length / older.length;

        if (recentNeg > olderNeg + 0.1) return 'declining';
        if (recentNeg < olderNeg - 0.1) return 'improving';
        return 'stable';
    }, [relevantReviews, productHealthInfo]);

    // =========================================================================
    // PRODUCT SKU BREAKDOWN — Primary analysis
    // =========================================================================
    const productSkuData = useMemo((): ProductSKU[] => {
        if (relevantReviews.length === 0) return [];

        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const productMap: Record<string, {
            total: number;
            negative: number;
            positive: number;
            neutral: number;
            ratingSum: number;
            recentNeg: number;
            recentTotal: number;
            olderNeg: number;
            olderTotal: number;
            sampleReview: string;
        }> = {};

        relevantReviews.forEach(r => {
            const sentimentUpper = r.sentiment?.toUpperCase();
            if (sentimentUpper !== 'NEGATIVE') return; // ONLY SHOW NEGATIVE REVIEWS

            const product = r.product || 'Unknown Product';
            if (!productMap[product]) {
                productMap[product] = {
                    total: 0, negative: 0, positive: 0, neutral: 0,
                    ratingSum: 0, recentNeg: 0, recentTotal: 0,
                    olderNeg: 0, olderTotal: 0, sampleReview: ''
                };
            }

            const entry = productMap[product];
            // Since we filtered by NEGATIVE, total = negative
            entry.total++;
            entry.negative++;
            entry.ratingSum += r.rating || 3;

            const reviewDate = new Date(r.date);
            if (reviewDate >= sixMonthsAgo) {
                entry.recentTotal++;
                entry.recentNeg++;
            } else {
                entry.olderTotal++;
                entry.olderNeg++;
            }

            if (!entry.sampleReview && r.text && r.text.length > 10) {
                entry.sampleReview = r.text.length > 150 ? r.text.substring(0, 150) + '...' : r.text;
            }
        });

        return Object.entries(productMap)
            .filter(([, data]) => data.negative > 0)
            .map(([product, data]): ProductSKU => {
                const negativeRate = 100; // Since all are negative now
                const positiveRate = 0;
                const avgRating = data.negative > 0 ? data.ratingSum / data.negative : 0;

                const recentNegRate = data.recentTotal > 0 ? (data.recentNeg / data.recentTotal) * 100 : 0;
                const olderNegRate = data.olderTotal > 0 ? (data.olderNeg / data.olderTotal) * 100 : 0;

                let trend: 'improving' | 'stable' | 'declining' | 'insufficient_data' = 'insufficient_data';
                if (data.recentTotal > 0 && data.olderTotal > 0) {
                    if (recentNegRate > olderNegRate + 5) trend = 'declining';
                    else if (recentNegRate < olderNegRate - 5) trend = 'improving';
                    else trend = 'stable';
                }

                return {
                    product,
                    total: data.negative, // show negative count as the exact number match
                    negative: data.negative,
                    positive: data.positive,
                    neutral: data.neutral,
                    avgRating,
                    negativeRate,
                    positiveRate,
                    trend,
                    recentNegRate,
                    olderNegRate,
                    sampleReview: data.sampleReview
                };
            })
            .sort((a, b) => {
                let aVal: number, bVal: number;
                switch (productSortBy) {
                    case 'mentions': aVal = a.total; bVal = b.total; break;
                    case 'negRate': aVal = a.negativeRate; bVal = b.negativeRate; break;
                    case 'rating': aVal = a.avgRating; bVal = b.avgRating; break;
                    default: aVal = a.total; bVal = b.total;
                }
                return productSortDir === 'desc' ? bVal - aVal : aVal - bVal;
            })
            .slice(0, 20);
    }, [relevantReviews, productSortBy, productSortDir]);

    // =========================================================================
    // SUBCATEGORY BREAKDOWN
    // =========================================================================
    const subcategoryData = useMemo((): SubcategoryData[] => {
        if (relevantReviews.length === 0) return [];

        const subcatMap: Record<string, {
            total: number;
            negative: number;
            products: Record<string, { total: number; negative: number }>;
        }> = {};

        relevantReviews.forEach(r => {
            const sub = r.subcategory || 'General';
            if (!subcatMap[sub]) {
                subcatMap[sub] = { total: 0, negative: 0, products: {} };
            }
            subcatMap[sub].total++;
            if (r.sentiment?.toUpperCase() === 'NEGATIVE') subcatMap[sub].negative++;

            const product = r.product || 'Unknown';
            if (!subcatMap[sub].products[product]) {
                subcatMap[sub].products[product] = { total: 0, negative: 0 };
            }
            subcatMap[sub].products[product].total++;
            if (r.sentiment?.toUpperCase() === 'NEGATIVE') {
                subcatMap[sub].products[product].negative++;
            }
        });

        return Object.entries(subcatMap)
            .map(([subcategory, data]): SubcategoryData => {
                const negativeRate = data.total > 0 ? (data.negative / data.total) * 100 : 0;

                // Find the worst product for this subcategory
                let topProduct = '';
                let topProductNegRate = 0;
                Object.entries(data.products).forEach(([prod, pData]) => {
                    if (pData.total >= 2) {
                        const pNegRate = (pData.negative / pData.total) * 100;
                        if (pNegRate > topProductNegRate || (!topProduct && pData.total > 0)) {
                            topProduct = prod;
                            topProductNegRate = pNegRate;
                        }
                    }
                });

                return {
                    subcategory,
                    total: data.total,
                    negative: data.negative,
                    negativeRate,
                    topProduct,
                    topProductNegRate
                };
            })
            .filter(s => s.total >= 2)
            .sort((a, b) => b.total - a.total);
    }, [relevantReviews]);

    const handleProductSort = (col: typeof productSortBy) => {
        if (productSortBy === col) {
            setProductSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setProductSortBy(col);
            setProductSortDir('desc');
        }
    };

    const renderSortIcon = (col: typeof productSortBy) => {
        if (productSortBy !== col) return <ChevronDown size={12} className="text-slate-300" />;
        return productSortDir === 'asc'
            ? <ChevronUp size={12} className="text-indigo-500" />
            : <ChevronDown size={12} className="text-indigo-500" />;
    };

    if (!productName) return null;

    return (
        <AnimatePresence>
            {productName && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-[1300]"
                    />

                    {/* Slide Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-full md:w-3/4 bg-white dark:bg-slate-900 shadow-2xl z-[1300] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 p-6 z-10">
                            <div className="flex items-start justify-between gap-6">
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white capitalize truncate" title={productName}>
                                        {productName}
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1 font-medium">
                                        Product-level analysis • {sentimentBreakdown.total.toLocaleString()} mentions
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Quick Stats */}
                            <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-1.5 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
                                <div className="flex-1 p-4 flex flex-col justify-center">
                                    <div className="flex items-center gap-1.5 mb-1.5 opacity-80">
                                        <ThumbsUp className="text-emerald-500" size={14} />
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Positive</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{sentimentBreakdown.positiveRate}<span className="text-lg font-semibold opacity-60">%</span></div>
                                        <div className="text-xs text-slate-400 font-medium">{sentimentBreakdown.positive} mentions</div>
                                    </div>
                                </div>

                                <div className="flex-1 p-4 flex flex-col justify-center">
                                    <div className="flex items-center gap-1.5 mb-1.5 opacity-80">
                                        <ThumbsDown className="text-rose-500" size={14} />
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Negative</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">{sentimentBreakdown.negativeRate}<span className="text-lg font-semibold opacity-60">%</span></div>
                                        <div className="text-xs text-slate-400 font-medium">{sentimentBreakdown.negative} mentions</div>
                                    </div>
                                </div>

                                <div className="flex-1 p-4 flex flex-col justify-center">
                                    <div className="flex items-center gap-1.5 mb-1.5 opacity-80">
                                        <Minus className="text-slate-400" size={14} />
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Neutral</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-3xl font-bold text-slate-700 dark:text-slate-300">{sentimentBreakdown.neutralRate}<span className="text-lg font-semibold opacity-60">%</span></div>
                                        <div className="text-xs text-slate-400 font-medium">{sentimentBreakdown.neutral} mentions</div>
                                    </div>
                                </div>

                                <div className="flex-[1.2] p-4 flex flex-col justify-center bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10 md:rounded-r-xl">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-1.5 opacity-80">
                                            <Target className="text-indigo-500" size={14} />
                                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Health Score</span>
                                        </div>
                                        <div className="text-[10px] font-semibold text-indigo-500/80 dark:text-indigo-400/80 bg-indigo-100/50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            {trendDirection === 'improving' && <><TrendingUp size={10} /> Improving</>}
                                            {trendDirection === 'declining' && <><TrendingDown size={10} /> Declining</>}
                                            {trendDirection === 'stable' && 'Stable'}
                                        </div>
                                    </div>
                                    <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                                        {sentimentBreakdown.healthScore}
                                    </div>
                                </div>
                            </div>

                            {/* ============================================================ */}
                            {/* PRODUCT SKU BREAKDOWN TABLE — Primary Content               */}
                            {/* ============================================================ */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                            >
                                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Package className="text-purple-500" size={20} />
                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            Product SKU Breakdown
                                        </h3>
                                        <span className="text-xs text-slate-400">
                                            ({productSkuData.length} products)
                                        </span>
                                    </div>
                                </div>

                                {productSkuData.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">
                                        <Package size={32} className="mx-auto mb-2 opacity-40" />
                                        <p>No product data available for this issue</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                                                    <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 min-w-[200px]">
                                                        Product
                                                    </th>
                                                    <th
                                                        className="text-center py-3 px-3 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:text-indigo-600 transition-colors"
                                                        onClick={() => handleProductSort('mentions')}
                                                    >
                                                        <div className="flex items-center justify-center gap-1">
                                                            Mentions {renderSortIcon('mentions')}
                                                        </div>
                                                    </th>
                                                    <th
                                                        className="text-center py-3 px-3 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:text-indigo-600 transition-colors"
                                                        onClick={() => handleProductSort('rating')}
                                                    >
                                                        <div className="flex items-center justify-center gap-1">
                                                            Avg ★ {renderSortIcon('rating')}
                                                        </div>
                                                    </th>
                                                    <th className="text-center py-3 px-3 font-semibold text-slate-600 dark:text-slate-300">
                                                        Trend
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const paginatedSkus = productSkuData.slice((skuPage - 1) * SKU_PAGE_SIZE, skuPage * SKU_PAGE_SIZE);
                                                    
                                                    return (
                                                        <>
                                                            {paginatedSkus.map((sku, idx) => (
                                                                <motion.tr
                                                                    key={sku.product}
                                                                    initial={{ opacity: 0, y: 8 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: idx * 0.03 }}
                                                                    className="border-b border-slate-50 dark:border-slate-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors group"
                                                                >
                                                                    <td className="py-3 px-4">
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[280px]" title={sku.product}>
                                                                                {sku.product.length > 50 ? sku.product.substring(0, 50) + '...' : sku.product}
                                                                            </span>
                                                                            {sku.sampleReview && (
                                                                                <span className="text-[10px] text-slate-400 italic mt-1 line-clamp-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    "{sku.sampleReview}"
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-center py-3 px-3">
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                                            {sku.total}
                                                                        </span>
                                                                    </td>
                                                                    <td className="text-center py-3 px-3">
                                                                        <div className="flex items-center justify-center gap-0.5">
                                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                                <Star
                                                                                    key={s}
                                                                                    size={10}
                                                                                    className={s <= Math.round(sku.avgRating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}
                                                                                />
                                                                            ))}
                                                                            <span className="text-xs text-slate-400 ml-1">{sku.avgRating.toFixed(1)}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-center py-3 px-3">
                                                                        {sku.trend === 'declining' && (
                                                                            <span className="inline-flex items-center justify-center gap-1 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                                                                                <ArrowUpRight size={12} /> Worse
                                                                            </span>
                                                                        )}
                                                                        {sku.trend === 'improving' && (
                                                                            <span className="inline-flex items-center justify-center gap-1 text-xs font-medium text-green-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">
                                                                                <ArrowDownRight size={12} /> Better
                                                                            </span>
                                                                        )}
                                                                        {sku.trend === 'stable' && (
                                                                            <span className="inline-flex items-center justify-center gap-1 text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                                                <Minus size={12} /> Stable
                                                                            </span>
                                                                        )}
                                                                        {sku.trend === 'insufficient_data' && (
                                                                            <span className="text-xs text-slate-300" title="Not enough historical data">—</span>
                                                                        )}
                                                                    </td>
                                                                </motion.tr>
                                                            ))}
                                                        </>
                                                    );
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {productSkuData.length > SKU_PAGE_SIZE && (
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2">
                                            Page {skuPage} of {Math.ceil(productSkuData.length / SKU_PAGE_SIZE)}
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setSkuPage(p => Math.max(1, p - 1))}
                                                disabled={skuPage === 1}
                                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 disabled:opacity-30 hover:bg-slate-100 transition-colors border border-slate-200 dark:border-slate-700"
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                            <button
                                                onClick={() => setSkuPage(p => Math.min(Math.ceil(productSkuData.length / SKU_PAGE_SIZE), p + 1))}
                                                disabled={skuPage === Math.ceil(productSkuData.length / SKU_PAGE_SIZE)}
                                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 disabled:opacity-30 hover:bg-slate-100 transition-colors border border-slate-200 dark:border-slate-700"
                                            >
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </motion.div>

                            {/* ============================================================ */}
                            {/* SUBCATEGORY BREAKDOWN                                        */}
                            {/* ============================================================ */}
                            {subcategoryData.length > 1 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                                >
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 className="text-indigo-500" size={20} />
                                            <h3 className="font-bold text-slate-900 dark:text-white">
                                                Sub-Issue Breakdown
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {subcategoryData.map((sub, idx) => (
                                            <motion.div
                                                key={sub.subcategory}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.04 }}
                                                className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-4"
                                            >
                                                <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
                                                    <div className={`mt-0.5 md:mt-0 p-2 rounded-xl shrink-0 ${sub.negativeRate > 50 ? 'bg-red-50 text-red-500 dark:bg-red-500/10' :
                                                            sub.negativeRate > 30 ? 'bg-orange-50 text-orange-500 dark:bg-orange-500/10' :
                                                                'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
                                                        }`}>
                                                        {sub.negativeRate > 50 ? (
                                                            <AlertTriangle size={16} />
                                                        ) : sub.negativeRate > 30 ? (
                                                            <AlertTriangle size={16} />
                                                        ) : (
                                                            <CheckCircle size={16} />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                                                            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 capitalize truncate">
                                                                {sub.subcategory.replace(/_/g, ' ')}
                                                            </span>
                                                            <span className="text-xs text-slate-400 shrink-0">{sub.total} mentions</span>
                                                        </div>
                                                        {sub.topProduct && (
                                                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                                                                <span className="text-slate-400">Most affected:</span>
                                                                <span className="font-medium text-slate-600 dark:text-slate-300 truncate" title={sub.topProduct}>
                                                                    {sub.topProduct}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 pl-12 md:pl-0 shrink-0">
                                                    <div className="w-32 hidden sm:block">
                                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                                            <div 
                                                                className={`h-full ${sub.negativeRate > 50 ? 'bg-red-500' : sub.negativeRate > 30 ? 'bg-orange-400' : 'bg-emerald-500'}`} 
                                                                style={{ width: `${sub.negativeRate}%` }} 
                                                            />
                                                        </div>
                                                    </div>
                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold w-16 text-center ${sub.negativeRate > 50 ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 ring-1 ring-red-500/20' :
                                                            sub.negativeRate > 30 ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 ring-1 ring-orange-500/20' :
                                                                'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-500/20'
                                                        }`}>
                                                        {sub.negativeRate.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* ============================================================ */}
                            {/* REVIEW TIMELINE — Collapsible, at bottom                    */}
                            {/* ============================================================ */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                            >
                                <button
                                    onClick={() => setShowReviewTimeline(!showReviewTimeline)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="text-indigo-500" size={20} />
                                        <h3 className="font-bold text-slate-900 dark:text-white">Review Verbatims</h3>
                                        <span className="text-xs text-slate-400">({relevantReviews.filter(r => r.text && r.text.length > 0).length} reviews)</span>
                                    </div>
                                    {showReviewTimeline ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                </button>

                                <AnimatePresence>
                                    {showReviewTimeline && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-5 p-4 pt-0">
                                                {(() => {
                                                    const reviewsWithText = relevantReviews
                                                        .filter(r => r.text && r.text.length > 0)
                                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                                    
                                                    const totalReviewPages = Math.ceil(reviewsWithText.length / REVIEW_PAGE_SIZE);
                                                    const paginatedReviews = reviewsWithText.slice((reviewPage - 1) * REVIEW_PAGE_SIZE, reviewPage * REVIEW_PAGE_SIZE);
                                                    
                                                    return (
                                                        <>
                                                            {paginatedReviews.map((review) => (
                                                                <div key={review.id} className="relative pl-6 border-l-[3px] border-slate-100 dark:border-slate-700/50">
                                                                    <div className={`absolute -left-[7px] top-2 w-[11px] h-[11px] rounded-full ring-4 ring-white dark:ring-slate-900 ${review.sentiment === 'Positive' ? 'bg-emerald-500' :
                                                                            review.sentiment === 'Negative' ? 'bg-rose-500' : 'bg-slate-400'
                                                                        }`} />

                                                                    <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${review.sentiment === 'Positive' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-500/20' :
                                                                                        review.sentiment === 'Negative' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 ring-1 ring-rose-500/20' :
                                                                                            'bg-slate-50 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 ring-1 ring-slate-500/20'
                                                                                    }`}>
                                                                                    {review.sentiment}
                                                                                </span>
                                                                                <div className="flex items-center gap-0.5">
                                                                                    {[...Array(5)].map((_, i) => (
                                                                                        <Star
                                                                                            key={i}
                                                                                            size={12}
                                                                                            className={i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-700'}
                                                                                        />
                                                                                    ))}
                                                                                </div>
                                                                                {review.product && (
                                                                                    <span className="text-[11px] px-2 py-0.5 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-md font-medium border border-slate-200 dark:border-slate-700 max-w-[200px] truncate" title={review.product}>
                                                                                        {review.product}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                                                                                {new Date(review.date).toLocaleDateString('en-US', {
                                                                                    year: 'numeric',
                                                                                    month: 'short',
                                                                                    day: 'numeric'
                                                                                })}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                                            {review.text}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {totalReviewPages > 1 && (
                                                                <div className="flex items-center justify-between mt-6 px-1 pt-4 border-t border-slate-100 dark:border-slate-800">
                                                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                                                        Page {reviewPage} of {totalReviewPages}
                                                                    </span>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                                                                            disabled={reviewPage === 1}
                                                                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 disabled:opacity-30 hover:bg-slate-200 transition-colors"
                                                                        >
                                                                            <ChevronLeft size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setReviewPage(p => Math.min(totalReviewPages, p + 1))}
                                                                            disabled={reviewPage === totalReviewPages}
                                                                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 disabled:opacity-30 hover:bg-slate-200 transition-colors"
                                                                        >
                                                                            <ChevronRight size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}

                                                {relevantReviews.filter(r => r.text && r.text.length > 0).length === 0 && (
                                                    <p className="text-sm text-slate-400 text-center py-8">No reviews with text available for this productName</p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ProductDetailPanel;
