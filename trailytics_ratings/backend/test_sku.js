import 'dotenv/config';
import clickhouse from './src/config/clickhouse.js';

async function test() {
    try {
        const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, product_name, pareto_status, rating, price_rp, price_sp, category
                    FROM product_snapshots
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            )
            SELECT
                r.web_pid,
                any(coalesce(nullIf(mp.product_name, ''), nullIf(ls.product_name, ''), r.web_pid)) AS product_name,
                any(ls.rating) AS pdp_rating,
                any(coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, ''))) AS pareto_status,
                count() AS review_count
            FROM ml_reviews r
            LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
            LEFT JOIN latest_snapshots ls ON ls.web_pid = r.web_pid AND lower(ls.platform) = lower(r.platform)
            GROUP BY r.web_pid
            ORDER BY review_count DESC
            LIMIT 10
        `;
        const res = await clickhouse.query({
            database: 'danone',
            query: sql,
            format: 'JSONEachRow'
        });
        const data = await res.json();
        console.log("Returned rows:", data.length);
        console.log(data);
    } catch (err) {
        console.error("Error:", err.message);
    }
}
test();
