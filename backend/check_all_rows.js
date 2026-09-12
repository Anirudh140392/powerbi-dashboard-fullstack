import { queryAdminDB } from './src/config/adminClickhouse.js';

async function checkRows() {
    try {
        const rows = await queryAdminDB(`
            SELECT user_email, last_login, ip, access 
            FROM tb_user 
            WHERE user_email = 'boat@trailytics.com' 
            ORDER BY last_login DESC
        `);
        console.log("Found", rows.length, "rows for boat@trailytics.com");
        console.table(rows);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
checkRows();
