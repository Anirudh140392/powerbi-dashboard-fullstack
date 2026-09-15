/** Temporal worker — registers the workflow + activities on the rating-pipeline queue. */
import 'dotenv/config';
import * as http from 'http';
import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';
import { TEMPORAL_ADDRESS, NAMESPACE, TASK_QUEUE } from './config';
import { Pool } from 'pg';
import { buildClient } from './client';
import { registerSchedules } from './schedule';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reconcileOrphanedJobs } = require('../../server/automation/spawnJob.cjs');

/**
 * Tiny HTTP server alongside the worker — Railway gave the service a public
 * domain, so we expose a couple of read-only endpoints for external uptime
 * monitoring instead of letting requests fall through to a 502. Responds
 * before Temporal is ready so platform health checks don't kill the boot.
 */
const state: {
  started: Date;
  temporalConnected: boolean;
  workerRunning: boolean;
  lastError?: string;
} = {
  started: new Date(),
  temporalConnected: false,
  workerRunning: false,
};

function startHealthServer() {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health' || req.url === '/healthz') {
      const ok = state.temporalConnected && state.workerRunning;
      res.statusCode = ok ? 200 : 503;
      res.end(JSON.stringify({
        ok,
        temporalConnected: state.temporalConnected,
        workerRunning: state.workerRunning,
        namespace: NAMESPACE,
        taskQueue: TASK_QUEUE,
        startedAt: state.started.toISOString(),
        uptimeSeconds: Math.round((Date.now() - state.started.getTime()) / 1000),
        lastError: state.lastError,
      }));
      return;
    }
    if (req.url === '/' || req.url === '/status') {
      res.statusCode = 200;
      res.end(JSON.stringify({
        service: 'rating-temporal-worker',
        namespace: NAMESPACE,
        taskQueue: TASK_QUEUE,
        temporalAddress: TEMPORAL_ADDRESS,
        startedAt: state.started.toISOString(),
        uptimeSeconds: Math.round((Date.now() - state.started.getTime()) / 1000),
        temporalConnected: state.temporalConnected,
        workerRunning: state.workerRunning,
      }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  server.listen(port, () => console.log(`[health-server] listening on :${port}`));
}

async function reconcileOnBoot() {
  // Mark any ml_jobs_log row left RUNNING by the previous worker container as
  // FAILED. Otherwise the row stays RUNNING forever (close/timeout handlers in
  // spawnJob.cjs never fire across a container kill), which blocks the
  // /settings UI and the auto-approve watcher from advancing coverage.
  const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  });
  try {
    await reconcileOrphanedJobs({ pool, reason: 'temporal worker restarted' });
  } catch (e) {
    console.error('[ml-jobs] reconcile failed:', (e as Error).message);
  } finally {
    await pool.end().catch(() => {});
  }
}

async function syncSchedulesOnBoot() {
  const companyIds = (process.env.AUTOMATION_COMPANY_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (companyIds.length === 0) {
    console.log('[schedule] AUTOMATION_COMPANY_IDS empty — skipping schedule registration');
    return;
  }
  let client;
  try {
    client = await buildClient();
    await registerSchedules(client, {
      companyIds,
      hour: parseInt(process.env.AUTOMATION_HOUR || '2', 10),
      minute: parseInt(process.env.AUTOMATION_MINUTE || '0', 10),
      weeklyHour: parseInt(process.env.WEEKLY_DIGEST_HOUR || '9', 10),
      weeklyMinute: parseInt(process.env.WEEKLY_DIGEST_MINUTE || '0', 10),
    });
    console.log(`[schedule] ${companyIds.length} company schedule(s) refreshed on boot`);
  } catch (e) {
    console.error('[schedule] boot registration failed:', (e as Error).message);
  } finally {
    if (client) await client.connection.close().catch(() => {});
  }
}

async function run() {
  startHealthServer();
  await reconcileOnBoot();
  try {
    const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS });
    state.temporalConnected = true;
    const worker = await Worker.create({
      connection,
      namespace: NAMESPACE,
      taskQueue: TASK_QUEUE,
      workflowsPath: require.resolve('./workflows'),
      activities,
    });
    console.log(
      `[temporal-worker] connected address=${TEMPORAL_ADDRESS} namespace=${NAMESPACE} taskQueue=${TASK_QUEUE}`
    );
    state.workerRunning = true;
    // Refresh schedule registration once the worker is up — idempotent, so
    // it's safe to run on every restart. Ensures the daily sync schedule
    // exists on the cluster without relying on a manual `npm run schedule`.
    await syncSchedulesOnBoot();
    await worker.run();
  } catch (err) {
    state.lastError = String(err);
    throw err;
  }
}

run().catch((err) => {
  state.workerRunning = false;
  console.error('[temporal-worker] fatal:', err);
  process.exit(1);
});
