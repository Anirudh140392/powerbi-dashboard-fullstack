import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve('backend', '.env') });

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
    request_timeout: 60000,
});

async function inspect() {
    try {
        console.log("Connecting to ClickHouse...");

        console.log("\n--- Distinct Platforms ---");
        const platforms = await clickhouse.query({
            query: `SELECT DISTINCT Platform FROM rb_pdp_olap WHERE Platform IS NOT NULL AND Platform != '' ORDER BY Platform`,
            format: 'JSONEachRow'
        });
        const pList = await platforms.json();
        console.log(pList.map(r => r.Platform));

        console.log("\n--- Distinct Brands (Sample) ---");
        const brands = await clickhouse.query({
            query: `SELECT DISTINCT Brand FROM rb_pdp_olap WHERE Brand IS NOT NULL AND Brand != '' LIMIT 10`,
            format: 'JSONEachRow'
        });
        const bList = await brands.json();
        console.log(bList.map(r => r.Brand));

        console.log("\n--- Distinct Locations (Sample) ---");
        const locations = await clickhouse.query({
            query: `SELECT DISTINCT Location FROM rb_pdp_olap WHERE Location IS NOT NULL AND Location != '' LIMIT 10`,
            format: 'JSONEachRow'
        });
        const lList = await locations.json();
        console.log(lList.map(r => r.Location));

        console.log("\n--- Data Count for Zepto ---");
        const zCount = await clickhouse.query({
            query: `SELECT count() as count FROM rb_pdp_olap WHERE Platform = 'Zepto'`,
            format: 'JSONEachRow'
        });
        console.log(await zCount.json());

        console.log("\n✅ Inspection Complete.");

    } catch (err) {
        console.error("❌ Error during inspection:", err);
    } finally {
        await clickhouse.close();
    }
}

inspect();
