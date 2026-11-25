import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function run() {
    try {
        const alerts = await queryAdminDB("SELECT alert_name, send_email FROM admin_master.tb_alert LIMIT 5");
        console.log(alerts);
    } catch(e) {
        console.error(e);
    }
}
run();
