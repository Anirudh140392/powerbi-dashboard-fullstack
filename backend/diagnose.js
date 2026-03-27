import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const query = `
            SELECT 
                Brand,
                sum(Sales) as total_sales
            FROM rb_pdp_olap
            WHERE toDate(DATE) >= '2024-02-01'
              AND Comp_flag = 0
            GROUP BY Brand
            ORDER BY total_sales DESC
        `;
        const res = await queryClickHouse(query);
        console.log("Total Sales per Brand (Comp_flag=0):");
        console.table(res);

        const iamsQuery = `
            SELECT 
                toDate(DATE) as d,
                sum(Sales) as s
            FROM rb_pdp_olap
            WHERE Brand LIKE '%IAMS%'
            GROUP BY d
            ORDER BY d DESC
            LIMIT 10
        `;
        const res2 = await queryClickHouse(iamsQuery);
        console.log("IAMS Recent Sales Array:");
        console.table(res2);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
