
import { queryClickHouse } from './src/config/clickhouse.js';

async function verifyCombos() {
    try {
        console.log('--- Checking Product_types for Blinkit + GMFC ---');
        const results = await queryClickHouse(`
            SELECT Product_type, count() as count
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
              AND Category = 'GMFC'
            GROUP BY Product_type
        `);
        console.log('Results (Blinkit + GMFC):', JSON.stringify(results, null, 2));

        console.log('--- Checking Categories for Blinkit + Gold ---');
        const ptResults = await queryClickHouse(`
            SELECT Category, count() as count
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
              AND Product_type = 'Gold'
            GROUP BY Category
        `);
        console.log('Results (Blinkit + Gold):', JSON.stringify(ptResults, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

verifyCombos();
