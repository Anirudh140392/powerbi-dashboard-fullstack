import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function run() {
    try {
        const alerts = await queryAdminDB("SELECT id, alert_name, alert_type FROM admin_master.tb_alert WHERE alert_name LIKE '%Keyword%'");
        console.log(alerts);
    } catch(e) {
        console.error(e);
    }
}
run();
