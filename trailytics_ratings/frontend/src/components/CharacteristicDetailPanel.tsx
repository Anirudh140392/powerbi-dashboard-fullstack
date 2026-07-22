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
    ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Review } from '../types';

interface CharacteristicDetailPanelProps {
    characteristic: string | null;
    reviews: Review[];
    onClose: () => void;
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
    trend: 'improving' | 'stable' | 'declining';
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

const CharacteristicDetailPanel: React.FC<CharacteristicDetailPanelProps> = ({
    characteristic,
    reviews,
    onClose
}) => {
    const [showReviewTimeline, setShowReviewTimeline] = useState(false);
    const [productSortBy, setProductSortBy] = useState<'mentions' | 'negRate' | 'rating'>('mentions');
    const [productSortDir, setProductSortDir] = useState<'asc' | 'desc'>('desc');
    const [skuPage, setSkuPage] = useState(1);
    const [reviewPage, setReviewPage] = useState(1);
    const SKU_PAGE_SIZE = 8;
    const REVIEW_PAGE_SIZE = 10;

    // Filter reviews containing this sentiment category OR subcategory
    const relevantReviews = useMemo(() => {
        if (!characteristic) return [];
        const charNormalized = characteristic.toLowerCase().replace(/\s+/g, '_');
        const charWithSpaces = characteristic.toLowerCase().replace(/_/g, ' ');

        return reviews.filter(r => {
            const category = (r.sentimentCategory || '').toLowerCase().replace(/\s+/g, '_');
            const subcategory = (r.subcategory || '').toLowerCase().replace(/\s+/g, '_');
            const productName = (r.product || '').toLowerCase();
            const charLower = characteristic.toLowerCase();

            return category === charNormalized ||
                subcategory === charNormalized ||
                category.includes(charWithSpaces) ||
                subcategory.includes(charWithSpaces) ||
                charNormalized.includes(category) ||
                charNormalized.includes(subcategory) ||
                productName === charLower ||
                productName.includes(charLower) ||
                charLower.includes(productName);
        });
    }, [characteristic, reviews]);

    // Sentiment breakdown
    const sentimentBreakdown = useMemo(() => {
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
            healthScore: total > 0 ? Math.round((positive - negative * 0.5 + neutral * 0.25) / total * 100) + 50 : 50
        };
    }, [relevantReviews]);

    // Trend direction
    const trendDirection = useMemo(() => {
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
    }, [relevantReviews]);

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
            const product = r.product || 'Unknown Product';
            if (!productMap[product]) {
                productMap[product] = {
                    total: 0, negative: 0, positive: 0, neutral: 0,
                    ratingSum: 0, recentNeg: 0, recentTotal: 0,
                    olderNeg: 0, olderTotal: 0, sampleReview: ''
                };
            }

            const entry = productMap[product];
            entry.total++;
            entry.ratingSum += r.rating || 3;

            const sentimentUpper = r.sentiment?.toUpperCase();
            if (sentimentUpper === 'NEGATIVE') entry.negative++;
            else if (sentimentUpper === 'POSITIVE') entry.positive++;
            else entry.neutral++;

            const reviewDate = new Date(r.date);
            if (reviewDate >= sixMonthsAgo) {
                entry.recentTotal++;
                if (sentimentUpper === 'NEGATIVE') entry.recentNeg++;
            } else {
                entry.olderTotal++;
                if (sentimentUpper === 'NEGATIVE') entry.olderNeg++;
            }

