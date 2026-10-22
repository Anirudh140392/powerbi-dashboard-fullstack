import { Loader2, AlertCircle, Bell, Mail, MailX } from 'lucide-react';
import { useAlertEvents } from '../../hooks/useAutomation';

function fmt(ts: string): string {
  return new Date(ts).toLocaleString();
}

const REASON_LABEL: Record<string, string> = {
  absolute_floor: 'Below floor',
  drop_delta: 'Dropped',
  both: 'Floor + drop',
};

export function AlertEventsList() {
  const { data, loading, error } = useAlertEvents();
  const events = data?.events || [];

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
        <Bell size={16} className="text-rose-500" />
        <h2 className="font-semibold text-slate-700 dark:text-slate-200">Recent alert events</h2>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 p-6 text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading events…
        </div>
      )}
      {error && !loading && (
        <div className="flex items-center gap-2 text-rose-500 p-6 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {!loading && !error && events.length === 0 && (
        <div className="p-8 text-center text-slate-400 text-sm">No alerts have fired yet.</div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="text-left p-3">Triggered</th>
                <th className="text-left p-3">Product / scope</th>
                <th className="text-left p-3">Platform</th>
                <th className="text-center p-3">Prev</th>
                <th className="text-center p-3">Now</th>
                <th className="text-center p-3">Δ</th>
                <th className="text-left p-3">Reason</th>
                <th className="text-center p-3">Email</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmt(e.triggered_at)}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-200 max-w-[260px] truncate" title={e.product_name || e.scope_value || ''}>
                    {e.product_name || e.scope_value || e.web_pid || '—'}
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{e.platform || '—'}</td>
                  <td className="p-3 text-center text-slate-500 dark:text-slate-400">{e.previous_rating ?? '—'}</td>
                  <td className="p-3 text-center font-bold text-rose-600 dark:text-rose-400">{e.current_rating ?? '—'}</td>
                  <td className="p-3 text-center text-slate-500 dark:text-slate-400">{e.delta != null ? `-${e.delta}` : '—'}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{REASON_LABEL[e.reason] || e.reason}</td>
                  <td className="p-3 text-center">
                    {e.email_sent ? (
                      <Mail size={15} className="text-emerald-500 inline" />
                    ) : (
                      <MailX size={15} className="text-slate-400 inline" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
