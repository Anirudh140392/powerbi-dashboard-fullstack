import { queryClickHouse, dbStorage, connectClickHouse } from './src/config/clickhouse.js';

async function testEmptyAgg() {
    await connectClickHouse();
    await dbStorage.run({ dbName: 'mars' }, async () => {
        try {
            const query = `
                SELECT AVG(Discount) as avg_disc
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '2099-01-01' AND '2099-01-02'
            `;
            const results = await queryClickHouse(query);
            console.log(JSON.stringify(results));
        } catch (err) {
            console.error("Error:", err.message);
        }
    });
}
testEmptyAgg();
