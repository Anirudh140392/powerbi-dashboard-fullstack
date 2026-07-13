/**
 * Weekly rating-trend infrastructure.
 *
 * 1. ratings.metric_discontinuities — config table recording known measurement
 *    breaks (e.g. the 2026-06-21 upstream source swap MySQL -> ClickHouse with
 *    case-insensitive web_pid matching). A NULL company_id means "global / all
 *    companies". Trend + alert logic must never compute a delta that straddles
 *    one of these dates — comparing a post-break value to a pre-break value is
 *    a methodology artefact, not a real movement.
 *
 * 2. ratings.weekly_rating_trend — the single source of truth for per-SKU,
 *    per-platform weekly rating / rating_count trend with week-over-week deltas.
 *    The representative value for a week is the LAST snapshot in that week
 *    (cumulative counts carry forward, so the latest reading is the truth).
 *    crosses_discontinuity flags any WoW delta whose window spans a break.
 *
 * Idempotent: safe to re-run.
 */
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
            ? { rejectUnauthorized: false }
            : false,
    });

    const statements = [
        `CREATE TABLE IF NOT EXISTS ratings.metric_discontinuities (
            id              BIGSERIAL PRIMARY KEY,
            company_id      UUID,                       -- NULL = global / all companies
            metric          TEXT NOT NULL DEFAULT 'all',-- 'rating_count' | 'rating' | 'all'
            effective_date  DATE NOT NULL,              -- first date on the NEW side of the break
            reason          TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        // One discontinuity per (company, metric, date) — lets re-runs upsert cleanly.
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_metric_discontinuity
            ON ratings.metric_discontinuities
            (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), metric, effective_date)`,

        // Seed the known 2026-06-21 source swap (global).
        `INSERT INTO ratings.metric_discontinuities (company_id, metric, effective_date, reason)
         VALUES (NULL, 'all', '2026-06-21',
                 'Upstream crawl source swap MySQL -> ClickHouse (case-insensitive web_pid match); rating_count/rating re-based for a subset of SKUs')
         ON CONFLICT (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), metric, effective_date)
         DO NOTHING`,

        // The weekly trend view.
        `CREATE OR REPLACE VIEW ratings.weekly_rating_trend AS
         WITH weekly AS (
             SELECT
                 company_id,
                 web_pid,
                 LOWER(platform)                                              AS platform,
                 bool_or(is_competitor)                                       AS is_competitor,
                 date_trunc('week', snapshot_date)::date                      AS week_start,
                 (array_agg(rating        ORDER BY snapshot_date DESC, created_at DESC NULLS LAST))[1] AS rating,
                 (array_agg(rating_count  ORDER BY snapshot_date DESC, created_at DESC NULLS LAST))[1] AS rating_count,
                 (array_agg(review_count  ORDER BY snapshot_date DESC, created_at DESC NULLS LAST))[1] AS review_count,
                 (array_agg(product_name  ORDER BY snapshot_date DESC, created_at DESC NULLS LAST))[1] AS product_name,
                 (array_agg(brand         ORDER BY snapshot_date DESC, created_at DESC NULLS LAST))[1] AS brand,
                 (array_agg(category      ORDER BY snapshot_date DESC, created_at DESC NULLS LAST))[1] AS category,
                 (array_agg(pareto_status ORDER BY snapshot_date DESC, created_at DESC NULLS LAST))[1] AS pareto_status,
                 MAX(snapshot_date)                                           AS last_snapshot_date,
                 COUNT(*)                                                     AS snapshots_in_week
             FROM ratings.product_snapshots
             GROUP BY company_id, web_pid, LOWER(platform), date_trunc('week', snapshot_date)
         ),
         lagged AS (
             SELECT w.*,
                    LAG(rating)       OVER pw AS prev_rating,
                    LAG(rating_count) OVER pw AS prev_rating_count,
                    LAG(week_start)   OVER pw AS prev_week_start
             FROM weekly w
             WINDOW pw AS (PARTITION BY company_id, web_pid, platform ORDER BY week_start)
         )
         SELECT
             l.company_id, l.web_pid, l.platform, l.is_competitor, l.week_start,
             l.rating, l.rating_count, l.review_count, l.product_name, l.brand,
             l.category, l.pareto_status, l.last_snapshot_date, l.snapshots_in_week,
             l.prev_rating, l.prev_rating_count, l.prev_week_start,
             (l.rating::numeric       - l.prev_rating::numeric)       AS rating_wow_delta,
             (l.rating_count          - l.prev_rating_count)          AS rating_count_wow_delta,
             CASE
                 WHEN l.prev_week_start IS NOT NULL AND EXISTS (
                     SELECT 1 FROM ratings.metric_discontinuities d
                     WHERE (d.company_id = l.company_id OR d.company_id IS NULL)
                       AND d.effective_date >  l.prev_week_start
                       AND d.effective_date <= l.week_start
                 ) THEN true ELSE false
             END AS crosses_discontinuity
         FROM lagged l`,
    ];

    for (const sql of statements) {
        const t = Date.now();
        const name = sql.split('\n')[0].slice(0, 70).trim();
        process.stdout.write(`  ${name.padEnd(70)} `);
        try {
            await pool.query(sql);
            console.log(`OK (${Date.now() - t}ms)`);
        } catch (e) {
            console.log(`FAIL: ${e.message}`);
        }
    }

    await pool.end();
    console.log('\nDone.');
})().catch(e => { console.error(e); process.exit(1); });
