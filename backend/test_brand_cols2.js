import { queryClickHouse } from './src/config/clickhouse.js';

async function testBrandCols2() {
    try {
        const res = await queryClickHouse(`
            SELECT 
                DATE,
                countIf(brand = 'Snickers') as snickers_brand,
                countIf(brand_name_th = 'Mars') as mars_brand_th
            FROM rb_kw_olap
            WHERE DATE BETWEEN '2026-03-10' AND '2026-03-22'
              AND platform_name = 'Zepto'
            GROUP BY DATE
            ORDER BY DATE
        `);
        console.log(JSON.stringify(res, null, 2));
        process.exit(0);
    } catch (e) {
        process.exit(1);
    }
}
testBrandCols2();
