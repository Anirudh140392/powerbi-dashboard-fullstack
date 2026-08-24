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
        console.log("Fetching suhana_masala database db_id...");
        const dbRes = await client.query({
            query: "SELECT db_id, db_name FROM tb_database WHERE lower(db_name) LIKE '%suhana%'",
            format: "JSONEachRow"
        });
        const dbs = await dbRes.json();
        console.log("Databases found:", dbs);

        if (dbs.length > 0) {
            const dbId = dbs[0].db_id;
            console.log(`\nFetching users for db_id = ${dbId}...`);
            const usersRes = await client.query({
                query: `SELECT user_email, user_name, toString(db_id) as db_id_str, status, db_status, tab_permissions, last_login FROM tb_user WHERE toString(db_id) = '${dbId}' ORDER BY last_login DESC LIMIT 5`,
                format: "JSONEachRow"
            });
            const users = await usersRes.json();
            console.log("Users in suhana_masala:", JSON.stringify(users, null, 2));
        }
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}
main();
