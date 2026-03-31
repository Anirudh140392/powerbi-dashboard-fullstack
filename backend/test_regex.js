import { queryClickHouse } from './src/config/clickhouse.js';

async function testRegex() {
    try {
        const query = `
            SELECT 
                Product,
                extract(Product, '([0-9.]+)\\s*(g|kg|ml|l|L|ml|G|KG|ML|GM|gm|Gm)') as weight_str
            FROM rb_pdp_olap
            WHERE Product LIKE '%g%' OR Product LIKE '%ml%'
            LIMIT 20
        `;
        const results = await queryClickHouse(query);
        console.log('Regex Results:', JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

testRegex();
