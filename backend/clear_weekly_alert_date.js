import { queryAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    try {
        await queryAdminDB("ALTER TABLE admin_master.tb_alert UPDATE last_email_sent = NULL WHERE alert_name LIKE '%Weekly%'");
        console.log("Cleared last_email_sent for weekly alerts");
    } catch (e) {
        console.error(e);
    }
}
test();
