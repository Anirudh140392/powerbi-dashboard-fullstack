import 'dotenv/config';
import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: 'gcpl',
});

async function getCols() {
    const r = await clickhouse.query({ query: 'DESCRIBE TABLE rb_pdp_olap', format: 'JSONEachRow' });
    const data = await r.json();
    console.log('Columns in rb_pdp_olap:');
    data.forEach(c => console.log(`- ${c.name} (${c.type})`));
}

getCols();