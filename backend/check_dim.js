
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkDim() {
    try {
        console.log('--- Checking rca_sku_dim for GMFC and Gold ---');
        const results = await queryClickHouse(`
            SELECT platform, category, count() as count
            FROM rca_sku_dim
            WHERE lower(category) LIKE '%gmfc%' OR lower(category) LIKE '%gold%'
            GROUP BY platform, category
        `);
        console.log('Results:', JSON.stringify(results, null, 2));

        console.log('--- Checking for Gold brand/segment in rca_sku_dim ---');
        const results2 = await queryClickHouse(`
            SELECT DISTINCT category
            FROM rca_sku_dim
            WHERE platform = 'Blinkit'
        `);
        console.log('Blinkit Categories in Dim:', JSON.stringify(results2, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

checkDim();
