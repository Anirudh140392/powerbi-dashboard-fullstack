import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
    username: process.env.CLICKHOUSE_USER || 'kenil_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'Kenil@Kavar0604',
    database: 'pidilite',
});

async function run() {
    try {
        console.log("Checking unique Location from rb_pdp_olap (capital L)...");
        const result = await client.query({
            query: "SELECT DISTINCT Location FROM rb_pdp_olap LIMIT 100",
            format: 'JSONEachRow',
        });
        const locations = await result.json();
        console.log("Locations in rb_pdp_olap:", locations.map(l => l.Location));

        console.log("\nChecking unique location/Location/city/City from rb_location_darkstore...");
        try {
            const locResult = await client.query({
                query: "SELECT DISTINCT location FROM rb_location_darkstore LIMIT 100",
                format: 'JSONEachRow',
            });
            const darkstoreLocations = await locResult.json();
            console.log("location in rb_location_darkstore:", darkstoreLocations.map(l => l.location));
        } catch (e) {
            console.log("Failed to query location from rb_location_darkstore:", e.message);
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
