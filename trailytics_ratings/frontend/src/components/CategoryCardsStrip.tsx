/**
 * CategoryCardsStrip — Premium horizontal category card slider
 *
 * Design principles:
 *  • Each card is a self-contained "dashboard in a card":
 *      – Top: icon + name + SKU count (primary identity)
 *      – Mid: PDP & ML rating as large coloured badges (primary KPIs)
 *      – Bot: User rating + review/rating counts in a compact footer row
 *      – Trend badge pinned to top-right corner
 *  • Drag-to-scroll via pointer events (no library needed)
 *  • Floating glass-morphism scroll arrows with count indicator
 *  • "All" card uses a special gradient identity
 *  • Active card: animated glowing border, lifted shadow
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight,
    ChevronLeft,
    TrendingUp,
    TrendingDown,
    Layers,
    Sparkles,
    MousePointerClick,
    MessageSquare,
    BarChart3,
} from 'lucide-react';
import type { CategoryHealthItem, GlobalCategoryMetadata } from '../hooks/useRatingsAPI';
import { createRatingMetrics } from '../utils/ratingMetrics';
import { formatCompactCountValue, formatRatingValue } from '../utils/ratingMetrics';

interface CategoryCardsStripProps {
    categories: CategoryHealthItem[];
    globalMetadata?: GlobalCategoryMetadata;
    loading: boolean;
    selectedCategory: string | null;
    onCategorySelect: (category: string | null) => void;
}

// ─── Category icon map ────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
    'Pressure Cooker': '🫕',
    'Other Cookware': '🍳',
    'Tawa': '🥘',
    'Small Domestic Appliances': '🔌',
    'Gas Stove': '🔥',
    'Kadai': '🥘',
    'Fry Pan': '🍳',
    'Mixer Grinder': '⚙️',
    'Food Processor': '🔧',
    'Induction Cooktop': '⚡',
    'Kettle': '☕',
    'Rice Cooker': '🍚',
    'Cookware Set': '🍽️',
    'Air Fryer': '🌬️',
    'Wet Grinder': '🔩',
    'Dosa Tawa': '🫓',
    'Grill & Sandwich Maker': '🥪',
    'Toaster & OTG': '🍞',
    'Juicer': '🍊',
    'Hand Blender': '🥤',
    'Waffle Maker': '🧇',
    'Bottles & Flasks': '🧴',
    'Air Oven': '🌡️',
};

// ─── Colour themes per-card index (cycles) ────────────────────────────────────
// Unified palette: one brand accent (indigo) for all cards.
// Color information moves to data signals (trend pills, rating badges) instead of decorative variance.
const UNIFIED_THEME = {
    accent: '#6366f1',
    glow: 'rgba(99,102,241,0.14)',
    bg: 'from-slate-50 to-white dark:from-slate-900/40 dark:to-slate-900/20',
};

function getTheme(_idx: number) {
    return UNIFIED_THEME;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="shrink-0 w-52 h-44 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse border border-slate-200/60 dark:border-slate-700/40" />
    );
}

// ─── Rating column ────────────────────────────────────────────────────────────
function RatingColumn({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {label}
            </span>
            <span className="text-base font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">
                {value}
            </span>
        </div>
    );
}

// ─── Single category card ─────────────────────────────────────────────────────
function CategoryCard({
    category,
    skuCount,
    catalogueSkuCount,
    reviewSkuCount,
    avgPlatformRating,
    avgReviewRating,
    avgMlRating,
    reviewCount,
    totalRatings,
    growthPct,
    paretoCount,
    npdCount,
    positiveCount,
    negativeCount,
    neutralCount,
    isActive,
    onClick,
    index,
}: CategoryHealthItem & {
    isActive: boolean;
    onClick: () => void;
    index: number;
}) {
    const theme = getTheme(index);
    const icon = CATEGORY_ICONS[category] || '📦';
    const pdpVal = formatRatingValue(avgPlatformRating ?? null);
    const mlVal = formatRatingValue(avgMlRating ?? null);
    const userVal = formatRatingValue(avgReviewRating ?? null);
    const reviewsFormatted = formatCompactCountValue(reviewCount);
    const ratingsFormatted = formatCompactCountValue(totalRatings);

    const trendPositive = growthPct > 0;
    const trendNegative = growthPct < 0;
    // Severity scaling: drops >40% are alarming, >20% concerning, smaller stays muted.
    const trendSevere = trendNegative && Math.abs(growthPct) >= 40;
    const trendModerate = trendNegative && Math.abs(growthPct) >= 20 && Math.abs(growthPct) < 40;
    const trendChipBase = 'inline-flex items-center gap-0.5 font-semibold shrink-0 rounded-md px-1.5 py-0.5';
    const trendChipCls = trendSevere
        ? `${trendChipBase} text-[11px] bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 font-bold`
        : trendModerate
            ? `${trendChipBase} text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400`
            : trendPositive
                ? `${trendChipBase} text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400`
                : `${trendChipBase} text-[10px] text-rose-600 dark:text-rose-400`;

    // Sentiment bar — proportional widths from positive/negative/neutral.
    // Empty middle of the card now earns its keep by surfacing review mix at a glance.
    const totalSentiment = ((+positiveCount || 0) + (+negativeCount || 0) + (+neutralCount || 0)) || 1;
    const posPct = (+positiveCount || 0) / totalSentiment * 100;
    const negPct = (+negativeCount || 0) / totalSentiment * 100;
    const neuPct = 100 - posPct - negPct;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.25), type: 'spring', stiffness: 300, damping: 28 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            role="button"
            aria-pressed={isActive}
            className={`
                shrink-0 w-56 h-[210px] rounded-xl cursor-pointer select-none relative
                transition-all duration-200
                border
                ${isActive
                    ? 'border-indigo-500 ring-1 ring-indigo-500/30 shadow-md shadow-indigo-500/10'
                    : trendSevere
                        ? 'border-rose-300 dark:border-rose-800/60 hover:border-rose-500 hover:shadow-sm'
                        : 'border-slate-200 dark:border-slate-700/60 hover:border-indigo-400 hover:shadow-sm'
                }
                bg-white dark:bg-slate-900
            `}
            style={{ '--card-accent': theme.accent } as React.CSSProperties}
        >
            <div className="p-3.5 flex flex-col h-full gap-2">
                {/* Header: icon + category name + trend pill */}
                <div className="flex items-start gap-2">
                    <span className="text-xl leading-none flex-shrink-0">{icon}</span>
                    <h4 className="flex-1 text-[12px] font-semibold text-slate-800 dark:text-slate-100 leading-tight line-clamp-2 min-w-0">
                        {category}
                    </h4>
                    {trendPositive && (
                        <span className={trendChipCls} title="Review volume vs prior period">
                            <TrendingUp size={trendSevere ? 12 : 10} />+{Math.round(growthPct)}%
                        </span>
                    )}
                    {trendNegative && (
                        <span className={trendChipCls} title={trendSevere ? 'SEVERE DROP — review volume crashed >40% vs prior period' : 'Review volume vs prior period'}>
                            <TrendingDown size={trendSevere ? 12 : 10} />{Math.round(growthPct)}%
                        </span>
                    )}
                </div>

                {/* Hero: catalogue SKU count (authoritative), with the active subset
                    — SKUs that have reviews in the selected window — as a sub-label,
                    so "listed" vs "active" never look like contradictory numbers. */}
                <div className="flex items-baseline gap-1.5 -mt-0.5">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">
                        {(catalogueSkuCount ?? skuCount).toLocaleString()}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        listed
                    </span>
                    {reviewSkuCount !== undefined && (
                        <span className="text-[10px] text-slate-400 font-medium tabular-nums" title="SKUs with at least one review in the selected window">
                            · {reviewSkuCount.toLocaleString()} reviewed
                        </span>
                    )}
                </div>

                {/* Sentiment mix bar — fills the previously-empty middle */}
                {totalSentiment > 1 && (
                    <div className="flex flex-col gap-1" title={`${posPct.toFixed(0)}% positive · ${neuPct.toFixed(0)}% neutral · ${negPct.toFixed(0)}% negative`}>
                        <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                            {posPct > 0 && <div style={{ width: `${posPct}%` }} className="bg-emerald-400" />}
                            {neuPct > 0 && <div style={{ width: `${neuPct}%` }} className="bg-slate-300 dark:bg-slate-600" />}
                            {negPct > 0 && <div style={{ width: `${negPct}%` }} className="bg-rose-400" />}
                        </div>
                        <div className="flex justify-between text-[9px] tabular-nums text-slate-400 dark:text-slate-500">
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{posPct.toFixed(0)}%+</span>
                            <span>{negPct.toFixed(0)}% negative</span>
                        </div>
                    </div>
                )}

                {/* Rating columns: PDP · User · ML */}
                <div className="flex items-stretch border-y border-slate-100 dark:border-slate-800 py-1.5">
                    <RatingColumn label="PDP" value={pdpVal} />
                    <div className="w-px bg-slate-100 dark:bg-slate-800" />
                    <RatingColumn label="User" value={userVal} />
                    <div className="w-px bg-slate-100 dark:bg-slate-800" />
                    <RatingColumn label="ML" value={mlVal} />
                </div>

                {/* Footer: labelled counts + pareto/npd */}
                <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 mt-auto tabular-nums">
                    <span className="flex items-center gap-1" title={`${reviewCount.toLocaleString()} text reviews collected`}>
                        <MessageSquare size={10} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{reviewsFormatted}</span>
                        <span className="text-slate-400">rev</span>
                    </span>
                    <span className="flex items-center gap-1" title={`${totalRatings.toLocaleString()} PDP star ratings (no text)`}>
                        <BarChart3 size={10} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{ratingsFormatted}</span>
                        <span className="text-slate-400">rat</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        {paretoCount > 0 && (
                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold" title={`${paretoCount} Pareto SKUs (top sellers driving 80% of revenue)`}>
                                P{paretoCount}
                            </span>
                        )}
                        {npdCount > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold" title={`${npdCount} New Product Development SKUs`}>
                                N{npdCount}
                            </span>
                        )}
                    </span>
                </div>
            </div>

            {/* Active bottom accent line */}
            {isActive && (
                <motion.div
                    layoutId="categoryActiveBar"
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-indigo-500"
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.45 }}
                />
            )}
        </motion.div>
    );
}

