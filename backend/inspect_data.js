import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env from current directory (since we will run from backend/)
dotenv.config();

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
        let output = "";
        output += `URL: ${process.env.CLICKHOUSE_URL}\n`;
        output += `DB: ${process.env.CLICKHOUSE_DB}\n\n`;

        output += "--- Distinct Platforms ---\n";
        const platforms = await clickhouse.query({
            query: `SELECT DISTINCT Platform FROM rb_pdp_olap WHERE Platform IS NOT NULL AND Platform != '' ORDER BY Platform`,
            format: 'JSONEachRow'
        });
        const pList = await platforms.json();
        output += JSON.stringify(pList.map(r => r.Platform), null, 2) + "\n\n";

        output += "--- Distinct Brands (Sample) ---\n";
        const brands = await clickhouse.query({
            query: `SELECT DISTINCT Brand FROM rb_pdp_olap WHERE Brand IS NOT NULL AND Brand != '' LIMIT 10`,
            format: 'JSONEachRow'
        });
        const bList = await brands.json();
        output += JSON.stringify(bList.map(r => r.Brand), null, 2) + "\n\n";

        output += "--- Distinct Locations (Sample) ---\n";
        const locations = await clickhouse.query({
            query: `SELECT DISTINCT Location FROM rb_pdp_olap WHERE Location IS NOT NULL AND Location != '' LIMIT 10`,
            format: 'JSONEachRow'
        });
        const lList = await locations.json();
        output += JSON.stringify(lList.map(r => r.Location), null, 2) + "\n\n";

        output += "--- Data Count for Zepto ---\n";
        const zCount = await clickhouse.query({
            query: `SELECT count() as count FROM rb_pdp_olap WHERE Platform = 'Zepto'`,
            format: 'JSONEachRow'
        });
        const zCountJson = await zCount.json();
        output += JSON.stringify(zCountJson, null, 2) + "\n";

        fs.writeFileSync('inspection_result.txt', output);
        console.log("✅ Inspection Complete. Results written to inspection_result.txt");

    } catch (err) {
        console.error("❌ Error during inspection:", err);
    } finally {
        await clickhouse.close();
    }
}

inspect();
