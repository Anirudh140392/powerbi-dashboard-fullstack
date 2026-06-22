/**
 * TimelineView Component
 * Shows category sentiment trends over time with Recharts Area Chart
 */

import { useEffect, useMemo, useState } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer
} from 'recharts';
import {
    Calendar,
    TrendingUp,
    TrendingDown,
    ThumbsUp,
    ThumbsDown,
    BarChart3,
    Percent,
    Hash
} from 'lucide-react';
import type { Review } from '../types';
import type { TimelineMonth } from '../hooks/useRatingsAPI';

interface TimelineViewProps {
    reviews: Review[];
    serverTimeline?: TimelineMonth[];
    onPeriodClick?: (period: string, category: string) => void;
}

interface MonthlyData {
    month: string;
    categories: Record<string, { positive: number; negative: number; neutral: number; total: number }>;
    avgRating: number;
    totalReviews: number;
}

const CATEGORY_ORDER = [
    'Quality',
    'General',
    'Performance',
    'Value',
    'Usability',
    'Delivery',
    'Safety',
    'Features'
];

const CATEGORY_COLORS: Record<string, string> = {
    'Quality': '#3b82f6',
    'General': '#64748b',
    'Performance': '#22c55e',
    'Value': '#a855f7',
    'Usability': '#f97316',
    'Delivery': '#ef4444',
    'Safety': '#dc2626',
    'Features': '#6366f1',
    'Competitor': '#f59e0b',
    'Brand': '#06b6d4',
    'Customer Service': '#ec4899',
};

