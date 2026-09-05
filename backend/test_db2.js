import { queryAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    try {
        const rows = await queryAdminDB("SELECT * FROM admin_master.tb_alert WHERE alert_name LIKE '%Weekly%' LIMIT 5");
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
