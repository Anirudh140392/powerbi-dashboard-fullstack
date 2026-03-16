
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkDimProducts() {
    try {
        console.log('--- Checking Product Types for Blinkit + GMFC in rca_sku_dim ---');
        const results = await queryClickHouse(`
            SELECT platform, category, product_category, count() as count
            FROM rca_sku_dim
            WHERE platform = 'Blinkit' AND category = 'GMFC'
            GROUP BY platform, category, product_category
        `);
        console.log('Results:', JSON.stringify(results, null, 2));

        console.log('--- Checking where Gold is in rca_sku_dim for Blinkit ---');
        const results2 = await queryClickHouse(`
            SELECT platform, category, product_category, count() as count
            FROM rca_sku_dim
            WHERE platform = 'Blinkit' AND product_category = 'Gold'
            GROUP BY platform, category, product_category
        `);
        console.log('Gold Results:', JSON.stringify(results2, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

checkDimProducts();
