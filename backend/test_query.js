import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const query = `
            SELECT DISTINCT location_name, platform_name, keyword_search_product 
            FROM rb_kw_olap 
            WHERE lower(platform_name) IN ('amazon', 'flipkart')
            LIMIT 20
        `;
        const results = await queryClickHouse(query);
        console.log('Results:', JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
