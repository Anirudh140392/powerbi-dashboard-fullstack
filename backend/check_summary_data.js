import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse, getCurrentDbName } from './src/config/clickhouse.js';

async function check() {
    try {
        const dbName = getCurrentDbName();
        console.log("Current Database from clickhouse config:", dbName);

        // Check if rb_primary_olap table exists and get count
        try {
            const countRes = await queryClickHouse(`SELECT count() as c FROM rb_primary_olap`);
            console.log("rb_primary_olap count:", countRes[0]?.c);
            
            const sampleRes = await queryClickHouse(`SELECT * FROM rb_primary_olap LIMIT 1`);
            console.log("rb_primary_olap sample row:", JSON.stringify(sampleRes[0], null, 2));
        } catch (e) {
            console.error("Error querying rb_primary_olap:", e.message);
        }

        // Check if rb_secondary_olap table exists and get count
        try {
            const countRes2 = await queryClickHouse(`SELECT count() as c FROM rb_secondary_olap`);
            console.log("rb_secondary_olap count:", countRes2[0]?.c);
            
            const sampleRes2 = await queryClickHouse(`SELECT * FROM rb_secondary_olap LIMIT 1`);
            console.log("rb_secondary_olap sample row:", JSON.stringify(sampleRes2[0], null, 2));
        } catch (e) {
            console.error("Error querying rb_secondary_olap:", e.message);
        }
    } catch (err) {
        console.error("Check failed:", err);
    }
}
check();
