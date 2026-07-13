import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { loginUser } from '../src/services/authService.js';
import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function test() {
    const email = 'mamaearth@trailytics.com';
    const password = 'mamaearth@123';
    
    console.log("Before login attempt: checking latest pending row...");
    const before = await queryAdminDB(`
        SELECT id, user_email, access, last_login 
        FROM tb_user 
        WHERE user_email = '${email}' 
        ORDER BY last_login DESC 
        LIMIT 1
    `);
    console.log("Latest row before:", before[0]);

    try {
        console.log("\nSimulating login...");
        await loginUser(email, password, '127.0.0.1');
    } catch (err) {
        console.log("Login threw expected error:", err.message);
    }

    console.log("\nAfter login attempt: checking latest pending row...");
    const after = await queryAdminDB(`
        SELECT id, user_email, access, last_login 
        FROM tb_user 
        WHERE user_email = '${email}' 
        ORDER BY last_login DESC 
        LIMIT 1
    `);
    console.log("Latest row after:", after[0]);
    
    if (after[0] && after[0].last_login !== before[0].last_login) {
        console.log("\n✅ SUCCESS: The last_login timestamp was updated / a new pending request row was inserted!");
    } else {
        console.log("\n❌ FAILURE: The timestamp was not updated.");
    }
    process.exit(0);
}

test();
