
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkBlinkit() {
    try {
        console.log('--- Checking categories for Blinkit in Mar 1-11, 2026 ---');
        const results = await queryClickHouse(`
            SELECT Category, count() as count
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
              AND DATE BETWEEN '2026-03-01' AND '2026-03-11'
            GROUP BY Category
        `);
        console.log('Results (Categories):', JSON.stringify(results, null, 2));

        console.log('--- Checking Product_types for Blinkit in Mar 1-11, 2026 ---');
        const ptResults = await queryClickHouse(`
            SELECT Product_type, count() as count
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
              AND DATE BETWEEN '2026-03-01' AND '2026-03-11'
            GROUP BY Product_type
        `);
        console.log('Results (Product_types):', JSON.stringify(ptResults, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

checkBlinkit();