import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Target, TrendingUp, TrendingDown, ChevronRight, ArrowLeft,
    Star, AlertTriangle, CheckCircle, Award, Users, BarChart3,
    Zap, Shield, Package, ThumbsUp, MessageSquare, ArrowUpDown, ChevronUp, ChevronDown,
    Grid3X3, Layers
} from 'lucide-react';
import SegmentMatrixView from './SegmentMatrixView';
import { PriceVarianceStrip } from './PriceVarianceStrip';
import { StarDistributionChart } from './StarDistributionChart';
import type { Review } from '../types';
import type { ProductCategory } from '../hooks/useRatingsAPI';

// V7 Taxonomy Categories
const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
    Quality: { icon: Shield, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-900/20' },
    Performance: { icon: Zap, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
    Usability: { icon: Users, color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20' },
    Value: { icon: TrendingUp, color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' },
    Safety: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20' },
    Customer_Service: { icon: MessageSquare, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-900/20' },
    Delivery: { icon: Package, color: 'text-teal-600', bgColor: 'bg-teal-50 dark:bg-teal-900/20' },
    General: { icon: BarChart3, color: 'text-gray-600', bgColor: 'bg-gray-50 dark:bg-gray-900/20' },
    Brand: { icon: Award, color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20' }
};

interface CompetitorProduct {
    productId: string;
    name: string;
    brand: string;
    category: string;
}

interface Props {
    prestigeCatalog: unknown[];
    competitorProducts: CompetitorProduct[];
    competitorReviews: Review[];
    prestigeReviews: Review[];
    skuMappings: unknown[];
    onCategorySelect?: (category: string | null) => void;
    externalSelectedCategory?: string | null;
    allCategories?: ProductCategory[];
}

type ViewLevel = 'overview' | 'category' | 'subcategory';
type ViewMode = 'feedback' | 'segments';

export default function CompetitorIntelligence({
    competitorProducts,
    competitorReviews,
    prestigeReviews,
    onCategorySelect,
    externalSelectedCategory,
    allCategories,
}: Props) {
    const [viewLevel, setViewLevel] = useState<ViewLevel>('overview');
    const [viewMode, setViewMode] = useState<ViewMode>('segments');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
    const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
    const [sortColumn, setSortColumn] = useState<'category' | 'prestige' | 'reviews' | 'issues'>('reviews');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [platformFilter, setPlatformFilter] = useState<'all' | 'amazon' | 'flipkart'>('all');

    const handleSort = (column: typeof sortColumn) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    };

    const renderSortIcon = (column: typeof sortColumn) => {
        if (sortColumn !== column) return <ArrowUpDown size={14} className="text-gray-400" />;
        return sortDirection === 'asc'
            ? <ChevronUp size={14} className="text-purple-600" />
            : <ChevronDown size={14} className="text-purple-600" />;
    };

    // Platform-filtered competitor reviews
    const filteredCompetitorReviews = useMemo(() => {
        if (platformFilter === 'all') return competitorReviews;
        return competitorReviews.filter(r =>
            (r.platform || 'amazon').toLowerCase() === platformFilter
        );
    }, [competitorReviews, platformFilter]);

    // Normalize generic brands into 'Other'
    const normalizeBrand = (brand: string): string => {
        if (!brand) return 'Other';
        if (brand.startsWith('Competitor (') || brand === 'Competitor' || brand === 'Unknown') return 'Other';
        if (brand === 'The') return 'Other'; // incomplete brand name
        if (brand.trim().length <= 2) return 'Other'; // abbreviated/junk brands like 'CK'
        return brand;
    };

    // Build canonical brand mapping: merge case variants (VINOD+Vinod→Vinod, IBELL+iBELL→iBELL)
    const brandCaseMap = useMemo(() => {
        const countByBrand: Record<string, number> = {};
        competitorReviews.forEach(r => {
            const b = normalizeBrand(r.brand || 'Other');
            if (b !== 'Other') countByBrand[b] = (countByBrand[b] || 0) + 1;
        });
        // Group by lowercase → pick the variant with most reviews as canonical
        const groups: Record<string, { name: string; count: number }[]> = {};
        Object.entries(countByBrand).forEach(([name, count]) => {
            const key = name.toLowerCase();
            if (!groups[key]) groups[key] = [];
            groups[key].push({ name, count });
        });
        const mapping: Record<string, string> = {};
        Object.values(groups).forEach(variants => {
            variants.sort((a, b) => b.count - a.count);
            const canonical = variants[0].name;
            variants.forEach(v => { mapping[v.name] = canonical; });
        });
        return mapping;
    }, [competitorReviews]);

    // Get all reviews combined with normalized brand label
    const allReviews = useMemo(() => {
        const nbf = (brand: string) => { const base = normalizeBrand(brand); return brandCaseMap[base] || base; };
        const prestige = prestigeReviews.map(r => ({ ...r, brand: 'Prestige' }));
        const competitors = filteredCompetitorReviews.map(r => ({ ...r, brand: nbf(r.brand || 'Other') }));
        return [...prestige, ...competitors];
    }, [prestigeReviews, filteredCompetitorReviews, brandCaseMap]);

    // Get all competitor brands sorted by review count (top brands first)
    const competitorBrands = useMemo(() => {
        const nbf = (brand: string) => { const base = normalizeBrand(brand); return brandCaseMap[base] || base; };
        const brandCounts: Record<string, number> = {};
        filteredCompetitorReviews.forEach(r => {
            const b = nbf(r.brand || 'Other');
            if (b !== 'Other') brandCounts[b] = (brandCounts[b] || 0) + 1;
        });
        competitorProducts.forEach(p => {
            const b = nbf(p.brand);
            if (b !== 'Other' && !brandCounts[b]) brandCounts[b] = 0;
        });
        // Sort by review count descending, 'Other' always last
        const sorted = Object.entries(brandCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);
        // Add 'Other' at end if any reviews mapped to it
        const hasOther = filteredCompetitorReviews.some(r => nbf(r.brand || 'Other') === 'Other');
        if (hasOther) sorted.push('Other');
        return sorted;
    }, [competitorProducts, filteredCompetitorReviews, brandCaseMap]);

    // Top 5 brands for card display (all brands still used for comparison table)
    const topBrands = useMemo(() => competitorBrands.filter(b => b !== 'Other').slice(0, 5), [competitorBrands]);

    // Calculate brand metrics
    const brandMetrics = useMemo(() => {
        const metrics: Record<string, {
            total: number;
            positive: number;
            negative: number;
            avgRating: number;
            categories: Record<string, { total: number; negative: number }>
        }> = {};

        // Initialize Prestige and competitors
        metrics['Prestige'] = { total: 0, positive: 0, negative: 0, avgRating: 0, categories: {} };
        competitorBrands.forEach(b => {
            metrics[b] = { total: 0, positive: 0, negative: 0, avgRating: 0, categories: {} };
        });

        allReviews.forEach(r => {
            const brand = r.brand || 'Unknown';
            if (!metrics[brand]) return;

            metrics[brand].total++;
            metrics[brand].avgRating += r.rating || 3;

            const sentimentLower = (r.sentiment || '').toLowerCase();
            const isNegative = sentimentLower === 'negative' || (r.rating && r.rating <= 2);
            const isPositive = sentimentLower === 'positive' || (r.rating && r.rating >= 4);

            if (isNegative) metrics[brand].negative++;
            if (isPositive) metrics[brand].positive++;

            const category = r.sentimentCategory || 'General';
            if (!metrics[brand].categories[category]) {
                metrics[brand].categories[category] = { total: 0, negative: 0 };
            }
            metrics[brand].categories[category].total++;
            if (isNegative) metrics[brand].categories[category].negative++;
        });

        // Calculate averages
        Object.keys(metrics).forEach(brand => {
            if (metrics[brand].total > 0) {
                metrics[brand].avgRating = metrics[brand].avgRating / metrics[brand].total;
            }
        });

        return metrics;
    }, [allReviews, competitorBrands]);

    // Category comparison data
    const categoryComparison = useMemo(() => {
        const categories = Object.keys(CATEGORY_CONFIG);

        return categories.map(category => {
            const prestigeData = brandMetrics['Prestige']?.categories[category] || { total: 0, negative: 0 };
            const prestigeNegRate = prestigeData.total > 0 ? (prestigeData.negative / prestigeData.total) * 100 : 0;

            let worstCompetitor = { brand: '', negRate: 0, total: 0 };
            let bestCompetitor = { brand: '', negRate: 100, total: 0 };

            competitorBrands.forEach(brand => {
                const data = brandMetrics[brand]?.categories[category];
                if (data && data.total >= 5) {
                    const negRate = (data.negative / data.total) * 100;
                    if (negRate > worstCompetitor.negRate) {
                        worstCompetitor = { brand, negRate, total: data.total };
                    }
                    if (negRate < bestCompetitor.negRate) {
                        bestCompetitor = { brand, negRate, total: data.total };
                    }
                }
            });

            const isPrestigeWinning = prestigeNegRate < worstCompetitor.negRate;
            const advantage = worstCompetitor.negRate - prestigeNegRate;

            return {
                category,
                prestigeNegRate,
                prestigeTotal: prestigeData.total,
                bestCompetitor,
                worstCompetitor,
                isWinning: isPrestigeWinning,
                advantage
            };
        }).filter(c => c.prestigeTotal > 0 || c.worstCompetitor.total > 0)
            .sort((a, b) => {
                let aVal = 0, bVal = 0;
                switch (sortColumn) {
                    case 'category':
                        return sortDirection === 'asc'
                            ? a.category.localeCompare(b.category)
                            : b.category.localeCompare(a.category);
                    case 'prestige':
                        // Calculate prestige avg rating for sorting
                        aVal = prestigeReviews.filter(r => r.sentimentCategory === a.category).reduce((s, r) => s + (r.rating || 3), 0) / Math.max(a.prestigeTotal, 1);
                        bVal = prestigeReviews.filter(r => r.sentimentCategory === b.category).reduce((s, r) => s + (r.rating || 3), 0) / Math.max(b.prestigeTotal, 1);
                        break;
                    case 'reviews':
                        aVal = a.prestigeTotal;
                        bVal = b.prestigeTotal;
                        break;
                    case 'issues':
                        aVal = a.prestigeNegRate;
                        bVal = b.prestigeNegRate;
                        break;
                }
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            });
    }, [brandMetrics, competitorBrands, sortColumn, sortDirection, prestigeReviews]);

    // Subcategory comparison for selected category
    const subcategoryComparison = useMemo(() => {
        if (!selectedCategory) return [];

        const subcatMap: Record<string, Record<string, { total: number; negative: number }>> = {};

        allReviews.forEach(r => {
            if (r.sentimentCategory !== selectedCategory) return;
            const brand = r.brand || 'Unknown';
            const subcategory = r.subcategory || 'General_Feedback';

            if (!subcatMap[subcategory]) subcatMap[subcategory] = {};
            if (!subcatMap[subcategory][brand]) subcatMap[subcategory][brand] = { total: 0, negative: 0 };

            subcatMap[subcategory][brand].total++;
            const sentimentLower = (r.sentiment || '').toLowerCase();
            if (sentimentLower === 'negative' || (r.rating && r.rating <= 2)) {
                subcatMap[subcategory][brand].negative++;
            }
        });

        return Object.entries(subcatMap)
            .map(([subcategory, brands]) => {
                const prestigeData = brands['Prestige'] || { total: 0, negative: 0 };
                const prestigeNegRate = prestigeData.total > 0 ? (prestigeData.negative / prestigeData.total) * 100 : 0;

                // Calculate competitor average
                let compTotal = 0, compNegative = 0;
                competitorBrands.forEach(b => {
                    if (brands[b]) {
                        compTotal += brands[b].total;
                        compNegative += brands[b].negative;
                    }
                });
                const compNegRate = compTotal > 0 ? (compNegative / compTotal) * 100 : 0;

                return {
                    subcategory,
                    prestigeNegRate,
                    prestigeTotal: prestigeData.total,
                    compNegRate,
                    compTotal,
                    isWinning: prestigeNegRate < compNegRate,
                    brands
                };
            })
            .filter(s => s.prestigeTotal > 0 || s.compTotal > 0)
            .sort((a, b) => (b.prestigeTotal + b.compTotal) - (a.prestigeTotal + a.compTotal));
    }, [selectedCategory, allReviews, competitorBrands]);

    // Product level data for selected subcategory
    const productData = useMemo(() => {
        if (!selectedSubcategory) return [];

        const productMap: Record<string, {
            product: string;
            brand: string;
            total: number;
            negative: number;
            positive: number;
            avgRating: number;
            sampleReviews: string[];
        }> = {};

        allReviews.forEach(r => {
            if (r.subcategory !== selectedSubcategory) return;
            const brand = r.brand || 'Unknown';
            const product = r.product || r.productName || 'Unknown Product';
            const key = `${brand}::${product}`;

            if (!productMap[key]) {
                productMap[key] = { product, brand, total: 0, negative: 0, positive: 0, avgRating: 0, sampleReviews: [] };
            }

            productMap[key].total++;
            productMap[key].avgRating += r.rating || 3;

            const sentimentLower = (r.sentiment || '').toLowerCase();
            if (sentimentLower === 'negative' || (r.rating && r.rating <= 2)) {
                productMap[key].negative++;
            }
            if (sentimentLower === 'positive' || (r.rating && r.rating >= 4)) {
                productMap[key].positive++;
            }
            if (r.text && productMap[key].sampleReviews.length < 2) {
                productMap[key].sampleReviews.push(r.text);
            }
        });

        return Object.values(productMap)
            .map(p => ({ ...p, avgRating: p.total > 0 ? p.avgRating / p.total : 0 }))
            .filter(p => p.total >= 2)
            .sort((a, b) => b.total - a.total)
            .slice(0, 15);
    }, [selectedSubcategory, allReviews]);

    const goToCategory = (category: string) => {
        setSelectedCategory(category);
        setViewLevel('category');
    };

    const goToSubcategory = (subcategory: string) => {
        setSelectedSubcategory(subcategory);
        setViewLevel('subcategory');
    };

    const goBack = () => {
        if (viewLevel === 'subcategory') {
            setSelectedSubcategory(null);
            setViewLevel('category');
        } else if (viewLevel === 'category') {
            setSelectedCategory(null);
            setViewLevel('overview');
        }
    };

    const renderStars = (rating: number) => (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
                <Star key={star} size={11} className={star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'} />
            ))}
        </div>
    );

    // Prestige summary card
    const prestigeData = brandMetrics['Prestige'];
    const prestigePositiveRate = prestigeData.total > 0 ? (prestigeData.positive / prestigeData.total) * 100 : 0;

    // Brand SKU drill-down — top SKUs for the expanded brand
    const brandSkus = useMemo(() => {
        if (!expandedBrand) return [];
        const skuMap: Record<string, { product: string; total: number; avgRating: number; positive: number; negative: number; sampleReviews: string[] }> = {};

        const reviewsForBrand = expandedBrand === 'Prestige'
            ? prestigeReviews
            : filteredCompetitorReviews.filter(r => {
                const base = normalizeBrand(r.brand || 'Other');
                const canonical = brandCaseMap[base] || base;
                return canonical === expandedBrand;
            });

        reviewsForBrand.forEach(r => {
            const product = r.product || r.productName || 'Unknown Product';
            if (!skuMap[product]) skuMap[product] = { product, total: 0, avgRating: 0, positive: 0, negative: 0, sampleReviews: [] };
            skuMap[product].total++;
            skuMap[product].avgRating += r.rating || 3;
            const sentLow = (r.sentiment || '').toLowerCase();
            if (sentLow === 'positive' || (r.rating && r.rating >= 4)) skuMap[product].positive++;
            if (sentLow === 'negative' || (r.rating && r.rating <= 2)) skuMap[product].negative++;
            if (r.text && skuMap[product].sampleReviews.length < 1) skuMap[product].sampleReviews.push(r.text);
        });

        return Object.values(skuMap)
            .map(s => ({ ...s, avgRating: s.total > 0 ? s.avgRating / s.total : 0 }))
            .filter(s => s.total >= 2)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
    }, [expandedBrand, prestigeReviews, filteredCompetitorReviews, brandCaseMap]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    {viewLevel !== 'overview' && (
                        <motion.button
                            onClick={goBack}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <ArrowLeft size={18} />
                        </motion.button>
                    )}
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Target className="text-purple-500" size={22} />
                            Competitor Intelligence
                        </h2>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                            <button onClick={() => { setViewLevel('overview'); setSelectedCategory(null); setSelectedSubcategory(null); }} className={viewLevel === 'overview' ? 'text-purple-600 font-medium' : 'hover:text-purple-600'}>
                                Overview
                            </button>
                            {selectedCategory && (
                                <>
                                    <ChevronRight size={14} />
                                    <button onClick={() => { setViewLevel('category'); setSelectedSubcategory(null); }} className={viewLevel === 'category' ? 'text-purple-600 font-medium' : 'hover:text-purple-600'}>
                                        {selectedCategory}
                                    </button>
                                </>
                            )}
                            {selectedSubcategory && (
                                <>
                                    <ChevronRight size={14} />
                                    <span className="text-purple-600 font-medium">{selectedSubcategory.replace(/_/g, ' ')}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* View Mode Toggle */}
                {viewLevel === 'overview' && (
                    <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 gap-1">
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setViewMode('segments')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'segments'
                                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                }`}
                        >
                            <Grid3X3 size={13} /> Segment Matrix
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setViewMode('feedback')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'feedback'
                                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                }`}
                        >
                            <Layers size={13} /> Feedback Analysis
                        </motion.button>
                    </div>
                )}

                {/* Platform Filter Tabs */}
                {viewLevel === 'overview' && (
                    <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 gap-1">
                        {(['all', 'amazon', 'flipkart'] as const).map(p => (
                            <motion.button
                                key={p}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setPlatformFilter(p)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${platformFilter === p
                                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                    }`}
                            >
                                {p === 'all' ? '🌐 All' : p === 'amazon' ? '🛒 Amazon' : '🏪 Flipkart'}
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
                {/* Segment Matrix View */}
                {viewLevel === 'overview' && viewMode === 'segments' && (
                    <motion.div
                        key="segment-matrix"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        {externalSelectedCategory && (
                            <>
                                <PriceVarianceStrip category={externalSelectedCategory} />
                                <StarDistributionChart category={externalSelectedCategory} />
                            </>
                        )}
                        <SegmentMatrixView
                            prestigeReviews={prestigeReviews}
                            competitorReviews={filteredCompetitorReviews}
                            onCategorySelect={onCategorySelect}
                            externalSelectedCategory={externalSelectedCategory}
                            allCategories={allCategories}
                        />
                    </motion.div>
                )}

                {/* Feedback Analysis Overview Level */}
                {viewLevel === 'overview' && viewMode === 'feedback' && (
                    <motion.div
                        key="overview"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        {/* Brand Summary Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Prestige Card - Highlighted */}
                            <div className="card p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Award className="text-purple-500" size={20} />
                                        <span className="font-bold text-purple-700 dark:text-purple-300">Prestige</span>
                                    </div>
                                    <span className="text-xs px-2 py-1 bg-purple-500 text-white rounded-full">Your Brand</span>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    {renderStars(prestigeData.avgRating)}
                                    <span className="text-sm font-medium">{prestigeData.avgRating.toFixed(1)}</span>
                                    <span className="text-[10px] text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1">User Rating</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="flex items-center gap-1">
                                        <ThumbsUp size={14} className="text-green-500" />
                                        <span className="text-green-600 font-medium">{prestigePositiveRate.toFixed(0)}%</span>
                                        <span className="text-gray-500">positive</span>
                                    </div>
                                    <div className="text-right text-gray-500">
                                        {prestigeData.total.toLocaleString()} reviews
                                    </div>
                                </div>
                            </div>

                            {/* Competitor summary cards — click to expand 5 parameter comparison */}
                            {topBrands.map(brand => {
                                const data = brandMetrics[brand];
                                const positiveRate = data.total > 0 ? (data.positive / data.total) * 100 : 0;
                                const isExpanded = expandedBrand === brand;
                                return (
                                    <motion.div key={brand}
                                        onClick={() => setExpandedBrand(isExpanded ? null : brand)}
                                        className={`card p-4 cursor-pointer transition-all ${isExpanded ? 'ring-2 ring-purple-400 dark:ring-purple-600' : 'hover:ring-1 hover:ring-purple-200 dark:hover:ring-purple-800'}`}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">{brand}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full">Competitor</span>
                                                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            {renderStars(data.avgRating)}
                                            <span className="text-sm font-medium">{data.avgRating.toFixed(1)}</span>
                                            <span className="text-[10px] text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1">User Rating</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="flex items-center gap-1">
                                                <ThumbsUp size={14} className={positiveRate >= prestigePositiveRate ? 'text-green-500' : 'text-orange-500'} />
                                                <span className={positiveRate >= prestigePositiveRate ? 'text-green-600' : 'text-orange-600'}>{positiveRate.toFixed(0)}%</span>
                                                <span className="text-gray-500">positive</span>
                                            </div>
                                            <div className="text-right text-gray-500">
                                                {data.total.toLocaleString()} reviews
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* 5-Parameter Brand Comparison Panel */}
                        <AnimatePresence>
                            {expandedBrand && brandMetrics[expandedBrand] && (
                                <motion.div
                                    key="brand-comparison"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="card p-6 overflow-hidden"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <BarChart3 className="text-purple-500" size={20} />
                                            Prestige vs {expandedBrand} — 5 Sentiment Parameters
                                        </h3>
                                        <button onClick={() => setExpandedBrand(null)} className="text-xs text-gray-500 hover:text-gray-700">
                                            Close
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {['Quality', 'Performance', 'Value', 'General', 'Delivery'].map(param => {
                                            const pData = brandMetrics['Prestige']?.categories[param] || { total: 0, negative: 0 };
                                            const cData = brandMetrics[expandedBrand]?.categories[param] || { total: 0, negative: 0 };
                                            const pTotal = brandMetrics['Prestige']?.total || 1;
                                            const cTotal = brandMetrics[expandedBrand]?.total || 1;
                                            const pPct = (pData.total / pTotal) * 100;
                                            const cPct = (cData.total / cTotal) * 100;
                                            const pNegPct = pData.total > 0 ? (pData.negative / pData.total) * 100 : 0;
                                            const cNegPct = cData.total > 0 ? (cData.negative / cData.total) * 100 : 0;
                                            const config = CATEGORY_CONFIG[param] || CATEGORY_CONFIG.General;
                                            const Icon = config.icon;
                                            return (
                                                <div key={param} className="grid grid-cols-[140px_1fr_1fr] gap-3 items-center">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1 rounded ${config.bgColor}`}>
                                                            <Icon className={config.color} size={12} />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{param}</span>
                                                    </div>
                                                    {/* Prestige bar */}
                                                    <div>
                                                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                                                            <span className="text-purple-600 font-medium">Prestige</span>
                                                            <span className="text-gray-500">{pPct.toFixed(1)}% ({pData.total.toLocaleString()}) · {pNegPct.toFixed(0)}% neg</span>
                                                        </div>
                                                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-600" style={{ width: `${Math.min(pPct * 2, 100)}%` }} />
                                                        </div>
                                                    </div>
                                                    {/* Competitor bar */}
                                                    <div>
                                                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                                                            <span className="text-indigo-600 font-medium">{expandedBrand}</span>
                                                            <span className="text-gray-500">{cPct.toFixed(1)}% ({cData.total.toLocaleString()}) · {cNegPct.toFixed(0)}% neg</span>
                                                        </div>
                                                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600" style={{ width: `${Math.min(cPct * 2, 100)}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
                                        Click parameter bar for detailed review comparison
                                    </div>

                                    {/* SKU Drill-Down for expanded brand */}
                                    {brandSkus.length > 0 && (
                                        <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                                <Package size={16} className="text-purple-500" />
                                                Top SKUs — {expandedBrand}
                                                <span className="text-[10px] text-gray-400 font-normal">({brandSkus.length} products)</span>
                                            </h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                                            <th className="text-left py-2 px-3 text-[11px] font-medium text-gray-500">Product</th>
                                                            <th className="text-center py-2 px-3 text-[11px] font-medium text-gray-500">Reviews</th>
                                                            <th className="text-center py-2 px-3 text-[11px] font-medium text-gray-500">User Rating</th>
                                                            <th className="text-center py-2 px-3 text-[11px] font-medium text-gray-500">Positive %</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {brandSkus.map((sku, idx) => {
                                                            const posPct = sku.total > 0 ? Math.round((sku.positive / sku.total) * 100) : 0;
                                                            return (
                                                                <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300 max-w-xs">
                                                                        <span className="block truncate" title={sku.product}>{sku.product.split(' ').slice(0, 6).join(' ')}</span>
                                                                        {sku.sampleReviews[0] && (
                                                                            <span className="text-[10px] text-gray-400 block truncate italic mt-0.5">
                                                                                &ldquo;{sku.sampleReviews[0].slice(0, 80)}...&rdquo;
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-center font-medium">{sku.total}</td>
                                                                    <td className="py-2 px-3 text-center">
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <Star size={11} className="text-yellow-500 fill-yellow-500" />
                                                                            {sku.avgRating.toFixed(1)}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 px-3 text-center">
                                                                        <span className={`font-medium ${posPct >= 60 ? 'text-green-600' : posPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                                                            {posPct}%
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Category Comparison - Similar to Pain Points / Strengths */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Where Prestige Wins */}
                            <div className="card overflow-hidden">
                                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                                        <CheckCircle className="text-green-600" size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-green-700 dark:text-green-400">Competitive Advantages</h3>
                                        <p className="text-xs text-gray-500">Categories where Prestige outperforms</p>
                                    </div>
                                </div>
                                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {categoryComparison.filter(c => c.isWinning && c.advantage > 5).slice(0, 5).map((cat, idx) => {
                                        const config = CATEGORY_CONFIG[cat.category] || CATEGORY_CONFIG.General;
                                        const Icon = config.icon;
                                        return (
                                            <motion.div
                                                key={cat.category}
                                                onClick={() => goToCategory(cat.category)}
                                                className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                                                whileHover={{ x: 4 }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-400 font-medium w-5">{idx + 1}.</span>
                                                    <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                                                        <Icon className={config.color} size={14} />
                                                    </div>
                                                    <span className="font-medium">{cat.category}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                        +{cat.advantage.toFixed(0)}% better
                                                    </span>
                                                    <ChevronRight size={16} className="text-gray-400" />
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                    {categoryComparison.filter(c => c.isWinning && c.advantage > 5).length === 0 && (
                                        <div className="p-4 text-sm text-gray-500 text-center">No clear advantages detected</div>
                                    )}
                                </div>
                            </div>

                            {/* Where Prestige Needs Improvement */}
                            <div className="card overflow-hidden">
                                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                                        <AlertTriangle className="text-red-600" size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-red-700 dark:text-red-400">Areas for Improvement</h3>
                                        <p className="text-xs text-gray-500">Categories where competitors lead</p>
                                    </div>
                                </div>
                                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {categoryComparison.filter(c => !c.isWinning || c.advantage < 5).slice(0, 5).map((cat, idx) => {
                                        const config = CATEGORY_CONFIG[cat.category] || CATEGORY_CONFIG.General;
                                        const Icon = config.icon;
                                        return (
                                            <motion.div
                                                key={cat.category}
                                                onClick={() => goToCategory(cat.category)}
                                                className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                                                whileHover={{ x: 4 }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-400 font-medium w-5">{idx + 1}.</span>
                                                    <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                                                        <Icon className={config.color} size={14} />
                                                    </div>
                                                    <span className="font-medium">{cat.category}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                        {cat.prestigeNegRate.toFixed(0)}% issues
                                                    </span>
                                                    <ChevronRight size={16} className="text-gray-400" />
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Hierarchical Category Explorer */}
                        <div className="card overflow-hidden">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={18} className="text-purple-500" />
                                    <h3 className="font-bold text-gray-900 dark:text-white">Category Hierarchy Explorer</h3>
                                </div>
                                <div className="text-xs text-gray-500">Click rows to expand</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                                            <th
                                                className="text-left p-3 font-semibold min-w-[200px] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                                onClick={() => handleSort('category')}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    Category / Sub-category
                                                    {renderSortIcon('category')}
                                                </div>
                                            </th>
                                            <th
                                                className="text-center p-3 font-semibold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                                onClick={() => handleSort('prestige')}
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className="text-purple-600">Prestige</span>
                                                    {renderSortIcon('prestige')}
                                                </div>
                                            </th>
                                            {competitorBrands.slice(0, 3).map(brand => (
                                                <th key={brand} className="text-center p-3 font-semibold">
                                                    <span className="text-orange-600">{brand}</span>
                                                </th>
                                            ))}
                                            <th className="text-center p-3 font-semibold">Δ Best</th>
                                            <th
                                                className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                                onClick={() => handleSort('reviews')}
                                            >
                                                <div className="flex items-center justify-end gap-1.5">
                                                    Review Count
                                                    {renderSortIcon('reviews')}
                                                </div>
                                            </th>
                                            <th
                                                className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                                onClick={() => handleSort('issues')}
                                            >
                                                <div className="flex items-center justify-end gap-1.5">
                                                    Issues %
                                                    {renderSortIcon('issues')}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categoryComparison.map(cat => {
                                            const config = CATEGORY_CONFIG[cat.category] || CATEGORY_CONFIG.General;
                                            const Icon = config.icon;
                                            const isExpanded = selectedCategory === cat.category && viewLevel === 'overview';

                                            // Calculate Prestige avg rating for this category
                                            const prestigeCatReviews = prestigeReviews.filter(r => r.sentimentCategory === cat.category);
                                            const prestigeAvgRating = prestigeCatReviews.length > 0
                                                ? prestigeCatReviews.reduce((s, r) => s + (r.rating || 3), 0) / prestigeCatReviews.length
                                                : 0;

                                            // Calculate each competitor avg rating for this category
                                            const compRatings: Record<string, { avg: number; count: number }> = {};
                                            competitorBrands.forEach(brand => {
                                                const reviews = competitorReviews.filter(r => r.brand === brand && r.sentimentCategory === cat.category);
                                                compRatings[brand] = {
                                                    avg: reviews.length > 0 ? reviews.reduce((s, r) => s + (r.rating || 3), 0) / reviews.length : 0,
                                                    count: reviews.length
                                                };
                                            });

                                            // Find best competitor
                                            const bestComp = competitorBrands.reduce((best, brand) =>
                                                compRatings[brand].avg > (compRatings[best]?.avg || 0) ? brand : best
                                                , competitorBrands[0]);
                                            const delta = prestigeAvgRating - (compRatings[bestComp]?.avg || 0);
                                            const isWinning = delta > 0;

                                            // Get subcategories for this category with competitor data
                                            const subcats = isExpanded ?
                                                Object.entries(
                                                    [...prestigeReviews, ...competitorReviews]
                                                        .filter(r => r.sentimentCategory === cat.category)
                                                        .reduce((acc, r) => {
                                                            const sub = r.subcategory || 'General';
                                                            const brand = r.brand || 'Prestige';
                                                            if (!acc[sub]) acc[sub] = {
                                                                prestige: { total: 0, sum: 0, neg: 0 },
                                                                competitors: {} as Record<string, { total: number; sum: number; neg: number }>
                                                            };

                                                            if (brand === 'Prestige') {
                                                                acc[sub].prestige.total++;
                                                                acc[sub].prestige.sum += r.rating || 3;
                                                                if ((r.rating || 3) <= 2) acc[sub].prestige.neg++;
                                                            } else {
                                                                if (!acc[sub].competitors[brand]) acc[sub].competitors[brand] = { total: 0, sum: 0, neg: 0 };
                                                                acc[sub].competitors[brand].total++;
                                                                acc[sub].competitors[brand].sum += r.rating || 3;
                                                                if ((r.rating || 3) <= 2) acc[sub].competitors[brand].neg++;
                                                            }
                                                            return acc;
                                                        }, {} as Record<string, {
                                                            prestige: { total: number; sum: number; neg: number };
                                                            competitors: Record<string, { total: number; sum: number; neg: number }>;
                                                        }>)
                                                ).sort((a, b) => (b[1].prestige.total + Object.values(b[1].competitors).reduce((s, c) => s + c.total, 0)) -
                                                    (a[1].prestige.total + Object.values(a[1].competitors).reduce((s, c) => s + c.total, 0))).slice(0, 8)
                                                : [];

                                            return (
                                                <React.Fragment key={cat.category}>
                                                    <tr
                                                        className="border-b border-gray-50 dark:border-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/10 cursor-pointer transition-colors"
                                                        onClick={() => {
                                                            if (isExpanded) {
                                                                setSelectedCategory(null);
                                                            } else {
                                                                setSelectedCategory(cat.category);
                                                            }
                                                        }}
                                                    >
                                                        <td className="p-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-400 w-4">{isExpanded ? '▼' : '▶'}</span>
                                                                <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                                                                    <Icon className={config.color} size={14} />
                                                                </div>
                                                                <span className="font-medium">{cat.category}</span>
                                                            </div>
                                                        </td>
                                                        <td className="text-center p-3">
                                                            <span className="font-bold text-purple-600">{prestigeAvgRating.toFixed(1)}★</span>
                                                        </td>
                                                        {competitorBrands.slice(0, 3).map(brand => (
                                                            <td key={brand} className="text-center p-3">
                                                                <span className={compRatings[brand]?.count > 0 ? 'text-orange-600' : 'text-gray-300'}>
                                                                    {compRatings[brand]?.count > 0 ? `${compRatings[brand].avg.toFixed(1)}★` : '-'}
                                                                </span>
                                                            </td>
                                                        ))}
                                                        <td className="text-center p-3">
                                                            <span className={`font-medium ${isWinning ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                                                {compRatings[bestComp]?.avg > 0 ? `${isWinning ? '+' : ''}${delta.toFixed(2)}` : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="text-right p-3">
                                                            <span className="text-gray-600">{cat.prestigeTotal.toLocaleString()}</span>
                                                        </td>
                                                        <td className="text-right p-3">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs ${cat.prestigeNegRate > 40 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                                cat.prestigeNegRate > 20 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                }`}>
                                                                {cat.prestigeNegRate.toFixed(0)}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    {/* Expanded subcategories with competitor data */}
                                                    {isExpanded && subcats.map(([subName, subData]) => {
                                                        const pAvg = subData.prestige.total > 0 ? subData.prestige.sum / subData.prestige.total : 0;
                                                        const pNegRate = subData.prestige.total > 0 ? (subData.prestige.neg / subData.prestige.total) * 100 : 0;
                                                        const totalReviews = subData.prestige.total + Object.values(subData.competitors).reduce((s, c) => s + c.total, 0);

                                                        return (
                                                            <tr
                                                                key={subName}
                                                                className="border-b border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-purple-50 dark:hover:bg-purple-900/10 cursor-pointer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    goToSubcategory(subName);
                                                                    goToCategory(cat.category);
                                                                }}
                                                            >
                                                                <td className="p-3 pl-12">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-gray-300">└</span>
                                                                        <span className="text-gray-700 dark:text-gray-300">{subName.replace(/_/g, ' ')}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="text-center p-3">
                                                                    <span className="text-purple-600">{subData.prestige.total > 0 ? `${pAvg.toFixed(1)}★` : '-'}</span>
                                                                </td>
                                                                {competitorBrands.slice(0, 3).map(brand => {
                                                                    const compData = subData.competitors[brand];
                                                                    return (
                                                                        <td key={brand} className="text-center p-3">
                                                                            <span className={compData?.total > 0 ? 'text-orange-600' : 'text-gray-300'}>
                                                                                {compData?.total > 0 ? `${(compData.sum / compData.total).toFixed(1)}★` : '-'}
                                                                            </span>
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="text-center p-3 text-gray-400">-</td>
                                                                <td className="text-right p-3 text-gray-600">{totalReviews.toLocaleString()}</td>
                                                                <td className="text-right p-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-xs ${pNegRate > 40 ? 'bg-red-100 text-red-700' :
                                                                        pNegRate > 20 ? 'bg-yellow-100 text-yellow-700' :
                                                                            'bg-green-100 text-green-700'
                                                                        }`}>
                                                                        {pNegRate.toFixed(0)}%
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Category Level */}
                {viewLevel === 'category' && selectedCategory && (
                    <motion.div
                        key="category"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <div className="card overflow-hidden">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    {(() => {
                                        const config = CATEGORY_CONFIG[selectedCategory] || CATEGORY_CONFIG.General;
                                        const Icon = config.icon;
                                        return <Icon className={config.color} size={20} />;
                                    })()}
                                    {selectedCategory} - Issue Breakdown
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">Compare negative sentiment rates by issue type</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                                            <th className="text-left py-3 px-4 font-medium min-w-[180px]">Issue Type</th>
                                            <th className="text-center py-3 px-4 font-medium text-purple-600">Prestige</th>
                                            {competitorBrands.slice(0, 3).map(brand => (
                                                <th key={brand} className="text-center py-3 px-4 font-medium">
                                                    <span className="text-orange-600">{brand}</span>
                                                </th>
                                            ))}
                                            <th className="text-center py-3 px-4 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subcategoryComparison.map(sub => {
                                            // Determine best competitor for status
                                            let bestCompNegRate = 100;
                                            competitorBrands.forEach(b => {
                                                const bData = sub.brands[b];
                                                if (bData && bData.total > 0) {
                                                    const bNeg = (bData.negative / bData.total) * 100;
                                                    if (bNeg < bestCompNegRate) bestCompNegRate = bNeg;
                                                }
                                            });
                                            const isWinningVsBest = sub.prestigeNegRate <= bestCompNegRate;

                                            return (
                                                <motion.tr
                                                    key={sub.subcategory}
                                                    onClick={() => goToSubcategory(sub.subcategory)}
                                                    className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                                                    whileHover={{ x: 4 }}
                                                >
                                                    <td className="py-3 px-4 font-medium">{sub.subcategory.replace(/_/g, ' ')}</td>
                                                    <td className="text-center py-3 px-4">
                                                        <div className="inline-flex items-center gap-1">
                                                            <span className={`font-medium ${sub.prestigeNegRate > 40 ? 'text-red-600' : sub.prestigeNegRate > 20 ? 'text-orange-600' : 'text-green-600'}`}>
                                                                {sub.prestigeNegRate.toFixed(0)}%
                                                            </span>
                                                            <span className="text-xs text-gray-400">({sub.prestigeTotal})</span>
                                                        </div>
                                                    </td>
                                                    {competitorBrands.slice(0, 3).map(brand => {
                                                        const brandData = sub.brands[brand];
                                                        const brandNegRate = brandData && brandData.total > 0
                                                            ? (brandData.negative / brandData.total) * 100
                                                            : null;
                                                        return (
                                                            <td key={brand} className="text-center py-3 px-4">
                                                                {brandNegRate !== null ? (
                                                                    <div className="inline-flex items-center gap-1">
                                                                        <span className={`font-medium ${brandNegRate > 40 ? 'text-red-600' : brandNegRate > 20 ? 'text-orange-600' : 'text-green-600'}`}>
                                                                            {brandNegRate.toFixed(0)}%
                                                                        </span>
                                                                        <span className="text-xs text-gray-400">({brandData.total})</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-300">—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="text-center py-3 px-4">
                                                        {isWinningVsBest ? (
                                                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                                <TrendingUp size={12} /> Winning
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                                <TrendingDown size={12} /> Behind
                                                            </span>
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Subcategory / Product Level */}
                {viewLevel === 'subcategory' && selectedSubcategory && (
                    <motion.div
                        key="subcategory"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <div className="card p-4">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Package className="text-purple-500" size={20} />
                                Products with {selectedSubcategory.replace(/_/g, ' ')} Issues
                            </h3>
                            <div className="space-y-3">
                                {productData.map((item, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className={`p-3 rounded-xl border ${item.brand === 'Prestige' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.brand === 'Prestige' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                                    {item.brand}
                                                </span>
                                                <span className="font-medium text-sm truncate max-w-[250px]">{item.product}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {renderStars(item.avgRating)}
                                                <span className={`text-xs px-2 py-1 rounded ${item.negative / item.total > 0.5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : item.negative / item.total > 0.3 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                                    {item.negative} / {item.total} negative
                                                </span>
                                            </div>
                                        </div>
                                        {item.sampleReviews[0] && (
                                            <p className="text-xs text-gray-500 italic line-clamp-2 mt-1">"{item.sampleReviews[0]}"</p>
                                        )}
                                    </motion.div>
                                ))}
                                {productData.length === 0 && (
                                    <div className="text-center text-gray-500 py-8">No product data available for this issue type</div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
