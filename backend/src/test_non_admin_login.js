import { loginUser } from './services/authService.js';
import bcrypt from 'bcrypt';
import { queryAdminDB } from './config/adminClickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        console.log("Running non-admin login test...");
        // Let's find a non-admin email
        const users = await queryAdminDB("SELECT user_email, password_hash FROM tb_user WHERE user_role != 'admin' LIMIT 1");
        if (users.length === 0) {
            console.log("No non-admin users found.");
            return;
        }
        const email = users[0].user_email;
        const hash = users[0].password_hash;
        console.log(`Testing with user email: ${email}`);

        // We will temporarily override bcrypt.compare so it succeeds for this hash
        const originalCompare = bcrypt.compare;
        bcrypt.compare = async () => true;

        try {
            const res = await loginUser(email, 'any_password_since_mocked', {
                deviceToken: null,
                fingerprintId: 'non-admin-test-fingerprint',
                browser: 'Firefox',
                browserVersion: '122.0',
                os: 'Linux',
                platform: 'Linux x86_64',
                ip: '192.168.1.100'
            });
            console.log("Success:", res);
        } catch (loginError) {
            console.error("Login failed with error:", loginError);
        } finally {
            bcrypt.compare = originalCompare;
        }
    } catch (e) {
        console.error("Script failed:", e);
    }
}

run();
