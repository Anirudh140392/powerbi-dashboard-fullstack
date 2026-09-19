
import { queryClickHouse } from './src/config/clickhouse.js';

async function findLatest() {
    try {
        console.log('--- Finding latest date for Blinkit + GMFC + Gold ---');
        const results = await queryClickHouse(`
            SELECT MAX(DATE) as maxDate
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
              AND Category = 'GMFC'
              AND Product_type = 'Gold'
        `);
        console.log('Results:', JSON.stringify(results, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

findLatest();
