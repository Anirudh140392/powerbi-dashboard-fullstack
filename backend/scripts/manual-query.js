import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const query = `
            SELECT 
                t1.Product as name,
                t1.Web_Pid as sku,
                t1.Location as city,
                t1.Platform as platform,
                t1.Category as format,
                t1.DATE,
                SUM(ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0)) as sum_neno,
                SUM(ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0)) as sum_deno
            FROM rb_pdp_olap t1
            JOIN rca_sku_dim t2 ON lower(t1.Platform) = lower(t2.platform) 
                AND lower(t1.Location) = lower(t2.location) 
                AND lower(t1.Brand) = lower(t2.brand_name) 
                AND lower(t1.Category) = lower(t2.Category)
            WHERE t1.DATE BETWEEN '2026-03-01' AND '2026-03-04'
              AND t2.status = 1
            GROUP BY t1.Product, t1.Web_Pid, t1.Location, t1.Platform, t1.Category, t1.DATE
            ORDER BY t1.Product, t1.Web_Pid, t1.Location, t1.DATE
            LIMIT 10
        `;
        const data = await queryClickHouse(query);
        console.log("Success! Sample row:", JSON.stringify(data[0], null, 2));
        process.exit(0);
    } catch (e) {
        console.error("FAILED manual query:", e);
        process.exit(1);
    }
}

test();
