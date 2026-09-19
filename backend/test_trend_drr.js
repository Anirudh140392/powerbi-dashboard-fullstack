process.env.CLICKHOUSE_DB = 'mars';

async function run() {
    try {
        const { queryClickHouse } = await import('./src/config/clickhouse.js');
        const q1 = `
            SELECT 
                Platform, Category, Brand, Product, Location,
                SUM(toFloat64OrZero(toString(Sales))) AS total_sales_30d,
                SUM(toFloat64OrZero(toString(Sales))) / 30.0 AS drr
            FROM rb_pdp_olap
            WHERE LOWER(Platform) = 'blinkit'
              AND LOWER(Category) = 'chocolates (non gifting)'
              AND LOWER(Brand) = 'galaxy'
              AND LOWER(Product) = 'galaxy mini'
              AND LOWER(Location) = 'delhi'
              AND DATE BETWEEN toDate('2026-05-26') - 29 AND toDate('2026-05-26')
              AND Comp_flag IN (0, '0')
            GROUP BY Platform, Category, Brand, Product, Location
        `;
        const r1 = await queryClickHouse(q1);
        console.log('Result 1:', JSON.stringify(r1, null, 2));

        const q2 = `
            SELECT 
                p.Platform, p.Category, p.Brand, p.Product, p.Location,
                SUM(toFloat64OrZero(toString(p.Sales))) AS total_sales_30d
            FROM rb_pdp_olap p
            WHERE LOWER(p.Platform) = 'blinkit'
              AND LOWER(p.Category) = 'chocolates (non gifting)'
              AND LOWER(p.Brand) = 'galaxy'
              AND LOWER(p.Product) = 'galaxy mini'
              AND LOWER(p.Location) = 'delhi'
              AND p.DATE BETWEEN toDate('2026-05-26') - 29 AND toDate('2026-05-26')
              AND p.Comp_flag IN (0, '0')
            GROUP BY p.Platform, p.Category, p.Brand, p.Product, p.Location
        `;
        const r2 = await queryClickHouse(q2);
        console.log('Result 2:', JSON.stringify(r2, null, 2));
    } catch (e) {
        console.error(e);
    }
}

run();
