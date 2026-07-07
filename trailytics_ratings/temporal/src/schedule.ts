/**
 * Schedule registration — both as a one-shot CLI (`npm run schedule`) and a
 * reusable function the worker calls at boot.
 *
 * Idempotent: re-running an already-registered schedule just replaces it,
 * so the worker can safely call `registerSchedules` every time it starts.
 *
 * Schedules created per company:
 *   rating-daily-<companyId>    dailyPipelineWorkflow  every day at HH:MM (default 02:00)
 *   rating-weekly-<companyId>   weeklyDigestWorkflow   every Monday HH:MM (default 09:00)
 */
import 'dotenv/config';
import { Client, ScheduleOverlapPolicy } from '@temporalio/client';
import { buildClient } from './client';
import { TASK_QUEUE } from './config';
import { WORKFLOW_TYPE, scheduleIdFor } from './shared';

interface RegisterOpts {
  companyIds: string[];
  hour?: number;
  minute?: number;
  weeklyHour?: number;
  weeklyMinute?: number;
}

/**
 * Register / refresh all schedules for the given companies on an existing
 * Temporal client. Called from `worker.ts` at boot and from the CLI below.
 */
export async function registerSchedules(client: Client, opts: RegisterOpts): Promise<void> {
  const hour = opts.hour ?? 2;
  const minute = opts.minute ?? 0;
  const weeklyHour = opts.weeklyHour ?? 9;
  const weeklyMinute = opts.weeklyMinute ?? 0;

  for (const companyId of opts.companyIds) {
    const dailyId = scheduleIdFor(companyId);
    const dailySpec = { calendars: [{ hour, minute }] };
    const dailyAction = {
      type: 'startWorkflow' as const,
      workflowType: WORKFLOW_TYPE,
      taskQueue: TASK_QUEUE,
      args: [{ companyId, triggerType: 'scheduled' }],
    };

    await upsertSchedule(client, dailyId, dailySpec, dailyAction);
    console.log(`[schedule] ${dailyId} → daily ${pad(hour)}:${pad(minute)}`);

    const weeklyId = `rating-weekly-${companyId}`;
    const weeklySpec = {
      calendars: [{ dayOfWeek: 'MONDAY' as const, hour: weeklyHour, minute: weeklyMinute }],
    };
    const weeklyAction = {
      type: 'startWorkflow' as const,
      workflowType: 'weeklyDigestWorkflow',
      taskQueue: TASK_QUEUE,
      args: [{ companyId }],
    };

    await upsertSchedule(client, weeklyId, weeklySpec, weeklyAction);
    console.log(`[schedule] ${weeklyId} → Mon ${pad(weeklyHour)}:${pad(weeklyMinute)}`);
  }
}

async function upsertSchedule(
  client: Client,
  scheduleId: string,
  spec: object,
  action: object
): Promise<void> {
  const create = () =>
    client.schedule.create({
      scheduleId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spec: spec as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      action: action as any,
      policies: { overlap: ScheduleOverlapPolicy.SKIP },
    });
  try {
    await create();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : '';
    if (name === 'ScheduleAlreadyRunning' || /already (exists|running)/i.test(msg)) {
      // Daily cron has no in-flight state worth preserving — replace it.
      await client.schedule.getHandle(scheduleId).delete();
      await create();
    } else {
      throw err;
    }
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────
async function cliMain() {
  const companyIds = (process.env.AUTOMATION_COMPANY_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (companyIds.length === 0) {
    throw new Error('AUTOMATION_COMPANY_IDS env is empty — set at least one company UUID.');
  }
  const client = await buildClient();
  try {
    await registerSchedules(client, {
      companyIds,
      hour: parseInt(process.env.AUTOMATION_HOUR || '2', 10),
      minute: parseInt(process.env.AUTOMATION_MINUTE || '0', 10),
      weeklyHour: parseInt(process.env.WEEKLY_DIGEST_HOUR || '9', 10),
      weeklyMinute: parseInt(process.env.WEEKLY_DIGEST_MINUTE || '0', 10),
    });
  } finally {
    await client.connection.close();
  }
}

if (require.main === module) {
  cliMain().catch((err) => {
    console.error('[schedule] failed:', err);
    process.exit(1);
  });
}
