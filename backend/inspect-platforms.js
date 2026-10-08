import { queryClickHouse, dbStorage } from './src/config/clickhouse.js';

async function inspect() {
    await dbStorage.run({ dbName: 'hm_stahl' }, async () => {
        const rows = await queryClickHouse(`
            SELECT DISTINCT platform, channel 
            FROM rca_sku_dim 
            ORDER BY platform, channel
        `);
        console.log("rca_sku_dim rows:", rows);
    });
}

inspect().catch(console.error);
