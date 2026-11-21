import axios from 'axios';
import 'dotenv/config';

async function test() {
    try {
        // Need a token, but I'll bypass by calling the service directly to check what it returns
        const { updateDatabaseInsights, getDatabaseInsights } = await import('./services/adminService.js');
        const dbId = '10203743397417368000'; // boat
        console.log("Old config:", await getDatabaseInsights(dbId));
        const res = await updateDatabaseInsights(dbId, { test: false });
        console.log("Update res:", res);
        console.log("New config:", await getDatabaseInsights(dbId));
    } catch(err) {
        console.error(err);
    }
    process.exit(0);
}
test();
