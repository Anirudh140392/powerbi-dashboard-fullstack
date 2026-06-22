/**
 * Price variance strip — shows median MRP per brand in the selected category,
 * with the % delta vs Prestige's median (red = pricier, green = cheaper).
 *
 * Renders above the brand chips on the Competitor Insights tab so users see
 * "this brand sells at -22% / +14% of Prestige" at a glance — the simplest
 * pricing-intelligence surface that uses the data we already have.
 *
 * Backed by GET /api/ratings/price-variance?category=...&platform=...
 */
import { useEffect, useState } from 'react';
import { IndianRupee, Loader2, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { resolveCompanyId } from '../utils/tenant';
import { buildAuthHeaders } from '../utils/auth';

interface VarianceRow {
  brand: string;
  is_competitor: boolean;
  category: string;
  sku_count: number;
  median_price: number;
  min_price: number;
  max_price: number;
  avg_price: number;
  prestige_median: number | null;
  pct_vs_prestige: number | null;
}

interface Props {
  category?: string;
  platform?: string;
  visibleBrands?: string[];
}

function fmt(raw: number | string | null | undefined) {
  if (raw == null) return '—';
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

export function PriceVarianceStrip({ category, platform, visibleBrands }: Props) {
  const [rows, setRows] = useState<VarianceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!category) { setRows([]); return; }
    const companyId = resolveCompanyId();
    const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_RAILWAY_URL || '';
    const params = new URLSearchParams({ company_id: companyId, category });
    if (platform && platform !== 'all') params.set('platform', platform);
    setLoading(true);
    fetch(`${backendUrl}/api/ratings/price-variance?${params.toString()}`, {
      headers: buildAuthHeaders({}, companyId),
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { setRows(j.rows || []); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, platform]);

  if (!category) return null;

  const filtered = visibleBrands && visibleBrands.length > 0
    ? rows.filter(r => visibleBrands.includes(r.brand))
    : rows;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-2 px-3">
        <Loader2 size={12} className="animate-spin" /> Loading prices…
      </div>
    );
  }
  if (error) {
    return <div className="text-xs text-rose-500 px-3 py-2">Price data failed: {error}</div>;
  }
  if (filtered.length === 0) return null;

  // Sort: Prestige first, then by median_price ascending
  const sorted = filtered.slice().sort((a, b) => {
    if (a.brand === 'Prestige') return -1;
    if (b.brand === 'Prestige') return 1;
    return a.median_price - b.median_price;
  });

  return (
    <div className="mb-4 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3">
      <div className="flex items-center gap-2 mb-2">
        <IndianRupee size={14} className="text-emerald-500" />
        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          Pricing in <span className="text-slate-800 dark:text-white">{category}</span>
          {platform && platform !== 'all' ? <span className="text-slate-400"> · {platform}</span> : null}
        </div>
        <div className="text-[10px] text-slate-400 italic">median MRP · Δ vs Prestige</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {sorted.map(r => {
          const isPrestige = r.brand === 'Prestige';
          // pg numeric → string over the wire; coerce or .toFixed crashes
          const pct = r.pct_vs_prestige == null ? null : Number(r.pct_vs_prestige);
          const dir = pct == null || Number.isNaN(pct) ? 'neutral' : pct < -5 ? 'cheaper' : pct > 5 ? 'pricier' : 'on-par';
          const bg = isPrestige
            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800/60'
            : dir === 'cheaper'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/60'
              : dir === 'pricier'
                ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/60'
                : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600';
          return (
            <div key={r.brand} className={`px-3 py-2 rounded-lg border ${bg} min-w-[120px]`}>
              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate flex items-center gap-1">
                {isPrestige ? '👑 ' : ''}{r.brand}
                <span className="text-[9px] text-slate-400 font-normal ml-auto">{r.sku_count} SKUs</span>
              </div>
              <div className="text-base font-extrabold text-slate-800 dark:text-white mt-0.5">
                {fmt(r.median_price)}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {fmt(r.min_price)} – {fmt(r.max_price)}
              </div>
              {!isPrestige && pct != null && (
                <div className={`text-[10px] font-bold mt-1 inline-flex items-center gap-0.5 ${
                  dir === 'cheaper' ? 'text-emerald-600 dark:text-emerald-400'
                  : dir === 'pricier' ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500'
                }`}>
                  {dir === 'cheaper' ? <ArrowDownRight size={10} /> : dir === 'pricier' ? <ArrowUpRight size={10} /> : <Minus size={10} />}
                  {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
