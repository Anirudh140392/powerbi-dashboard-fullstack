import { loginUser } from './services/authService.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        console.log("Calling loginUser...");
        const res = await loginUser('admin@trailytics.com', 'admin123', {
            deviceToken: null,
            fingerprintId: 'test-fingerprint',
            browser: 'Chrome',
            browserVersion: '120.0.0',
            os: 'Linux',
            platform: 'Linux x86_64',
            ip: '127.0.0.1'
        });
        console.log("Success:", res);
    } catch (e) {
        console.error("Failed with error:", e);
    }
}

run();
