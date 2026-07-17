import { useState } from 'react';
import { Play, Loader2, Database, Brain, Bell, CalendarClock, AlertCircle, ChevronDown, Mail } from 'lucide-react';
import { useAutomationStatus, triggerPipeline, triggerJob, triggerStage, sendTestMail } from '../../hooks/useAutomation';
import { StatusBadge } from './StatusBadge';

function fmt(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

type RunMode = 'full' | 'sync' | 'ml-bert' | 'ml-gemini' | 'ml-deberta' | 'alerts';

const RUN_MODES: { value: RunMode; label: string; hint: string }[] = [
  { value: 'full',        label: 'Full pipeline',          hint: 'Sync → ML jobs → Alerts (Temporal workflow)' },
  { value: 'sync',        label: 'Sync only',              hint: 'MySQL → Postgres (master, reviews, prices)' },
  { value: 'ml-bert',     label: 'ML: BERT Inference',     hint: 'tabularisai + ABSA + Gemini fallback' },
  { value: 'ml-gemini',   label: 'ML: Gemini Audit',       hint: 'Highest-quality structured-JSON pass' },
  { value: 'ml-deberta',  label: 'ML: DeBERTa Taxonomy',   hint: 'Zero-shot category + sentiment classifier' },
  { value: 'alerts',      label: 'Alerts only',            hint: 'Re-evaluate alert rules + dispatch emails' },
];

export function PipelineStatusHero() {
  const { data, loading, error, refetch } = useAutomationStatus();
  const [triggering, setTriggering] = useState(false);
  const [mode, setMode] = useState<RunMode>('full');
  const [menuOpen, setMenuOpen] = useState(false);
  const [testingMail, setTestingMail] = useState(false);

  const handleTestMail = async () => {
    setTestingMail(true);
    try {
      const r = await sendTestMail();
      alert(`Test alert email sent to ${r.sentTo}.\nCheck your inbox in ~30 seconds.`);
    } catch (e) {
      alert(`Test mail failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setTestingMail(false);
    }
  };

  const run = data?.lastRun;
  const schedule = data?.schedule;
  const isRunning = run?.status === 'RUNNING';

  const handleTrigger = async () => {
    setTriggering(true);
    setMenuOpen(false);
    try {
      switch (mode) {
        case 'full':
          await triggerPipeline();
          break;
        case 'sync':
          await triggerStage('sync');
          break;
        case 'ml-bert':
          await triggerJob('BERT Inference');
          break;
        case 'ml-gemini':
          await triggerJob('Gemini Audit');
          break;
        case 'ml-deberta':
          await triggerJob('DeBERTa Taxonomy');
          break;
        case 'alerts':
          await triggerStage('alerts');
          break;
      }
      setTimeout(refetch, 800);
    } catch (e) {
      alert(`Could not start: ${e instanceof Error ? e.message : e}`);
    } finally {
      setTriggering(false);
    }
  };

  const currentModeLabel = RUN_MODES.find(m => m.value === mode)?.label || 'Run';

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Daily automation pipeline</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            MySQL sync → ML backfill → rating-drop alert check, orchestrated by Temporal.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={handleTestMail}
            disabled={testingMail}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            title="Send a sample alert email to your inbox (uses real worst-rated SKU)"
          >
            {testingMail ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
            Test mail
          </button>
        <div className="shrink-0 flex items-stretch gap-0 relative">
          <button
            onClick={handleTrigger}
            disabled={triggering || isRunning}
            className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 px-4 py-2.5 rounded-l-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm active:scale-95 border-r border-indigo-700"
          >
            {triggering ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {isRunning ? 'Run in progress…' : currentModeLabel}
          </button>
          <button
            onClick={() => setMenuOpen(o => !o)}
            disabled={triggering || isRunning}
            className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 px-2.5 py-2.5 rounded-r-lg flex items-center justify-center transition-all"
            aria-label="Choose what to run"
          >
            <ChevronDown size={16} />
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 w-72 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
              {RUN_MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => { setMode(m.value); setMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                    m.value === mode ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-800 dark:text-white">{m.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{m.hint}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 py-6">
          <Loader2 size={16} className="animate-spin" /> Loading status…
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 text-rose-500 py-4 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Schedule */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <CalendarClock size={14} /> Schedule
            </div>
            <StatusBadge status={schedule?.status || 'unreachable'} />
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {schedule?.status === 'unreachable'
                ? 'Temporal cluster not reachable'
                : `Next run: ${fmt(schedule?.nextActionTimes?.[0])}`}
            </div>
          </div>

          {/* Sync */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Database size={14} /> Data ingestion
            </div>
            <StatusBadge status={run?.sync_status || 'PENDING'} />
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">Last run: {fmt(run?.started_at)}</div>
          </div>

          {/* ML */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Brain size={14} /> ML backfill
            </div>
            <StatusBadge status={run?.ml_status || 'PENDING'} />
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {data?.recentJobs?.length ? `${data.recentJobs.length} recent job(s)` : 'No recent jobs'}
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Bell size={14} /> Alert check
            </div>
            <StatusBadge status={run?.alert_status || 'PENDING'} />
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {run ? `Overall: ${run.status}` : 'No runs yet'}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
