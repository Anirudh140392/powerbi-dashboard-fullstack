import { queryAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    try {
        const rows = await queryAdminDB("SELECT * FROM admin_master.tb_alert ORDER BY alert_id DESC LIMIT 5");
        console.log(rows);
    } catch (e) {
        console.error(e);
    }
}
test();
