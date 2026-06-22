import React, { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { resolveCompanyId } from '../../utils/tenant';
import { authenticatedFetch } from '../../utils/auth';

interface TrendPoint {
    date: string;
    platform: string;
    rating: number | null;
    rating_count: number | null;
    review_count: number | null;
    price_rp: number | null;
    price_sp: number | null;
}

interface Props {
    webPid: string;
    productName: string;
    platform?: string;
    onClose: () => void;
}

const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}`;
};

export const RatingTrendModal: React.FC<Props> = ({ webPid, productName, platform, onClose }) => {
    const [points, setPoints] = useState<TrendPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true); setError(null);
            try {
                const companyId = resolveCompanyId();
                const url = `${import.meta.env.VITE_API_URL || ''}/api/ratings/rating-trend?company_id=${companyId}&web_pid=${encodeURIComponent(webPid)}${platform && platform !== 'all' ? `&platform=${encodeURIComponent(platform)}` : ''}`;
                const res = await authenticatedFetch(url, {}, companyId);
                if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
                const json = await res.json();
                if (!cancelled) setPoints(json.points || []);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [webPid, platform]);

    // Group points by platform for multi-line if no specific platform was requested
    const byPlatform = new Map<string, TrendPoint[]>();
    for (const p of points) {
        if (!byPlatform.has(p.platform)) byPlatform.set(p.platform, []);
        byPlatform.get(p.platform)!.push(p);
    }
    // For a unified chart x-axis: pivot to one row per date with platform-keyed rating fields.
    const allDates = Array.from(new Set(points.map(p => p.date))).sort();
    const chartData = allDates.map(date => {
        const row: Record<string, unknown> = { date, label: formatDate(date) };
        for (const [plat, list] of byPlatform) {
            const pt = list.find(x => x.date === date);
            row[`rating_${plat}`] = pt?.rating ?? null;
        }
        return row;
    });
    const platformList = Array.from(byPlatform.keys()).sort();
    const platformColors: Record<string, string> = {
        amazon: '#f59e0b', flipkart: '#3b82f6', blinkit: '#10b981',
        zepto: '#a855f7', instamart: '#ec4899',
    };

    const latestPoint = points[points.length - 1];
    const earliestPoint = points[0];
    const delta = latestPoint && earliestPoint && latestPoint.rating != null && earliestPoint.rating != null
        ? latestPoint.rating - earliestPoint.rating
        : null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60 max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start gap-4">
                    <div className="min-w-0">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                            <TrendingUp size={18} className="text-indigo-500" />
                            Rating trend
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{productName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{webPid}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 p-6 overflow-auto">
                    {loading && (
                        <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
                            <Loader2 size={18} className="animate-spin" /> Loading trend…
                        </div>
                    )}
                    {error && !loading && (
                        <div className="flex items-center gap-2 text-rose-500 py-10 justify-center text-sm">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}
                    {!loading && !error && points.length === 0 && (
                        <div className="py-10 text-center text-slate-400 text-sm">
                            No snapshot history for this product yet. Daily snapshots start accumulating once the scheduled sync runs.
                        </div>
                    )}
                    {!loading && !error && points.length === 1 && (
                        <div className="py-6 text-center text-sm">
                            <div className="text-slate-500 mb-2">Only one snapshot so far — a trend appears after 2+ days of sync data.</div>
                            <div className="inline-block px-4 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
                                {points[0].platform} · rating {points[0].rating ?? '—'} · {points[0].rating_count ?? 0} ratings · {formatDate(points[0].date)}
                            </div>
                        </div>
                    )}
                    {!loading && !error && points.length >= 2 && (
                        <>
                            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <div className="text-xs text-slate-500 mb-1">Latest</div>
                                    <div className="font-bold text-slate-800 dark:text-white">
                                        {latestPoint?.rating != null ? latestPoint.rating.toFixed(2) : '—'} ★
                                    </div>
                                    <div className="text-[10px] text-slate-400">{latestPoint && formatDate(latestPoint.date)} · {latestPoint?.platform}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <div className="text-xs text-slate-500 mb-1">Earliest</div>
                                    <div className="font-bold text-slate-800 dark:text-white">
                                        {earliestPoint?.rating != null ? earliestPoint.rating.toFixed(2) : '—'} ★
                                    </div>
                                    <div className="text-[10px] text-slate-400">{earliestPoint && formatDate(earliestPoint.date)}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <div className="text-xs text-slate-500 mb-1">Δ</div>
                                    <div className={`font-bold ${delta == null ? 'text-slate-400' : delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                                        {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`}
                                    </div>
                                    <div className="text-[10px] text-slate-400">over period</div>
                                </div>
                            </div>

                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                                        <XAxis dataKey="label" fontSize={11} stroke="#94a3b8" />
                                        <YAxis domain={[1, 5]} fontSize={11} stroke="#94a3b8" tickFormatter={(v) => v.toFixed(1)} />
                                        <Tooltip
                                            contentStyle={{ background: 'rgba(15,23,42,0.95)', border: 'none', borderRadius: 8, fontSize: 12 }}
                                            labelStyle={{ color: '#cbd5e1' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <ReferenceLine y={4.0} stroke="#94a3b8" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '4.0', fill: '#94a3b8', fontSize: 10, position: 'right' }} />
                                        {platformList.map(plat => (
                                            <Line
                                                key={plat}
                                                type="monotone"
                                                dataKey={`rating_${plat}`}
                                                name={plat}
                                                stroke={platformColors[plat] || '#6366f1'}
                                                strokeWidth={2}
                                                dot={{ r: 3 }}
                                                connectNulls
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                                {platformList.map(plat => (
                                    <span key={plat} className="inline-flex items-center gap-1.5">
                                        <span className="w-3 h-0.5" style={{ background: platformColors[plat] || '#6366f1' }} />
                                        {plat}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
