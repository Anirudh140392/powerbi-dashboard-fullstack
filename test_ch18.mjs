import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';

async function main() {
    const q = "SELECT r.platform AS platform, r.web_pid AS web_pid, r.product_name AS product_name, r.rating AS rating FROM ml_reviews r LIMIT 1";
    const res = await clickhouse.query({
        database: 'danone',
        query: q,
        format: 'JSONEachRow'
    }).then(r => r.json()).catch(e => e.message);
    console.log("alias test:", res);
}
main().catch(console.error);
