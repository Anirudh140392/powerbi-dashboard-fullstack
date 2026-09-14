import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';

async function main() {
    const countQuery = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp AS ps_price_rp, price_sp AS ps_price_sp, rating AS ps_rating, rating_count AS ps_rating_count
                    FROM product_snapshots
                    WHERE company_id = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b'
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            )
            SELECT count() AS count
            FROM products p
            LEFT JOIN latest_snapshots ps ON ps.web_pid = p.product_external_id AND lower(ps.platform) = lower(p.platform)
            WHERE p.company_id = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b'
        `;
    const res = await clickhouse.query({
        database: 'danone',
        query: countQuery,
        format: 'JSONEachRow'
    }).then(r => r.json()).catch(e => e.message);
    console.log("countQuery result:", res);
}
main().catch(console.error);
