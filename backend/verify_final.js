import { queryAdminDB } from './src/config/adminClickhouse.js';

async function verifyFinal() {
    try {
        const rows = await queryAdminDB(`SELECT user_email, last_login, ip, access FROM tb_user WHERE user_email = 'boat@trailytics.com' ORDER BY last_login DESC LIMIT 1`);
        console.log("Latest row for boat@trailytics.com:");
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
verifyFinal();
