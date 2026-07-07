/**
 * Full-text review search panel — investigation tool for product / QA teams.
 *
 * Used on the Review Explorer tab. Lets users grep "handle broke", "stopped
 * working", "fake product" etc. across the entire 567K-review corpus with
 * filters (platform, brand scope, date range, rating range, sentiment).
 *
 * Backed by GET /api/ratings/reviews/search which ILIKEs review_text +
 * review_title + product_name.
 */
import { useState } from 'react';
import { Search, Loader2, Filter, X } from 'lucide-react';
import { resolveCompanyId } from '../utils/tenant';
import { buildAuthHeaders } from '../utils/auth';
import { RATINGS_API_BASE } from '../config/apiBase';

interface SearchResult {
  id: string;
  web_pid: string;
  product_name: string;
  brand: string;
  platform: string;
  rating: number | null;
  review_title: string | null;
  review_text: string | null;
  review_date: string | null;
  sentiment: string | null;
  specific_issue: string | null;
  is_competitor: boolean;
}

export function ReviewSearchPanel() {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({
    brand_scope: 'all' as 'all' | 'prestige' | 'competition',
    platform: 'all',
    sentiment: '',
    rating_min: '',
    rating_max: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (q.trim().length < 2) {
      setError('Type at least 2 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const companyId = resolveCompanyId();
      const backendUrl = RATINGS_API_BASE;
      const params = new URLSearchParams({ company_id: companyId, q, limit: '100' });
      if (filters.brand_scope !== 'all') params.set('brand_scope', filters.brand_scope);
      if (filters.platform !== 'all') params.set('platform', filters.platform);
      if (filters.sentiment) params.set('sentiment', filters.sentiment);
      if (filters.rating_min) params.set('rating_min', filters.rating_min);
      if (filters.rating_max) params.set('rating_max', filters.rating_max);
      const res = await fetch(`${backendUrl}/api/ratings/reviews/search?${params.toString()}`, {
        headers: buildAuthHeaders({}, companyId),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResults(data.results || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const highlight = (text: string | null) => {
    if (!text) return '';
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text.slice(0, 200);
    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + q.length + 100);
    const before = (start > 0 ? '…' : '') + text.slice(start, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length, end) + (end < text.length ? '…' : '');
    return (
      <>
        {before}<mark className="bg-yellow-200 dark:bg-yellow-700/60 rounded px-0.5">{match}</mark>{after}
      </>
    );
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5 mb-4">
      <form onSubmit={runSearch} className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={q} onChange={e => setQ(e.target.value)}
            placeholder='Search across all reviews — e.g. "handle broke", "stopped working"'
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white"
          />
        </div>
        <button
          type="button" onClick={() => setShowFilters(s => !s)}
          className="px-3 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
        ><Filter size={14} /></button>
        <button
          type="submit" disabled={loading || q.trim().length < 2}
          className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 px-5 py-2.5 rounded-xl font-semibold text-sm active:scale-95 inline-flex items-center gap-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </form>

      {showFilters && (
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl flex flex-wrap gap-3 items-center text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400">Scope:</span>
            <select value={filters.brand_scope} onChange={e => setFilters({...filters, brand_scope: e.target.value as never})}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1">
              <option value="all">All brands</option>
              <option value="prestige">Prestige only</option>
              <option value="competition">Competitors only</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400">Platform:</span>
            <select value={filters.platform} onChange={e => setFilters({...filters, platform: e.target.value})}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1">
              <option value="all">All</option>
              <option value="amazon">Amazon</option>
              <option value="flipkart">Flipkart</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400">Sentiment:</span>
            <select value={filters.sentiment} onChange={e => setFilters({...filters, sentiment: e.target.value})}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1">
              <option value="">Any</option>
              <option value="Positive">Positive</option>
              <option value="Negative">Negative</option>
              <option value="Neutral">Neutral</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400">Rating:</span>
            <input type="number" min={1} max={5} step={0.5} value={filters.rating_min}
                   onChange={e => setFilters({...filters, rating_min: e.target.value})}
                   placeholder="min" className="w-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1" />
            <span className="text-slate-500">–</span>
            <input type="number" min={1} max={5} step={0.5} value={filters.rating_max}
                   onChange={e => setFilters({...filters, rating_max: e.target.value})}
                   placeholder="max" className="w-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1" />
          </label>
          {(filters.brand_scope !== 'all' || filters.platform !== 'all' || filters.sentiment || filters.rating_min || filters.rating_max) && (
            <button type="button" onClick={() => setFilters({ brand_scope: 'all', platform: 'all', sentiment: '', rating_min: '', rating_max: '' })}
                    className="ml-auto inline-flex items-center gap-1 text-rose-500">
              <X size={12} /> Clear
            </button>
          )}
        </div>
      )}

      {error && <div className="mt-3 text-rose-500 text-xs">{error}</div>}

      {!loading && results.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            <strong>{total.toLocaleString()}</strong> matches for "<strong className="text-slate-800 dark:text-slate-200">{q}</strong>" — showing top {results.length}
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {results.map(r => (
              <div key={r.id} className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide
                    ${r.sentiment === 'Positive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : r.sentiment === 'Negative' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300'}`}>
                    {r.sentiment || '—'}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{r.rating != null ? `${r.rating}★` : '—'}</span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">{r.brand || '—'}</span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-500 capitalize">{r.platform}</span>
                  {r.is_competitor && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">COMP</span>}
                  {r.specific_issue && <span className="text-[10px] text-slate-500 italic">{r.specific_issue.replace(/_/g, ' ')}</span>}
                  {r.review_date && <span className="ml-auto text-[10px] text-slate-400">{new Date(r.review_date).toLocaleDateString()}</span>}
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 mb-1 line-clamp-1 font-medium">
                  {r.product_name}
                </div>
                {r.review_title && <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{r.review_title}</div>}
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{highlight(r.review_text)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && q && results.length === 0 && !error && (
        <div className="mt-4 text-sm text-slate-400 italic">No reviews match "{q}".</div>
      )}
    </section>
  );
}
