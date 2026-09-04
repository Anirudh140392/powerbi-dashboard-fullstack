import 'dotenv/config';
import { createClient } from '@clickhouse/client';

const c = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: 'admin_master'
});

// Check all rows for boat
const r = await c.query({
    query: `SELECT user_email, db_status, tab_permissions, last_login FROM tb_user WHERE user_email='boat@trailytics.com' ORDER BY last_login DESC LIMIT 5`,
    format: 'JSONEachRow'
});
const data = await r.json();
console.log('All Boat Client rows:');
data.forEach((row, i) => {
    console.log(`  Row ${i}: db_status=${row.db_status}, tab_permissions=${row.tab_permissions || '(empty)'}, last_login=${row.last_login}`);
});

// Check pending mutations
const m = await c.query({
    query: `SELECT * FROM system.mutations WHERE is_done = 0 AND table = 'tb_user'`,
    format: 'JSONEachRow'
});
const mutations = await m.json();
console.log(`\nPending mutations: ${mutations.length}`);
mutations.forEach(mut => console.log(`  ${mut.command}`));

await c.close();
