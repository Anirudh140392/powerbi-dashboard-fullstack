import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Target,
    ArrowUpRight,
    ArrowDownRight,
    Flame,
    Shield,
    Lightbulb,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Star,
    BarChart3,
    MessageSquare,
    Activity,
    ExternalLink,
    CheckCircle2,
    XCircle,
    Zap,
    Layers,
    Factory,
    ClipboardCheck,
    Headphones,
    Radar,
    Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Review } from '../types';
import type { TrendItem, ProductHealthItem } from '../hooks/useRatingsAPI';
import { useExecutiveHealth, useIssuesBreakdown, useCategoryHealth, useBenchmarkData } from '../hooks/useRatingsAPI';
import IssueSlider from './IssueSlider';
import StakeholderSlider from './StakeholderSlider';
import CategoryCardsStrip from './CategoryCardsStrip';
import SkuListModal from './SkuListModal';
import CompetitorRadarChart from './CompetitorRadarChart';
import WordSphere3D from './WordSphere3D';
import InfoTooltip from './ui/InfoTooltip';
import { RatingSummaryInline, RatingSummaryCompare } from './ui/RatingSummary';
import type { HealthSku } from '../hooks/useRatingsAPI';
import { TOOLTIPS } from '../config/tooltipDefinitions';
import { createRatingMetrics } from '../utils/ratingMetrics';




// Benchmark metric options
type BenchmarkMetric = 'rating' | 'sentiment' | 'volume';
type CompetitiveCanvasView = 'benchmark' | 'radar' | 'cloud';
type CompetitiveSignalSide = 'prestige' | 'competitor';
const BENCHMARK_METRICS: { key: BenchmarkMetric; label: string; unit: string; tooltip: string }[] = [
    { key: 'rating', label: 'User Rating', unit: '★', tooltip: 'Average star rating from customer reviews (1–5 scale)' },
    { key: 'sentiment', label: 'Positive %', unit: '%', tooltip: 'Percentage of reviews classified as Positive sentiment via NLP' },
    { key: 'volume', label: 'Volume', unit: '', tooltip: 'Total number of reviews received in the selected period' },
];

interface ExecutiveInsightsProps {
    reviews: Review[];
    competitorReviews?: Review[];
    onCharacteristicClick?: (characteristic: string) => void;
    serverTrends?: { escalating: TrendItem[]; improving: TrendItem[] };
    serverTrendsLoading?: boolean;
    serverProductHealth?: ProductHealthItem[];
    serverProductHealthLoading?: boolean;
    onRequestHeavyData?: () => void;
    /** Called when a category card is selected/deselected — syncs with GlobalFilterBar */
    onCategorySelect?: (category: string | null) => void;
    /** Category selected externally via GlobalFilterBar — syncs back to card highlight */
    externalSelectedCategory?: string | null;
    /** Global Pareto status filter from GlobalFilterBar (e.g. 'Pareto', 'Non-Pareto', 'NPD') */
    globalParetoStatus?: string;
    /** Global Rating Bifurcation filter from GlobalFilterBar (NP / Issue / NI) */
    globalRatingBifurcation?: string;
    /** Called when a Pareto/Non-Pareto/NPD card is clicked — syncs with GlobalFilterBar Type dropdown */
    onClassificationSelect?: (classification: 'pareto' | 'non-pareto' | 'npd' | 'all') => void;
    /** Which pareto bucket is currently selected externally (from GlobalFilterBar) */
    externalClassification?: 'pareto' | 'non-pareto' | 'npd' | 'all';
    /** Global platform filter from GlobalFilterBar (e.g. 'Amazon', 'Flipkart', 'all') */
    globalPlatform?: string;
    /** Dynamic trend comparison period from top bar */
    globalTrendPeriodMonths?: number;
    globalDateFrom?: string;
    globalDateTo?: string;
    globalPriceMode?: 'rp' | 'sp';
    globalPriceRange?: { min: number; max: number } | null;
    globalBrandScope?: string | null;
    globalSentimentCategory?: string | null;
}

// ============================================================================
// GAUGE COMPONENT
// ============================================================================

export const SentimentGauge: React.FC<{ score: number; label: string; subtitle: string }> = ({ score, label, subtitle }) => {
    const radius = 58;
    const circumference = Math.PI * radius; // semicircle
    const normalizedScore = Math.max(-100, Math.min(100, score));
    const percentage = (normalizedScore + 100) / 200; // 0-1
    const offset = circumference - (percentage * circumference);
    const color = normalizedScore > 20 ? '#22c55e' : normalizedScore > -10 ? '#f59e0b' : '#ef4444';

    return (
        <div className="flex flex-col items-center">
            <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
                {/* Background arc */}
                <path
                    d="M 10 75 A 58 58 0 0 1 130 75"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeLinecap="round"
                    className="text-slate-200 dark:text-slate-700"
                />
                {/* Filled arc */}
                <motion.path
                    d="M 10 75 A 58 58 0 0 1 130 75"
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                />
                {/* Score text */}
                <text x="70" y="65" textAnchor="middle" className="fill-slate-900 dark:fill-white" fontSize="28" fontWeight="bold">
                    {normalizedScore > 0 ? '+' : ''}{normalizedScore}
                </text>
                <text x="70" y="80" textAnchor="middle" className="fill-slate-400" fontSize="9">
                    {subtitle}
                </text>
            </svg>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">{label}</span>
        </div>
    );
};

// ============================================================================
// MINI SPARKLINE COMPONENT
// ============================================================================

const MiniSparkline: React.FC<{ data: number[]; color?: string; height?: number }> = ({ data, color = '#6366f1', height = 28 }) => {
    if (data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const w = 80;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={w} height={height} className="shrink-0">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* End dot */}
            {data.length > 0 && (() => {
                const lastX = w;
                const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
                return <circle cx={lastX} cy={lastY} r="2.5" fill={color} />;
            })()}
        </svg>
    );
};

