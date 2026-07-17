import { queryClickHouse, dbStorage } from './src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    dbStorage.run({ dbName: 'mamaearth' }, async () => {
        try {
            const query = 'SELECT DISTINCT platform FROM watchtower_agg_daily';
            const results = await queryClickHouse(query);
            console.log('Platforms in watchtower_agg_daily:', results);
        } catch (e) {
            console.error(e);
        }
        process.exit(0);
    });
}
run();
