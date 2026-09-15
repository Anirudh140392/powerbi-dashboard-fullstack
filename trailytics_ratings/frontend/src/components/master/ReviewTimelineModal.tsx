/**
 * Review timeline modal for a single SKU.
 *
 * Two-pane layout:
 *   - Top: monthly aggregation chart (count bars + rating trend line)
 *   - Bottom: chronological list of reviews, color-coded by sentiment,
 *             showing rating, title, text, date
 *
 * Backed by GET /api/ratings/review-timeline?web_pid=…. Limited to last
 * 365 days × 2000 reviews to keep payload sane.
 */
import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, MessageSquare } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { resolveCompanyId, resolveDbName } from '../../utils/tenant';
import { buildAuthHeaders } from '../../utils/auth';

interface Review {
  id: string;
  rating: number | null;
  sentiment: string | null;
  review_date: string | null;
  review_title: string | null;
  review_text: string | null;
  specific_issue: string | null;
  sentiment_category: string | null;
  platform: string;
}
interface MonthlyPoint { month: string; count: number; avg_rating: number | null; neg_pct: number; pos_pct: number }
interface TimelineData { web_pid: string; total: number; monthly: MonthlyPoint[]; reviews: Review[] }

interface Props {
  webPid: string;
  productName: string;
  platform?: string;
  onClose: () => void;
}

export function ReviewTimelineModal({ webPid, productName, platform, onClose }: Props) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'Negative' | 'Positive' | 'Neutral'>('all');

  useEffect(() => {
    const companyId = resolveCompanyId();
    const backendUrl = (import.meta.env.VITE_RATINGS_API_URL || import.meta.env.VITE_API_URL) || import.meta.env.VITE_RAILWAY_URL || '';
    const params = new URLSearchParams({ company_id: companyId, web_pid: webPid });
    const dbName = resolveDbName();
    if (dbName) params.set('db_name', dbName);
    if (platform) params.set('platform', platform);
    setLoading(true);
    fetch(`${backendUrl}/api/ratings/review-timeline?${params.toString()}`, {
      headers: buildAuthHeaders({}, companyId),
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { setData(j); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [webPid, platform]);

  const reviews = data?.reviews.slice().reverse() || [];
  const filtered = filter === 'all' ? reviews : reviews.filter(r => r.sentiment === filter);

  const sentimentColor = (s: string | null) =>
    s === 'Positive' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
    : s === 'Negative' ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20'
    : 'border-slate-300 bg-slate-50 dark:bg-slate-800/50';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1300] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-4xl w-full max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare size={12} /> Review timeline
            </div>
            <div className="text-lg font-bold text-slate-800 dark:text-white mt-0.5 truncate">{productName}</div>
            <div className="text-xs text-slate-500 mt-1 font-mono">{webPid}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
              <Loader2 size={20} className="animate-spin" /> Loading timeline…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-rose-500 py-4 justify-center">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Monthly chart */}
              {data.monthly.length > 1 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Monthly volume + rating ({data.total.toLocaleString()} reviews in last 12 mo)
                  </div>
                  <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                      <ComposedChart data={data.monthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" domain={[1, 5]} tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: 'none', fontSize: 12, borderRadius: 6 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#f1f5f9' }} />
                        <Bar yAxisId="left" dataKey="count" fill="#6366f1" name="Reviews" />
                        <Line yAxisId="right" type="monotone" dataKey="avg_rating" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} name="Avg rating" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-semibold">Filter:</span>
                {(['all', 'Negative', 'Positive', 'Neutral'] as const).map(f => (
                  <button
                    key={f} onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 rounded-md font-medium ${
                      filter === f
                        ? f === 'Negative' ? 'bg-rose-500 text-white'
                          : f === 'Positive' ? 'bg-emerald-500 text-white'
                          : f === 'Neutral' ? 'bg-slate-500 text-white'
                          : 'bg-indigo-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'all' ? `All (${reviews.length})` : `${f} (${reviews.filter(r => r.sentiment === f).length})`}
                  </button>
                ))}
              </div>

              {/* Chronological list */}
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {filtered.map(r => (
                  <div key={r.id} className={`border-l-4 ${sentimentColor(r.sentiment)} rounded p-3`}>
                    <div className="flex items-center gap-2 text-xs mb-1 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {r.rating != null ? `${r.rating}★` : '—'}
                      </span>
                      {r.sentiment && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                          r.sentiment === 'Positive' ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : r.sentiment === 'Negative' ? 'bg-rose-200 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>{r.sentiment}</span>
                      )}
                      {r.specific_issue && (
                        <span className="text-[10px] italic text-slate-500">{r.specific_issue.replace(/_/g, ' ')}</span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto capitalize">{r.platform} · {r.review_date ? new Date(r.review_date).toLocaleDateString() : '—'}</span>
                    </div>
                    {r.review_title && <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-0.5">{r.review_title}</div>}
                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">{r.review_text}</div>
                  </div>
                ))}
                {filtered.length === 0 && <div className="text-xs text-slate-400 italic py-4 text-center">No reviews match this filter.</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
