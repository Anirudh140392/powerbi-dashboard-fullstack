/**
 * CompetitorRadarChart Component
 * Multi-axis radar chart comparing sentiment across categories
 */
import React, { useMemo } from 'react';
import { Radar } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Review, SentimentCategory, RadarChartData } from '../types';

interface CompetitorRadarChartProps {
    reviews: Review[];
    competitorReviews?: Review[];
    competitorName?: string;
    categories?: SentimentCategory[];
}

/**
 * Calculate sentiment score for a category (0-100)
 * Score = ((Positive - Negative) / Total + 1) * 50
 */
function calculateCategoryScore(reviews: Review[], category: string): number {
    const categoryReviews = reviews.filter(r =>
        r.sentimentCategory?.toLowerCase() === category.toLowerCase()
    );

    if (categoryReviews.length === 0) return 0;

    const positive = categoryReviews.filter(r => r.sentiment === 'Positive').length;
    const negative = categoryReviews.filter(r => r.sentiment === 'Negative').length;
    const total = categoryReviews.length;

    return Math.round(((positive - negative) / total + 1) * 50);
}

const CompetitorRadarChart: React.FC<CompetitorRadarChartProps> = ({
    reviews,
    competitorReviews = [],
    competitorName = 'Market Average',
    categories
}) => {
    const chartCategories = useMemo(() => {
        if (categories && categories.length > 0) return categories;

        const ownCategories = new Set(
            reviews
                .map(review => review.sentimentCategory?.trim())
                .filter((value): value is string => Boolean(value))
        );
        const competitorCategories = new Set(
            competitorReviews
                .map(review => review.sentimentCategory?.trim())
                .filter((value): value is string => Boolean(value))
        );

        return Array.from(ownCategories).filter(category => competitorCategories.has(category));
    }, [categories, reviews, competitorReviews]);

    const radarData = useMemo((): RadarChartData[] => {
        return chartCategories.map(category => ({
            category,
            ourScore: calculateCategoryScore(reviews, category),
            competitorScore: calculateCategoryScore(competitorReviews, category)
        }));
    }, [reviews, competitorReviews, chartCategories]);

    // Calculate overall comparison
    const avgOurScore = radarData.length > 0 ? radarData.reduce((sum, d) => sum + d.ourScore, 0) / radarData.length : 0;
    const avgCompScore = radarData.length > 0 ? radarData.reduce((sum, d) => sum + d.competitorScore, 0) / radarData.length : 0;
    const overallDelta = avgOurScore - avgCompScore;

    // SVG Radar Chart dimensions
    const size = 280;
    const center = size / 2;
    const radius = 100;
    const angleStep = chartCategories.length > 0 ? (2 * Math.PI) / chartCategories.length : 0;

    // Generate polygon points for a data series
    const getPolygonPoints = (scores: number[]): string => {
        return scores.map((score, i) => {
            const angle = i * angleStep - Math.PI / 2; // Start from top
            const r = (score / 100) * radius;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);
            return `${x},${y}`;
        }).join(' ');
    };

    // Generate axis lines and labels
    const renderAxes = () => {
        return chartCategories.map((category, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x2 = center + radius * Math.cos(angle);
            const y2 = center + radius * Math.sin(angle);
            const labelX = center + (radius + 20) * Math.cos(angle);
            const labelY = center + (radius + 20) * Math.sin(angle);

            return (
                <g key={category}>
                    {/* Axis line */}
                    <line
                        x1={center}
                        y1={center}
                        x2={x2}
                        y2={y2}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-700"
                        strokeWidth="1"
                    />
                    {/* Label */}
                    <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-slate-500 dark:fill-slate-400 text-[10px] font-medium"
                    >
                        {category.length > 12 ? category.slice(0, 10) + '...' : category}
                    </text>
                </g>
            );
        });
    };

    // Render concentric circles for scale
    const renderScaleCircles = () => {
        return [25, 50, 75, 100].map(scale => (
            <circle
                key={scale}
                cx={center}
                cy={center}
                r={(scale / 100) * radius}
                fill="none"
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="1"
            />
        ));
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-5"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
                        <Radar className="text-indigo-500" size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">📊 Competitor Comparison</h3>
                        <p className="text-xs text-slate-500">Sentiment by category vs {competitorName}</p>
                    </div>
                </div>
                <div className={`flex items-center gap-1 text-sm font-bold ${overallDelta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {overallDelta >= 0 ? '+' : ''}{overallDelta.toFixed(0)} pts
                </div>
            </div>

            {competitorReviews.length === 0 || radarData.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    {competitorReviews.length === 0
                        ? 'No competitor review data is available for this comparison.'
                        : 'No comparable sentiment categories are available between Prestige and competitor reviews.'}
                </div>
            ) : (
                <>
                    {/* Legend */}
                    <div className="flex items-center gap-4 mb-4 justify-center">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                            <span className="text-xs text-slate-600 dark:text-slate-400">Prestige</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                            <span className="text-xs text-slate-600 dark:text-slate-400">{competitorName}</span>
                        </div>
                    </div>

                    {/* Radar Chart SVG */}
                    <div className="flex justify-center">
                        <svg width={size} height={size} className="overflow-visible">
                            {/* Scale circles */}
                            {renderScaleCircles()}

                            {/* Axes */}
                            {renderAxes()}

                            {/* Competitor polygon (behind) */}
                            <polygon
                                points={getPolygonPoints(radarData.map(d => d.competitorScore))}
                                fill="rgba(251, 146, 60, 0.2)"
                                stroke="rgb(251, 146, 60)"
                                strokeWidth="2"
                            />

                            {/* Our polygon (front) */}
                            <polygon
                                points={getPolygonPoints(radarData.map(d => d.ourScore))}
                                fill="rgba(99, 102, 241, 0.3)"
                                stroke="rgb(99, 102, 241)"
                                strokeWidth="2"
                            />

                            {/* Data points for our scores */}
                            {radarData.map((d, i) => {
                                const angle = i * angleStep - Math.PI / 2;
                                const r = (d.ourScore / 100) * radius;
                                const x = center + r * Math.cos(angle);
                                const y = center + r * Math.sin(angle);
                                return (
                                    <circle
                                        key={`our-${d.category}`}
                                        cx={x}
                                        cy={y}
                                        r={4}
                                        fill="rgb(99, 102, 241)"
                                        className="cursor-pointer hover:r-6 transition-all"
                                    />
                                );
                            })}
                        </svg>
                    </div>

                    {/* Category Breakdown */}
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-2">
                        {radarData.map(d => {
                            const gap = d.ourScore - d.competitorScore;
                            return (
                                <div
                                    key={d.category}
                                    className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                                >
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                                        {d.category}
                                    </p>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-sm font-bold text-indigo-600">{d.ourScore}</span>
                                        <span className={`text-xs font-medium ${gap >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {gap >= 0 ? '+' : ''}{gap}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </motion.div>
    );
};

export default CompetitorRadarChart;
