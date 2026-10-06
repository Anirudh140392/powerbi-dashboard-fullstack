import { queryClickHouse, dbStorage } from './src/config/clickhouse.js';

async function run() {
    dbStorage.run({ dbName: 'drl' }, async () => {
        try {
            console.log('--- Comp_flag distribution for Amazon + buy more ---');
            const compFlags = await queryClickHouse(`
                SELECT Comp_flag, COUNT() as cnt 
                FROM rb_pdp_olap 
                WHERE lower(Platform) = 'amazon' AND lower(Reseller_Name) = 'buy more'
                GROUP BY Comp_flag
            `);
            console.log('Comp Flags:', compFlags);
        } catch (e) {
            console.error('Error:', e);
        }
    });
}
run();
