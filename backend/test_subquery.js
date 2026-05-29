import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    process.env.CLICKHOUSE_DB = 'mars';
    try {
        const query = `
            SELECT 
                Date, 
                (SELECT sum(Sales) FROM rb_pdp_olap WHERE Platform = 'Blinkit' AND Date = '2026-03-29') as offtake 
            FROM rb_pdp_olap 
            WHERE Date = '2026-03-29' 
            LIMIT 1
        `;
        const res = await queryClickHouse(query);
        console.table(res);
    } catch(e) {
        console.error("Query Failed:", e.message);
    }
}

run();
