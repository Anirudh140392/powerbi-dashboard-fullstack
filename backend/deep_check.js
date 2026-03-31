
import { queryClickHouse } from './src/config/clickhouse.js';

async function deepCheck() {
    try {
        console.log('--- Checking available Categories for Blinkit (1-11 March 2026) ---');
        const cats = await queryClickHouse(`
            SELECT Category, count() as count
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
              AND DATE BETWEEN '2026-03-01' AND '2026-03-11'
            GROUP BY Category
        `);
        console.log('Categories:', JSON.stringify(cats, null, 2));

        console.log('--- Checking available Product_types for Blinkit (1-11 March 2026) ---');
        const pts = await queryClickHouse(`
            SELECT Product_type, count() as count
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
              AND DATE BETWEEN '2026-03-01' AND '2026-03-11'
            GROUP BY Product_type
        `);
        console.log('Product Types:', JSON.stringify(pts, null, 2));

        console.log('--- Checking for any GMFC + Gold combination anywhere in Mar 2026 ---');
        const combos = await queryClickHouse(`
            SELECT Platform, Category, Product_type, count() as count
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '2026-03-01' AND '2026-03-11'
              AND (Category = 'GMFC' OR Product_type = 'Gold')
            GROUP BY Platform, Category, Product_type
        `);
        console.log('Combinations:', JSON.stringify(combos, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

deepCheck();
