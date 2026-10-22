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
        console.log("Checking tb_user table...");
        const usersResult = await client.query({
            query: "SELECT user_email, user_name, user_role, toString(db_id) as db_id, status, access FROM tb_user LIMIT 50",
            format: 'JSONEachRow',
        });
        const users = await usersResult.json();
        console.log("Users:", users);

        console.log("\nChecking tb_database table...");
        const dbsResult = await client.query({
            query: "SELECT toString(db_id) as db_id, db_name, status FROM tb_database",
            format: 'JSONEachRow',
        });
        const dbs = await dbsResult.json();
        console.log("Databases mapping:", dbs);

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
