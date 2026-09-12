import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
    username: process.env.CLICKHOUSE_USER || 'kenil_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'Kenil@Kavar0604',
    database: 'admin_master',
});

async function run() {
    try {
        const usersResult = await client.query({
            query: `SELECT user_email, toString(db_id) as db_id FROM tb_user WHERE user_email='boat@trailytics.com' LIMIT 5`,
            format: 'JSONEachRow',
        });
        const users = await usersResult.json();
        console.log("Boat user:", users);
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
