import { queryClickHouse, dbStorage, connectClickHouse } from './src/config/clickhouse.js';

async function checkLocations() {
    await connectClickHouse();
    await dbStorage.run({ dbName: 'mars' }, async () => {
        try {
            const res = await queryClickHouse('SELECT Location, count() as count FROM rb_pdp_olap GROUP BY Location ORDER BY count DESC LIMIT 10');
            console.log("Mars Locations:", JSON.stringify(res, null, 2));
            process.exit(0);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    });
}
checkLocations();
