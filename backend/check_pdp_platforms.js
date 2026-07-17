import { queryClickHouse, dbStorage } from './src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    dbStorage.run({ dbName: 'mamaearth' }, async () => {
        try {
            const query = 'SELECT DISTINCT Platform FROM rb_pdp_olap';
            const results = await queryClickHouse(query);
            console.log('Platforms in rb_pdp_olap:', results);
        } catch (e) {
            console.error(e);
        }
        process.exit(0);
    });
}
run();
