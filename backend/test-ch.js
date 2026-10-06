import * as dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const query1 = `
            SELECT SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as total_sales
            FROM rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '2026-02-01' AND '2026-02-21' AND Comp_flag = 0
        `;
        const result1 = await queryClickHouse(query1);
        console.log("Q1 (21 days):", result1);

        const query2 = `
            SELECT SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as total_sales
            FROM rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '2026-01-02' AND '2026-02-21' AND Comp_flag = 0
        `;
        const result2 = await queryClickHouse(query2);
        console.log("Q2 (51 days):", result2);
        
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
