import { queryAdminDB } from '../config/adminClickhouse.js';
async function run() {
    const rows = await queryAdminDB(`SELECT alert_name, alert_type FROM admin_master.tb_alert`);
    console.log(rows);
}
run().catch(console.error);
