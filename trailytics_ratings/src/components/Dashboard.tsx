/**
 * Rating Intelligence Dashboard V2
 * Main dashboard with global filter system, glassmorphism design, and premium animations
 * ALL DATA FROM API — no static JSON imports
 */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Sparkles, Loader2 } from 'lucide-react';
import { AvatarMenu } from './AvatarMenu';
import { NotificationBell } from './NotificationBell';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import ExecutiveInsights from './ExecutiveInsights';
import CharacteristicDetailPanel from './CharacteristicDetailPanel';
import CompetitorBenchmarkPanel from './CompetitorBenchmarkPanel';
import GlobalFilterBar from './GlobalFilterBar';

// Hooks — ALL data from API
import { useGlobalFilters } from '../hooks/useGlobalFilters';
import { useReviews, useSummary, usePlatformOptions, useSentimentCategories, useTrends, useProductHealth, useProductCategories, type ReviewRow } from '../hooks/useRatingsAPI';

// Types
import type { Review, CompetitorMention } from '../types';

const VerbatimMentionsCard = lazy(() => import('./VerbatimMentionsCard'));
const CompetitorRadarChart = lazy(() => import('./CompetitorRadarChart'));
const CategoryHealthView = lazy(() => import('./CategoryHealthView'));
const CompetitorIntelligence = lazy(() => import('./CompetitorIntelligence'));
const ActionIntelligenceHub = lazy(() => import('./ActionIntelligenceHub'));
const ReviewSearchPanel = lazy(() => import('./ReviewSearchPanel').then(m => ({ default: m.ReviewSearchPanel })));
const MasterLayout = lazy(() => import('./master/MasterLayout'));
// RawDataLake moved into MasterLayout as a sub-tab — no longer a top-level tab.
const RulesPage = lazy(() => import('../pages/RulesPage').then(m => ({ default: m.RulesPage })));

// ============================================================================
// TABS CONFIG (config-driven, not hardcoded)
// ============================================================================

// Top-level nav: 6 primary tabs. Each carries its own internal sub-tab
// segmented control instead of demanding more width here. Data Lake folded
// into Masters; alert / mailer / job triggers folded into Rules.
const TABS = [
    { key: 'overview' as const,   label: 'Overview',     icon: '📈', emoji: true },
    { key: 'categories' as const, label: 'Categories',   icon: '📊', emoji: true },
    { key: 'competitor' as const, label: 'Competition',  icon: '🎯', emoji: true },
    { key: 'reviews' as const,    label: 'Explorer',     icon: '🔍', emoji: true },
    { key: 'master' as const,     label: 'Masters',      icon: '⚙️', emoji: true },
    { key: 'rules' as const,      label: 'Rules',        icon: '🛎️', emoji: true },
] as const;

type TabKey = typeof TABS[number]['key'];

// ============================================================================
// HELPER: Convert API ReviewRow to app Review type
// ============================================================================
function toReview(row: ReviewRow): Review {
    return {
        id: row.id,
        product: row.product_name,
        rating: Number(row.rating),
        mlInferredRating: row.ml_inferred_rating ? Number(row.ml_inferred_rating) : undefined,
        title: row.review_title || '',
        text: row.review_text || '',
        date: row.review_date || '',
        reviewer: '',
        verified: row.is_verified_purchase,
        sentiment: (row.sentiment || 'Neutral') as Review['sentiment'],
        polarity: Number(row.sentiment_score || 0),
        characteristics: row.sentiment_category ? [row.sentiment_category] : [],
        sentimentCategory: (row.sentiment_category || 'General') as Review['sentimentCategory'],
        specificIssue: row.specific_issue || row.sentiment_subcategory || '',
        qualityScore: Number(row.quality_score || 0),
        sentimentScore: Number(row.sentiment_score || 0),
        category: row.category || 'Others',
        subcategory: row.sentiment_subcategory || '',
        asin: row.web_pid || '',
        actualProductRating: row.pdp_rating ? Number(row.pdp_rating) : undefined,
        totalRatingCount: row.pdp_rating_count || undefined,
        paretoStatus: row.pareto_status || undefined,
        material: row.material || undefined,
        masterCategory: row.category || undefined,
        brand: row.brand || undefined,
        platform: row.platform || undefined,
        productName: row.product_name || undefined,
        wattage: row.wattage || undefined,
        is_competitor: row.is_competitor,
        // Price fields from product_snapshots
        priceRp: row.price_rp ? Number(row.price_rp) : undefined,
        priceSp: row.price_sp ? Number(row.price_sp) : undefined,
        // Extended PDP metrics
        pdpPlatformRating: row.pdp_platform_rating ? Number(row.pdp_platform_rating) : undefined,
        pdpTotalRatingCount: row.pdp_total_rating_count ? Number(row.pdp_total_rating_count) : undefined,
    };
}

