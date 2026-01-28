import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: 'gcpl',
});

async function getCols() {
    const r = await clickhouse.query({ query: 'DESCRIBE TABLE rb_pdp_olap', format: 'JSONEachRow' });
    const data = await r.json();
    data.forEach(c => console.log(`${c.name}: ${c.type}`));
}

getCols();
