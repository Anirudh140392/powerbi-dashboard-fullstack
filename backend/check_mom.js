import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkMom() {
    try {
        const res = await queryClickHouse(`
            SELECT 
                toStartOfMonth(toDate(billing_date)) as month_start,
                formatDateTime(toDate(billing_date), '%b-%y') as month_label,
                sum(toFloat64OrZero(toString(amount_inr))) as sales_inr,
                sum(toFloat64OrZero(toString(net_amount))) * 100000 as sales_from_net
            FROM rb_primary_olap
            GROUP BY month_start, month_label
            ORDER BY month_start DESC
            LIMIT 12
        `);
        console.log("MOM Sales Comparison (Last 12 months):");
        console.table(res);
    } catch (e) {
        console.error(e);
    }
}
checkMom();
