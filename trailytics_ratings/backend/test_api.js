import clickhouse from './src/config/clickhouse.js';

async function run() {
    try {
        const queryParams = { companyId: '297e37ea-a5ac-47df-bebd-ac44e52b7979' };
        const sql = `
            SELECT web_pid, max(product_name) as product_name, count() as review_count
            FROM ml_reviews
            WHERE company_id = {companyId:String}
            GROUP BY web_pid
            ORDER BY review_count DESC
            LIMIT 100
        `;
        const chRes = await clickhouse.query({ database: 'prestige', query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();
        console.log("Rows returned:", rows.length);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
