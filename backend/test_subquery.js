import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const query = `
            SELECT 
                category,
                SUM(if(lower(group_brand) IN (SELECT DISTINCT lower(brand_name) FROM rca_sku_dim WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL), toFloat64OrZero(toString(sales)), 0)) AS our_sales
            FROM rb_ms_olap
            GROUP BY category
            LIMIT 2
        `;
        const res = await queryClickHouse(query);
        console.log("Success:", res);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
