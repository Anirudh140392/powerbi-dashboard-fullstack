import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';

async function test() {
    try {
        const sql = `
            SELECT * FROM (
                SELECT web_pid
                FROM product_snapshots
                WHERE company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979'
                ORDER BY snapshot_date DESC, created_at DESC
            ) LIMIT 1 BY web_pid
            SETTINGS max_memory_usage = 1000000000;
        `;
        const res = await clickhouse.query({
            database: 'prestige',
            query: sql,
            format: 'JSONEachRow'
        });
        console.log("Success with 1GB memory limit!");
    } catch(e) {
        console.error("ERROR:", e.message);
    }
}
test().catch(console.error);
