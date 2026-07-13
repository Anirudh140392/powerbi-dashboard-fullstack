import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { getPermissionsUsers } from '../src/services/adminService.js';

async function check() {
    try {
        const users = await getPermissionsUsers();
        console.log("Returned users from getPermissionsUsers():");
        users.forEach(u => {
            console.log(`Email: ${u.email}, Name: ${u.name}, dbName: ${u.dbName}, dbStatus: ${u.dbStatus}`);
        });
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
check();
