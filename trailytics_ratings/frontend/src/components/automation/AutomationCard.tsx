import { ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Static accent classes — Tailwind's JIT can't see interpolated class names.
const ACCENTS: Record<string, string> = {
  indigo: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  purple: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  cyan: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  rose: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
  slate: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
};

export interface AutomationCardData {
  title: string;
  blurb: string;
  kind: 'ML' | 'Regex / rules' | 'Data sync' | 'Alerting';
  icon: LucideIcon;
  accent: keyof typeof ACCENTS;
  /** Where "Open" navigates. Internal path or '#' for none. */
  href?: string;
  /** Optional status note rendered as a small pill (e.g. 'Read-only', 'localStorage only'). */
  note?: string;
  noteTone?: 'warn' | 'info';
}

export function AutomationCard({ data }: { data: AutomationCardData }) {
  const Icon = data.icon;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5 flex flex-col hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2.5 rounded-lg group-hover:scale-110 transition-transform ${ACCENTS[data.accent] || ACCENTS.slate}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm leading-tight truncate">{data.title}</h3>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{data.kind}</span>
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400/90 mb-4 flex-1 leading-relaxed">{data.blurb}</p>
      <div className="flex items-center justify-between gap-2">
        {data.note ? (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              data.noteTone === 'warn'
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
                : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700'
            }`}
          >
            {data.note}
          </span>
        ) : (
          <span />
        )}
        {data.href && data.href !== '#' && (
          <button
            onClick={() => window.location.assign(data.href!)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 inline-flex items-center gap-1"
          >
            Open <ExternalLink size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
