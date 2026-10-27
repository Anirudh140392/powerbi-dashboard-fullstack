import { queryClickHouse } from './src/config/clickhouse.js';

async function findSunscreenInAllDBs() {
    try {
        const dbsResult = await queryClickHouse("SHOW DATABASES");
        const dbs = dbsResult.map(row => row.name).filter(name => !['system', 'INFORMATION_SCHEMA', 'information_schema', 'default'].includes(name));
        console.log("Databases:", dbs);

        for (const db of dbs) {
            try {
                const query = `
                    SELECT Category, SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as total_sales
                    FROM ${db}.rb_pdp_olap
                    WHERE lower(Category) LIKE '%sun%' OR lower(Category) LIKE '%screen%'
                    GROUP BY Category
                `;
                const sales = await queryClickHouse(query);
                if (sales.length > 0) {
                    console.log(`\nFound in DB: ${db}`);
                    console.log(sales);
                }
            } catch (e) {
                // Table might not exist in this DB
            }
        }
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

findSunscreenInAllDBs();
