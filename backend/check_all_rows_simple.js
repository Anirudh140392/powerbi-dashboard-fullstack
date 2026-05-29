import { queryAdminDB } from './src/config/adminClickhouse.js';

async function checkRows() {
    try {
        const rows = await queryAdminDB(`
            SELECT user_email, last_login, ip, access 
            FROM tb_user 
            WHERE user_email = 'boat@trailytics.com' 
            ORDER BY last_login DESC
        `);
        console.log("Found", rows.length, "rows");
        rows.forEach((r, i) => {
            console.log(`ROW ${i}: email=${r.user_email}, date=${r.last_login}, ip=${r.ip}, access='${r.access}'`);
        });
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
checkRows();
