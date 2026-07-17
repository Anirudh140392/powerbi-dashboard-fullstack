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
import { resolveCompanyId, getActiveBrandName } from '../utils/tenant';
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
      .then(j => {
        const validBrands = (j.brands || []).filter((b: BrandDistribution) => b.brand !== 'Unknown');
        setBrands(validBrands);
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, platform, webPid]);

  if (loading) {
    return <div className="text-xs text-slate-400 py-2 px-3 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Loading distribution…</div>;
  }
  if (error) return <div className="text-xs text-rose-500 px-3 py-2">Failed: {error}</div>;
  if (brands.length === 0) return null;

  return (
    <div className="rounded-xl bg-white shadow-sm dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Star size={18} className="text-amber-500 fill-amber-500" />
          <div className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Star Distribution {category ? <>· <span className="text-slate-600 dark:text-slate-400">{category}</span></> : null}
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b-2 border-slate-300 dark:border-slate-600 bg-slate-100/50 dark:bg-slate-800/50">
              <th className="py-3 px-5 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r-2 border-slate-300 dark:border-slate-600 w-1/4">
                Brand
              </th>
              {[1, 2, 3, 4, 5].map(star => (
                <th key={star} className="py-3 px-2 text-center text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r-2 border-slate-300 dark:border-slate-600 last:border-r-0 w-[15%]">
                  <div className="flex items-center justify-center gap-1">
                    {star} <Star size={12} className="text-slate-400 fill-current" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {brands.slice(0, 10).map((b) => {
              const dist = b.distribution;
              const maxPct = Math.max(...dist.map(d => d.pct), 1);
              return (
                <tr key={b.brand} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                  <td className="py-3 px-5 border-r-2 border-slate-300 dark:border-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                        {b.brand === 'Prestige' && <span title="Your Brand">👑</span>}
                        <span className="truncate">{b.brand === 'Prestige' ? getActiveBrandName() : b.brand}</span>
                        {b.is_competitor && b.brand !== 'Prestige' && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded shrink-0 leading-none">C</span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 whitespace-nowrap bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded">
                        {b.total >= 1000 ? `${(b.total / 1000).toFixed(1)}K` : b.total} <span className="opacity-70">ratings</span>
                      </div>
                    </div>
                  </td>
                  {dist.map((d) => (
                    <td key={d.star} className="p-0 border-r-2 border-slate-300 dark:border-slate-600 last:border-r-0 relative h-14">
                      <div className="absolute inset-x-2 inset-y-2 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800/60 shadow-inner">
                        <div
                          className="absolute top-0 bottom-0 left-0 transition-all"
                          style={{
                            width: `${(d.pct / maxPct) * 100}%`,
                            backgroundColor: STAR_COLORS[d.star - 1],
                            opacity: 0.9
                          }}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)] dark:drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                          {d.pct > 0 ? (
                            <>
                              <span className="text-xs font-bold text-slate-900 dark:text-white leading-none mb-0.5">{d.pct}%</span>
                              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 leading-none">
                                {d.count.toLocaleString()}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-slate-400 opacity-60">-</span>
                          )}
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
