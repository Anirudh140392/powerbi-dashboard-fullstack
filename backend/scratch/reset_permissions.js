import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function reset() {
    try {
        console.log("Resetting all users' tab_permissions to '{}'...");
        await queryAdminDB("ALTER TABLE tb_user UPDATE tab_permissions = '{}' WHERE status != 'deleted'");
        console.log("Successfully reset all user permissions in ClickHouse!");
    } catch (e) {
        console.error("Failed to reset permissions:", e);
    }
    process.exit(0);
}

reset();
