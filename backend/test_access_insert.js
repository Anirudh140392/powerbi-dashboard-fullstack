import { insertAdminDB, queryAdminDB } from './src/config/adminClickhouse.js';

async function testInsert() {
    try {
        const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        const testId = Math.floor(Math.random() * 10000000);
        
        console.log("Testing insertAdminDB...");
        await insertAdminDB('tb_user', [{
            id: testId,
            user_id: 12345,
            user_email: 'test_access@trailytics.com',
            user_name: 'Test Access',
            user_role: 'user',
            password_hash: 'hash',
            db_id: 10203743397417368000,
            last_login: timestamp,
            created_on: timestamp,
            status: 'active',
            ip: '1.2.3.4',
            access: 'pending'
        }]);
        
        console.log("Verifying result...");
        const result = await queryAdminDB(`SELECT user_email, access FROM tb_user WHERE user_email = 'test_access@trailytics.com'`);
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Test failed:", e);
    }
    process.exit();
}
testInsert();
