
import { queryClickHouse } from './src/config/clickhouse.js';

async function verify() {
    try {
        console.log('--- Checking for GMFC and Gold ---');
        const results = await queryClickHouse(`
            SELECT Category, Product_type, count() as count
            FROM rb_pdp_olap
            WHERE (lower(Category) LIKE '%gmfc%' OR lower(Product_type) LIKE '%gmfc%')
            GROUP BY Category, Product_type
            LIMIT 20
        `);
        console.log('Results:', JSON.stringify(results, null, 2));

        const plResults = await queryClickHouse(`
            SELECT DISTINCT Platform FROM rb_pdp_olap LIMIT 10
        `);
        console.log('Platforms:', JSON.stringify(plResults, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

verify();
