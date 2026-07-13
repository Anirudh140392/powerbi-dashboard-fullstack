/**
 * Shared constants + types for the Ratings automation pipeline.
 *
 * IMPORTANT: this module is imported by workflows.ts, so it runs inside the
 * Temporal workflow sandbox — it MUST NOT touch `process`, `Date.now()`, or
 * any non-deterministic / Node-only API. Env-derived config lives in config.ts.
 */

/** Workflow type name — referenced as a string by the schedule + the API trigger. */
export const WORKFLOW_TYPE = 'dailyPipelineWorkflow';

export const scheduleIdFor = (companyId: string) => `rating-daily-${companyId}`;

export interface PipelineInput {
  companyId: string;
  triggerType?: 'scheduled' | 'manual';
  /** Gemini Audit + Competitor Matrix Match are cost/CPU-heavy — off by default. */
  runGemini?: boolean;
}

export type StageStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL' | 'SKIPPED';

export interface AlertSummary {
  rulesEvaluated: number;
  eventsCreated: number;
  emailsSent: number;
  errors: string[];
}

/**
 * Default ML jobs run every day. torch + transformers are now in
 * requirements.txt so BERT Inference + DeBERTa Taxonomy run too.
 *
 * Still excluded:
 * - 'Master Spec Enrichment' — bulk_spec_enricher.cjs has no implementation,
 *   it's a stub that exits 1 with a "disabled" message. Building the actual
 *   spec-extraction is a separate feature.
 */
// 'SetFit Issues' (in-house 37-aspect classifier, polarity-corrected) replaces the
// legacy 'DeBERTa Taxonomy' for classifying new reviews' sentiment_subcategory.
export const DAILY_ML_JOBS = ['Sentiment Backfill', 'BERT Inference', 'SetFit Issues'];

/** Cost/CPU-heavy LLM jobs — gated behind the runGemini workflow input. */
export const GEMINI_ML_JOBS = ['Gemini Audit', 'Competitor Matrix Match'];
