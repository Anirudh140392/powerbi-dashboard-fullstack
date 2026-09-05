import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';
const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, pareto_status
                    FROM product_snapshots
                    WHERE company_id = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b'
                    ORDER BY snapshot_date DESC, created_at DESC
                )
                LIMIT 1 BY web_pid, lower(platform)
            ),
            scoped_reviews AS (
                SELECT
                    REPLACE(coalesce(nullIf(r.sentiment_subcategory, ''), nullIf(r.sentiment_category, ''), 'General'), '_', ' ') AS characteristic,
                    CASE WHEN r.review_date >= subtractMonths(today(), 6) THEN 'recent' WHEN r.review_date >= subtractMonths(today(), 12) AND r.review_date < subtractMonths(today(), 6) THEN 'prior' ELSE NULL END AS period,
                    r.sentiment
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
                WHERE r.company_id = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b' AND isNotNull(r.review_date) AND r.review_date >= subtractMonths(today(), 12) AND coalesce(r.is_competitor, 0) = 0
            ),
            aggregated AS (
                SELECT characteristic, countIf(period = 'recent') AS recent_total, countIf(period = 'recent' AND sentiment = 'Negative') AS recent_neg, countIf(period = 'recent' AND sentiment = 'Positive') AS recent_pos, countIf(period = 'prior') AS prior_total, countIf(period = 'prior' AND sentiment = 'Negative') AS prior_neg, countIf(period = 'prior' AND sentiment = 'Positive') AS prior_pos
                FROM scoped_reviews WHERE isNotNull(period) GROUP BY characteristic
            )
            SELECT characteristic, recent_total, recent_neg, recent_pos, prior_total, prior_neg, prior_pos,
                CASE WHEN recent_total > 0 THEN toFloat64(recent_neg) / recent_total ELSE 0 END AS recent_neg_rate,
                CASE WHEN prior_total > 0 THEN toFloat64(prior_neg) / prior_total ELSE 0 END AS prior_neg_rate,
                (CASE WHEN recent_total > 0 THEN toFloat64(recent_neg) / recent_total ELSE 0 END) - (CASE WHEN prior_total > 0 THEN toFloat64(prior_neg) / prior_total ELSE 0 END) AS change
            FROM aggregated
            WHERE characteristic NOT IN ('General Feedback', 'Overall Quality', 'General') AND recent_total >= 5 AND prior_total >= 5
            ORDER BY change DESC
`;
clickhouse.query({ database: 'prestige', query: sql, format: 'JSONEachRow' }).then(r => r.json()).then(console.log).catch(console.error).finally(() => process.exit(0));