            if (!entry.sampleReview && r.text && r.text.length > 10) {
                entry.sampleReview = r.text.length > 150 ? r.text.substring(0, 150) + '...' : r.text;
            }
        });

        return Object.entries(productMap)
            .filter(([, data]) => data.total >= 2)
            .map(([product, data]): ProductSKU => {
                const negativeRate = data.total > 0 ? (data.negative / data.total) * 100 : 0;
                const positiveRate = data.total > 0 ? (data.positive / data.total) * 100 : 0;
                const avgRating = data.total > 0 ? data.ratingSum / data.total : 0;

                const recentNegRate = data.recentTotal > 0 ? (data.recentNeg / data.recentTotal) * 100 : 0;
                const olderNegRate = data.olderTotal > 0 ? (data.olderNeg / data.olderTotal) * 100 : 0;

                let trend: 'improving' | 'stable' | 'declining' = 'stable';
                if (data.recentTotal >= 3 && data.olderTotal >= 3) {
                    if (recentNegRate > olderNegRate + 10) trend = 'declining';
                    else if (recentNegRate < olderNegRate - 10) trend = 'improving';
                }

                return {
                    product,
                    total: data.total,
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

    if (!characteristic) return null;

    return (
        <AnimatePresence>
            {characteristic && (
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
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white capitalize">
                                        {characteristic}
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Product-level analysis • {sentimentBreakdown.total.toLocaleString()} mentions
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ThumbsUp className="text-green-500" size={18} />
                                        <span className="text-xs font-medium text-slate-500">Positive</span>
                                    </div>
                                    <div className="text-2xl font-bold text-green-600">{sentimentBreakdown.positiveRate}%</div>
                                    <div className="text-xs text-slate-400">{sentimentBreakdown.positive} reviews</div>
                                </div>

                                <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-500/10 dark:to-orange-500/10 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ThumbsDown className="text-red-500" size={18} />
                                        <span className="text-xs font-medium text-slate-500">Negative</span>
                                    </div>
                                    <div className="text-2xl font-bold text-red-600">{sentimentBreakdown.negativeRate}%</div>
                                    <div className="text-xs text-slate-400">{sentimentBreakdown.negative} reviews</div>
                                </div>

                                <div className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-500/10 dark:to-gray-500/10 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Minus className="text-slate-500" size={18} />
                                        <span className="text-xs font-medium text-slate-500">Neutral</span>
                                    </div>
                                    <div className="text-2xl font-bold text-slate-600">{sentimentBreakdown.neutralRate}%</div>
                                    <div className="text-xs text-slate-400">{sentimentBreakdown.neutral} reviews</div>
                                </div>

                                <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Target className="text-indigo-500" size={18} />
                                        <span className="text-xs font-medium text-slate-500">Health Score</span>
                                    </div>
                                    <div className="text-2xl font-bold text-indigo-600">{sentimentBreakdown.healthScore}</div>
                                    <div className="text-xs text-slate-400 flex items-center gap-1">
                                        {trendDirection === 'improving' && <><TrendingUp size={12} className="text-green-500" /> Improving</>}
                                        {trendDirection === 'declining' && <><TrendingDown size={12} className="text-red-500" /> Declining</>}
                                        {trendDirection === 'stable' && 'Stable'}
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
                                                        onClick={() => handleProductSort('negRate')}
                                                    >
                                                        <div className="flex items-center justify-center gap-1">
                                                            Neg % {renderSortIcon('negRate')}
                                                        </div>
                                                    </th>
                                                    <th className="text-center py-3 px-3 font-semibold text-slate-600 dark:text-slate-300">
                                                        Pos %
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
                                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sku.negativeRate > 50 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                                                sku.negativeRate > 30 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                                                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                            }`}>
                                                                            {sku.negativeRate.toFixed(0)}%
                                                                        </span>
                                                                    </td>
                                                                    <td className="text-center py-3 px-3">
                                                                        <span className={`text-xs font-medium ${sku.positiveRate > 60 ? 'text-green-600' : 'text-slate-500'
                                                                            }`}>
                                                                            {sku.positiveRate.toFixed(0)}%
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
                                                                            <span className="inline-flex items-center gap-0.5 text-xs text-red-600">
                                                                                <ArrowUpRight size={12} /> Worse
                                                                            </span>
                                                                        )}
                                                                        {sku.trend === 'improving' && (
                                                                            <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
                                                                                <ArrowDownRight size={12} /> Better
                                                                            </span>
                                                                        )}
                                                                        {sku.trend === 'stable' && (
                                                                            <span className="text-xs text-slate-400">—</span>
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
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                                        <BarChart3 className="text-indigo-500" size={20} />
                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            Sub-Issue Breakdown
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {subcategoryData.map((sub, idx) => (
                                            <motion.div
                                                key={sub.subcategory}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.04 }}
                                                className="p-3 px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-lg ${sub.negativeRate > 50 ? 'bg-red-100 dark:bg-red-900/20' :
                                                            sub.negativeRate > 30 ? 'bg-orange-100 dark:bg-orange-900/20' :
                                                                'bg-green-100 dark:bg-green-900/20'
                                                        }`}>
                                                        {sub.negativeRate > 50 ? (
                                                            <AlertTriangle size={14} className="text-red-500" />
                                                        ) : sub.negativeRate > 30 ? (
                                                            <AlertTriangle size={14} className="text-orange-500" />
                                                        ) : (
                                                            <CheckCircle size={14} className="text-green-500" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-sm text-slate-700 dark:text-slate-300">
                                                            {sub.subcategory.replace(/_/g, ' ')}
                                                        </span>
                                                        {sub.topProduct && (
                                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                                Most affected: {sub.topProduct.length > 40 ? sub.topProduct.substring(0, 40) + '...' : sub.topProduct}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-400">{sub.total} mentions</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sub.negativeRate > 50 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                            sub.negativeRate > 30 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        }`}>
                                                        {sub.negativeRate.toFixed(0)}% neg
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
                                        <BarChart3 className="text-indigo-500" size={20} />
                                        <h3 className="font-bold text-slate-900 dark:text-white">📜 Review Timeline</h3>
                                        <span className="text-xs text-slate-400">{relevantReviews.filter(r => r.text && r.text.length > 0).length} reviews</span>
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
                                            <div className="space-y-4 p-4 pt-0">
                                                {(() => {
                                                    const reviewsWithText = relevantReviews
                                                        .filter(r => r.text && r.text.length > 0)
                                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                                    
                                                    const totalReviewPages = Math.ceil(reviewsWithText.length / REVIEW_PAGE_SIZE);
                                                    const paginatedReviews = reviewsWithText.slice((reviewPage - 1) * REVIEW_PAGE_SIZE, reviewPage * REVIEW_PAGE_SIZE);
                                                    
                                                    return (
                                                        <>
                                                            {paginatedReviews.map((review) => (
                                                                <div key={review.id} className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700">
                                                                    <div className={`absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full ${review.sentiment === 'Positive' ? 'bg-green-500' :
                                                                            review.sentiment === 'Negative' ? 'bg-red-500' : 'bg-slate-400'
                                                                        }`} />

                                                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${review.sentiment === 'Positive' ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400' :
                                                                                        review.sentiment === 'Negative' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                                                                                            'bg-slate-100 text-slate-600 dark:bg-slate-600/30 dark:text-slate-400'
                                                                                    }`}>
                                                                                    {review.sentiment}
                                                                                </span>
                                                                                <div className="flex items-center gap-0.5">
                                                                                    {[...Array(5)].map((_, i) => (
                                                                                        <Star
                                                                                            key={i}
                                                                                            size={10}
                                                                                            className={i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}
                                                                                        />
                                                                                    ))}
                                                                                </div>
                                                                                {review.product && (
                                                                                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded font-medium">
                                                                                        {review.product.length > 30 ? review.product.substring(0, 30) + '...' : review.product}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-xs text-slate-400">
                                                                                {new Date(review.date).toLocaleDateString('en-US', {
                                                                                    year: 'numeric',
                                                                                    month: 'short',
                                                                                    day: 'numeric'
                                                                                })}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-sm text-slate-600 dark:text-slate-400">
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
                                                    <p className="text-sm text-slate-400 text-center py-8">No reviews with text available for this characteristic</p>
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

export default CharacteristicDetailPanel;
