import { queryClickHouse } from './src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const query = 'SELECT DISTINCT platform FROM rca_sku_dim';
        const results = await queryClickHouse(query);
        console.log('Platforms in rca_sku_dim:', results);
    } catch (e) {
        console.error(e);
    }
}
run();
