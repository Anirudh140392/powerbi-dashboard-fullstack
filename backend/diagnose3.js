import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const brands = ['Catsan', 'Cesar', 'Sheba', 'Temptations', 'Kitekat', 'Whiskas'];
        
        for (const brand of brands) {
            const currentQuery = `
                SELECT 
                    SUM(Sales) as current_sales
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '2026-03-12' AND '2026-03-27'
                  AND Comp_flag = 0
                  AND Brand LIKE '%${brand}%'
            `;
            const prevQuery = `
                SELECT 
                    SUM(Sales) as previous_sales
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '2026-02-24' AND '2026-03-11'
                  AND Comp_flag = 0
                  AND Brand LIKE '%${brand}%'
            `;
            
            const [currRes, prevRes] = await Promise.all([
                queryClickHouse(currentQuery),
                queryClickHouse(prevQuery)
            ]);
            
            console.log(`--- ${brand} ---`);
            console.log(`Current (12 Mar - 27 Mar):`, currRes[0]?.current_sales);
            console.log(`Previous (24 Feb - 11 Mar):`, prevRes[0]?.previous_sales);
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
