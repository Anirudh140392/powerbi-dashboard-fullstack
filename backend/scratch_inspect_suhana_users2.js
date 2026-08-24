import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const CH_URL = process.env.CLICKHOUSE_URL || 'http://13.203.251.97:8123';
const CH_USER = process.env.CLICKHOUSE_USER || 'default';
const CH_PASS = process.env.CLICKHOUSE_PASSWORD || '';

const client = createClient({
    url: CH_URL,
    username: CH_USER,
    password: CH_PASS,
    database: 'admin_master',
    request_timeout: 30000,
});

async function main() {
    try {
        const usersRes = await client.query({
            query: `SELECT user_email, user_name, toString(db_id) as db_id_str, status, db_status, tab_permissions, last_login FROM tb_user WHERE lower(user_email) LIKE '%suhana%' OR lower(user_name) LIKE '%suhana%' LIMIT 10`,
            format: "JSONEachRow"
        });
        const users = await usersRes.json();
        console.log("Suhana users:", JSON.stringify(users, null, 2));

        if (users.length === 0) {
            console.log("No specific suhana email found, listing recent users in tb_user...");
            const allUsersRes = await client.query({
                query: `SELECT DISTINCT user_email, toString(db_id) as db_id_str, db_status, tab_permissions FROM tb_user LIMIT 20`,
                format: "JSONEachRow"
            });
            console.log("Sample users:", JSON.stringify(await allUsersRes.json(), null, 2));
        }
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}
main();
