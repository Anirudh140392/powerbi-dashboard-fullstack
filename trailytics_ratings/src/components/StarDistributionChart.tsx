/**
 * Star distribution comparison chart — 1★ / 2★ / 3★ / 4★ / 5★ bars per brand
 * in a category. Surfaces the bimodal-rating problem ("4.0★ avg but 30% are
 * 1★") that a single avg-rating number hides.
 *
 * Renders on Competitor Insights below the price strip when a category is
 * selected. Backed by GET /api/ratings/star-distribution.
 */
import { useEffect, useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { resolveCompanyId } from '../utils/tenant';
import { buildAuthHeaders } from '../utils/auth';

interface BrandDistribution {
  brand: string;
  is_competitor: boolean;
  total: number;
  distribution: { star: number; count: number; pct: number }[];
}

interface Props {
  category?: string;
  platform?: string;
  webPid?: string;
}

const STAR_COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#84cc16', '#16a34a']; // 1★ red → 5★ green

export function StarDistributionChart({ category, platform, webPid }: Props) {
  const [brands, setBrands] = useState<BrandDistribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!category && !webPid) { setBrands([]); return; }
    const companyId = resolveCompanyId();
    const backendUrl = (import.meta.env.VITE_RATINGS_API_URL || import.meta.env.VITE_API_URL) || import.meta.env.VITE_RAILWAY_URL || '';
    const params = new URLSearchParams({ company_id: companyId });
    if (category) params.set('category', category);
    if (platform && platform !== 'all') params.set('platform', platform);
    if (webPid) params.set('web_pid', webPid);
    setLoading(true);
    fetch(`${backendUrl}/api/ratings/star-distribution?${params.toString()}`, {
      headers: buildAuthHeaders({}, companyId),
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { setBrands(j.brands || []); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, platform, webPid]);

  if (loading) {
    return <div className="text-xs text-slate-400 py-2 px-3 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Loading distribution…</div>;
  }
  if (error) return <div className="text-xs text-rose-500 px-3 py-2">Failed: {error}</div>;
  if (brands.length === 0) return null;

  return (
    <div className="rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Star size={14} className="text-amber-500 fill-amber-500" />
        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          Star distribution {category ? <>· <span className="text-slate-800 dark:text-white">{category}</span></> : null}
        </div>
      </div>

      <div className="space-y-2">
        {brands.slice(0, 10).map(b => {
          const dist = b.distribution;
          const maxPct = Math.max(...dist.map(d => d.pct), 1);
          return (
            <div key={b.brand} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-2 flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                {b.brand === 'Prestige' && <span>👑</span>}
                <span className="truncate">{b.brand}</span>
                {b.is_competitor && b.brand !== 'Prestige' && <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1 rounded shrink-0">C</span>}
              </div>
              <div className="col-span-9 flex items-center gap-1 h-7">
                {dist.map((d) => (
                  <div key={d.star} className="flex-1 h-full bg-slate-100 dark:bg-slate-700/60 rounded relative overflow-hidden group">
                    <div
                      className="absolute bottom-0 left-0 right-0 transition-all"
                      style={{
                        height: `${Math.max(2, (d.pct / maxPct) * 100)}%`,
                        backgroundColor: STAR_COLORS[d.star - 1],
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white mix-blend-difference">
                      {d.pct > 5 ? `${d.pct}%` : ''}
                    </div>
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] bg-slate-900 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {d.star}★ · {d.count.toLocaleString()} ({d.pct}%)
                    </div>
                  </div>
                ))}
              </div>
              <div className="col-span-1 text-right text-[10px] text-slate-500 tabular-nums">
                {b.total >= 1000 ? `${(b.total / 1000).toFixed(1)}K` : b.total}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block rounded" style={{background: STAR_COLORS[0]}}></span>1★</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block rounded" style={{background: STAR_COLORS[1]}}></span>2★</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block rounded" style={{background: STAR_COLORS[2]}}></span>3★</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block rounded" style={{background: STAR_COLORS[3]}}></span>4★</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block rounded" style={{background: STAR_COLORS[4]}}></span>5★</span>
        <span className="ml-auto italic">Hover bars for counts</span>
      </div>
    </div>
  );
}
