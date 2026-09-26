import { Activity, CheckCircle2, XCircle, Clock, AlertTriangle, MinusCircle } from 'lucide-react';
import type { RunStatus } from '../../types/automation';

const STYLES: Record<string, { cls: string; icon: typeof Activity }> = {
  RUNNING: { cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800', icon: Activity },
  COMPLETED: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800', icon: CheckCircle2 },
  FAILED: { cls: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800', icon: XCircle },
  PARTIAL: { cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800', icon: AlertTriangle },
  PENDING: { cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', icon: Clock },
  SKIPPED: { cls: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', icon: MinusCircle },
  active: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800', icon: CheckCircle2 },
  paused: { cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800', icon: Clock },
  unreachable: { cls: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800', icon: XCircle },
};

export function StatusBadge({ status, label }: { status: RunStatus | string | null; label?: string }) {
  const key = status || 'PENDING';
  const style = STYLES[key] || STYLES.PENDING;
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.cls}`}>
      <Icon size={12} className={key === 'RUNNING' ? 'animate-pulse' : ''} />
      {label || String(key)}
    </span>
  );
}
