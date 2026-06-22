import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Target, TrendingUp, Award, Users } from 'lucide-react';
import type { Review } from '../types';

interface TrendChartProps {
    reviews: Review[];
    competitorReviews?: Array<{ brand?: string; rating: number; sentiment?: string; sentimentCategory?: string }>;
}

const TrendChart: React.FC<TrendChartProps> = ({ reviews, competitorReviews: competitorReviewsProp }) => {
    const [viewMode, setViewMode] = useState<'benchmark' | 'radar' | 'head2head'>('benchmark');
    const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
    const [chartReady, setChartReady] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setChartReady(true), 0);
        return () => window.clearTimeout(timer);
    }, []);

    const competitorReviews = useMemo(() => competitorReviewsProp || [], [competitorReviewsProp]);

    // Combine all reviews with brand labels
    const allReviews = useMemo(() => {
        const prestige = reviews.map(r => ({ ...r, brand: 'Prestige' }));
        return [...prestige, ...competitorReviews];
    }, [reviews, competitorReviews]);

    // Get unique competitor brands
    const brands = useMemo(() => {
        const brandSet = new Set<string>();
        brandSet.add('Prestige');
        competitorReviews.forEach(r => { if (r.brand) brandSet.add(r.brand); });
        return Array.from(brandSet).slice(0, 4); // Top 4 brands
    }, [competitorReviews]);

    // Category benchmark data
    const benchmarkData = useMemo(() => {
        // Derive categories from actual review data — no hardcoded list
        const catSet = new Set<string>();
        allReviews.forEach(r => { if (r.sentimentCategory) catSet.add(r.sentimentCategory as string); });
        const categories = Array.from(catSet).sort();

        return categories.map(category => {
            const result: Record<string, string | number> = { category };

            brands.forEach(brand => {
                const brandReviews = allReviews.filter(r => r.brand === brand && r.sentimentCategory === category);
                const positiveCount = brandReviews.filter(r => r.sentiment === 'POSITIVE' || r.sentiment === 'Positive' || (r.rating && r.rating >= 4)).length;
                const total = brandReviews.length;
                result[brand] = total > 0 ? Math.round((positiveCount / total) * 100) : 0;
            });

            return result;
        }).filter(d => (typeof d['Prestige'] === 'number' && d['Prestige'] > 0) || Object.values(d).some(v => typeof v === 'number' && v > 0));
    }, [allReviews, brands]);

    // Radar chart data
    const radarData = useMemo(() => {
        const metrics = [
    { key: 'avgRating', label: 'User Rating' },
            { key: 'positiveRate', label: 'Positive %' },
            { key: 'qualityScore', label: 'Quality' },
            { key: 'valueScore', label: 'Value' },
            { key: 'safetyScore', label: 'Safety' }
        ];

        const brandScores: Record<string, Record<string, number>> = {};

        brands.forEach(brand => {
            const brandReviews = allReviews.filter(r => r.brand === brand);
            const total = brandReviews.length;
            const positive = brandReviews.filter(r => r.sentiment === 'POSITIVE' || r.sentiment === 'Positive' || (r.rating && r.rating >= 4)).length;
            const avgRating = total > 0 ? brandReviews.reduce((sum, r) => sum + (r.rating || 3), 0) / total : 3;

            const qualityReviews = brandReviews.filter(r => r.sentimentCategory === 'Quality');
            const valueReviews = brandReviews.filter(r => r.sentimentCategory === 'Value');
            const safetyReviews = brandReviews.filter(r => r.sentimentCategory === 'Safety');

            brandScores[brand] = {
                avgRating: (avgRating / 5) * 100,
                positiveRate: total > 0 ? (positive / total) * 100 : 0,
                qualityScore: qualityReviews.length > 0 ? (qualityReviews.filter(r => r.sentiment === 'POSITIVE' || r.sentiment === 'Positive').length / qualityReviews.length) * 100 : 50,
                valueScore: valueReviews.length > 0 ? (valueReviews.filter(r => r.sentiment === 'POSITIVE' || r.sentiment === 'Positive').length / valueReviews.length) * 100 : 50,
                safetyScore: safetyReviews.length > 0 ? (safetyReviews.filter(r => r.sentiment === 'POSITIVE' || r.sentiment === 'Positive').length / safetyReviews.length) * 100 : 50
            };
        });

        return metrics.map(m => ({
            metric: m.label,
            ...Object.fromEntries(brands.map(b => [b, Math.round(brandScores[b]?.[m.key] || 0)]))
        }));
    }, [allReviews, brands]);

    // Head to head comparison
    const headToHeadData = useMemo(() => {
        const prestigeReviews = allReviews.filter(r => r.brand === 'Prestige');
        const compBrandsList = brands.filter(b => b !== 'Prestige');
        
        const competitorBrand = selectedCompetitor && compBrandsList.includes(selectedCompetitor)
            ? selectedCompetitor
            : (compBrandsList[0] || 'Competitor');
            
        const compReviews = allReviews.filter(r => r.brand === competitorBrand);

        const metrics = [
            {
                metric: 'User Rating',
                prestige: prestigeReviews.length > 0 ? (prestigeReviews.reduce((s, r) => s + (r.rating || 3), 0) / prestigeReviews.length).toFixed(1) : '0',
                competitor: compReviews.length > 0 ? (compReviews.reduce((s, r) => s + (r.rating || 3), 0) / compReviews.length).toFixed(1) : '0'
            },
            {
                metric: 'Positive Reviews',
                prestige: `${Math.round((prestigeReviews.filter(r => r.sentiment === 'POSITIVE' || r.sentiment === 'Positive').length / prestigeReviews.length) * 100)}%`,
                competitor: compReviews.length > 0 ? `${Math.round((compReviews.filter(r => r.sentiment === 'POSITIVE' || r.sentiment === 'Positive').length / compReviews.length) * 100)}%` : '0%'
            },
            {
                metric: 'Total Reviews',
                prestige: prestigeReviews.length.toLocaleString(),
                competitor: compReviews.length.toLocaleString()
            },
            {
                metric: 'Quality Issues',
                prestige: `${Math.round((prestigeReviews.filter(r => r.sentimentCategory === 'Quality' && (r.sentiment === 'NEGATIVE' || r.sentiment === 'Negative')).length / prestigeReviews.length) * 100)}%`,
                competitor: compReviews.length > 0 ? `${Math.round((compReviews.filter(r => r.sentimentCategory === 'Quality' && (r.sentiment === 'NEGATIVE' || r.sentiment === 'Negative')).length / compReviews.length) * 100)}%` : '0%'
            }
        ];

        return { competitorBrand, metrics };
    }, [allReviews, brands, selectedCompetitor]);

    const COLORS = ['#8b5cf6', '#f97316', '#06b6d4', '#22c55e'];

    return (
        <div className="space-y-4">
            {/* Header with view selector */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Target className="text-purple-500" size={18} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Competitive Benchmark</span>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    {[
                        { id: 'benchmark', label: '📊 Category Comparison' },
                        { id: 'radar', label: '🎯 Radar View' },
                        { id: 'head2head', label: '⚔️ Head to Head' },
                    ].map(mode => (
                        <button
                            key={mode.id}
                            onClick={() => setViewMode(mode.id as typeof viewMode)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === mode.id
                                ? 'bg-white dark:bg-slate-700 text-purple-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Brand legend */}
            <div className="flex items-center gap-4 text-xs">
                {brands.map((brand, i) => (
                    <div key={brand} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[i] }} />
                        <span className={brand === 'Prestige' ? 'font-bold text-purple-600' : 'text-slate-600 dark:text-slate-400'}>{brand}</span>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="w-full min-w-[1px] h-[280px] min-h-[280px]">
                {chartReady && viewMode === 'benchmark' && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={benchmarkData} margin={{ left: 10, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis dataKey="category" stroke="#94a3b8" fontSize={11} />
                            <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                                formatter={(value, name) => [`${value ?? 0}% positive`, name as string]}
                            />
                            <Legend />
                            {brands.map((brand, i) => (
                                <Bar
                                    key={brand}
                                    dataKey={brand}
                                    fill={COLORS[i]}
                                    radius={[4, 4, 0, 0]}
                                    opacity={brand === 'Prestige' ? 1 : 0.7}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                )}

                {chartReady && viewMode === 'radar' && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                            {brands.slice(0, 3).map((brand, i) => (
                                <Radar
                                    key={brand}
                                    name={brand}
                                    dataKey={brand}
                                    stroke={COLORS[i]}
                                    fill={COLORS[i]}
                                    fillOpacity={brand === 'Prestige' ? 0.4 : 0.15}
                                    strokeWidth={brand === 'Prestige' ? 2 : 1}
                                />
                            ))}
                            <Legend />
                        </RadarChart>
                    </ResponsiveContainer>
                )}

                {viewMode === 'head2head' && (
                    <div className="h-full flex items-center justify-center">
                        <div className="w-full max-w-md">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Award className="text-purple-500" size={20} />
                                    <span className="font-bold text-lg text-purple-600">Prestige</span>
                                </div>
                                <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400">VS</span>
                                <div className="flex items-center gap-2">
                                    <Users className="text-orange-500" size={20} />
                                    <select 
                                        className="font-bold text-orange-600 bg-transparent border-none focus:ring-0 cursor-pointer text-lg p-0 dark:bg-slate-900"
                                        value={headToHeadData.competitorBrand}
                                        onChange={(e) => setSelectedCompetitor(e.target.value)}
                                    >
                                        {brands.filter(b => b !== 'Prestige').map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                        {brands.filter(b => b !== 'Prestige').length === 0 && (
                                            <option value="Competitor">Competitor</option>
                                        )}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {headToHeadData.metrics.map((m, i) => {
                                    const prestigeVal = parseFloat(m.prestige.replace('%', '').replace(',', ''));
                                    const compVal = parseFloat(m.competitor.replace('%', '').replace(',', ''));
                                    const prestigeWins = m.metric.includes('Issue') ? prestigeVal < compVal : prestigeVal > compVal;

                                    return (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                                            <div className={`flex-1 text-right font-semibold ${prestigeWins ? 'text-green-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                                {m.prestige}
                                                {prestigeWins && <TrendingUp className="inline ml-1" size={14} />}
                                            </div>
                                            <div className="w-24 text-center text-xs text-slate-500 font-medium">{m.metric}</div>
                                            <div className={`flex-1 font-semibold ${!prestigeWins ? 'text-green-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                                {!prestigeWins && <TrendingUp className="inline mr-1" size={14} />}
                                                {m.competitor}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrendChart;
