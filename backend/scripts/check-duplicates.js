import { queryClickHouse } from '../src/config/clickhouse.js';

async function test() {
    console.log("--- rca_sku_dim duplicates for join key ---");
    const q1 = await queryClickHouse(`
        SELECT lower(platform) as p, lower(location) as l, lower(brand_name) as b, lower(Category) as c, count(*) as cnt 
        FROM rca_sku_dim 
        GROUP BY p, l, b, c 
        HAVING cnt > 1 
        ORDER BY cnt DESC 
        LIMIT 10
    `);
    console.log(JSON.stringify(q1, null, 2));

    console.log("--- Total records if join is many-to-many ---");
    const q2 = await queryClickHouse(`
        SELECT count(*) as total_rows
        FROM rb_pdp_olap t1
        JOIN rca_sku_dim t2 ON lower(t1.Platform) = lower(t2.platform) 
            AND lower(t1.Location) = lower(t2.location) 
            AND lower(t1.Brand) = lower(t2.brand_name) 
            AND lower(t1.Category) = lower(t2.Category)
        WHERE t1.DATE BETWEEN '2026-03-01' AND '2026-03-04'
          AND t2.status = 1
    `);
    console.log(JSON.stringify(q2, null, 2));
}

test();
