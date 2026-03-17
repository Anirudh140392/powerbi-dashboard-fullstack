
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkPlatforms() {
    try {
        console.log('--- Checking available platforms for GMFC + Gold in Mar 2026 ---');
        const results = await queryClickHouse(`
            SELECT Platform, count() as count
            FROM rb_pdp_olap
            WHERE Category = 'GMFC'
              AND Product_type = 'Gold'
              AND DATE BETWEEN '2026-03-01' AND '2026-03-11'
            GROUP BY Platform
        `);
        console.log('Results:', JSON.stringify(results, null, 2));

        console.log('--- Checking date range for GMFC + Gold (any platform) ---');
        const dateRes = await queryClickHouse(`
            SELECT MIN(DATE) as minDate, MAX(DATE) as maxDate
            FROM rb_pdp_olap
            WHERE Category = 'GMFC'
              AND Product_type = 'Gold'
        `);
        console.log('Date range for GMFC+Gold:', JSON.stringify(dateRes, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

checkPlatforms();