export function TimelineView({ reviews, serverTimeline, onPeriodClick }: TimelineViewProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<'3m' | '6m' | '12m' | 'all'>('6m');
    const [sentimentMode, setSentimentMode] = useState<'all' | 'positive' | 'negative'>('all');
    const [displayMode, setDisplayMode] = useState<'percent' | 'absolute'>('percent');
    const [chartReady, setChartReady] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setChartReady(true), 0);
        return () => window.clearTimeout(timer);
    }, []);

    const monthlyData = useMemo(() => {
        // Use server-side data when available (covers full date range)
        let allMonths: MonthlyData[];

        allMonths = (serverTimeline ?? []).map(m => ({
            month: m.month,
            categories: m.categories,
            avgRating: m.avgRating,
            totalReviews: m.totalReviews,
        }));

        // Apply time range filter
        if (timeRange !== 'all') {
            const monthsToShow = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;
            allMonths = allMonths.slice(-monthsToShow);
        }

        return allMonths;
    }, [reviews, serverTimeline, timeRange]);

    // Transform data for Recharts based on sentiment mode and display mode
    const chartData = useMemo(() => {
        return monthlyData.map(data => {
            const [year, month] = data.month.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            const formatted = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

            const rawData: Record<string, number> = {};
            let monthTotal = 0;

            CATEGORY_ORDER.forEach(cat => {
                const catData = data.categories[cat];
                let val = 0;
                if (sentimentMode === 'positive') {
                    val = catData?.positive || 0;
                } else if (sentimentMode === 'negative') {
                    val = catData?.negative || 0;
                } else {
                    val = catData?.total || 0;
                }
                rawData[cat] = val;
                monthTotal += val;
            });

            const categoryData: Record<string, number | string> = { name: formatted, month: data.month };

            if (displayMode === 'percent' && monthTotal > 0) {
                // Normalize so stacked percentages sum to exactly 100%
                const rawPcts = CATEGORY_ORDER.map(cat => ({
                    cat,
                    pct: Math.round((rawData[cat] / monthTotal) * 1000) / 10,
                    raw: rawData[cat],
                }));
                const pctSum = rawPcts.reduce((s, p) => s + p.pct, 0);
                const residual = Math.round((100 - pctSum) * 10) / 10;
                // Distribute residual to the largest category
                if (residual !== 0) {
                    const largest = rawPcts.reduce((a, b) => a.pct >= b.pct ? a : b);
                    largest.pct = Math.round((largest.pct + residual) * 10) / 10;
                }
                rawPcts.forEach(p => {
                    categoryData[p.cat] = p.pct;
                    categoryData[`${p.cat}_raw`] = p.raw;
                });
            } else {
                CATEGORY_ORDER.forEach(cat => {
                    categoryData[cat] = rawData[cat];
                });
            }

            categoryData['_total'] = monthTotal;

            return categoryData;
        });
    }, [monthlyData, sentimentMode, displayMode]);

    const calculateTrend = (category: string) => {
        if (monthlyData.length < 2) return 'stable';

        const recentMonths = monthlyData.slice(-3);
        const olderMonths = monthlyData.slice(-6, -3);

        if (olderMonths.length === 0) return 'stable';

        const recentPositiveRate = recentMonths.reduce((sum, m) => {
            const cat = m.categories[category];
            return sum + (cat ? cat.positive / Math.max(cat.total, 1) : 0);
        }, 0) / recentMonths.length;

        const olderPositiveRate = olderMonths.reduce((sum, m) => {
            const cat = m.categories[category];
            return sum + (cat ? cat.positive / Math.max(cat.total, 1) : 0);
        }, 0) / olderMonths.length;

        const diff = recentPositiveRate - olderPositiveRate;
        if (diff > 0.1) return 'improving';
        if (diff < -0.1) return 'declining';
        return 'stable';
    };

    const categoriesToShow = selectedCategory ? [selectedCategory] : CATEGORY_ORDER;

    // Dynamic colors based on sentiment mode
    const getAreaColor = (cat: string) => {
        if (sentimentMode === 'positive') return '#22c55e';
        if (sentimentMode === 'negative') return '#ef4444';
        return CATEGORY_COLORS[cat];
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-indigo-500" />
                        Sentiment Timeline
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {sentimentMode === 'positive' ? 'Positive reviews' : sentimentMode === 'negative' ? 'Negative reviews' : 'All reviews'} by category — {displayMode === 'percent' ? '% contribution' : 'absolute count'}
                    </p>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Sentiment Mode Toggle */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setSentimentMode('all')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${sentimentMode === 'all'
                                ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <BarChart3 size={14} />
                            All
                        </button>
                        <button
                            onClick={() => setSentimentMode('positive')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${sentimentMode === 'positive'
                                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 shadow-sm'
                                : 'text-slate-500 hover:text-green-600 dark:hover:text-green-400'
                                }`}
                        >
                            <ThumbsUp size={14} />
                            Positive
                        </button>
                        <button
                            onClick={() => setSentimentMode('negative')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${sentimentMode === 'negative'
                                ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 shadow-sm'
                                : 'text-slate-500 hover:text-red-600 dark:hover:text-red-400'
                                }`}
                        >
                            <ThumbsDown size={14} />
                            Negative
                        </button>
                    </div>

                    {/* Display Mode Toggle: Absolute vs % */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setDisplayMode('percent')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${displayMode === 'percent'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <Percent size={14} />
                            %
                        </button>
                        <button
                            onClick={() => setDisplayMode('absolute')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${displayMode === 'absolute'
                                ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <Hash size={14} />
                            Abs
                        </button>
                    </div>

                    {/* Time Range Filter */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        {(['3m', '6m', '12m', 'all'] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${timeRange === range
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {range === 'all' ? 'All' : range}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${!selectedCategory
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                >
                    All Themes
                </button>
                {CATEGORY_ORDER.map(cat => {
                    const trend = calculateTrend(cat);
                    return (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-1 ${selectedCategory === cat
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                                }`}
                        >
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                            />
                            {cat}
                            {trend === 'improving' && <TrendingUp className="w-3 h-3 text-green-500" />}
                            {trend === 'declining' && <TrendingDown className="w-3 h-3 text-red-500" />}
                        </button>
                    );
                })}
            </div>

            {/* Area Chart */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 min-w-[1px]">
                {chartReady && (
                <ResponsiveContainer width="100%" height={320} minWidth={1} minHeight={1}>
                    <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        onClick={(data: unknown) => {
                            const d = data as { activePayload?: { payload: { month: string } }[] };
                            if (d?.activePayload?.[0]) {
                                const month = d.activePayload[0].payload.month;
                                onPeriodClick?.(month, selectedCategory || 'all');
                            }
                        }}
                    >
                        <defs>
                            {categoriesToShow.map(cat => (
                                <linearGradient key={cat} id={`gradient-${cat}-${sentimentMode}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={getAreaColor(cat)} stopOpacity={0.8} />
                                    <stop offset="95%" stopColor={getAreaColor(cat)} stopOpacity={0.1} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            domain={displayMode === 'percent' ? [0, 100] : ['auto', 'auto']}
                            tickFormatter={(v: number) => displayMode === 'percent' ? `${v}%` : String(v)}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            formatter={(value: unknown, name?: string, props?: { payload?: Record<string, unknown> }) => {
                                if (displayMode === 'percent') {
                                    const raw = props?.payload?.[`${name}_raw`];
                                    return [`${value}% (${Number(raw || 0).toLocaleString()})`, name || ''];
                                }
                                return [String(value), name || ''];
                            }}
                        />
                        <Legend
                            wrapperStyle={{ paddingTop: '20px' }}
                            formatter={(value) => <span className="text-sm text-slate-600">{value}</span>}
                        />
                        {categoriesToShow.map(cat => (
                            <Area
                                key={cat}
                                type="monotone"
                                dataKey={cat}
                                stackId="1"
                                stroke={getAreaColor(cat)}
                                fill={`url(#gradient-${cat}-${sentimentMode})`}
                                strokeWidth={2}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}

export default TimelineView;
