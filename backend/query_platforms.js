import dotenv from 'dotenv';
dotenv.config();

import { queryClickHouse, dbStorage } from './src/config/clickhouse.js';

async function main() {
    dbStorage.run({ dbName: 'mamaearth' }, async () => {
        try {
            const rawRes = await queryClickHouse("SELECT DISTINCT Brand FROM rb_pdp_olap WHERE Brand LIKE '%The Derma Co.%'");
            console.log("LIKE %The Derma Co.% matches:", rawRes);
            
            const ilikeRes = await queryClickHouse("SELECT DISTINCT Brand FROM rb_pdp_olap WHERE Brand ILIKE '%The Derma Co.%'");
            console.log("ILIKE %The Derma Co.% matches:", ilikeRes);
        } catch (e) {
            console.error(e);
        }
    });
}

main();
