
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSwap() {
    try {
        console.log('--- Checking for GMFC in Product_type ---');
        const res1 = await queryClickHouse(`
            SELECT count() as count
            FROM rb_pdp_olap
            WHERE lower(Product_type) = 'gmfc'
        `);
        console.log('GMFC in Product_type count:', res1[0].count);

        console.log('--- Checking for Gold in Category ---');
        const res2 = await queryClickHouse(`
            SELECT count() as count
            FROM rb_pdp_olap
            WHERE lower(Category) = 'gold'
        `);
        console.log('Gold in Category count:', res2[0].count);

        console.log('--- Checking for Gold in Category (partial) ---');
        const res3 = await queryClickHouse(`
            SELECT Category, count() as count
            FROM rb_pdp_olap
            WHERE lower(Category) LIKE '%gold%'
            GROUP BY Category
        `);
        console.log('Categories matching Gold:', JSON.stringify(res3, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

checkSwap();
