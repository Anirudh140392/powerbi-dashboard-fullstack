import { insertAdminDB, queryAdminDB } from './src/config/adminClickhouse.js';
import { updateUserAccess } from './src/services/adminService.js';

async function finalVerification() {
    try {
        const testRowId = Date.now().toString();
        const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        
        console.log("Creating test row with unique ID:", testRowId);
        await insertAdminDB('tb_user', [{
            id: testRowId,
            user_id: 999999,
            user_email: 'id_test@trailytics.com',
            user_name: 'ID Test',
            user_role: 'user',
            password_hash: 'hash',
            db_id: 1,
            last_login: timestamp,
            created_on: timestamp,
            status: 'active',
            ip: '1.1.1.1',
            access: 'pending'
        }]);

        console.log("Allowing access...");
        await updateUserAccess(testRowId, 'allow');

        console.log("Verifying result...");
        const rows = await queryAdminDB(`SELECT user_email, access FROM tb_user WHERE toString(id) = '${testRowId}'`);
        console.log(JSON.stringify(rows[0], null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
finalVerification();
