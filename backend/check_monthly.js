import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkMonthly() {
    try {
        const result = await queryClickHouse(`
            SELECT 
                toStartOfMonth(toDate(billing_date)) as month_start,
                count() as rows,
                sum(toFloat64OrZero(toString(amount_inr))) as amount_inr,
                sum(toFloat64OrZero(toString(net_amount))) as net_amount,
                sum(toFloat64OrZero(toString(gross_amount))) as gross_amount
            FROM rb_primary_olap
            GROUP BY month_start
            ORDER BY month_start ASC
            LIMIT 5
        `);
        console.log("Monthly distribution of different sales metrics in rb_primary_olap:");
        console.table(result);
    } catch (e) {
        console.error(e);
    }
}
checkMonthly();
