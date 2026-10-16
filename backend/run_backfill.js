import { queryAdminDB } from './src/config/adminClickhouse.js';

async function runBackfill() {
    try {
        console.log("Starting backfill for access column...");
        await queryAdminDB("ALTER TABLE tb_user UPDATE access = 'pending' WHERE (access = '' OR access IS NULL) AND ip != ''");
        console.log("Backfill mutation started successfully.");
    } catch (e) {
        console.error("Backfill failed:", e);
    }
    process.exit();
}
runBackfill();
