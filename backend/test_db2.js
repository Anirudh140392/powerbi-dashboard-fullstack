import { queryClickHouse } from './src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    process.env.CLICKHOUSE_DB = 'mars'; // Force db
    try {
        const query = `
            SELECT toMonday(toDate(DATE)) as week_date, SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as total_sales 
            FROM mars.rb_pdp_olap 
            WHERE DATE BETWEEN '2024-01-01' AND '2024-03-31'
            GROUP BY toMonday(toDate(DATE))
            ORDER BY week_date
        `;
        const res = await queryClickHouse(query);
        console.log("Original Result:", res);
        const sum = res.reduce((s, r) => s + parseFloat(r.total_sales), 0);
        console.log("Sum:", sum);
    } catch (err) {
        console.error("Error:", err);
    }
}
test();
