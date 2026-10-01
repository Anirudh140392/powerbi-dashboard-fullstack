import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
    host: 'http://localhost:8123',
    username: 'default',
    password: '',
    database: 'prestige'
});

async function run() {
    try {
        const queryParams = { companyId: '1' };
        let extraWhere = ''; // Simulate no extra filters first
        const recentPeriodFilter = `r.review_date >= addMonths(today(), -6)`;
        const priorPeriodFilter = `r.review_date >= addMonths(today(), -12) AND r.review_date < addMonths(today(), -6)`;
        const combinedWindowFilter = `r.review_date >= addMonths(today(), -12)`;

        const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, pareto_status
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                )
                LIMIT 1 BY web_pid, lower(platform)
            ),
            scoped_reviews AS (
                SELECT
                    REPLACE(coalesce(nullIf(r.sentiment_subcategory, ''), nullIf(r.sentiment_category, ''), 'General'), '_', ' ') AS characteristic,
                    CASE WHEN ${recentPeriodFilter} THEN 'recent' WHEN ${priorPeriodFilter} THEN 'prior' ELSE NULL END AS period,
                    r.sentiment
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
                WHERE r.company_id = {companyId:String} AND isNotNull(r.review_date) AND ${combinedWindowFilter} ${extraWhere}
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

        const chRes = await clickhouse.query({ query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();
        console.log("Rows fetched:", rows.length);
        console.log("Sample:", rows.slice(0, 2));

        const escalating = rows.filter(r => r.change > 0.01 && r.recent_neg_rate > 0.10).slice(0, 10);
        console.log("Escalating:", escalating.length);

        const improving = rows.filter(r => r.change < -0.01).slice(0, 10);
        console.log("Improving:", improving.length);

    } catch (err) {
        console.error("Error:", err.message);
    }
}
run();
