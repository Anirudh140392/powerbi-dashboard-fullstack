import 'dotenv/config';
import { queryAdminDB } from './src/config/adminClickhouse.js';

try {
    const rows = await queryAdminDB(
        `SELECT user_email, user_role, access, ip, toString(last_login) as ll 
         FROM tb_user 
         WHERE user_email IN ('mamaearth@trailytics.com', 'sanyamadmin@trailytics.com') 
         ORDER BY last_login DESC 
         LIMIT 10`
    );
    console.log(JSON.stringify(rows, null, 2));
} catch (e) {
    console.error('Error:', e.message);
}
process.exit(0);
