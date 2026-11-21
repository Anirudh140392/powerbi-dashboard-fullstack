import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        console.log("Checking if table rb_pdp_week exists...");
        const exists = await queryClickHouse("EXISTS TABLE rb_pdp_week");
        console.log("Existence result:", exists);
        if (exists && exists[0] && exists[0].result === 1) {
            console.log("Describing rb_pdp_week:");
            const cols = await queryClickHouse("DESCRIBE rb_pdp_week");
            console.table(cols.map(c => ({ name: c.name, type: c.type })));
        } else {
            console.log("Table rb_pdp_week does not exist!");
        }
    } catch (err) {
        console.error("Error:", err);
    }
}
run();
