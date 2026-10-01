/**
 * Data hooks for the Automation Settings page.
 *
 * The /api/automation/* endpoints live in server/api.cjs (same server as
 * /api/ml/jobs), so we hit VITE_RAILWAY_URL — matching MLControlCenter.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { resolveCompanyId } from '../utils/tenant';
import { buildAuthHeaders } from '../utils/auth';
import type {
  AutomationStatus,
  AutomationRun,
  AlertRule,
  AlertRuleInput,
  AlertEvent,
  TestRuleResult,
} from '../types/automation';

const API_BASE = `${import.meta.env.VITE_RAILWAY_URL || ''}/api/automation`;

async function automationFetch<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const companyId = resolveCompanyId();
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `${API_BASE}${endpoint}${sep}company_id=${encodeURIComponent(companyId)}`;
  const headers = buildAuthHeaders(
    init.body ? { 'Content-Type': 'application/json', ...(init.headers || {}) } : init.headers,
    companyId,
  );
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).error || '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Generic polling fetch hook. pollMs of 0 disables polling. */
function usePolledResource<T>(
  fetcher: () => Promise<T>,
  pollMs: number,
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    if (pollMs <= 0) return;
    const id = setInterval(refetch, pollMs);
    return () => clearInterval(id);
  }, [refetch, pollMs]);

  return { data, loading, error, refetch };
}

export function useAutomationStatus() {
  const [running, setRunning] = useState(false);
  const result = usePolledResource<AutomationStatus>(
    () => automationFetch<AutomationStatus>('/status'),
    running ? 3000 : 20000,
  );
  useEffect(() => {
    setRunning(result.data?.lastRun?.status === 'RUNNING');
  }, [result.data]);
  return result;
}

export function useAutomationRuns() {
  return usePolledResource<{ runs: AutomationRun[] }>(
    () => automationFetch<{ runs: AutomationRun[] }>('/runs'),
    20000,
  );
}

export function useAlertEvents(ruleId?: string) {
  const endpoint = ruleId ? `/alert-events?rule_id=${encodeURIComponent(ruleId)}` : '/alert-events';
  return usePolledResource<{ events: AlertEvent[] }>(
    () => automationFetch<{ events: AlertEvent[] }>(endpoint),
    0,
  );
}

export function useAlertRules() {
  const base = usePolledResource<{ rules: AlertRule[] }>(
    () => automationFetch<{ rules: AlertRule[] }>('/alert-rules'),
    0,
  );

  const createRule = useCallback(async (input: AlertRuleInput) => {
    const r = await automationFetch<{ rule: AlertRule }>('/alert-rules', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    base.refetch();
    return r.rule;
  }, [base]);

  const updateRule = useCallback(async (id: string, input: AlertRuleInput) => {
    const r = await automationFetch<{ rule: AlertRule }>(`/alert-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    base.refetch();
    return r.rule;
  }, [base]);

  const deleteRule = useCallback(async (id: string) => {
    await automationFetch(`/alert-rules/${id}`, { method: 'DELETE' });
    base.refetch();
  }, [base]);

  const testRule = useCallback((id: string, send: boolean = false) => {
    return automationFetch<TestRuleResult & { sent?: boolean; sentTo?: string | string[]; sendError?: string }>(
      `/alert-rules/${id}/test`,
      { method: 'POST', body: JSON.stringify({ send }) },
    );
  }, []);

  return { ...base, createRule, updateRule, testRule, deleteRule };
}

export async function triggerPipeline(): Promise<{ workflowId: string; runId: string }> {
  return automationFetch<{ workflowId: string; runId: string }>('/trigger', { method: 'POST' });
}

export type TriggerStage = 'full' | 'sync' | 'alerts';

export async function triggerStage(stage: TriggerStage): Promise<{ workflowId: string; runId: string }> {
  return automationFetch<{ workflowId: string; runId: string }>('/trigger-stage', {
    method: 'POST',
    body: JSON.stringify({ stage }),
  });
}

export async function sendTestMail(to?: string, count?: number, forceCritical?: boolean): Promise<{ success: boolean; sentTo: string; skuCount?: number; priority?: string; calendarInviteAttached?: boolean }> {
  return automationFetch('/test-mail', {
    method: 'POST',
    body: JSON.stringify({ to, count, forceCritical }),
  });
}

export interface MailerSettings {
  calendarInvite: {
    enabled: boolean;
    schedulePreset: 'next_10am' | 'tomorrow_10am' | 'plus_1_day_10am' | 'plus_2_days_10am' | 'plus_3_days_10am' | 'next_monday_10am' | 'next_business_day_10am';
    scheduleTimeHHMM: string;
    durationMinutes: number;
    reminderMinutes: number;
    onlyForCritical: boolean;
  };
  threading: { enabled: boolean };
  highPriority: { enabled: boolean; criticalThreshold: number };
  actionChips: { enabled: boolean };
  gmailAction: { enabled: boolean };
  listUnsubscribe: { enabled: boolean; overrideUrl: string | null };
  defaults: { defaultRecipients: string[] };
}

export function useMailerSettings() {
  return usePolledResource<{ settings: MailerSettings; defaults: MailerSettings }>(
    () => automationFetch<{ settings: MailerSettings; defaults: MailerSettings }>('/mailer-settings'),
    0,
  );
}

export async function updateMailerSettings(patch: Partial<MailerSettings>): Promise<{ settings: MailerSettings }> {
  return automationFetch<{ settings: MailerSettings }>('/mailer-settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

// Per-job triggers — same path the Temporal worker uses, just initiated by a
// human from /settings instead of by the daily schedule.
export interface JobRow {
  id: string;
  job_name: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PENDING';
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  log_size?: number;
  log_tail?: string;
}

export async function triggerJob(jobName: string, ids?: string[]): Promise<{ jobId: string }> {
  return automationFetch<{ jobId: string }>('/jobs/trigger', {
    method: 'POST',
    body: JSON.stringify({ jobName, ids }),
  });
}

export async function cancelJob(jobId: string): Promise<{ jobId: string }> {
  return automationFetch<{ jobId: string }>(`/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
}

export async function fetchJobDetail(jobId: string): Promise<JobRow> {
  return automationFetch<JobRow>(`/jobs/${encodeURIComponent(jobId)}`);
}

export function useRecentJobs(pollMs = 5000) {
  return usePolledResource<{ jobs: JobRow[] }>(
    () => automationFetch<{ jobs: JobRow[] }>('/jobs/recent?limit=30'),
    pollMs,
  );
}
