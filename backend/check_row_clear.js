import { queryClickHouse } from './src/config/clickhouse.js';

async function checkRow() {
    try {
        const query = `SELECT * FROM rb_pdp_olap WHERE Selling_Price > 0 LIMIT 1`;
        const results = await queryClickHouse(query);
        const row = results[0];
        for (const key in row) {
            console.log(`${key}: ${row[key]}`);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

checkRow();
