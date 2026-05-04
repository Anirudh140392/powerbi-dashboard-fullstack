import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const result = await queryClickHouse(`
            SELECT DISTINCT keyword_type 
            FROM rb_kw_olap 
            WHERE keyword_type IS NOT NULL AND keyword_type != ''
        `, 'mamaearth');
        console.log("Distinct keyword_types in mamaearth:", result);
    } catch (e) {
        console.error("Error querying ClickHouse:", e);
    }
}
run();
