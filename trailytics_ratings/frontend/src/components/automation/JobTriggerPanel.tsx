/**
 * Per-job trigger panel for /settings.
 *
 * Each ML job in the pipeline has its own card with:
 *   - last status badge + duration
 *   - Run button (disabled while RUNNING)
 *   - Cancel button (only when RUNNING)
 *   - View Log expandable
 *
 * The status updates every 5s via useRecentJobs polling. Backend endpoints
 * route through server/automation/spawnJob.cjs so this is identical to what
 * the Temporal worker does on the daily schedule.
 */
import { useMemo, useState } from 'react';
import {
  Brain, ScanSearch, Network, Sparkles, MessageSquare, Database,
  Play, Loader2, Square, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  triggerJob, cancelJob, useRecentJobs, fetchJobDetail,
  type JobRow,
} from '../../hooks/useAutomation';
import { StatusBadge } from './StatusBadge';

interface JobMeta {
  name: string;
  blurb: string;
  icon: typeof Brain;
  accent: string;
}

const JOBS: JobMeta[] = [
  { name: 'BERT Inference',         blurb: '5-star rating per review (tabularisai + ABSA + Gemini fallback). 250K-row backlog scan.', icon: Brain,         accent: 'indigo' },
  { name: 'DeBERTa Taxonomy',       blurb: 'Zero-shot category + sentiment via DeBERTa-v3 for paraphrase coverage.',                  icon: ScanSearch,    accent: 'cyan'   },
  { name: 'Gemini Audit',           blurb: 'Highest-quality structured-JSON pass: rating + category + sentiment + reasoning.',         icon: Sparkles,      accent: 'violet' },
  { name: 'Sentiment Backfill',     blurb: 'TextBlob/VADER baseline rules — fast, fills gaps the deeper models skip.',                 icon: MessageSquare, accent: 'emerald' },
  { name: 'Master Spec Enrichment', blurb: 'Extract material / wattage candidates for SKU masters from product names.',                icon: Database,      accent: 'amber'  },
  { name: 'Competitor Matrix Match',blurb: 'Re-compute SKU↔competitor mapping using 15% physical-tolerance rules.',                    icon: Network,       accent: 'rose'   },
];

function fmtDur(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function fmtTime(ts: string | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleString();
}

function JobCard({
  meta, latest, onTrigger, onCancel, busy, onShowLogs,
}: {
  meta: JobMeta;
  latest: JobRow | undefined;
  onTrigger: () => void;
  onCancel: (id: string) => void;
  busy: boolean;
  onShowLogs: (id: string) => void;
}) {
  const Icon = meta.icon;
  const isRunning = latest?.status === 'RUNNING';
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <div className={`shrink-0 w-9 h-9 rounded-lg bg-${meta.accent}-100 dark:bg-${meta.accent}-500/20 text-${meta.accent}-600 dark:text-${meta.accent}-400 flex items-center justify-center`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">{meta.name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{meta.blurb}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 text-xs">
        {latest ? (
          <>
            <StatusBadge status={latest.status} />
            <div className="text-slate-500 dark:text-slate-400 text-right">
              <div>{fmtTime(latest.started_at)}</div>
              <div className="text-[10px]">{fmtDur(latest.duration_seconds)}</div>
            </div>
          </>
        ) : (
          <span className="text-slate-400 italic">Never run</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onTrigger}
          disabled={busy || isRunning}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all
            ${isRunning
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              : `bg-${meta.accent}-600 hover:bg-${meta.accent}-700 text-white active:scale-95`
            } disabled:opacity-50`}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {isRunning ? 'Running…' : 'Run'}
        </button>
        {isRunning && latest && (
          <button
            onClick={() => onCancel(latest.id)}
            className="inline-flex items-center justify-center gap-1 text-xs font-semibold py-2 px-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
            title="Mark this job FAILED in the log"
          >
            <Square size={12} /> Cancel
          </button>
        )}
        {latest && (
          <button
            onClick={() => onShowLogs(latest.id)}
            className="inline-flex items-center justify-center gap-1 text-xs font-semibold py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            title="View latest log"
          >
            Log
          </button>
        )}
      </div>
    </div>
  );
}

export function JobTriggerPanel() {
  const { data, error, refetch } = useRecentJobs(5000);
  const [busy, setBusy] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<{ id: string; jobName: string; tail: string } | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Most recent row per job_name. Recent jobs come pre-sorted desc.
  const latestByJob = useMemo(() => {
    const map = new Map<string, JobRow>();
    for (const job of data?.jobs ?? []) {
      if (!map.has(job.job_name)) map.set(job.job_name, job);
    }
    return map;
  }, [data]);

  const handleTrigger = async (jobName: string) => {
    setBusy(jobName);
    try {
      const r = await triggerJob(jobName);
      // Show the user the job started; subsequent polls will show it as RUNNING.
      setTimeout(refetch, 800);
      console.log(`Started ${jobName}: ${r.jobId}`);
    } catch (e) {
      alert(`Could not start ${jobName}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async (jobId: string) => {
    if (!confirm('Mark this job as FAILED in the log? The underlying process will exit on the next platform redeploy.')) return;
    try {
      await cancelJob(jobId);
      refetch();
    } catch (e) {
      alert(`Cancel failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleShowLogs = async (jobId: string) => {
    try {
      const detail = await fetchJobDetail(jobId);
      setLogModal({ id: jobId, jobName: detail.job_name, tail: detail.log_tail || '(empty)' });
    } catch (e) {
      alert(`Could not load log: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Trigger an ML job</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Fire any single ML pipeline ad-hoc. Status polls every 5 s.
          </p>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {expanded && (
        <>
          {error && (
            <p className="text-xs text-rose-500 mb-3">Failed to load job status: {error}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {JOBS.map(meta => (
              <JobCard
                key={meta.name}
                meta={meta}
                latest={latestByJob.get(meta.name)}
                onTrigger={() => handleTrigger(meta.name)}
                onCancel={handleCancel}
                onShowLogs={handleShowLogs}
                busy={busy === meta.name}
              />
            ))}
          </div>
        </>
      )}

      {logModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1300] flex items-center justify-center p-6"
          onClick={() => setLogModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 max-w-3xl w-full max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 dark:text-white">{logModal.jobName} — log tail</h3>
              <button
                onClick={() => setLogModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm"
              >
                Close
              </button>
            </div>
            <pre className="flex-1 overflow-auto text-[11px] font-mono bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 p-3 rounded-lg whitespace-pre-wrap break-all">
              {logModal.tail}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
