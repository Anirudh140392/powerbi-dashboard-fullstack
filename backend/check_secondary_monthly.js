import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSecondary() {
    try {
        const result = await queryClickHouse(`
            SELECT 
                toStartOfMonth(toDate(date)) as month_start,
                count() as rows,
                sum(toFloat64OrZero(toString(\`MRP Sales Final\`))) as mrp_sales,
                sum(toInt64OrZero(toString(qty))) as qty
            FROM rb_secondary_olap
            GROUP BY month_start
            ORDER BY month_start DESC
            LIMIT 12
        `);
        console.log("Monthly distribution in rb_secondary_olap:");
        console.table(result);
    } catch (e) {
        console.error(e);
    }
}
checkSecondary();
