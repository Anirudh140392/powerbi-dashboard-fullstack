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
        const dbsResult = await client.query({
            query: `SELECT toString(db_id) as db_id, db_name FROM tb_database`,
            format: 'JSONEachRow',
        });
        const dbs = await dbsResult.json();
        console.log("Databases:", dbs);
        
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
