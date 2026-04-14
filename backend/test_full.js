import { queryAdminDB, insertAdminDB } from './src/config/adminClickhouse.js';
import { updateUserAccess } from './src/services/adminService.js';

async function test() {
    try {
        const id = Date.now().toString();
        console.log("Creating dummy row with id", id);
        await insertAdminDB('tb_user', [{
            id: id,
            user_id: "1234",
            user_email: "dummy@test.com",
            user_name: "Dummy",
            user_role: "user",
            password_hash: "hash",
            db_id: "1",
            last_login: new Date().toISOString().replace('T', ' ').split('.')[0],
            created_on: new Date().toISOString().replace('T', ' ').split('.')[0],
            status: "active",
            ip: "0.0.0.0",
            access: "pending",
            db_status: "active",
            tab_permissions: ""
        }]);
        
        console.log("Updating access...");
        await updateUserAccess(id, 'allow', 'New Dummy Name');
        console.log("All done!");
    } catch (e) {
        console.error("Caught error:", e);
    }
}
test();
