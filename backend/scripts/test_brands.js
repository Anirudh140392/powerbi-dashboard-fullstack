import { queryClickHouse, dbStorage, connectClickHouse } from './src/config/clickhouse.js';

async function checkBrands() {
    await connectClickHouse();
    await dbStorage.run({ dbName: 'mars' }, async () => {
        try {
            const res = await queryClickHouse("SELECT DISTINCT Brand FROM rb_pdp_olap LIMIT 10");
            console.log("Mars Brands:", JSON.stringify(res, null, 2));
        } catch (err) {
            console.error(err);
        }
    });
}
checkBrands();
