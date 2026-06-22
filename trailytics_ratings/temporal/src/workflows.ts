/**
 * Daily pipeline workflow — pure orchestration, no I/O.
 *
 * Order: openRun -> MySQL sync -> ML jobs -> alert check -> finalize.
 * - Sync must succeed before alerts run (don't alert on stale data).
 * - ML jobs never abort the pipeline; a failed job downgrades the run to PARTIAL.
 * - finalize always runs.
 */
import { proxyActivities, workflowInfo } from '@temporalio/workflow';
import type * as activities from './activities';
import {
  PipelineInput,
  StageStatus,
  DAILY_ML_JOBS,
  GEMINI_ML_JOBS,
} from './shared';

const { openAutomationRun, updateAutomationRun, finalizeAutomationRun, runAlertCheck, runAlertForRule } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '5 minutes',
    retry: { maximumAttempts: 5 },
  });

// Sync is idempotent (upserts) — safe to retry. Long-running: the scripts do
// row-by-row inserts of ~350K reviews + price snapshots over the network, so
// a full sync can take 1-2 hours. Heartbeats (30s timer in activities.ts)
// keep it alive; the generous start-to-close just gives it room to finish.
const { runMysqlSync } = proxyActivities<typeof activities>({
  startToCloseTimeout: '4 hours',
  heartbeatTimeout: '5 minutes',
  retry: { maximumAttempts: 2 },
});

// Competitor-mention scan: streaming pass over ratings.reviews, full table
// each time. Idempotent (ON CONFLICT) so safe to retry. Caps at 30 min.
const { runCompetitorMentionScan } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  heartbeatTimeout: '5 minutes',
  retry: { maximumAttempts: 2 },
});

// ML jobs are expensive and self-cap inside spawnJob — no retry; failure is recorded.
//
// scheduleToStartTimeout: '30 minutes' guards against worker-down hangs.
// If no worker claims the activity within 30 minutes (e.g. worker OOMed after
// loading PyTorch models in BERT), Temporal fails the activity with a
// SCHEDULE_TO_START timeout instead of letting the whole workflow stall
// indefinitely. The workflow then records mlAnyFail=true and moves on to
// the alert stage, so emails still go out from the rules that have data.
//
// startToCloseTimeout: '6 hours' matches BERT's per-job timeout; the smaller
// 40-minute cap was killing legitimate runs.
const { runMlJob } = proxyActivities<typeof activities>({
  scheduleToStartTimeout: '30 minutes',
  startToCloseTimeout: '6 hours',
  heartbeatTimeout: '5 minutes',
  retry: { maximumAttempts: 1 },
});

/** Single-job workflow — runs ONE ML job through the worker. Triggered from
 *  /settings JobTriggerPanel. Uses the same runMlJob activity as the daily
 *  pipeline so behaviour is identical. */
export async function singleJobWorkflow(input: { companyId: string; jobName: string }): Promise<{
  jobName: string;
  status: string;
  jobId: string | null;
}> {
  return runMlJob({ companyId: input.companyId, jobName: input.jobName });
}

/** Sync-only workflow — pulls MySQL → Postgres without touching ML or alerts.
 *  Useful when the user just wants fresh data on the dashboard. */
export async function syncOnlyWorkflow(input: { companyId: string }): Promise<StageStatus> {
  try {
    await runMysqlSync({ companyId: input.companyId });
    return 'COMPLETED';
  } catch {
    return 'FAILED';
  }
}

/** Alert-check-only workflow — re-evaluate alert rules and send digests
 *  without re-running sync or ML. */
export async function alertCheckOnlyWorkflow(input: { companyId: string }): Promise<StageStatus> {
  try {
    const summary = await runAlertCheck({ companyId: input.companyId, automationRunId: 'manual' });
    return summary.errors && summary.errors.length > 0 ? 'PARTIAL' : 'COMPLETED';
  } catch {
    return 'FAILED';
  }
}

/**
 * Instant per-rule workflow — evaluates exactly one rule and emails if any
 * SKU trips the threshold. Started directly from the alert-rules API the
 * moment a rule is created or toggled ON, so feedback to the admin is in
 * seconds rather than waiting for the next daily-pipeline run.
 */
export async function runRuleInstantWorkflow(input: {
  companyId: string;
  ruleId: string;
}): Promise<{ status: StageStatus; eventsCreated: number; emailsSent: number; errors: string[] }> {
  try {
    const summary = await runAlertForRule({ companyId: input.companyId, ruleId: input.ruleId });
    const status: StageStatus = summary.errors && summary.errors.length > 0 ? 'PARTIAL' : 'COMPLETED';
    return { status, eventsCreated: summary.eventsCreated, emailsSent: summary.emailsSent, errors: summary.errors };
  } catch (e) {
    return { status: 'FAILED', eventsCreated: 0, emailsSent: 0, errors: [String(e)] };
  }
}

