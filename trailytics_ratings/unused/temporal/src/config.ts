/**
 * Env-derived runtime config.
 *
 * NOT workflow-safe — reads `process.env`, so it must only be imported by
 * worker.ts / client.ts / schedule.ts, never by workflows.ts (the workflow
 * sandbox has no `process`).
 */
export const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
export const NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'rating';
export const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'rating-pipeline';
