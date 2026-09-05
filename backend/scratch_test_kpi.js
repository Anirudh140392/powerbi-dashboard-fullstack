import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { setCurrentDbName, queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    setCurrentDbName('mamaearth');
    const startStr = '2026-03-01';
    const endStr = '2026-06-13';

    const subCatQuery = `
        SELECT DISTINCT sub_category
        FROM rb_ms_olap
        WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
          AND category IN ('face care')
        ORDER BY sub_category
    `;

    console.log("Running direct query on rb_ms_olap...");
    const res = await queryClickHouse(subCatQuery);
    console.log("SubCategories:", res.map(r => r.sub_category));
    process.exit(0);
}
run();
