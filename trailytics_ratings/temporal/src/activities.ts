/**
 * Temporal activities for the Ratings automation pipeline.
 *
 * Activities run in the normal Node runtime (not the workflow sandbox), so
 * they can require the repo's shared CJS modules, spawn child processes, and
 * talk to Postgres directly.
 *
 * The worker must run where it can reach BOTH the Prestige MySQL DB and the
 * adsauto Postgres. AUTOMATION_REPO_ROOT must point at the repo root (the
 * Docker image sets it to /app).
 */
import { Context } from '@temporalio/activity';
import { Pool } from 'pg';
import { spawn } from 'child_process';
import * as path from 'path';
import type { AlertSummary, StageStatus } from './shared';

const REPO_ROOT = process.env.AUTOMATION_REPO_ROOT || path.resolve(__dirname, '../..');

const isRemoteDb =
  !!process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST);

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  max: parseInt(process.env.DB_POOL_MAX || '5', 10),
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
});

// Shared CJS modules from the main repo — single source of truth for ML-job
// spawning and the alert engine.
/* eslint-disable @typescript-eslint/no-var-requires */
const { spawnJob } = require(path.join(REPO_ROOT, 'server/automation/spawnJob.cjs'));
const { runAlertsForCompany } = require(path.join(REPO_ROOT, 'server/automation/alertEngine.cjs'));
/* eslint-enable @typescript-eslint/no-var-requires */

function safeHeartbeat(msg: string) {
  try {
    Context.current().heartbeat(msg);
  } catch {
    /* not in activity context (shouldn't happen) */
  }
}

/**
 * Run a repo Node script to completion. Streams output to the worker log (so
 * failures are debuggable from Railway logs), heartbeats Temporal, and keeps a
 * tail of output that is attached to the rejection on non-zero exit.
 *
 * Heartbeats on a 30s timer in ADDITION to on output — the sync scripts run
 * long silent MySQL queries (375K reviews, 124M-row rb_pdp) that would
 * otherwise trip the activity heartbeatTimeout.
 */
function runNodeScript(scriptRelPath: string, companyId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptRelPath], {
      cwd: REPO_ROOT,
      env: { ...process.env, COMPANY_ID: companyId },
    });
    let tail = '';
    let lastLine = `${scriptRelPath} starting`;
    const onData = (d: Buffer) => {
      const s = d.toString();
      process.stdout.write(`[${scriptRelPath}] ${s}`);
      tail = (tail + s).slice(-4000);
      lastLine = s.slice(-300);
      safeHeartbeat(lastLine);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    const hb = setInterval(() => safeHeartbeat(lastLine), 30000);
    const finish = (fn: () => void) => {
      clearInterval(hb);
      fn();
    };
    child.on('error', (e) => finish(() => reject(e)));
    child.on('close', (code) =>
      finish(() =>
        code === 0
          ? resolve()
          : reject(new Error(`${scriptRelPath} exited with code ${code}. Output tail:\n${tail.slice(-1500)}`))
      )
    );
  });
}

const RUN_FIELDS = new Set([
  'status',
  'sync_status',
  'ml_status',
  'alert_status',
  'stages',
  'error',
  'completed_at',
]);

// ---- Activities ----

