import 'dotenv/config';
import { queryClickHouse } from '../src/config/clickhouse.js';

async function main() {
    try {
        console.log("=== Querying ClickHouse for Sales ===");
        const q1 = `
            SELECT
                count() as total_rows,
                count(Sales) as count_sales,
                sum(isNull(Sales)) as null_sales,
                sum(Sales) as sum_sales,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sum_sales_converted
            FROM rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '2026-07-06' AND '2026-07-07'
              AND lower(Platform) = 'amazon'
              AND Comp_flag = 0
        `;
        const res1 = await queryClickHouse(q1);
        console.log("Results on amazon:", JSON.stringify(res1, null, 2));

        const q2 = `
            SELECT DISTINCT Platform, toDate(DATE) as d, count() as total, sum(isNull(Sales)) as nulls, sum(Sales) as sumSales
            FROM rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '2026-07-06' AND '2026-07-07'
            GROUP BY Platform, d
        `;
        const res2 = await queryClickHouse(q2);
        console.log("Summary across platforms:", JSON.stringify(res2, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
}

main();