// ─── "All Categories" card ────────────────────────────────────────────────────
function AllCategoriesCard({
    totalSkus,
    activeSkus,
    pdpAll,
    mlAll,
    userAll,
    reviewsAll,
    ratingsAll,
    catCount,
    isActive,
    onClick,
}: {
    totalSkus: number;
    activeSkus?: number;
    pdpAll: string;
    mlAll: string;
    userAll: string;
    reviewsAll: string;
    ratingsAll: string;
    catCount: number;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            role="button"
            aria-pressed={isActive}
            className={`
                shrink-0 w-56 h-[210px] rounded-xl cursor-pointer select-none relative
                transition-all duration-200 border
                ${isActive
                    ? 'border-indigo-500 ring-1 ring-indigo-500/30 shadow-md shadow-indigo-500/10 bg-white dark:bg-slate-900'
                    : 'border-slate-200 dark:border-slate-700/60 hover:border-indigo-400 hover:shadow-sm bg-white dark:bg-slate-900'
                }
            `}
        >
            <div className="p-3.5 flex flex-col h-full gap-2">
                {/* Header — matches per-category card layout (icon + name + trend pill slot) */}
                <div className="flex items-start gap-2">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${isActive ? 'bg-indigo-500/15' : 'bg-slate-100 dark:bg-slate-800'}`}>
                        <Sparkles size={14} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                    </div>
                    <h4 className="flex-1 text-[12px] font-semibold text-slate-800 dark:text-slate-100 leading-tight pt-0.5 line-clamp-2 min-w-0">
                        All Categories
                    </h4>
                    <span className="inline-flex items-center gap-0.5 font-semibold shrink-0 rounded-md px-1.5 py-0.5 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">
                        {catCount} cats
                    </span>
                </div>

                {/* Hero: catalogue SKU count, with active subset as a sub-label */}
                <div className="flex items-baseline gap-1.5 -mt-0.5">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">
                        {Number(totalSkus).toLocaleString()}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        listed
                    </span>
                    {activeSkus !== undefined && (
                        <span className="text-[10px] text-slate-400 font-medium tabular-nums" title="SKUs with at least one review in the selected window">
                            · {Number(activeSkus).toLocaleString()} reviewed
                        </span>
                    )}
                </div>

                {/* Spacer band — matches the sentiment bar's vertical real-estate so the
                    rating row aligns with per-category cards beside it. */}
                <div className="flex flex-col gap-1">
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <div className="bg-indigo-400 dark:bg-indigo-500" style={{ width: '100%' }} />
                    </div>
                    <div className="flex justify-between text-[9px] tabular-nums text-slate-400 dark:text-slate-500">
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">All categories</span>
                        <span>{catCount} active</span>
                    </div>
                </div>

                {/* Rating columns: PDP · User · ML */}
                <div className="flex items-stretch border-y border-slate-100 dark:border-slate-800 py-1.5">
                    <RatingColumn label="PDP" value={pdpAll} />
                    <div className="w-px bg-slate-100 dark:bg-slate-800" />
                    <RatingColumn label="User" value={userAll} />
                    <div className="w-px bg-slate-100 dark:bg-slate-800" />
                    <RatingColumn label="ML" value={mlAll} />
                </div>

                {/* Footer — same shape as per-category card footer */}
                <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 mt-auto tabular-nums">
                    <span className="flex items-center gap-1">
                        <MessageSquare size={10} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{reviewsAll}</span>
                        <span className="text-slate-400">rev</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <BarChart3 size={10} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{ratingsAll}</span>
                        <span className="text-slate-400">rat</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">
                        All
                    </span>
                </div>
            </div>

            {isActive && (
                <motion.div
                    layoutId="categoryActiveBar"
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-indigo-500"
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.45 }}
                />
            )}
        </motion.div>
    );
}

// ─── Scroll arrow button ──────────────────────────────────────────────────────
function ScrollArrow({
    direction,
    onClick,
}: {
    direction: 'left' | 'right';
    onClick: () => void;
}) {
    return (
        <motion.button
            initial={{ opacity: 0, x: direction === 'left' ? -6 : 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction === 'left' ? -6 : 6 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={onClick}
            className={`
                absolute ${direction === 'left' ? 'left-0' : 'right-0'} top-1/2 -translate-y-1/2 z-20
                w-9 h-9 rounded-full
                bg-white/95 dark:bg-slate-900/95
                shadow-[0_4px_16px_rgba(0,0,0,0.14)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]
                border border-slate-200/80 dark:border-slate-700/60
                backdrop-blur-md
                flex items-center justify-center
                hover:border-indigo-300 dark:hover:border-indigo-600
                hover:bg-indigo-50 dark:hover:bg-indigo-900/30
                transition-colors
            `}
        >
            {direction === 'left'
                ? <ChevronLeft size={16} className="text-slate-600 dark:text-slate-300" />
                : <ChevronRight size={16} className="text-slate-600 dark:text-slate-300" />
            }
        </motion.button>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
const CategoryCardsStrip: React.FC<CategoryCardsStripProps> = ({
    categories,
    globalMetadata,
    loading,
    selectedCategory,
    onCategorySelect,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const isDragging = useRef(false);
    const hasDragged = useRef(false);
    const dragStartX = useRef(0);
    const dragStartScrollLeft = useRef(0);
    const dragThreshold = 5;

    // ── Scroll position tracking ──────────────────────────────────────────────
    const updateScrollArrows = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    }, []);

    useEffect(() => {
        updateScrollArrows();
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', updateScrollArrows, { passive: true });
        const ro = new ResizeObserver(updateScrollArrows);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', updateScrollArrows);
            ro.disconnect();
        };
    }, [categories, updateScrollArrows]);

    // ── Click-scroll buttons ──────────────────────────────────────────────────
    const scroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({
            left: direction === 'left' ? -(el.clientWidth * 0.65) : el.clientWidth * 0.65,
            behavior: 'smooth',
        });
    };

    // ── Drag-to-scroll (mouse) ────────────────────────────────────────────────
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = scrollRef.current;
        if (!el) return;
        
        isDragging.current = true;
        hasDragged.current = false;
        dragStartX.current = e.clientX;
        dragStartScrollLeft.current = el.scrollLeft;
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        
        const el = scrollRef.current;
        if (!el) return;

        const dx = e.clientX - dragStartX.current;
        
        if (!hasDragged.current && Math.abs(dx) > dragThreshold) {
            hasDragged.current = true;
            el.setPointerCapture(e.pointerId);
            el.style.cursor = 'grabbing';
            el.style.userSelect = 'none';
        }

        if (hasDragged.current) {
            el.scrollLeft = dragStartScrollLeft.current - dx;
        }
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        
        const el = scrollRef.current;
        if (el) {
            if (hasDragged.current) {
                el.releasePointerCapture(e.pointerId);
                el.style.cursor = 'grab';
                el.style.removeProperty('user-select');
            } else {
                el.style.cursor = 'grab';
            }
        }
        
        isDragging.current = false;
        hasDragged.current = false;
    };

    // ── Aggregate "All" stats ─────────────────────────────────────────────────
    const totalReviewedSkusAll = globalMetadata?.reviewSkuCount ?? categories.reduce((s, c) => s + (c.reviewSkuCount ?? 0), 0);
    const totalSkusAll = globalMetadata?.catalogueSkuCount ?? categories.reduce((s, c) => s + (c.catalogueSkuCount ?? c.skuCount), 0);
    const totalReviewsAll = globalMetadata?.reviewCount ?? categories.reduce((s, c) => s + c.reviewCount, 0);
    const totalRatingsAll = globalMetadata?.totalRatings ?? categories.reduce((s, c) => s + c.totalRatings, 0);
    const weightedUser = categories.reduce((s, c) => s + (c.avgReviewRating || 0) * c.reviewCount, 0);
    const weightedMl = categories.reduce((s, c) => s + ((c.avgMlRating ?? 0)) * c.reviewCount, 0);
    const weightedPdp = categories.reduce((s, c) => s + ((c.avgPlatformRating ?? 0)) * c.totalRatings, 0);
    const allMetrics = createRatingMetrics({
        pdp_rating: totalRatingsAll > 0 ? weightedPdp / totalRatingsAll : null,
        user_rating: totalReviewsAll > 0 ? weightedUser / totalReviewsAll : null,
        ml_rating: totalReviewsAll > 0 ? weightedMl / totalReviewsAll : null,
        review_count: totalReviewsAll,
        rating_count: totalRatingsAll,
    });

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className="w-28 h-4 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                    <div className="w-16 h-4 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                </div>
                <div className="flex gap-3 overflow-hidden">
                    {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* ── Section header ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers size={16} className="text-indigo-500" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        Product Categories
                    </h3>
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-semibold">
                        {categories.length}
                    </span>
                </div>
                <AnimatePresence>
                    {!hasInteracted && (
                        <motion.div
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            className="flex items-center gap-1.5 text-[11px] text-indigo-500 font-medium"
                        >
                            <motion.div
                                animate={{ x: [0, 4, 0] }}
                                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                            >
                                <MousePointerClick size={13} />
                            </motion.div>
                            <span>Drag or click to explore</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Slider container ────────────────────────────────────────── */}
            <div className="relative">
                {/* Fade-edge masks */}
                <div
                    className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-r from-white dark:from-slate-950 to-transparent transition-opacity duration-300"
                    style={{ opacity: canScrollLeft ? 1 : 0 }}
                />
                <div
                    className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-white dark:from-slate-950 to-transparent transition-opacity duration-300"
                    style={{ opacity: canScrollRight ? 1 : 0 }}
                />

                {/* Scroll arrows */}
                <AnimatePresence>
                    {canScrollLeft && <ScrollArrow key="left" direction="left" onClick={() => scroll('left')} />}
                </AnimatePresence>
                <AnimatePresence>
                    {canScrollRight && <ScrollArrow key="right" direction="right" onClick={() => scroll('right')} />}
                </AnimatePresence>

                {/* Cards row */}
                <div
                    ref={scrollRef}
                    className="no-scrollbar flex gap-3 overflow-x-auto pb-2 px-0.5"
                    style={{ WebkitOverflowScrolling: 'touch', cursor: 'grab' }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                >
                    {/* "All" card */}
                    <AllCategoriesCard
                        totalSkus={totalSkusAll}
                        activeSkus={totalReviewedSkusAll}
                        pdpAll={formatRatingValue(allMetrics?.pdp_rating ?? null)}
                        mlAll={formatRatingValue(allMetrics?.ml_rating ?? null)}
                        userAll={formatRatingValue(allMetrics?.user_rating ?? null)}
                        reviewsAll={formatCompactCountValue(totalReviewsAll)}
                        ratingsAll={formatCompactCountValue(totalRatingsAll)}
                        catCount={categories.length}
                        isActive={selectedCategory === null}
                        onClick={() => {
                            onCategorySelect(null);
                            setHasInteracted(true);
                        }}
                    />

                    {/* Per-category cards */}
                    {categories.map((cat, idx) => (
                        <CategoryCard
                            key={cat.category}
                            {...cat}
                            isActive={selectedCategory === cat.category}
                            onClick={() => {
                                onCategorySelect(selectedCategory === cat.category ? null : cat.category);
                                setHasInteracted(true);
                            }}
                            index={idx}
                        />
                    ))}
                </div>
            </div>

            {/* ── Active category breadcrumb ───────────────────────────────── */}
            <AnimatePresence>
                {selectedCategory && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -6, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="flex items-center gap-2 text-xs pt-0.5">
                            <button
                                onClick={() => onCategorySelect(null)}
                                className="text-indigo-500 hover:text-indigo-600 font-medium transition-colors"
                            >
                                All Categories
                            </button>
                            <ChevronRight size={11} className="text-slate-400" />
                            <span className="text-slate-900 dark:text-white font-semibold flex items-center gap-1.5 px-2 py-1">
                                {CATEGORY_ICONS[selectedCategory] || '📦'} {selectedCategory}
                            </span>
                            <button
                                onClick={() => onCategorySelect(null)}
                                className="ml-1.5 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                            >
                                ✕ Clear
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CategoryCardsStrip;
