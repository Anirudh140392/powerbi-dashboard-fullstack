
import { queryClickHouse } from './src/config/clickhouse.js';

async function verifyDates() {
    try {
        console.log('--- Checking data for Blinkit + GMFC + Gold in Mar 2026 ---');
        const results = await queryClickHouse(`
            SELECT DATE, count() as count
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
              AND Category = 'GMFC'
              AND Product_type = 'Gold'
              AND DATE BETWEEN '2026-03-01' AND '2026-03-11'
            GROUP BY DATE
            ORDER BY DATE
        `);
        console.log('Results:', JSON.stringify(results, null, 2));

        const totalRes = await queryClickHouse(`
            SELECT count() as total
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
              AND Category = 'GMFC'
              AND Product_type = 'Gold'
              AND DATE BETWEEN '2026-03-01' AND '2026-03-11'
        `);
        console.log('Total count for period:', totalRes[0].total);

    } catch (err) {
        console.error('Error:', err);
    }
}

verifyDates();
