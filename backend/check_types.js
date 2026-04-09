import { queryAdminDB } from './src/config/adminClickhouse.js';

async function checkTypes() {
    try {
        const users = await queryAdminDB(`SELECT * FROM tb_user WHERE user_email = 'boat@trailytics.com' LIMIT 1`);
        const user = users[0];
        console.log("Types of fields:");
        for (const key in user) {
            console.log(`${key}: ${typeof user[key]} (${user[key]})`);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
checkTypes();