const SectionLoadingState: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex items-center justify-center py-8 text-sm text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span>{label}</span>
        </div>
    </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ExecutiveInsights: React.FC<ExecutiveInsightsProps> = ({ reviews, competitorReviews = [], onCharacteristicClick, serverTrends, serverTrendsLoading = false, serverProductHealth, serverProductHealthLoading = false, onRequestHeavyData, onCategorySelect, externalSelectedCategory, globalParetoStatus, globalRatingBifurcation, onClassificationSelect, externalClassification, globalPlatform, globalTrendPeriodMonths, globalDateFrom, globalDateTo, globalPriceMode, globalPriceRange, globalBrandScope, globalSentimentCategory }) => {
    const selectedPeriod = globalTrendPeriodMonths || 6;
    const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
    const [productHealthTab, setProductHealthTab] = useState<'declining' | 'improving'>('declining');
    const [healthPage, setHealthPage] = useState(1);
    const HEALTH_ITEMS_PER_PAGE = 5;

    // Reset page when tab changes
    useEffect(() => {
        setHealthPage(1);
    }, [productHealthTab]);
    
    const [benchmarkMetric, setBenchmarkMetric] = useState<BenchmarkMetric>('rating');
    const [competitiveCanvasView, setCompetitiveCanvasView] = useState<CompetitiveCanvasView>('benchmark');
    const [competitiveSignalSide, setCompetitiveSignalSide] = useState<CompetitiveSignalSide>('prestige');
    const [fullTrendProduct, setFullTrendProduct] = useState<string | null>(null);
    const [belowFoldDataReady, setBelowFoldDataReady] = useState(false);
    const belowFoldTriggerRef = useRef<HTMLDivElement | null>(null);
    const [benchmarkDataReady, setBenchmarkDataReady] = useState(false);
    const benchmarkTriggerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (belowFoldDataReady) return;
        const node = belowFoldTriggerRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            setTimeout(() => setBelowFoldDataReady(true), 0);
            return;
        }

        const observer = new IntersectionObserver(
            entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    setBelowFoldDataReady(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '320px 0px' },
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [belowFoldDataReady]);

    useEffect(() => {
        if (benchmarkDataReady) return;
        const node = benchmarkTriggerRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            setTimeout(() => setBenchmarkDataReady(true), 0);
            return;
        }

        const observer = new IntersectionObserver(
            entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    setBenchmarkDataReady(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '240px 0px' },
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [benchmarkDataReady]);

    useEffect(() => {
        if (belowFoldDataReady) {
            onRequestHeavyData?.();
        }
    }, [belowFoldDataReady, onRequestHeavyData]);

    const currentCategory = externalSelectedCategory ?? null;
    const handleCategorySelect = (cat: string | null) => {
        console.log('ExecutiveInsights: Selecting category:', cat);
        if (onCategorySelect) {
            onCategorySelect(cat);
        }
    };
    const { data: categoryHealthData, globalMetadata, loading: categoryHealthLoading } = useCategoryHealth(
        globalPlatform,
        globalTrendPeriodMonths,
        globalDateFrom,
        globalDateTo,
        globalPriceMode,
        globalPriceRange,
        globalBrandScope,
        globalSentimentCategory,
        currentCategory,
    );
    const { data: executiveHealth, loading: healthLoading } = useExecutiveHealth(
        currentCategory,
        null,
        globalRatingBifurcation,
        globalPlatform,
        globalTrendPeriodMonths,
        globalDateFrom,
        globalDateTo,
        globalPriceMode,
        globalPriceRange,
        globalBrandScope,
        globalSentimentCategory,
        { enabled: belowFoldDataReady },
    );
    const { data: nlpIssues, loading: issuesLoading } = useIssuesBreakdown(
        currentCategory,
        globalParetoStatus,
        globalRatingBifurcation,
        globalPlatform,
        globalTrendPeriodMonths,
        globalDateFrom,
        globalDateTo,
        globalPriceMode,
        globalPriceRange,
        globalBrandScope,
        globalSentimentCategory,
        { enabled: belowFoldDataReady },
    );
    const { benchmarks, loading: benchmarkLoading } = useBenchmarkData(
        currentCategory || undefined,
        {
            platform: globalPlatform && globalPlatform !== 'all' ? globalPlatform : undefined,
            date_from: globalDateFrom,
            date_to: globalDateTo,
            period_months: selectedPeriod,
            price_mode: globalPriceMode || undefined,
            price_min: globalPriceRange?.min,
            price_max: globalPriceRange?.max,
        },
        { enabled: benchmarkDataReady },
    );

    // V2 drill-down state — kept in sync with externalClassification (GlobalFilterBar Type)
    type ParetoKey = 'pareto' | 'nonPareto' | 'npd';

    // Map external classification (GlobalFilterBar) → local ParetoKey for card highlight
    const extToKey = (cls?: 'pareto' | 'non-pareto' | 'npd' | 'all'): ParetoKey | null => {
        if (cls === 'pareto') return 'pareto';
        if (cls === 'non-pareto') return 'nonPareto';
        if (cls === 'npd') return 'npd';
        return null;
    };
    const [localExpandedPareto, setLocalExpandedPareto] = useState<ParetoKey | null>(null);
    // Prefer external (GlobalFilterBar) selection; fall back to local card click
    const expandedPareto: ParetoKey | null =
        externalClassification && externalClassification !== 'all'
            ? extToKey(externalClassification)
            : localExpandedPareto;

    // Map ParetoKey → classification string for global filter
    const keyToClassification = (key: ParetoKey | null): 'pareto' | 'non-pareto' | 'npd' | 'all' => {
        if (key === 'pareto') return 'pareto';
        if (key === 'nonPareto') return 'non-pareto';
        if (key === 'npd') return 'npd';
        return 'all';
    };

    const handleParetoCardClick = (key: ParetoKey) => {
        const newKey = localExpandedPareto === key ? null : key;
        setLocalExpandedPareto(newKey);
        // Propagate to global state — this drives filteredPrestigeReviews + NLP refetch
        if (onClassificationSelect) {
            onClassificationSelect(keyToClassification(newKey));
        }
    };

    // SKU List Modal state (replaces inline Level 3 table)
    const [skuModalData, setSkuModalData] = useState<{
        skus: HealthSku[];
        bucketLabel: string;
        statusLabel: string;
        statusColor: string;
        totalRatings: number;
        avgPlatformRating: number | null;
        positiveRate: number;
    } | null>(null);

    // Issue slider state
    const [activeIssue, setActiveIssue] = useState<{ subcategory: string; label: string } | null>(null);

    // Stakeholder slider state
    const [activeStakeholder, setActiveStakeholder] = useState<string | null>(null);

    // Aggregate NLP issues by stakeholder — completely dynamic list based on API map
    const stakeholderSummary = useMemo(() => {
        const stakeholders: Record<string, { name: string; negativeCount: number; totalIssues: number; skuCount: Set<string>; avgRating: number; topIssues: string[] }> = {};
        const ratingCounts: Record<string, number> = {};

        nlpIssues.forEach(issue => {
            const owner = issue.stakeholder;
            if (!owner) return; // skip unmapped issues

            if (!stakeholders[owner]) {
                stakeholders[owner] = { name: owner, negativeCount: 0, totalIssues: 0, skuCount: new Set(), avgRating: 0, topIssues: [] };
                ratingCounts[owner] = 0;
            }

            stakeholders[owner].negativeCount += issue.negativeCount;
            stakeholders[owner].totalIssues++;
            // skuCount is tracked per-issue; we can't deduplicate here so just use the sum as an upper bound
            stakeholders[owner].avgRating += issue.avgRating * issue.negativeCount;
            ratingCounts[owner] += issue.negativeCount;
            if (stakeholders[owner].topIssues.length < 3) {
                stakeholders[owner].topIssues.push(issue.label);
            }
        });

        Object.keys(stakeholders).forEach(k => {
            if (ratingCounts[k] > 0) stakeholders[k].avgRating = stakeholders[k].avgRating / ratingCounts[k];
        });

        return Object.values(stakeholders)
            .filter(s => s.totalIssues > 0)
            .sort((a, b) => b.negativeCount - a.negativeCount);
    }, [nlpIssues]);

    const handleClick = (characteristic: string) => {
        if (onCharacteristicClick) {
            onCharacteristicClick(characteristic);
        }
    };

    const trendAnalysis = useMemo(() => {
        const escalating = serverTrends?.escalating ?? [];
        const improving = serverTrends?.improving ?? [];
        return {
            escalating,
            improving,
            all: [...escalating, ...improving],
        };
    }, [serverTrends]);

    const productHealth = useMemo(() => serverProductHealth ?? [], [serverProductHealth]);



    // Competitive benchmark from real competitor data — multi-metric
    const competitiveBenchmark = useMemo(() => {
        // Derive categories dynamically from actual review data — no hardcoded list
        const catSet = new Set<string>();
        reviews.forEach(r => { if (r.sentimentCategory) catSet.add(r.sentimentCategory as string); });
        competitorReviews.forEach(r => { if (r.sentimentCategory) catSet.add(r.sentimentCategory); });
        const categories = Array.from(catSet).sort();

        // Prestige stats from selected period
        const now = new Date();
        const periodAgo = new Date(now);
        periodAgo.setMonth(periodAgo.getMonth() - selectedPeriod);

        const prestigeStats: Record<string, { sum: number; count: number; positive: number }> = {};
        reviews.filter(r => r.date && new Date(r.date) >= periodAgo).forEach(r => {
            const cat = r.sentimentCategory || 'General';
            if (!prestigeStats[cat]) prestigeStats[cat] = { sum: 0, count: 0, positive: 0 };
            prestigeStats[cat].sum += r.rating;
            prestigeStats[cat].count++;
            if (r.sentiment === 'Positive') prestigeStats[cat].positive++;
        });

        // Competitor stats - computed from actual data
        const compStats: Record<string, { sum: number; count: number; positive: number }> = {};
        const brandStats: Record<string, Record<string, { sum: number; count: number; positive: number }>> = {};

        competitorReviews.forEach(r => {
            const cat = r.sentimentCategory || 'General';
            if (!compStats[cat]) compStats[cat] = { sum: 0, count: 0, positive: 0 };
            compStats[cat].sum += r.rating;
            compStats[cat].count++;
            const isPositive = r.sentiment?.toUpperCase() === 'POSITIVE' || r.sentiment === 'Positive';
            if (isPositive) compStats[cat].positive++;

            // Per-brand
            const brand = r.brand || 'Unknown';
            if (!brandStats[brand]) brandStats[brand] = {};
            if (!brandStats[brand][cat]) brandStats[brand][cat] = { sum: 0, count: 0, positive: 0 };
            brandStats[brand][cat].sum += r.rating;
            brandStats[brand][cat].count++;
            if (isPositive) brandStats[brand][cat].positive++;
        });

        const brands = Object.keys(brandStats).sort((a, b) => {
            const aTotal = Object.values(brandStats[a]).reduce((s, c) => s + c.count, 0);
            const bTotal = Object.values(brandStats[b]).reduce((s, c) => s + c.count, 0);
            return bTotal - aTotal;
        });

        return categories.map(cat => {
            const pData = prestigeStats[cat] || { sum: 0, count: 0, positive: 0 };
            const cData = compStats[cat] || { sum: 0, count: 0, positive: 0 };
            const prestigeAvg = pData.count > 0 ? pData.sum / pData.count : 0;
            const compAvg = cData.count > 0 ? cData.sum / cData.count : 0;
            const prestigePositiveRate = pData.count > 0 ? (pData.positive / pData.count) * 100 : 0;
            const compPositiveRate = cData.count > 0 ? (cData.positive / cData.count) * 100 : 0;

            // Per-brand breakdown
            const brandBreakdown = brands.map(brand => {
                const bData = brandStats[brand]?.[cat] || { sum: 0, count: 0, positive: 0 };
                const bPositiveRate = bData.count > 0 ? (bData.positive / bData.count) * 100 : 0;
                return { brand, avg: bData.count > 0 ? bData.sum / bData.count : 0, count: bData.count, positiveRate: bPositiveRate };
            }).filter(b => b.count > 0);

            return {
                category: cat,
                prestigeAvg, prestigeCount: pData.count, prestigePositiveRate,
                compAvg, compCount: cData.count, compPositiveRate,
                brandBreakdown,
            };
        });
    }, [reviews, competitorReviews, selectedPeriod]);

    const serverCompetitiveBenchmark = useMemo(() => {
        const ownRow = benchmarks.find(row => !row.is_competitor);
        const competitorRows = benchmarks.filter(row => row.is_competitor);
        const categorySet = new Set<string>();

        Object.keys(ownRow?.category_scores || {}).forEach(category => categorySet.add(category));
        competitorRows.forEach(row => {
            Object.keys(row.category_scores || {}).forEach(category => categorySet.add(category));
        });

        return Array.from(categorySet)
            .map(category => {
                const ownScore = ownRow?.category_scores?.[category];
                const prestigeCount = ownScore?.total || 0;
                const prestigeAvg = ownScore?.avg_rating || 0;
                const prestigePositiveRate = prestigeCount > 0 ? (ownScore!.positive / prestigeCount) * 100 : 0;

                let compCount = 0;
                let compPositive = 0;
                let compWeightedRating = 0;
                const brandBreakdown: Array<{ brand: string; avg: number; count: number; positiveRate: number }> = [];

                competitorRows.forEach(row => {
                    const score = row.category_scores?.[category];
                    if (!score || score.total <= 0) return;

                    compCount += score.total;
                    compPositive += score.positive;
                    compWeightedRating += score.avg_rating * score.total;
                    brandBreakdown.push({
                        brand: row.brand,
                        avg: score.avg_rating,
                        count: score.total,
                        positiveRate: (score.positive / score.total) * 100,
                    });
                });

                return {
                    category,
                    prestigeAvg,
                    prestigeCount,
                    prestigePositiveRate,
                    compAvg: compCount > 0 ? compWeightedRating / compCount : 0,
                    compCount,
                    compPositiveRate: compCount > 0 ? (compPositive / compCount) * 100 : 0,
                    brandBreakdown: brandBreakdown.sort((a, b) => b.count - a.count),
                };
            })
            .filter(item => item.prestigeCount > 0 || item.compCount > 0)
            .sort((a, b) => Math.max(b.prestigeCount, b.compCount) - Math.max(a.prestigeCount, a.compCount));
    }, [benchmarks]);
    void competitiveBenchmark;

    const overallBenchmarkComparison = useMemo(() => {
        const ownRow = benchmarks.find(row => !row.is_competitor);
        const competitorRows = benchmarks.filter(row => row.is_competitor);

        const competitorReviewCount = competitorRows.reduce((sum, row) => sum + Number(row.review_count || row.total_reviews || 0), 0);
        const competitorRatingCount = competitorRows.reduce((sum, row) => sum + Number(row.rating_count || 0), 0);
        const competitorUserWeighted = competitorRows.reduce((sum, row) => sum + (Number(row.user_rating || row.avg_rating || 0) * Number(row.review_count || row.total_reviews || 0)), 0);
        const competitorMlWeighted = competitorRows.reduce((sum, row) => sum + (Number(row.ml_rating || 0) * Number(row.review_count || row.total_reviews || 0)), 0);
        const competitorPdpWeighted = competitorRows.reduce((sum, row) => sum + (Number(row.pdp_rating || 0) * Number(row.rating_count || 0)), 0);

        return {
            ownMetrics: ownRow ? createRatingMetrics({
                pdp_rating: ownRow.pdp_rating ? Number(ownRow.pdp_rating) : null,
                user_rating: ownRow.user_rating ? Number(ownRow.user_rating) : null,
                ml_rating: ownRow.ml_rating ? Number(ownRow.ml_rating) : null,
                review_count: Number(ownRow.review_count || ownRow.total_reviews || 0),
                rating_count: Number(ownRow.rating_count || 0),
            }) : null,
            competitorMetrics: competitorReviewCount > 0 || competitorRatingCount > 0
                ? createRatingMetrics({
                    pdp_rating: competitorRatingCount > 0 ? competitorPdpWeighted / competitorRatingCount : null,
                    user_rating: competitorReviewCount > 0 ? competitorUserWeighted / competitorReviewCount : null,
                    ml_rating: competitorReviewCount > 0 ? competitorMlWeighted / competitorReviewCount : null,
                    review_count: competitorReviewCount,
                    rating_count: competitorRatingCount,
                })
                : null,
        };
    }, [benchmarks]);

    const competitiveSignalStats = useMemo(() => {
        const ownCategories = Array.from(new Set(
            reviews
                .map(review => review.sentimentCategory?.trim())
                .filter((value): value is string => Boolean(value))
        ));
        const competitorCategories = Array.from(new Set(
            competitorReviews
                .map(review => review.sentimentCategory?.trim())
                .filter((value): value is string => Boolean(value))
        ));
        const competitorCategorySet = new Set(competitorCategories);
        const ownRow = benchmarks.find(row => !row.is_competitor);
        const ownBenchmarkCategories = Object.keys(ownRow?.category_scores || {});
        const competitorBenchmarkCategorySet = new Set<string>();

        benchmarks
            .filter(row => row.is_competitor)
            .forEach(row => {
                Object.keys(row.category_scores || {}).forEach(category => competitorBenchmarkCategorySet.add(category));
            });

        const prestigeReviewCount = reviews.length > 0
            ? reviews.length
            : Number(overallBenchmarkComparison.ownMetrics?.review_count || 0);
        const competitorReviewCount = competitorReviews.length > 0
            ? competitorReviews.length
            : Number(overallBenchmarkComparison.competitorMetrics?.review_count || 0);
        const prestigeCategoryCount = ownCategories.length > 0
            ? ownCategories.length
            : ownBenchmarkCategories.length;
        const competitorCategoryCount = competitorCategories.length > 0
            ? competitorCategories.length
            : competitorBenchmarkCategorySet.size;
        const sharedCategoryCount = serverCompetitiveBenchmark.length > 0
            ? serverCompetitiveBenchmark.length
            : ownCategories.filter(category => competitorCategorySet.has(category)).length;

        return {
            prestigeReviewCount,
            competitorReviewCount,
            prestigeCategoryCount,
            competitorCategoryCount,
            sharedCategoryCount,
        };
    }, [benchmarks, competitorReviews, overallBenchmarkComparison, reviews, serverCompetitiveBenchmark]);

    const competitorVisualsLoading = belowFoldDataReady
        && competitorReviews.length === 0
        && serverCompetitiveBenchmark.some(item => item.compCount > 0);

    const getHealthColor = (score: number) => {
        if (score >= 70) return 'text-emerald-500';
        if (score >= 50) return 'text-amber-500';
        return 'text-rose-500';
    };

    const getHealthBg = (score: number) => {
        if (score >= 70) return 'bg-emerald-500';
        if (score >= 50) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    const sanitizeProductName = (name: string) => {
        // Remove leading numbers followed by a space (e.g., "43 SKU Name" -> "SKU Name")
        return name.replace(/^\d+\s+/, '').trim();
    };

    const decliningProducts = productHealth
        .map(p => ({ ...p, product: sanitizeProductName(p.product) }))
        .filter(p => p.trend === 'declining' || p.healthScore < 50)
        .sort((a, b) => a.healthScore - b.healthScore);

    const improvingProducts = productHealth
        .map(p => ({ ...p, product: sanitizeProductName(p.product) }))
        .filter(p => p.trend === 'improving' || p.healthScore >= 70)
        .sort((a, b) => b.healthScore - a.healthScore);



    return (
        <>
            <div className="space-y-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm p-5 shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <BarChart3 className="text-indigo-500" size={22} />
                        Executive Summary
                        <InfoTooltip definition={TOOLTIPS.executiveSummary} placement="right" />
                    </h2>
                </div>

                {/* ===== CATEGORY CARDS STRIP ===== */}
                <CategoryCardsStrip
                    categories={categoryHealthData}
                    globalMetadata={globalMetadata}
                    loading={categoryHealthLoading}
                    selectedCategory={currentCategory}
                    onCategorySelect={handleCategorySelect}
                />

                {/* ===== V2: PARETO / NON-PARETO / NPD CLASSIFICATION CARDS ===== */}
                {healthLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : executiveHealth && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {([
                                // authorativeTotal prefers the catalogue count (executive-health now returns
                                // per-bucket catalogueTotal from masters.products) so NPD/Pareto reflect the
                                // full catalogue, not just SKUs reviewed in the window (NPD was showing 1 vs 19).
                                { key: 'npd' as const, label: 'NPD', bucket: executiveHealth.npd, authorativeTotal: executiveHealth.npd.catalogueTotal ?? globalMetadata?.npdCount ?? executiveHealth.npd.total, color: 'indigo', icon: <Zap size={20} />, desc: 'New Product Development', tooltipDef: TOOLTIPS.npdCard },
                                { key: 'pareto' as const, label: 'Pareto', bucket: executiveHealth.pareto, authorativeTotal: executiveHealth.pareto.catalogueTotal ?? globalMetadata?.paretoCount ?? executiveHealth.pareto.total, color: 'indigo', icon: <Target size={20} />, desc: 'High-value SKUs', tooltipDef: TOOLTIPS.paretoCard },
                                { key: 'nonPareto' as const, label: 'Non-Pareto', bucket: executiveHealth.nonPareto, authorativeTotal: executiveHealth.nonPareto.catalogueTotal ?? globalMetadata?.nonParetoCount ?? executiveHealth.nonPareto.total, color: 'slate', icon: <Layers size={20} />, desc: 'Standard catalogue', tooltipDef: TOOLTIPS.nonParetoCard },
                            ]).map(({ key, label, bucket, authorativeTotal, icon, desc, tooltipDef }) => {
                                const isExpanded = expandedPareto === key;
                                // Build a healthy/watch/at-risk health bar from the rating-bifurcation buckets
                                const healthTotal = (bucket?.np?.count || 0) + (bucket?.ni?.count || 0) + (bucket?.issue?.count || 0);
                                const healthyPct = healthTotal > 0 ? ((bucket?.np?.count || 0) / healthTotal) * 100 : 0;
                                const watchPct = healthTotal > 0 ? ((bucket?.ni?.count || 0) / healthTotal) * 100 : 0;
                                const atRiskPct = healthTotal > 0 ? ((bucket?.issue?.count || 0) / healthTotal) * 100 : 0;
                                // Helpers for compact number formatting
                                const fmtK = (n: number) => n >= 10000000 ? `${(n/10000000).toFixed(1)}Cr` : n >= 100000 ? `${(n/100000).toFixed(1)}L` : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n);
                                const reviewsN = bucket.totalReviewCount ?? 0;
                                const ratingsN = Number(bucket.totalRatings || 0);
                                const hasData = reviewsN > 0 || ratingsN > 0;
                                return (
                                <motion.div
                                    key={key}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    whileHover={{ y: -2 }}
                                    onClick={() => handleParetoCardClick(key)}
                                    className={`p-3.5 rounded-xl bg-white dark:bg-slate-900 cursor-pointer transition-all border ${
                                        isExpanded
                                            ? 'border-indigo-500 ring-1 ring-indigo-500/30 shadow-sm'
                                            : 'border-slate-200 dark:border-slate-700/60 hover:border-indigo-400 hover:shadow-sm'
                                    }`}
                                >
                                    {/* Single header line: icon + title + desc + trend + chevron */}
                                    <div className="flex items-center gap-2 mb-2.5">
                                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                            {icon}
                                        </div>
                                        <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1">
                                            {label}
                                            <InfoTooltip definition={tooltipDef} placement="top" size="sm" />
                                        </h3>
                                        <span className="text-[10px] text-slate-400 truncate">· {desc}</span>
                                        {bucket.reviewGrowthPct !== 0 && (
                                            <span className={`ml-auto text-[10px] font-semibold inline-flex items-center gap-0.5 shrink-0 ${
                                                bucket.reviewGrowthPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                            }`} title="Review volume vs prior period">
                                                {bucket.reviewGrowthPct > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                                {bucket.reviewGrowthPct > 0 ? '+' : ''}{bucket.reviewGrowthPct}% vol
                                            </span>
                                        )}
                                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="shrink-0">
                                            <ChevronDown size={14} className="text-slate-400" />
                                        </motion.div>
                                    </div>

                                    {!hasData ? (
                                        authorativeTotal > 0 ? (
                                            // Catalogue SKUs exist but none have reviews in the window
                                            // (common for NPD). Show the count, not just an empty message.
                                            <div className="flex items-baseline gap-1.5 py-3">
                                                <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">
                                                    {authorativeTotal.toLocaleString()}
                                                </span>
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">SKUs</span>
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500 italic ml-1">· no reviews yet</span>
                                            </div>
                                        ) : (
                                            <div className="text-[11px] text-slate-400 dark:text-slate-500 italic py-3">
                                                No {label} SKUs yet
                                            </div>
                                        )
                                    ) : (
                                    <>
                                    {/* Single dense stats row: hero count · ratings · counts · delta */}
                                    <div className="grid grid-cols-12 gap-3 items-center">
                                        {/* Hero SKU count — 3 cols */}
                                        <div className="col-span-3">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">
                                                    {Number(authorativeTotal).toLocaleString()}
                                                </span>
                                                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">SKUs</span>
                                            </div>
                                            <div className="flex gap-2 mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                                                <span title={`${reviewsN.toLocaleString()} reviews`} className="inline-flex items-center gap-0.5">
                                                    <MessageSquare size={9} /><span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(reviewsN)}</span>
                                                </span>
                                                <span title={`${ratingsN.toLocaleString()} ratings`} className="inline-flex items-center gap-0.5">
                                                    <BarChart3 size={9} /><span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(ratingsN)}</span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* 3-column rating triplet — 6 cols */}
                                        <div className="col-span-6 flex items-stretch border-x border-slate-100 dark:border-slate-800 px-3">
                                            {[
                                                { label: 'PDP', value: bucket.avgPlatformRating },
                                                { label: 'User', value: bucket.userRating },
                                                { label: 'ML', value: bucket.mlRating },
                                            ].map((m, i) => (
                                                <React.Fragment key={m.label}>
                                                    {i > 0 && <div className="w-px bg-slate-100 dark:bg-slate-800 mx-1" />}
                                                    <div className="flex-1 flex flex-col items-center justify-center">
                                                        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</span>
                                                        <span className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">
                                                            {m.value != null ? Number(m.value).toFixed(1) : '—'}
                                                        </span>
                                                    </div>
                                                </React.Fragment>
                                            ))}
                                        </div>

                                        {/* Rating delta vs prior — 3 cols */}
                                        <div className="col-span-3 text-right">
                                            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Δ vs prior</div>
                                            <div className={`text-lg font-bold tabular-nums leading-tight inline-flex items-center gap-1 ${
                                                bucket.ratingGrowthDiff > 0 ? 'text-emerald-600 dark:text-emerald-400'
                                                : bucket.ratingGrowthDiff < 0 ? 'text-rose-600 dark:text-rose-400'
                                                : 'text-slate-400'
                                            }`}>
                                                {bucket.ratingGrowthDiff !== 0 && <Star size={11} className="fill-current" />}
                                                {bucket.ratingGrowthDiff > 0 ? '+' : ''}{bucket.ratingGrowthDiff || '0'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rating health — bar + inline chips on one line */}
                                    {healthTotal > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex-1 min-w-0" title={`${Math.round(healthyPct)}% healthy · ${Math.round(watchPct)}% watch · ${Math.round(atRiskPct)}% at-risk`}>
                                                    {healthyPct > 0 && <div style={{ width: `${healthyPct}%` }} className="bg-emerald-500" />}
                                                    {watchPct > 0 && <div style={{ width: `${watchPct}%` }} className="bg-amber-500" />}
                                                    {atRiskPct > 0 && <div style={{ width: `${atRiskPct}%` }} className="bg-rose-500" />}
                                                </div>
                                                <div className="flex gap-2 text-[10px] tabular-nums shrink-0">
                                                    {bucket?.np?.count > 0 && (
                                                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400" title="Rating ≥ 4.2★">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{bucket.np.count}
                                                        </span>
                                                    )}
                                                    {bucket?.ni?.count > 0 && (
                                                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400" title="Rating 4.0–4.2★">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{bucket.ni.count}
                                                        </span>
                                                    )}
                                                    {bucket?.issue?.count > 0 && (
                                                        <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400" title="Rating < 4.0★">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{bucket.issue.count}
                                                        </span>
                                                    )}
                                                    {bucket?.noRating?.count > 0 && (
                                                        <span className="inline-flex items-center gap-1 text-slate-500" title="Not yet rated">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />{bucket.noRating.count}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    </>
                                    )}
                                </motion.div>
                                );
                            })}
                        </div>

                        {/* ===== DRILL-DOWN LEVEL 2: Rating Bifurcation (NP / Issue / NI) ===== */}
                        <AnimatePresence>
                            {expandedPareto && executiveHealth[expandedPareto] && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="card p-5">
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                            <Activity size={16} className="text-indigo-500" />
                                            {executiveHealth[expandedPareto].name} — Rating Bifurcation
                                            <InfoTooltip definition={TOOLTIPS.ratingBifurcation} placement="right" />
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                            {([
                                                { status: 'np' as const, label: 'No Problem (NP)', desc: '≥4.2 Rating', icon: <CheckCircle2 size={16} />, color: 'emerald' },
                                                { status: 'ni' as const, label: 'No Issue (NI)', desc: '4.0–4.2 Rating', icon: <Shield size={16} />, color: 'blue' },
                                                { status: 'issue' as const, label: 'Issue', desc: '<4.0 Rating', icon: <XCircle size={16} />, color: 'orange' },
                                                { status: 'critical' as const, label: 'Critical Issue', desc: '>15% 1-Star', icon: <AlertTriangle size={16} />, color: 'red' },
                                            ]).map(({ status, label, desc, icon, color }) => {
                                                const group = executiveHealth[expandedPareto!][status];
                                                return (
                                                    <motion.div
                                                        key={status}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        whileHover={{ scale: 1.02 }}
                                                        onClick={() => {
                                                            if (!expandedPareto || !executiveHealth?.[expandedPareto]) return;
                                                            setSkuModalData({
                                                                skus: group.skus,
                                                                bucketLabel: executiveHealth[expandedPareto].name,
                                                                statusLabel: label,
                                                                statusColor: color,
                                                                totalRatings: group.totalRatings,
                                                                avgPlatformRating: group.avgPlatformRating,
                                                                positiveRate: group.positiveRate,
                                                            });
                                                        }}
                                                        className={`p-4 rounded-xl cursor-pointer transition-all border-2 border-slate-200/40 dark:border-slate-700/40 hover:border-${color}-300 dark:hover:border-${color}-600 hover:shadow-md bg-gradient-to-br from-${color}-500/5 to-transparent`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className={`text-${color}-500`}>{icon}</div>
                                                            <div>
                                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
                                                                <p className="text-[9px] text-slate-400">{desc}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-baseline gap-1.5">
                                                            <span className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>
                                                                {group.count}
                                                            </span>
                                                            <span className="text-xs text-slate-400">SKUs</span>
                                                        </div>
                                                        <div className="mt-2">
                                                            <RatingSummaryInline
                                                                metrics={createRatingMetrics({
                                                                    pdp_rating: group.avgPlatformRating,
                                                                    user_rating: group.userRating ?? null,
                                                                    ml_rating: group.mlRating ?? null,
                                                                    review_count: group.totalReviewCount ?? 0,
                                                                    rating_count: group.totalRatings,
                                                                })}
                                                                title={`${label} group`}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {group.positiveRate > 0 && (
                                                                <span className="flex items-center gap-0.5 text-[9px] text-emerald-500 font-medium">
                                                                    <TrendingUp size={9} />
                                                                    {group.positiveRate}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* SKU List Modal (replaces inline Level 3 table) */}
                        <SkuListModal
                            isOpen={!!skuModalData}
                            onClose={() => setSkuModalData(null)}
                            skus={skuModalData?.skus ?? []}
                            bucketLabel={skuModalData?.bucketLabel ?? ''}
                            statusLabel={skuModalData?.statusLabel ?? ''}
                            statusColor={skuModalData?.statusColor ?? 'slate'}
                            totalRatings={skuModalData?.totalRatings ?? 0}
                            avgPlatformRating={skuModalData?.avgPlatformRating ?? null}
                            positiveRate={skuModalData?.positiveRate ?? 0}
                        />
                    </>
                )}

                <div ref={belowFoldTriggerRef} className="h-px w-full" />

                {/* ===== STAKEHOLDER OWNERSHIP CARDS ===== */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-5"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="text-amber-500" size={20} />
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            Stakeholder Ownership
                            <InfoTooltip definition={TOOLTIPS.stakeholderOwnership} placement="right" />
                        </h3>
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium ml-1">
                            NLP Analysis
                        </span>
                    </div>

                    {!belowFoldDataReady || issuesLoading ? (
                        <SectionLoadingState label="Loading stakeholder issue analysis..." />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {stakeholderSummary.map((sh, idx) => {
                                // Icon-only color encoding (no card background). The category itself
                                // is the signal; severity is conveyed by the negative count number.
                                const icon = sh.name === 'Production'
                                    ? <Factory size={18} />
                                    : sh.name === 'QC'
                                        ? <ClipboardCheck size={18} />
                                        : <Headphones size={18} />;
                                return (
                                    <motion.div
                                        key={sh.name}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.06 }}
                                        whileHover={{ y: -2 }}
                                        onClick={() => setActiveStakeholder(sh.name)}
                                        className="relative p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all group"
                                    >
                                        {/* Header — icon + name + categories chip + rating */}
                                        <div className="flex items-start gap-2.5 mb-3">
                                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                                {icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-slate-900 dark:text-white text-[15px] leading-tight">{sh.name}</h4>
                                                <span className="inline-block mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                    {sh.totalIssues} categories
                                                </span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Avg</div>
                                                <div className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">{sh.avgRating.toFixed(1)}<span className="text-amber-500">★</span></div>
                                            </div>
                                        </div>

                                        {/* Hero metric — negative review count (severity-coloured) */}
                                        <div className="mb-3">
                                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Negative reviews</div>
                                            <div className={`text-3xl font-bold tabular-nums leading-none ${
                                                sh.negativeCount > 3000 ? 'text-rose-600 dark:text-rose-400'
                                                : sh.negativeCount > 1000 ? 'text-amber-600 dark:text-amber-400'
                                                : 'text-slate-700 dark:text-slate-200'
                                            }`}>
                                                {sh.negativeCount.toLocaleString()}
                                            </div>
                                        </div>

                                        {/* Top Issues — each with bullet marker, no per-card color */}
                                        <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Top issues</div>
                                            {sh.topIssues.map(issue => (
                                                <div key={issue} className="flex items-center gap-1.5">
                                                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                                                    <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{issue}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Hover hint */}
                                        <div className="absolute bottom-2 right-3 opacity-0 group-hover:opacity-100 transition-all text-[10px] font-medium text-indigo-500 flex items-center gap-1">
                                            View details <ExternalLink size={10} />
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>

                <div ref={benchmarkTriggerRef} className="h-px w-full" />

                {/* Competitive Benchmark — Multi-Metric */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-5 border border-purple-200/40 dark:border-purple-800/40"
                >
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Target className="text-purple-500" size={20} />
                            <h3 className="font-bold text-slate-900 dark:text-white">Competitive Benchmark</h3>
                            <span className="text-[10px] bg-purple-100/80 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-full font-medium">
                                {serverCompetitiveBenchmark.some(item => item.compCount > 0) ? 'Real Competitor Data' : 'Prestige Only'}
                            </span>
                        </div>
                        {/* Metric toggle */}
                        <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                            {BENCHMARK_METRICS.map(m => (
                                <button
                                    key={m.key}
                                    onClick={() => setBenchmarkMetric(m.key)}
                                    title={m.tooltip}
                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${benchmarkMetric === m.key
                                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {!benchmarkDataReady || benchmarkLoading ? (
                        <SectionLoadingState label="Loading competitive benchmark..." />
                    ) : (
                        <>
                            {overallBenchmarkComparison.ownMetrics ? (
                                <RatingSummaryCompare
                                    className="mb-4"
                                    ownMetrics={overallBenchmarkComparison.ownMetrics}
                                    competitorMetrics={overallBenchmarkComparison.competitorMetrics}
                                    ownLabel="Prestige"
                                    competitorLabel="Competitor Slice"
                                    comparisonTitle="Current slice rating comparison"
                                />
                            ) : null}

                            {serverCompetitiveBenchmark.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/70 px-6 py-10 text-center text-sm text-slate-400 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-500">
                                    No benchmark categories are available in this slice yet.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {serverCompetitiveBenchmark.map(item => {
                                        // Derive values based on selected metric
                                        let prestigeVal = 0, compVal = 0, maxScale = 5, unit = '★';
                                        if (benchmarkMetric === 'rating') {
                                            prestigeVal = item.prestigeAvg;
                                            compVal = item.compAvg;
                                            maxScale = 5;
                                            unit = '★';
                                        } else if (benchmarkMetric === 'sentiment') {
                                            prestigeVal = item.prestigePositiveRate;
                                            compVal = item.compPositiveRate;
                                            maxScale = 100;
                                            unit = '%';
                                        } else {
                                            prestigeVal = item.prestigeCount;
                                            compVal = item.compCount;
                                            const maxVol = Math.max(...serverCompetitiveBenchmark.map(i => Math.max(i.prestigeCount, i.compCount)), 1);
                                            maxScale = maxVol;
                                            unit = '';
                                        }
                                        const barWidth = maxScale > 0 ? (prestigeVal / maxScale) * 100 : 0;
                                        const compBarPos = maxScale > 0 ? (compVal / maxScale) * 100 : 0;
                                        const delta = prestigeVal - compVal;
                                        const isWinning = delta > 0;

                                        const formatVal = (v: number) => {
                                            if (benchmarkMetric === 'rating') return `${v.toFixed(1)}${unit}`;
                                            if (benchmarkMetric === 'sentiment') return `${v.toFixed(0)}${unit}`;
                                            return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`;
                                        };

                                        return (
                                            <div key={item.category} className="group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-28 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {item.category}
                                                        <span className="text-[10px] text-slate-400 ml-1">
                                                            ({item.prestigeCount >= 1000 ? `${(item.prestigeCount / 1000).toFixed(1)}k` : item.prestigeCount})
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <div className="h-7 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <motion.div
                                                                key={benchmarkMetric}
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${Math.min(barWidth, 100)}%` }}
                                                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                                                className={`h-full rounded-full transition-all ${isWinning ? 'bg-indigo-500' : 'bg-rose-500'}`}
                                                            />
                                                        </div>
                                                        {/* Competitor marker */}
                                                        {compVal > 0 && (
                                                            <div
                                                                className="absolute top-0 h-7 w-0.5 bg-slate-900 dark:bg-white opacity-50"
                                                                style={{ left: `${Math.min(compBarPos, 100)}%` }}
                                                                title={`Competitor: ${formatVal(compVal)}`}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="w-28 text-right flex items-center justify-end gap-2">
                                                        <span className="font-bold text-sm">{formatVal(prestigeVal)}</span>
                                                        {compVal > 0 && (benchmarkMetric === 'volume' || item.prestigeCount > 0) && (
                                                            <span className={`text-[11px] font-semibold ${isWinning ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                                {benchmarkMetric === 'rating'
                                                                    ? `${isWinning ? '+' : ''}${delta.toFixed(2)}`
                                                                    : benchmarkMetric === 'sentiment'
                                                                        ? `${isWinning ? '+' : ''}${delta.toFixed(0)}pp`
                                                                        : `${isWinning ? '+' : ''}${delta >= 1000 ? `${(delta / 1000).toFixed(1)}k` : delta}`
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Brand breakdown on hover */}
                                                {item.brandBreakdown.length > 0 && (
                                                    <div className="hidden group-hover:flex gap-2 ml-28 pl-3 mt-1.5 flex-wrap">
                                                        {item.brandBreakdown.slice(0, 5).map(b => (
                                                            <span key={b.brand} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                                {b.brand}: {benchmarkMetric === 'rating' ? `${b.avg.toFixed(1)}★` : benchmarkMetric === 'sentiment' ? `${b.positiveRate.toFixed(0)}%` : b.count} ({b.count})
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {/* Legend */}
                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1">
                                                <div className="w-3 h-3 rounded bg-indigo-500" />
                                                <span>Prestige</span>
                                            </div>
                                            {serverCompetitiveBenchmark.some(item => item.compCount > 0) && (
                                                <div className="flex items-center gap-1">
                                                    <div className="w-3 h-0.5 bg-slate-900 dark:bg-white opacity-50" />
                                                    <span>Competitor Avg</span>
                                                </div>
                                            )}
                                        </div>
                                        <span>Hover rows for brand breakdown</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60"
                >
                    <div className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-indigo-400/8 blur-3xl dark:bg-indigo-500/10" />
                    <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/70 to-transparent dark:via-slate-700/60" />

                    <div className="relative">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-2xl">
                                <div className="flex items-center gap-2">
                                    <div className="rounded-2xl bg-indigo-500 p-2 text-white shadow-md shadow-indigo-500/20">
                                        {competitiveCanvasView === 'radar' ? <Radar size={18} /> : <Sparkles size={18} />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Competitive Signal Atlas</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Bring back the richer comparison surfaces: category shape and live review language, not just summary rows.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-start gap-2 lg:items-end">
                                <div className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white/80 p-1 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/75">
                                    {[
                                        { key: 'radar' as const, label: 'Radar', icon: Radar },
                                        { key: 'cloud' as const, label: 'Word Field', icon: Sparkles },
                                    ].map(view => {
                                        const Icon = view.icon;
                                        return (
                                            <button
                                                key={view.key}
                                                onClick={() => setCompetitiveCanvasView(view.key)}
                                                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-all ${competitiveCanvasView === view.key
                                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                                    }`}
                                            >
                                                <Icon size={12} />
                                                {view.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {competitiveCanvasView === 'cloud' ? (
                                    <div className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white/80 p-1 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/75">
                                        {([
                                            { key: 'prestige', label: 'Prestige' },
                                            { key: 'competitor', label: 'Competitor' },
                                        ] as const).map(side => (
                                            <button
                                                key={side.key}
                                                onClick={() => setCompetitiveSignalSide(side.key)}
                                                className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition-all ${competitiveSignalSide === side.key
                                                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                                    }`}
                                            >
                                                {side.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="mt-6">
                            <AnimatePresence mode="wait">
                                {competitiveCanvasView === 'radar' ? (
                                    <motion.div
                                        key="radar"
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -16 }}
                                        className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"
                                    >
                                        <div className="space-y-5">
                                            {overallBenchmarkComparison.ownMetrics ? (
                                                <RatingSummaryCompare
                                                    className="rounded-[28px] border border-white/60 bg-white/75 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/65"
                                                    ownMetrics={overallBenchmarkComparison.ownMetrics}
                                                    competitorMetrics={overallBenchmarkComparison.competitorMetrics}
                                                    ownLabel="Prestige"
                                                    competitorLabel="Competitor Slice"
                                                    comparisonTitle="Radar slice comparison"
                                                />
                                            ) : null}

                                            <div className="grid gap-3 sm:grid-cols-3">
                                                <div className="rounded-[24px] border border-white/60 bg-white/75 px-4 py-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/65">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Shared sentiment axes</div>
                                                    <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{competitiveSignalStats.sharedCategoryCount}</div>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Only categories present for both Prestige and competitors are plotted.</p>
                                                </div>
                                                <div className="rounded-[24px] border border-white/60 bg-white/75 px-4 py-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/65">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Prestige category set</div>
                                                    <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{competitiveSignalStats.prestigeCategoryCount}</div>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Signal families present in the selected Prestige slice.</p>
                                                </div>
                                                <div className="rounded-[24px] border border-white/60 bg-white/75 px-4 py-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/65">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Competitor category set</div>
                                                    <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{competitiveSignalStats.competitorCategoryCount}</div>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Signal families captured across competitor reviews in this slice.</p>
                                                </div>
                                            </div>
                                        </div>

                                        {competitorVisualsLoading ? (
                                            <SectionLoadingState label="Loading radar geometry..." />
                                        ) : (
                                            <CompetitorRadarChart
                                                reviews={reviews}
                                                competitorReviews={competitorReviews}
                                                competitorName="Competitor Slice"
                                            />
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="cloud"
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -16 }}
                                        className="space-y-5"
                                    >
                                        <div className="space-y-3">
                                            {competitiveSignalSide === 'prestige' ? (
                                                <>
                                                    <div>
                                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">Prestige signal field</div>
                                                        <h4 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">What your own reviews are saying most often</h4>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400">One clean rotating sphere for the active slice. Click a signal cluster to drill down.</p>
                                                    </div>
                                                    {reviews.length > 0 ? (
                                                        <WordSphere3D
                                                            reviews={reviews}
                                                            onCategoryClick={handleClick}
                                                            title="Prestige review sphere"
                                                            subtitle="Rotate the issue universe and click a signal cluster to drill down"
                                                        />
                                                    ) : (
                                                        <SectionLoadingState label="Loading Prestige word sphere..." />
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <div>
                                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-500">Competitor signal field</div>
                                                        <h4 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">How competitor review language clusters in the same slice</h4>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400">A focused competitor-only sphere for the current slice, without splitting the layout into two competing canvases.</p>
                                                    </div>
                                                    {competitorVisualsLoading ? (
                                                        <SectionLoadingState label="Loading competitor word sphere..." />
                                                    ) : competitorReviews.length > 0 ? (
                                                        <WordSphere3D
                                                            reviews={competitorReviews}
                                                            title="Competitor review sphere"
                                                            subtitle="Spin the competitor language cloud in the exact same slice"
                                                        />
                                                    ) : (
                                                        <div className="flex h-[320px] items-center justify-center rounded-[28px] border border-dashed border-slate-200/80 bg-white/70 px-6 text-center text-sm text-slate-400 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-500">
                                                            No competitor review language is available in this slice yet.
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>

                {/* Escalating / Improving Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Escalating Issues */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="card p-5 border-l-4 border-red-500"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Flame className="text-red-500" size={20} />
                            <h3 className="font-bold text-slate-900 dark:text-white">🚨 Escalating Issues</h3>
                            <span className="ml-auto text-[10px] bg-red-100 dark:bg-red-500/15 text-red-600 px-2 py-1 rounded-full font-semibold">
                                NEEDS ATTENTION
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-4">Issues getting worse in last 6M vs prior period</p>

                        {!belowFoldDataReady || serverTrendsLoading ? (
                            <SectionLoadingState label="Loading trend analysis..." />
                        ) : trendAnalysis.escalating.length === 0 ? (
                            <p className="text-sm text-emerald-500 flex items-center gap-2">
                                <Shield size={16} /> No escalating issues detected
                            </p>
                        ) : (
                            <ul className="space-y-2.5">
                                {trendAnalysis.escalating.map((item) => (
                                    <li
                                        key={item.characteristic}
                                        className="p-3 bg-red-50/80 dark:bg-red-500/8 rounded-xl cursor-pointer hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors border border-red-100/60 dark:border-red-800/30"
                                        onClick={() => handleClick(item.characteristic)}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 capitalize">
                                                {item.characteristic}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="flex items-center gap-1 text-red-600 text-sm font-bold">
                                                    <ArrowUpRight size={14} />
                                                    +{(item.change * 100).toFixed(0)}%
                                                </span>
                                                <motion.span
                                                    whileHover={{ scale: 1.08 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-red-600 text-white shadow-sm shadow-red-500/25 hover:bg-red-700 transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); handleClick(item.characteristic); }}
                                                >
                                                    Investigate <ExternalLink size={10} />
                                                </motion.span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                            <span>Before: {(item.olderNegativeRate * 100).toFixed(0)}% neg</span>
                                            <span>→</span>
                                            <span className="text-red-500 font-medium">Now: {(item.recentNegativeRate * 100).toFixed(0)}% neg</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </motion.div>

                    {/* Improving Areas */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="card p-5 border-l-4 border-emerald-500"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="text-emerald-500" size={20} />
                            <h3 className="font-bold text-slate-900 dark:text-white">📈 Improving Areas</h3>
                            <span className="ml-auto text-[10px] bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 px-2 py-1 rounded-full font-semibold">
                                WINNING
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-4">Issues getting better — customer concerns addressed</p>

                        {!belowFoldDataReady || serverTrendsLoading ? (
                            <SectionLoadingState label="Loading trend analysis..." />
                        ) : trendAnalysis.improving.length === 0 ? (
                            <p className="text-sm text-slate-400">No significant improvements detected</p>
                        ) : (
                            <ul className="space-y-2.5">
                                {trendAnalysis.improving.map((item) => (
                                    <li
                                        key={item.characteristic}
                                        className="p-3 bg-emerald-50/80 dark:bg-emerald-500/8 rounded-xl cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-colors border border-emerald-100/60 dark:border-emerald-800/30"
                                        onClick={() => handleClick(item.characteristic)}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 capitalize">
                                                {item.characteristic}
                                            </span>
                                            <span className="flex items-center gap-1 text-emerald-600 text-sm font-bold">
                                                <ArrowDownRight size={14} />
                                                {(item.change * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                            <span>Before: {(item.olderNegativeRate * 100).toFixed(0)}% neg</span>
                                            <span>→</span>
                                            <span className="text-emerald-500 font-medium">Now: {(item.recentNegativeRate * 100).toFixed(0)}% neg</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </motion.div>
                </div>

                {/* Product Line Health Dashboard — Split View */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-5"
                >
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Activity className="text-amber-500" size={20} />
                            <h3 className="font-bold text-slate-900 dark:text-white">Product Line Health</h3>
                        </div>

                        {/* Toggle: Declining / Improving */}
                        <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                            <button
                                onClick={() => setProductHealthTab('declining')}
                                className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${productHealthTab === 'declining'
                                    ? 'bg-red-500 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <TrendingDown size={12} /> Needs Attention ({decliningProducts.length})
                            </button>
                            <button
                                onClick={() => setProductHealthTab('improving')}
                                className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${productHealthTab === 'improving'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <TrendingUp size={12} /> Strong Performers ({improvingProducts.length})
                            </button>
                        </div>
                    </div>

                    {!belowFoldDataReady || serverProductHealthLoading ? (
                        <SectionLoadingState label="Loading product health..." />
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={productHealthTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-2"
                            >
                                <div className="space-y-2">
                                    {(() => {
                                        const sourceList = productHealthTab === 'declining' ? decliningProducts : improvingProducts;
                                        const totalPages = Math.ceil(sourceList.length / HEALTH_ITEMS_PER_PAGE);
                                        const paginatedList = sourceList.slice((healthPage - 1) * HEALTH_ITEMS_PER_PAGE, healthPage * HEALTH_ITEMS_PER_PAGE);
                                        
                                        return (
                                            <>
                                                {paginatedList.map((product, idx) => (
                                                    <motion.div
                                                        key={product.product}
                                                        initial={{ opacity: 0, x: productHealthTab === 'declining' ? -10 : 10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: idx * 0.04 }}
                                                        className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all mb-2 last:mb-0 shadow-sm"
                                                        onClick={() => setExpandedProduct(expandedProduct === product.product ? null : product.product)}
                                                    >
                                                        {/* Health bar */}
                                                        <div
                                                            className={`absolute bottom-0 left-0 h-0.5 ${getHealthBg(product.healthScore)} transition-all duration-500`}
                                                            style={{ width: `${product.healthScore}%` }}
                                                        />

                                                        <div className="p-3 flex items-center gap-3">
                                                            {/* Score */}
                                                            <div
                                                                className={`flex flex-col items-center justify-center min-w-10 ${getHealthColor(product.healthScore)}`}
                                                                title="Product Health Score (0-100)"
                                                            >
                                                                <span className="text-xl font-bold leading-tight">{product.healthScore}</span>
                                                                <span className="text-[7px] font-bold uppercase tracking-tighter opacity-70">HEALTH</span>
                                                            </div>

                                                            {/* Product name + meta */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                                    {product.product}
                                                                </p>
                                                                <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
                                                                    <span>{product.totalMentions.toLocaleString()} reviews</span>
                                                                    <span>{(product.positiveRate * 100).toFixed(0)}% positive</span>
                                                                    <span>{(product.negativeRate * 100).toFixed(0)}% negative</span>
                                                                </div>
                                                            </div>

                                                            {/* Sparkline */}
                                                            <MiniSparkline
                                                                data={product.monthlyRatings.map(m => m.avg)}
                                                                color={product.trend === 'improving' ? '#22c55e' : product.trend === 'declining' ? '#ef4444' : '#64748b'}
                                                            />

                                                            {/* Trend badge */}
                                                            <div className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${product.trend === 'improving'
                                                                ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600'
                                                                : product.trend === 'declining'
                                                                    ? 'bg-red-100 dark:bg-red-900/20 text-red-600'
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                                                }`}>
                                                                {product.trend === 'improving' && <TrendingUp size={10} />}
                                                                {product.trend === 'declining' && <TrendingDown size={10} />}
                                                                {product.trend}
                                                            </div>

                                                            {/* Expand arrow */}
                                                            <motion.div animate={{ rotate: expandedProduct === product.product ? 180 : 0 }}>
                                                                <ChevronDown size={14} className="text-slate-400" />
                                                            </motion.div>
                                                        </div>

                                                        {/* Expanded trend chart */}
                                                        <AnimatePresence>
                                                            {expandedProduct === product.product && product.monthlyRatings.length > 1 && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    className="overflow-hidden border-t border-slate-100 dark:border-slate-700/50"
                                                                >
                                                                    <div className="p-3 pt-2">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <p className="text-[10px] text-slate-400 font-medium">Monthly User Rating Trend</p>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setFullTrendProduct(fullTrendProduct === product.product ? null : product.product);
                                                                                }}
                                                                                className={`text-[9px] font-semibold px-2 py-0.5 rounded-md transition-all ${fullTrendProduct === product.product
                                                                                    ? 'bg-indigo-500 text-white shadow-sm'
                                                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-indigo-600'
                                                                                    }`}
                                                                            >
                                                                                {fullTrendProduct === product.product ? 'Period View' : 'Full 12M'}
                                                                            </button>
                                                                        </div>
                                                                        <div className="flex items-end gap-1 h-20">
                                                                            {(fullTrendProduct === product.product ? product.monthlyRatings : product.monthlyRatings.slice(-selectedPeriod)).map((m, i) => {
                                                                                const barH = ((m.avg - 1) / 4) * 100; // 1-5 scale -> 0-100%
                                                                                return (
                                                                                    <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                                                                                        <span className="text-[8px] text-slate-400 font-medium">{m.avg.toFixed(1)}</span>
                                                                                        <motion.div
                                                                                            initial={{ height: 0 }}
                                                                                            animate={{ height: `${barH}%` }}
                                                                                            transition={{ delay: i * 0.05, duration: 0.4 }}
                                                                                            className={`w-full rounded-t ${m.avg >= 4 ? 'bg-emerald-400' : m.avg >= 3 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                                                                            style={{ minHeight: '2px' }}
                                                                                        />
                                                                                        <span className="text-[7px] text-slate-400">{m.month.split('-')[1]}/{m.month.split('-')[0].slice(2)}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                ))}

                                                {totalPages > 1 && (
                                                    <div className="flex items-center justify-between mt-4 px-1">
                                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                                            Page {healthPage} of {totalPages}
                                                        </span>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setHealthPage(p => Math.max(1, p - 1))}
                                                                disabled={healthPage === 1}
                                                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 disabled:opacity-30 hover:bg-slate-200 transition-colors"
                                                            >
                                                                <ChevronLeft size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => setHealthPage(p => Math.min(totalPages, p + 1))}
                                                                disabled={healthPage === totalPages}
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
                                </div>

                                {(productHealthTab === 'declining' ? decliningProducts : improvingProducts).length === 0 && (
                                    <div className="text-center py-8 text-sm text-slate-400">
                                        No {productHealthTab === 'declining' ? 'declining' : 'strong performing'} products detected
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </motion.div>

                {/* AI Recommendations */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-5"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="text-amber-500" size={20} />
                        <h3 className="font-bold text-slate-900 dark:text-white">AI-Powered Recommendations</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/40 dark:border-slate-700/40">
                            <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2 text-sm">🔧 Immediate Action Required</h4>
                            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                {trendAnalysis.escalating.slice(0, 2).map(item => (
                                    <li key={item.characteristic} className="flex items-start gap-2">
                                        <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={13} />
                                        <span>Investigate <strong className="capitalize">{item.characteristic}</strong> complaints — up {(item.change * 100).toFixed(0)}% recently</span>
                                    </li>
                                ))}
                                {trendAnalysis.escalating.length === 0 && (
                                    <li className="text-emerald-500">No urgent issues — maintain current quality standards</li>
                                )}
                            </ul>
                        </div>

                        <div className="p-4 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/40 dark:border-slate-700/40">
                            <h4 className="font-semibold text-emerald-600 dark:text-emerald-400 mb-2 text-sm">🚀 Growth Opportunities</h4>
                            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                {improvingProducts.slice(0, 2).map(product => (
                                    <li key={product.product} className="flex items-start gap-2">
                                        <TrendingUp className="text-emerald-500 mt-0.5 shrink-0" size={13} />
                                        <span>Leverage <strong>{product.product.slice(0, 50)}...</strong> — {product.healthScore} health score</span>
                                    </li>
                                ))}
                                {trendAnalysis.improving.slice(0, 2).map(item => (
                                    <li key={item.characteristic} className="flex items-start gap-2">
                                        <Target className="text-indigo-500 mt-0.5 shrink-0" size={13} />
                                        <span>Promote <strong className="capitalize">{item.characteristic}</strong> improvements — down {Math.abs(item.change * 100).toFixed(0)}% complaints</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* At-risk products */}
                        {decliningProducts.length > 0 && (
                            <div className="p-4 bg-red-50/60 dark:bg-red-900/10 rounded-xl border border-red-200/40 dark:border-red-700/30 md:col-span-2">
                                <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2 text-sm">⚠️ Products Requiring Attention ({decliningProducts.length})</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {decliningProducts.slice(0, 6).map(product => (
                                        <div
                                            key={product.product}
                                            className="flex items-center gap-2 p-2 bg-white/80 dark:bg-slate-800/80 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            onClick={() => handleClick(product.product)}
                                        >
                                            <span className={`text-lg font-bold ${getHealthColor(product.healthScore)}`}>{product.healthScore}</span>
                                            <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{product.product.slice(0, 40)}...</span>
                                            <span className="text-[10px] text-red-500 ml-auto shrink-0">{(product.negativeRate * 100).toFixed(0)}% neg</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Issue Slider Panel */}
            <IssueSlider
                isOpen={!!activeIssue}
                onClose={() => setActiveIssue(null)}
                subcategory={activeIssue?.subcategory ?? null}
                issueLabel={activeIssue?.label ?? ''}
            />

            {/* Stakeholder Slider Panel */}
            <StakeholderSlider
                isOpen={!!activeStakeholder}
                onClose={() => setActiveStakeholder(null)}
                stakeholderName={activeStakeholder}
                filters={{
                    category: currentCategory,
                    pareto_status: globalParetoStatus,
                    rating_bifurcation: globalRatingBifurcation,
                    platform: globalPlatform,
                    date_from: globalDateFrom,
                    date_to: globalDateTo,
                    is_competitor: globalBrandScope === 'prestige' ? 'false' : globalBrandScope === 'competition' ? 'true' : 'all',
                    sentiment_category: globalSentimentCategory,
                    price_mode: globalPriceMode,
                    price_min: globalPriceRange?.min,
                    price_max: globalPriceRange?.max,
                }}
            />


        </>
    );
};

export default ExecutiveInsights;

