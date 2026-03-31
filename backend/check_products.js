import { queryClickHouse } from './src/config/clickhouse.js';

async function checkProducts() {
    try {
        const query = `
            SELECT 
                Product, 
                count(*) as cnt
            FROM rb_pdp_olap
            WHERE DATE >= '2026-03-01'
            GROUP BY Product
            ORDER BY cnt DESC
            LIMIT 50
        `;
        const results = await queryClickHouse(query);
        console.log('Sample Products:', JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

checkProducts();
