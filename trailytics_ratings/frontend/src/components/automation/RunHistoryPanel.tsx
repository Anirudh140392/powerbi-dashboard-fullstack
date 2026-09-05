import { Loader2, AlertCircle, History } from 'lucide-react';
import { useAutomationRuns } from '../../hooks/useAutomation';
import { StatusBadge } from './StatusBadge';

function fmt(ts: string | null): string {
  return ts ? new Date(ts).toLocaleString() : '—';
}

export function RunHistoryPanel() {
  const { data, loading, error } = useAutomationRuns();
  const runs = data?.runs || [];

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
        <History size={16} className="text-indigo-500" />
        <h2 className="font-semibold text-slate-700 dark:text-slate-200">Pipeline run history</h2>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 p-6 text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading runs…
        </div>
      )}
      {error && !loading && (
        <div className="flex items-center gap-2 text-rose-500 p-6 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {!loading && !error && runs.length === 0 && (
        <div className="p-8 text-center text-slate-400 text-sm">No pipeline runs yet.</div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="text-left p-3">Started</th>
                <th className="text-left p-3">Trigger</th>
                <th className="text-left p-3">Sync</th>
                <th className="text-left p-3">ML</th>
                <th className="text-left p-3">Alerts</th>
                <th className="text-left p-3">Overall</th>
                <th className="text-left p-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmt(r.started_at)}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 capitalize">{r.trigger_type}</td>
                  <td className="p-3"><StatusBadge status={r.sync_status} /></td>
                  <td className="p-3"><StatusBadge status={r.ml_status} /></td>
                  <td className="p-3"><StatusBadge status={r.alert_status} /></td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmt(r.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
