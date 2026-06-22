/**
 * SegmentMatrixView — Apples-to-Apples Competitor Comparison
 *
 * Client request (Kathirvel, 22:09):
 * "If Mixer Grinder has 500W, 750W, 1000W — what is quality of Prestige in 500W
 *  vs Bajaj in 500W? That apples-to-apples comparison is what's missing."
 *
 * Matrix layout:
 * - ROWS = Spec tier (500W, 750W, 1000W for Mixer; 3L, 5L for Cooker; 2-Burner,
 *   3-Burner for Gas Stove)
 * - COLUMNS = Brands (Prestige, Hawkins, Pigeon, Bajaj, Butterfly, Preethi, Philips)
 * - CELLS = Brand card with rating, review count, sentiment breakdown, quality score
 *
 * Also includes:
 * - Product category selector to switch product types
 * - Brand filter to focus on specific competitors
 * - Hover expansion for detailed metrics
 * - Color-coded competitive advantage indicators
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Filter, Grid3X3,
    Package, BarChart3, X, ExternalLink,
    Star, Sparkles, ChevronLeft, ChevronRight, Award, MessageSquare, Trophy
} from 'lucide-react';
import { useSpecTypeMappings, type ProductCategory } from '../hooks/useRatingsAPI';
import { RatingSummaryInline } from './ui/RatingSummary';
import { buildRatingMetricsFromReviews } from '../utils/ratingMetrics';
import type { RatingMetrics } from '../types/ratingMetrics';

// ============================================================================
// TYPES
// ============================================================================

interface ReviewData {
    brand?: string;
    rating: number;
    mlInferredRating?: number;
    sentiment?: string;
    sentimentCategory?: string;
    subcategory?: string;
    product?: string;
    productName?: string;
    text?: string;
    date?: string;
    characteristics?: string[];
    category?: string;
    material?: string;
    wattage?: string;
    pdpRating?: number;
    pdpRatingCount?: number;
    pdpPlatformRating?: number;
    pdpTotalRatingCount?: number;
    priceRp?: number;
    priceSp?: number;
}

interface Props {
    prestigeReviews: ReviewData[];
    competitorReviews: ReviewData[];
    onCategorySelect?: (category: string | null) => void;
    externalSelectedCategory?: string | null;
    allCategories?: ProductCategory[];
}

interface BrandCell {
    brand: string;
    reviews: ReviewData[];
    metrics: RatingMetrics;
    reviewCount: number;
    avgRating: number;
    positive: number;
    negative: number;
    neutral: number;
    positiveRate: number;
    qualityScore: number;       // 0-100 based on sentiment
    topIssues: { name: string; count: number; pct: number }[];
    topProducts: string[];
}

interface SpecRow {
    specTier: string;
    totalReviews: number;
    brands: Map<string, BrandCell>;
    rowType?: 'overall' | 'material' | 'wattage' | 'spec';  // Section type
}

// ============================================================================
// HELPERS
// ============================================================================

const BRAND_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
    'Prestige': { bg: 'bg-indigo-50 dark:bg-indigo-900/15', border: 'border-indigo-300/50 dark:border-indigo-700/50', text: 'text-indigo-700 dark:text-indigo-300', gradient: 'from-indigo-500 to-purple-600' },
    'Hawkins': { bg: 'bg-amber-50 dark:bg-amber-900/15', border: 'border-amber-300/50 dark:border-amber-700/50', text: 'text-amber-700 dark:text-amber-300', gradient: 'from-amber-500 to-orange-600' },
    'Pigeon': { bg: 'bg-rose-50 dark:bg-rose-900/15', border: 'border-rose-300/50 dark:border-rose-700/50', text: 'text-rose-700 dark:text-rose-300', gradient: 'from-rose-500 to-pink-600' },
    'Bajaj': { bg: 'bg-emerald-50 dark:bg-emerald-900/15', border: 'border-emerald-300/50 dark:border-emerald-700/50', text: 'text-emerald-700 dark:text-emerald-300', gradient: 'from-emerald-500 to-green-600' },
    'Butterfly': { bg: 'bg-cyan-50 dark:bg-cyan-900/15', border: 'border-cyan-300/50 dark:border-cyan-700/50', text: 'text-cyan-700 dark:text-cyan-300', gradient: 'from-cyan-500 to-teal-600' },
    'Preethi': { bg: 'bg-purple-50 dark:bg-purple-900/15', border: 'border-purple-300/50 dark:border-purple-700/50', text: 'text-purple-700 dark:text-purple-300', gradient: 'from-purple-500 to-violet-600' },
    'Philips': { bg: 'bg-blue-50 dark:bg-blue-900/15', border: 'border-blue-300/50 dark:border-blue-700/50', text: 'text-blue-700 dark:text-blue-300', gradient: 'from-blue-500 to-sky-600' },
};

const getQualityScore = (pos: number, neg: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round(((pos * 2 + (total - pos - neg)) / (total * 2)) * 100);
};



// ============================================================================
// SKU PRODUCT CARD
// ============================================================================

interface SkuProduct {
    name: string;
    brand: string;
    metrics: RatingMetrics;
    reviewCount: number;
    avgRating: number;
    positive: number;
    negative: number;
    neutral: number;
    topThemes: { name: string; count: number }[];
    sampleReviews: string[];
    pdpRating: number | null;
    pdpRatingCount: number | null;
    pdpTotalRatingCount: number | null;
    priceRp: number | null;
    priceSp: number | null;
}

function SkuProductCard({ sku, brandColor }: { sku: SkuProduct; brandColor: { bg: string; border: string; text: string; gradient: string } }) {
    const posPct = sku.reviewCount ? Math.round((sku.positive / sku.reviewCount) * 100) : 0;
    const negPct = sku.reviewCount ? Math.round((sku.negative / sku.reviewCount) * 100) : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl ${brandColor.bg} border ${brandColor.border} p-3 hover:shadow-lg transition-all`}
        >
            {/* Product name */}
            <div className="flex items-start gap-2 mb-2">
                <Package size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <h4 className="text-[12px] font-semibold text-slate-900 dark:text-white leading-tight line-clamp-2">{sku.name}</h4>
            </div>

            <div className="mb-2 rounded-lg border border-slate-200/20 bg-white/50 p-2 dark:border-slate-700/20 dark:bg-slate-800/50">
                <RatingSummaryInline metrics={sku.metrics} title={sku.name} />
            </div>

            {/* Price (MRP / SP) */}
            {(sku.priceRp || sku.priceSp) && (
                <div className="flex items-center gap-2 mb-2 text-[10px]">
                    {sku.priceRp && <span className="text-slate-400 line-through">₹{sku.priceRp.toLocaleString()}</span>}
                    {sku.priceSp && <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{sku.priceSp.toLocaleString()}</span>}
                    {sku.priceRp && sku.priceSp && sku.priceRp > sku.priceSp && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold">
                            {Math.round(((sku.priceRp - sku.priceSp) / sku.priceRp) * 100)}% off
                        </span>
                    )}
                </div>
            )}

            {/* Sentiment bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex mb-2">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${posPct}%` }} />
                <div className="h-full bg-amber-400 transition-all" style={{ width: `${100 - posPct - negPct}%` }} />
                <div className="h-full bg-rose-500 transition-all" style={{ width: `${negPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-500 mb-2">
                <span className="text-emerald-600">{posPct}% positive</span>
                <span className="text-rose-600">{negPct}% negative</span>
            </div>

            {/* Top themes */}
            {sku.topThemes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {sku.topThemes.slice(0, 3).map(t => (
                        <span key={t.name} className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200/30 dark:border-slate-600/30">
                            {t.name} ({t.count})
                        </span>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

// ============================================================================
// SKU DRILL-DOWN MODAL
// ============================================================================

function SkuDrillModal({
    specTier, productCategory, row, visibleBrands, onClose
}: {
    specTier: string;
    productCategory: string;
    row: SpecRow;
    visibleBrands: string[];
    onClose: () => void;
}) {
    // Build SKU-level data from raw reviews inside each BrandCell
    const skusByBrand = useMemo(() => {
        const result = new Map<string, SkuProduct[]>();

        visibleBrands.forEach(brand => {
            const cell = row.brands.get(brand);
            if (!cell || cell.reviews.length === 0) return;

            // Group reviews by product name
            const productMap = new Map<string, ReviewData[]>();
            cell.reviews.forEach(r => {
                const pName = r.productName || r.product || `${brand} Product`;
                if (!productMap.has(pName)) productMap.set(pName, []);
                productMap.get(pName)!.push(r);
            });

            const skus: SkuProduct[] = Array.from(productMap.entries())
                .map(([name, reviews]) => {
                    const metrics = buildRatingMetricsFromReviews(reviews);
                    const pos = reviews.filter(r => (r.sentiment || '').toLowerCase() === 'positive').length;
                    const neg = reviews.filter(r => (r.sentiment || '').toLowerCase() === 'negative').length;
                    const themes = new Map<string, number>();
                    reviews.forEach(r => {
                        if (r.sentimentCategory) themes.set(r.sentimentCategory, (themes.get(r.sentimentCategory) || 0) + 1);
                    });
                    // Get the most common pdp metrics from the reviews in this SKU group
                    const pdpRatings = reviews.map(r => r.pdpRating || r.pdpPlatformRating).filter(Boolean) as number[];
                    const pdpRatingCounts = reviews.map(r => r.pdpRatingCount || r.pdpTotalRatingCount).filter(Boolean) as number[];
                    const priceRps = reviews.map(r => r.priceRp).filter(Boolean) as number[];
                    const priceSps = reviews.map(r => r.priceSp).filter(Boolean) as number[];

                    return {
                        name,
                        brand,
                        metrics,
                        reviewCount: reviews.length,
                        avgRating: Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10,
                        positive: pos,
                        negative: neg,
                        neutral: reviews.length - pos - neg,
                        topThemes: Array.from(themes.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
                        sampleReviews: reviews.filter(r => r.text).slice(0, 3).map(r => r.text!),
                        pdpRating: pdpRatings.length > 0 ? pdpRatings[0] : null,
                        pdpRatingCount: pdpRatingCounts.length > 0 ? Math.max(...pdpRatingCounts) : null,
                        pdpTotalRatingCount: pdpRatingCounts.length > 0 ? Math.max(...pdpRatingCounts) : null,
                        priceRp: priceRps.length > 0 ? priceRps[0] : null,
                        priceSp: priceSps.length > 0 ? Math.min(...priceSps) : null,
                    };
                })
                .sort((a, b) => b.reviewCount - a.reviewCount);

            result.set(brand, skus);
        });

        return result;
    }, [row, visibleBrands]);

    const prestigeSkus = skusByBrand.get('Prestige') || [];
    const competitorBrands = visibleBrands.filter(b => b !== 'Prestige' && skusByBrand.has(b));

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                className="relative w-full max-w-6xl max-h-[85vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/40 dark:border-slate-700/40 bg-white dark:bg-slate-900">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Package size={20} className="text-indigo-500" />
                            {productCategory} · {specTier}
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            SKU-level comparison · {row.totalReviews.toLocaleString()} reviews across {visibleBrands.length} brands
                        </p>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body — scrollable */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* LEFT: Prestige Products */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                                <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">👑 Prestige Products</h3>
                                <span className="text-[10px] text-slate-500 ml-auto">{prestigeSkus.length} SKU{prestigeSkus.length !== 1 ? 's' : ''}</span>
                            </div>
                            {prestigeSkus.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800/40 p-6 text-center text-slate-400 text-sm">
                                    No Prestige products in this segment
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {prestigeSkus.map(sku => (
                                        <SkuProductCard key={sku.name} sku={sku}
                                            brandColor={BRAND_COLORS['Prestige']}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Competitor Products (grouped by brand) */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-3 h-3 rounded-full bg-rose-500" />
                                <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">Competitor Products</h3>
                                <span className="text-[10px] text-slate-500 ml-auto">{competitorBrands.length} brands</span>
                            </div>

                            {competitorBrands.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-rose-200 dark:border-rose-800/40 p-6 text-center text-slate-400 text-sm">
                                    No competitor products in this segment
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {competitorBrands.map(brand => {
                                        const skus = skusByBrand.get(brand) || [];
                                        const colors = BRAND_COLORS[brand] || { bg: 'bg-slate-50 dark:bg-slate-900/20', border: 'border-slate-300/50 dark:border-slate-700/50', text: 'text-slate-700 dark:text-slate-300', gradient: 'from-slate-500 to-gray-600' };
                                        return (
                                            <div key={brand}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className={`px-2.5 py-1 rounded-lg bg-gradient-to-r ${colors.gradient} text-white text-[11px] font-bold`}>{brand}</div>
                                                    <span className="text-[10px] text-slate-500">{skus.length} SKU{skus.length !== 1 ? 's' : ''}</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {skus.slice(0, 5).map(sku => (
                                                        <SkuProductCard key={sku.name} sku={sku} brandColor={colors} />
                                                    ))}
                                                    {skus.length > 5 && (
                                                        <div className="text-[10px] text-slate-400 text-center py-1">
                                                            +{skus.length - 5} more SKUs
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200/40 dark:border-slate-700/40 bg-slate-50/80 dark:bg-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Positive</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /> Neutral</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500" /> Negative</span>
                    </div>
                    <button onClick={onClose}
                        className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-semibold transition-colors"
                    >Close</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function SegmentMatrixView({ prestigeReviews, competitorReviews, onCategorySelect, externalSelectedCategory, allCategories }: Props) {
    const [selectedProductCategory, setSelectedProductCategory] = useState<string | null>(null);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [activeBrands, setActiveBrands] = useState<Set<string>>(new Set());
    const [showQualityBuckets, setShowQualityBuckets] = useState(false);
    const [drillSpecTier, setDrillSpecTier] = useState<string | null>(null);

    const { mappings: specTypeMappings } = useSpecTypeMappings();

    // --- Enrich all reviews with product category + spec ---
    // Consolidate generic 'Competitor (X)' brands into 'Other' for cleaner display
    const allEnriched = useMemo(() => {
        const normalizeBrand = (brand: string): string => {
            if (!brand) return 'Unknown';
            // Consolidate generic competitor labels into 'Other'
            if (brand.startsWith('Competitor (') || brand === 'Competitor' || brand === 'Unknown') return 'Other';
            if (brand === 'The') return 'Other'; // incomplete brand name
            return brand;
        };

        // Build canonical brand mapping: merge case variants (VINOD+Vinod→Vinod)
        const countByBrand: Record<string, number> = {};
        competitorReviews.forEach(r => {
            const b = normalizeBrand(r.brand || 'Unknown');
            if (b !== 'Other' && b !== 'Unknown') countByBrand[b] = (countByBrand[b] || 0) + 1;
        });
        const groups: Record<string, { name: string; count: number }[]> = {};
        Object.entries(countByBrand).forEach(([name, count]) => {
            const key = name.toLowerCase();
            if (!groups[key]) groups[key] = [];
            groups[key].push({ name, count });
        });
        const caseMap: Record<string, string> = {};
        Object.values(groups).forEach(variants => {
            variants.sort((a, b) => b.count - a.count);
            const canonical = variants[0].name;
            variants.forEach(v => { caseMap[v.name] = canonical; });
        });

        const normalizeFull = (brand: string): string => {
            const base = normalizeBrand(brand);
            return caseMap[base] || base;
        };

        const enrich = (reviews: ReviewData[], defaultBrand: string) =>
            reviews.map(r => {
                const productCategory = r.category || 'General';
                const specType = specTypeMappings[productCategory] || 'generic';
                let productSpec = 'Standard';
                if (specType === 'wattage' && r.wattage) productSpec = r.wattage;
                else if (specType === 'material' && r.material) productSpec = r.material;
                
                return {
                    ...r,
                    brand: normalizeFull(r.brand || defaultBrand),
                    productCategory,
                    specTier: productSpec,
                };
            });

        return [...enrich(prestigeReviews, 'Prestige'), ...enrich(competitorReviews, 'Unknown')];
    }, [prestigeReviews, competitorReviews, specTypeMappings]);
    
    // --- Synchronization: Reset local selection when global filter changes ---
    useEffect(() => {
        setSelectedProductCategory(null);
    }, [externalSelectedCategory]);

    // --- Available product categories ---
    const productCategories = useMemo(() => {
        if (allCategories && allCategories.length > 0) {
            return allCategories.map(c => [c.category, c.count] as [string, number]);
        }
        
        const catMap = new Map<string, number>();
        allEnriched.forEach(r => {
            catMap.set(r.productCategory, (catMap.get(r.productCategory) || 0) + 1);
        });
        return Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
    }, [allEnriched, allCategories]);

    // Helper to normalize category for comparison (Title Case)
    const normalizeCat = (cat: string | null | undefined): string => {
        if (!cat) return '';
        return cat.trim().toLowerCase();
    };

    // --- Active product category (auto-select first if none) ---
    const activeProductCategory = selectedProductCategory || externalSelectedCategory || (productCategories[0]?.[0] || 'Pressure Cooker');
    const normalizedActive = normalizeCat(activeProductCategory);

    // --- Filter reviews for the selected product category ---
    const categoryReviews = useMemo(() => {
        return allEnriched.filter(r => normalizeCat(r.productCategory) === normalizedActive);
    }, [allEnriched, normalizedActive]);

    // --- Brands that actually exist in the selected product category ---
    // Only show brands with reviews in this category (no empty columns)
    const categoryBrands = useMemo(() => {
        const brandCounts = new Map<string, number>();
        categoryReviews.forEach(r => {
            brandCounts.set(r.brand, (brandCounts.get(r.brand) || 0) + 1);
        });
        return Array.from(brandCounts.entries())
            .sort((a, b) => {
                // Prestige always first, then 'Other' always last, rest by review count
                if (a[0] === 'Prestige') return -1;
                if (b[0] === 'Prestige') return 1;
                if (a[0] === 'Other') return 1;
                if (b[0] === 'Other') return -1;
                return b[1] - a[1];
            })
            .map(([brand]) => brand);
    }, [categoryReviews]);

    // --- Build visible brands (filter if user toggled specific brands) ---
    const visibleBrands = useMemo(() => {
        if (activeBrands.size === 0) return categoryBrands;
        return categoryBrands.filter(b => activeBrands.has(b));
    }, [categoryBrands, activeBrands]);

    // --- Helper: build BrandCell map from grouped reviews ---
    const buildBrandCells = (brandMap: Map<string, ReviewData[]>): { brands: Map<string, BrandCell>; totalReviews: number } => {
        const brands = new Map<string, BrandCell>();
        let totalReviews = 0;

        brandMap.forEach((reviews, brand) => {
            const count = reviews.length;
            totalReviews += count;
            const metrics = buildRatingMetricsFromReviews(reviews);
            const positive = reviews.filter(r => {
                const s = (r.sentiment || '').toLowerCase();
                return s === 'positive';
            }).length;
            const negative = reviews.filter(r => {
                const s = (r.sentiment || '').toLowerCase();
                return s === 'negative';
            }).length;
            const neutral = count - positive - negative;
            const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / count;

            // Top issues (from sentimentCategory)
            const issueMap = new Map<string, number>();
            reviews.forEach(r => {
                if (r.sentimentCategory) {
                    issueMap.set(r.sentimentCategory, (issueMap.get(r.sentimentCategory) || 0) + 1);
                }
            });
            const topIssues = Array.from(issueMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([name, cnt]) => ({ name, count: cnt, pct: Math.round((cnt / count) * 100) }));

            // Unique product names
            const productSet = new Set<string>();
            reviews.forEach(r => {
                const pName = r.productName || r.product;
                if (pName) productSet.add(pName);
            });

            brands.set(brand, {
                brand, reviews, metrics, reviewCount: count,
                avgRating: Math.round(avgRating * 10) / 10,
                positive, negative, neutral,
                positiveRate: Math.round((positive / count) * 100),
                qualityScore: getQualityScore(positive, negative, count),
                topIssues,
                topProducts: Array.from(productSet).slice(0, 3),
            });
        });

        return { brands, totalReviews };
    };

    // --- Category-to-attribute mapping: determines which breakdown rows to show ---
    const categoryAttributeType = useMemo((): 'material' | 'spec' => {
        const basis = specTypeMappings[activeProductCategory] || 'generic';
        return basis === 'material' ? 'material' : 'spec';
    }, [activeProductCategory, specTypeMappings]);

    // --- Build the matrix: Overall → Material/Spec tiers (category-dependent) ---
    const matrix = useMemo((): SpecRow[] => {
        const rows: SpecRow[] = [];

        // 1. OVERALL row: aggregate all reviews in the selected category
        const overallBrandMap = new Map<string, ReviewData[]>();
        categoryReviews.forEach(r => {
            if (!overallBrandMap.has(r.brand)) overallBrandMap.set(r.brand, []);
            overallBrandMap.get(r.brand)!.push(r);
        });
        const overallCells = buildBrandCells(overallBrandMap);
        rows.push({ specTier: 'Overall', totalReviews: overallCells.totalReviews, brands: overallCells.brands, rowType: 'overall' });

        // 2. MATERIAL breakdown rows (material-basis categories only)
        if (categoryAttributeType === 'material') {
            const materialBrandMap = new Map<string, Map<string, ReviewData[]>>();
            categoryReviews.forEach(r => {
                const normalizedMat = r.specTier;
                if (!normalizedMat || normalizedMat === 'Standard') return;
                if (!materialBrandMap.has(normalizedMat)) materialBrandMap.set(normalizedMat, new Map());
                const bMap = materialBrandMap.get(normalizedMat)!;
                if (!bMap.has(r.brand)) bMap.set(r.brand, []);
                bMap.get(r.brand)!.push(r);
            });
            if (materialBrandMap.size > 0) {
                Array.from(materialBrandMap.entries())
                    .sort((a, b) => {
                        const aTotal = Array.from(a[1].values()).reduce((s, v) => s + v.length, 0);
                        const bTotal = Array.from(b[1].values()).reduce((s, v) => s + v.length, 0);
                        return bTotal - aTotal;
                    })
                    .forEach(([mat, bMap]) => {
                        const cells = buildBrandCells(bMap);
                        rows.push({ specTier: mat, totalReviews: cells.totalReviews, brands: cells.brands, rowType: 'material' });
                    });
            }
        }

        // 3. SPEC TIER / WATTAGE rows (wattage-basis categories only)
        if (categoryAttributeType === 'spec') {
            const tierMap = new Map<string, Map<string, ReviewData[]>>();
            categoryReviews.forEach(r => {
                const tier = r.specTier;
                if (tier === 'Standard') return; // Skip generic "Standard" tier
                if (!tierMap.has(tier)) tierMap.set(tier, new Map());
                const brandMap = tierMap.get(tier)!;
                if (!brandMap.has(r.brand)) brandMap.set(r.brand, []);
                brandMap.get(r.brand)!.push(r);
            });
            Array.from(tierMap.entries())
                .map(([specTier, brandMap]) => {
                    const cells = buildBrandCells(brandMap);
                    return { specTier, totalReviews: cells.totalReviews, brands: cells.brands, rowType: 'spec' as const };
                })
                .sort((a, b) => b.totalReviews - a.totalReviews)
                .forEach(row => rows.push(row));
        }

        return rows;
    }, [categoryReviews, categoryAttributeType]);

    // --- Quality bucketing across brands for selected product category ---
    const qualityBuckets = useMemo(() => {
        if (!showQualityBuckets) return [];

        const bucketMap = new Map<string, Map<string, { count: number; negative: number; positive: number }>>();

        categoryReviews.forEach(r => {
            const cat = r.sentimentCategory || 'General';
            const brand = r.brand;
            if (!bucketMap.has(cat)) bucketMap.set(cat, new Map());
            const bMap = bucketMap.get(cat)!;
            const e = bMap.get(brand) || { count: 0, negative: 0, positive: 0 };
            e.count++;
            if ((r.sentiment || '').toLowerCase() === 'negative') e.negative++;
            if ((r.sentiment || '').toLowerCase() === 'positive') e.positive++;
            bMap.set(brand, e);
        });

        return Array.from(bucketMap.entries())
            .map(([category, brandMap]) => ({
                category,
                totalCount: Array.from(brandMap.values()).reduce((s, v) => s + v.count, 0),
                brands: brandMap,
            }))
            .sort((a, b) => b.totalCount - a.totalCount);
    }, [categoryReviews, showQualityBuckets]);

    const toggleBrand = useCallback((brand: string) => {
        setActiveBrands(prev => {
            const next = new Set(prev);
            if (next.has(brand)) next.delete(brand);
            else next.add(brand);
            return next;
        });
    }, []);

    // ----- Scroll refs for category pill slider -----
    const catScrollRef = useRef<HTMLDivElement>(null);
    const [catCanScrollLeft, setCatCanScrollLeft] = useState(false);
    const [catCanScrollRight, setCatCanScrollRight] = useState(false);
    const catIsDragging = useRef(false);
    const catDragStartX = useRef(0);
    const catDragScrollLeft = useRef(0);

    const updateCatArrows = useCallback(() => {
        const el = catScrollRef.current;
        if (!el) return;
        setCatCanScrollLeft(el.scrollLeft > 10);
        setCatCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    }, []);

    useEffect(() => {
        updateCatArrows();
        const el = catScrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', updateCatArrows, { passive: true });
        const ro = new ResizeObserver(updateCatArrows);
        ro.observe(el);
        return () => { el.removeEventListener('scroll', updateCatArrows); ro.disconnect(); };
    }, [productCategories, updateCatArrows]);

    const catScroll = (dir: 'left' | 'right') => {
        const el = catScrollRef.current;
        if (!el) return;
        el.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    };

    return (
        <div className="space-y-4">

            {/* PRODUCT CATEGORY PILL SLIDER */}
            <div className="relative">
                <div
                    className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-white dark:from-slate-950 to-transparent transition-opacity duration-200"
                    style={{ opacity: catCanScrollLeft ? 1 : 0 }}
                />
                <div
                    className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-white dark:from-slate-950 to-transparent transition-opacity duration-200"
                    style={{ opacity: catCanScrollRight ? 1 : 0 }}
                />
                <AnimatePresence>
                    {catCanScrollLeft && (
                        <motion.button
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
                            onClick={() => catScroll('left')}
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 dark:bg-slate-900/95 border border-slate-200/70 dark:border-slate-700/60 shadow-md flex items-center justify-center hover:border-indigo-300 transition-colors"
                        >
                            <ChevronLeft size={13} className="text-slate-600 dark:text-slate-300" />
                        </motion.button>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {catCanScrollRight && (
                        <motion.button
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
                            onClick={() => catScroll('right')}
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 dark:bg-slate-900/95 border border-slate-200/70 dark:border-slate-700/60 shadow-md flex items-center justify-center hover:border-indigo-300 transition-colors"
                        >
                            <ChevronRight size={13} className="text-slate-600 dark:text-slate-300" />
                        </motion.button>
                    )}
                </AnimatePresence>
                <div
                    ref={catScrollRef}
                    className="no-scrollbar flex items-center gap-2 overflow-x-auto px-0.5 py-0.5"
                    style={{ WebkitOverflowScrolling: 'touch', cursor: 'grab' }}
                    onPointerDown={(e) => {
                        catIsDragging.current = true;
                        catDragStartX.current = e.clientX;
                        catDragScrollLeft.current = catScrollRef.current?.scrollLeft ?? 0;
                    }}
                    onPointerMove={(e) => {
                        if (!catIsDragging.current || !catScrollRef.current) return;
                        catScrollRef.current.scrollLeft = catDragScrollLeft.current - (e.clientX - catDragStartX.current);
                    }}
                    onPointerUp={() => {
                        catIsDragging.current = false;
                    }}
                    onPointerLeave={() => {
                        catIsDragging.current = false;
                    }}
                >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                        <Package size={11} /> Product
                    </span>
                    {productCategories.map(([cat, count]) => {
                        const normalizedCat = normalizeCat(cat);
                        const isSelected = normalizedCat === normalizedActive;
                        
                        return (
                            <motion.button
                                key={cat}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    setSelectedProductCategory(cat);
                                    if (onCategorySelect) onCategorySelect(cat);
                                }}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {cat}
                                <span className={`ml-1.5 text-[10px] ${isSelected ? 'opacity-75' : 'opacity-50'}`}>
                                    {count >= 1000 ? `${(count / 1000).toFixed(0)}K` : count}
                                </span>
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* BRAND FILTER CHIPS + VIEW TOGGLE */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                        <Filter size={10} /> Brands
                    </span>
                    {categoryBrands.map(brand => {
                        const colors = BRAND_COLORS[brand] || { gradient: 'from-slate-400 to-slate-600' };
                        const isActive = activeBrands.size === 0 || activeBrands.has(brand);
                        return (
                            <motion.button
                                key={brand}
                                whileTap={{ scale: 0.93 }}
                                onClick={() => toggleBrand(brand)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                                    isActive
                                        ? `bg-gradient-to-r ${colors.gradient} text-white border-transparent shadow-sm`
                                        : 'bg-slate-100/60 dark:bg-slate-800/60 border-slate-200/50 dark:border-slate-700/50 text-slate-400 dark:text-slate-500'
                                }`}
                            >
                                {brand === 'Prestige' && <Award size={10} />}
                                {brand}
                                {!isActive && <span className="text-[9px] opacity-60">(off)</span>}
                            </motion.button>
                        );
                    })}
                    {activeBrands.size > 0 && (
                        <button
                            onClick={() => setActiveBrands(new Set())}
                            className="text-[10px] text-indigo-500 hover:text-indigo-600 font-medium underline underline-offset-2 ml-1"
                        >
                            Reset
                        </button>
                    )}
                </div>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowQualityBuckets(!showQualityBuckets)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border ${
                        showQualityBuckets
                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300/60 dark:border-amber-700/50 text-amber-700 dark:text-amber-400'
                            : 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                    }`}
                >
                    <BarChart3 size={12} />
                    {showQualityBuckets ? 'Quality Buckets' : 'Segment Matrix'}
                </motion.button>
            </div>

            <AnimatePresence mode="wait">
                {!showQualityBuckets ? (
                    /* ==== SEGMENT MATRIX ==== */
                    <motion.div key="matrix" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                        {matrix.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <Grid3X3 size={44} className="mx-auto mb-3 opacity-25" />
                                <p className="text-sm">No segment data for {activeProductCategory}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-2xl border border-slate-200/50 dark:border-slate-700/40 shadow-sm">
                                <div
                                    className="min-w-fit"
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: `148px repeat(${visibleBrands.length}, minmax(160px, 1fr))`,
                                        gap: '8px',
                                        padding: '10px',
                                    }}
                                >
                                    {/* Corner */}
                                    <div className="flex items-end pb-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Segment</span>
                                    </div>

                                    {/* Brand Banner Headers */}
                                    {visibleBrands.map(brand => {
                                        const colors = BRAND_COLORS[brand] || { gradient: 'from-slate-500 to-gray-600' };
                                        const totalRevs = matrix[0]?.brands.get(brand)?.reviewCount ?? 0;
                                        const isFiltered = activeBrands.size > 0 && !activeBrands.has(brand);
                                        return (
                                            <motion.div
                                                key={`header-${brand}`}
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`relative bg-gradient-to-br ${colors.gradient} rounded-xl overflow-hidden flex flex-col justify-between px-3 py-2.5 min-h-[68px] cursor-pointer select-none`}
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                whileTap={{ scale: 0.97 }}
                                                onClick={() => toggleBrand(brand)}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                                                <div className="relative z-10">
                                                    <div className="flex items-center gap-1.5">
                                                        {brand === 'Prestige' && <Award size={12} className="text-white/90" />}
                                                        <span className="text-sm font-black text-white leading-tight tracking-tight">{brand}</span>
                                                    </div>
                                                    {totalRevs > 0 && (
                                                        <span className="text-[10px] text-white/70 font-medium">
                                                            {totalRevs >= 1000 ? `${(totalRevs / 1000).toFixed(1)}K` : totalRevs} reviews
                                                        </span>
                                                    )}
                                                </div>
                                                {isFiltered && (
                                                    <div className="absolute inset-0 bg-slate-900/55 rounded-xl flex items-center justify-center backdrop-blur-[1px]">
                                                        <span className="text-[9px] text-white/80 font-bold">filtered</span>
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}

                                    {/* Data rows */}
                                    {matrix.map((row, ri) => {
                                        const ratings = visibleBrands
                                            .map(b => row.brands.get(b)?.avgRating)
                                            .filter((v): v is number => v !== undefined);
                                        const bestRating = ratings.length > 0 ? Math.max(...ratings) : 0;
                                        const worstRating = ratings.length > 0 ? Math.min(...ratings) : 0;

                                        const prevRowType = ri > 0 ? matrix[ri - 1].rowType : null;
                                        const showMaterialHeader = row.rowType === 'material' && prevRowType !== 'material';
                                        const showSpecHeader = row.rowType === 'spec' && prevRowType !== 'spec';
                                        const isOverall = row.rowType === 'overall';
                                        const isMaterial = row.rowType === 'material';
                                        const isSpec = row.rowType === 'spec';

                                        return (
                                            <React.Fragment key={`row-${row.specTier}`}>
                                                {showMaterialHeader && (
                                                    <div style={{ gridColumn: '1 / -1' }} className="flex items-center gap-3 pt-2 pb-0.5">
                                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/60 dark:via-amber-700/40 to-transparent" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40">
                                                            🔩 Material Breakdown
                                                        </span>
                                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/60 dark:via-amber-700/40 to-transparent" />
                                                    </div>
                                                )}
                                                {showSpecHeader && (
                                                    <div style={{ gridColumn: '1 / -1' }} className="flex items-center gap-3 pt-2 pb-0.5">
                                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-300/50 dark:via-blue-700/30 to-transparent" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-700/40">
                                                            ⚡ Wattage Breakdown
                                                        </span>
                                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-300/50 dark:via-blue-700/30 to-transparent" />
                                                    </div>
                                                )}

                                                {/* Row label */}
                                                <motion.div
                                                    key={`label-${row.specTier}`}
                                                    initial={{ opacity: 0, x: -8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: ri * 0.04 }}
                                                    onClick={() => setDrillSpecTier(row.specTier)}
                                                    className={`group flex flex-col justify-center p-3 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                                                        isOverall
                                                            ? 'bg-gradient-to-br from-indigo-50 to-purple-50/60 dark:from-indigo-900/25 dark:to-purple-900/15 border-indigo-300/60 dark:border-indigo-700/50'
                                                            : isMaterial
                                                                ? 'bg-gradient-to-br from-amber-50/70 to-orange-50/40 dark:from-amber-900/15 dark:to-orange-900/10 border-amber-200/50 dark:border-amber-700/40'
                                                                : 'bg-white/70 dark:bg-slate-800/60 border-slate-200/40 dark:border-slate-700/40 hover:border-indigo-300/50 dark:hover:border-indigo-700/40'
                                                    }`}
                                                >
                                                    <span className={`text-xs font-bold leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${
                                                        isOverall ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white'
                                                    }`}>
                                                        {isOverall ? '📊' : isMaterial ? '🔩' : isSpec ? '⚡' : '•'} {row.specTier}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 mt-0.5">{row.totalReviews.toLocaleString()} rev</span>
                                                    <span className="flex items-center gap-0.5 text-[9px] text-indigo-500 dark:text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                                                        <ExternalLink size={8} /> SKUs
                                                    </span>
                                                </motion.div>

                                                {/* Brand cells */}
                                                {visibleBrands.map(brand => {
                                                    const cell = row.brands.get(brand);
                                                    const isRowExpanded = expandedRow === row.specTier;
                                                    const colors = BRAND_COLORS[brand] || { bg: 'bg-slate-50 dark:bg-slate-900/20', border: 'border-slate-200/40 dark:border-slate-700/30' };

                                                    if (!cell) {
                                                        return (
                                                            <div
                                                                key={`${row.specTier}-${brand}-empty`}
                                                                className="rounded-xl border-2 border-dashed border-slate-200/40 dark:border-slate-700/30 flex flex-col items-center justify-center min-h-[90px] gap-1"
                                                            >
                                                                <span className="text-[9px] font-semibold text-slate-300 dark:text-slate-600">{brand}</span>
                                                                <span className="text-slate-300 dark:text-slate-700 text-lg">—</span>
                                                                <span className="text-[8px] text-slate-300 dark:text-slate-600 italic">No data</span>
                                                            </div>
                                                        );
                                                    }

                                                    const isWinning = cell.avgRating === bestRating && ratings.length > 1;
                                                    const isLosing = cell.avgRating === worstRating && ratings.length > 1 && bestRating !== worstRating;
                                                    const posPct = cell.positiveRate;
                                                    const negPct = Math.round((cell.negative / cell.reviewCount) * 100);
                                                    const neuPct = Math.max(0, 100 - posPct - negPct);
                                                    const displayRating = (cell.metrics?.pdp_rating ?? cell.avgRating);
                                                    const mlRating = cell.metrics?.ml_rating;

                                                    return (
                                                        <motion.div
                                                            key={`${row.specTier}-${brand}`}
                                                            initial={{ opacity: 0, scale: 0.95 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            transition={{ delay: ri * 0.035 }}
                                                            onClick={() => setExpandedRow(isRowExpanded ? null : row.specTier)}
                                                            whileHover={{ scale: 1.02, y: -2 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            className={`relative cursor-pointer rounded-xl border-2 transition-all p-3 flex flex-col gap-2 shadow-sm hover:shadow-md ${
                                                                isWinning
                                                                    ? `${colors.bg} border-emerald-400/70 dark:border-emerald-600/50 shadow-emerald-500/10`
                                                                    : isLosing
                                                                        ? `${colors.bg} border-rose-300/50 dark:border-rose-700/40`
                                                                        : `${colors.bg} ${colors.border} hover:border-indigo-300/50 dark:hover:border-indigo-700/40`
                                                            }`}
                                                        >
                                                            {isWinning && (
                                                                <motion.div
                                                                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                                                                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/30"
                                                                >
                                                                    <Trophy size={11} className="text-white" />
                                                                </motion.div>
                                                            )}

                                                            {/* Ratings row */}
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                                                    <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                                                                    <span className="text-xl font-black text-amber-600 dark:text-amber-400 leading-none tabular-nums">
                                                                        {displayRating.toFixed(1)}
                                                                    </span>
                                                                    {mlRating != null && (
                                                                        <>
                                                                            <span className="text-slate-300 dark:text-slate-600 mx-0.5">·</span>
                                                                            <Sparkles size={9} className="fill-emerald-400 text-emerald-400 shrink-0" />
                                                                            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 leading-none tabular-nums">
                                                                                {mlRating.toFixed(1)}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                                                    cell.qualityScore >= 75
                                                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                                        : cell.qualityScore >= 55
                                                                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                                            : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                                                }`}>
                                                                    Q{cell.qualityScore}
                                                                </span>
                                                            </div>

                                                            {/* Sentiment bar */}
                                                            <div className="space-y-0.5">
                                                                <div className="w-full h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700/50 overflow-hidden flex">
                                                                    <motion.div
                                                                        className="h-full bg-emerald-500"
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${posPct}%` }}
                                                                        transition={{ delay: ri * 0.04 + 0.2, duration: 0.5, ease: 'easeOut' }}
                                                                    />
                                                                    <div className="h-full bg-amber-400" style={{ width: `${neuPct}%` }} />
                                                                    <div className="h-full bg-rose-500" style={{ width: `${negPct}%` }} />
                                                                </div>
                                                                <div className="flex items-center justify-between text-[8px]">
                                                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{posPct}%</span>
                                                                    <span className="text-rose-600 dark:text-rose-400 font-semibold">{negPct}% neg</span>
                                                                </div>
                                                            </div>

                                                            {/* Counts row */}
                                                            <div className="flex items-center gap-2 text-[9px] text-slate-400">
                                                                <span className="flex items-center gap-0.5">
                                                                    <MessageSquare size={8} />
                                                                    {cell.reviewCount >= 1000 ? `${(cell.reviewCount / 1000).toFixed(1)}K` : cell.reviewCount}
                                                                </span>
                                                                {(cell.metrics?.rating_count ?? 0) > 0 && (
                                                                    <span className="flex items-center gap-0.5">
                                                                        <BarChart3 size={8} />
                                                                        {(cell.metrics!.rating_count! >= 1_000_000
                                                                            ? `${(cell.metrics!.rating_count! / 100_000).toFixed(1)}L`
                                                                            : cell.metrics!.rating_count! >= 1000
                                                                                ? `${(cell.metrics!.rating_count! / 1000).toFixed(1)}K`
                                                                                : cell.metrics!.rating_count)}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Expanded: top issues */}
                                                            <AnimatePresence>
                                                                {isRowExpanded && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        className="overflow-hidden"
                                                                    >
                                                                        <div className="pt-2 border-t border-slate-200/30 dark:border-slate-700/30 space-y-1">
                                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Top Issues</span>
                                                                            {cell.topIssues.map(issue => (
                                                                                <div key={issue.name} className="flex items-center justify-between gap-2 text-[9px]">
                                                                                    <span className="text-slate-600 dark:text-slate-400 truncate flex-1">{issue.name}</span>
                                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                                        <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                                                            <div
                                                                                                className={`h-full rounded-full ${issue.pct > 40 ? 'bg-rose-500' : 'bg-amber-400'}`}
                                                                                                style={{ width: `${issue.pct}%` }}
                                                                                            />
                                                                                        </div>
                                                                                        <span className={`font-bold ${issue.pct > 40 ? 'text-rose-600' : 'text-slate-500'}`}>{issue.pct}%</span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </motion.div>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Legend */}
                        <div className="flex items-center gap-4 justify-center text-[10px] text-slate-500 mt-3 flex-wrap">
                            <span className="flex items-center gap-1.5">
                                <Trophy size={10} className="text-emerald-500" /> Best rating in segment
                            </span>
                            <span className="flex items-center gap-1">
                                <Star size={9} className="fill-amber-400 text-amber-400" /> PDP rating
                            </span>
                            <span className="flex items-center gap-1">
                                <Sparkles size={9} className="fill-emerald-400 text-emerald-400" /> ML rating
                            </span>
                            <span className="text-slate-400">Q = Quality Score (0–100)</span>
                        </div>
                    </motion.div>
                ) : (
                    /* ==== QUALITY BUCKETS VIEW ==== */
                    <motion.div key="buckets" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
                        <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/40 dark:border-slate-700/40 p-4 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                                <BarChart3 size={16} className="text-amber-500" /> Quality Buckets — {activeProductCategory}
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                Feedback category breakdown across all brands · Same bucketing as Categories tab applied to competitors
                            </p>
                        </div>

                        {qualityBuckets.map((bucket, bi) => (
                            <motion.div key={bucket.category}
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: bi * 0.04 }}
                                className="rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/40 dark:border-slate-700/40 overflow-hidden shadow-sm"
                            >
                                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/40 flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">{bucket.category}</h4>
                                    <span className="text-[10px] text-slate-400">{bucket.totalCount.toLocaleString()} reviews</span>
                                </div>
                                <div className="p-3">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2">
                                        {visibleBrands.map(brand => {
                                            const data = bucket.brands.get(brand);
                                            const colors = BRAND_COLORS[brand] || { bg: 'bg-slate-50 dark:bg-slate-900/20', border: 'border-slate-200/30 dark:border-slate-700/30', text: 'text-slate-600 dark:text-slate-400', gradient: 'from-slate-400 to-slate-600' };

                                            if (!data || data.count === 0) {
                                                return (
                                                    <div key={brand} className="rounded-xl border-2 border-dashed border-slate-200/40 dark:border-slate-700/30 flex flex-col items-center justify-center min-h-[64px] gap-0.5">
                                                        <span className="text-[9px] text-slate-300 dark:text-slate-600 font-semibold">{brand}</span>
                                                        <span className="text-slate-300 dark:text-slate-700">—</span>
                                                    </div>
                                                );
                                            }

                                            const negPct = Math.round((data.negative / data.count) * 100);
                                            const posPct = Math.round((data.positive / data.count) * 100);

                                            return (
                                                <motion.div key={brand}
                                                    whileHover={{ scale: 1.03, y: -2 }}
                                                    className={`rounded-xl p-2.5 ${colors.bg} border ${colors.border} transition-all hover:shadow-md cursor-default`}
                                                >
                                                    <span className={`text-[10px] font-bold ${colors.text} block truncate`}>
                                                        {brand === 'Prestige' ? '👑 ' : ''}{brand}
                                                    </span>
                                                    <div className="flex items-end justify-between mt-1">
                                                        <span className="text-lg font-black text-slate-800 dark:text-white leading-none">
                                                            {data.count >= 1000 ? `${(data.count / 1000).toFixed(1)}K` : data.count}
                                                        </span>
                                                        <span className={`text-[10px] font-bold ${
                                                            negPct > 40 ? 'text-rose-600 dark:text-rose-400'
                                                            : negPct > 20 ? 'text-amber-600 dark:text-amber-400'
                                                            : 'text-emerald-600 dark:text-emerald-400'
                                                        }`}>
                                                            {negPct}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1 rounded-full bg-slate-200/80 dark:bg-slate-700/50 overflow-hidden flex mt-1.5">
                                                        <div className="h-full bg-emerald-500" style={{ width: `${posPct}%` }} />
                                                        <div className="h-full bg-amber-400" style={{ width: `${100 - posPct - negPct}%` }} />
                                                        <div className="h-full bg-rose-500" style={{ width: `${negPct}%` }} />
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* SKU Drill-Down Modal */}
            <AnimatePresence>
                {drillSpecTier && (() => {
                    const drillRow = matrix.find(r => r.specTier === drillSpecTier);
                    if (!drillRow) return null;
                    return (
                        <SkuDrillModal
                            specTier={drillSpecTier}
                            productCategory={activeProductCategory}
                            row={drillRow}
                            visibleBrands={visibleBrands}
                            onClose={() => setDrillSpecTier(null)}
                        />
                    );
                })()}
            </AnimatePresence>
        </div>
    );
}

export default SegmentMatrixView;

