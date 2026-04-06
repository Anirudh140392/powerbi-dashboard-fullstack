import { queryClickHouse } from './src/config/clickhouse.js';

async function testQuery() {
    try {
        console.log("Fetching distinct keyword types...");
        const query = `
            SELECT DISTINCT keyword_type 
            FROM rb_pm_olap 
            WHERE keyword_type IS NOT NULL AND keyword_type != ''
            ORDER BY keyword_type ASC
        `;
        const results = await queryClickHouse(query);
        console.log("Raw Results:", results);
        console.log("Final Extracted Keyword Types:", ['All', ...results.map(r => r.keyword_type)]);
        process.exit(0);
    } catch (e) {
        console.error("Query failed", e);
        process.exit(1);
    }
}
testQuery();
