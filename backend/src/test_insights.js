import { updateDatabaseInsights } from './services/adminService.js';
import { createClient } from '@clickhouse/client';

async function test() {
    try {
        const dbId = '10614243825770911750'; // prestige (290 users)
        console.log("Updating prestige...");
        const res = await updateDatabaseInsights(dbId, { share_headroom_hotspots: false });
        console.log("Result:", res);
    } catch (err) {
        console.error("Test failed:", err);
    }
    process.exit(0);
}
test();
