require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: process.env.VERCEL ? { rejectUnauthorized: false } : false,
});

const ddl = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Pipeline-level run tracking (one row per scheduled/manual pipeline run).
-- Distinct from ratings.ml_jobs_log, which stays per-individual-job.
CREATE TABLE IF NOT EXISTS ratings.automation_runs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    uuid NOT NULL,
    workflow_id   text NULL,
    run_id        text NULL,
    trigger_type  text NOT NULL DEFAULT 'scheduled',
    status        text NOT NULL DEFAULT 'RUNNING',
    sync_status   text NULL,
    ml_status     text NULL,
    alert_status  text NULL,
    stages        jsonb NOT NULL DEFAULT '{}'::jsonb,
    error         text NULL,
    started_at    timestamptz NOT NULL DEFAULT now(),
    completed_at  timestamptz NULL,
    CONSTRAINT automation_runs_trigger_type_check
        CHECK (trigger_type IN ('scheduled', 'manual')),
    CONSTRAINT automation_runs_status_check
        CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL'))
);

CREATE INDEX IF NOT EXISTS automation_runs_company_started_idx
    ON ratings.automation_runs (company_id, started_at DESC);

-- Configurable rating-drop alert rules.
CREATE TABLE IF NOT EXISTS ratings.alert_rules (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         uuid NOT NULL,
    name               text NOT NULL,
    scope_type         text NOT NULL,
    scope_value        text NULL,
    platform           text NULL,
    absolute_floor     numeric(3,2) NULL,
    drop_delta         numeric(3,2) NULL,
    comparison_window  text NOT NULL DEFAULT 'previous_snapshot',
    min_rating_count   integer NOT NULL DEFAULT 0,
    recipients         text[] NOT NULL DEFAULT '{}',
    enabled            boolean NOT NULL DEFAULT true,
    created_by         uuid NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT alert_rules_scope_type_check
        CHECK (scope_type IN ('product', 'brand', 'category')),
    CONSTRAINT alert_rules_comparison_window_check
        CHECK (comparison_window IN ('previous_snapshot', '7day_avg')),
    CONSTRAINT alert_rules_has_condition
        CHECK (absolute_floor IS NOT NULL OR drop_delta IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS alert_rules_company_idx
    ON ratings.alert_rules (company_id, enabled);

-- Fired alert occurrences (audit trail + same-day dedupe + email tracking).
CREATE TABLE IF NOT EXISTS ratings.alert_events (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id          uuid NOT NULL REFERENCES ratings.alert_rules(id) ON DELETE CASCADE,
    company_id       uuid NOT NULL,
    run_id           uuid NULL REFERENCES ratings.automation_runs(id) ON DELETE SET NULL,
    scope_type       text NOT NULL,
    scope_value      text NULL,
    web_pid          text NULL,
    product_name     text NULL,
    platform         text NULL,
    previous_rating  numeric(3,2) NULL,
    current_rating   numeric(3,2) NULL,
    delta            numeric(4,2) NULL,
    reason           text NOT NULL,
    snapshot_date    date NOT NULL,
    email_sent       boolean NOT NULL DEFAULT false,
    email_error      text NULL,
    triggered_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT alert_events_reason_check
        CHECK (reason IN ('absolute_floor', 'drop_delta', 'both'))
);

CREATE INDEX IF NOT EXISTS alert_events_company_time_idx
    ON ratings.alert_events (company_id, triggered_at DESC);

-- Prevents re-emailing the same product drop if the pipeline re-runs the same day.
CREATE UNIQUE INDEX IF NOT EXISTS alert_events_dedupe_idx
    ON ratings.alert_events (rule_id, COALESCE(web_pid, ''), snapshot_date);
`;

async function main() {
    await client.connect();
    await client.query(ddl);
    console.log('Automation schema is ready (automation_runs, alert_rules, alert_events).');
    await client.end();
}

main().catch(async (error) => {
    console.error('Failed to set up automation schema:', error);
    try {
        await client.end();
    } catch {}
    process.exit(1);
});
