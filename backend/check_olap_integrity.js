import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse, getCurrentDbName } from './src/config/clickhouse.js';

async function check() {
    try {
        console.log("=== ClickHouse OLAP Integrity Check ===");

        // 1. Primary OLAP Check
        console.log("\n--- Primary OLAP (rb_primary_olap) ---");
        const primaryMeta = await queryClickHouse(`
            SELECT 
                count() as total_rows,
                min(toDate(billing_date)) as min_date,
                max(toDate(billing_date)) as max_date,
                SUM(toFloat64OrZero(toString(amount_inr))) as total_amount_inr,
                SUM(toInt64OrZero(toString(quantity))) as total_quantity
            FROM rb_primary_olap
            WHERE billing_date IS NOT NULL
        `);
        console.log(JSON.stringify(primaryMeta[0], null, 2));

        // 2. Secondary OLAP Check
        console.log("\n--- Secondary OLAP (rb_secondary_olap) ---");
        const secondaryMeta = await queryClickHouse(`
            SELECT 
                count() as total_rows,
                min(toDate(date)) as min_date,
                max(toDate(date)) as max_date,
                SUM(toFloat64OrZero(toString(\`MRP Sales Final\`))) as total_mrp_sales,
                SUM(toInt64OrZero(toString(qty))) as total_qty
            FROM rb_secondary_olap
            WHERE date IS NOT NULL
        `);
        console.log(JSON.stringify(secondaryMeta[0], null, 2));

    } catch (e) {
        console.error("Integrity check failed:", e);
    }
}
check();