// ============================================================================
// LOADING SKELETON
// ============================================================================
// UserBadge consolidated into AvatarMenu — theme toggle, settings shortcut,
// and sign-out all live in one dropdown so the header has room for 6 tabs.

const LoadingSkeleton: React.FC = () => (
    <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
                <Loader2 size={32} className="text-indigo-500" />
            </motion.div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading data from database...</p>
        </div>
    </div>
);

// ============================================================================
// DASHBOARD COMPONENT
// ============================================================================

const Dashboard: React.FC = () => {
    // Theme state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark' ||
                (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
    });

    // Panel states
    const [selectedCharacteristic, setSelectedCharacteristic] = useState<string | null>(null);
    const [isCompetitorPanelOpen, setIsCompetitorPanelOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabKey>(() => {
        // Allow deep-linking from the /settings inventory cards and from
        // alert emails. /?tab=master pins the tab; /?web_pid=B0XYZ also
        // jumps to master and pre-searches the SKU.
        const sp = new URLSearchParams(window.location.search);
        const requested = sp.get('tab');
        if (sp.get('web_pid') && !requested) return 'master';
        return TABS.some(t => t.key === requested) ? (requested as TabKey) : 'overview';
    });
    const [initialSkuSearch] = useState<string>(
        () => new URLSearchParams(window.location.search).get('web_pid') || ''
    );
    const [overviewHeavyDataEnabled, setOverviewHeavyDataEnabled] = useState(false);
    const isOverviewTab = activeTab === 'overview';
    const enableOverviewHeavyData = useCallback(() => {
        setOverviewHeavyDataEnabled(true);
    }, []);
    const needsPrestigeReviews =
        activeTab === 'categories' ||
        activeTab === 'competitor' ||
        activeTab === 'reviews' ||
        (activeTab === 'overview' && overviewHeavyDataEnabled);
    const needsCompetitorReviews =
        activeTab === 'competitor' ||
        activeTab === 'reviews' ||
        (activeTab === 'overview' && overviewHeavyDataEnabled);

    // ========================================================================
    // API-BACKED DATA HOOKS (replace static JSON imports)
    // ========================================================================

    const { platforms: serverPlatforms } = usePlatformOptions();
    const { categories: serverSentimentCategories } = useSentimentCategories();

    // Filter state from useGlobalFilters (UI state management only)
    const filterResult = useGlobalFilters({
        allPrestigeReviews: [],  // No longer pass raw data — API handles filtering
        allCompetitorReviews: [],
        serverSentimentCategories,
        serverPlatforms,
    });

    const { filters } = filterResult;
    const { classification } = filters.category;
    const currentCategory = filters.productCategory;
    const currentSentimentCategory = filters.category.selectedCategory;

    // Build API filter params from UI filter state
    const apiFilters = useMemo(() => {
        const params: Record<string, string | number | undefined> = {};

        if (filters.platform && filters.platform !== 'all') {
            params.platform = filters.platform;
        }
        if (filters.brandScope === 'prestige') {
            params.is_competitor = 'false';
        } else if (filters.brandScope === 'competition') {
            params.is_competitor = 'true';
        } else if (filters.brandScope === 'all') {
            params.is_competitor = 'all';
        }

        if (currentSentimentCategory) params.sentiment_category = currentSentimentCategory;
        // Product category (Pressure Cooker, Gas Stove, etc.) — from category card click
        if (currentCategory) params.category = currentCategory;
        if (classification !== 'all') {
            // Map classification type to data value
            const statusMap: Record<string, string> = {
                'pareto': 'Pareto',
                'non-pareto': 'Non-Pareto',
                'non-pareto-unclassified': 'Non-Pareto (Unclassified)',
                'npd': 'NPD',
            };
            params.pareto_status = statusMap[classification];
        }
        if (filters.ratingBifurcation) {
            params.rating_bifurcation = filters.ratingBifurcation;
        }
        if (filters.dateRange?.startDate) {
            params.date_from = filters.dateRange.startDate.toISOString().split('T')[0];
        }
        if (filters.dateRange?.endDate) {
            params.date_to = filters.dateRange.endDate.toISOString().split('T')[0];
        }
        // web_pid is uppercase-canonical and the server filter is case-sensitive,
        // so normalize user-typed SKU input or it silently returns zero rows.
        if (filters.sku) params.web_pid = String(filters.sku).trim().toUpperCase();
        if (filters.trendPeriodMonths) params.period_months = filters.trendPeriodMonths;
        if (filters.priceRange) {
            params.price_mode = filters.priceMode;
            params.price_min = filters.priceRange.min;
            params.price_max = filters.priceRange.max;
        }

        return params;
    }, [currentCategory, currentSentimentCategory, classification, filters.brandScope, filters.dateRange, filters.sku, filters.productCategory, filters.ratingBifurcation, filters.platform, filters.trendPeriodMonths, filters.priceMode, filters.priceRange]);

    // Categories list for pills — always fetch for all categories matching other filters (platform, etc.)
    const categoryListFilters = useMemo(() => {
        const f = { ...apiFilters };
        delete f.category;
        return f;
    }, [apiFilters]);
    const { data: allProductCategories } = useProductCategories(categoryListFilters);

    // Fetch own-brand reviews from DB
    const { data: ownReviewRows, total: ownReviewTotal, loading: ownLoading } = useReviews({
        ...apiFilters,
        is_competitor: 'false',
    }, { enabled: needsPrestigeReviews });

    // Fetch competitor reviews from DB
    // ARCHITECTURE: Competitor reviews don't have pareto_status/rating_bifurcation/sku.
    // When these filters are active, we "roll up" from SKU→Category: find the categories
    // in the filtered Prestige set and fetch competitor reviews from those same categories.
    // This ensures the benchmark always shows the competitive landscape for the filtered scope.
    const competitorPlatform = filters.competitorPlatform || 'all';

    // Derive which categories the filtered Prestige reviews belong to
    const prestigeCategories = useMemo(() => {
        const cats = new Set<string>();
        ownReviewRows.forEach(r => {
            if (r.category) cats.add(r.category);
        });
        return Array.from(cats).sort();
    }, [ownReviewRows]);

    // Determine if we're using a filter that only applies to Prestige data
    const hasPrestigeOnlyFilter = Boolean(
        apiFilters.pareto_status ||
        apiFilters.rating_bifurcation ||
        apiFilters.web_pid
    );

    const compFilters: Record<string, string | number | undefined> = useMemo(() => {
        const f: Record<string, string | number | undefined> = {
            is_competitor: 'true',
            platform: competitorPlatform !== 'all' ? competitorPlatform : undefined,
        };

        // Always pass through category if explicitly set (e.g. user clicked a category card)
        if (apiFilters.category) {
            f.category = apiFilters.category;
        } else if (hasPrestigeOnlyFilter && prestigeCategories.length > 0) {
            // Roll-up: use derived categories from the filtered Prestige set
            f.categories_in = prestigeCategories.join(',');
        }

        // Material can be shared between Prestige and competitors
        if (apiFilters.material) f.material = apiFilters.material;

        // Sentiment category filter applies to both prestige and competitor reviews
        if (apiFilters.sentiment_category) f.sentiment_category = apiFilters.sentiment_category;

        // Date filters — pass through when explicitly set (reviews tab needs them)
        if (apiFilters.date_from) f.date_from = apiFilters.date_from;
        if (apiFilters.date_to) f.date_to = apiFilters.date_to;

        // NOTE: We intentionally do NOT pass:
        //   - pareto_status (competitor reviews don't have this)
        //   - rating_bifurcation (Prestige-specific classification)
        //   - web_pid / sku (Prestige-specific ASIN)

        return f;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [competitorPlatform, apiFilters.category, apiFilters.material, apiFilters.sentiment_category, apiFilters.date_from, apiFilters.date_to, hasPrestigeOnlyFilter, prestigeCategories.join(',')]);

    const { data: compReviewRows, loading: compLoading } = useReviews(
        compFilters,
        { enabled: needsCompetitorReviews }
    );
    const competitorRows = needsCompetitorReviews ? compReviewRows : [];

    // Fetch summary KPIs from DB
    const { data: summary, loading: summaryLoading } = useSummary(apiFilters);

    // Server-side aggregated data — now filtered by global filters
    const trendPeriodMonths = filters.trendPeriodMonths || 6;
    const { data: serverTrends, loading: serverTrendsLoading } = useTrends(trendPeriodMonths, apiFilters, {
        enabled: isOverviewTab && overviewHeavyDataEnabled,
    });
    const { data: serverProductHealth, loading: serverProductHealthLoading } = useProductHealth(apiFilters, {
        enabled: isOverviewTab && overviewHeavyDataEnabled,
    });

    // Convert API rows to Review type for component compatibility
    const filteredPrestigeReviews = useMemo(() => (needsPrestigeReviews ? ownReviewRows.map(toReview) : []), [needsPrestigeReviews, ownReviewRows]);
    const filteredCompetitorReviews = useMemo(() => (needsCompetitorReviews ? competitorRows.map(toReview) : []), [competitorRows, needsCompetitorReviews]);

    // The previous `reviewExplorerReviews` merged Prestige + competitor reviews
    // when SCOPE=All and passed the merged list to ActionIntelligenceHub, which
    // then showed Pigeon/Butterfly products as Prestige's CRITICAL issues. The
    // hub now receives Prestige-only directly (competitor data is a separate
    // prop for benchmarks). The merge isn't needed anywhere else.

    const isLoading =
        summaryLoading ||
        (!isOverviewTab && needsPrestigeReviews && ownLoading) ||
        (needsCompetitorReviews && compLoading);

    // Apply theme
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    // Calculate overview metrics from API summary
    const metrics = useMemo(() => {
        if (!summary) {
            return {
                totalReviews: 0,
                totalRatings: 0,
                avgActualRating: 0,
                avgUserRating: 0,
                avgMlRating: 0,
                positive: 0,
                negative: 0,
                positiveRate: 0,
                negativeRate: 0,
                uniqueProducts: 0,
            };
        }

        const total = parseInt(summary.metrics.total_reviews) || 0;
        const positive = parseInt(summary.metrics.positive_count || '0');
        const negative = parseInt(summary.metrics.negative_count || '0');
        const avgActualRating = parseFloat(summary.metrics.pdp_rating || summary.metrics.avg_platform_rating || '0');
        const avgUserRating = parseFloat(summary.metrics.user_rating || summary.metrics.avg_review_rating || '0');
        const avgMlRating = parseFloat(summary.metrics.ml_rating || summary.metrics.avg_ml_rating || '0');

        return {
            totalReviews: total,
            totalRatings: parseInt(summary.metrics.rating_count || summary.metrics.total_ratings || '0'),
            avgActualRating,
            avgUserRating,
            avgMlRating,
            positive,
            negative,
            positiveRate: total > 0 ? Math.round((positive / total) * 100) : 0,
            negativeRate: total > 0 ? Math.round((negative / total) * 100) : 0,
            uniqueProducts: parseInt(summary.metrics.unique_products || '0'),
        };
    }, [summary]);

    const headlineMetrics = useMemo(() => ({
        pdpRating: metrics.avgActualRating,
        userRating: metrics.avgUserRating,
        mlRating: metrics.avgMlRating,
        reviewCount: parseInt(summary?.metrics.review_count || String(metrics.totalReviews), 10) || metrics.totalReviews || ownReviewTotal,
        ratingCount: metrics.totalRatings,
    }), [metrics, ownReviewTotal, summary]);

    // Handle competitor mention click
    const handleMentionClick = (mention: CompetitorMention) => {
        setSelectedProduct(mention.brand);
        setIsCompetitorPanelOpen(true);
    };



    return (
        <div className={`h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-500`}>
            {/* ===== HEADER ===== */}
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="w-full px-4 md:px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <motion.div
                                whileHover={{ rotate: 5, scale: 1.05 }}
                                className="p-2.5 bg-indigo-500 rounded-xl shadow-md shadow-indigo-500/20"
                            >
                                <BarChart3 className="text-white" size={22} />
                            </motion.div>
                            <div>
                                <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                                    Rating Intelligence
                                </h1>
                                <p className="text-[11px] text-slate-500 dark:text-slate-500 flex items-center gap-1">
                                    <Sparkles size={10} className="text-indigo-400" />
                                    Prestige Product Analytics · V2 · DB-Backed
                                </p>
                            </div>
                        </div>

                        {/* Tab Navigation — Premium Animated */}
                        <nav className="flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-1 border border-slate-200/40 dark:border-slate-700/40">
                            {TABS.map(tab => (
                                <motion.button
                                    key={tab.key}
                                    onClick={() => {
                                        setActiveTab(tab.key);
                                        // Keep ?tab=... in sync so reload + bookmarks land on the same view.
                                        const params = new URLSearchParams(window.location.search);
                                        params.set('tab', tab.key);
                                        // Drop sub-tab when switching primary so we don't carry e.g. ?sub=alert-rules into Overview
                                        if (tab.key !== 'rules') params.delete('sub');
                                        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    title={tab.label}
                                    aria-label={tab.label}
                                    className={`relative px-3 xl:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === tab.key
                                        ? 'text-white'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    {activeTab === tab.key && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute inset-0 bg-indigo-600 rounded-lg shadow-md shadow-indigo-500/20"
                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-1.5">
                                        <span className="text-sm">{tab.icon}</span>
                                        {/* Labels show ≥1280px (xl). Below that the tab is icon-only
                                            to keep all 6 tabs visible on a 13" laptop; tooltip
                                            preserves discoverability. */}
                                        <span className="hidden xl:inline">{tab.label}</span>
                                    </span>
                                </motion.button>
                            ))}
                        </nav>

                        {/* Right cluster — notifications bell + avatar dropdown */}
                        <div className="flex items-center gap-2">
                            <NotificationBell enabled={true} />
                            <AvatarMenu
                                isDarkMode={isDarkMode}
                                onToggleTheme={() => setIsDarkMode(!isDarkMode)}
                                onOpenRules={() => {
                                    setActiveTab('rules');
                                    const params = new URLSearchParams(window.location.search);
                                    params.set('tab', 'rules');
                                    params.set('sub', 'mailer');
                                    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
                                }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* ===== GLOBAL FILTER BAR ===== */}
            <GlobalFilterBar filterResult={filterResult} headlineMetrics={headlineMetrics} />

            {/* ===== MAIN CONTENT ===== */}
            <main className="flex-1 w-full px-2 md:px-4 py-3 overflow-y-auto flex flex-col">

                {/* Loading state */}
                {isLoading && <LoadingSkeleton />}

                {/* ===== TAB CONTENT ===== */}
                {!isLoading && (
                    <AnimatePresence mode="wait">
                        {activeTab === 'overview' && (
                            <motion.div
                                key="overview"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6"
                            >
                                <ExecutiveInsights
                                    reviews={filteredPrestigeReviews}
                                    competitorReviews={filteredCompetitorReviews}
                                    onCharacteristicClick={setSelectedCharacteristic}
                                    onRequestHeavyData={enableOverviewHeavyData}
                                    serverTrends={serverTrends}
                                    serverTrendsLoading={serverTrendsLoading}
                                    serverProductHealth={serverProductHealth}
                                    serverProductHealthLoading={serverProductHealthLoading}
                                    onCategorySelect={(cat) => {
                                        console.log('Dashboard: Global category select triggered:', cat);
                                        filterResult.setProductCategory(cat);
                                    }}
                                    externalSelectedCategory={filters.productCategory}
                                    globalParetoStatus={apiFilters.pareto_status as string | undefined}
                                    globalRatingBifurcation={filters.ratingBifurcation || undefined}
                                    onClassificationSelect={(cls) => filterResult.setClassification(cls)}
                                    externalClassification={
                                        classification === 'all' ? 'all'
                                            : (classification as 'pareto' | 'non-pareto' | 'npd' | 'all')
                                    }
                                    globalPlatform={filters.platform}
                                    globalTrendPeriodMonths={trendPeriodMonths}
                                    globalDateFrom={apiFilters.date_from as string | undefined}
                                    globalDateTo={apiFilters.date_to as string | undefined}
                                    globalPriceMode={filters.priceMode}
                                    globalPriceRange={filters.priceRange}
                                    globalBrandScope={filters.brandScope}
                                    globalSentimentCategory={currentSentimentCategory}
                                />
                            </motion.div>
                        )}

                        {activeTab === 'categories' && (
                            <motion.div
                                key="categories"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6"
                            >
                                <Suspense fallback={<LoadingSkeleton />}>
                                    <CategoryHealthView
                                        reviews={filteredPrestigeReviews}
                                        onCategoryClick={(category) => {
                                            setSelectedCharacteristic(category);
                                        }}
                                    />
                                </Suspense>
                            </motion.div>
                        )}

                        {activeTab === 'competitor' && (
                            <motion.div
                                key="competitor"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6"
                            >
                                <Suspense fallback={<LoadingSkeleton />}>
                                    <CompetitorIntelligence
                                        prestigeCatalog={[]}
                                        competitorProducts={[]}
                                        competitorReviews={filteredCompetitorReviews}
                                        prestigeReviews={filteredPrestigeReviews}
                                        skuMappings={[]}
                                        onCategorySelect={(cat: string | null) => {
                                            console.log('Dashboard: Competitor tab category select:', cat);
                                            filterResult.setProductCategory(cat);
                                        }}
                                        externalSelectedCategory={filters.productCategory}
                                        allCategories={allProductCategories}
                                    />
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <CompetitorRadarChart reviews={filteredPrestigeReviews} competitorReviews={filteredCompetitorReviews} />
                                        <VerbatimMentionsCard
                                            reviews={filteredPrestigeReviews}
                                            onMentionClick={handleMentionClick}
                                        />
                                    </div>
                                </Suspense>
                            </motion.div>
                        )}

                        {activeTab === 'reviews' && (
                            <motion.div
                                key="reviews"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6"
                            >
                                <Suspense fallback={<LoadingSkeleton />}>
                                    <ReviewSearchPanel />
                                </Suspense>
                                <Suspense fallback={<LoadingSkeleton />}>
                                    {/* Always pass Prestige-only as 'reviews' — this hub's "Action Board"
                                        frames items as YOUR problems to fix and routes them to YOUR teams.
                                        Merging competitor reviews in (when SCOPE=All) made Pigeon/Butterfly
                                        products appear as Prestige's CRITICAL issues. Competitor data is
                                        still available to the hub as the separate `competitorReviews` prop. */}
                                    <ActionIntelligenceHub
                                        reviews={filteredPrestigeReviews}
                                        competitorReviews={filteredCompetitorReviews}
                                    />
                                </Suspense>
                            </motion.div>
                        )}

                        {activeTab === 'master' && (
                            <motion.div
                                key="master"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="h-full flex flex-col"
                            >
                                <Suspense fallback={<LoadingSkeleton />}>
                                    <MasterLayout productFilters={{
                                        platform: filters.platform !== 'all' ? filters.platform : undefined,
                                        pareto_status: apiFilters.pareto_status as string | undefined,
                                        category: filters.productCategory || undefined,
                                        price_mode: filters.priceRange ? filters.priceMode : undefined,
                                        price_min: filters.priceRange?.min,
                                        price_max: filters.priceRange?.max,
                                    }} initialSearch={initialSkuSearch} />
                                </Suspense>
                            </motion.div>
                        )}

                        {activeTab === 'rules' && (
                            <motion.div
                                key="rules"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="p-1"
                            >
                                <Suspense fallback={<LoadingSkeleton />}>
                                    <RulesPage />
                                </Suspense>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </main>

            {/* Characteristic Detail Panel */}
            <CharacteristicDetailPanel
                characteristic={selectedCharacteristic}
                reviews={useMemo(() => ownReviewRows.map(toReview), [ownReviewRows])}
                onClose={() => setSelectedCharacteristic(null)}
            />

            {/* Competitor Benchmark Panel */}
            <CompetitorBenchmarkPanel
                isOpen={isCompetitorPanelOpen}
                onClose={() => setIsCompetitorPanelOpen(false)}
                selectedProduct={selectedProduct}
                reviews={useMemo(() => ownReviewRows.map(toReview), [ownReviewRows])}
                competitorReviews={useMemo(() => competitorRows.map(toReview), [competitorRows])}
            />
        </div>
    );
};

export default Dashboard;
