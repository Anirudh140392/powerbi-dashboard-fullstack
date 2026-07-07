/**
 * CategoryHealthView V2 — Dual-Hierarchy Drill-Down
 * 
 * Two analysis dimensions as requested by Kathirvel (Prestige):
 * 1. FEEDBACK DIMENSION: Quality → Durability / Build Material / Coating Quality (from ML pipeline)
 * 2. PRODUCT DIMENSION: Mixer Grinder → 500W / 750W (from product name extraction)
 *
 * Level 1: Overview cards (switchable between Feedback view & Product view)
 * Level 2: Subcategory breakdown with actionable insights, cross-reference matrix,
 *           % of total over time, top affected products/feedback issues
 * Level 3: Individual review cards for a specific subcategory
 *
 * Client quote: "If it is a quality issue, go to the quality team. If it is a
 * package issue, go to a packaging team." — Kathirvel T, 29:13
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight, ChevronLeft, Star, ArrowUpRight, ArrowDownRight,
    Percent, Hash, Package, MessageSquare, Filter, Search,
} from 'lucide-react';
import type { Review } from '../types';
import { IssueDrilldownModal } from './IssueDrilldownModal';
import { useSpecTypeMappings, normalizeCategory } from '../hooks/useRatingsAPI';

// ============================================================================
// TYPES
// ============================================================================

interface Props {
    reviews: Review[];
    onCategoryClick?: (category: string) => void;
}

interface CategoryCard {
    name: string;
    totalReviews: number;
    avgRating: number;
    positive: number;
    negative: number;
    neutral: number;
    positiveRate: number;
    trend: 'improving' | 'declining' | 'stable';
    trendDelta: number;
    monthlyData: { month: string; count: number; positive: number; negative: number }[];
}

interface SubcategoryInsight {
    name: string;
    count: number;
    percentage: number;        // % of parent category
    percentOfTotal: number;    // % of ALL reviews (for % mode)
    avgRating: number;
    positiveRate: number;
    negativePct: number;
    severity: 'critical' | 'warning' | 'good' | 'info';
    trend: 'up' | 'down' | 'stable';
    trendDelta: number;
    topProducts: { name: string; count: number; avgRating: number }[];
    topFeedbackIssues: { name: string; count: number; pct: number }[];
    actionableInsight: string;
    reviewIds: (number | string)[];
}

type ViewDimension = 'feedback' | 'product';
type DrillLevel = 'overview' | 'subcategories' | 'reviews';

const PAGE_SIZE = 10;

// ============================================================================
// SPARKLINE
// ============================================================================

function MiniSparkline({ data, color = '#6366f1', uid = '' }: { data: number[]; color?: string; uid?: string }) {
    if (data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const w = 90, h = 24;
    const pts = data.map((v, i) => ({
        x: (i / (data.length - 1)) * w,
        y: h - ((v - min) / range) * (h - 4) - 2,
    }));
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaD = `${d} L${w},${h} L0,${h} Z`;
    const gradId = `spark-${uid || color.replace(/[^a-zA-Z0-9]/g, '')}`;
    return (
        <svg width={w} height={h} className="overflow-visible">
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={areaD} fill={`url(#${gradId})`} />
            <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={2} fill={color} />
        </svg>
    );
}

// ============================================================================
// SENTIMENT BAR
// ============================================================================

function SentimentBar({ positive, neutral, negative, total }: { positive: number; neutral: number; negative: number; total: number }) {
    if (total === 0) return null;
    return (
        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
            <div className="h-full bg-emerald-500" style={{ width: `${(positive / total) * 100}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${(neutral / total) * 100}%` }} />
            <div className="h-full bg-rose-500" style={{ width: `${(negative / total) * 100}%` }} />
        </div>
    );
}

// ============================================================================
// ACTIONABLE INSIGHT GENERATOR
// ============================================================================

function generateActionableInsight(subcat: string, negativePct: number, trend: string, topProducts: { name: string }[]): string {
    const cleanName = subcat.replace(/_/g, ' ').toLowerCase();
    const mainProduct = topProducts[0]?.name?.split(' ').slice(0, 4).join(' ') || 'multiple products';

    if (negativePct > 50) {
        return `⚠️ Critical: ${Math.round(negativePct)}% negative in ${cleanName}. Focus on ${mainProduct}. Escalate to quality/engineering team immediately.`;
    }
    if (negativePct > 30) {
        return `🔶 Action needed: ${Math.round(negativePct)}% negative in ${cleanName}. Review product design & materials for ${mainProduct}.`;
    }
    if (trend === 'down') {
        return `📈 Improving: ${cleanName} complaints trending down. Continue monitoring ${mainProduct}.`;
    }
    if (negativePct < 15) {
        return `✅ Strong performance in ${cleanName}. Leverage in marketing for ${mainProduct}.`;
    }
    return `ℹ️ Monitor ${cleanName} — ${Math.round(negativePct)}% negative. Track monthly for ${mainProduct}.`;
}

// ============================================================================
// PALETTE
// ============================================================================

// Unified palette: a single brand accent for category cards. Decorative variance moved
// to data signals (severity, sentiment, trend) instead of per-card color rotation.
const PALETTES = [
    { gradient: 'from-indigo-500 to-indigo-600', border: 'border-indigo-300/40 dark:border-indigo-700/40', text: 'text-indigo-600 dark:text-indigo-400', glow: 'shadow-indigo-500/10', sparkColor: '#6366f1' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CategoryHealthView({ reviews, onCategoryClick: _onCategoryClick }: Props) {
    const [viewDimension, setViewDimension] = useState<ViewDimension>('feedback');
    const [drillLevel, setDrillLevel] = useState<DrillLevel>('overview');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
    const [showPercentMode, setShowPercentMode] = useState(false);
    const [selectedSku, setSelectedSku] = useState<string | null>(null);
    const [ratingFilter, setRatingFilter] = useState<number | null>(null);
    const [level3RatingFilter, setLevel3RatingFilter] = useState<number | null>(null);
    const [level3Sku, setLevel3Sku] = useState<string | null>(null);
    const [level3Page, setLevel3Page] = useState(1);
    const [modalPage, setModalPage] = useState(1);

    // Reset pages when filters change
    useEffect(() => { setLevel3Page(1); }, [level3Sku, level3RatingFilter, drillLevel, viewDimension]);
    useEffect(() => { setModalPage(1); }, [selectedSku, ratingFilter]);
    
    const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
    const [issueSkuSelected, setIssueSkuSelected] = useState<string | null>(null);
    const [issueRatingFilter, setIssueRatingFilter] = useState<number | null>(null);
    const [paretoFilter, setParetoFilter] = useState<'all' | 'Pareto' | 'Non-Pareto' | 'NPD'>('all');
    const [drilldownIssue, setDrilldownIssue] = useState<string | null>(null);

    const { mappings: specTypeMappings } = useSpecTypeMappings();

    // --- Enriched reviews with product category + pareto filter ---
    const enrichedReviews = useMemo(() => {
        let filtered = reviews;
        if (paretoFilter !== 'all') {
            // Match the backend's non-Pareto definition: anything that isn't Pareto
            // or NPD (incl. 'Non-Pareto (Unclassified)' and NULL) counts as Non-Pareto.
            filtered = paretoFilter === 'Non-Pareto'
                ? reviews.filter(r => r.paretoStatus == null || (r.paretoStatus !== 'Pareto' && r.paretoStatus !== 'NPD'))
                : reviews.filter(r => r.paretoStatus === paretoFilter);
        }
        return filtered.map(r => {
            const productCategory = r.category || 'General';
            const specType = specTypeMappings[productCategory] || 'generic';
            
            // Derive spec from DB fields depending on the configured type rule
            let productSpec = 'Standard';
            if (specType === 'wattage' && r.wattage) productSpec = r.wattage;
            else if (specType === 'material' && r.material) productSpec = r.material;
            else if (r.wattage) productSpec = r.wattage;
            else if (r.material) productSpec = r.material;
            
            return { ...r, productCategory, productSpec };
        });
    }, [reviews, paretoFilter, specTypeMappings]);
    
    // --- Automatic drill-down if only one category is present (e.g. from global filter) ---
    useEffect(() => {
        if (enrichedReviews.length === 0) return;

        // Check how many unique categories are in the current data
        const uniqueCats = new Set(enrichedReviews.map(r => 
            normalizeCategory(
                viewDimension === 'feedback' 
                    ? String(r.sentimentCategory || 'General') 
                    : r.category || 'General'
            )
        ));

        if (uniqueCats.size === 1) {
            const soleCategory = Array.from(uniqueCats)[0];
            // Auto drill down if not already on this category or if at overview level
            if (selectedCategory !== soleCategory || drillLevel === 'overview') {
                setSelectedCategory(soleCategory);
                setDrillLevel('subcategories');
                setViewDimension('product'); // Show product sub-categories by default when drilling down
            }
        } else if (selectedCategory && !uniqueCats.has(selectedCategory)) {
            // Current selection is no longer in the data (filter changed or cleared)
            setSelectedCategory(null);
            setDrillLevel('overview');
        }
    }, [enrichedReviews, viewDimension, selectedCategory, drillLevel]);

    // --- Compute category cards (Level 1) ---
    const categoryCards = useMemo((): CategoryCard[] => {
        const catMap = new Map<string, typeof enrichedReviews>();
        enrichedReviews.forEach(r => {
            const key = viewDimension === 'feedback'
                ? String(r.sentimentCategory || 'General')
                : r.productCategory;
            if (!catMap.has(key)) catMap.set(key, []);
            catMap.get(key)!.push(r);
        });

        return Array.from(catMap.entries())
            .map(([name, catReviews]) => {
                const total = catReviews.length;
                const positive = catReviews.filter(r => r.sentiment === 'Positive').length;
                const negative = catReviews.filter(r => r.sentiment === 'Negative').length;
                const neutral = total - positive - negative;
                const avgRating = catReviews.reduce((s, r) => s + r.rating, 0) / total;

                // Monthly trend
                const monthMap = new Map<string, { count: number; positive: number; negative: number }>();
                catReviews.forEach(r => {
                    const d = new Date(r.date);
                    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const e = monthMap.get(mk) || { count: 0, positive: 0, negative: 0 };
                    e.count++; if (r.sentiment === 'Positive') e.positive++; if (r.sentiment === 'Negative') e.negative++;
                    monthMap.set(mk, e);
                });
                const monthlyData = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, d]) => ({ month, ...d }));

                let trend: 'improving' | 'declining' | 'stable' = 'stable';
                let trendDelta = 0;
                if (monthlyData.length >= 4) {
                    // Compare recent 3-month avg vs prior 3-month avg for stable signal
                    const recentSlice = monthlyData.slice(-3);
                    const priorSlice = monthlyData.slice(-6, -3);
                    const avg = (arr: typeof monthlyData) => {
                        const totC = arr.reduce((s, m) => s + m.count, 0);
                        const totP = arr.reduce((s, m) => s + m.positive, 0);
                        return totC > 0 ? (totP / totC) * 100 : 0;
                    };
                    const recentRate = avg(recentSlice);
                    const priorRate = avg(priorSlice.length > 0 ? priorSlice : monthlyData.slice(0, Math.max(1, monthlyData.length - 3)));
                    trendDelta = Math.round(recentRate - priorRate);
                    if (trendDelta > 3) trend = 'improving';
                    else if (trendDelta < -3) trend = 'declining';
                } else if (monthlyData.length >= 2) {
                    // Fallback for short data: compare last 2 months
                    const last = monthlyData[monthlyData.length - 1];
                    const prev = monthlyData[monthlyData.length - 2];
                    const lastRate = last.count > 0 ? (last.positive / last.count) * 100 : 0;
                    const prevRate = prev.count > 0 ? (prev.positive / prev.count) * 100 : 0;
                    trendDelta = Math.round(lastRate - prevRate);
                    if (trendDelta > 5) trend = 'improving';
                    else if (trendDelta < -5) trend = 'declining';
                }

                return {
                    name, totalReviews: total, avgRating: Math.round(avgRating * 10) / 10,
                    positive, negative, neutral, positiveRate: Math.round((positive / total) * 100),
                    trend, trendDelta, monthlyData,
                };
            })
            .sort((a, b) => b.totalReviews - a.totalReviews);
    }, [enrichedReviews, viewDimension]);

    // --- Subcategory insights for selected category (Level 2) ---
    const subcategoryInsights = useMemo((): SubcategoryInsight[] => {
        if (!selectedCategory) return [];
        const totalAll = enrichedReviews.length;

        // Get reviews in the selected parent category
        const parentReviews = enrichedReviews.filter(r => {
            return viewDimension === 'feedback'
                ? String(r.sentimentCategory || 'General') === selectedCategory
                : r.productCategory === selectedCategory;
        });

        // Group by subcategory or product spec
        const subMap = new Map<string, typeof enrichedReviews>();
        parentReviews.forEach(r => {
            let subKey: string;
            if (viewDimension === 'feedback') {
                subKey = r.subcategory || 'General';
            } else {
                subKey = r.productSpec || 'Standard';
            }
            if (!subMap.has(subKey)) subMap.set(subKey, []);
            subMap.get(subKey)!.push(r);
        });

        return Array.from(subMap.entries())
            .map(([name, subReviews]) => {
                const count = subReviews.length;
                const positive = subReviews.filter(r => r.sentiment === 'Positive').length;
                const negative = subReviews.filter(r => r.sentiment === 'Negative').length;
                const avgRating = subReviews.reduce((s, r) => s + r.rating, 0) / count;
                const negativePct = (negative / count) * 100;
                const positiveRate = Math.round((positive / count) * 100);

                // Severity
                let severity: SubcategoryInsight['severity'] = 'info';
                if (negativePct > 50) severity = 'critical';
                else if (negativePct > 30) severity = 'warning';
                else if (positiveRate > 70) severity = 'good';

                // Cross-reference: top products (if in feedback view) or top feedback issues (if in product view)
                const crossMap = new Map<string, { count: number; totalRating: number }>();
                subReviews.forEach(r => {
                    const crossKey = viewDimension === 'feedback'
                        ? (r.product || 'Unknown')
                        : String(r.sentimentCategory || 'General');
                    const e = crossMap.get(crossKey) || { count: 0, totalRating: 0 };
                    e.count++; e.totalRating += r.rating;
                    crossMap.set(crossKey, e);
                });
                const crossEntries = Array.from(crossMap.entries())
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 5);

                const topProducts = viewDimension === 'feedback'
                    ? crossEntries.map(([n, d]) => ({ name: n, count: d.count, avgRating: Math.round((d.totalRating / d.count) * 10) / 10 }))
                    : [];

                const topFeedbackIssues = viewDimension === 'product'
                    ? crossEntries.map(([n, d]) => ({ name: n, count: d.count, pct: Math.round((d.count / count) * 100) }))
                    : [];

                // Trend (compare last 2 months of data within subcategory)
                const monthMap = new Map<string, { count: number; negative: number }>();
                subReviews.forEach(r => {
                    const d = new Date(r.date);
                    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const e = monthMap.get(mk) || { count: 0, negative: 0 };
                    e.count++; if (r.sentiment === 'Negative') e.negative++;
                    monthMap.set(mk, e);
                });
                const months = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
                let trend: 'up' | 'down' | 'stable' = 'stable';
                let trendDelta = 0;
                if (months.length >= 2) {
                    const last = months[months.length - 1][1];
                    const prev = months[months.length - 2][1];
                    const lastNegRate = last.count > 0 ? (last.negative / last.count) * 100 : 0;
                    const prevNegRate = prev.count > 0 ? (prev.negative / prev.count) * 100 : 0;
                    trendDelta = Math.round(lastNegRate - prevNegRate);
                    if (trendDelta > 5) trend = 'up'; // negative trend up = bad
                    else if (trendDelta < -5) trend = 'down'; // negative trend down = good
                }

                const actionableInsight = generateActionableInsight(name, negativePct, trend, topProducts);

                return {
                    name, count, percentage: Math.round((count / parentReviews.length) * 1000) / 10,
                    percentOfTotal: totalAll > 0 ? Math.round((count / totalAll) * 1000) / 10 : 0,
                    avgRating: Math.round(avgRating * 10) / 10, positiveRate, negativePct,
                    severity, trend, trendDelta, topProducts, topFeedbackIssues,
                    actionableInsight, reviewIds: subReviews.map(r => r.id),
                };
            })
            .sort((a, b) => b.count - a.count);
    }, [enrichedReviews, selectedCategory, viewDimension]);

    // --- Product dimension: classification cards from dynamic data ---
    const classificationCards = useMemo(() => {
        if (viewDimension !== 'product' || !selectedCategory) return [];
        const parentReviews = enrichedReviews.filter(r => r.productCategory === selectedCategory);
        const totalParent = parentReviews.length;

        // Dynamically get unique classification buckets
        const uniqueValues = new Set<string>();
        parentReviews.forEach(r => {
            if (r.productSpec && r.productSpec !== 'Standard') {
                uniqueValues.add(r.productSpec);
            }
        });
        
        let dynamicValues = Array.from(uniqueValues);
        if (dynamicValues.length === 0) dynamicValues = ['Standard'];

        return dynamicValues.map(value => {
            const matchingReviews = parentReviews.filter(r => (r.productSpec || 'Standard') === value);
            const count = matchingReviews.length;
            const avgRating = count > 0 ? Math.round((matchingReviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
            const positive = matchingReviews.filter(r => r.sentiment === 'Positive').length;
            const negative = matchingReviews.filter(r => r.sentiment === 'Negative').length;
            const positivePct = count > 0 ? Math.round((positive / count) * 100) : 0;
            const negativePct = count > 0 ? Math.round((negative / count) * 100) : 0;
            const pctOfTotal = totalParent > 0 ? Math.round((count / totalParent) * 100 * 10) / 10 : 0;
            return { name: value, count, avgRating, positive, negative, positivePct, negativePct, pctOfTotal };
        }).filter(c => c.count > 0);
    }, [enrichedReviews, selectedCategory, viewDimension]);

    // --- Reviews for selected subcategory (Level 3) ---
    const subcatReviews = useMemo(() => {
        if (!selectedCategory || !selectedSubcategory) return [];

        return enrichedReviews
            .filter(r => {
                const parentMatch = viewDimension === 'feedback'
                    ? String(r.sentimentCategory || 'General') === selectedCategory
                    : r.productCategory === selectedCategory;

                const subMatch = viewDimension === 'feedback'
                    ? (r.subcategory || 'General') === selectedSubcategory
                    : (r.productSpec || 'Standard') === selectedSubcategory;

                return parentMatch && subMatch;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [enrichedReviews, selectedCategory, selectedSubcategory, viewDimension]);

    // --- Product dimension Level 3: SKU master list for selected classification ---
    const level3SkuList = useMemo(() => {
        if (viewDimension !== 'product' || !selectedSubcategory || subcatReviews.length === 0) return [];
        const skuMap = new Map<string, { count: number; totalRating: number; positive: number; negative: number }>();
        subcatReviews.forEach(r => {
            const sku = r.product || 'Unknown';
            const e = skuMap.get(sku) || { count: 0, totalRating: 0, positive: 0, negative: 0 };
            e.count++;
            e.totalRating += r.rating;
            if (r.sentiment === 'Positive') e.positive++;
            if (r.sentiment === 'Negative') e.negative++;
            skuMap.set(sku, e);
        });
        return Array.from(skuMap.entries())
            .map(([name, s]) => ({
                name,
                count: s.count,
                avgRating: Math.round((s.totalRating / s.count) * 10) / 10,
                positivePct: Math.round((s.positive / s.count) * 100),
                negativePct: Math.round((s.negative / s.count) * 100),
            }))
            .sort((a, b) => b.count - a.count);
    }, [viewDimension, selectedSubcategory, subcatReviews]);

    const level3SkuReviews = useMemo(() => {
        if (!level3Sku) return [];
        let filtered = subcatReviews.filter(r => (r.product || '') === level3Sku);
        if (level3RatingFilter !== null) {
            filtered = filtered.filter(r => r.rating === level3RatingFilter);
        }
        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [subcatReviews, level3Sku, level3RatingFilter]);

    // --- Navigation ---
    const handleCategoryDrill = useCallback((name: string) => {
        setSelectedCategory(name);
        setSelectedSubcategory(null);
        setLevel3Sku(null);
        setLevel3RatingFilter(null);
        setDrillLevel('subcategories');
    }, []);

    const handleSubcategoryDrill = useCallback((name: string) => {
        setSelectedSubcategory(name);
        setLevel3Sku(null);
        setLevel3RatingFilter(null);
        setDrillLevel('reviews');
    }, []);

    const goBack = useCallback(() => {
        if (drillLevel === 'reviews') {
            setSelectedSubcategory(null);
            setLevel3Sku(null);
            setLevel3RatingFilter(null);
            setDrillLevel('subcategories');
        } else if (drillLevel === 'subcategories') {
            setSelectedCategory(null);
            setDrillLevel('overview');
        }
    }, [drillLevel]);

    // SKU Modal reviews — filtered by rating star
    const skuModalReviews = useMemo(() => {
        if (!selectedSku) return [];
        let filtered = enrichedReviews.filter(r => (r.product || '') === selectedSku);
        if (ratingFilter !== null) {
            filtered = filtered.filter(r => r.rating === ratingFilter);
        }
        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [enrichedReviews, selectedSku, ratingFilter]);

    const skuAllReviews = useMemo(() => {
        if (!selectedSku) return [];
        return enrichedReviews.filter(r => (r.product || '') === selectedSku);
    }, [enrichedReviews, selectedSku]);

    // Issue → SKU Breakdown: compute all products affected by the selected issue
    const issueSkuBreakdown = useMemo(() => {
        if (!selectedIssue || !selectedCategory) return [];
        // Get reviews matching the parent category + selected issue subcategory
        const issueReviews = enrichedReviews.filter(r => {
            const parentMatch = viewDimension === 'feedback'
                ? String(r.sentimentCategory || 'General') === selectedCategory
                : r.productCategory === selectedCategory;
            const subMatch = viewDimension === 'feedback'
                ? (r.subcategory || 'General') === selectedIssue
                : (r.productSpec || 'Standard') === selectedIssue;
            return parentMatch && subMatch;
        });

        // Group by product/SKU
        const skuMap = new Map<string, typeof enrichedReviews>();
        issueReviews.forEach(r => {
            const key = r.product || 'Unknown';
            if (!skuMap.has(key)) skuMap.set(key, []);
            skuMap.get(key)!.push(r);
        });

        return Array.from(skuMap.entries())
            .map(([name, skuReviews]) => {
                const count = skuReviews.length;
                const avgRating = Math.round((skuReviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
                const positive = skuReviews.filter(r => r.sentiment === 'Positive').length;
                const negative = skuReviews.filter(r => r.sentiment === 'Negative').length;
                const positivePct = Math.round((positive / count) * 100);
                const negativePct = Math.round((negative / count) * 100);
                const pdpRating = skuReviews.find(r => r.actualProductRating)?.actualProductRating || null;
                return { name, count, avgRating, positive, negative, positivePct, negativePct, pdpRating };
            })
            .sort((a, b) => b.count - a.count);
    }, [enrichedReviews, selectedIssue, selectedCategory, viewDimension]);

    // Issue SKU modal reviews — filtered by selected SKU within the issue modal
    const issueSkuReviews = useMemo(() => {
        if (!issueSkuSelected || !selectedIssue || !selectedCategory) return [];
        let filtered = enrichedReviews.filter(r => {
            const parentMatch = viewDimension === 'feedback'
                ? String(r.sentimentCategory || 'General') === selectedCategory
                : r.productCategory === selectedCategory;
            const subMatch = viewDimension === 'feedback'
                ? (r.subcategory || 'General') === selectedIssue
                : (r.productSpec || 'Standard') === selectedIssue;
            return parentMatch && subMatch && (r.product || '') === issueSkuSelected;
        });
        if (issueRatingFilter !== null) {
            filtered = filtered.filter(r => r.rating === issueRatingFilter);
        }
        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [enrichedReviews, issueSkuSelected, selectedIssue, selectedCategory, viewDimension, issueRatingFilter]);

    const getSeverityStyle = (sev: SubcategoryInsight['severity']) => {
        switch (sev) {
            case 'critical': return { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/15', border: 'border-red-200/50 dark:border-red-800/40' };
            case 'warning': return { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/15', border: 'border-amber-200/50 dark:border-amber-800/40' };
            case 'good': return { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/15', border: 'border-emerald-200/50 dark:border-emerald-800/40' };
            default: return { dot: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-900/15', border: 'border-slate-200/50 dark:border-slate-700/40' };
        }
    };

    return (
        <div className="space-y-4">
            {/* ===== HEADER: Dimension toggle + Breadcrumb + % mode ===== */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    {/* Dimension toggle */}
                    <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200/40 dark:border-slate-700/40">
                        <button
                            onClick={() => { setViewDimension('feedback'); setDrillLevel('overview'); setSelectedCategory(null); setSelectedSubcategory(null); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewDimension === 'feedback'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/60'
                                }`}
                        >
                            <MessageSquare size={13} /> Feedback Issues
                        </button>
                        <button
                            onClick={() => { setViewDimension('product'); setDrillLevel('overview'); setSelectedCategory(null); setSelectedSubcategory(null); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewDimension === 'product'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/60'
                                }`}
                        >
                            <Package size={13} /> Product Categories
                        </button>
                    </div>

                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1 text-sm">
                        <button
                            onClick={() => { setDrillLevel('overview'); setSelectedCategory(null); setSelectedSubcategory(null); }}
                            className={`font-semibold transition-colors ${drillLevel === 'overview' ? 'text-slate-900 dark:text-white' : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer'}`}
                        >
                            {viewDimension === 'feedback' ? '📊 Feedback' : '📦 Products'}
                        </button>
                        {selectedCategory && (
                            <>
                                <ChevronRight size={14} className="text-slate-400" />
                                <button
                                    onClick={() => { setDrillLevel('subcategories'); setSelectedSubcategory(null); }}
                                    className={`font-semibold transition-colors ${drillLevel === 'subcategories' ? 'text-slate-900 dark:text-white' : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer'}`}
                                >
                                    {selectedCategory}
                                </button>
                            </>
                        )}
                        {selectedSubcategory && (
                            <>
                                <ChevronRight size={14} className="text-slate-400" />
                                <span className="font-semibold text-slate-900 dark:text-white">{selectedSubcategory.replace(/_/g, ' ')}</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {drillLevel !== 'overview' && (
                        <motion.button whileTap={{ scale: 0.95 }} onClick={goBack}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ChevronLeft size={14} /> Back
                        </motion.button>
                    )}
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowPercentMode(!showPercentMode)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${showPercentMode ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                    >
                        {showPercentMode ? <Percent size={13} /> : <Hash size={13} />}
                        {showPercentMode ? '% of Total' : 'Counts'}
                    </motion.button>

                    {/* Pareto / Non-Pareto / NPD toggle */}
                    <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-0.5 border border-slate-200/40 dark:border-slate-700/40">
                        <Filter size={12} className="text-slate-400 mx-1.5" />
                        {(['all', 'Pareto', 'Non-Pareto', 'NPD'] as const).map(opt => (
                            <button
                                key={opt}
                                onClick={() => setParetoFilter(opt)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                    paretoFilter === opt
                                        ? opt === 'Pareto' ? 'bg-emerald-500 text-white shadow-sm'
                                            : opt === 'NPD' ? 'bg-purple-500 text-white shadow-sm'
                                                : opt === 'Non-Pareto' ? 'bg-slate-600 text-white shadow-sm'
                                                    : 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                {opt === 'all' ? 'All' : opt === 'Pareto' ? '🏆 Pareto' : opt === 'NPD' ? '🆕 NPD' : '📦 Non-Pareto'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== LEVEL 1: CATEGORY OVERVIEW CARDS ===== */}
            <AnimatePresence mode="wait">
                {drillLevel === 'overview' && (
                    <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                    >
                        {categoryCards.map((card, i) => {
                            const p = PALETTES[i % PALETTES.length];
                            return (
                                <motion.div key={card.name}
                                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                    whileHover={{ y: -4, scale: 1.01 }}
                                    onClick={() => handleCategoryDrill(card.name)}
                                    className={`relative cursor-pointer rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm 
                                        border ${p.border} p-5 shadow-lg ${p.glow} hover:shadow-xl transition-all duration-300 group overflow-hidden`}
                                >
                                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${p.gradient}`} />

                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate pr-2">{card.name}</h3>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${card.trend === 'improving' ? 'text-emerald-600 dark:text-emerald-400' :
                                                card.trend === 'declining' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
                                                }`}>
                                                {card.trend === 'improving' && <ArrowUpRight size={12} />}
                                                {card.trend === 'declining' && <ArrowDownRight size={12} />}
                                                {card.trendDelta !== 0 && `${card.trendDelta > 0 ? '+' : ''}${card.trendDelta}%`}
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDrilldownIssue(card.name); }}
                                                title="Deep drill-down (cross-brand)"
                                                className="opacity-60 hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 rounded p-0.5 transition"
                                            ><Search size={12} /></button>
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between mb-3">
                                        <div>
                                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                                {showPercentMode
                                                    ? `${enrichedReviews.length > 0 ? Math.round((card.totalReviews / enrichedReviews.length) * 100) : 0}%`
                                                    : card.totalReviews.toLocaleString()
                                                }
                                            </p>
                                            <p className="text-[11px] text-slate-500">{showPercentMode ? 'of total' : 'reviews'}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-0.5 text-sm font-semibold text-amber-500">
                                                <Star size={12} fill="currentColor" /> {card.avgRating}
                                            </div>
                                            <p className={`text-[11px] font-semibold ${p.text}`}>{card.positiveRate}% positive</p>
                                        </div>
                                    </div>

                                    <SentimentBar positive={card.positive} neutral={card.neutral} negative={card.negative} total={card.totalReviews} />
                                    <div className="mt-2"><MiniSparkline data={card.monthlyData.map(d => d.count)} color={p.sparkColor} uid={`cat-${i}-${card.name.replace(/\W/g, '')}`} /></div>

                                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight size={16} className={p.text} />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* ===== LEVEL 2: SUBCATEGORY / CLASSIFICATION ===== */}
                {drillLevel === 'subcategories' && selectedCategory && (
                    <motion.div key="subcategories" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                        className="space-y-4"
                    >
                        {/* Summary header */}
                        <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/40 dark:border-slate-700/40 p-5 shadow-lg">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        {viewDimension === 'feedback' ? <MessageSquare size={18} /> : <Package size={18} />}
                                        {selectedCategory}
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {viewDimension === 'product'
                                            ? `${classificationCards.length} spec types · ${classificationCards.reduce((s, c) => s + c.count, 0).toLocaleString()} reviews`
                                            : `${subcategoryInsights.length} subcategories · ${subcategoryInsights.reduce((s, b) => s + b.count, 0).toLocaleString()} reviews`
                                        }
                                        {paretoFilter !== 'all' && (
                                            <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                                                {paretoFilter} only
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* === PRODUCT DIMENSION: Classification cards from config === */}
                        {viewDimension === 'product' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {classificationCards.map((card, i) => {
                                    const p = PALETTES[i % PALETTES.length];
                                    return (
                                        <motion.div key={card.name}
                                            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                            whileHover={{ scale: 1.02, y: -2 }}
                                            onClick={() => handleSubcategoryDrill(card.name)}
                                            className={`relative cursor-pointer rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border ${p.border} p-5 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden`}
                                        >
                                            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${p.gradient}`} />
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{card.name}</h4>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r ${p.gradient} text-white`}>
                                                    {card.pctOfTotal}%
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 mb-3">
                                                <div>
                                                    <span className="text-2xl font-black text-slate-900 dark:text-white">{card.count.toLocaleString()}</span>
                                                    <span className="text-[10px] text-slate-500 ml-1">reviews</span>
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                    <Star size={14} className="text-amber-400 fill-amber-400" />
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{card.avgRating}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 text-[11px]">
                                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{card.positivePct}% positive</span>
                                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                                <span className="text-rose-600 dark:text-rose-400 font-semibold">{card.negativePct}% negative</span>
                                            </div>
                                            <div className="mt-3 w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                                                <div className="h-full bg-emerald-500" style={{ width: `${card.positivePct}%` }} />
                                                <div className="h-full bg-rose-500" style={{ width: `${card.negativePct}%` }} />
                                            </div>
                                            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ChevronRight size={16} className={p.text} />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                                {classificationCards.length === 0 && (
                                    <p className="col-span-full text-center text-xs text-slate-400 py-8">No classification data available</p>
                                )}
                            </div>
                        )}

                        {/* === FEEDBACK DIMENSION: Original subcategory cards === */}
                        {viewDimension === 'feedback' && subcategoryInsights.length > 0 && (
                            <>
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                                    className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/40 dark:border-slate-700/40 p-4 shadow-sm"
                                >
                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
                                        Issue Breakdown — {selectedCategory}
                                    </p>
                                    <div className="space-y-2">
                                        {subcategoryInsights.slice(0, 6).map((sub, i) => {
                                            const sStyle = getSeverityStyle(sub.severity);
                                            const maxPct = subcategoryInsights[0]?.percentage || 100;
                                            const barW = maxPct > 0 ? (sub.percentage / maxPct) * 100 : 0;
                                            return (
                                                <motion.div key={sub.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                                    className="flex items-center gap-3 cursor-pointer group"
                                                    onClick={() => { setSelectedIssue(sub.name); setIssueSkuSelected(null); setIssueRatingFilter(null); }}
                                                >
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${sStyle.dot}`} />
                                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-32 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{sub.name.replace(/_/g, ' ')}</span>
                                                    <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                                        <motion.div initial={{ width: 0 }} animate={{ width: `${barW}%` }} transition={{ duration: 0.6, delay: i * 0.05 }}
                                                            className={`h-full rounded-full ${sub.severity === 'critical' ? 'bg-gradient-to-r from-red-400 to-red-500' : sub.severity === 'warning' ? 'bg-gradient-to-r from-amber-400 to-amber-500' : sub.severity === 'good' ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-500 dark:to-slate-600'}`} />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-14 text-right">{sub.percentage.toFixed(1)}%</span>
                                                    <span className="text-[10px] text-slate-400 w-10 text-right">{sub.count}</span>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                                <div className="space-y-3">
                                    {subcategoryInsights.map((sub, i) => {
                                        const sStyle = getSeverityStyle(sub.severity);
                                        return (
                                            <motion.div key={sub.name} id={`subcat-card-${sub.name}`}
                                                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                                                whileHover={{ x: 4 }} onClick={() => handleSubcategoryDrill(sub.name)}
                                                className={`cursor-pointer rounded-2xl ${sStyle.bg} border ${sStyle.border} p-5 shadow-sm hover:shadow-lg transition-all duration-300 group`}
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2.5 h-2.5 rounded-full ${sStyle.dot}`} />
                                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{sub.name.replace(/_/g, ' ')}</h4>
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${sStyle.text}`}>{sub.severity}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <span className="text-lg font-bold text-slate-900 dark:text-white">{showPercentMode ? `${sub.percentOfTotal}%` : sub.count.toLocaleString()}</span>
                                                            <span className="text-[10px] text-slate-500 ml-1">{showPercentMode ? 'of total' : 'reviews'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-0.5 text-xs text-amber-500 font-semibold"><Star size={11} fill="currentColor" /> {sub.avgRating}</div>
                                                        <div className="flex items-center gap-1 w-16 justify-end">
                                                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{sub.positiveRate}%</span>
                                                            <span className="text-[10px] text-slate-400">/</span>
                                                            <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">{Math.round(sub.negativePct)}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-slate-700 dark:text-slate-300 mb-3 pl-6">{sub.actionableInsight}</p>
                                                <div className="flex items-center gap-2 pl-6 flex-wrap">
                                                    {sub.topProducts.slice(0, 3).map(prod => (
                                                        <span key={prod.name} onClick={(e) => { e.stopPropagation(); setSelectedSku(prod.name); setRatingFilter(null); }}
                                                            className="px-2 py-0.5 text-[10px] rounded-md bg-white/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 font-medium border border-slate-200/40 dark:border-slate-600/40 truncate max-w-[200px] cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                                            📦 {prod.name.split(' ').slice(0, 4).join(' ')} ({prod.count})
                                                        </span>
                                                    ))}
                                                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ml-auto">
                                                        View {sub.count} reviews <ChevronRight size={12} />
                                                    </span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </motion.div>
                )}

                {/* ===== LEVEL 3: REVIEWS / SKU MASTER-DETAIL ===== */}
                {drillLevel === 'reviews' && selectedSubcategory && (
                    <motion.div key="reviews" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                        {/* Header */}
                        <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/40 dark:border-slate-700/40 p-5 shadow-lg">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedCategory} → {selectedSubcategory.replace(/_/g, ' ')}</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {viewDimension === 'product' ? `${level3SkuList.length} SKUs · ${subcatReviews.length} reviews` : `${subcatReviews.length} reviews`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    {[5, 4, 3, 2, 1].map(star => {
                                        const cnt = subcatReviews.filter(r => r.rating === star).length;
                                        const pct = subcatReviews.length > 0 ? (cnt / subcatReviews.length) * 100 : 0;
                                        return (
                                            <div key={star} className="flex flex-col items-center gap-0.5">
                                                <div className="w-4 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex flex-col-reverse">
                                                    <div className={`w-full ${star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ height: `${pct}%` }} />
                                                </div>
                                                <span className="text-[9px] text-slate-500">{star}★</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* === PRODUCT: Master-Detail SKU View === */}
                        {viewDimension === 'product' && (
                            <div className="flex gap-4">
                                {/* LEFT: SKU List */}
                                <div className="w-2/5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/40 dark:border-slate-700/40 overflow-hidden flex flex-col">
                                    <div className="p-3 border-b border-slate-200/40 dark:border-slate-700/40">
                                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SKUs ({level3SkuList.length})</p>
                                    </div>
                                    <div className="flex-1">
                                        {level3SkuList.map((sku, i) => (
                                            <motion.div key={sku.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                                                onClick={() => { setLevel3Sku(sku.name); setLevel3RatingFilter(null); }}
                                                className={`px-4 py-3 cursor-pointer border-b border-slate-100 dark:border-slate-700/30 transition-all hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 ${level3Sku === sku.name ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-[3px] border-l-indigo-500' : ''}`}
                                            >
                                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2 mb-1.5">{sku.name}</p>
                                                <div className="flex items-center gap-3 text-[10px]">
                                                    <span className="text-slate-500">{sku.count} reviews</span>
                                                    <span className="flex items-center gap-0.5 text-amber-500 font-semibold"><Star size={9} fill="currentColor" /> {sku.avgRating}</span>
                                                    <span className="text-emerald-600 font-medium">{sku.positivePct}%↑</span>
                                                    <span className="text-rose-600 font-medium">{sku.negativePct}%↓</span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                                {/* RIGHT: Selected SKU Reviews */}
                                <div className="w-3/5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/40 dark:border-slate-700/40 overflow-hidden flex flex-col">
                                    {!level3Sku ? (
                                        <div className="flex-1 flex items-center justify-center p-8">
                                            <div className="text-center">
                                                <Package size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                                <p className="text-sm text-slate-400 dark:text-slate-500">Select a SKU to view ratings</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="p-4 border-b border-slate-200/40 dark:border-slate-700/40">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 mb-2">📦 {level3Sku}</h3>
                                                <p className="text-[10px] text-slate-500 mb-2">{subcatReviews.filter(r => (r.product || '') === level3Sku).length} total reviews{level3RatingFilter ? ` · ${level3RatingFilter}★ only` : ''}</p>
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => setLevel3RatingFilter(null)} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${level3RatingFilter === null ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}>All</button>
                                                    {[5, 4, 3, 2, 1].map(star => {
                                                        const cnt = subcatReviews.filter(r => (r.product || '') === level3Sku && r.rating === star).length;
                                                        if (cnt === 0) return null;
                                                        return (
                                                            <button key={star} onClick={() => setLevel3RatingFilter(star)}
                                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${level3RatingFilter === star ? `${star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-500' : 'bg-rose-500'} text-white shadow-md` : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}>
                                                                {star}★ ({cnt})
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex-1 p-3 space-y-2">
                                                {(() => {
                                                    const sortedReviews = level3SkuReviews;
                                                    const totalPages = Math.ceil(sortedReviews.length / PAGE_SIZE);
                                                    const paginated = sortedReviews.slice((level3Page - 1) * PAGE_SIZE, level3Page * PAGE_SIZE);
                                                    
                                                    return (
                                                        <>
                                                            {paginated.map((review, i) => (
                                                                <motion.div key={review.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.01 }}
                                                                    className={`rounded-xl p-3 border ${review.sentiment === 'Positive' ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50' : review.sentiment === 'Negative' ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200/50' : 'bg-white/50 dark:bg-slate-800/50 border-slate-200/50'}`}
                                                                >
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <div className="flex items-center gap-1.5">
                                                                            {Array.from({ length: 5 }).map((_, j) => (<Star key={j} size={10} className={j < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />))}
                                                                            <span className={`px-1 py-0.5 rounded text-[8px] font-bold ml-1 ${review.sentiment === 'Positive' ? 'bg-emerald-100 text-emerald-700' : review.sentiment === 'Negative' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{review.sentiment}</span>
                                                                        </div>
                                                                        <span className="text-[9px] text-slate-400">{new Date(review.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{review.text}</p>
                                                                </motion.div>
                                                            ))}
                                                            {totalPages > 1 && (
                                                                <div className="flex items-center justify-between mt-4 px-1 pt-3 border-t border-slate-100 dark:border-slate-700/30">
                                                                    <span className="text-[9px] font-semibold text-slate-400">Page {level3Page} of {totalPages}</span>
                                                                    <div className="flex gap-2">
                                                                        <button onClick={() => setLevel3Page(p => Math.max(1, p - 1))} disabled={level3Page === 1} className="p-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-30"><ChevronLeft size={12} /></button>
                                                                        <button onClick={() => setLevel3Page(p => Math.min(totalPages, p + 1))} disabled={level3Page === totalPages} className="p-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-30"><ChevronRight size={12} /></button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* === FEEDBACK: Flat review list === */}
                        {viewDimension === 'feedback' && (
                            <div className="space-y-2.5 pr-1">
                                {(() => {
                                    const sortedReviews = subcatReviews;
                                    const totalPages = Math.ceil(sortedReviews.length / PAGE_SIZE);
                                    const paginated = sortedReviews.slice((level3Page - 1) * PAGE_SIZE, level3Page * PAGE_SIZE);

                                    return (
                                        <>
                                            {paginated.map((review, i) => (
                                                <motion.div key={review.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }}
                                                    className={`rounded-xl p-4 border transition-all ${review.sentiment === 'Positive' ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50' : review.sentiment === 'Negative' ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200/50' : 'bg-white/50 dark:bg-slate-800/50 border-slate-200/50'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3 mb-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-0.5">{Array.from({ length: 5 }).map((_, j) => (<Star key={j} size={10} className={j < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />))}</div>
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${review.sentiment === 'Positive' ? 'bg-emerald-100 text-emerald-700' : review.sentiment === 'Negative' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{review.sentiment}</span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 shrink-0">{new Date(review.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">{review.text}</p>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="text-[10px] text-slate-500 truncate max-w-[250px]">📦 {review.product}</span>
                                                        {(review.characteristics || []).length > 0 && (
                                                            <div className="flex gap-1">{(review.characteristics || []).slice(0, 3).map(c => (<span key={c} className="px-1 py-0.5 text-[8px] rounded bg-indigo-50 text-indigo-600 font-medium">{c}</span>))}</div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                            {totalPages > 1 && (
                                                <div className="flex items-center justify-between mt-4 px-1 pt-3 border-t border-slate-100 dark:border-slate-700/30">
                                                    <span className="text-[9px] font-semibold text-slate-400">Page {level3Page} of {totalPages}</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setLevel3Page(p => Math.max(1, p - 1))} disabled={level3Page === 1} className="p-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-30"><ChevronLeft size={12} /></button>
                                                        <button onClick={() => setLevel3Page(p => Math.min(totalPages, p + 1))} disabled={level3Page === totalPages} className="p-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-30"><ChevronRight size={12} /></button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            {/* ===== SKU FEEDBACK MODAL ===== */}
            <AnimatePresence>
                {selectedSku && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => { setSelectedSku(null); setRatingFilter(null); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-2xl max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate pr-4">📦 {selectedSku}</h3>
                                    <button onClick={() => { setSelectedSku(null); setRatingFilter(null); }} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
                                </div>
                                <p className="text-xs text-slate-500 mb-3">{skuAllReviews.length} total reviews · Showing {skuModalReviews.length} {ratingFilter ? `(${ratingFilter}★ only)` : ''}</p>
                                {/* Star filter buttons */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setRatingFilter(null)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${ratingFilter === null ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}
                                    >
                                        All
                                    </button>
                                    {[5, 4, 3, 2, 1].map(star => {
                                        const cnt = skuAllReviews.filter(r => r.rating === star).length;
                                        return (
                                            <button
                                                key={star}
                                                onClick={() => setRatingFilter(ratingFilter === star ? null : star)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${ratingFilter === star
                                                    ? (star >= 4 ? 'bg-emerald-500 text-white shadow-md' : star === 3 ? 'bg-amber-500 text-white shadow-md' : 'bg-rose-500 text-white shadow-md')
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}
                                            >
                                                {star}★ <span className="text-[10px] opacity-75">({cnt})</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {/* Modal Body — Review List */}
                            <div className="p-5 space-y-2.5 overflow-y-auto">
                                {skuModalReviews.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-8">No reviews match this filter</p>
                                ) : (
                                    (() => {
                                        const sortedReviews = skuModalReviews;
                                        const totalPages = Math.ceil(sortedReviews.length / PAGE_SIZE);
                                        const paginated = sortedReviews.slice((modalPage - 1) * PAGE_SIZE, modalPage * PAGE_SIZE);

                                        return (
                                            <>
                                                {paginated.map((review, i) => (
                                                    <motion.div
                                                        key={review.id}
                                                        initial={{ opacity: 0, y: 5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: i * 0.01 }}
                                                        className={`rounded-xl p-4 border transition-all ${review.sentiment === 'Positive' ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50'
                                                            : review.sentiment === 'Negative' ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200/50'
                                                                : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/50'}`}
                                                    >
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex items-center gap-0.5">
                                                                    {Array.from({ length: 5 }).map((_, j) => (
                                                                        <Star key={j} size={10} className={j < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                                                                    ))}
                                                                </div>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${review.sentiment === 'Positive' ? 'bg-emerald-100 text-emerald-700'
                                                                    : review.sentiment === 'Negative' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                    {review.sentiment}
                                                                </span>
                                                                {review.sentimentCategory && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 font-medium">{review.sentimentCategory}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-400">
                                                                {new Date(review.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{review.text}</p>
                                                    </motion.div>
                                                ))}
                                                {totalPages > 1 && (
                                                    <div className="flex items-center justify-between mt-4 px-1 pt-3 border-t border-slate-100 dark:border-slate-700/30">
                                                        <span className="text-[9px] font-semibold text-slate-400">Page {modalPage} of {totalPages}</span>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setModalPage(p => Math.max(1, p - 1))} disabled={modalPage === 1} className="p-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-30"><ChevronLeft size={12} /></button>
                                                            <button onClick={() => setModalPage(p => Math.min(totalPages, p + 1))} disabled={modalPage === totalPages} className="p-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-30"><ChevronRight size={12} /></button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== ISSUE → SKU PERFORMANCE MODAL ===== */}
            <AnimatePresence>
                {selectedIssue && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => { setSelectedIssue(null); setIssueSkuSelected(null); setIssueRatingFilter(null); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        📊 {selectedIssue.replace(/_/g, ' ')}
                                        <span className="text-xs font-normal text-slate-400">— SKU Performance</span>
                                    </h3>
                                    <button onClick={() => { setSelectedIssue(null); setIssueSkuSelected(null); setIssueRatingFilter(null); }}
                                        className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
                                </div>
                                <p className="text-xs text-slate-500">
                                    {selectedCategory} → {selectedIssue.replace(/_/g, ' ')} · {issueSkuBreakdown.length} products · {issueSkuBreakdown.reduce((s, p) => s + p.count, 0).toLocaleString()} reviews
                                </p>
                            </div>

                            {/* SKU Table */}
                            <div className="overflow-auto shrink-0" style={{ maxHeight: issueSkuSelected ? '35vh' : '70vh' }}>
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="text-left px-5 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Product / SKU</th>
                                            <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Reviews</th>
                                                <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400">User Rating</th>
                                            <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400">PDP Rating</th>
                                            <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Positive</th>
                                            <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Negative</th>
                                            <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Sentiment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {issueSkuBreakdown.map((sku, i) => (
                                            <motion.tr
                                                key={sku.name}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: i * 0.02 }}
                                                onClick={() => { setIssueSkuSelected(sku.name === issueSkuSelected ? null : sku.name); setIssueRatingFilter(null); }}
                                                className={`cursor-pointer border-b border-slate-100 dark:border-slate-800 transition-colors
                                                    ${issueSkuSelected === sku.name
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500'
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                            >
                                                <td className="px-5 py-3">
                                                    <span className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{sku.name}</span>
                                                </td>
                                                <td className="text-center px-3 py-3 font-bold text-slate-700 dark:text-slate-300">{sku.count.toLocaleString()}</td>
                                                <td className="text-center px-3 py-3">
                                                    <span className={`inline-flex items-center gap-0.5 font-bold ${sku.avgRating >= 4 ? 'text-emerald-600' : sku.avgRating >= 3 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                        <Star size={10} fill="currentColor" /> {sku.avgRating}
                                                    </span>
                                                </td>
                                                <td className="text-center px-3 py-3">
                                                    {sku.pdpRating ? (
                                                        <span className={`inline-flex items-center gap-0.5 font-bold ${sku.pdpRating >= 4 ? 'text-emerald-600' : sku.pdpRating >= 3 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                            <Star size={10} fill="currentColor" /> {sku.pdpRating}
                                                        </span>
                                                    ) : <span className="text-slate-400">—</span>}
                                                </td>
                                                <td className="text-center px-3 py-3">
                                                    <span className="text-emerald-600 font-semibold">{sku.positivePct}%</span>
                                                </td>
                                                <td className="text-center px-3 py-3">
                                                    <span className="text-rose-600 font-semibold">{sku.negativePct}%</span>
                                                </td>
                                                <td className="text-center px-3 py-3">
                                                    <div className="w-16 h-1.5 mx-auto rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                                                        <div className="h-full bg-emerald-500" style={{ width: `${sku.positivePct}%` }} />
                                                        <div className="h-full bg-rose-500" style={{ width: `${sku.negativePct}%` }} />
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* SKU Reviews Panel — shows when a SKU row is clicked */}
                            <AnimatePresence>
                                {issueSkuSelected && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="border-t border-slate-200 dark:border-slate-800 flex-1 overflow-hidden flex flex-col"
                                    >
                                        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 shrink-0">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white">📦 {issueSkuSelected}</p>
                                                    <p className="text-[10px] text-slate-500">
                                                        {issueSkuReviews.length} reviews {issueRatingFilter ? `(${issueRatingFilter}★ only)` : ''}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => setIssueRatingFilter(null)}
                                                        className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${issueRatingFilter === null ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                                                        All
                                                    </button>
                                                    {[5, 4, 3, 2, 1].map(star => {
                                                        const allSkuRevs = enrichedReviews.filter(r => {
                                                            const parentMatch = viewDimension === 'feedback'
                                                                ? String(r.sentimentCategory || 'General') === selectedCategory
                                                                : r.productCategory === selectedCategory;
                                                            const subMatch = viewDimension === 'feedback'
                                                                ? (r.subcategory || 'General') === selectedIssue
                                                                : (r.productSpec || 'Standard') === selectedIssue;
                                                            return parentMatch && subMatch && (r.product || '') === issueSkuSelected;
                                                        });
                                                        const cnt = allSkuRevs.filter(r => r.rating === star).length;
                                                        return (
                                                            <button key={star} onClick={() => setIssueRatingFilter(issueRatingFilter === star ? null : star)}
                                                                className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${issueRatingFilter === star
                                                                    ? (star >= 4 ? 'bg-emerald-500 text-white' : star === 3 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white')
                                                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                                                                {star}★ ({cnt})
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: '40vh' }}>
                                            {issueSkuReviews.length === 0 ? (
                                                <p className="text-sm text-slate-400 text-center py-6">No reviews match this filter</p>
                                            ) : (
                                                issueSkuReviews.slice(0, 30).map((review, i) => (
                                                    <motion.div key={review.id}
                                                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.01 }}
                                                        className={`rounded-lg p-3 border text-xs ${review.sentiment === 'Positive' ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50'
                                                            : review.sentiment === 'Negative' ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200/50'
                                                                : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/50'}`}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-1.5">
                                                                {Array.from({ length: 5 }).map((_, j) => (
                                                                    <Star key={j} size={9} className={j < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                                                                ))}
                                                                <span className={`px-1 py-0.5 rounded text-[8px] font-bold ml-1 ${review.sentiment === 'Positive' ? 'bg-emerald-100 text-emerald-700'
                                                                    : review.sentiment === 'Negative' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                    {review.sentiment}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400">
                                                                {new Date(review.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{review.text}</p>
                                                    </motion.div>
                                                ))
                                            )}
                                            {issueSkuReviews.length > 30 && (
                                                <p className="text-center text-[10px] text-slate-400 py-2">Showing 30 of {issueSkuReviews.length}</p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {drilldownIssue && (
                <IssueDrilldownModal issue={drilldownIssue} onClose={() => setDrilldownIssue(null)} />
            )}
        </div>
    );
}

export default CategoryHealthView;
