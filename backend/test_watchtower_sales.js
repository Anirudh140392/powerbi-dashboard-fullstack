import { queryClickHouse, dbStorage } from './src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    // Run the queries inside the async storage context with dbName = 'mamaearth'
    dbStorage.run({ dbName: 'mamaearth' }, async () => {
        try {
            console.log("Database context:", 'mamaearth');
            
            // 1. Total sales for All platforms
            const qAll = `
                SELECT SUM(Sales) as total_sales, COUNT(*) as rows
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '2026-07-01' AND '2026-07-15'
                  AND Comp_flag = 0
            `;
            const resAll = await queryClickHouse(qAll);
            console.log("All platforms:", resAll?.[0]);

            // 2. Total sales for Blinkit
            const qBlinkit = `
                SELECT SUM(Sales) as total_sales, COUNT(*) as rows
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '2026-07-01' AND '2026-07-15'
                  AND Comp_flag = 0
                  AND lower(Platform) = 'blinkit'
            `;
            const resBlinkit = await queryClickHouse(qBlinkit);
            console.log("Blinkit only:", resBlinkit?.[0]);

            // 3. Total sales for Zepto
            const qZepto = `
                SELECT SUM(Sales) as total_sales, COUNT(*) as rows
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '2026-07-01' AND '2026-07-15'
                  AND Comp_flag = 0
                  AND lower(Platform) = 'zepto'
            `;
            const resZepto = await queryClickHouse(qZepto);
            console.log("Zepto only:", resZepto?.[0]);

            // 4. Total sales for Blinkit + Zepto
            const qMulti = `
                SELECT SUM(Sales) as total_sales, COUNT(*) as rows
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '2026-07-01' AND '2026-07-15'
                  AND Comp_flag = 0
                  AND lower(Platform) IN ('blinkit', 'zepto')
            `;
            const resMulti = await queryClickHouse(qMulti);
            console.log("Blinkit + Zepto:", resMulti?.[0]);

        } catch (e) {
            console.error(e);
        }
        process.exit(0);
    });
}

run();
