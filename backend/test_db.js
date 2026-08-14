import db from './src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const query1 = `SELECT DISTINCT lower(Platform) as p FROM rb_pdp_olap WHERE lower(channel) = 'quickcomm'`;
        const res1 = await db.query({ query: query1, format: 'JSONEachRow' });
        const data = await res1.json();
        console.log("PDP QComm Platforms:", data);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