const { runWeeklyDigest } = proxyActivities<typeof activities>({
  startToCloseTimeout: '15 minutes',
  retry: { maximumAttempts: 2 },
});

/** Weekly pulse workflow — wraps the /weekly-digest/send endpoint so a
 *  Temporal cron can fire it every Monday morning. */
export async function weeklyDigestWorkflow(input: { companyId: string }): Promise<StageStatus> {
  const r = await runWeeklyDigest({ companyId: input.companyId });
  return r.ok ? 'COMPLETED' : 'FAILED';
}

export async function dailyPipelineWorkflow(input: PipelineInput): Promise<{
  automationRunId: string;
  status: StageStatus;
}> {
  const info = workflowInfo();
  const automationRunId = await openAutomationRun({
    companyId: input.companyId,
    triggerType: input.triggerType || 'scheduled',
    workflowId: info.workflowId,
    runId: info.runId,
  });

  const stages: Record<string, unknown> = {};
  let syncOk = false;

  // --- Stage 1: MySQL sync ---
  try {
    await updateAutomationRun({ id: automationRunId, patch: { sync_status: 'RUNNING' } });
    await runMysqlSync({ companyId: input.companyId });
    syncOk = true;
    stages.sync = { status: 'COMPLETED' };
    await updateAutomationRun({ id: automationRunId, patch: { sync_status: 'COMPLETED' } });
  } catch (e) {
    stages.sync = { status: 'FAILED', error: String(e) };
    await updateAutomationRun({ id: automationRunId, patch: { sync_status: 'FAILED' } });
  }

  // --- Stage 1b: competitor mention scan (depends on fresh review text) ---
  if (syncOk) {
    try {
      await runCompetitorMentionScan({ companyId: input.companyId });
      stages.competitorMentionScan = { status: 'COMPLETED' };
    } catch (e) {
      stages.competitorMentionScan = { status: 'FAILED', error: String(e) };
    }
  } else {
    stages.competitorMentionScan = { status: 'SKIPPED', reason: 'sync failed' };
  }

  // --- Stage 2: ML jobs ---
  const mlJobs = input.runGemini ? [...DAILY_ML_JOBS, ...GEMINI_ML_JOBS] : [...DAILY_ML_JOBS];
  await updateAutomationRun({ id: automationRunId, patch: { ml_status: 'RUNNING' } });
  const mlResults: Record<string, string> = {};
  let mlAnyOk = false;
  let mlAnyFail = false;
  for (const jobName of mlJobs) {
    // Catch Temporal-side activity failures (worker OOM, scheduleToStart
    // timeout, etc) so a single bad job can't strand the workflow before
    // the alert stage runs. Worker-death cases land here, not as runMlJob
    // returning FAILED — the activity itself throws.
    try {
      const r = await runMlJob({ companyId: input.companyId, jobName });
      mlResults[jobName] = r.status;
      if (r.status === 'COMPLETED') mlAnyOk = true;
      else mlAnyFail = true;
    } catch (e) {
      mlResults[jobName] = 'FAILED';
      mlAnyFail = true;
    }
  }
  const mlStatus: StageStatus = mlAnyFail ? (mlAnyOk ? 'PARTIAL' : 'FAILED') : 'COMPLETED';
  stages.ml = { status: mlStatus, jobs: mlResults };
  await updateAutomationRun({ id: automationRunId, patch: { ml_status: mlStatus } });

  // --- Stage 3: alert check (skipped if sync failed) ---
  let alertStatus: StageStatus = 'SKIPPED';
  if (syncOk) {
    try {
      await updateAutomationRun({ id: automationRunId, patch: { alert_status: 'RUNNING' } });
      const summary = await runAlertCheck({ companyId: input.companyId, automationRunId });
      alertStatus = summary.errors && summary.errors.length > 0 ? 'PARTIAL' : 'COMPLETED';
      stages.alert = { status: alertStatus, ...summary };
    } catch (e) {
      alertStatus = 'FAILED';
      stages.alert = { status: 'FAILED', error: String(e) };
    }
  } else {
    stages.alert = { status: 'SKIPPED', reason: 'sync failed' };
  }
  await updateAutomationRun({ id: automationRunId, patch: { alert_status: alertStatus } });

  // --- Finalize ---
  let overall: StageStatus;
  if (!syncOk) {
    overall = 'FAILED';
  } else if (mlStatus === 'COMPLETED' && alertStatus === 'COMPLETED') {
    overall = 'COMPLETED';
  } else {
    overall = 'PARTIAL';
  }
  await finalizeAutomationRun({ id: automationRunId, status: overall, stages });

  return { automationRunId, status: overall };
}