export async function openAutomationRun(input: {
  companyId: string;
  triggerType?: string;
  workflowId?: string;
  runId?: string;
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO ratings.automation_runs
       (company_id, workflow_id, run_id, trigger_type, status,
        sync_status, ml_status, alert_status)
     VALUES ($1,$2,$3,$4,'RUNNING','PENDING','PENDING','PENDING')
     RETURNING id`,
    [input.companyId, input.workflowId || null, input.runId || null, input.triggerType || 'scheduled']
  );
  return rows[0].id as string;
}

/** Partial update of an automation_runs row. Only whitelisted fields are written. */
export async function updateAutomationRun(args: {
  id: string;
  patch: Record<string, unknown>;
}): Promise<void> {
  const entries = Object.entries(args.patch).filter(([k]) => RUN_FIELDS.has(k));
  if (entries.length === 0) return;
  const sets = entries.map(([k], i) => `${k} = $${i + 2}`);
  const values = entries.map(([k, v]) => (k === 'stages' ? JSON.stringify(v) : v));
  await pool.query(
    `UPDATE ratings.automation_runs SET ${sets.join(', ')} WHERE id = $1`,
    [args.id, ...values]
  );
}

export async function finalizeAutomationRun(args: {
  id: string;
  status: StageStatus;
  stages: Record<string, unknown>;
  error?: string | null;
}): Promise<void> {
  await pool.query(
    `UPDATE ratings.automation_runs
     SET status = $2, stages = $3, error = $4, completed_at = now()
     WHERE id = $1`,
    [args.id, args.status, JSON.stringify(args.stages), args.error || null]
  );
}

/** Stage 1: upstream -> Postgres sync. Sequential; rejects on first failure.
 *  Note: activity is still named `runMysqlSync` for Temporal compatibility
 *  (renaming a running activity name breaks in-flight workflows). The actual
 *  source is now ClickHouse — the Prestige MySQL crawl DB was retired. */
export async function runMysqlSync(args: { companyId: string }): Promise<void> {
  await runNodeScript('scripts/sync_clickhouse_master.cjs', args.companyId);
  await runNodeScript('scripts/sync_clickhouse_reviews.cjs', args.companyId);
  await runNodeScript('scripts/sync_clickhouse_prices.cjs', args.companyId);
}

/** Stage 1b: scan all reviews for competitor brand mentions and populate
 *  ratings.competitor_mentions. Runs after sync so it sees the freshest text.
 *  Idempotent — re-running just refreshes the existing rows. */
export async function runCompetitorMentionScan(args: { companyId: string }): Promise<void> {
  await runNodeScript('scripts/scan_competitor_mentions.cjs', args.companyId);
}

/** Stage 2b: apply the DeBERTa/BERT classifications sitting in
 *  ratings.reviews_ml_audit onto ratings.reviews (sentiment / sentiment_category
 *  / specific_issue / ml_inferred_rating). The models classify into the audit
 *  table but nothing applied it to reviews, so the dashboard saw only ~14% of
 *  reviews. Idempotent (fills NULLs only), resumable; sentiment reconciled with
 *  the star rating. Runs every pipeline after the ML jobs. */
export async function runApplyMlAudit(args: { companyId: string }): Promise<void> {
  await runNodeScript('scripts/apply_ml_audit_backlog.cjs', args.companyId);
}

/** Stage 2: one ML job. Never throws — returns the job's final status so the
 *  workflow can record PARTIAL and keep going. */
export async function runMlJob(args: {
  companyId: string;
  jobName: string;
}): Promise<{ jobName: string; status: string; jobId: string | null }> {
  let lastLine = `${args.jobName} starting`;
  const hb = setInterval(() => safeHeartbeat(lastLine), 30000);
  try {
    const { jobId, done } = await spawnJob({
      pool,
      companyId: args.companyId,
      jobName: args.jobName,
      cwd: REPO_ROOT,
      onLog: (line: string) => {
        lastLine = String(line).slice(-300);
        safeHeartbeat(lastLine);
      },
    });
    const result = await done;
    return { jobName: args.jobName, status: result.status, jobId };
  } catch (e: unknown) {
    return { jobName: args.jobName, status: 'FAILED', jobId: null };
  } finally {
    clearInterval(hb);
  }
}

/** Stage 3: evaluate alert rules, persist events, email digests. */
export async function runAlertCheck(args: {
  companyId: string;
  automationRunId: string;
}): Promise<AlertSummary> {
  return runAlertsForCompany(pool, args.companyId, { automationRunId: args.automationRunId });
}

/**
 * Instant per-rule evaluation. Triggered from POST/PUT /api/automation/alert-rules
 * the moment a rule is created or activated — so admins see the first email
 * within seconds of saving, not on the next daily-pipeline run.
 */
export async function runAlertForRule(args: {
  companyId: string;
  ruleId: string;
}): Promise<AlertSummary> {
  return runAlertsForCompany(pool, args.companyId, {
    automationRunId: 'instant-rule',
    ruleId: args.ruleId,
  });
}

/** Weekly digest activity — invokes the same HTTP endpoint the dashboard uses,
 *  so the aggregation logic stays in one place (server/api.cjs). The activity
 *  hits the running API service via its public URL. */
export async function runWeeklyDigest(args: { companyId: string }): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const base = process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app';
    const res = await fetch(`${base}/api/automation/weekly-digest/send?company_id=${encodeURIComponent(args.companyId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The API authenticates via session token or system header. Use a
        // shared secret if set so the worker can call internal endpoints.
        ...(process.env.AUTOMATION_API_KEY ? { 'X-Automation-Key': process.env.AUTOMATION_API_KEY } : {}),
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(() => '') };
    return { ok: true, status: res.status };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
