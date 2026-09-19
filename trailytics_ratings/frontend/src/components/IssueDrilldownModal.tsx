/**
 * Theme / issue drill-down modal.
 *
 * Opened by clicking a card on the Categories tab. Shows everything related
 * to that issue category in one focused view:
 *   - Top 20 affected Prestige SKUs (with review count + avg rating + negative count)
 *   - Brand breakdown (Prestige vs each competitor, with review count + avg rating)
 *   - Monthly trend chart (last 12 months)
 *   - 8 most-recent negative verbatims
 *   - Suggested owner team
 *
 * Backed by GET /api/ratings/issue/:name/drilldown.
 */
import { useEffect, useState } from 'react';
import { X, Users, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { resolveCompanyId, getActiveBrandName, resolveDbName } from '../utils/tenant';
import { buildAuthHeaders } from '../utils/auth';

interface DrilldownData {
  issue: string;
  suggestedTeam: string;
  topSkus: Array<{ web_pid: string; product_name: string; brand: string; platform: string; reviews: string; avg_rating: string; neg: string }>;
  brandBreakdown: Array<{ brand: string; is_competitor: boolean; reviews: string; avg_rating: string }>;
  monthlyTrend: Array<{ month: string; reviews: string; avg_rating: string }>;
  sampleVerbatims: Array<{ review_text: string; rating: number; review_date: string; brand: string; web_pid: string; product_name: string }>;
}

export function IssueDrilldownModal({ issue, onClose }: { issue: string; onClose: () => void }) {
  const [data, setData] = useState<DrilldownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const companyId = resolveCompanyId();
    const backendUrl = (import.meta.env.VITE_RATINGS_API_URL || import.meta.env.VITE_API_URL) || import.meta.env.VITE_RAILWAY_URL || '';
    const params = new URLSearchParams({ company_id: companyId });
    const dbName = resolveDbName();
    if (dbName) params.set('db_name', dbName);
    setLoading(true);
    fetch(`${backendUrl}/api/ratings/issue/${encodeURIComponent(issue)}/drilldown?${params.toString()}`, {
      headers: buildAuthHeaders({}, companyId),
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { setData(j); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [issue]);

  const total = data ? data.topSkus.reduce((s, r) => s + parseInt(r.reviews, 10), 0) : 0;
  const totalNeg = data ? data.topSkus.reduce((s, r) => s + parseInt(r.neg, 10), 0) : 0;
  const trendChart = data?.monthlyTrend
    ?.slice()
    .reverse()
    .map(r => ({ month: r.month.slice(0, 7), rating: Number(r.avg_rating), reviews: parseInt(r.reviews, 10) }));

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1300] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-5xl w-full max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Issue drill-down</div>
            <div className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">{issue.replace(/_/g, ' ')}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
              <Loader2 size={20} className="animate-spin" /> Loading drill-down…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-rose-500 py-4 justify-center">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total reviews</div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{total.toLocaleString()}</div>
                </div>
                <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3 border border-rose-200 dark:border-rose-800/50">
                  <div className="text-[10px] uppercase tracking-wider text-rose-700 dark:text-rose-300 font-semibold">Negative</div>
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{totalNeg.toLocaleString()}</div>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 border border-indigo-200 dark:border-indigo-800/50">
                  <div className="text-[10px] uppercase tracking-wider text-indigo-700 dark:text-indigo-300 font-semibold">Affected SKUs</div>
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{data.topSkus.length}</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800/50 flex flex-col">
                  <div className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1"><Users size={10} /> Owner</div>
                  <div className="text-base font-bold text-amber-700 dark:text-amber-400 mt-1.5">{data.suggestedTeam}</div>
                </div>
              </div>

              {/* Trend chart */}
              {trendChart && trendChart.length > 1 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">12-month trend</div>
                  <div style={{ width: '100%', height: 140 }}>
                    <ResponsiveContainer>
                      <LineChart data={trendChart}>
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={[1, 5]} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: 'none', fontSize: 12, borderRadius: 6 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#f1f5f9' }} />
                        <Line type="monotone" dataKey="rating" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3, fill: '#7c3aed' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Two-column: brand breakdown + top SKUs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">Brand breakdown</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-1.5">Brand</th>
                        <th className="py-1.5 text-right">Reviews</th>
                        <th className="py-1.5 text-right">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {data.brandBreakdown.map((b, i) => (
                        <tr key={i}>
                          <td className="py-1.5 font-medium text-slate-700 dark:text-slate-300">
                            {b.brand}{b.is_competitor ? <span className="ml-1.5 text-[8px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">COMP</span> : ''}
                          </td>
                          <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{parseInt(b.reviews, 10).toLocaleString()}</td>
                          <td className="py-1.5 text-right text-slate-800 dark:text-slate-200 font-semibold">{Number(b.avg_rating).toFixed(2)}★</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">Top affected {getActiveBrandName()} SKUs</div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {data.topSkus.map((s, i) => (
                      <a key={i}
                        href={`/?tab=master&web_pid=${encodeURIComponent(s.web_pid)}`}
                        className="block px-2 py-1.5 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors text-xs text-slate-700 dark:text-slate-300"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex-1 truncate font-medium">{s.product_name || s.web_pid}</span>
                          <span className="text-[10px] text-slate-500 shrink-0">{s.platform}</span>
                          <span className="text-xs font-semibold tabular-nums">{Number(s.avg_rating).toFixed(1)}★</span>
                          <span className="text-[10px] text-rose-500 tabular-nums">-{s.neg}</span>
                          <ExternalLink size={10} className="text-slate-400" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sample verbatims */}
              {data.sampleVerbatims.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">Recent verbatim (negative)</div>
                  <div className="space-y-2">
                    {data.sampleVerbatims.map((q, i) => (
                      <blockquote key={i} className="border-l-2 border-rose-400 pl-3 py-1 text-xs text-slate-700 dark:text-slate-300 italic">
                        "{q.review_text.slice(0, 280)}"
                        <div className="text-[10px] text-slate-500 mt-1 not-italic">
                          {q.rating}★ · {q.brand} · {(q.product_name || q.web_pid).slice(0, 60)} · {q.review_date ? new Date(q.review_date).toLocaleDateString() : ''}
                        </div>
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
